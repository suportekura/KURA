# Queue Wait Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the queue wait flow so promoted buyers see a "Comprar agora" banner on the product page, and sellers can manually promote the next person from QueueViewSheet.

**Architecture:** One migration updates `get_queue_info` to return promoted state. The hook maps the new fields. ProductDetail reads `userIsPromoted` and renders a conditional banner. QueueViewSheet gains a promoted-user card at the top and a "Promover próximo" button. All DB-side automation (promote on order cancel, clear on sold, expire after 30 min) already exists via triggers.

**Tech Stack:** React 18, TypeScript (strict: false), Supabase (PostgreSQL + RPC), TanStack React Query v5, shadcn/ui, Tailwind CSS, PT-BR text.

**Spec:** `docs/superpowers/specs/2026-03-30-queue-wait-flow-design.md`

**Note on testing:** No automated test framework — verification is manual browser testing against `npm run dev` (port 8080).

---

## File Map

| File | Change |
|---|---|
| `supabase/migrations/<timestamp>_queue_get_info_promoted_fields.sql` | Create — update `get_queue_info` RPC |
| `src/hooks/useProductQueue.ts` | Modify — add promoted fields + `refetchInterval` |
| `src/pages/ProductDetail.tsx` | Modify — extract `handleBuyNow`, add promoted banner |
| `src/components/seller/QueueViewSheet.tsx` | Modify — add promoted entry + "Promover próximo" button |

---

## Task 1: Migration — update `get_queue_info` to return promoted state

**Files:**
- Create: `supabase/migrations/<timestamp>_queue_get_info_promoted_fields.sql`

### Background

The current `get_queue_info` RPC only checks `status = 'waiting'`. When a user is promoted (`status = 'promoted'`), their `user_position` comes back null and `user_in_queue` comes back false — identical to "not in queue". The frontend cannot distinguish the two states. This migration adds `user_is_promoted` and `promotion_expires_at` to the response.

The migration filename must start with a timestamp higher than all existing migrations. Check with `ls supabase/migrations/` and use the next logical timestamp.

- [ ] **Step 1: Create the migration file**

Run:
```bash
npx supabase migration new queue_get_info_promoted_fields
```

This creates `supabase/migrations/<timestamp>_queue_get_info_promoted_fields.sql`. Open it and add:

```sql
-- Update get_queue_info to also return user_is_promoted and promotion_expires_at.
-- Previously the RPC only checked status='waiting', so promoted users were
-- indistinguishable from users not in queue (both returned user_in_queue=false).
CREATE OR REPLACE FUNCTION public.get_queue_info(p_product_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_queue_count         integer;
  v_user_position       integer;
  v_user_in_queue       boolean := false;
  v_user_is_promoted    boolean := false;
  v_promotion_expires_at timestamptz;
  v_user_entry          record;
BEGIN
  -- Count users still waiting (not promoted)
  SELECT COUNT(*) INTO v_queue_count
  FROM product_queue
  WHERE product_id = p_product_id AND status = 'waiting';

  -- Look up the authenticated user's own entry (waiting OR promoted)
  IF auth.uid() IS NOT NULL THEN
    SELECT position, status, promotion_expires_at
    INTO v_user_entry
    FROM product_queue
    WHERE product_id = p_product_id
      AND user_id = auth.uid()
      AND status IN ('waiting', 'promoted')
    LIMIT 1;

    IF FOUND THEN
      IF v_user_entry.status = 'waiting' THEN
        v_user_in_queue  := true;
        v_user_position  := v_user_entry.position;
      ELSIF v_user_entry.status = 'promoted' THEN
        v_user_is_promoted      := true;
        v_promotion_expires_at  := v_user_entry.promotion_expires_at;
      END IF;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'queue_count',          v_queue_count,
    'user_position',        v_user_position,
    'user_in_queue',        v_user_in_queue,
    'user_is_promoted',     v_user_is_promoted,
    'promotion_expires_at', v_promotion_expires_at
  );
END;
$$;
```

- [ ] **Step 2: Push migration to remote**

```bash
npx supabase db push
```

Expected: `Applying migration <timestamp>_queue_get_info_promoted_fields.sql... done`

If you only have local Supabase running, use:
```bash
npx supabase db reset
```

- [ ] **Step 3: Manual verify — RPC returns new fields**

In the Supabase dashboard SQL editor (or via `supabase db` locally), run:
```sql
SELECT public.get_queue_info('<any-valid-product-uuid>');
```

