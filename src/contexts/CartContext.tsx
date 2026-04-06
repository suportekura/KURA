import React, { createContext, useContext, useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

const CART_STORAGE_KEY = 'kuralab_cart';

export interface CartItem {
  id: string;
  productId: string;
  title: string;
  price: number;
  originalPrice?: number | null;
  size: string;
  brand: string;
  image: string;
  sellerId: string;
  sellerName: string;
  sellerAvatar?: string;
  quantity: number;
}

interface SellerGroup {
  sellerId: string;
  sellerName: string;
  sellerAvatar?: string;
  items: CartItem[];
  subtotal: number;
}

interface CartContextType {
  items: CartItem[];
  itemCount: number;
  totalAmount: number;
  groupedBySeller: SellerGroup[];
  addItem: (item: Omit<CartItem, 'id' | 'quantity'>) => void;
  removeItem: (id: string) => void;
  removeUnavailableItems: (unavailableProductIds: string[]) => void;
  updateQuantity: (id: string, quantity: number) => void;
  clearCart: () => void;
  isInCart: (productId: string) => boolean;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const { toast } = useToast();
  const notifiedProductsRef = useRef<Set<string>>(new Set());

  const [items, setItems] = useState<CartItem[]>(() => {
    try {
      const stored = localStorage.getItem(CART_STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  // Persist cart to localStorage whenever items change
  useEffect(() => {
    try {
      localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
    } catch (error) {
      console.error('Failed to save cart to localStorage:', error);
    }
  }, [items]);

  // Subscribe to realtime product status changes for items in cart
  useEffect(() => {
    if (items.length === 0) return;

    const productIds = items.map((item) => item.productId);

    const channel = supabase
      .channel('cart-product-status')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'products',
        },
        (payload) => {
          const productId = payload.new?.id;
          const newStatus = payload.new?.status;
          const productTitle = payload.new?.title;

          // Check if this product is in the cart and status changed to reserved/sold
          if (
            productId &&
            productIds.includes(productId) &&
            (newStatus === 'reserved' || newStatus === 'sold')
          ) {
            // Only show toast once per product
            if (!notifiedProductsRef.current.has(productId)) {
              notifiedProductsRef.current.add(productId);
              
              console.log('[CartContext] Product in cart was sold/reserved:', productId);
              
              toast({
                title: 'Item indisponível 😢',
                description: `"${productTitle || 'Um item do seu carrinho'}" foi ${newStatus === 'sold' ? 'vendido' : 'reservado'} por outro usuário.`,
                variant: 'destructive',
              });
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [items, toast]);

  const addItem = useCallback((item: Omit<CartItem, 'id' | 'quantity'>) => {
    setItems((prev) => {
      // Check if product is already in cart
      const existing = prev.find((i) => i.productId === item.productId);
      if (existing) {
        // For thrift store items, typically quantity stays at 1
        return prev;
      }
      
      return [
        ...prev,
        {
          ...item,
          id: crypto.randomUUID(),
          quantity: 1,
        },
      ];
    });
  }, []);

  const removeItem = useCallback((id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const removeUnavailableItems = useCallback((unavailableProductIds: string[]) => {
    setItems((prev) => prev.filter((item) => !unavailableProductIds.includes(item.productId)));
    // Clear the notified products for removed items
    unavailableProductIds.forEach((id) => notifiedProductsRef.current.delete(id));
  }, []);

  const updateQuantity = useCallback((id: string, quantity: number) => {
    if (quantity < 1) {
      removeItem(id);
      return;
    }
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, quantity } : item))
    );
  }, [removeItem]);

  const clearCart = useCallback(() => {
    setItems([]);
  }, []);

  const isInCart = useCallback(
    (productId: string) => items.some((item) => item.productId === productId),
    [items]
  );

  const itemCount = useMemo(
    () => items.reduce((acc, item) => acc + item.quantity, 0),
    [items]
  );

  const totalAmount = useMemo(
    () => items.reduce((acc, item) => acc + item.price * item.quantity, 0),
    [items]
  );

  // Group items by seller
  const groupedBySeller = useMemo(() => {
    const groups: Record<string, SellerGroup> = {};
    
    items.forEach((item) => {
      if (!groups[item.sellerId]) {
        groups[item.sellerId] = {
          sellerId: item.sellerId,
          sellerName: item.sellerName,
          sellerAvatar: item.sellerAvatar,
          items: [],
          subtotal: 0,
        };
      }
      groups[item.sellerId].items.push(item);
      groups[item.sellerId].subtotal += item.price * item.quantity;
    });

    return Object.values(groups);
  }, [items]);

  const value = useMemo(
    () => ({
      items,
      itemCount,
      totalAmount,
      groupedBySeller,
      addItem,
      removeItem,
      removeUnavailableItems,
      updateQuantity,
      clearCart,
      isInCart,
    }),
    [items, itemCount, totalAmount, groupedBySeller, addItem, removeItem, removeUnavailableItems, updateQuantity, clearCart, isInCart]
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const context = useContext(CartContext);
  if (context === undefined) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
}
