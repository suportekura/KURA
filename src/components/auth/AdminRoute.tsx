import { Navigate } from 'react-router-dom';
import { useUserRoles } from '@/hooks/useUserRoles';
import { useAuth } from '@/hooks/useAuth';
import { Loader2 } from 'lucide-react';

interface AdminRouteProps {
  children: React.ReactNode;
  requiredRole?: 'admin' | 'moderator';
}

export function AdminRoute({ children, requiredRole = 'moderator' }: AdminRouteProps) {
  const { user, loading: authLoading } = useAuth();
  const { isAdmin, isModerator, loading: rolesLoading } = useUserRoles();

  if (authLoading || rolesLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  const hasAccess = requiredRole === 'admin' ? isAdmin : isModerator;

  if (!hasAccess) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
