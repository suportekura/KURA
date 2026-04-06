import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Redis } from "https://esm.sh/@upstash/redis@1.28.0";
import { Ratelimit } from "https://esm.sh/@upstash/ratelimit@1.0.1";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";

// Resend configuration - REQUIRED
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

// FIXED: Use the verified domain directly - KuraLab <no-reply@kuralab.com.br>
const FROM_EMAIL = "no-reply@kuralab.com.br";
const FROM_NAME = "KuraLab";

// Rate limiting configuration - 5 requests per 15 minutes per email
function createRateLimiter() {
  const redisUrl = Deno.env.get("UPSTASH_REDIS_URL");
  const redisToken = Deno.env.get("UPSTASH_REDIS_TOKEN");
  
  if (!redisUrl || !redisToken) {
    console.warn("[send-verification-code] Rate limiting not configured - UPSTASH credentials missing");
    return null;
  }
  
  const redis = new Redis({
    url: redisUrl,
    token: redisToken,
  });
  
  return new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(5, "15 m"), // 5 requests per 15 minutes
    prefix: "ratelimit:send-verification-code",
  });
}

interface VerificationRequest {
  email: string;
  type: "email_verification" | "password_reset";
}

function generateCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
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
        console.log("[send-verification-code] Rate limit exceeded");
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: "Muitas tentativas. Aguarde 15 minutos antes de tentar novamente." 
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
      console.error("[send-verification-code] Rate limit check failed:", rateLimitError);
      // Continue without rate limiting if check fails
    }
  }

  try {
    const { email, type }: VerificationRequest = await req.json();

    console.log("[send-verification-code] Request received, type:", type);

    if (!email || !type) {
      console.error("[send-verification-code] Missing email or type");
      return new Response(
        JSON.stringify({ success: false, error: "Email e tipo são obrigatórios" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // Validate Resend API key
    if (!RESEND_API_KEY) {
      console.error("[send-verification-code] RESEND_API_KEY not configured!");
      return new Response(
        JSON.stringify({ 
          success: false,
          error: "Configuração de email incompleta. Contate o suporte." 
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Generate 6-digit code
    const code = generateCode();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    console.log("[send-verification-code] Generated code, expires at", expiresAt.toISOString());

    // Mark any existing unused codes as used
    await supabase
      .from("verification_codes")
      .update({ used: true })
      .eq("email", email)
      .eq("type", type)
      .eq("used", false);

    // Insert new verification code
    const { error: insertError } = await supabase
      .from("verification_codes")
      .insert({
        email,
        code,
        type,
        expires_at: expiresAt.toISOString(),
        used: false,
      });

    if (insertError) {
      console.error("[send-verification-code] Error inserting code");
      return new Response(
        JSON.stringify({ success: false, error: "Erro ao gerar código de verificação" }),
        {
          status: 500,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    console.log("[send-verification-code] Code saved successfully");

    // Prepare email content
    const subject =
      type === "email_verification"
        ? "Seu código de verificação"
        : "Redefinição de senha";

    const codeHtml = `<strong style="font-size: 32px; letter-spacing: 6px; color: #6B8E23; font-family: monospace;">${code}</strong>`;

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="margin: 0; padding: 0; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #f8f8f6;">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
          <tr>
            <td>
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #ffffff; padding: 40px; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.08);">
                <tr>
                  <td style="text-align: center; padding-bottom: 24px;">
                    <h1 style="color: #6B8E23; margin: 0; font-weight: 500; font-size: 28px;">KuraLab</h1>
                  </td>
                </tr>
                <tr>
                  <td style="text-align: center; padding-bottom: 24px;">
                    <p style="color: #4a4a4a; font-size: 16px; line-height: 1.6; margin: 0;">
                      ${type === "email_verification" ? "Seu código de verificação é:" : "Seu código para redefinir a senha é:"}
                    </p>
                  </td>
                </tr>
                <tr>
                  <td style="text-align: center; padding: 24px 0; background-color: #f8f8f6; border-radius: 8px;">
                    ${codeHtml}
                  </td>
                </tr>
                <tr>
                  <td style="text-align: center; padding-top: 24px;">
                    <p style="color: #8B7D3B; font-size: 14px; margin: 0;">
                      Este código expira em <strong>10 minutos</strong>.
                    </p>
                  </td>
                </tr>
                <tr>
                  <td style="padding-top: 32px; border-top: 1px solid #e8e6e0; margin-top: 32px;">
                    <p style="color: #999; font-size: 12px; text-align: center; margin: 0;">
                      Se você não solicitou este código, ignore este e-mail.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;

    console.log("[send-verification-code] Sending email via Resend");

    // Send email via Resend API - POST https://api.resend.com/emails
    const resendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: `${FROM_NAME} <${FROM_EMAIL}>`,
        to: [email],
        subject: subject,
        html: htmlContent,
      }),
    });

    const resendData = await resendResponse.json();

    console.log("[send-verification-code] Resend response status:", resendResponse.status);

    if (!resendResponse.ok) {
      console.error("[send-verification-code] Resend API error");
      return new Response(
        JSON.stringify({ 
          success: false,
          error: "Falha ao enviar email de verificação",
          details: "Erro no serviço de email"
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    console.log("[send-verification-code] Email sent successfully");

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Código enviado com sucesso",
        messageId: resendData.id 
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("[send-verification-code] Unexpected error");
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