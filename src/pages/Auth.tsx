import { useState, useEffect, useLayoutEffect, useCallback, useRef } from 'react';
import { cn } from '@/lib/utils';
import { isValidUsernameFormat, generateUsernameSuggestions } from '@/lib/usernameValidation';
import kuraLogoAuth from '@/assets/kura-logo-auth.png';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { ProfileSetupForm } from '@/components/auth/ProfileSetupForm';
import { AppleSignInButton } from '@/components/auth/AppleSignInButton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';

import { useToast } from '@/hooks/use-toast';
import { Progress } from '@/components/ui/progress';
import { Loader2, Mail, Lock, User, ArrowLeft, ArrowRight, Building2, AlertTriangle, Lock as LockIcon, Eye, EyeOff, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { signInSchema, resetPasswordSchema, emailSchema, fullNameSchema, passwordSchema } from '@/lib/validations';
import { 
  validateCPF, 
  validateCNPJ, 
  formatCPF, 
  formatCNPJ, 
  cleanDocument,
  formatDateBR,
  validateBirthDate,
} from '@/lib/documentValidation';

type AuthView = 'auth' | 'verify-email' | 'forgot-password' | 'reset-password' | 'profile-setup';
type UserType = 'PF' | 'PJ';
type SignupStep = 'type' | 'name_email' | 'verify_email' | 'password' | 'profile';

// Translate common Supabase/Auth error messages to PT-BR
function translateAuthError(msg: string): string {
  const map: Record<string, string> = {
    'Invalid login credentials': 'E-mail ou senha incorretos',
    'Email not confirmed': 'E-mail não confirmado',
    'User already registered': 'Usuário já cadastrado',
    'Signup requires a valid password': 'A senha informada é inválida',
    'Password should be at least 6 characters': 'A senha deve ter pelo menos 6 caracteres',
    'Email rate limit exceeded': 'Limite de envio de e-mails excedido. Tente novamente mais tarde.',
    'For security purposes, you can only request this after': 'Por segurança, aguarde antes de tentar novamente.',
    'Unable to validate email address: invalid format': 'Formato de e-mail inválido.',
    'A user with this email address has already been registered': 'Este e-mail já está cadastrado.',
    'User not found': 'Usuário não encontrado',
    'New password should be different from the old password': 'A nova senha deve ser diferente da anterior.',
    'Auth session missing': 'Sessão expirada. Faça login novamente.',
    'Request timeout': 'Tempo de requisição esgotado. Tente novamente.',
  };
  for (const [en, pt] of Object.entries(map)) {
    if (msg.includes(en)) return pt;
  }
  return msg;
}

// Password strength calculator
function getPasswordStrength(pw: string): { level: 'weak' | 'medium' | 'strong'; percent: number; label: string } {
  if (!pw || pw.length < 8) return { level: 'weak', percent: 20, label: 'Fraca' };
  const hasLetters = /[a-zA-Z]/.test(pw);
  const hasNumbers = /\d/.test(pw);
  const hasSpecial = /[^a-zA-Z0-9]/.test(pw);
  if (hasLetters && hasNumbers && hasSpecial && pw.length >= 10) return { level: 'strong', percent: 100, label: 'Forte' };
  if (hasLetters && hasNumbers) return { level: 'medium', percent: 60, label: 'Média' };
  return { level: 'weak', percent: 30, label: 'Fraca' };
}

const SIGNUP_STEPS: SignupStep[] = ['type', 'name_email', 'verify_email', 'password', 'profile'];
const STEP_LABELS: Record<SignupStep, string> = {
  type: 'Tipo de Conta',
  name_email: 'Nome e Email',
  verify_email: 'Verificação',
  password: 'Senha',
  profile: 'Dados Complementares',
};

export default function Auth() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, loading: authLoading, signIn, signUp, refreshProfileStatus, markUsernameSet } = useAuth();
  const { toast } = useToast();

  // Force dark theme on /auth page
  useLayoutEffect(() => {
    const root = document.documentElement;
    const previousTheme = root.classList.contains('dark') ? 'dark' : 'light';
    root.classList.remove('light');
    root.classList.add('dark');
    return () => {
      root.classList.remove('dark');
      root.classList.add(previousTheme);
    };
  }, []);
  
  const initialView = (location.state?.view as AuthView) || 'auth';
  
  const [view, setView] = useState<AuthView>(initialView);
  const [loading, setLoading] = useState(false);
  const [profileCheckDone, setProfileCheckDone] = useState(false);
  const prevUserIdRef = useRef<string | null>(null);
  
  // Login fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  
  // Verification fields (login flow)
  const [verificationCode, setVerificationCode] = useState('');
  const [pendingEmail, setPendingEmail] = useState('');
  
  // Reset password fields
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  
  // ===== SIGNUP FLOW STATE =====
  const [signupStep, setSignupStep] = useState<SignupStep>('type');
  const [userType, setUserType] = useState<UserType | null>(null);
  const [isGoogleSignup, setIsGoogleSignup] = useState(false);
  
  // Step 2: Name + Email
  const [signupFullName, setSignupFullName] = useState('');
  const [signupEmail, setSignupEmail] = useState('');
  
  // Step 3: Verify email
  const [signupVerificationCode, setSignupVerificationCode] = useState('');
  const [emailVerified, setEmailVerified] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  
  // Step 4: Password
  const [signupPassword, setSignupPassword] = useState('');
  const [signupConfirmPassword, setSignupConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
  // Step 5: Profile data - PF
  const [displayName, setDisplayName] = useState('');
  const [cpf, setCpf] = useState('');
  const [birthDate, setBirthDate] = useState('');
  
  // Step 5: Profile data - PJ
  const [companyName, setCompanyName] = useState('');
  const [cnpj, setCnpj] = useState('');
  
  // Terms acceptance
  const [termsAccepted, setTermsAccepted] = useState(false);

  // Step 5: @username
  const [signupUsername, setSignupUsername] = useState('');
  const [usernameCheckState, setUsernameCheckState] = useState<'idle' | 'checking' | 'available' | 'taken' | 'invalid'>('idle');
  const [usernameFormatError, setUsernameFormatError] = useState<string | null>(null);
  const [usernameSuggestions, setUsernameSuggestions] = useState<string[]>([]);
  const usernameDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Resend cooldown timer
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  // Generate username suggestions when entering the profile step
  useEffect(() => {
    if (signupStep === 'profile' && signupFullName) {
      setUsernameSuggestions(generateUsernameSuggestions(signupFullName));
    }
  }, [signupStep, signupFullName]);

  // Reset profileCheckDone when a new user logs in (e.g. returning from Google OAuth)
  // Without this, if Auth.tsx was already mounted with profileCheckDone=true and no user,
  // the check would never run when the Google user arrives after the callback.
  useEffect(() => {
    const currentId = user?.id ?? null;
    if (prevUserIdRef.current === null && currentId !== null) {
      setProfileCheckDone(false);
    }
    prevUserIdRef.current = currentId;
  }, [user?.id]);

  // Check profile status for logged-in users (only once)
  useEffect(() => {
    const checkProfileStatus = async () => {
      if (authLoading || profileCheckDone) return;
      
      if (!user) {
        setProfileCheckDone(true);
        return;
      }

      try {
        const { data: profile } = await supabase
          .from('profiles')
          .select('email_verified, profile_completed, user_type')
          .eq('user_id', user.id)
          .maybeSingle();
        
        if (profile) {
          if (!profile.email_verified) {
            setPendingEmail(user.email || '');
            setView('verify-email');
          } else if (!profile.profile_completed) {
            // Check if this is a Google OAuth user needing to complete profile
            const isOAuthUser = user.app_metadata?.provider === 'google' || 
                                user.app_metadata?.providers?.includes('google');
            if (isOAuthUser && !profile.user_type) {
              // Google user with no type yet → enter Google signup flow
              setIsGoogleSignup(true);
              setSignupFullName(user.user_metadata?.full_name || user.user_metadata?.name || '');
              setSignupEmail(user.email || '');
              setView('auth');

              // Restore account type if user had selected it before the Google redirect
              const savedType = sessionStorage.getItem('oauth_pending_user_type') as 'PF' | 'PJ' | null;
              if (savedType) {
                setUserType(savedType);
                setSignupStep('profile'); // skip type step — already chosen
                sessionStorage.removeItem('oauth_pending_user_type');
              } else {
                setSignupStep('type');
              }
            } else if (profile.user_type) {
              setUserType(profile.user_type as UserType);
              setView('profile-setup');
            }
          }
        } else {
          // No profile at all - check if Google OAuth user
          const isOAuthUser = user.app_metadata?.provider === 'google' ||
                              user.app_metadata?.providers?.includes('google');
          if (isOAuthUser) {
            setIsGoogleSignup(true);
            setSignupFullName(user.user_metadata?.full_name || user.user_metadata?.name || '');
            setSignupEmail(user.email || '');
            setView('auth');

            const savedType = sessionStorage.getItem('oauth_pending_user_type') as 'PF' | 'PJ' | null;
            if (savedType) {
              setUserType(savedType);
              setSignupStep('profile');
              sessionStorage.removeItem('oauth_pending_user_type');
            } else {
              setSignupStep('type');
            }
          }
        }
      } catch (error) {
        console.error('[Auth] Error checking profile:', error);
      }
      
      setProfileCheckDone(true);
    };

    checkProfileStatus();
  }, [user, authLoading, profileCheckDone]);

  // Helper functions for document formatting
  const handleCPFChange = (value: string) => {
    const formatted = formatCPF(value);
    if (cleanDocument(formatted).length <= 11) {
      setCpf(formatted);
    }
  };

  const handleCNPJChange = (value: string) => {
    const formatted = formatCNPJ(value);
    if (cleanDocument(formatted).length <= 14) {
      setCnpj(formatted);
    }
  };

  const handleUsernameChange = (raw: string) => {
    setSignupUsername(raw);
    if (usernameDebounceRef.current) clearTimeout(usernameDebounceRef.current);

    const { valid, error } = isValidUsernameFormat(raw);
    if (!valid) {
      setUsernameFormatError(error || null);
      setUsernameCheckState('invalid');
      return;
    }

    setUsernameFormatError(null);
    setUsernameCheckState('idle');
    usernameDebounceRef.current = setTimeout(async () => {
      setUsernameCheckState('checking');
      const { data } = await supabase
        .from('public_profiles')
        .select('user_id')
        .ilike('username', raw)
        .maybeSingle();
      setUsernameCheckState(data === null ? 'available' : 'taken');
    }, 500);
  };

  // Send verification code via Resend
  const sendVerificationCode = useCallback(async (targetEmail: string, type: 'email_verification' | 'password_reset' = 'email_verification'): Promise<boolean> => {
    try {
      console.log("[Auth] Sending verification code to:", targetEmail);
      
      const { data, error } = await supabase.functions.invoke('send-verification-code', {
        body: { email: targetEmail, type },
      });

      if (error) {
        console.error("[Auth] Error invoking send-verification-code:", error);
        toast({
          title: 'Erro ao enviar código',
          description: 'Não foi possível enviar o código. Tente novamente.',
          variant: 'destructive',
        });
        return false;
      }

      if (!data?.success) {
        console.error("[Auth] send-verification-code failed:", data);
        toast({
          title: 'Erro ao enviar código',
          description: data?.error || 'Falha no envio do email.',
          variant: 'destructive',
        });
        return false;
      }

      console.log("[Auth] Verification code sent successfully:", data.messageId);
      return true;
    } catch (err) {
      console.error("[Auth] Exception sending verification code:", err);
      toast({
        title: 'Erro',
        description: 'Falha ao enviar código de verificação.',
        variant: 'destructive',
      });
      return false;
    }
  }, [toast]);

  const handleGoogleSignIn = () => {
    setLoading(true);

    const redirectUri = import.meta.env.DEV
      ? 'http://localhost:8080/auth/callback'
      : 'https://kuralab.com.br/auth/callback';

    const state = crypto.randomUUID();
    sessionStorage.setItem('oauth_state', state);

    // Preserve account type selection across the OAuth redirect so the user
    // doesn't have to choose PF/PJ again after returning from Google
    if (userType) {
      sessionStorage.setItem('oauth_pending_user_type', userType);
    } else {
      sessionStorage.removeItem('oauth_pending_user_type');
    }

    const params = new URLSearchParams({
      client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'openid email profile',
      access_type: 'offline',
      state,
      prompt: 'select_account',
    });

    window.location.href = `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
  };

  const handleAppleSignIn = async () => {
    setLoading(true);
    try {
      // Preserve account type selection across the OAuth redirect
      if (userType) {
        sessionStorage.setItem('oauth_pending_user_type', userType);
      } else {
        sessionStorage.removeItem('oauth_pending_user_type');
      }

      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'apple',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (error) {
        toast({
          title: 'Erro ao entrar com Apple',
          description: translateAuthError(error.message),
          variant: 'destructive',
        });
        setLoading(false);
      }
    } catch (err) {
      toast({
        title: 'Erro ao entrar com Apple',
        description: 'Não foi possível conectar com a Apple. Tente novamente.',
        variant: 'destructive',
      });
      setLoading(false);
    }
  };

  // ===== LOGIN HANDLERS =====
  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const validation = signInSchema.safeParse({ email, password });
    if (!validation.success) {
      toast({
        title: 'Erro de validação',
        description: validation.error.errors[0].message,
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    
    const { error, needsVerification } = await signIn(email, password);
    
    if (needsVerification) {
      setPendingEmail(email);
      
      const sent = await sendVerificationCode(email, 'email_verification');
      if (!sent) {
        setLoading(false);
        return;
      }
      
      setView('verify-email');
      toast({
        title: 'Verificação necessária',
        description: 'Seu e-mail ainda não foi verificado. Enviamos um código de 6 dígitos.',
      });
      setLoading(false);
      return;
    }
    
    if (error) {
      toast({
        title: 'Erro ao entrar',
        description: translateAuthError(error.message),
        variant: 'destructive',
      });
      setLoading(false);
      return;
    }

    setProfileCheckDone(false);
    setLoading(false);
  };

  // ===== SIGNUP STEP NAVIGATION =====
  // For Google signup, only show steps: type → profile
  const GOOGLE_SIGNUP_STEPS: SignupStep[] = ['type', 'profile'];
  const activeSteps = isGoogleSignup ? GOOGLE_SIGNUP_STEPS : SIGNUP_STEPS;
  const currentStepIndex = activeSteps.indexOf(signupStep);
  const progressPercent = ((currentStepIndex + 1) / activeSteps.length) * 100;

  const goToPrevSignupStep = () => {
    const idx = activeSteps.indexOf(signupStep);
    if (idx > 0) {
      setSignupStep(activeSteps[idx - 1]);
    }
  };

  const resetSignupFlow = () => {
    setSignupStep('type');
    setUserType(null);
    setIsGoogleSignup(false);
    setSignupFullName('');
    setSignupEmail('');
    setSignupPassword('');
    setSignupConfirmPassword('');
    setSignupVerificationCode('');
    setEmailVerified(false);
    setDisplayName('');
    setCpf('');
    setBirthDate('');
    setCompanyName('');
    setCnpj('');
    setTermsAccepted(false);
    setResendCooldown(0);
    setSignupUsername('');
    setUsernameCheckState('idle');
    setUsernameFormatError(null);
    setUsernameSuggestions([]);
  };

  // ===== STEP 1: Handle type selection =====
  const handleTypeNext = () => {
    if (!userType) {
      toast({ title: 'Selecione o tipo de conta', variant: 'destructive' });
      return;
    }
    if (isGoogleSignup) {
      // Skip steps 2, 3, 4 — go directly to profile
      setSignupStep('profile');
    } else {
      setSignupStep('name_email');
    }
  };

  // ===== STEP 2: Handle name + email, check availability, send code =====
  const handleNameEmailNext = async () => {
    const nameValidation = fullNameSchema.safeParse(signupFullName);
    if (!nameValidation.success) {
      toast({ title: 'Erro de validação', description: nameValidation.error.errors[0].message, variant: 'destructive' });
      return;
    }
    const emailValidation = emailSchema.safeParse(signupEmail);
    if (!emailValidation.success) {
      toast({ title: 'Erro de validação', description: emailValidation.error.errors[0].message, variant: 'destructive' });
      return;
    }

    setLoading(true);

    try {
      // Check if email is already registered with complete profile
      const { data: checkResult } = await supabase.functions.invoke('save-user-profile', {
        body: { check_email_available: true, email: signupEmail },
      });

      if (checkResult?.exists && checkResult?.profile_completed) {
        toast({
          title: 'E-mail já cadastrado',
          description: 'Este e-mail já está cadastrado. Faça login.',
          variant: 'destructive',
        });
        setLoading(false);
        return;
      }

      // If email exists but profile incomplete, cleanup
      if (checkResult?.exists && !checkResult?.profile_completed) {
        const { data: cleanupResult } = await supabase.functions.invoke('save-user-profile', {
          body: { check_and_cleanup_incomplete: true, email: signupEmail },
        });
        if (!cleanupResult?.cleaned) {
          toast({
            title: 'E-mail já cadastrado',
            description: 'Este e-mail já está em uso. Tente fazer login.',
            variant: 'destructive',
          });
          setLoading(false);
          return;
        }
      }

      // Send verification code
      const sent = await sendVerificationCode(signupEmail, 'email_verification');
      if (!sent) {
        setLoading(false);
        return;
      }

      setResendCooldown(60);
      setSignupStep('verify_email');
      toast({
        title: 'Código enviado!',
        description: `Enviamos um código de verificação para ${signupEmail}.`,
      });
    } catch (err) {
      console.error('[Auth] Error in name/email step:', err);
      toast({ title: 'Erro', description: 'Erro ao verificar e-mail.', variant: 'destructive' });
    }

    setLoading(false);
  };

  // ===== STEP 3: Verify email code =====
  const handleVerifySignupCode = async () => {
    if (signupVerificationCode.length !== 6) {
      toast({ title: 'Código inválido', description: 'O código deve ter 6 dígitos.', variant: 'destructive' });
      return;
    }

    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('verify-code', {
        body: { email: signupEmail, code: signupVerificationCode, type: 'email_verification', consume: false },
      });

      if (error || !data?.valid) {
        toast({
          title: 'Código inválido',
          description: data?.error || 'O código está incorreto ou expirou.',
          variant: 'destructive',
        });
        setLoading(false);
        return;
      }

      setEmailVerified(true);
      setSignupStep('password');
      toast({ title: 'E-mail verificado!', description: 'Agora crie sua senha.' });
    } catch (err) {
      console.error('[Auth] Error verifying code:', err);
      toast({ title: 'Erro', description: 'Erro ao verificar código.', variant: 'destructive' });
    }

    setLoading(false);
  };

  const handleResendSignupCode = async () => {
    if (resendCooldown > 0) return;
    setLoading(true);
    const sent = await sendVerificationCode(signupEmail, 'email_verification');
    if (sent) {
      setResendCooldown(60);
      toast({ title: 'Código reenviado!', description: 'Verifique seu e-mail.' });
    }
    setLoading(false);
  };

  // ===== STEP 4: Password validation =====
  const handlePasswordNext = () => {
    const pwValidation = passwordSchema.safeParse(signupPassword);
    if (!pwValidation.success) {
      toast({ title: 'Erro de validação', description: pwValidation.error.errors[0].message, variant: 'destructive' });
      return;
    }
    if (signupPassword !== signupConfirmPassword) {
      toast({ title: 'As senhas não coincidem', variant: 'destructive' });
      return;
    }
    setSignupStep('profile');
  };

  // ===== STEP 5: Complete signup =====
  const handleCompleteSignup = async () => {
    // Validate profile data
    if (userType === 'PF') {
      if (!displayName.trim()) { toast({ title: 'Nome de exibição é obrigatório', variant: 'destructive' }); return; }
      if (!validateCPF(cpf)) { toast({ title: 'CPF inválido', variant: 'destructive' }); return; }
      const bdResult = validateBirthDate(birthDate);
      if (!bdResult.valid) { toast({ title: 'Data de nascimento inválida', description: bdResult.error, variant: 'destructive' }); return; }
    } else {
      if (!companyName.trim()) { toast({ title: 'Razão social é obrigatória', variant: 'destructive' }); return; }
      if (!displayName.trim()) { toast({ title: 'Nome fantasia é obrigatório', variant: 'destructive' }); return; }
      if (!validateCNPJ(cnpj)) { toast({ title: 'CNPJ inválido', variant: 'destructive' }); return; }
    }
    if (!termsAccepted) {
      toast({ title: 'Termos de Uso não aceitos', description: 'Você precisa aceitar os Termos de Uso para continuar.', variant: 'destructive' });
      return;
    }

    setLoading(true);

    try {
      // Google signup: user already exists via OAuth, just save profile
      if (isGoogleSignup && user) {
        await saveProfileData(user.id);
        return;
      }

      // Regular signup: create user in Supabase Auth
      const result = await signUp(signupEmail, signupPassword, signupFullName, userType!);

      if (result.error) {
        if (result.error.message.includes('already registered')) {
          // Try cleanup of incomplete profile
          try {
            const { data: cleanupResult } = await supabase.functions.invoke('save-user-profile', {
              body: { check_and_cleanup_incomplete: true, email: signupEmail },
            });
            if (cleanupResult?.cleaned) {
              const retryResult = await signUp(signupEmail, signupPassword, signupFullName, userType!);
              if (retryResult.error || !retryResult.userId) {
                toast({ title: 'E-mail já cadastrado', description: 'Tente fazer login.', variant: 'destructive' });
                setLoading(false);
                return;
              }
              await saveProfileData(retryResult.userId);
              return;
            }
          } catch { /* ignore */ }
          toast({ title: 'E-mail já cadastrado', description: 'Este e-mail já está em uso. Tente fazer login.', variant: 'destructive' });
          setLoading(false);
          return;
        }
        toast({ title: 'Erro ao cadastrar', description: translateAuthError(result.error.message), variant: 'destructive' });
        setLoading(false);
        return;
      }

      if (!result.userId) {
        toast({ title: 'Erro ao criar conta', variant: 'destructive' });
        setLoading(false);
        return;
      }

      await saveProfileData(result.userId);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erro ao finalizar cadastro.';
      toast({ title: 'Erro', description: translateAuthError(message) || 'Erro ao finalizar cadastro.', variant: 'destructive' });
      setLoading(false);
    }
  };

  const saveProfileData = async (userId?: string) => {
    try {
      const fullName = isGoogleSignup 
        ? (user?.user_metadata?.full_name || user?.user_metadata?.name || signupFullName)
        : signupFullName;
      const emailToUse = isGoogleSignup ? (user?.email || signupEmail) : signupEmail;

      const profileData = userType === 'PF'
        ? {
            user_type: 'PF' as const,
            full_name: fullName,
            display_name: displayName,
            cpf: cleanDocument(cpf),
            age: validateBirthDate(birthDate).age,
            email: emailToUse,
            terms_accepted: termsAccepted,
          }
        : {
            user_type: 'PJ' as const,
            company_name: companyName,
            display_name: displayName,
            cnpj: cleanDocument(cnpj),
            email: emailToUse,
            terms_accepted: termsAccepted,
          };

      const { data, error } = await supabase.functions.invoke('save-user-profile', {
        body: {
          ...profileData,
          ...(isGoogleSignup ? {} : {
            userId,
            verification_code: signupVerificationCode,
          }),
        },
      });

      if (error || !data?.success) {
        toast({ title: 'Erro ao salvar perfil', description: data?.error || error?.message || 'Tente novamente.', variant: 'destructive' });
        setLoading(false);
        return;
      }

      if (isGoogleSignup) {
        // Google user is already logged in — save username directly (has valid session)
        const { error: usernameError } = await supabase
          .from('profiles')
          .update({ username: signupUsername })
          .eq('user_id', userId);

        if (usernameError?.code === '23505') {
          setUsernameCheckState('taken');
          toast({ title: '@username já está em uso', description: 'Escolha outro username para continuar.', variant: 'destructive' });
          setLoading(false);
          return;
        }

        // Refresh profile cache BEFORE navigating so ProtectedRoute sees
        // profileCompleted=true and doesn't redirect back to /auth.
        await refreshProfileStatus();
        toast({
          title: 'Cadastro concluído! 🎉',
          description: 'Bem-vinda à Kura!',
        });
        resetSignupFlow();
        navigate('/');
      } else {
        // Email signup: sign in first so the username update has a valid JWT (RLS requires auth)
        const savedUsername = signupUsername;
        const emailForLogin = signupEmail;
        const passwordForLogin = signupPassword;
        resetSignupFlow();
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: emailForLogin,
          password: passwordForLogin,
        });
        if (signInError) {
          toast({
            title: 'Cadastro concluído! 🎉',
            description: 'Sua conta foi criada. Faça login para continuar.',
          });
          setEmail(emailForLogin);
        } else {
          // User is now authenticated — save username with valid session
          await supabase
            .from('profiles')
            .update({ username: savedUsername })
            .eq('user_id', userId);
          // Mark username as set in context BEFORE navigating so AppLayout
          // never shows UsernameSetupSheet on first render after signup
          markUsernameSet();
          toast({ title: 'Cadastro concluído! 🎉', description: 'Bem-vindo à Kura!' });
          navigate('/');
        }
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erro ao salvar perfil.';
      toast({ title: 'Erro', description: translateAuthError(message) || 'Erro ao salvar perfil.', variant: 'destructive' });
    }

    setLoading(false);
  };

  // ===== EMAIL VERIFICATION (LOGIN FLOW) =====
  const handleVerifyEmail = async () => {
    if (verificationCode.length !== 6) {
      toast({ title: 'Código inválido', description: 'O código deve ter 6 dígitos.', variant: 'destructive' });
      return;
    }

    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('complete-signup', {
        body: { email: pendingEmail, code: verificationCode },
      });

      if (error || (!data?.valid && !data?.success)) {
        toast({ title: 'Código inválido', description: data?.error || 'O código está incorreto ou expirou.', variant: 'destructive' });
        setLoading(false);
        return;
      }

      toast({ title: 'E-mail verificado!', description: 'Sua conta foi verificada. Faça login para continuar.' });
      setVerificationCode('');
      setView('auth');
      setEmail(pendingEmail);
      setPassword('');
    } catch (err) {
      toast({ title: 'Erro', description: 'Erro ao verificar código.', variant: 'destructive' });
    }

    setLoading(false);
  };

  // ===== PASSWORD RESET =====
  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      toast({ title: 'E-mail obrigatório', description: 'Digite seu e-mail para redefinir a senha.', variant: 'destructive' });
      return;
    }

    setLoading(true);
    const sent = await sendVerificationCode(email, 'password_reset');
    if (!sent) { setLoading(false); return; }

    setPendingEmail(email);
    setView('reset-password');
    toast({ title: 'Código enviado!', description: 'Verifique seu e-mail para redefinir a senha.' });
    setLoading(false);
  };

  const handleResetPassword = async () => {
    if (verificationCode.length !== 6) {
      toast({ title: 'Código inválido', description: 'O código deve ter 6 dígitos.', variant: 'destructive' });
      return;
    }

    const validation = resetPasswordSchema.safeParse({ password: newPassword, confirmPassword: confirmNewPassword });
    if (!validation.success) {
      toast({ title: 'Erro de validação', description: validation.error.errors[0].message, variant: 'destructive' });
      return;
    }

    setLoading(true);

    try {
      const { data, error: resetError } = await supabase.functions.invoke('reset-password', {
        body: { email: pendingEmail, code: verificationCode, newPassword },
      });

      if (resetError || !data?.success) {
        toast({ title: 'Erro', description: data?.error || 'Código inválido ou expirado.', variant: 'destructive' });
        setLoading(false);
        return;
      }

      toast({ title: 'Senha redefinida!', description: 'Sua senha foi atualizada. Faça login.' });
      setView('auth');
      setVerificationCode('');
      setNewPassword('');
      setConfirmNewPassword('');
      setEmail(pendingEmail);
    } catch (err) {
      toast({ title: 'Erro', description: 'Erro ao redefinir senha.', variant: 'destructive' });
    }

    setLoading(false);
  };

  const resendCode = async (type: 'email_verification' | 'password_reset') => {
    setLoading(true);
    const sent = await sendVerificationCode(pendingEmail, type);
    if (sent) {
      toast({ title: 'Código reenviado!', description: 'Verifique seu e-mail.' });
    }
    setLoading(false);
  };

  const handleExistingProfileComplete = async () => {
    toast({ title: 'Perfil completo!', description: 'Bem-vinda à Kura.' });
    navigate('/');
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // ===== EMAIL VERIFICATION SCREEN (LOGIN FLOW) =====
  if (view === 'verify-email') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4 relative">
        <Button variant="ghost" size="icon" className="absolute top-4 right-4 z-50 text-muted-foreground hover:text-foreground" asChild>
          <Link to="/" replace><X className="h-5 w-5" /></Link>
        </Button>
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <Button variant="ghost" size="sm" className="absolute left-4 top-4" onClick={() => setView('auth')}>
              <ArrowLeft className="h-4 w-4 mr-2" /> Voltar
            </Button>
            <CardTitle className="text-2xl font-display text-primary">Confirmar E-mail</CardTitle>
            <CardDescription>Digite o código de 6 dígitos enviado para {pendingEmail}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex justify-center">
              <InputOTP maxLength={6} value={verificationCode} onChange={setVerificationCode}>
                <InputOTPGroup>
                  <InputOTPSlot index={0} /><InputOTPSlot index={1} /><InputOTPSlot index={2} />
                  <InputOTPSlot index={3} /><InputOTPSlot index={4} /><InputOTPSlot index={5} />
                </InputOTPGroup>
              </InputOTP>
            </div>
            <div className="text-center text-sm text-muted-foreground">
              <p>Você precisa verificar seu e-mail para acessar o app.</p>
              <p className="mt-1">O código expira em 10 minutos.</p>
            </div>
            <Button className="w-full" onClick={handleVerifyEmail} disabled={loading || verificationCode.length !== 6}>
              {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />} Verificar e-mail
            </Button>
            <Button variant="link" className="w-full" onClick={() => resendCode('email_verification')} disabled={loading}>
              Reenviar código
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (view === 'profile-setup') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4 relative">
        <Button variant="ghost" size="icon" className="absolute top-4 right-4 z-50 text-muted-foreground hover:text-foreground" asChild>
          <Link to="/" replace><X className="h-5 w-5" /></Link>
        </Button>
        <ProfileSetupForm 
          onComplete={handleExistingProfileComplete}
          onBack={() => { supabase.auth.signOut(); setView('auth'); }}
        />
      </div>
    );
  }

  if (view === 'forgot-password') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4 relative">
        <Button variant="ghost" size="icon" className="absolute top-4 right-4 z-50 text-muted-foreground hover:text-foreground" asChild>
          <Link to="/" replace><X className="h-5 w-5" /></Link>
        </Button>
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <Button variant="ghost" size="sm" className="absolute left-4 top-4" onClick={() => setView('auth')}>
              <ArrowLeft className="h-4 w-4 mr-2" /> Voltar
            </Button>
            <CardTitle className="text-2xl font-display text-primary">Esqueci minha senha</CardTitle>
            <CardDescription>Digite seu e-mail para receber o código de redefinição</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleForgotPassword} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="forgot-email">E-mail</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input id="forgot-email" type="email" placeholder="seu@email.com" className="pl-10" value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />} Enviar código
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (view === 'reset-password') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4 relative">
        <Button variant="ghost" size="icon" className="absolute top-4 right-4 z-50 text-muted-foreground hover:text-foreground" asChild>
          <Link to="/" replace><X className="h-5 w-5" /></Link>
        </Button>
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <Button variant="ghost" size="sm" className="absolute left-4 top-4" onClick={() => setView('forgot-password')}>
              <ArrowLeft className="h-4 w-4 mr-2" /> Voltar
            </Button>
            <CardTitle className="text-2xl font-display text-primary">Redefinir senha</CardTitle>
            <CardDescription>Digite o código e sua nova senha</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label>Código de verificação</Label>
              <div className="flex justify-center">
                <InputOTP maxLength={6} value={verificationCode} onChange={setVerificationCode}>
                  <InputOTPGroup>
                    <InputOTPSlot index={0} /><InputOTPSlot index={1} /><InputOTPSlot index={2} />
                    <InputOTPSlot index={3} /><InputOTPSlot index={4} /><InputOTPSlot index={5} />
                  </InputOTPGroup>
                </InputOTP>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-password">Nova senha</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input id="new-password" type="password" placeholder="••••••" className="pl-10" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-new-password">Confirmar nova senha</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input id="confirm-new-password" type="password" placeholder="••••••" className="pl-10" value={confirmNewPassword} onChange={(e) => setConfirmNewPassword(e.target.value)} />
              </div>
            </div>
            <Button className="w-full" onClick={handleResetPassword} disabled={loading || verificationCode.length !== 6}>
              {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />} Redefinir senha
            </Button>
            <Button variant="link" className="w-full" onClick={() => resendCode('password_reset')} disabled={loading}>
              Reenviar código
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ===== SIGNUP STEPS =====
  const passwordStrength = getPasswordStrength(signupPassword);
  const strengthColors = { weak: 'bg-red-500', medium: 'bg-yellow-500', strong: 'bg-green-500' };

  const renderSignupProgressBar = () => (
    <div className="mb-6 space-y-2">
      <div className="flex justify-between items-center text-xs text-muted-foreground">
        <span>Etapa {currentStepIndex + 1} de {activeSteps.length}</span>
        <span>{STEP_LABELS[signupStep]}</span>
      </div>
      <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
        <div 
          className="h-full bg-primary rounded-full transition-all duration-300" 
          style={{ width: `${progressPercent}%` }}
        />
      </div>
    </div>
  );

  const renderSignupTypeStep = () => (
    <div className="space-y-6">
      {renderSignupProgressBar()}
      <div className="text-center mb-4">
        <h3 className="text-lg font-medium">Tipo de Conta</h3>
        <p className="text-sm text-muted-foreground">Você é pessoa física ou jurídica?</p>
      </div>
      <RadioGroup value={userType || ''} onValueChange={(v) => setUserType(v as UserType)} className="grid grid-cols-2 gap-4">
        <div>
          <RadioGroupItem value="PF" id="signup-pf" className="peer sr-only" />
          <Label htmlFor="signup-pf" className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer">
            <User className="mb-3 h-6 w-6" />
            <span className="text-sm font-medium">Pessoa Física</span>
          </Label>
        </div>
        <div>
          <RadioGroupItem value="PJ" id="signup-pj" className="peer sr-only" />
          <Label htmlFor="signup-pj" className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer">
            <Building2 className="mb-3 h-6 w-6" />
            <span className="text-sm font-medium">Pessoa Jurídica</span>
          </Label>
        </div>
      </RadioGroup>
      <Button className="w-full" onClick={handleTypeNext} disabled={!userType}>
        Continuar <ArrowRight className="ml-2 h-4 w-4" />
      </Button>

      {!isGoogleSignup && (
        <>
          <div className="relative my-2">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-2 text-muted-foreground">ou</span>
            </div>
          </div>

          <AppleSignInButton onClick={handleAppleSignIn} isLoading={loading} label="Cadastrar com Apple" />

          <Button
            type="button"
            variant="outline"
            className="w-full gap-2"
            disabled={loading}
            onClick={handleGoogleSignIn}
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            Cadastrar com Google
          </Button>
        </>
      )}
    </div>
  );

  const renderSignupNameEmailStep = () => (
    <div className="space-y-4">
      {renderSignupProgressBar()}
      <Button variant="ghost" size="sm" className="mb-2" onClick={goToPrevSignupStep}>
        <ArrowLeft className="h-4 w-4 mr-2" /> Voltar
      </Button>
      <div className="text-center mb-4">
        <h3 className="text-lg font-medium">Nome e E-mail</h3>
        <p className="text-sm text-muted-foreground">Informe seus dados para começar</p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="signup-name">Nome completo *</Label>
        <div className="relative">
          <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input id="signup-name" type="text" placeholder="Seu nome completo" className="pl-10" value={signupFullName} onChange={(e) => setSignupFullName(e.target.value)} />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="signup-email">E-mail *</Label>
        <div className="relative">
          <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input id="signup-email" type="email" placeholder="seu@email.com" className="pl-10" value={signupEmail} onChange={(e) => setSignupEmail(e.target.value)} />
        </div>
      </div>
      <Button className="w-full" onClick={handleNameEmailNext} disabled={loading}>
        {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
        Continuar <ArrowRight className="ml-2 h-4 w-4" />
      </Button>
    </div>
  );

  const renderSignupVerifyEmailStep = () => (
    <div className="space-y-4">
      {renderSignupProgressBar()}
      <Button variant="ghost" size="sm" className="mb-2" onClick={goToPrevSignupStep}>
        <ArrowLeft className="h-4 w-4 mr-2" /> Voltar
      </Button>
      <div className="text-center mb-4">
        <Mail className="h-8 w-8 mx-auto mb-2 text-primary" />
        <h3 className="text-lg font-medium">Verificação de E-mail</h3>
        <p className="text-sm text-muted-foreground">
          Enviamos um código de verificação para <span className="font-medium text-foreground">{signupEmail}</span>. Verifique sua caixa de entrada.
        </p>
      </div>
      <div className="flex justify-center">
        <InputOTP maxLength={6} value={signupVerificationCode} onChange={setSignupVerificationCode}>
          <InputOTPGroup>
            <InputOTPSlot index={0} /><InputOTPSlot index={1} /><InputOTPSlot index={2} />
            <InputOTPSlot index={3} /><InputOTPSlot index={4} /><InputOTPSlot index={5} />
          </InputOTPGroup>
        </InputOTP>
      </div>
      <div className="text-center text-sm text-muted-foreground">
        <p>O código expira em 10 minutos.</p>
      </div>
      <Button className="w-full" onClick={handleVerifySignupCode} disabled={loading || signupVerificationCode.length !== 6}>
        {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
        Verificar código
      </Button>
      <Button variant="link" className="w-full" onClick={handleResendSignupCode} disabled={loading || resendCooldown > 0}>
        {resendCooldown > 0 ? `Reenviar código (${resendCooldown}s)` : 'Reenviar código'}
      </Button>
    </div>
  );

  const renderSignupPasswordStep = () => (
    <div className="space-y-4">
      {renderSignupProgressBar()}
      <Button variant="ghost" size="sm" className="mb-2" onClick={() => {
        // Going back from password should skip verify_email since already verified
        setSignupStep('name_email');
      }}>
        <ArrowLeft className="h-4 w-4 mr-2" /> Voltar
      </Button>
      <div className="text-center mb-4">
        <Lock className="h-8 w-8 mx-auto mb-2 text-primary" />
        <h3 className="text-lg font-medium">Crie sua Senha</h3>
        <p className="text-sm text-muted-foreground">Escolha uma senha segura para sua conta</p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="signup-password">Senha *</Label>
        <div className="relative">
          <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            id="signup-password"
            type={showPassword ? 'text' : 'password'}
            placeholder="Mínimo 8 caracteres"
            className="pl-10 pr-10"
            value={signupPassword}
            onChange={(e) => setSignupPassword(e.target.value)}
          />
          <button type="button" className="absolute right-3 top-3 text-muted-foreground hover:text-foreground" onClick={() => setShowPassword(!showPassword)}>
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        {signupPassword && (
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                <div className={`h-full rounded-full transition-all ${strengthColors[passwordStrength.level]}`} style={{ width: `${passwordStrength.percent}%` }} />
              </div>
              <span className={`text-xs font-medium ${passwordStrength.level === 'weak' ? 'text-red-500' : passwordStrength.level === 'medium' ? 'text-yellow-500' : 'text-green-500'}`}>
                {passwordStrength.label}
              </span>
            </div>
          </div>
        )}
      </div>
      <div className="space-y-2">
        <Label htmlFor="signup-confirm">Confirmar senha *</Label>
        <div className="relative">
          <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            id="signup-confirm"
            type={showConfirmPassword ? 'text' : 'password'}
            placeholder="Repita a senha"
            className="pl-10 pr-10"
            value={signupConfirmPassword}
            onChange={(e) => setSignupConfirmPassword(e.target.value)}
          />
          <button type="button" className="absolute right-3 top-3 text-muted-foreground hover:text-foreground" onClick={() => setShowConfirmPassword(!showConfirmPassword)}>
            {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        {signupConfirmPassword && signupPassword !== signupConfirmPassword && (
          <p className="text-xs text-destructive">As senhas não coincidem</p>
        )}
      </div>
      <Button className="w-full" onClick={handlePasswordNext} disabled={!signupPassword || !signupConfirmPassword}>
        Continuar <ArrowRight className="ml-2 h-4 w-4" />
      </Button>
    </div>
  );

  const renderSignupProfileStep = () => (
    <div className="space-y-4">
      {renderSignupProgressBar()}
      <Button variant="ghost" size="sm" className="mb-2" onClick={goToPrevSignupStep}>
        <ArrowLeft className="h-4 w-4 mr-2" /> Voltar
      </Button>
      <div className="text-center mb-4">
        <h3 className="text-lg font-medium">
          {userType === 'PF' ? 'Dados Pessoais' : 'Dados da Empresa'}
        </h3>
        <p className="text-sm text-muted-foreground">
          {userType === 'PF' ? 'Suas informações pessoais' : 'Informações da sua empresa'}
        </p>
      </div>

      {userType === 'PF' ? (
        <>
          <div className="space-y-2">
            <Label htmlFor="displayName">Como gostaria de ser chamado? *</Label>
            <Input id="displayName" placeholder="Ex: João" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cpf">CPF *</Label>
            <Input id="cpf" placeholder="000.000.000-00" value={cpf} onChange={(e) => handleCPFChange(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="birthDate">Data de Nascimento *</Label>
            <Input id="birthDate" type="text" inputMode="numeric" placeholder="DD/MM/AAAA" maxLength={10} value={birthDate} onChange={(e) => setBirthDate(formatDateBR(e.target.value))} />
          </div>
        </>
      ) : (
        <>
          <div className="space-y-2">
            <Label htmlFor="companyName">Razão Social *</Label>
            <Input id="companyName" placeholder="Nome da empresa" value={companyName} onChange={(e) => setCompanyName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="displayName">Nome Fantasia *</Label>
            <Input id="displayName" placeholder="Como sua loja será exibida" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cnpj">CNPJ *</Label>
            <Input id="cnpj" placeholder="00.000.000/0000-00" value={cnpj} onChange={(e) => handleCNPJChange(e.target.value)} />
          </div>
        </>
      )}

      {/* @username field */}
      <div className="space-y-2">
        <Label>Seu @username</Label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-primary font-semibold select-none">@</span>
          <Input
            value={signupUsername}
            onChange={(e) => handleUsernameChange(e.target.value)}
            placeholder="seu.username"
            className={cn(
              'pl-7',
              usernameCheckState === 'available' && 'border-green-500',
              usernameCheckState === 'taken' && 'border-destructive',
              usernameCheckState === 'invalid' && 'border-amber-500',
            )}
          />
        </div>
        <p className="text-xs text-muted-foreground">Letras, números, ponto (.) e _ • 3 a 30 caracteres</p>
        {usernameCheckState === 'checking' && (
          <p className="text-xs text-muted-foreground">⏳ Verificando disponibilidade...</p>
        )}
        {usernameCheckState === 'available' && (
          <p className="text-xs text-green-600">✓ @{signupUsername} está disponível</p>
        )}
        {usernameCheckState === 'taken' && (
          <p className="text-xs text-destructive">✗ @{signupUsername} já está em uso</p>
        )}
        {usernameCheckState === 'invalid' && (
          <p className="text-xs text-amber-600">{usernameFormatError}</p>
        )}

        {/* Suggestion chips */}
        {usernameSuggestions.length > 0 && (
          <div className="flex gap-2 flex-wrap pt-1">
            {usernameSuggestions.map(s => (
              <button
                key={s}
                type="button"
                onClick={() => handleUsernameChange(s)}
                className="px-3 py-1 rounded-lg bg-primary/10 text-primary text-sm hover:bg-primary/20 transition-colors"
              >
                @{s}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Terms of Use Section */}
      <div className="border border-border rounded-lg p-4 space-y-3 bg-card">
        <div className="flex items-start space-x-3">
          <Checkbox id="terms" checked={termsAccepted} onCheckedChange={(checked) => setTermsAccepted(checked === true)} className="mt-0.5" />
          <div className="flex-1">
            <Label htmlFor="terms" className="text-sm font-medium leading-none cursor-pointer">
              Li e concordo com os Termos de Uso e Política de Privacidade *
            </Label>
          </div>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <a href="/terms" target="_blank" rel="noopener noreferrer" className="text-primary underline hover:text-primary/80">
            Termos de Uso
          </a>
          <span className="text-muted-foreground">|</span>
          <a href="/privacy-policy" target="_blank" rel="noopener noreferrer" className="text-primary underline hover:text-primary/80">
            Política de Privacidade
          </a>
        </div>
      </div>

      {/* Security Message */}
      <div className="bg-muted/50 rounded-lg p-3 text-sm text-muted-foreground flex items-start gap-2">
        <LockIcon className="h-4 w-4 mt-0.5 flex-shrink-0" />
        <p>Seus dados sensíveis (CPF, CNPJ) são criptografados e nunca são expostos.</p>
      </div>


      <Button className="w-full" onClick={handleCompleteSignup} disabled={loading || !termsAccepted || usernameCheckState !== 'available'}>
        {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
        Finalizar Cadastro
      </Button>
    </div>
  );

  const renderCurrentSignupStep = () => {
    switch (signupStep) {
      case 'type': return renderSignupTypeStep();
      case 'name_email': return renderSignupNameEmailStep();
      case 'verify_email': return renderSignupVerifyEmailStep();
      case 'password': return renderSignupPasswordStep();
      case 'profile': return renderSignupProfileStep();
      default: return renderSignupTypeStep();
    }
  };

  // ===== GOOGLE SIGNUP FLOW (user returned from OAuth, needs to complete profile) =====
  if (isGoogleSignup && user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4 relative">
        <Button 
          variant="ghost" 
          size="icon" 
          className="absolute top-4 right-4 z-50 text-muted-foreground hover:text-foreground"
          onClick={() => { supabase.auth.signOut(); resetSignupFlow(); setIsGoogleSignup(false); }}
        >
          <X className="h-5 w-5" />
        </Button>

        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <img src={kuraLogoAuth} alt="Kura" className="h-12 mx-auto mb-2" />
            <CardTitle className="sr-only">Kura</CardTitle>
            <CardDescription>Complete seu cadastro para continuar</CardDescription>
          </CardHeader>
          <CardContent>
            {renderCurrentSignupStep()}
          </CardContent>
        </Card>
      </div>
    );
  }

  // ===== LOGIN / SIGNUP SCREEN =====
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4 relative">
      {/* Close button - always visible, goes to home */}
      <Button 
        variant="ghost" 
        size="icon" 
        className="absolute top-4 right-4 z-50 text-muted-foreground hover:text-foreground"
        asChild
      >
        <Link to="/" replace>
          <X className="h-5 w-5" />
        </Link>
      </Button>

      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <img src={kuraLogoAuth} alt="Kura" className="h-12 mx-auto mb-2" />
          <CardTitle className="sr-only">Kura</CardTitle>
          <CardDescription>Compre e venda peças únicas perto de você</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="login" className="w-full" onValueChange={(v) => {
            if (v === 'signup') resetSignupFlow();
          }}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="login">Entrar</TabsTrigger>
              <TabsTrigger value="signup">Cadastrar</TabsTrigger>
            </TabsList>
            
            <TabsContent value="login" className="space-y-4 mt-4">
              <form onSubmit={handleSignIn} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="login-email">E-mail</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input id="login-email" type="email" placeholder="seu@email.com" className="pl-10" value={email} onChange={(e) => setEmail(e.target.value)} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="login-password">Senha</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input id="login-password" type="password" placeholder="••••••" className="pl-10" value={password} onChange={(e) => setPassword(e.target.value)} />
                  </div>
                </div>
                <Button type="button" variant="link" className="px-0 text-sm" onClick={() => setView('forgot-password')}>
                  Esqueceu a senha?
                </Button>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />} Entrar
                </Button>
              </form>

              <div className="relative my-4">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-border" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-card px-2 text-muted-foreground">ou</span>
                </div>
              </div>

              <AppleSignInButton onClick={handleAppleSignIn} isLoading={loading} label="Entrar com Apple" />

              <Button
                type="button"
                variant="outline"
                className="w-full gap-2"
                disabled={loading}
                onClick={handleGoogleSignIn}
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
                Continuar com Google
              </Button>
            </TabsContent>
            
            <TabsContent value="signup" className="mt-4">
              {renderCurrentSignupStep()}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
