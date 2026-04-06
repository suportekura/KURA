---
name: supabase-data-fetching
description: Use when fetching data from Supabase, creating queries, using TanStack React Query, adding realtime subscriptions, calling RPCs, building infinite scroll, or any data layer work. Trigger on keywords like "query", "fetch", "load data", "supabase select", "rpc", "realtime", "subscription", "stale time", "cache", "infinite scroll", "pagination", "react query", "tanstack", "useQuery", "useMutation", "invalidate", "refetch", "product list", "get products", "get seller", "get notifications".
---

# Supabase Data Fetching Patterns

This skill documents how Kura fetches data from Supabase, integrates with TanStack React Query, and manages realtime subscriptions. All data access goes through `src/integrations/supabase/client.ts`.

## When to use this skill

- Creating a new hook that fetches data from Supabase
- Adding a new query or mutation to an existing hook
- Setting up realtime subscriptions (postgres_changes)
- Working with TanStack React Query (cache, keys, stale times)
- Building infinite scroll / paginated lists
- Calling Supabase RPC functions

## Core Patterns

### 1. Supabase Client Import

Always import from the project's integration module, never create a new client:

```typescript
import { supabase } from "@/integrations/supabase/client";
```

The client is configured in `src/integrations/supabase/client.ts` with localStorage persistence and autoRefreshToken.

### 2. TanStack React Query Global Config

Defined in `src/App.tsx`:

```typescript
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60,    // 1 minute
      gcTime: 1000 * 60 * 5,   // 5 minutes
    },
  },
});
```

### 3. Query Key Convention

Keys are multi-dimensional arrays including all dependencies that affect the result:

```typescript
// Pattern: ['entity', ...dependencies]
['products', category, filters, sortOption, limit, lat, lon]
['infinite-products', category, filters, sortOption, lat, lon]
['favorites', user?.id]
['favorites-count', user?.id]
['notifications', user?.id]
['notification-count', user?.id]
['product-queue', productId]
['seller-queue-counts', productIds]
```

### 4. RPC Calls (Complex Queries)

Use RPCs for queries involving distance calculation, complex filtering, or security-sensitive operations:

```typescript
// From useProducts.ts — main marketplace query
const { data, error } = await supabase.rpc('get_products_with_distance', {
  p_user_lat: location?.latitude || null,
  p_user_lon: location?.longitude || null,
  p_category: category !== 'todos' ? category : null,
  p_condition: filters?.condition || null,
  p_sizes: filters?.sizes?.length ? filters.sizes : null,
  p_price_min: filters?.priceMin || null,
  p_price_max: filters?.priceMax || null,
  p_max_distance: filters?.maxDistance || null,
  p_gender: filters?.gender || null,
  p_sort: sortOption || 'newest',
  p_limit: limit,
  p_offset: 0,
});
```

Always transform RPC responses using `src/lib/transformProduct.ts`:

```typescript
import { transformProductFromRPC } from "@/lib/transformProduct";

const products = (data || []).map(transformProductFromRPC);
```

### 5. Direct Queries (Simple CRUD)

Use `.from().select()` for simple table reads:

```typescript
// From useFavorites.ts
const { data, error } = await supabase
  .from('favorites')
  .select(`
    id,
    product_id,
    created_at,
    products (
      id, title, price, original_price, images,
      status, category, condition, size, brand,
      seller_id
    )
  `)
  .eq('user_id', user.id)
  .order('created_at', { ascending: false });
```

### 6. Stale Time Guidelines

Follow these conventions based on data volatility:

| Data Type | Stale Time | Example |
|-----------|-----------|---------|
| Product lists | 2 min | `useProducts` |
| Single product | 5 min | `useProduct(id)` |
| Infinite products | 30 sec | `useInfiniteProducts` (realtime helps) |
| Notifications | 30 sec | `useNotifications` |
| Queue info | 15 sec | `useProductQueue` |
| Seller queue counts | 30 sec | `useSellerQueueCounts` |
| Favorites | 2 min | `useFavorites` |

## Step-by-step Guide

