import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useGeolocation } from '@/hooks/useGeolocation';
import { FilterOptions, ProductCategory, ProductCondition, ProductGender, SortOption } from '@/types';
import { transformProductFromRPC } from '@/lib/transformProduct';

export interface ProductWithDistance {
  id: string;
  title: string;
  description: string;
  price: number;
  originalPrice: number | null;
  size: string;
  brand: string;
  category: ProductCategory;
  condition: ProductCondition;
  status: string;
  images: string[];
  sellerId: string;
  sellerDisplayName: string | null;
  sellerAvatarUrl: string | null;
  sellerCity: string | null;
  sellerState: string | null;
  sellerPlanType: string | null;
  distance: number | null; // Calculated distance in km (server-side)
  gender: ProductGender;
  createdAt: Date;
  isFavorite?: boolean;
  isBoosted?: boolean;
}

interface UseProductsOptions {
  category?: ProductCategory;
  filters?: FilterOptions;
  sortOption?: SortOption;
  limit?: number;
}

export function useProducts(options: UseProductsOptions = {}) {
  const { category, filters, sortOption = 'distance', limit = 100 } = options;
  const { location, hasLocation } = useGeolocation();

  return useQuery({
    queryKey: ['products', category, filters, sortOption, limit, location?.latitude, location?.longitude],
    queryFn: async () => {
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
        p_limit: limit,
        p_offset: 0,
        p_gender: filters?.gender || null,
      });

      if (error) {
        console.error('[useProducts] RPC error:', error);
        throw error;
      }

      const products: ProductWithDistance[] = (data || []).map(transformProductFromRPC);

      return products;
    },
    staleTime: 1000 * 60 * 2, // 2 minutes
  });
}

// Hook for single product - uses secure RPC
export function useProduct(productId: string | undefined) {
  const { location, hasLocation } = useGeolocation();

  return useQuery({
    queryKey: ['product', productId, location?.latitude, location?.longitude],
    queryFn: async () => {
      if (!productId) return null;

      // Use the secure RPC function for single product
      const { data, error } = await supabase.rpc('get_product_with_distance', {
        product_id: productId,
        user_lat: hasLocation && location ? location.latitude : null,
        user_lng: hasLocation && location ? location.longitude : null,
      });

      if (error) {
        console.error('[useProduct] RPC error:', error);
        throw error;
      }

      if (!data || data.length === 0) return null;

      const item = data[0];
      
      return {
        id: item.id,
        title: item.title,
        description: item.description,
        price: Number(item.price),
        originalPrice: item.original_price ? Number(item.original_price) : null,
        size: item.size,
        brand: item.brand,
        category: item.category as ProductCategory,
        condition: item.condition as ProductCondition,
        status: item.status,
        images: item.images || [],
        sellerId: item.seller_id,
        sellerDisplayName: item.seller_display_name,
        sellerAvatarUrl: item.seller_avatar_url,
        sellerCity: item.seller_city,
        sellerState: item.seller_state,
        distance: item.distance_km ? Number(item.distance_km) : null,
        gender: (item.gender as ProductGender) || 'U',
        createdAt: new Date(item.created_at),
      } as ProductWithDistance;
    },
    enabled: !!productId,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}
