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
    const { plan_type, billing_cycle } = await req.json();

    if (!plan_type || !PLAN_PRICES[plan_type]) {
      return new Response(JSON.stringify({ error: "Plano inválido" }), {
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
        console.error("[create-plan-payment] CPF decrypt error:", e);
      }
    }

    const planLabel = plan_type === "plus" ? "Vendedor Plus" : "Loja Oficial";
    const cycleLabel = cycle === "annual" ? "Anual" : "Mensal";
    const pagarmeAuth = btoa(pagarmeApiKey + ":");

    const pixExpiration = new Date();
    pixExpiration.setHours(pixExpiration.getHours() + 24);

    console.log("[create-plan-payment] Creating PIX order:", { userId, plan_type, cycle, amount });

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
        payment_method: "pix",
        pix: { expires_in: 86400 },
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
      console.error("[create-plan-payment] Pagar.me error:", JSON.stringify(orderData));
      return new Response(JSON.stringify({ error: orderData.message || "Erro ao criar pagamento PIX" }), {
        status: 500, headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const charge = orderData.charges?.[0];
    const lastTransaction = charge?.last_transaction;
    const qrCodeUrl = lastTransaction?.qr_code_url;
    const qrCode = lastTransaction?.qr_code;

    if (!qrCode) {
      console.error("[create-plan-payment] No PIX QR code:", JSON.stringify(orderData));
      return new Response(JSON.stringify({ error: "Erro ao gerar QR Code PIX" }), {
        status: 500, headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const { data: payment, error: insertError } = await supabase
      .from("plan_payments")
      .insert({
        user_id: userId,
        plan_type,
        billing_cycle: cycle,
        amount,
        pagarme_order_id: orderData.id,
        status: "pending",
        pix_payload: qrCode,
        pix_qrcode_url: qrCodeUrl || null,
        pix_expiration: pixExpiration.toISOString(),
      })
      .select("id")
      .single();

    if (insertError) {
      console.error("[create-plan-payment] Insert error:", insertError);
      throw insertError;
    }

    console.log("[create-plan-payment] Payment record saved:", payment.id);

    return new Response(JSON.stringify({
      success: true,
      paymentId: payment.id,
      qrcode_url: qrCodeUrl || null,
      payload: qrCode,
      expiration: pixExpiration.toISOString(),
      amount,
    }), {
      status: 200, headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("[create-plan-payment] Error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500, headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
};

serve(handler);
