import { useState, useEffect, createContext, useContext, ReactNode, useCallback, useRef } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

interface ProfileStatus {
  emailVerified: boolean;
  profileCompleted: boolean;
  hasUsername: boolean;
  lastFetched: number;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  error: string | null;
  profileStatus: ProfileStatus | null;
  signIn: (email: string, password: string) => Promise<{ 
    error: Error | null; 
    needsVerification?: boolean 
  }>;
  signUp: (email: string, password: string, fullName: string, userType?: 'PF' | 'PJ') => Promise<{ 
    error: Error | null;
    userId?: string;
  }>;
  signOut: () => Promise<void>;
  refreshProfileStatus: () => Promise<void>;
  markUsernameSet: () => void;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Cache duration: 30 seconds
const CACHE_DURATION = 30 * 1000;
// Timeout for requests: 8 seconds
const REQUEST_TIMEOUT = 8 * 1000;

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [profileStatus, setProfileStatus] = useState<ProfileStatus | null>(null);
  
  // Refs to avoid stale closures and prevent re-initialization
  const profileStatusRef = useRef<ProfileStatus | null>(null);
  const initializingRef = useRef(false);

  // Keep ref in sync with state
  useEffect(() => {
    profileStatusRef.current = profileStatus;
  }, [profileStatus]);

  const clearError = useCallback(() => setError(null), []);

  // Fetch profile status with caching - uses ref to avoid dependency issues
  const fetchProfileStatus = useCallback(async (userId: string, forceRefresh = false): Promise<ProfileStatus | null> => {
    const cachedStatus = profileStatusRef.current;
    
    // Check cache first (unless force refresh)
    if (!forceRefresh && cachedStatus && cachedStatus.lastFetched > Date.now() - CACHE_DURATION) {
      return cachedStatus;
    }
    
    try {
      const profileQuery = supabase
        .from('profiles')
        .select('email_verified, profile_completed, suspended_at, username')
        .eq('user_id', userId)
        .maybeSingle();

      // Execute the query with timeout
      const result = await Promise.race([
        profileQuery.then(res => res),
        new Promise<never>((_, reject) => 
          setTimeout(() => reject(new Error('Tempo limite excedido. Tente novamente.')), REQUEST_TIMEOUT)
        )
      ]);

      if (result.error) {
        console.error("[useAuth] Profile fetch error:", result.error);
        throw new Error('Erro ao carregar perfil. Tente novamente.');
      }

      const profile = result.data;

      // Check if user is suspended
      if (profile?.suspended_at) {
        throw new Error('Sua conta foi suspensa. Entre em contato com o suporte.');
      }

      const status: ProfileStatus = {
        emailVerified: profile?.email_verified ?? false,
        profileCompleted: profile?.profile_completed ?? false,
        hasUsername: profile?.username != null,
        lastFetched: Date.now(),
      };

      profileStatusRef.current = status;
      setProfileStatus(status);
      return status;
    } catch (err) {
      console.error("[useAuth] Profile fetch failed:", err);
      throw err;
    }
  }, []); // No dependencies - uses refs

  const markUsernameSet = useCallback(() => {
    setProfileStatus(prev => {
      if (!prev) return prev;
      const updated = { ...prev, hasUsername: true };
      profileStatusRef.current = updated; // sync ref so fetchProfileStatus sees it immediately
      return updated;
    });
  }, []);

  const refreshProfileStatus = useCallback(async () => {
    if (user) {
      try {
        await fetchProfileStatus(user.id, true);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erro ao atualizar perfil');
      }
    }
  }, [user, fetchProfileStatus]);