Expected: response includes keys `user_is_promoted` and `promotion_expires_at` (both `false`/`null` for a product with no promotion).

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/
git commit -m "feat(db): update get_queue_info to return user_is_promoted and promotion_expires_at"
```

---

## Task 2: Hook — add promoted fields to `useProductQueue`

**Files:**
- Modify: `src/hooks/useProductQueue.ts`

### Background

The hook currently exposes `{queueCount, userPosition, userInQueue, isLoading, joinQueue, isJoining, leaveQueue, isLeaving}`. It needs three new fields: `userIsPromoted`, `promotionExpiresAt`, `minutesRemaining`. It also needs `refetchInterval: 30_000` so the countdown stays fresh without `setInterval`.

The hook already uses `useQuery` from TanStack React Query v5.

- [ ] **Step 1: Update `QueueInfo` interface**

In `src/hooks/useProductQueue.ts`, find the `QueueInfo` interface (lines 6-10):

```typescript
interface QueueInfo {
  queue_count: number;
  user_position: number | null;
  user_in_queue: boolean;
}
```

Replace with:

```typescript
interface QueueInfo {
  queue_count: number;
  user_position: number | null;
  user_in_queue: boolean;
  user_is_promoted: boolean;
  promotion_expires_at: string | null;
}
```

- [ ] **Step 2: Add `refetchInterval` to the query config**

Find the `useQuery` call (lines 16-34). The config object ends with `staleTime: 1000 * 15,` on line 33, followed by the closing `}` of the config. Add the new line **inside** the config object, immediately after the `staleTime` line (before the closing `}`):

```typescript
    staleTime: 1000 * 15,
    refetchInterval: productStatus === 'reserved' ? 30_000 : false,
  });
```

- [ ] **Step 3: Update the default return value in `queryFn`**

Find the early return inside `queryFn` (line 19):
```typescript
if (!productId) return { queue_count: 0, user_position: null, user_in_queue: false };
```

Replace with:
```typescript
if (!productId) return { queue_count: 0, user_position: null, user_in_queue: false, user_is_promoted: false, promotion_expires_at: null };
```

Find the error return (line 27):
```typescript
return { queue_count: 0, user_position: null, user_in_queue: false };
```

Replace with:
```typescript
return { queue_count: 0, user_position: null, user_in_queue: false, user_is_promoted: false, promotion_expires_at: null };
```

- [ ] **Step 4: Compute derived values and update the return object**

Find the `return` at the bottom of `useProductQueue` (lines 68-77). Replace the entire return block with:

```typescript
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
```

- [ ] **Step 5: Manual verify — TypeScript compiles**

```bash
npm run build 2>&1 | head -30
```

Expected: no TypeScript errors related to `useProductQueue`.

- [ ] **Step 6: Commit**

```bash
git add src/hooks/useProductQueue.ts
git commit -m "feat(hook): add userIsPromoted, promotionExpiresAt, minutesRemaining to useProductQueue"
```

---

## Task 3: ProductDetail — promoted state banner

**Files:**
- Modify: `src/pages/ProductDetail.tsx`

### Background

The product page shows queue UI when `productStatus === 'reserved'` and the user is not the seller. Currently it only checks `userInQueue`. Need to:
1. Add `userIsPromoted` and `minutesRemaining` from the updated hook
2. Extract the inline "Comprar" `onClick` into a named `handleBuyNow` function
3. Add a promoted banner that replaces the queue buttons when `userIsPromoted === true`

The current queue UI section is at ~line 392-411. The "Comprar" inline onClick is at ~line 450-455.

- [ ] **Step 1: Destructure new fields from `useProductQueue`**

Find line ~53 in `ProductDetail.tsx`:
```typescript
  const { queueCount, userPosition, userInQueue, joinQueue, isJoining, leaveQueue, isLeaving } = useProductQueue(id, productStatus);
```

Replace with:
```typescript
  const { queueCount, userPosition, userInQueue, userIsPromoted, minutesRemaining, joinQueue, isJoining, leaveQueue, isLeaving } = useProductQueue(id, productStatus);
```

- [ ] **Step 2: Extract `handleBuyNow` from the inline "Comprar" onClick**

Find the "Comprar" button at ~line 448:
```tsx
            <Button
              className="flex-1 btn-primary h-14 rounded-xl"
              onClick={() => {
                if (!product) return;
                if (!productInCart) {
                  addItem({ productId: product.id, title: product.title, price: product.price, originalPrice: product.originalPrice, size: product.size, brand: product.brand, image: product.images[0], sellerId: product.sellerId, sellerName: product.sellerName, sellerAvatar: product.sellerAvatar });
                }
                navigate('/checkout');
              }}
            >
