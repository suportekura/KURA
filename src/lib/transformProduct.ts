import { ProductCategory, ProductCondition, ProductGender } from '@/types';
import { ProductWithDistance } from '@/hooks/useProducts';

/**
 * Transforms raw RPC response data into a ProductWithDistance object.
 * Shared between useProducts and useInfiniteProducts to avoid duplication.
 */
export function transformProductFromRPC(item: any): ProductWithDistance {
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
    sellerPlanType: item.seller_plan_type || null,
    distance: item.distance_km ? Number(item.distance_km) : null,
    gender: (item.gender as ProductGender) || 'U',
    createdAt: new Date(item.created_at),
    isBoosted: item.is_boosted ?? false,
  };
}
