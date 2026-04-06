import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';

const AuthCallback = () => {
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    const handleCallback = async () => {
      // Clean up oauth_state (CSRF token) — no longer needed once we're in the callback
      const params = new URLSearchParams(window.location.search);
      const code = params.get('code');
      const error = params.get('error');
      const returnedState = params.get('state');
      const expectedState = sessionStorage.getItem('oauth_state');

      if (error) {
        sessionStorage.removeItem('oauth_state');
        toast({
          title: 'Erro ao entrar com Google',
          description: 'O login com Google foi cancelado ou falhou. Tente novamente.',
          variant: 'destructive',
        });
        navigate('/auth');
        return;
      }

      if (!code) {
        sessionStorage.removeItem('oauth_state');
        navigate('/auth');
        return;
      }

      if (!returnedState || !expectedState || returnedState !== expectedState) {
        sessionStorage.removeItem('oauth_state');
        toast({
          title: 'Sessão inválida de autenticação',
          description: 'O retorno do Google não pôde ser validado. Tente novamente.',
          variant: 'destructive',
        });
        navigate('/auth');
        return;
      }

      sessionStorage.removeItem('oauth_state');

      const redirectUri = import.meta.env.DEV
        ? 'http://localhost:8080/auth/callback'
        : 'https://kuralab.com.br/auth/callback';

      const { data, error: exchangeError } = await supabase.functions.invoke('google-oauth-exchange', {
        body: { code, redirect_uri: redirectUri },
      });

      if (exchangeError || !data?.id_token) {
        toast({
          title: 'Erro ao autenticar',
          description: 'Não foi possível completar o login com Google. Tente novamente.',
          variant: 'destructive',
        });
        navigate('/auth');
        return;
      }

      const { data: authData, error: signInError } = await supabase.auth.signInWithIdToken({
        provider: 'google',
        token: data.id_token,
        access_token: data.access_token,
      });

      if (signInError) {
        toast({
          title: 'Erro ao autenticar',
          description: 'Não foi possível completar o login com Google. Tente novamente.',
          variant: 'destructive',
        });
        navigate('/auth');
        return;
      }

      // Google already verified the user's email — ensure the profile reflects this.
      // Without this, useAuth sees email_verified=false and immediately signs the user out.
      if (authData?.user?.id) {
        await supabase
          .from('profiles')
          .update({ email_verified: true })
          .eq('user_id', authData.user.id);

        // Check if profile is complete — new Google users must finish signup before entering the app
        const { data: profile } = await supabase
          .from('profiles')
          .select('profile_completed, user_type')
          .eq('user_id', authData.user.id)
          .single();

        if (!profile?.profile_completed || !profile?.user_type) {
          // Incomplete profile → go to /auth so Auth.tsx shows the Google signup flow
          navigate('/auth');
          return;
        }
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
