import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

/**
 * Records a product view with 30-min dedup per user.
 * Does not count seller's own views.
 */
export function useRecordProductView(productId: string | undefined) {
  const { user } = useAuth();
  const recorded = useRef(false);

  useEffect(() => {
    if (!productId || !user || recorded.current) return;
    recorded.current = true;

    supabase.rpc('record_product_view', { p_product_id: productId }).then(({ error }) => {
      if (error) console.error('Error recording view:', error.message);
    });
  }, [productId, user]);
}

/**
 * Format view count for display (e.g., 1.2k)
 */
export function formatViewCount(count: number): string {
  if (count >= 1000) {
    return `${(count / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}k`;
  }
  return count.toString();
}
