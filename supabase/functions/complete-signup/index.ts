import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Redis } from "https://esm.sh/@upstash/redis@1.28.0";
import { Ratelimit } from "https://esm.sh/@upstash/ratelimit@1.0.1";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";

// Rate limiting configuration - 10 requests per hour per email
function createRateLimiter() {
  const redisUrl = Deno.env.get("UPSTASH_REDIS_URL");
  const redisToken = Deno.env.get("UPSTASH_REDIS_TOKEN");
  
  if (!redisUrl || !redisToken) {
    console.warn("[complete-signup] Rate limiting not configured - UPSTASH credentials missing");
    return null;
  }
  
  const redis = new Redis({
    url: redisUrl,
    token: redisToken,
  });
  
  return new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(10, "1 h"), // 10 requests per hour
    prefix: "ratelimit:complete-signup",
  });
}

interface CompleteSignupRequest {
  email: string;
  code: string;
  password?: string; // Optional: for creating session after verification
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
        console.log("[complete-signup] Rate limit exceeded");
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: "Muitas tentativas. Aguarde 1 hora antes de tentar novamente." 
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
      console.error("[complete-signup] Rate limit check failed:", rateLimitError);
      // Continue without rate limiting if check fails
    }
  }

  try {
    const { email, code, password }: CompleteSignupRequest = await req.json();

    if (!email || !code) {
      return new Response(
        JSON.stringify({ success: false, error: "Email e código são obrigatórios" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log("[complete-signup] Verifying code");

    const { data: consumedCodes, error: fetchError } = await supabase
      .from("verification_codes")
      .update({ used: true })
      .eq("email", email)
      .eq("code", code)
      .eq("type", "email_verification")
      .eq("used", false)
      .gte("expires_at", new Date().toISOString())
      .select("id");

    if (fetchError) {
      console.error("[complete-signup] Error fetching code");
      return new Response(
        JSON.stringify({ success: false, error: "Erro ao verificar código" }),
        {
          status: 500,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    if (!consumedCodes?.length) {
      console.log("[complete-signup] Code not found or expired");
      return new Response(
        JSON.stringify({ 
          success: false,
          valid: false,
          error: "Código inválido ou expirado"
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    console.log("[complete-signup] Code verified");

    // Find user by email using admin API
    const { data: { users: matchedUsers }, error: userError } = await supabase.auth.admin.listUsers({ filter: email, perPage: 1 });
    
    if (userError) {
      console.error("[complete-signup] Error finding user");
      return new Response(
        JSON.stringify({ success: false, error: "Erro ao buscar usuário" }),
        {
          status: 500,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    const user = matchedUsers?.[0];
    
    if (!user) {
      console.log("[complete-signup] User not found");
      return new Response(
        JSON.stringify({ success: false, error: "Usuário não encontrado" }),
        {
          status: 404,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    console.log("[complete-signup] User found, updating verification status");

    // Confirm user email using admin API (ensures Supabase knows email is valid)
    const { error: confirmError } = await supabase.auth.admin.updateUserById(
      user.id,
      { email_confirm: true }
    );

    if (confirmError) {
      console.error("[complete-signup] Error confirming email");
      return new Response(
        JSON.stringify({ success: false, error: "Erro ao confirmar email" }),
        {
          status: 500,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // Update profile to mark email as verified - THIS IS OUR SOURCE OF TRUTH
    const { error: profileError } = await supabase
      .from("profiles")
      .update({ email_verified: true })
      .eq("user_id", user.id);

    if (profileError) {
      console.error("[complete-signup] Error updating profile");
      // Don't fail completely, just log
    }

    console.log("[complete-signup] Email verified successfully");

    return new Response(
      JSON.stringify({ 
        success: true, 
        valid: true,
        message: "Email verificado com sucesso! Faça login para continuar.",
        userId: user.id
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: unknown) {
    console.error("[complete-signup] Error", error);
    return new Response(
      JSON.stringify({ success: false, error: "Erro interno do servidor" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
