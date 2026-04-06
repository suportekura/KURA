import { useEffect, useState, useRef } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Loader2, RefreshCw, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface PublicRouteProps {
  children: React.ReactNode;
}

// Timeout for showing error state: 10 seconds
const LOADING_TIMEOUT = 10 * 1000;

/**
 * PublicRoute - For auth pages (login, signup, verify-email)
 * 
 * Rules:
 * - No session → allow access (stay on auth page)
 * - Session with email_verified = false → allow access (show verify-email)
 * - Session with profile_completed = false → allow access (show profile-setup)
 * - Session fully verified and completed → redirect to home
 * 
 * CRITICAL: Never redirect from one public route to another public route
 */
export function PublicRoute({ children }: PublicRouteProps) {
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
        console.log("[PublicRoute] Loading timeout reached");
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
        <p className="text-sm text-muted-foreground">Carregando...</p>
      </div>
    );
  }

  // No user - allow access to auth pages
  if (!user) {
    return <>{children}</>;
  }

  // User exists - check profile status from cache
  if (profileStatus) {
    // Only redirect to app if BOTH email verified AND profile completed
    if (profileStatus.emailVerified && profileStatus.profileCompleted) {
      const returnTo = location.state?.returnTo || location.state?.from?.pathname || '/';
      return <Navigate to={returnTo} replace />;
    }
  }

  // User needs to verify email or complete profile - stay on auth page
  return <>{children}</>;
}
