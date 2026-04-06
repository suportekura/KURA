import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useGeolocation } from '@/hooks/useGeolocation';
import { FilterOptions, ProductCategory, ProductCondition, ProductGender, SortOption } from '@/types';
import { ProductWithDistance } from './useProducts';
import { transformProductFromRPC } from '@/lib/transformProduct';

const PAGE_SIZE = 12;

interface UseInfiniteProductsOptions {
  category?: ProductCategory;
  filters?: FilterOptions;
  sortOption?: SortOption;
}

export function useInfiniteProducts(options: UseInfiniteProductsOptions = {}) {
  const { category, filters, sortOption = 'distance' } = options;
  const { location, hasLocation } = useGeolocation();
  const queryClient = useQueryClient();

  // Subscribe to realtime product status changes to remove reserved/sold items from catalog
  useEffect(() => {
    const channel = supabase
      .channel('catalog-products-status')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'products',
        },
        (payload) => {
          const newStatus = payload.new?.status;
          // If product was reserved or sold, invalidate the catalog query
          if (newStatus === 'reserved' || newStatus === 'sold') {
            queryClient.invalidateQueries({ queryKey: ['infinite-products'] });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  const query = useInfiniteQuery({
    queryKey: ['infinite-products', category, filters, sortOption, location?.latitude, location?.longitude],
    queryFn: async ({ pageParam = 0 }) => {
      // Use the secure RPC function that calculates distance server-side
      // This never exposes raw coordinates to the client
      const { data, error } = await supabase.rpc('get_products_with_distance', {
        user_lat: hasLocation && location ? location.latitude : null,
        user_lng: hasLocation && location ? location.longitude : null,
        p_category: category || null,
        p_conditions: filters?.condition?.length ? filters.condition : null,
        p_sizes: filters?.sizes?.length ? filters.sizes : null,
        p_price_min: filters?.priceMin || null,
        p_price_max: filters?.priceMax || null,
        p_max_distance: filters?.maxDistance || null,
        p_sort_by: sortOption,
        p_limit: PAGE_SIZE,
        p_offset: pageParam * PAGE_SIZE,
        p_gender: filters?.gender || null,
      });

      if (error) {
        console.error('[useInfiniteProducts] RPC error:', error);
        throw error;
      }

      const products: ProductWithDistance[] = (data || []).map(transformProductFromRPC);

      return {
        products,
        nextPage: data && data.length === PAGE_SIZE ? pageParam + 1 : undefined,
      };
    },
    getNextPageParam: (lastPage) => lastPage.nextPage,
    initialPageParam: 0,
    staleTime: 1000 * 30, // 30 seconds - shorter to catch any missed realtime events
  });

  return query;
}
