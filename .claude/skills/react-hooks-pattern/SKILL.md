---
name: react-hooks-pattern
description: Use when creating or modifying custom React hooks, context providers, or data management logic. Trigger on keywords like "hook", "useQuery", "useMutation", "context", "provider", "useEffect", "useState", "useRef", "custom hook", "realtime", "subscription", "optimistic update", "invalidation", "query key", "cache", "refetch", "stale closure", "useAuth", "useGeolocation", "useCart", "useFavorites", "useNotifications", "useOffers", "useConversation". Also trigger when creating any file in src/hooks/ or src/contexts/.
---

# React Hooks Pattern

This skill documents the conventions for custom hooks and context providers in the Kura project. There are 19 hooks in `src/hooks/` and 2 context providers in `src/contexts/`.

## When to use this skill

- Creating a new custom hook
- Adding mutations or queries to an existing hook
- Creating a new context provider
- Working with realtime subscriptions in hooks
- Preventing stale closures in auth/session hooks
- Choosing between TanStack Query vs useState for state management

## Core Patterns

### 1. When to Use What

| Pattern | When to Use | Examples |
|---------|-------------|---------|
| TanStack Query (`useQuery`) | Server data that benefits from caching/refetching | `useFavorites`, `useProducts`, `useProductQueue`, `useNotifications` |
| `useState` + realtime | Fast-updating data where local state is more responsive | `useOffers`, `useCartProductStatus` |
| Context Provider | Global state shared across many components | `useAuth`, `useGeolocation`, `useCart`, `useTheme` |
| Utility hook (no state) | Pure computation or browser API wrappers | `useCurrencyInput`, `useScrollDirection`, `usePullToRefresh` |
| Fire-and-forget | One-time side effects | `useProductViews` (record view once) |

### 2. Hook File Convention

```typescript
// src/hooks/useMyEntity.ts
import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

export function useMyEntity(entityId: string) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Query
  const { data, isLoading, error } = useQuery({
    queryKey: ['my-entity', entityId],
    queryFn: async () => { /* ... */ },
    enabled: !!entityId && !!user?.id,
    staleTime: 60_000,
  });

  // Mutation
  const mutation = useMutation({
    mutationFn: async (params: MyParams) => { /* ... */ },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-entity', entityId] });
      toast({ title: "Sucesso!" });
    },
    onError: (error) => {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    },
  });

  return {
    data,
    isLoading,
    doAction: mutation.mutate,
    isActing: mutation.isPending,
  };
}
```

### 3. Context Provider Pattern

Based on `useAuth.tsx` and `useGeolocation.tsx`:

```typescript
// src/contexts/MyContext.tsx
import { createContext, useContext, useState, useEffect, useRef, ReactNode } from "react";

interface MyContextType {
  data: MyData | null;
  loading: boolean;
  doSomething: () => void;
}

const MyContext = createContext<MyContextType | undefined>(undefined);

export function MyProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<MyData | null>(null);
  const [loading, setLoading] = useState(true);

  // Use refs to prevent stale closures in callbacks
  const dataRef = useRef(data);
  dataRef.current = data;

  useEffect(() => {
    // initialization logic
    setLoading(false);
    return () => { /* cleanup */ };
  }, []);

  const doSomething = useCallback(() => {
    // Use dataRef.current instead of data to avoid stale closures
    const currentData = dataRef.current;
    // ...
  }, []); // empty deps are safe because we use refs

  return (
    <MyContext.Provider value={{ data, loading, doSomething }}>
      {children}
    </MyContext.Provider>
  );
}

export function useMyContext() {
  const context = useContext(MyContext);
  if (!context) {
    throw new Error("useMyContext must be used within MyProvider");
  }
  return context;
}
```

Provider order in `src/App.tsx`:
```
QueryClientProvider → ThemeProvider → AuthProvider → GeolocationProvider → CartProvider
```

### 4. Realtime Subscription in Hooks

Pattern from `useOffers.ts` and `useInfiniteProducts.ts`:

