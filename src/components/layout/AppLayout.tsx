import { ReactNode, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { BottomNav } from './BottomNav';
import { Header } from './Header';
import { PushPermissionPrompt } from '@/components/notifications/PushPermissionPrompt';
import { UsernameSetupSheet } from '@/components/auth/UsernameSetupSheet';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';

interface AppLayoutProps {
  children: ReactNode;
  showHeader?: boolean;
}

export function AppLayout({ children, showHeader = true }: AppLayoutProps) {
  const { user, profileStatus } = useAuth();
  const [isAdminOrMod, setIsAdminOrMod] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .in('role', ['admin', 'moderator'])
      .maybeSingle()
      .then(({ data }) => setIsAdminOrMod(data !== null));
  }, [user]);

  const showUsernameSheet =
    user !== null &&
    profileStatus !== null &&
    !profileStatus.hasUsername &&
    !isAdminOrMod;

  return (
    <div className="min-h-screen bg-background pb-20">
      {showHeader && <Header />}
      <main>{children}</main>
      <footer className="pb-24 pt-4 text-center text-xs text-muted-foreground/50 space-x-3 select-none">
        <span>© Kura</span>
        <Link to="/terms" className="hover:text-muted-foreground transition-colors">Termos de Uso</Link>
        <Link to="/privacy-policy" className="hover:text-muted-foreground transition-colors">Política de Privacidade</Link>
      </footer>
      <BottomNav />
      <PushPermissionPrompt />
      {showUsernameSheet && <UsernameSetupSheet />}
    </div>
  );
}
