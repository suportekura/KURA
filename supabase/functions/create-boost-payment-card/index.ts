import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";

// AES-256-GCM decryption
async function decrypt(encryptedBase64: string, key: string): Promise<string> {
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  const keyData = encoder.encode(key);
  const hashBuffer = await crypto.subtle.digest("SHA-256", keyData);
  const cryptoKey = await crypto.subtle.importKey("raw", new Uint8Array(hashBuffer), { name: "AES-GCM" }, false, ["decrypt"]);
  const combined = Uint8Array.from(atob(encryptedBase64), (c) => c.charCodeAt(0));
  const iv = combined.slice(0, 12);
  const ciphertext = combined.slice(12);
  const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, cryptoKey, ciphertext);
  return decoder.decode(decrypted);
}

const BOOST_PRICES_SINGLE: Record<string, number> = {
  "24h": 5.00,
  "3d": 9.90,
  "7d": 14.90,
};

const BOOST_PRICES_PACKAGE: Record<string, number> = {
  "24h": 19.90,
  "3d": 39.90,
  "7d": 59.90,
};

const handler = async (req: Request): Promise<Response> => {
  const origin = req.headers.get("origin");
  const corsHeaders = getCorsHeaders(origin);

  const preflightResponse = handleCorsPreflightRequest(req);
  if (preflightResponse) return preflightResponse;

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const pagarmeApiKey = Deno.env.get("PAGARME_API_KEY");
    const encryptionKey = Deno.env.get("DATA_ENCRYPTION_KEY");

    if (!pagarmeApiKey) {
      return new Response(
        JSON.stringify({ error: "Pagar.me API key not configured" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Guardrail: public/encryption keys are invalid for server-side order creation
    if (pagarmeApiKey.startsWith("pk_") || pagarmeApiKey.startsWith("ek_")) {
      return new Response(
        JSON.stringify({ error: "Chave do Pagar.me inválida para pagamentos. Use a SecretKey da API." }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Validate JWT
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const supabaseAnon = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabaseAnon.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const userId = claimsData.claims.sub as string;

    // Parse body
    const body = await req.json();
    const { boost_type, quantity: reqQuantity, card_number, card_holder_name, card_exp_month, card_exp_year, card_cvv } = body;

    if (!boost_type || !BOOST_PRICES_SINGLE[boost_type]) {
      return new Response(
        JSON.stringify({ error: "Invalid boost_type. Must be 24h, 3d, or 7d" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Validate card fields
    if (!card_number || !card_holder_name || !card_exp_month || !card_exp_year || !card_cvv) {
      return new Response(
        JSON.stringify({ error: "Dados do cartão incompletos" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const quantity = reqQuantity && reqQuantity === 5 ? 5 : 1;
    const amount = quantity === 5 ? BOOST_PRICES_PACKAGE[boost_type] : BOOST_PRICES_SINGLE[boost_type];
    const amountInCents = Math.round(amount * 100);
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get user profile for customer data
    const { data: profile } = await supabase
      .from("profiles")
      .select("display_name, full_name, phone, city")
      .eq("user_id", userId)
      .maybeSingle();

    // Get user email from auth
    const { data: userData } = await supabaseAnon.auth.getUser(token);
    const userEmail = userData?.user?.email || "customer@kuralab.com";
    const customerName = profile?.full_name || profile?.display_name || "Cliente KuraLab";

    const boostLabel = quantity === 5
      ? `Pacote Econômico (5x ${boost_type === "24h" ? "24 horas" : boost_type === "3d" ? "3 dias" : "7 dias"})`
      : boost_type === "24h" ? "24 horas" : boost_type === "3d" ? "3 dias" : "7 dias";

    console.log("[create-boost-payment-card] Creating Pagar.me order:", { userId, boost_type, amount, keyPrefix: pagarmeApiKey.slice(0, 10) + "..." });

    // Create order on Pagar.me API v5
    const pagarmeAuth = btoa(pagarmeApiKey + ":");

    // Get user CPF for customer document (required by Pagar.me)
    const { data: pfProfile } = await supabase
      .from("pf_profiles")
      .select("cpf_encrypted")
      .eq("user_id", userId)
      .maybeSingle();

    // Decrypt CPF for Pagar.me (requires plain text, max 50 chars)
    let customerDocument = "00000000000";
    if (pfProfile?.cpf_encrypted && encryptionKey) {
      try {
        customerDocument = await decrypt(pfProfile.cpf_encrypted, encryptionKey);
        // Keep only digits
        customerDocument = customerDocument.replace(/\D/g, "");
      } catch (e) {
        console.error("[create-boost-payment-card] CPF decrypt error:", e);
      }
    }

    const orderPayload = {
      closed: true,
      items: [
        {
          code: quantity === 5 ? `boost_package_${boost_type}` : `boost_${boost_type}`,
          amount: amountInCents,
          description: `Boost ${boostLabel} - KuraLab`,
          quantity: 1,
        },
      ],
      customer: {
        name: customerName,
        email: userEmail,
        type: "individual",
        document: customerDocument,
        phones: {
          mobile_phone: {
            country_code: "55",
            area_code: "11",
            number: (profile?.phone || "999999999").replace(/\D/g, "").slice(-9),
          },
        },
      },
      payments: [
        {
          payment_method: "credit_card",
          credit_card: {
            installments: 1,
            capture: true,
            statement_descriptor: "KURALAB",
            card: {
              number: card_number.replace(/\s/g, ""),
              holder_name: card_holder_name,
              exp_month: parseInt(card_exp_month),
              exp_year: parseInt(card_exp_year),
              cvv: card_cvv,
              billing_address: {
                line_1: "1, Rua KuraLab, Centro",
                zip_code: "01001000",
                city: profile?.city || "São Paulo",
                state: "SP",
                country: "BR",
              },
            },
          },
        },
      ],
    };

    const orderResponse = await fetch("https://api.pagar.me/core/v5/orders", {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
        authorization: `Basic ${pagarmeAuth}`,
      },
      body: JSON.stringify(orderPayload),
    });

    const orderData = await orderResponse.json();

    if (!orderResponse.ok || !orderData.id) {
      console.error("[create-boost-payment-card] Pagar.me error:", JSON.stringify(orderData));
      
      // Extract user-friendly error
      let errorMsg = "Erro ao processar pagamento com cartão";
      if (orderData.errors) {
        if (typeof orderData.errors === "object" && !Array.isArray(orderData.errors)) {
          // Pagar.me returns errors as { "field": ["message"] }
          const messages: string[] = [];
          for (const key of Object.keys(orderData.errors)) {
            const vals = orderData.errors[key];
            if (Array.isArray(vals)) {
              messages.push(...vals);
            }
          }
          if (messages.length > 0) {
            // Translate common messages
            const translated = messages.map((m: string) => {
              if (m.includes("not a valid card number")) return "Número do cartão inválido";
              if (m.includes("cvv")) return "CVV inválido";
              if (m.includes("exp")) return "Data de validade inválida";
              return m;
            });
            errorMsg = translated.join(". ");
          }
        } else if (Array.isArray(orderData.errors)) {
          errorMsg = orderData.errors.map((e: any) => e.message || e.description).join("; ");
        }
      } else if (orderData.message) {
        errorMsg = orderData.message;
      }
      
      return new Response(
        JSON.stringify({ error: errorMsg }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log("[create-boost-payment-card] Order created:", orderData.id, "Status:", orderData.status);

    // Check charge status
    const charge = orderData.charges?.[0];
    const lastTransaction = charge?.last_transaction;
    const transactionStatus = lastTransaction?.status;

    // For credit card, payment is processed immediately in most cases
    const isPaid =
      orderData.status === "paid" ||
      transactionStatus === "captured" ||
      transactionStatus === "authorized_pending_capture";

    const isPendingGateway =
      orderData.status === "processing" ||
      orderData.status === "pending" ||
      transactionStatus === "processing" ||
      transactionStatus === "pending";

    const paymentStatus = isPaid ? "confirmed" : isPendingGateway ? "pending" : "failed";

    // Save payment record
    const { data: payment, error: insertError } = await supabase
      .from("boost_payments")
      .insert({
        user_id: userId,
        boost_type,
        quantity,
        amount,
        asaas_payment_id: `pagarme_${orderData.id}`,
        status: paymentStatus,
      })
      .select("id")
      .single();

    if (insertError) {
      console.error("[create-boost-payment-card] Insert error:", insertError);
      throw insertError;
    }

    // If payment confirmed, credit the boosts
    if (isPaid) {
      // Upsert user_boosts
      const { data: existingBoosts } = await supabase
        .from("user_boosts")
        .select("id")
        .eq("user_id", userId)
        .maybeSingle();

      if (!existingBoosts) {
        const insertObj: Record<string, any> = {
          user_id: userId,
          total_boosts_24h: 0,
          total_boosts_3d: 0,
          total_boosts_7d: 0,
        };
        if (boost_type === "24h") insertObj.total_boosts_24h = quantity;
        else if (boost_type === "3d") insertObj.total_boosts_3d = quantity;
        else if (boost_type === "7d") insertObj.total_boosts_7d = quantity;

        await supabase.from("user_boosts").insert(insertObj);
      } else {
        const column = boost_type === "24h" ? "total_boosts_24h" : boost_type === "3d" ? "total_boosts_3d" : "total_boosts_7d";
        
        // Get current value and increment
        const { data: current } = await supabase
          .from("user_boosts")
          .select(column)
          .eq("user_id", userId)
          .single();

        if (current) {
          await supabase
            .from("user_boosts")
            .update({ [column]: (current as any)[column] + quantity, updated_at: new Date().toISOString() })
            .eq("user_id", userId);
        }
      }

      console.log("[create-boost-payment-card] Boost credited:", boost_type);
    }

    if (!isPaid) {
      const gatewayMessage =
        lastTransaction?.acquirer_message ||
        lastTransaction?.gateway_response?.errors?.[0]?.message ||
        lastTransaction?.gateway_response?.message ||
        orderData?.message;

      let declineMsg = gatewayMessage || "Cartão recusado. Verifique os dados e tente novamente.";

      if (declineMsg.includes("Não foi possível encontrar os dados da Company desejada") || declineMsg.includes("not_found")) {
        declineMsg = "Configuração do gateway inválida: verifique a SecretKey do Pagar.me e se ela corresponde ao ambiente correto (teste/produção).";
      }

      console.warn("[create-boost-payment-card] Payment not approved", {
        orderId: orderData.id,
        orderStatus: orderData.status,
        transactionStatus,
        gatewayMessage,
      });

      // Business failure (card declined) should not be HTTP 400, so UI can handle gracefully
      return new Response(
        JSON.stringify({
          success: false,
          error: declineMsg,
          status: transactionStatus || orderData.status || "failed",
        }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        paymentId: payment.id,
        orderId: orderData.id,
        status: "confirmed",
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("[create-boost-payment-card] Error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
