import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Constant-time string comparison to avoid timing attacks.
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

// Pagar.me API v5 secures webhooks via optional HTTP Basic Authentication.
// Configure the same user/password in the Pagar.me dashboard (endpoint > Autenticação)
// and as the PAGARME_WEBHOOK_USER / PAGARME_WEBHOOK_PASSWORD secrets in Supabase.
function verifyBasicAuth(authHeader: string | null): boolean {
  const expectedUser = Deno.env.get("PAGARME_WEBHOOK_USER");
  const expectedPass = Deno.env.get("PAGARME_WEBHOOK_PASSWORD");

  // Fail closed: if no credentials are configured, never accept the request.
  if (!expectedUser || !expectedPass) {
    console.error("[pagarme-webhook] Missing PAGARME_WEBHOOK_USER/PAGARME_WEBHOOK_PASSWORD secrets.");
    return false;
  }

  if (!authHeader || !authHeader.toLowerCase().startsWith("basic ")) return false;

  let decoded: string;
  try {
    decoded = atob(authHeader.slice(6).trim());
  } catch {
    return false;
  }

  // Split on the FIRST colon only (the password may itself contain colons).
  const sepIndex = decoded.indexOf(":");
  if (sepIndex === -1) return false;
  const user = decoded.slice(0, sepIndex);
  const pass = decoded.slice(sepIndex + 1);

  return safeEqual(user, expectedUser) && safeEqual(pass, expectedPass);
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204 });
  }

  try {
    const rawBody = await req.text();

    // Authenticate the webhook via HTTP Basic Auth (Pagar.me v5 mechanism).
    const authHeader = req.headers.get("authorization");
    const isValid = verifyBasicAuth(authHeader);
    if (!isValid) {
      console.error("[pagarme-webhook] Unauthorized webhook request. Rejecting.");
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const body = JSON.parse(rawBody);
    const eventType = body.type;
    const data = body.data;

    if (!eventType || !data) {
      console.log("[pagarme-webhook] Ignoring event without type or data");
      return new Response(JSON.stringify({ received: true }), {
        status: 200, headers: { "Content-Type": "application/json" },
      });
    }

    console.log("[pagarme-webhook] Event:", eventType, "ID:", data.id);

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    // charge.* events carry data.id = charge ID (ch_xxx); the order ID is in data.order.id.
    // order.* events carry data.id = order ID (or_xxx) directly.
    const orderId = eventType.startsWith("charge.") ? (data.order?.id ?? data.id) : data.id;

    // Try to find in boost_payments first
    const pagarmePaymentId = `pagarme_${orderId}`;
    const { data: boostPayment } = await supabase
      .from("boost_payments")
      .select("id, user_id, boost_type, status, quantity")
      .eq("asaas_payment_id", pagarmePaymentId)
      .maybeSingle();

    // Try to find in plan_payments
    const { data: planPayment } = await supabase
      .from("plan_payments")
      .select("id, user_id, plan_type, billing_cycle, status")
      .eq("pagarme_order_id", orderId)
      .maybeSingle();

    if (!boostPayment && !planPayment) {
      console.log("[pagarme-webhook] No matching payment for:", orderId);
      return new Response(JSON.stringify({ received: true, matched: false }), {
        status: 200, headers: { "Content-Type": "application/json" },
      });
    }

    // ========== BOOST PAYMENT HANDLING ==========
    if (boostPayment) {
      if (boostPayment.status === "confirmed" && (eventType === "order.paid" || eventType === "charge.paid")) {
        return new Response(JSON.stringify({ received: true, already_confirmed: true }), {
          status: 200, headers: { "Content-Type": "application/json" },
        });
      }

      if (eventType === "order.paid" || eventType === "charge.paid") {
        const { data: confirmedRows } = await supabase.from("boost_payments")
          .update({ status: "confirmed", updated_at: new Date().toISOString() })
          .eq("id", boostPayment.id)
          .eq("status", "pending")
          .select("id");

        if (confirmedRows?.length) {
          const qty = boostPayment.quantity || 1;
          const boostType = boostPayment.boost_type;

          const { data: existing } = await supabase
            .from("user_boosts")
            .select("id, total_boosts_24h, total_boosts_3d, total_boosts_7d")
            .eq("user_id", boostPayment.user_id)
            .maybeSingle();

          if (existing) {
            const updateData: Record<string, number | string> = { updated_at: new Date().toISOString() };
            if (boostType === "24h") updateData.total_boosts_24h = existing.total_boosts_24h + qty;
            else if (boostType === "3d") updateData.total_boosts_3d = existing.total_boosts_3d + qty;
            else if (boostType === "7d") updateData.total_boosts_7d = existing.total_boosts_7d + qty;
            await supabase.from("user_boosts").update(updateData).eq("id", existing.id);
          } else {
            const insertData: Record<string, number | string> = {
              user_id: boostPayment.user_id,
              total_boosts_24h: boostType === "24h" ? qty : 0,
              total_boosts_3d: boostType === "3d" ? qty : 0,
              total_boosts_7d: boostType === "7d" ? qty : 0,
            };
            await supabase.from("user_boosts").insert(insertData);
          }
          console.log("[pagarme-webhook] Boosts credited:", boostType, "x", qty);
        }

        return new Response(JSON.stringify({ received: true, confirmed: true }), {
          status: 200, headers: { "Content-Type": "application/json" },
        });
      }

      if (eventType === "order.payment_failed" || eventType === "charge.payment_failed") {
        await supabase.from("boost_payments")
          .update({ status: "failed", updated_at: new Date().toISOString() })
          .eq("id", boostPayment.id);
      }

      if (eventType === "order.canceled") {
        await supabase.from("boost_payments")
          .update({ status: "cancelled", updated_at: new Date().toISOString() })
          .eq("id", boostPayment.id);
      }

      if (eventType === "charge.refunded" && boostPayment.status === "confirmed") {
        const qty = boostPayment.quantity || 1;
        const boostType = boostPayment.boost_type;
        const { data: existing } = await supabase
          .from("user_boosts")
          .select("id, total_boosts_24h, total_boosts_3d, total_boosts_7d")
          .eq("user_id", boostPayment.user_id)
          .maybeSingle();

        if (existing) {
          const updateData: Record<string, number | string> = { updated_at: new Date().toISOString() };
          if (boostType === "24h") updateData.total_boosts_24h = Math.max(0, existing.total_boosts_24h - qty);
          else if (boostType === "3d") updateData.total_boosts_3d = Math.max(0, existing.total_boosts_3d - qty);
          else if (boostType === "7d") updateData.total_boosts_7d = Math.max(0, existing.total_boosts_7d - qty);
          await supabase.from("user_boosts").update(updateData).eq("id", existing.id);
        }

        await supabase.from("boost_payments")
          .update({ status: "refunded", updated_at: new Date().toISOString() })
          .eq("id", boostPayment.id);
      }
    }

    // ========== PLAN PAYMENT HANDLING ==========
    if (planPayment) {
      if (planPayment.status === "confirmed" && (eventType === "order.paid" || eventType === "charge.paid")) {
        return new Response(JSON.stringify({ received: true, already_confirmed: true }), {
          status: 200, headers: { "Content-Type": "application/json" },
        });
      }

      if (eventType === "order.paid" || eventType === "charge.paid") {
        const { data: confirmedRows } = await supabase.from("plan_payments")
          .update({ status: "confirmed", updated_at: new Date().toISOString() })
          .eq("id", planPayment.id)
          .eq("status", "pending")
          .select("id");

        if (confirmedRows?.length) {
          // Activate subscription
          const expiresAt = new Date();
          if (planPayment.billing_cycle === "annual") {
            expiresAt.setFullYear(expiresAt.getFullYear() + 1);
          } else {
            expiresAt.setMonth(expiresAt.getMonth() + 1);
          }

          const { error: upsertError } = await supabase
            .from("user_subscriptions")
            .upsert({
              user_id: planPayment.user_id,
              plan_type: planPayment.plan_type,
              expires_at: expiresAt.toISOString(),
              updated_at: new Date().toISOString(),
            }, { onConflict: "user_id" });

          if (upsertError) {
            console.error("[pagarme-webhook] CRITICAL: Subscription activation failed for user", planPayment.user_id, "plan", planPayment.plan_type, "error:", JSON.stringify(upsertError));
          } else {
            console.log("[pagarme-webhook] Plan activated:", { user_id: planPayment.user_id, plan_type: planPayment.plan_type, billing_cycle: planPayment.billing_cycle, expires_at: expiresAt.toISOString() });
          }
        }

        return new Response(JSON.stringify({ received: true, confirmed: true }), {
          status: 200, headers: { "Content-Type": "application/json" },
        });
      }

      if (eventType === "order.payment_failed" || eventType === "charge.payment_failed") {
        await supabase.from("plan_payments")
          .update({ status: "failed", updated_at: new Date().toISOString() })
          .eq("id", planPayment.id);
      }

      if (eventType === "order.canceled") {
        await supabase.from("plan_payments")
          .update({ status: "cancelled", updated_at: new Date().toISOString() })
          .eq("id", planPayment.id);
      }

      if (eventType === "charge.refunded" && planPayment.status === "confirmed") {
        // Downgrade to free
        await supabase
          .from("user_subscriptions")
          .update({ plan_type: "free", updated_at: new Date().toISOString() })
          .eq("user_id", planPayment.user_id);

        await supabase.from("plan_payments")
          .update({ status: "refunded", updated_at: new Date().toISOString() })
          .eq("id", planPayment.id);

        console.log("[pagarme-webhook] Plan refunded, downgraded to free:", planPayment.user_id);
      }
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200, headers: { "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    console.error("[pagarme-webhook] Error:", error);
    return new Response(JSON.stringify({ received: true, error: "internal" }), {
      status: 200, headers: { "Content-Type": "application/json" },
    });
  }
};

serve(handler);
