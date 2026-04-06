import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface ProfileSearchResult {
  user_id: string;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
  city: string | null;
  plan_type: string | null;
  sold_count: number | null;
}

export function useProfileSearch(query: string) {
  const [results, setResults] = useState<ProfileSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const stripped = query.replace(/^@/, '').trim();

    if (stripped.length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }

    if (debounceRef.current) clearTimeout(debounceRef.current);
    setLoading(true);
    setError(null);

    debounceRef.current = setTimeout(async () => {
      const { data, error: rpcError } = await supabase
        .rpc('search_profiles', { p_query: stripped });

      setLoading(false);

      if (rpcError) {
        setError('Erro ao buscar perfis. Tente novamente.');
        return;
      }

      setResults((data as ProfileSearchResult[]) || []);
    }, 500);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  return { results, loading, error };
}