### Creating a new data-fetching hook

1. Create file in `src/hooks/` named `use<Entity>.ts`
2. Import supabase client and useAuth:
   ```typescript
   import { supabase } from "@/integrations/supabase/client";
   import { useAuth } from "@/hooks/useAuth";
   import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
   ```
3. Define query key(s) as arrays with all dependencies
4. Use `useQuery` for reads, `useMutation` for writes
5. Invalidate related queries on mutation success
6. Add realtime subscription if data changes frequently

### Adding a realtime subscription

```typescript
useEffect(() => {
  if (!user?.id) return;

  const channel = supabase
    .channel(`entity-changes-${uniqueId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT', // or 'UPDATE', '*'
        schema: 'public',
        table: 'table_name',
        filter: `column=eq.${filterValue}`,
      },
      (payload) => {
        // Option A: Invalidate query (refetch from server)
        queryClient.invalidateQueries({ queryKey: ['entity', id] });

        // Option B: Update local state (for chat-like UIs)
        setItems(prev => {
          if (prev.some(item => item.id === payload.new.id)) return prev;
          return [...prev, payload.new];
        });
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}, [user?.id, uniqueId]);
```

### Infinite scroll pattern

```typescript
// From useInfiniteProducts.ts
const PAGE_SIZE = 12;

const query = useInfiniteQuery({
  queryKey: ['infinite-products', category, filters, sortOption, lat, lon],
  queryFn: async ({ pageParam = 0 }) => {
    const { data, error } = await supabase.rpc('get_products_with_distance', {
      // ... params
      p_limit: PAGE_SIZE,
      p_offset: pageParam,
    });
    if (error) throw error;
    return (data || []).map(transformProductFromRPC);
  },
  getNextPageParam: (lastPage, allPages) => {
    if (lastPage.length < PAGE_SIZE) return undefined;
    return allPages.flat().length;
  },
  initialPageParam: 0,
  staleTime: 30_000,
});
```

## Code Examples

### Read-only hook with TanStack Query

```typescript
export function useProductQueue(productId: string, productStatus: string) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['product-queue', productId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_queue_info', {
        p_product_id: productId,
      });
      if (error) throw error;
      return data;
    },
    enabled: !!productId && productStatus === 'reserved',
    staleTime: 15_000,
  });
}
```

### Mutation with invalidation

```typescript
const queryClient = useQueryClient();

const addFavorite = useMutation({
  mutationFn: async (productId: string) => {
    const { error } = await supabase
      .from('favorites')
      .insert({ user_id: user!.id, product_id: productId });
    if (error && error.code !== '23505') throw error; // ignore unique constraint
  },
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['favorites', user?.id] });
    queryClient.invalidateQueries({ queryKey: ['favorites-count', user?.id] });
  },
});
```

## Common Mistakes to Avoid

1. **Never create a new Supabase client** — always import from `@/integrations/supabase/client`
2. **Never expose raw coordinates** in client-side queries — use RPCs like `get_products_with_distance` that calculate distance server-side
3. **Never forget to clean up realtime channels** — always return `supabase.removeChannel(channel)` in useEffect cleanup
4. **Don't use overly short stale times** — follow the guidelines above; too-aggressive refetching hurts performance
5. **Don't forget `enabled` flag** — disable queries when dependencies aren't ready (e.g., `enabled: !!user?.id`)
6. **Don't use `.single()` when the row might not exist** — use `.maybeSingle()` instead to avoid errors
7. **Deduplicate realtime inserts** — always check `prev.some(item => item.id === payload.new.id)` before adding

## Checklist

- [ ] Imported supabase from `@/integrations/supabase/client`
- [ ] Query key includes all dependencies that affect the result
- [ ] Stale time matches data volatility guidelines
- [ ] `enabled` flag prevents queries when deps are missing
- [ ] Mutations invalidate all related query keys
- [ ] Realtime channels are cleaned up in useEffect return
- [ ] RPC responses are transformed with `transformProductFromRPC` (for products)
- [ ] Error handling uses `if (error) throw error` pattern inside queryFn
