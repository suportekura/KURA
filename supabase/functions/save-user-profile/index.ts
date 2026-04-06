import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Redis } from "https://esm.sh/@upstash/redis@1.28.0";
import { Ratelimit } from "https://esm.sh/@upstash/ratelimit@1.0.1";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";

// Rate limiting configuration - 20 requests per hour per user
function createRateLimiter() {
  const redisUrl = Deno.env.get("UPSTASH_REDIS_URL");
  const redisToken = Deno.env.get("UPSTASH_REDIS_TOKEN");
  
  if (!redisUrl || !redisToken) {
    console.warn("[save-user-profile] Rate limiting not configured - UPSTASH credentials missing");
    return null;
  }
  
  const redis = new Redis({
    url: redisUrl,
    token: redisToken,
  });
  
  return new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(20, "1 h"),
    prefix: "ratelimit:save-user-profile",
  });
}

interface AddressData {
  street: string;
  number: string;
  complement?: string;
  neighborhood: string;
  city: string;
  state: string;
  zip_code: string;
}

interface PFProfileData {
  user_type: 'PF';
  full_name: string;
  display_name: string;
  cpf: string;
  age: number;
  email?: string;
  address?: AddressData;
  pix_key?: string;
  pix_key_type?: 'cpf' | 'cnpj' | 'email' | 'phone' | 'random';
  terms_accepted: boolean;
  verification_code?: string;
}

interface PJProfileData {
  user_type: 'PJ';
  company_name: string;
  display_name: string;
  cnpj: string;
  email?: string;
  address?: AddressData;
  pix_key?: string;
  pix_key_type?: 'cpf' | 'cnpj' | 'email' | 'phone' | 'random';
  terms_accepted: boolean;
  verification_code?: string;
}

type ProfileData = PFProfileData | PJProfileData;

// AES-256-GCM encryption using Web Crypto API
async function encrypt(text: string, key: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(key);
  const hashBuffer = await crypto.subtle.digest('SHA-256', keyData);
  const keyBytes = new Uint8Array(hashBuffer);
  
  const cryptoKey = await crypto.subtle.importKey(
    'raw', keyBytes, { name: 'AES-GCM' }, false, ['encrypt']
  );
  
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv }, cryptoKey, encoder.encode(text)
  );
  
  const combined = new Uint8Array(iv.length + encrypted.byteLength);
  combined.set(iv);
  combined.set(new Uint8Array(encrypted), iv.length);
  
  return btoa(String.fromCharCode(...combined));
}

// CPF validation
function validateCPF(cpf: string): boolean {
  const cleaned = cpf.replace(/\D/g, '');
  if (cleaned.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(cleaned)) return false;
  
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += parseInt(cleaned.charAt(i)) * (10 - i);
  let remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) remainder = 0;
  if (remainder !== parseInt(cleaned.charAt(9))) return false;
  
  sum = 0;
  for (let i = 0; i < 10; i++) sum += parseInt(cleaned.charAt(i)) * (11 - i);
  remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) remainder = 0;
  if (remainder !== parseInt(cleaned.charAt(10))) return false;
  
  return true;
}

// CNPJ validation
function validateCNPJ(cnpj: string): boolean {
  const cleaned = cnpj.replace(/\D/g, '');
  if (cleaned.length !== 14) return false;
  if (/^(\d)\1{13}$/.test(cleaned)) return false;
  
  const firstWeights = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += parseInt(cleaned.charAt(i)) * firstWeights[i];
  let remainder = sum % 11;
  const firstDigit = remainder < 2 ? 0 : 11 - remainder;
  if (firstDigit !== parseInt(cleaned.charAt(12))) return false;
  
  const secondWeights = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  sum = 0;
  for (let i = 0; i < 13; i++) sum += parseInt(cleaned.charAt(i)) * secondWeights[i];
  remainder = sum % 11;
  const secondDigit = remainder < 2 ? 0 : 11 - remainder;
  if (secondDigit !== parseInt(cleaned.charAt(13))) return false;
  
  return true;
}

