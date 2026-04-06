import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export type AppRole = 'admin' | 'moderator' | 'user';

export function useUserRoles() {
  const { user } = useAuth();
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setRoles([]);
      setLoading(false);
      return;
    }

    const fetchRoles = async () => {
      try {
        const { data, error } = await supabase.rpc('get_user_roles', {
          _user_id: user.id
        });

        if (error) {
          console.error('[useUserRoles] Error fetching roles:', error);
          setRoles([]);
        } else {
          setRoles((data as AppRole[]) || []);
        }
      } catch (err) {
        console.error('[useUserRoles] Unexpected error:', err);
        setRoles([]);
      } finally {
        setLoading(false);
      }
    };

    fetchRoles();
  }, [user]);

  const hasRole = (role: AppRole): boolean => {
    return roles.includes(role);
  };

  const isAdmin = hasRole('admin');
  const isModerator = hasRole('moderator') || isAdmin;

  return {
    roles,
    loading,
    hasRole,
    isAdmin,
    isModerator,
  };
}
