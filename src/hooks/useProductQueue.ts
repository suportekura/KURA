import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface QueueInfo {
  queue_count: number;
  user_position: number | null;
  user_in_queue: boolean;
  user_is_promoted: boolean;
  promotion_expires_at: string | null;
}

export function useProductQueue(productId: string | undefined, productStatus?: string) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: queueInfo, isLoading } = useQuery({
    queryKey: ['product-queue', productId],
    queryFn: async (): Promise<QueueInfo> => {
      if (!productId) return { queue_count: 0, user_position: null, user_in_queue: false, user_is_promoted: false, promotion_expires_at: null };

      const { data, error } = await supabase.rpc('get_queue_info', {
        p_product_id: productId,
      });

      if (error) {
        console.error('[useProductQueue] Error:', error);
        return { queue_count: 0, user_position: null, user_in_queue: false, user_is_promoted: false, promotion_expires_at: null };
      }

      return data as unknown as QueueInfo;
    },
    enabled: !!productId && productStatus === 'reserved',
    staleTime: 1000 * 15,
    refetchInterval: productStatus === 'reserved' ? 30_000 : false,
  });

  const joinMutation = useMutation({
    mutationFn: async () => {
      if (!productId) throw new Error('No product ID');
      const { data, error } = await supabase.rpc('join_product_queue', {
        p_product_id: productId,
      });
      if (error) throw error;
      const result = data as { success: boolean; error?: string; position?: number };
      if (!result.success) throw new Error(result.error || 'Erro ao entrar na fila');
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-queue', productId] });
    },
  });

  const leaveMutation = useMutation({
    mutationFn: async () => {
      if (!productId) throw new Error('No product ID');
      const { data, error } = await supabase.rpc('leave_product_queue', {
        p_product_id: productId,
      });
      if (error) throw error;
      const result = data as { success: boolean; error?: string };
      if (!result.success) throw new Error(result.error || 'Erro ao sair da fila');
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-queue', productId] });
    },
  });

  const promotionExpiresAt = queueInfo?.promotion_expires_at ?? null;
  const minutesRemaining = promotionExpiresAt
    ? Math.max(0, Math.floor((new Date(promotionExpiresAt).getTime() - Date.now()) / 60000))
    : null;

  return {
    queueCount: queueInfo?.queue_count ?? 0,
    userPosition: queueInfo?.user_position ?? null,
    userInQueue: queueInfo?.user_in_queue ?? false,
    userIsPromoted: queueInfo?.user_is_promoted ?? false,
    promotionExpiresAt,
    minutesRemaining,
    isLoading,
    joinQueue: joinMutation.mutateAsync,
    isJoining: joinMutation.isPending,
    leaveQueue: leaveMutation.mutateAsync,
    isLeaving: leaveMutation.isPending,
  };
}

// Hook for seller to get queue counts for their products
export function useSellerQueueCounts(productIds: string[]) {
  const { data: counts = {}, isLoading } = useQuery({
    queryKey: ['seller-queue-counts', productIds.sort().join(',')],
    queryFn: async () => {
      if (productIds.length === 0) return {};

      const results: Record<string, number> = {};

      // Batch fetch queue counts
      const { data, error } = await supabase
        .from('product_queue')
        .select('product_id')
        .in('product_id', productIds)
        .eq('status', 'waiting');

      if (error) {
        console.error('[useSellerQueueCounts] Error:', error);
        return {};
      }

      // Count per product
      for (const row of data || []) {
        results[row.product_id] = (results[row.product_id] || 0) + 1;
      }

      return results;
    },
    enabled: productIds.length > 0,
    staleTime: 1000 * 30,
  });

  return { counts, isLoading };
}
