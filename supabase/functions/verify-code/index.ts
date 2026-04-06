import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Redis } from "https://esm.sh/@upstash/redis@1.28.0";
import { Ratelimit } from "https://esm.sh/@upstash/ratelimit@1.0.1";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";

// Rate limiting configuration - 10 requests per 15 minutes per email
function createRateLimiter() {
  const redisUrl = Deno.env.get("UPSTASH_REDIS_URL");
  const redisToken = Deno.env.get("UPSTASH_REDIS_TOKEN");
  
  if (!redisUrl || !redisToken) {
    console.warn("[verify-code] Rate limiting not configured - UPSTASH credentials missing");
    return null;
  }
  
  const redis = new Redis({
    url: redisUrl,
    token: redisToken,
  });
  
  return new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(10, "15 m"), // 10 requests per 15 minutes
    prefix: "ratelimit:verify-code",
  });
}

interface VerifyRequest {
  email: string;
  code: string;
  type: "email_verification" | "password_reset";
  consume?: boolean;
}

const handler = async (req: Request): Promise<Response> => {
  const origin = req.headers.get("origin");
  const corsHeaders = getCorsHeaders(origin);
  
  const preflightResponse = handleCorsPreflightRequest(req);
  if (preflightResponse) return preflightResponse;
  
  // Apply rate limiting
  const ratelimit = createRateLimiter();
  if (ratelimit) {
    try {
      const body = await req.clone().json();
      const identifier = body?.email || req.headers.get("x-forwarded-for") || "anonymous";
      const { success, remaining } = await ratelimit.limit(identifier);
      
      if (!success) {
        console.log("[verify-code] Rate limit exceeded");
        return new Response(
          JSON.stringify({ 
            error: "Muitas tentativas. Aguarde 15 minutos antes de tentar novamente.",
            valid: false 
          }),
          {
            status: 429,
            headers: { 
              "Content-Type": "application/json", 
              "X-RateLimit-Remaining": remaining.toString(),
              ...corsHeaders 
            },
          }
        );
      }
    } catch (rateLimitError) {
      console.error("[verify-code] Rate limit check failed:", rateLimitError);
      // Continue without rate limiting if check fails
    }
  }

  try {
    const { email, code, type, consume = true }: VerifyRequest = await req.json();

    if (!email || !code || !type) {
      return new Response(
        JSON.stringify({ error: "Email, código e tipo são obrigatórios" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    let codeRecord: { id: string } | null = null;
    let fetchError: unknown = null;

    if (consume) {
      const { data, error } = await supabase
        .from("verification_codes")
        .update({ used: true })
        .eq("email", email)
        .eq("code", code)
        .eq("type", type)
        .eq("used", false)
        .gte("expires_at", new Date().toISOString())
        .select("id");

      fetchError = error;
      codeRecord = data?.[0] ?? null;
    } else {
      const { data, error } = await supabase
        .from("verification_codes")
        .select("id")
        .eq("email", email)
        .eq("code", code)
        .eq("type", type)
        .eq("used", false)
        .gte("expires_at", new Date().toISOString())
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      fetchError = error;
      codeRecord = data;
    }

    if (fetchError) {
      console.error("[verify-code] Error fetching code");
      return new Response(
        JSON.stringify({ error: "Erro ao verificar código" }),
        {
          status: 500,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    if (!codeRecord) {
      return new Response(
        JSON.stringify({ 
          error: "Código inválido ou expirado",
          valid: false 
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // If email verification was consumed here, mirror the verified state to profiles.
    if (consume && type === "email_verification") {
      const { data: { users: [user] = [] } } = await supabase.auth.admin.listUsers({ filter: email, perPage: 1 });
      
      if (user) {
        await supabase
          .from("profiles")
          .update({ email_verified: true })
          .eq("user_id", user.id);
      }
    }

    console.log("[verify-code] Code verified successfully");

    return new Response(
      JSON.stringify({ 
        success: true, 
        valid: true,
        message: "Código verificado com sucesso" 
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: unknown) {
    console.error("[verify-code] Error in function", error);
    return new Response(
      JSON.stringify({ error: "Erro interno do servidor" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
