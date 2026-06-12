import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';

const AuthCallback = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const handledRef = useRef(false);

  useEffect(() => {
    // O código PKCE é de uso único — garante que o callback rode apenas uma vez
    if (handledRef.current) return;
    handledRef.current = true;

    const handleCallback = async () => {
      const params = new URLSearchParams(window.location.search);
      const error = params.get('error');

      if (error) {
        toast({
          title: 'Erro ao entrar com Google',
          description: 'O login com Google foi cancelado ou falhou. Tente novamente.',
          variant: 'destructive',
        });
        navigate('/auth');
        return;
      }

      // O client Supabase (detectSessionInUrl ativo por padrão) já troca o código
      // PKCE automaticamente na inicialização; getSession() aguarda essa troca
      // terminar. Chamar exchangeCodeForSession com o código já consumido falharia
      // e mostrava "Erro ao autenticar" mesmo com o login bem-sucedido.
      const { data: { session: existingSession } } = await supabase.auth.getSession();
      let user = existingSession?.user ?? null;

      if (!user) {
        // Fallback: a detecção automática não criou a sessão — troca manual.
        const { data } = await supabase.auth.exchangeCodeForSession(window.location.href);
        user = data?.user ?? null;
      }

      if (!user) {
        toast({
          title: 'Erro ao autenticar',
          description: 'Não foi possível completar o login com Google. Tente novamente.',
          variant: 'destructive',
        });
        navigate('/auth');
        return;
      }

      // Google verifies the user's email — ensure our profile reflects this so
      // useAuth doesn't sign the user out seeing email_verified = false.
      await supabase
        .from('profiles')
        .update({ email_verified: true })
        .eq('user_id', user.id);

      // Check if this Google user still needs to complete their Kura profile.
      // If incomplete, navigate to /auth where Auth.tsx checkProfileStatus() will
      // detect the Google user, read oauth_pending_user_type from sessionStorage,
      // and show the correct signup step.
      const { data: profile } = await supabase
        .from('profiles')
        .select('profile_completed, user_type')
        .eq('user_id', user.id)
        .single();

      if (!profile?.profile_completed || !profile?.user_type) {
        navigate('/auth');
        return;
      }

      navigate('/');
    };

    handleCallback();
  }, [navigate, toast]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
      <p className="text-muted-foreground text-sm">Autenticando com Google...</p>
    </div>
  );
};

export default AuthCallback;