  useEffect(() => {
    // Prevent double initialization in strict mode
    if (initializingRef.current) return;
    initializingRef.current = true;

    // CRITICAL: Set up auth state listener FIRST (before checking session)
    // This ensures we don't miss any auth events during initialization
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, newSession) => {
        // Handle SIGNED_OUT synchronously
        if (event === 'SIGNED_OUT') {
          setSession(null);
          setUser(null);
          setProfileStatus(null);
          profileStatusRef.current = null;
          setLoading(false);
          return;
        }
        
        // For other events with a session, update state synchronously first
        if (newSession?.user) {
          setSession(newSession);
          setUser(newSession.user);
          
          // CRITICAL: Use setTimeout(0) to defer Supabase calls
          // This prevents deadlock in onAuthStateChange
          setTimeout(() => {
            fetchProfileStatus(newSession.user.id, true)
              .then(status => {
                // OAuth providers (Google, etc.) have email verified by the provider —
                // never force-signOut them based on the email_verified flag, which may
                // still be false at this exact moment due to the AuthCallback update race.
                const isOAuthUser = newSession.user.app_metadata?.provider !== 'email';
                if (!status?.emailVerified && !isOAuthUser) {
                  supabase.auth.signOut();
                }
              })
              .catch(err => {
                console.error("[useAuth] Profile check failed:", err);
                setError(err instanceof Error ? err.message : 'Erro ao verificar perfil');
              })
              .finally(() => {
                setLoading(false);
              });
          }, 0);
        } else {
          setLoading(false);
        }
      }
    );

    // THEN check for existing session (after listener is set up)
    supabase.auth.getSession()
      .then(({ data: { session: existingSession }, error: sessionError }) => {
        if (sessionError) {
          console.error("[useAuth] Session error:", sessionError);
          setError('Erro ao verificar sessão');
          setLoading(false);
          return;
        }

        if (existingSession?.user) {
          // Set session and user immediately for UI responsiveness
          setSession(existingSession);
          setUser(existingSession.user);
          
          // Fetch profile status
          fetchProfileStatus(existingSession.user.id)
            .then(status => {
              const isOAuthUser = existingSession.user.app_metadata?.provider !== 'email';
              if (!status?.emailVerified && !isOAuthUser) {
                return supabase.auth.signOut().then(() => {
                  setSession(null);
                  setUser(null);
                  setProfileStatus(null);
                });
              }
            })
            .catch(err => {
              console.error("[useAuth] Profile fetch error:", err);
              setError(err instanceof Error ? err.message : 'Erro ao carregar perfil');
            })
            .finally(() => {
              setLoading(false);
            });
        } else {
          // No session - just finish loading
          setLoading(false);
        }
      })
      .catch(err => {
        console.error("[useAuth] getSession error:", err);
        setError('Erro ao verificar sessão');
        setLoading(false);
      });

    return () => {
      subscription.unsubscribe();
    };
  }, [fetchProfileStatus]);

  const signIn = useCallback(async (email: string, password: string) => {
    setError(null);
    
    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword({ 
        email, 
        password 
      });

      if (authError) {
        return { error: authError, needsVerification: false };
      }

      if (data.user) {
        const status = await fetchProfileStatus(data.user.id, true);

        if (!status?.emailVerified) {
          await supabase.auth.signOut();
          return { error: null, needsVerification: true };
        }

      }

      return { error: null, needsVerification: false };
    } catch (err) {
      console.error("[useAuth] Sign in failed:", err);
      const error = err instanceof Error ? err : new Error('Erro ao fazer login');
      setError(error.message);
      return { error, needsVerification: false };
    }
  }, [fetchProfileStatus]);

  const signUp = useCallback(async (email: string, password: string, fullName: string, userType?: 'PF' | 'PJ') => {
    setError(null);
    
    try {
      const { data, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: { 
          data: { 
            full_name: fullName,
            user_type: userType 
          },
          emailRedirectTo: `${window.location.origin}/`
        },
      });

      if (authError) {
        return { error: authError };
      }

      const userId = data.user?.id;

      if (data.session) {
        await supabase.auth.signOut();
      }

      return { error: null, userId };
    } catch (err) {
      console.error("[useAuth] Sign up failed:", err);
      const error = err instanceof Error ? err : new Error('Erro ao criar conta');
      setError(error.message);
      return { error };
    }
  }, []);

  const signOut = useCallback(async () => {
    setProfileStatus(null);
    profileStatusRef.current = null;
    await supabase.auth.signOut();
  }, []);

  return (
    <AuthContext.Provider value={{ 
      user, 
      session, 
      loading, 
      error,
      profileStatus,
      signIn, 
      signUp, 
      signOut,
      refreshProfileStatus,
      markUsernameSet,
      clearError
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
