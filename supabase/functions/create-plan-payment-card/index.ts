import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";

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

const PLAN_PRICES: Record<string, Record<string, number>> = {
  plus: { monthly: 39.90, annual: 383.04 },
  loja: { monthly: 99.90, annual: 959.04 },
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
      return new Response(JSON.stringify({ error: "Pagar.me API key not configured" }), {
        status: 500, headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    if (pagarmeApiKey.startsWith("pk_") || pagarmeApiKey.startsWith("ek_")) {
      return new Response(JSON.stringify({ error: "Chave do Pagar.me inválida. Use a SecretKey." }), {
        status: 500, headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const supabaseAnon = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabaseAnon.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const userId = claimsData.claims.sub as string;
    const body = await req.json();
    const { plan_type, billing_cycle, card_number, card_holder_name, card_exp_month, card_exp_year, card_cvv } = body;

    if (!plan_type || !PLAN_PRICES[plan_type]) {
      return new Response(JSON.stringify({ error: "Plano inválido" }), {
        status: 400, headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    if (!card_number || !card_holder_name || !card_exp_month || !card_exp_year || !card_cvv) {
      return new Response(JSON.stringify({ error: "Dados do cartão incompletos" }), {
        status: 400, headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const cycle = billing_cycle === "annual" ? "annual" : "monthly";
    const amount = PLAN_PRICES[plan_type][cycle];
    const amountInCents = Math.round(amount * 100);
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: profile } = await supabase
      .from("profiles")
      .select("display_name, full_name, phone, city")
      .eq("user_id", userId)
      .maybeSingle();

    const { data: userData } = await supabaseAnon.auth.getUser(token);
    const userEmail = userData?.user?.email || "customer@kuralab.com";
    const customerName = profile?.full_name || profile?.display_name || "Cliente KuraLab";

    const { data: pfProfile } = await supabase
      .from("pf_profiles")
      .select("cpf_encrypted")
      .eq("user_id", userId)
      .maybeSingle();

    let customerDocument = "00000000000";
    if (pfProfile?.cpf_encrypted && encryptionKey) {
      try {
        customerDocument = (await decrypt(pfProfile.cpf_encrypted, encryptionKey)).replace(/\D/g, "");
      } catch (e) {
        console.error("[create-plan-payment-card] CPF decrypt error:", e);
      }
    }

    const planLabel = plan_type === "plus" ? "Vendedor Plus" : "Loja Oficial";
    const cycleLabel = cycle === "annual" ? "Anual" : "Mensal";
    const pagarmeAuth = btoa(pagarmeApiKey + ":");

    console.log("[create-plan-payment-card] Creating order:", { userId, plan_type, cycle, amount });

    const orderPayload = {
      closed: true,
      items: [{
        code: `plan_${plan_type}_${cycle}`,
        amount: amountInCents,
        description: `Plano ${planLabel} ${cycleLabel} - KuraLab`,
        quantity: 1,
      }],
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
      payments: [{
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
      }],
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
      console.error("[create-plan-payment-card] Pagar.me error:", JSON.stringify(orderData));
      let errorMsg = "Erro ao processar pagamento com cartão";
      if (orderData.errors) {
        if (typeof orderData.errors === "object" && !Array.isArray(orderData.errors)) {
          const messages: string[] = [];
          for (const key of Object.keys(orderData.errors)) {
            const vals = orderData.errors[key];
            if (Array.isArray(vals)) messages.push(...vals);
          }
          if (messages.length > 0) {
            errorMsg = messages.map((m: string) => {
              if (m.includes("not a valid card number")) return "Número do cartão inválido";
              if (m.includes("cvv")) return "CVV inválido";
              if (m.includes("exp")) return "Data de validade inválida";
              return m;
            }).join(". ");
          }
        } else if (orderData.message) {
          errorMsg = orderData.message;
        }
      }
      return new Response(JSON.stringify({ error: errorMsg }), {
        status: 400, headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const charge = orderData.charges?.[0];
    const lastTransaction = charge?.last_transaction;
    const transactionStatus = lastTransaction?.status;

    const isPaid = orderData.status === "paid" || transactionStatus === "captured" || transactionStatus === "authorized_pending_capture";
    const paymentStatus = isPaid ? "confirmed" : "failed";

    const { data: payment, error: insertError } = await supabase
      .from("plan_payments")
      .insert({
        user_id: userId,
        plan_type,
        billing_cycle: cycle,
        amount,
        pagarme_order_id: orderData.id,
        status: paymentStatus,
      })
      .select("id")
      .single();

    if (insertError) {
      console.error("[create-plan-payment-card] Insert error:", insertError);
      throw insertError;
    }

    // If paid, activate subscription
    if (isPaid) {
      const expiresAt = new Date();
      if (cycle === "annual") {
        expiresAt.setFullYear(expiresAt.getFullYear() + 1);
      } else {
        expiresAt.setMonth(expiresAt.getMonth() + 1);
      }

      const { error: upsertError } = await supabase
        .from("user_subscriptions")
        .upsert({
          user_id: userId,
          plan_type,
          expires_at: expiresAt.toISOString(),
          updated_at: new Date().toISOString(),
        }, { onConflict: "user_id" });

      if (upsertError) {
        console.error("[create-plan-payment-card] CRITICAL: Failed to activate subscription for user", userId, "plan", plan_type, "error:", JSON.stringify(upsertError));
        return new Response(JSON.stringify({
          success: false,
          error: "Pagamento confirmado, mas erro ao ativar o plano. Entre em contato com o suporte.",
          paymentId: payment.id,
          orderId: orderData.id,
          activation_failed: true,
        }), {
          status: 200, headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }
      console.log("[create-plan-payment-card] Subscription activated:", { userId, plan_type, cycle, expires_at: expiresAt.toISOString() });
    }

    if (!isPaid) {
      const gatewayMessage = lastTransaction?.acquirer_message || lastTransaction?.gateway_response?.errors?.[0]?.message || "Cartão recusado";
      return new Response(JSON.stringify({
        success: false,
        error: gatewayMessage,
        status: transactionStatus || "failed",
      }), {
        status: 200, headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    return new Response(JSON.stringify({
      success: true,
      paymentId: payment.id,
      orderId: orderData.id,
      status: "confirmed",
    }), {
      status: 200, headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("[create-plan-payment-card] Error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500, headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
};

serve(handler);
