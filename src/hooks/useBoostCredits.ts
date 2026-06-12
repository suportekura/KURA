import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export interface BoostCredits {
  '24h': number;
  '3d': number;
  '7d': number;
}

export type BoostType = keyof BoostCredits;

/**
 * Saldo de impulsos (boosts) do usuário, por tipo de duração.
 * Fonte única: tabela user_boosts (total - usados por tipo).
 */
export function useBoostCredits() {
  const { user } = useAuth();

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['boost-credits', user?.id],
    enabled: !!user,
    queryFn: async (): Promise<BoostCredits> => {
      const { data: row, error } = await supabase
        .from('user_boosts')
        .select('total_boosts_24h, used_boosts_24h, total_boosts_3d, used_boosts_3d, total_boosts_7d, used_boosts_7d')
        .eq('user_id', user!.id)
        .maybeSingle();

      if (error) throw error;

      return {
        '24h': (row?.total_boosts_24h ?? 0) - (row?.used_boosts_24h ?? 0),
        '3d': (row?.total_boosts_3d ?? 0) - (row?.used_boosts_3d ?? 0),
        '7d': (row?.total_boosts_7d ?? 0) - (row?.used_boosts_7d ?? 0),
      };
    },
  });

  const credits = data ?? null;
  const totalCredits = credits ? credits['24h'] + credits['3d'] + credits['7d'] : 0;

  return { credits, totalCredits, loading: isLoading, refetch };
}
