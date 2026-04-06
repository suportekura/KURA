import { useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

interface FavoriteItem {
  id: string;
  productId: string;
  createdAt: Date;
}

export function useFavorites() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch all favorites for the current user
  const { data: favorites = [], isLoading } = useQuery({
    queryKey: ['favorites', user?.id],
    queryFn: async () => {
      if (!user) return [];

      const { data, error } = await supabase
        .from('favorites')
        .select('id, product_id, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('[useFavorites] Fetch error:', error);
        throw error;
      }

      return (data || []).map((item) => ({
        id: item.id,
        productId: item.product_id,
        createdAt: new Date(item.created_at),
      })) as FavoriteItem[];
    },
    enabled: !!user,
    staleTime: 1000 * 60 * 2, // 2 minutes
  });

  // Check if a specific product is favorited
  const isFavorited = (productId: string): boolean => {
    return favorites.some((fav) => fav.productId === productId);
  };

  // Get favorite IDs for quick lookup (memoized)
  const favoriteProductIds = useMemo(() => new Set(favorites.map((fav) => fav.productId)), [favorites]);

  // Add to favorites mutation
  const addFavorite = useMutation({
    mutationFn: async (productId: string) => {
      if (!user) throw new Error('Usuário não autenticado');

      const { data, error } = await supabase
        .from('favorites')
        .insert({
          user_id: user.id,
          product_id: productId,
        })
        .select('id, product_id, created_at')
        .single();

      if (error) {
        // Handle unique constraint violation (already favorited)
        if (error.code === '23505') {
          return null;
        }
        throw error;
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['favorites', user?.id] });
    },
    onError: (error) => {
      console.error('[useFavorites] Add error:', error);
      toast({
        title: 'Erro ao favoritar',
        description: 'Tente novamente.',
        variant: 'destructive',
      });
    },
  });

  // Remove from favorites mutation
  const removeFavorite = useMutation({
    mutationFn: async (productId: string) => {
      if (!user) throw new Error('Usuário não autenticado');

      const { error } = await supabase
        .from('favorites')
        .delete()
        .eq('user_id', user.id)
        .eq('product_id', productId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['favorites', user?.id] });
    },
    onError: (error) => {
      console.error('[useFavorites] Remove error:', error);
      toast({
        title: 'Erro ao remover favorito',
        description: 'Tente novamente.',
        variant: 'destructive',
      });
    },
  });

  // Toggle favorite (convenience method)
  const toggleFavorite = async (productId: string): Promise<boolean> => {
    if (!user) {
      toast({
        title: 'Faça login',
        description: 'Você precisa estar logado para favoritar.',
        variant: 'destructive',
      });
      return false;
    }

    const isCurrentlyFavorited = isFavorited(productId);

    if (isCurrentlyFavorited) {
      await removeFavorite.mutateAsync(productId);
      return false;
    } else {
      await addFavorite.mutateAsync(productId);
      return true;
    }
  };

  return {
    favorites,
    favoriteProductIds,
    isLoading,
    isFavorited,
    addFavorite: addFavorite.mutate,
    removeFavorite: removeFavorite.mutate,
    toggleFavorite,
    isToggling: addFavorite.isPending || removeFavorite.isPending,
  };
}

// Hook to get favorites count
export function useFavoritesCount() {
  const { user } = useAuth();

  const { data: count = 0 } = useQuery({
    queryKey: ['favorites-count', user?.id],
    queryFn: async () => {
      if (!user) return 0;

      const { count, error } = await supabase
        .from('favorites')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id);

      if (error) {
        console.error('[useFavoritesCount] Error:', error);
        return 0;
      }

      return count || 0;
    },
    enabled: !!user,
    staleTime: 1000 * 60 * 2,
  });

  return count;
}