```

**Before** this button (or just before the `return (` of the component), extract the handler:

```typescript
  const handleBuyNow = () => {
    if (!product) return;
    if (!productInCart) {
      addItem({
        productId: product.id,
        title: product.title,
        price: product.price,
        originalPrice: product.originalPrice,
        size: product.size,
        brand: product.brand,
        image: product.images[0],
        sellerId: product.sellerId,
        sellerName: product.sellerName,
        sellerAvatar: product.sellerAvatar,
      });
    }
    navigate('/checkout');
  };
```

Then update the "Comprar" button's `onClick` to just `onClick={handleBuyNow}`.

- [ ] **Step 3: Add the promoted banner to the reserved-state UI**

Find the reserved-state queue section at ~line 392:
```tsx
            {userInQueue ? (
              <div className="flex-1 flex flex-col items-center gap-1">
                ...
              </div>
            ) : (
              <Button className="flex-1 btn-primary h-14 rounded-xl" onClick={handleJoinQueue} ...>
                Entrar na fila
              </Button>
            )}
```

Replace this entire `{userInQueue ? (...) : (...)}` block with a three-way conditional:

```tsx
            {userIsPromoted ? (
              <div className="flex-1 rounded-xl bg-emerald-500/10 border border-emerald-500/30 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-lg">🎉</span>
                  <p className="font-semibold text-emerald-700 dark:text-emerald-400">
                    Sua vez chegou!
                  </p>
                </div>
                <p className="text-sm text-emerald-600/80 dark:text-emerald-500/80 mb-3">
                  Você tem {minutesRemaining ?? 0} min para finalizar a compra.
                </p>
                <Button
                  className="w-full btn-primary h-11 rounded-xl"
                  onClick={handleBuyNow}
                >
                  <CreditCard className="w-5 h-5 mr-2" />
                  Comprar agora
                </Button>
              </div>
            ) : userInQueue ? (
              <div className="flex-1 flex flex-col items-center gap-1">
                <Button className="w-full h-14 rounded-xl bg-muted text-muted-foreground cursor-default" disabled>
                  <Users className="w-5 h-5 mr-2" />
                  Você está na fila · Posição #{userPosition}
                </Button>
                <button
                  onClick={handleLeaveQueue}
                  disabled={isLeaving}
                  className="text-xs text-muted-foreground hover:text-destructive transition-colors"
                >
                  {isLeaving ? 'Saindo...' : 'Sair da fila'}
                </button>
              </div>
            ) : (
              <Button className="flex-1 btn-primary h-14 rounded-xl" onClick={handleJoinQueue} disabled={isJoining}>
                {isJoining ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : <Users className="w-5 h-5 mr-2" />}
                Entrar na fila
              </Button>
            )}
```

Note: `CreditCard` is already imported in `ProductDetail.tsx`.

- [ ] **Step 4: Manual verify — promoted banner renders**

Start `npm run dev`. To test without going through the full flow, temporarily set a product's queue entry to `status='promoted'` with a future `promotion_expires_at` directly in the Supabase dashboard, then open that product page while logged in as the promoted user.

Expected:
- Green banner "Sua vez chegou! 🎉 Você tem X min para finalizar a compra."
- "Comprar agora" button visible
- No "Entrar na fila" / "Sair da fila" buttons

Also verify non-promoted buyer still sees "Entrar na fila" / "Você está na fila" as before.

- [ ] **Step 5: Manual verify — "Comprar agora" leads to checkout**

Click "Comprar agora" as the promoted user.

Expected: navigates to `/checkout`, product is in cart, checkout proceeds normally. The `reserve_product_for_checkout` RPC already allows promoted users to reserve reserved products — no Checkout changes needed.

- [ ] **Step 6: Commit**

```bash
git add src/pages/ProductDetail.tsx
git commit -m "feat(product): show promoted-buyer banner with countdown and buy button"
```

---

## Task 4: QueueViewSheet — promoted entry + "Promover próximo" button

**Files:**
- Modify: `src/components/seller/QueueViewSheet.tsx`

### Background

The current sheet lists only `status='waiting'` users. Need to add:
1. A separate `useEffect`/`useState` block to fetch the promoted entry (matching the existing component pattern — do NOT introduce `useQuery`)
2. A card at the top showing the promoted user with time remaining
3. A "Promover próximo" button (shown only when there are waiting users and no one is currently promoted)

The component already imports `Users`, `Clock`, `Avatar`, `Badge`, `Skeleton`, `Sheet*`, `supabase`, `formatDistanceToNow`, `ptBR`.

New imports needed: `Button` from `@/components/ui/button`, `useToast` from `@/hooks/use-toast`.

- [ ] **Step 1: Add imports**

Find the import block at the top of `src/components/seller/QueueViewSheet.tsx`. Add:

```typescript
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { ChevronRight } from 'lucide-react';
```

- [ ] **Step 2: Add `PromotedEntry` interface and state**

After the existing `QueueUser` interface, add:

```typescript
interface PromotedEntry {
  id: string;
  promotion_expires_at: string | null;
  display_name: string | null;
  avatar_url: string | null;
}
```

Inside the component function, after `const [loading, setLoading] = useState(true);`, add:

```typescript
  const [promotedEntry, setPromotedEntry] = useState<PromotedEntry | null>(null);
  const [isPromoting, setIsPromoting] = useState(false);
  const { toast } = useToast();
```

- [ ] **Step 3: Add `useEffect` to fetch promoted entry**

After the existing `useEffect` (that fetches the waiting list), add a second `useEffect`. Note: the spec's pseudocode uses a Supabase join (`profiles:user_id(...)`), but this component uses two sequential queries throughout — following that pattern here for consistency.

```typescript
  useEffect(() => {
    if (!open || !productId) return;

    const fetchPromoted = async () => {
      const { data, error } = await supabase
        .from('product_queue')
        .select('id, promotion_expires_at, user_id')
        .eq('product_id', productId)
        .eq('status', 'promoted')
        .maybeSingle();

      if (error || !data) {
        setPromotedEntry(null);
        return;
      }

      const { data: profile } = await supabase
        .from('public_profiles')
        .select('display_name, avatar_url')
        .eq('user_id', data.user_id)
        .maybeSingle();

      setPromotedEntry({
        id: data.id,
        promotion_expires_at: data.promotion_expires_at,
        display_name: profile?.display_name || 'Usuário',
        avatar_url: profile?.avatar_url || null,
      });
    };

    fetchPromoted();
  }, [open, productId]);
```

- [ ] **Step 4: Add `handlePromoteNext` function**

After the two `useEffect` blocks, add:

```typescript
  const handlePromoteNext = async () => {
    setIsPromoting(true);
    const { error } = await supabase.rpc('promote_next_in_queue', {
      p_product_id: productId,
    });
    setIsPromoting(false);

    if (error) {
      toast({ title: 'Erro ao promover usuário', variant: 'destructive' });
    } else {
      toast({ title: 'Próximo usuário promovido!' });
      // Refetch both lists inline (re-triggering the useEffects via state toggle
      // would require a separate counter state; inlining is simpler here)
      setPromotedEntry(null);
      setUsers([]);
      setLoading(true);
      const { data: qData } = await supabase
        .from('product_queue')
        .select('id, position, status, created_at, user_id')
        .eq('product_id', productId)
        .eq('status', 'waiting')
        .order('position', { ascending: true });

      if (qData) {
        const userIds = qData.map(d => d.user_id);
        const { data: profiles } = await supabase
          .from('public_profiles')
          .select('user_id, display_name, avatar_url')
          .in('user_id', userIds);
        const profileMap = new Map((profiles || []).map(p => [p.user_id, p]));
        setUsers(qData.map(q => {
          const p = profileMap.get(q.user_id);
          return { id: q.id, position: q.position, status: q.status, created_at: q.created_at, display_name: p?.display_name || 'Usuário', avatar_url: p?.avatar_url || null };
        }));
      }
      setLoading(false);

      const { data: pData } = await supabase
        .from('product_queue')
        .select('id, promotion_expires_at, user_id')
        .eq('product_id', productId)
        .eq('status', 'promoted')
        .maybeSingle();
      if (pData) {
        const { data: pProfile } = await supabase
          .from('public_profiles')
          .select('display_name, avatar_url')
          .eq('user_id', pData.user_id)
          .maybeSingle();
        setPromotedEntry({ id: pData.id, promotion_expires_at: pData.promotion_expires_at, display_name: pProfile?.display_name || 'Usuário', avatar_url: pProfile?.avatar_url || null });
      } else {
        setPromotedEntry(null);
      }
    }
  };
```

- [ ] **Step 5: Update the JSX — add promoted card and button**

Find the `<div className="space-y-3 ...">` that wraps the list (line 90). Replace its entire content with:

```tsx
        <div className="space-y-3 overflow-y-auto max-h-[50vh] pb-4">

          {/* Promoted user card */}
          {promotedEntry && (() => {
            const expiresAt = promotedEntry.promotion_expires_at
              ? new Date(promotedEntry.promotion_expires_at)
              : null;
            const minsLeft = expiresAt
              ? Math.max(0, Math.floor((expiresAt.getTime() - Date.now()) / 60000))
              : 0;
            return (
              <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/30 p-3">
                <p className="text-xs font-medium text-emerald-700 dark:text-emerald-400 mb-2">
                  Promovido agora
                </p>
                <div className="flex items-center gap-3">
                  <Avatar className="w-10 h-10">
                    <AvatarImage src={promotedEntry.avatar_url || undefined} />
                    <AvatarFallback className="text-sm font-medium">
                      {(promotedEntry.display_name || 'U').charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{promotedEntry.display_name}</p>
                    <div className="flex items-center gap-1 text-xs text-emerald-600/80 dark:text-emerald-500/80">
                      <Clock className="w-3 h-3" />
                      <span>Expira em {minsLeft} min</span>
                    </div>
                  </div>
                  <Badge className="bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border-0 text-xs">
                    Promovido
                  </Badge>
                </div>
              </div>
            );
          })()}

          {/* Promote next button — only when no one is promoted and there are waiting users */}
          {users.length > 0 && !promotedEntry && (
            <Button
              variant="outline"
              className="w-full"
              onClick={handlePromoteNext}
              disabled={isPromoting}
            >
              <ChevronRight className="w-4 h-4 mr-2" />
              {isPromoting ? 'Promovendo...' : 'Promover próximo'}
            </Button>
          )}

          {/* Waiting list */}
          {loading ? (
            [1, 2, 3].map(i => (
              <div key={i} className="flex items-center gap-3 p-3">
                <Skeleton className="w-10 h-10 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-24" />
                </div>
              </div>
            ))
          ) : users.length === 0 && !promotedEntry ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              Nenhum usuário na fila no momento.
            </div>
          ) : users.length > 0 ? (
            <>
              <p className="text-xs font-medium text-muted-foreground px-1">
                Aguardando ({users.length})
              </p>
              {users.map((user) => (
                <div key={user.id} className="flex items-center gap-3 p-3 rounded-xl bg-muted/50">
                  <div className="relative">
                    <Avatar className="w-10 h-10">
                      <AvatarImage src={user.avatar_url || undefined} />
                      <AvatarFallback className="text-sm font-medium">
                        {(user.display_name || 'U').charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <Badge
                      variant="secondary"
                      className="absolute -top-1 -left-1 w-5 h-5 p-0 flex items-center justify-center text-[10px] font-bold"
                    >
                      {user.position}
                    </Badge>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{user.display_name}</p>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="w-3 h-3" />
                      <span>
                        Entrou {formatDistanceToNow(new Date(user.created_at), { addSuffix: true, locale: ptBR })}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </>
          ) : null}
        </div>
```

Note: the position badge now uses `user.position` (the actual DB position) instead of `index + 1` (array index). This is more accurate since positions don't always start at 1 after queue cleanup.

- [ ] **Step 6: Manual verify — promoted card and button**

As seller in MyListings, click the queue badge on a product that has waiting users.

Expected:
- If someone is promoted: green "Promovido agora" card at top with their name and minutes remaining
- If no one is promoted: "Promover próximo" button visible above the waiting list
- If no one waiting and no promoted: "Nenhum usuário na fila no momento."

Click "Promover próximo":
- Expected: toast "Próximo usuário promovido!", lists refresh, promoted card appears, button disappears

- [ ] **Step 7: Commit**

```bash
git add src/components/seller/QueueViewSheet.tsx
git commit -m "feat(queue): add promoted-user card and manual promote button to QueueViewSheet"
```

---

## Final Verification Checklist

- [ ] `get_queue_info` RPC returns `user_is_promoted` and `promotion_expires_at`
- [ ] Promoted buyer navigates to product page → sees green "Sua vez chegou!" banner with countdown
- [ ] Promoted buyer clicks "Comprar agora" → goes to checkout → completes purchase normally
- [ ] Non-promoted buyer in queue → still sees "Você está na fila · Posição #N"
- [ ] Buyer not in queue → still sees "Entrar na fila"
- [ ] Seller cancels order → DB trigger promotes next automatically (no frontend change needed)
- [ ] QueueViewSheet shows promoted user card at top when someone is promoted
- [ ] QueueViewSheet "Promover próximo" button visible only when: waiting users exist AND no one currently promoted
- [ ] Clicking "Promover próximo" → toast, lists refresh, promoted card appears
- [ ] Product sold (status → `sold`) → DB trigger clears queue (no frontend change needed)
