import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Redis } from "https://esm.sh/@upstash/redis@1.28.0";
import { Ratelimit } from "https://esm.sh/@upstash/ratelimit@1.0.1";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";

// Rate limiting configuration - 3 requests per hour per email
function createRateLimiter() {
  const redisUrl = Deno.env.get("UPSTASH_REDIS_URL");
  const redisToken = Deno.env.get("UPSTASH_REDIS_TOKEN");
  
  if (!redisUrl || !redisToken) {
    console.warn("[reset-password] Rate limiting not configured - UPSTASH credentials missing");
    return null;
  }
  
  const redis = new Redis({
    url: redisUrl,
    token: redisToken,
  });
  
  return new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(3, "1 h"), // 3 requests per hour
    prefix: "ratelimit:reset-password",
  });
}

// Password validation function
function validatePassword(password: string): { valid: boolean; error?: string } {
  if (password.length < 8) {
    return { valid: false, error: "A senha deve ter pelo menos 8 caracteres" };
  }
  if (password.length > 128) {
    return { valid: false, error: "A senha é muito longa" };
  }
  if (!/\d/.test(password)) {
    return { valid: false, error: "A senha deve conter pelo menos um número" };
  }
  if (!/[a-zA-Z]/.test(password)) {
    return { valid: false, error: "A senha deve conter letras" };
  }
  return { valid: true };
}

interface ResetPasswordRequest {
  email: string;
  code: string;
  newPassword: string;
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
        console.log("[reset-password] Rate limit exceeded");
        return new Response(
          JSON.stringify({ 
            error: "Muitas tentativas de redefinição de senha. Aguarde 1 hora antes de tentar novamente." 
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
      console.error("[reset-password] Rate limit check failed:", rateLimitError);
      // Continue without rate limiting if check fails
    }
  }

  try {
    const { email, code, newPassword }: ResetPasswordRequest = await req.json();

    // Validate all required fields
    if (!email || !code || !newPassword) {
      return new Response(
        JSON.stringify({ error: "Email, código e nova senha são obrigatórios" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // Validate password strength
    const passwordValidation = validatePassword(newPassword);
    if (!passwordValidation.valid) {
      return new Response(
        JSON.stringify({ error: passwordValidation.error }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // CRITICAL: Validate verification code FIRST before allowing password reset
    const { data: consumedCodes, error: fetchError } = await supabase
      .from("verification_codes")
      .update({ used: true })
      .eq("email", email)
      .eq("code", code)
      .eq("type", "password_reset")
      .eq("used", false)
      .gte("expires_at", new Date().toISOString())
      .select("id");

    if (fetchError) {
      console.error("[reset-password] Error fetching verification code");
      return new Response(
        JSON.stringify({ error: "Erro ao validar código" }),
        {
          status: 500,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    if (!consumedCodes?.length) {
      console.log("[reset-password] No valid code found");
      return new Response(
        JSON.stringify({ error: "Código inválido, expirado ou já utilizado" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // The code was already consumed atomically in the update above.
    const updateCodeError = null;

    if (updateCodeError) {
      console.error("[reset-password] Error marking code as used");
      return new Response(
        JSON.stringify({ error: "Erro ao processar código" }),
        {
          status: 500,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // Find the user by email
    const { data: { users: matchedUsers }, error: listError } = await supabase.auth.admin.listUsers({ filter: email, perPage: 1 });
    
    if (listError) {
      console.error("[reset-password] Error finding user");
      return new Response(
        JSON.stringify({ error: "Erro ao buscar usuário" }),
        {
          status: 500,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    const user = matchedUsers?.[0];

    if (!user) {
      return new Response(
        JSON.stringify({ error: "Usuário não encontrado" }),
        {
          status: 404,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // Update the user's password
    const { error: updateError } = await supabase.auth.admin.updateUserById(
      user.id,
      { password: newPassword }
    );

    if (updateError) {
      console.error("[reset-password] Error updating password");
      return new Response(
        JSON.stringify({ error: "Erro ao atualizar senha" }),
        {
          status: 500,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    console.log("[reset-password] Password reset successful");

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Senha atualizada com sucesso" 
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: unknown) {
    console.error("[reset-password] Error in function", error);
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
