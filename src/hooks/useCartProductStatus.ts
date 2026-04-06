import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useCart } from '@/contexts/CartContext';

interface ProductStatus {
  productId: string;
  status: string;
  isSold: boolean;
}

export function useCartProductStatus() {
  const { items } = useCart();
  const [productStatuses, setProductStatuses] = useState<Record<string, ProductStatus>>({});
  const [loading, setLoading] = useState(true);

  const productIds = items.map((item) => item.productId);

  // Fetch current status of all cart products
  const fetchStatuses = useCallback(async () => {
    if (productIds.length === 0) {
      setProductStatuses({});
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from('products')
      .select('id, status')
      .in('id', productIds);

    if (error) {
      console.error('Error fetching product statuses:', error);
      setLoading(false);
      return;
    }

    const statuses: Record<string, ProductStatus> = {};
    data?.forEach((product) => {
      statuses[product.id] = {
        productId: product.id,
        status: product.status,
        isSold: product.status === 'sold' || product.status === 'reserved',
      };
    });

    setProductStatuses(statuses);
    setLoading(false);
  }, [productIds.join(',')]);

  // Initial fetch
  useEffect(() => {
    fetchStatuses();
  }, [fetchStatuses]);

  // Subscribe to real-time updates for products in cart
  useEffect(() => {
    if (productIds.length === 0) return;

    console.log('[useCartProductStatus] Subscribing to realtime for products:', productIds);

    const channel = supabase
      .channel('cart-product-status-check')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'products',
        },
        (payload) => {
          console.log('[useCartProductStatus] Received realtime update:', payload);
          const updatedProduct = payload.new as { id: string; status: string };
          
          // Only update if it's a product in our cart
          if (productIds.includes(updatedProduct.id)) {
            console.log('[useCartProductStatus] Product in cart updated:', updatedProduct.id, 'status:', updatedProduct.status);
            setProductStatuses((prev) => ({
              ...prev,
              [updatedProduct.id]: {
                productId: updatedProduct.id,
                status: updatedProduct.status,
                isSold: updatedProduct.status === 'sold' || updatedProduct.status === 'reserved',
              },
            }));
          }
        }
      )
      .subscribe((status) => {
        console.log('[useCartProductStatus] Subscription status:', status);
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [productIds.join(',')]);

  const isProductSold = useCallback(
    (productId: string) => productStatuses[productId]?.isSold ?? false,
    [productStatuses]
  );

  const hasSoldItems = Object.values(productStatuses).some((status) => status.isSold);
  const availableItemsCount = items.filter((item) => !productStatuses[item.productId]?.isSold).length;
  const unavailableProductIds = Object.values(productStatuses)
    .filter((status) => status.isSold)
    .map((status) => status.productId);

  return {
    productStatuses,
    isProductSold,
    hasSoldItems,
    availableItemsCount,
    unavailableProductIds,
    loading,
    refetch: fetchStatuses,
  };
}
