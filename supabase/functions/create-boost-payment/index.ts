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
    const { boost_type, quantity: reqQuantity, amount_override } = await req.json();
    if (!boost_type || !BOOST_PRICES_SINGLE[boost_type]) {
      return new Response(
        JSON.stringify({ error: "Invalid boost_type. Must be 24h, 3d, or 7d" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const quantity = reqQuantity && reqQuantity === 5 ? 5 : 1;
    const amount = quantity === 5 ? BOOST_PRICES_PACKAGE[boost_type] : BOOST_PRICES_SINGLE[boost_type];
    const amountInCents = Math.round(amount * 100);
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get user profile
    const { data: profile } = await supabase
      .from("profiles")
      .select("display_name, full_name, phone, city")
      .eq("user_id", userId)
      .maybeSingle();

    // Get user email
    const { data: userData } = await supabaseAnon.auth.getUser(token);
    const userEmail = userData?.user?.email || "customer@kuralab.com";
    const customerName = profile?.full_name || profile?.display_name || "Cliente KuraLab";

    // Get CPF
    const { data: pfProfile } = await supabase
      .from("pf_profiles")
      .select("cpf_encrypted")
      .eq("user_id", userId)
      .maybeSingle();

    let customerDocument = "00000000000";
    if (pfProfile?.cpf_encrypted && encryptionKey) {
      try {
        customerDocument = await decrypt(pfProfile.cpf_encrypted, encryptionKey);
        customerDocument = customerDocument.replace(/\D/g, "");
      } catch (e) {
        console.error("[create-boost-payment] CPF decrypt error:", e);
      }
    }

    const boostLabel = quantity === 5 
      ? `Pacote Econômico (5x ${boost_type === "24h" ? "24 horas" : boost_type === "3d" ? "3 dias" : "7 dias"})`
      : boost_type === "24h" ? "24 horas" : boost_type === "3d" ? "3 dias" : "7 dias";
    const pagarmeAuth = btoa(pagarmeApiKey + ":");

    // PIX expiration: 24 hours from now
    const pixExpiration = new Date();
    pixExpiration.setHours(pixExpiration.getHours() + 24);

    console.log("[create-boost-payment] Creating Pagar.me PIX order:", { userId, boost_type, amount });

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
          payment_method: "pix",
          pix: {
            expires_in: 86400, // 24 hours in seconds
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
      console.error("[create-boost-payment] Pagar.me error:", JSON.stringify(orderData));
      let errorMsg = "Erro ao criar pagamento PIX";
      if (orderData.message) errorMsg = orderData.message;
      return new Response(
        JSON.stringify({ error: errorMsg, details: orderData }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log("[create-boost-payment] Order created:", orderData.id, "Status:", orderData.status);

    // Extract PIX data from the charge/transaction
    const charge = orderData.charges?.[0];
    const lastTransaction = charge?.last_transaction;
    const qrCodeUrl = lastTransaction?.qr_code_url;
    const qrCode = lastTransaction?.qr_code; // This is the PIX copy-paste payload

    if (!qrCode) {
      console.error("[create-boost-payment] No PIX QR code in response:", JSON.stringify(orderData));
      return new Response(
        JSON.stringify({ error: "Erro ao gerar QR Code PIX. Tente novamente." }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Save to boost_payments
    const { data: payment, error: insertError } = await supabase
      .from("boost_payments")
      .insert({
        user_id: userId,
        boost_type,
        quantity,
        amount,
        asaas_payment_id: `pagarme_${orderData.id}`,
        status: "pending",
        pix_payload: qrCode,
        pix_qrcode_base64: qrCodeUrl || null,
        pix_expiration: pixExpiration.toISOString(),
      })
      .select("id")
      .single();

    if (insertError) {
      console.error("[create-boost-payment] Insert error:", insertError);
      throw insertError;
    }

    console.log("[create-boost-payment] Payment record saved:", payment.id);

    return new Response(
      JSON.stringify({
        success: true,
        paymentId: payment.id,
        qrcode: qrCodeUrl || null, // URL to QR code image
        qrcode_url: qrCodeUrl || null,
        payload: qrCode,
        expiration: pixExpiration.toISOString(),
        amount,
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("[create-boost-payment] Error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
