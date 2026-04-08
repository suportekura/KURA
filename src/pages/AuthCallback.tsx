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

      // Exchange the PKCE auth code for a Supabase session.
      // exchangeCodeForSession reads the `code` query param from the URL automatically.
      const { data, error: sessionError } = await supabase.auth.exchangeCodeForSession(
        window.location.href
      );

      if (sessionError || !data?.user) {
        toast({
          title: 'Erro ao autenticar',
          description: 'Não foi possível completar o login com Google. Tente novamente.',
          variant: 'destructive',
        });
        navigate('/auth');
        return;
      }

      const user = data.user;

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
