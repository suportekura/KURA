import { useEffect, useState, useRef } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Loader2, RefreshCw, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

// Timeout for showing error state: 10 seconds
const LOADING_TIMEOUT = 10 * 1000;

/**
 * ProtectedRoute - Guards private routes
 * 
 * Rules:
 * - No session → redirect to /auth
 * - Session with email_verified = false → redirect to /auth (verify-email view)
 * - Session with email_verified = true but profile_completed = false → redirect to /auth (profile-setup view)
 * - Session with email_verified = true and profile_completed = true → allow access
 */
export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { user, loading, error, profileStatus, refreshProfileStatus, clearError } = useAuth();
  const location = useLocation();
  
  const [localTimeout, setLocalTimeout] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loadingStartRef = useRef<number | null>(null);

  // Start timeout only when loading begins, clear when loading ends
  useEffect(() => {
    if (loading && !localTimeout) {
      // Record when loading started
      loadingStartRef.current = Date.now();
      
      // Start timeout timer
      timeoutRef.current = setTimeout(() => {
        console.log("[ProtectedRoute] Loading timeout reached");
        setLocalTimeout(true);
      }, LOADING_TIMEOUT);
    } else if (!loading) {
      // Loading finished - clear timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      loadingStartRef.current = null;
      
      // Reset local timeout if we successfully loaded
      if (localTimeout && !error) {
        setLocalTimeout(false);
      }
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, [loading, localTimeout, error]);

  const handleRetry = async () => {
    // Reset all error states BEFORE retrying
    setLocalTimeout(false);
    setIsRetrying(true);
    clearError();
    
    try {
      await refreshProfileStatus();
    } finally {
      setIsRetrying(false);
    }
  };

  // Show error state with retry button (either from context error or local timeout)
  const showError = (error || localTimeout) && !isRetrying;
  
  if (showError) {
    const errorMessage = error || 'O carregamento demorou muito. Por favor, tente novamente.';
    
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background px-4">
        <AlertCircle className="h-12 w-12 text-destructive mb-4" />
        <h2 className="text-lg font-semibold text-foreground mb-2">Erro de Carregamento</h2>
        <p className="text-sm text-muted-foreground text-center mb-6 max-w-sm">
          {errorMessage}
        </p>
        <Button onClick={handleRetry} variant="outline" className="gap-2" disabled={isRetrying}>
          <RefreshCw className={`h-4 w-4 ${isRetrying ? 'animate-spin' : ''}`} />
          Tentar Novamente
        </Button>
      </div>
    );
  }

  // Show loading state
  if (loading || isRetrying) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
        <p className="text-sm text-muted-foreground">Verificando autenticação...</p>
      </div>
    );
  }

  // No user → redirect to auth
  if (!user) {
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }

  // Use cached profile status from context
  if (profileStatus) {
    // Email not verified → redirect to auth with verify-email view
    if (!profileStatus.emailVerified) {
      return <Navigate to="/auth" state={{ view: 'verify-email', from: location }} replace />;
    }

    // Profile not completed → redirect to auth with profile-setup view
    if (!profileStatus.profileCompleted) {
      return <Navigate to="/auth" state={{ view: 'profile-setup', from: location }} replace />;
    }
  }

  // All checks passed → render children
  return <>{children}</>;
}