async function consumeVerificationCode(
  supabase: ReturnType<typeof createClient>,
  email: string,
  code: string,
  type: 'email_verification' | 'password_reset'
) {
  const { data, error } = await supabase
    .from("verification_codes")
    .update({ used: true })
    .eq("email", email)
    .eq("code", code)
    .eq("type", type)
    .eq("used", false)
    .gte("expires_at", new Date().toISOString())
    .select("id");

  if (error) {
    throw error;
  }

  return data ?? [];
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
      const identifier = body?.email || body?.userId || req.headers.get("x-forwarded-for") || "anonymous";
      const { success, remaining } = await ratelimit.limit(identifier);
      
      if (!success) {
        return new Response(
          JSON.stringify({ success: false, error: "Muitas tentativas. Aguarde 1 hora antes de tentar novamente." }),
          { status: 429, headers: { "Content-Type": "application/json", "X-RateLimit-Remaining": remaining.toString(), ...corsHeaders } }
        );
      }
    } catch (rateLimitError) {
      console.error("[save-user-profile] Rate limit check failed:", rateLimitError);
    }
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const encryptionKey = Deno.env.get("DATA_ENCRYPTION_KEY");
    
    if (!encryptionKey) {
      return new Response(
        JSON.stringify({ success: false, error: "Encryption not configured" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const body = await req.json();

    // ===== CHECK EMAIL AVAILABILITY =====
    if (body.check_email_available && body.email) {
      console.log("[save-user-profile] Checking email availability:", body.email);
      
      const { data: { users: allUsersEmail = [] } } = await supabase.auth.admin.listUsers({ filter: body.email, perPage: 50 });
      const existingUser = allUsersEmail.find(u => u.email === body.email);

      if (!existingUser) {
        return new Response(
          JSON.stringify({ available: true }),
          { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      return new Response(
        JSON.stringify({ available: false }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // ===== AUTHENTICATE USER — Required for all write operations =====
    let userId: string;
    let authenticatedEmail: string | undefined;
    let verifiedSignupProof = false;

    // Try JWT auth first (works when user has an active session)
    // Note: supabase.functions.invoke() always sends Authorization header (anon key or user JWT)
    // getUser() returns null for anon key, only returns user for valid user JWTs
    const authHeader = req.headers.get("Authorization");
    const token = authHeader?.replace("Bearer ", "") ?? "";
    const { data: { user: authUser } } = await supabase.auth.getUser(token);

    if (authUser) {
      userId = authUser.id;
      authenticatedEmail = authUser.email;
    } else if (body.userId && body.email && body.verification_code && !body.update_pix_only) {
      // Signup flow: require a valid OTP proof for the email that owns the new auth user.
      const { data: { user: adminUser }, error: adminError } = await supabase.auth.admin.getUserById(body.userId);
      if (adminError || !adminUser) {
        return new Response(
          JSON.stringify({ success: false, error: "User not found or invalid" }),
          { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      if (adminUser.email !== body.email) {
        return new Response(
          JSON.stringify({ success: false, error: "User/email mismatch" }),
          { status: 403, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      const consumedCodes = await consumeVerificationCode(
        supabase,
        body.email,
        body.verification_code,
        "email_verification"
      );

      if (consumedCodes.length === 0) {
        return new Response(
          JSON.stringify({ success: false, error: "Código de verificação inválido ou expirado" }),
          { status: 403, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      userId = adminUser.id;
      authenticatedEmail = adminUser.email;
      verifiedSignupProof = true;
    } else {
      return new Response(
        JSON.stringify({ success: false, error: "Authorization required" }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // ===== CHECK AND CLEANUP INCOMPLETE SIGNUPS =====
    // Requires authentication — user can only clean up their own incomplete account
    if (body.check_and_cleanup_incomplete && body.email) {
      if (!authenticatedEmail || authenticatedEmail !== body.email) {
        return new Response(
          JSON.stringify({ success: false, cleaned: false, error: "Unauthorized" }),
          { status: 403, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      console.log("[save-user-profile] Checking for incomplete signup for authenticated user");

      const { data: profile } = await supabase
        .from('profiles')
        .select('profile_completed')
        .eq('user_id', userId)
        .maybeSingle();

      if (profile?.profile_completed) {
        return new Response(
          JSON.stringify({ success: false, cleaned: false, error: "Profile is complete" }),
          { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      console.log("[save-user-profile] Deleting incomplete user:", userId);

      await supabase.from('pf_profiles').delete().eq('user_id', userId);
      await supabase.from('pj_profiles').delete().eq('user_id', userId);
      await supabase.from('payment_profiles').delete().eq('user_id', userId);
      await supabase.from('profiles').delete().eq('user_id', userId);

      const { error: deleteError } = await supabase.auth.admin.deleteUser(userId);

      if (deleteError) {
        console.error("[save-user-profile] Error deleting user:", deleteError);
        return new Response(
          JSON.stringify({ success: false, cleaned: false, error: "Failed to cleanup" }),
          { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      return new Response(
        JSON.stringify({ success: true, cleaned: true }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Handle PIX-only update
    if (body.update_pix_only) {
      if (!body.pix_key || !body.pix_key_type) {
        return new Response(
          JSON.stringify({ success: false, error: "Chave PIX e tipo são obrigatórios." }),
          { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      const pixKeyEncrypted = await encrypt(body.pix_key, encryptionKey);

      const { error: paymentError } = await supabase
        .from('payment_profiles')
        .update({ pix_key_encrypted: pixKeyEncrypted, pix_key_type: body.pix_key_type })
        .eq('user_id', userId);

      if (paymentError) {
        return new Response(
          JSON.stringify({ success: false, error: "Erro ao atualizar chave PIX" }),
          { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      return new Response(
        JSON.stringify({ success: true, message: "Chave PIX atualizada com sucesso" }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Full profile save flow
    const profileData: ProfileData & { userId?: string; email?: string; verification_code?: string } = body;

    console.log("[save-user-profile] Saving profile, type:", profileData.user_type, "terms_accepted:", profileData.terms_accepted);

    if (!profileData.terms_accepted) {
      return new Response(
        JSON.stringify({ success: false, error: "Você precisa aceitar os Termos de Uso para continuar." }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Validate and save based on type
    if (profileData.user_type === 'PF') {
      const pfData = profileData as PFProfileData;
      
      if (!validateCPF(pfData.cpf)) {
        return new Response(
          JSON.stringify({ success: false, error: "CPF inválido. Verifique os números digitados." }),
          { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }
      
      if (!Number.isInteger(pfData.age) || pfData.age < 18) {
        return new Response(
          JSON.stringify({ success: false, error: "Idade inválida. Você deve ter pelo menos 18 anos." }),
          { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      const cpfEncrypted = await encrypt(pfData.cpf.replace(/\D/g, ''), encryptionKey);

      const { error: pfError } = await supabase
        .from('pf_profiles')
        .upsert({
          user_id: userId,
          full_name: pfData.full_name,
          display_name: pfData.display_name,
          cpf_encrypted: cpfEncrypted,
          age: pfData.age,
        }, { onConflict: 'user_id' });

      if (pfError) {
        console.error("[save-user-profile] pf_profiles upsert error:", pfError);
        return new Response(
          JSON.stringify({ success: false, error: "Erro ao salvar perfil" }),
          { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      // Save PIX if provided
      if (pfData.pix_key && pfData.pix_key_type) {
        const pixKeyEncrypted = await encrypt(pfData.pix_key, encryptionKey);
        await supabase.from('payment_profiles').upsert({
          user_id: userId,
          pix_key_encrypted: pixKeyEncrypted,
          pix_key_type: pfData.pix_key_type,
        });
      }

    } else if (profileData.user_type === 'PJ') {
      const pjData = profileData as PJProfileData;
      
      if (!validateCNPJ(pjData.cnpj)) {
        return new Response(
          JSON.stringify({ success: false, error: "CNPJ inválido. Verifique os números digitados." }),
          { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      const cnpjEncrypted = await encrypt(pjData.cnpj.replace(/\D/g, ''), encryptionKey);

      const { error: pjError } = await supabase
        .from('pj_profiles')
        .upsert({
          user_id: userId,
          company_name: pjData.company_name,
          display_name: pjData.display_name,
          cnpj_encrypted: cnpjEncrypted,
        }, { onConflict: 'user_id' });

      if (pjError) {
        console.error("[save-user-profile] pj_profiles upsert error:", pjError);
        return new Response(
          JSON.stringify({ success: false, error: "Erro ao salvar perfil" }),
          { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      // Save PIX if provided
      if (pjData.pix_key && pjData.pix_key_type) {
        const pixKeyEncrypted = await encrypt(pjData.pix_key, encryptionKey);
        await supabase.from('payment_profiles').upsert({
          user_id: userId,
          pix_key_encrypted: pixKeyEncrypted,
          pix_key_type: pjData.pix_key_type,
        });
      }
    }

    // Insert address if provided
    if (profileData.address) {
      await supabase.from('addresses').upsert({
        user_id: userId,
        street: profileData.address.street,
        number: profileData.address.number,
        complement: profileData.address.complement || null,
        neighborhood: profileData.address.neighborhood,
        city: profileData.address.city,
        state: profileData.address.state,
        zip_code: profileData.address.zip_code.replace(/\D/g, ''),
        is_primary: true,
      });
    }

    // Update main profile
    const { error: profileUpdateError } = await supabase
      .from('profiles')
      .update({ 
        user_type: profileData.user_type,
        display_name: profileData.display_name,
        profile_completed: true,
        terms_accepted: true,
        terms_accepted_at: new Date().toISOString(),
        ...(verifiedSignupProof ? { email_verified: true } : {}),
      })
      .eq('user_id', userId);

    if (profileUpdateError) {
      console.error("[save-user-profile] Profile update error:", profileUpdateError);
    }

    // Only confirm auth email when the server itself validated the OTP proof.
    if (verifiedSignupProof) {
      console.log("[save-user-profile] Confirming email in auth system");
      const { error: confirmError } = await supabase.auth.admin.updateUserById(
        userId,
        { email_confirm: true }
      );
      if (confirmError) {
        console.error("[save-user-profile] Error confirming email:", confirmError);
      }
    }

    console.log("[save-user-profile] Profile saved successfully");

    return new Response(
      JSON.stringify({ success: true, message: "Perfil salvo com sucesso" }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );

  } catch (error: unknown) {
    console.error("[save-user-profile] Error:", error);
    return new Response(
      JSON.stringify({ success: false, error: "Erro interno do servidor" }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