```typescript
export function useMyRealtimeData(channelId: string) {
  const [items, setItems] = useState<Item[]>([]);
  const { user } = useAuth();

  // Initial fetch
  useEffect(() => {
    if (!channelId) return;

    const fetchItems = async () => {
      const { data } = await supabase
        .from('my_table')
        .select('*')
        .eq('channel_id', channelId)
        .order('created_at', { ascending: true });

      if (data) setItems(data);
    };

    fetchItems();
  }, [channelId]);

  // Realtime subscription
  useEffect(() => {
    if (!channelId) return;

    const channel = supabase
      .channel(`my-table-${channelId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'my_table',
          filter: `channel_id=eq.${channelId}`,
        },
        (payload) => {
          setItems(prev => {
            // Deduplicate — critical for realtime
            if (prev.some(item => item.id === payload.new.id)) return prev;
            return [...prev, payload.new as Item];
          });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'my_table',
          filter: `channel_id=eq.${channelId}`,
        },
        (payload) => {
          setItems(prev =>
            prev.map(item =>
              item.id === payload.new.id ? { ...item, ...payload.new } : item
            )
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [channelId]);

  return { items };
}
```

### 5. Stale Closure Prevention

From `useAuth.tsx` — use refs for values accessed in async callbacks:

```typescript
const [profileStatus, setProfileStatus] = useState(null);
const profileStatusRef = useRef(profileStatus);

// Keep ref in sync
useEffect(() => {
  profileStatusRef.current = profileStatus;
}, [profileStatus]);

// In async callback, use ref instead of state
const onAuthStateChange = useCallback((event, session) => {
  // BAD: profileStatus may be stale
  // GOOD: profileStatusRef.current is always current
  if (profileStatusRef.current?.profile_completed) {
    // ...
  }
}, []); // empty deps is safe with refs
```

### 6. Fire-and-Forget Pattern

From `useProductViews.ts`:

```typescript
export function useRecordProductView(productId: string) {
  const { user } = useAuth();
  const hasRecorded = useRef(false);

  useEffect(() => {
    if (!productId || !user?.id || hasRecorded.current) return;
    hasRecorded.current = true;

    // Fire and forget — no await, no error handling needed
    supabase.rpc('record_product_view', { p_product_id: productId });
  }, [productId, user?.id]);
}
```

### 7. Memoized Derived Data

From `useFavorites.ts`:

```typescript
const favoriteProductIds = useMemo(
  () => new Set(favorites?.map(f => f.product_id) || []),
  [favorites]
);

const isFavorited = useCallback(
  (productId: string) => favoriteProductIds.has(productId),
  [favoriteProductIds]
);
```

## Step-by-step Guide

### Creating a new data hook

1. Create `src/hooks/useMyEntity.ts`
2. Import supabase client + useAuth + TanStack Query
3. Define query key as `['my-entity', ...deps]`
4. Implement `useQuery` with `enabled` guard
5. Implement mutations with `invalidateQueries` on success
6. Add realtime subscription if data changes from other users
7. Return clean API: `{ data, isLoading, doAction, isActing }`

### Creating a new context provider

1. Create `src/contexts/MyContext.tsx`
2. Define TypeScript interface for context value
3. Create context with `createContext<T | undefined>(undefined)`
4. Create Provider component with state + refs
5. Create consumer hook with undefined check
6. Add Provider to `src/App.tsx` in the correct order

## Common Mistakes to Avoid

1. **Don't use state values in long-lived callbacks** — use refs to prevent stale closures (see `useAuth.tsx` pattern)
2. **Don't forget to deduplicate realtime inserts** — always check `prev.some(item => item.id === payload.new.id)`
3. **Don't forget the `enabled` flag** — queries should not run when user is null or entityId is missing
4. **Don't mix TanStack Query and useState for the same data** — pick one. Use TanStack Query for server-cacheable data, useState for realtime-updated data
5. **Don't forget `return () => supabase.removeChannel(channel)`** — memory leaks and duplicate subscriptions
6. **Don't create a context for data that only one component needs** — use a local hook instead
7. **Don't invalidate queries inside the queryFn** — invalidate in mutation's `onSuccess`

## Checklist

- [ ] Hook follows naming convention: `use<Entity>.ts` in `src/hooks/`
- [ ] Imports supabase from `@/integrations/supabase/client`
- [ ] Query keys include all dependencies
- [ ] `enabled` flag guards against missing dependencies
- [ ] Mutations invalidate related queries on success
- [ ] Realtime subscriptions deduplicate and clean up
- [ ] Refs used for values in async callbacks (stale closure prevention)
- [ ] Return type is a clean API object (not raw query results)
- [ ] Toast notifications on mutation success/error
