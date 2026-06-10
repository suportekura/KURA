import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";

function couponAppliesToProduct(couponAppliesTo: string, productKey: string): boolean {
  if (couponAppliesTo === "all") return true;
  if (couponAppliesTo === productKey) return true;
  if (couponAppliesTo === "all_boosts" && productKey.startsWith("boost_")) return true;
  if (couponAppliesTo === "all_plans" && productKey.startsWith("plan_")) return true;
  return false;
}

function calcDiscount(discountType: string, discountValue: number, amount: number): number {
  if (discountType === "percentage") {
    return Math.round((amount * discountValue / 100) * 100) / 100;
  }
  return Math.min(discountValue, amount - 0.01);
}

const handler = async (req: Request): Promise<Response> => {
  const origin = req.headers.get("origin");
  const corsHeaders = getCorsHeaders(origin);
  const preflightResponse = handleCorsPreflightRequest(req);
  if (preflightResponse) return preflightResponse;

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ valid: false, error: "Não autenticado" }), {
        status: 401, headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnon = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData } = await supabaseAnon.auth.getClaims(token);
    if (!claimsData?.claims) {
      return new Response(JSON.stringify({ valid: false, error: "Não autenticado" }), {
        status: 401, headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }
    const userId = claimsData.claims.sub as string;

    const { code, applies_to, amount } = await req.json();
    if (!code || !applies_to || !amount) {
      return new Response(JSON.stringify({ valid: false, error: "Parâmetros inválidos" }), {
        status: 400, headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: coupon } = await supabase
      .from("admin_coupons")
      .select("id, code, discount_type, discount_value, applies_to, max_uses, expires_at, active")
      .eq("code", code.toUpperCase().trim())
      .maybeSingle();

    if (!coupon || !coupon.active) {
      return new Response(JSON.stringify({ valid: false, error: "Cupom inválido" }), {
        status: 200, headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    if (new Date(coupon.expires_at) < new Date()) {
      return new Response(JSON.stringify({ valid: false, error: "Cupom expirado" }), {
        status: 200, headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    if (!couponAppliesToProduct(coupon.applies_to, applies_to)) {
      return new Response(JSON.stringify({ valid: false, error: "Cupom não se aplica a este produto" }), {
        status: 200, headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    if (coupon.max_uses !== null) {
      const { count } = await supabase
        .from("admin_coupon_uses")
        .select("id", { count: "exact", head: true })
        .eq("coupon_id", coupon.id);
      if ((count ?? 0) >= coupon.max_uses) {
        return new Response(JSON.stringify({ valid: false, error: "Limite de usos atingido" }), {
          status: 200, headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }
    }

    const { data: existingUse } = await supabase
      .from("admin_coupon_uses")
      .select("id")
      .eq("coupon_id", coupon.id)
      .eq("user_id", userId)
      .maybeSingle();

    if (existingUse) {
      return new Response(JSON.stringify({ valid: false, error: "Cupom já utilizado" }), {
        status: 200, headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const discountAmount = calcDiscount(coupon.discount_type, coupon.discount_value, amount);
    const finalAmount = Math.max(0.01, amount - discountAmount);

    return new Response(JSON.stringify({
      valid: true,
      coupon_id: coupon.id,
      discount_type: coupon.discount_type,
      discount_value: coupon.discount_value,
      discount_amount: Math.round(discountAmount * 100) / 100,
      final_amount: Math.round(finalAmount * 100) / 100,
    }), {
      status: 200, headers: { "Content-Type": "application/json", ...corsHeaders },
    });

  } catch (error: unknown) {
    console.error("[validate-coupon] Error:", error);
    return new Response(JSON.stringify({ valid: false, error: "Erro interno" }), {
      status: 500, headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
};

serve(handler);
