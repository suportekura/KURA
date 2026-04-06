# Chat Offer Checkout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix three chat bugs (offer button visible after purchase, duplicate Confirm button) and add a checkout link for negotiated offer prices.

**Architecture:** Two files modified — `Chat.tsx` gets bug fixes and a new offer-accepted banner with checkout navigation; `Checkout.tsx` gets an offer mode that reads `?offerId=` from the URL, fetches the accepted offer from the DB, and creates the order at the negotiated price.

**Tech Stack:** React 18, TypeScript, Supabase (Postgres + RLS), TanStack React Query, shadcn/ui, Tailwind CSS, Framer Motion not needed here.

**Note on testing:** This project has no automated test framework. Verification steps are manual browser tests against a running dev server (`npm run dev` at `http://localhost:8080`). You will need two browser profiles (or incognito windows) to simulate buyer and seller simultaneously.

**Spec:** `docs/superpowers/specs/2026-03-30-chat-offer-checkout-design.md`

---

## File Map

| File | Change |
|---|---|
| `src/pages/Chat.tsx` | Tasks 1 + 2 |
| `src/pages/Checkout.tsx` | Tasks 3 + 4 |

---

## Task 1: Fix canMakeOffer and remove duplicate Confirm button in Chat.tsx

**Files:**
- Modify: `src/pages/Chat.tsx:472-558`

### Background

`canMakeOffer` currently shows the "Oferta" button even when an order already exists (Cenário 1 — buyer clicked "Buy" and was redirected to chat). The `orderSummary` state is already fetched but not checked.

The seller also sees a green "Confirmar" button in the header (line ~544) AND an amber banner with another "Confirmar" button (~line 563). The header one is the duplicate — remove it.

- [ ] **Step 1: Fix canMakeOffer — add `!orderSummary`**

In `src/pages/Chat.tsx`, find this block (~line 472):
```typescript
const canMakeOffer = conversation.product_id &&
  conversation.product_price &&
  !conversation.is_seller &&
  !hasAcceptedOffer();
```

Replace with:
```typescript
const canMakeOffer = conversation.product_id &&
  conversation.product_price &&
  !conversation.is_seller &&
  !hasAcceptedOffer() &&
  !orderSummary;
```

- [ ] **Step 2: Remove the duplicate "Confirmar" button from the header**

In `src/pages/Chat.tsx`, find and delete this entire block inside the `<header>` JSX (~line 543):
```tsx
{/* Confirm order button in header (for sellers with pending orders) */}
{conversation.is_seller && pendingOrderId && (
  <Button
    size="sm"
    onClick={handleConfirmOrder}
    disabled={confirmingOrder}
    className="flex-shrink-0 btn-primary"
  >
    {confirmingOrder ? (
      <Loader2 className="w-4 h-4 mr-1 animate-spin" />
    ) : (
      <CheckCircle className="w-4 h-4 mr-1" />
    )}
    Confirmar
  </Button>
)}
```

The amber banner below the header (`{conversation.is_seller && pendingOrderId && (...)`) already has the correct orange "Confirmar" button — leave that intact.

- [ ] **Step 3: Manual verify — Offer button hidden**

Start dev server: `npm run dev`

As buyer: open a chat that was created after clicking "Comprar" (i.e., has an order → `orderSummary` is non-null).

Expected: header shows NO "Oferta" button.

- [ ] **Step 4: Manual verify — single Confirm button**

As seller: open a chat with a pending order.

Expected: ONE amber banner with orange "Confirmar" button. No green button in the header.

- [ ] **Step 5: Commit**

```bash
git add src/pages/Chat.tsx
git commit -m "fix(chat): hide offer button when order exists, remove duplicate confirm button"
```

---

## Task 2: Add accepted-offer banner with checkout link in Chat.tsx

**Files:**
- Modify: `src/pages/Chat.tsx`

### Background

When a seller accepts a buyer's offer, both sides should see a visual indicator. The buyer gets a "Comprar por R$ X,XX" button that navigates to `/checkout?offerId=<id>`. The seller sees a waiting message. Neither sees the banner if an order already exists.

The current code shows a simple one-line banner: `{hasAcceptedOffer() && (...)}`.

- [ ] **Step 1: Add `acceptedOffer` derived value**

In `src/pages/Chat.tsx`, directly after the `canMakeOffer` computed value, add:

```typescript
// Get the most recently accepted offer (reverse + find guards against duplicate 'accepted' rows)
const acceptedOffer = [...offers].reverse().find(o => o.status === 'accepted') ?? null;
```

- [ ] **Step 2: Replace the existing accepted-offer banner**

Find the existing banner (~line 599):
```tsx
{/* Accepted offer banner */}
{hasAcceptedOffer() && (
  <div className="bg-primary/10 border-b border-primary/20 px-4 py-2">
    <p className="text-sm text-primary text-center font-medium">
      ✓ Oferta aceita! Combine os detalhes da entrega.
    </p>
  </div>
)}
```

Replace it with the three-case banner. The `ShoppingCart` icon needs to be imported — add it to the existing `lucide-react` import at the top of the file.

Add `ShoppingCart` to the lucide import:
```typescript
import { ArrowLeft, Send, Loader2, User, Tag, CheckCircle, Package, Clock, PackageCheck, Check, CheckCheck, ShoppingCart } from 'lucide-react';
```

Then replace the banner block with:
```tsx
{/* Accepted offer banner */}
{acceptedOffer && !orderSummary && (
  <>
    {!conversation.is_seller ? (
      // Buyer view: show checkout button
      <div className="bg-emerald-500/10 border-b border-emerald-500/30 px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">
              ✓ Oferta aceita!
            </p>
            <p className="text-xs text-emerald-600/80 dark:text-emerald-500/80">
              Por R$ {acceptedOffer.amount.toFixed(2).replace('.', ',')}
            </p>
          </div>
          <Button
            size="sm"
            onClick={() => navigate(`/checkout?offerId=${acceptedOffer.id}`)}
            className="flex-shrink-0 bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            <ShoppingCart className="w-4 h-4 mr-1" />
            Comprar por R$ {acceptedOffer.amount.toFixed(2).replace('.', ',')}
          </Button>
        </div>
      </div>
    ) : (
      // Seller view: waiting message
      <div className="bg-primary/10 border-b border-primary/20 px-4 py-2">
        <p className="text-sm text-primary text-center font-medium">
          ✓ Oferta aceita! Aguardando o comprador finalizar a compra.
        </p>
      </div>
    )}
  </>
)}
```

- [ ] **Step 3: Manual verify — buyer sees checkout button**

As buyer: open a chat where the seller has accepted your offer (status = 'accepted' in offers table).

Expected: Green banner with price and "Comprar por R$ X,XX" button. No "Oferta" button in the header (because `hasAcceptedOffer()` is still true in `canMakeOffer`).

- [ ] **Step 4: Manual verify — seller sees waiting message**

As seller in the same chat.

Expected: Plain green banner "✓ Oferta aceita! Aguardando o comprador finalizar a compra."

- [ ] **Step 5: Manual verify — no banner when order exists**

As buyer in a chat that already has an order (`orderSummary` non-null, even if there's also an accepted offer).

Expected: No offer-accepted banner (the order summary card is shown instead).

- [ ] **Step 6: Commit**

```bash
git add src/pages/Chat.tsx
git commit -m "feat(chat): add accepted-offer banner with checkout link for buyer"
```

---

## Task 3: Checkout.tsx — offer mode data loading

**Files:**
- Modify: `src/pages/Checkout.tsx`

### Background

When `?offerId=` is present in the URL, the checkout must:
1. Not redirect to `/cart` (bypasses both existing guards)
2. Fetch the offer + product details from DB (validates ownership + accepted status)
3. Redirect to `/messages` if offer is invalid

This task handles state, fetching, and guard bypasses only — no UI yet.

- [ ] **Step 1: Add `offerId` to search params and `offerData` state**

In `src/pages/Checkout.tsx`, after the existing `const sellerId = searchParams.get('seller');` line, add:

```typescript
const offerId = searchParams.get('offerId');
```

After the existing state declarations, add the `OfferData` interface and state:

```typescript
interface OfferData {
  offerId: string;
  amount: number;
  product: {
    id: string;
    title: string;
    images: string[];
    price: number;
    size: string;
    brand: string | null;
    seller_id: string;
  };
  sellerName: string;
  sellerAvatar: string | null;
}

const [offerData, setOfferData] = useState<OfferData | null>(null);
const [offerLoading, setOfferLoading] = useState(false);
```

- [ ] **Step 2: Add useEffect to fetch offer**

After the existing `handleRemoveCoupon` function, add:

```typescript
// Offer mode: fetch offer data when offerId is present
useEffect(() => {
  if (!offerId || !user) return;

  const fetchOfferData = async () => {
    setOfferLoading(true);
    try {
      const { data: offerRow, error } = await supabase
        .from('offers')
        .select(`
          id, amount, status, sender_id, product_id,
          products(id, title, images, price, size, brand, seller_id)
        `)
        .eq('id', offerId)
        .eq('sender_id', user.id)
        .eq('status', 'accepted')
        .maybeSingle();

      if (error) throw error;

      if (!offerRow || !offerRow.products) {
        toast({
          title: 'Oferta não encontrada ou não está mais disponível',
          variant: 'destructive',
        });
        navigate('/messages');
        return;
      }

      const product = offerRow.products as OfferData['product'];

      // Fetch seller profile separately
      const { data: sellerProfile } = await supabase
        .from('public_profiles')
        .select('display_name, avatar_url')
        .eq('user_id', product.seller_id)
        .maybeSingle();

      setOfferData({
        offerId: offerRow.id,
        amount: offerRow.amount,
        product,
        sellerName: sellerProfile?.display_name || 'Vendedor',
        sellerAvatar: sellerProfile?.avatar_url || null,
      });
    } catch (err) {
      console.error('[Checkout] Error fetching offer:', err);
      toast({
        title: 'Erro ao carregar oferta',
        description: 'Tente novamente.',
        variant: 'destructive',
      });
      navigate('/messages');
    } finally {
      setOfferLoading(false);
    }
  };

  fetchOfferData();
}, [offerId, user?.id]);
```

- [ ] **Step 3: Update both redirect guards**

Find the `useEffect` guard (~line 386):
```typescript
useEffect(() => {
  if (!sellerId || !sellerGroup || sellerItems.length === 0) {
    navigate('/cart');
  }
}, [sellerId, sellerGroup, sellerItems.length, navigate]);
```

Replace with:
```typescript
useEffect(() => {
  if (!offerId && (!sellerId || !sellerGroup || sellerItems.length === 0)) {
    navigate('/cart');
  }
}, [offerId, sellerId, sellerGroup, sellerItems.length, navigate]);
```

Find the synchronous render guard (~line 392):
```typescript
if (!sellerId || !sellerGroup || sellerItems.length === 0) {
  return null;
}
```

Replace with:
```typescript
if (!offerId && (!sellerId || !sellerGroup || sellerItems.length === 0)) {
  return null;
}
```

- [ ] **Step 4: Add offer loading spinner**

Find the main `return (` statement of the component. Just before it, add a loading screen for offer mode:

```typescript
// Show spinner while loading offer data
if (offerId && offerLoading) {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <Loader2 className="w-8 h-8 animate-spin text-primary" />
    </div>
  );
}
```

- [ ] **Step 5: Manual verify — no crash on `/checkout?offerId=fake-id`**

Navigate to `http://localhost:8080/checkout?offerId=00000000-0000-0000-0000-000000000000` while logged in.

Expected: Spinner appears briefly, then toast "Oferta não encontrada ou não está mais disponível", redirect to `/messages`.

- [ ] **Step 6: Commit**

```bash
git add src/pages/Checkout.tsx
git commit -m "feat(checkout): add offer mode state, data fetching, and guard bypasses"
```

---

## Task 4: Checkout.tsx — offer mode UI and order creation

**Files:**
- Modify: `src/pages/Checkout.tsx`

### Background

When `offerData` is loaded, the checkout renders a different product section (single product at offer price, original price struck through, no coupon section). The confirm button calls `handleConfirmOfferOrder` which reserves the product, creates the order at `offerData.amount`, finds the existing conversation, sends an auto-message, and navigates back to the chat.

- [ ] **Step 1: Add `handleConfirmOfferOrder` function**

After the existing `handleConfirmOrder` function, add:

```typescript
const handleConfirmOfferOrder = async () => {
  if (!user || !offerData || submitting) return;

  setSubmitting(true);
  try {
    // Reserve product
    const { data: reservationResults, error: reserveError } = await supabase
      .rpc('reserve_product_for_checkout', {
        product_ids: [offerData.product.id],
        buyer_id: user.id,
      });

    if (reserveError) throw reserveError;

    const failedReservations = reservationResults?.filter(
      (r: { success: boolean }) => !r.success
    );
    if (failedReservations && failedReservations.length > 0) {
      toast({
        title: 'Produto indisponível',
        description: 'Este produto não está mais disponível.',
        variant: 'destructive',
      });
      navigate('/messages');
      return;
    }

    try {
      // Create order at offer price
      const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert({
          buyer_id: user.id,
          seller_id: offerData.product.seller_id,
          product_id: offerData.product.id,
          status: 'pending',
          delivery_method: selectedDelivery,
          total_price: offerData.amount,
          delivery_notes: deliveryNotes || null,
          delivery_address: null,
        })
        .select()
        .single();

      if (orderError) throw orderError;

      // Create order item at offer price
      const { error: itemsError } = await supabase
        .from('order_items')
        .insert([{
          order_id: order.id,
          product_id: offerData.product.id,
          title: offerData.product.title,
          price: offerData.amount,
          size: offerData.product.size,
          brand: offerData.product.brand,
          image: offerData.product.images?.[0] || null,
        }]);

      if (itemsError) throw itemsError;

      // Find existing conversation (was created when offer was made)
      const { data: existingConv } = await supabase
        .from('conversations')
        .select('id')
        .eq('product_id', offerData.product.id)
        .or(`participant_1.eq.${user.id},participant_2.eq.${user.id}`)
        .maybeSingle();

      if (existingConv?.id) {
        await supabase
          .from('messages')
          .insert({
            conversation_id: existingConv.id,
            sender_id: user.id,
            content: '🎉 Pedido confirmado! Oferta aceita. Podemos combinar o local e horário para a entrega?',
          });
      }

      toast({
        title: 'Pedido confirmado! 🎉',
        description: 'Combine a entrega com o vendedor pelo chat.',
      });

      if (existingConv?.id) {
        navigate(`/chat/${existingConv.id}`);
      } else {
        toast({
          title: 'Pedido criado!',
          description: 'Acesse "Minhas Compras" para acompanhar.',
        });
        navigate('/my-purchases');
      }
    } catch (orderCreationError) {
      // Rollback reservation
      await supabase.rpc('release_product_reservations', {
        product_ids: [offerData.product.id],
      });
      throw orderCreationError;
    }
  } catch (err) {
    console.error('[Checkout] Error creating offer order:', err);
    toast({
      title: 'Erro ao criar pedido',
      description: 'Tente novamente.',
      variant: 'destructive',
    });
  } finally {
    setSubmitting(false);
  }
};
```



- [ ] **Step 2: Add offer mode product section to the JSX**

In `Checkout.tsx`, find the `{/* Order Summary */}` comment block (~line 556). The entire `<div className="space-y-4">` that follows (lines ~557-596) must be replaced with the conditional below. `Package` is already imported.

Replace the `{/* Order Summary */}` block with:

```tsx
{offerId && offerData ? (
  /* Offer mode: single product at negotiated price */
  <div className="space-y-4">
    <h2 className="font-display text-lg font-semibold text-foreground">Produto</h2>
    <div className="rounded-xl bg-card border border-border/50 p-4">
      <div className="flex items-center gap-3">
        <div className="w-16 h-16 rounded-lg overflow-hidden bg-muted flex-shrink-0">
          {offerData.product.images?.[0] ? (
            <img
              src={offerData.product.images[0]}
              alt={offerData.product.title}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Package className="w-6 h-6 text-muted-foreground" />
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-medium truncate">{offerData.product.title}</p>
          {offerData.product.size && (
            <p className="text-xs text-muted-foreground">
              Tam. {offerData.product.size}
              {offerData.product.brand ? ` • ${offerData.product.brand}` : ''}
            </p>
          )}
          <div className="flex items-center gap-2 mt-1">
            <span className="text-sm text-muted-foreground line-through">
              R$ {offerData.product.price.toFixed(2).replace('.', ',')}
            </span>
            <span className="text-base font-bold text-primary">
              R$ {offerData.amount.toFixed(2).replace('.', ',')}
            </span>
          </div>
        </div>
      </div>
      <div className="mt-3 pt-3 border-t border-border/50 flex items-center justify-between">
        <span className="text-sm text-muted-foreground">Vendedor</span>
        <span className="text-sm font-medium">{offerData.sellerName}</span>
      </div>
    </div>
  </div>
) : (
  /* Normal cart mode: existing "Resumo do Pedido" block unchanged */
  <div className="space-y-4">
    <h2 className="font-display text-lg font-semibold text-foreground">
      Resumo do Pedido
    </h2>
    <div className="space-y-2">
      {sellerItems.map((item) => (
        <div key={item.id} className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-lg overflow-hidden bg-muted">
            <img src={item.image} alt={item.title} className="w-full h-full object-cover" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{item.title}</p>
            <p className="text-xs text-muted-foreground">Tam. {item.size}</p>
          </div>
          <p className="font-semibold">R$ {item.price}</p>
        </div>
      ))}
    </div>
    {appliedCoupon && discount > 0 && (
      <div className="space-y-1 pt-2 border-t border-border/50">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Subtotal</span>
          <span>R$ {subtotal.toFixed(2).replace('.', ',')}</span>
        </div>
        <div className="flex justify-between text-sm text-primary">
          <span>Desconto ({appliedCoupon.code})</span>
          <span>- R$ {discount.toFixed(2).replace('.', ',')}</span>
        </div>
      </div>
    )}
  </div>
)}
```

- [ ] **Step 3: Hide coupon section in offer mode**

Find the `{/* Coupon Section */}` block in `Checkout.tsx` (~line 480). It is a `<div className="space-y-3">` ending before `{/* Notes */}`. Wrap the entire block:

```tsx
{!offerId && (
  <div className="space-y-3">
    {/* ... existing coupon section JSX unchanged ... */}
  </div>
)}
```

- [ ] **Step 4: Update total display and confirm button**

**Total:** Find the bottom action area (~line 604). The `<p>` that shows `R$ {totalAmount.toFixed(2).replace('.', ',')}`. Change this one line to:

```tsx
R$ {(offerId && offerData ? offerData.amount : totalAmount).toFixed(2).replace('.', ',')}
```

**Confirm button:** Find the `<Button>` that calls `handleConfirmOrder` (~line 610). Replace it with:

```tsx
<Button
  className="w-full btn-primary h-14 text-base"
  onClick={offerId && offerData ? handleConfirmOfferOrder : handleConfirmOrder}
  disabled={submitting}
>
  {submitting ? (
    <>
      <Loader2 className="w-5 h-5 mr-2 animate-spin" />
      Processando...
    </>
  ) : (
    <>
      <Check className="w-5 h-5 mr-2" />
      {offerId && offerData ? 'Confirmar Pedido' : 'Confirmar ordem de compra'}
    </>
  )}
</Button>
```

In non-offer mode the text stays **"Confirmar ordem de compra"** — unchanged from today.

- [ ] **Step 5: Update header — title and seller name guard**

In `Checkout.tsx`, find the header block (~line 408-411):

```tsx
<h1 className="font-display text-xl font-semibold">Ordem de Compra</h1>
<p className="text-xs text-muted-foreground">{sellerGroup.sellerName}</p>
```

Replace with:

```tsx
<h1 className="font-display text-xl font-semibold">
  {offerId ? 'Finalizar Compra' : 'Ordem de Compra'}
</h1>
{!offerId && sellerGroup && (
  <p className="text-xs text-muted-foreground">{sellerGroup.sellerName}</p>
)}
```

**Critical:** In offer mode `sellerGroup` is `null`. Without the guard, `sellerGroup.sellerName` throws a TypeError at render time and the page crashes.

- [ ] **Step 6: Manual verify — full offer checkout flow**

End-to-end test:

1. As buyer: go to a product detail page, click chat icon, chat with seller, make an offer (e.g., R$ 40 on a R$ 50 product)
2. As seller: open that chat, accept the offer (click "Aceitar" on OfferCard)
3. As buyer: refresh the chat, see green banner with "Comprar por R$ 40,00" button, click it
4. Expected: arrive at `/checkout?offerId=<id>` — header "Finalizar Compra" with no seller subtitle, product shows R$ 50,00 struck through and R$ 40,00 in primary color, no coupon section, delivery options visible, total = R$ 40,00
5. Select delivery, click "Confirmar Pedido"
6. Expected: loading state, toast "Pedido confirmado!", redirect to `/chat/<conversationId>`
7. In chat: see auto-message "Pedido confirmado! Oferta aceita. Podemos combinar..."
8. As seller: see amber banner "Pedido aguardando confirmacao", confirm

Also verify: the product shows `reserved` status in Supabase dashboard.

- [ ] **Step 7: Commit**

```bash
git add src/pages/Checkout.tsx
git commit -m "feat(checkout): add offer mode UI and order creation at negotiated price"
```

---

## Final Verification Checklist

- [ ] Cenario 1 (pos-compra): chat nao mostra botao "Oferta"
- [ ] Cenario 1 (pos-compra): vendedor ve apenas 1 botao "Confirmar" (banner ambar)
- [ ] Cenario 2 (negociacao, oferta pendente): botao "Oferta" visivel no header
- [ ] Cenario 2 (oferta aceita): comprador ve banner verde com botao "Comprar por R$ X"
- [ ] Cenario 2 (oferta aceita): vendedor ve banner "Aguardando o comprador finalizar"
- [ ] Cenario 2 (oferta aceita, order ja existe): nenhum banner de oferta aparece
- [ ] Checkout modo oferta: header mostra "Finalizar Compra", sem subtitle de vendedor
- [ ] Checkout modo oferta: produto exibido com preco original riscado e oferta em destaque
- [ ] Checkout modo oferta: sem secao de cupom
- [ ] Checkout modo oferta: total = valor da oferta
- [ ] Checkout modo oferta: botao "Confirmar Pedido"
- [ ] Checkout modo normal: botao ainda diz "Confirmar ordem de compra"
- [ ] Checkout modo oferta: ordem criada com total_price = offer.amount
- [ ] Checkout modo oferta: auto-mensagem enviada no chat existente
- [ ] Checkout modo oferta: redireciona para /chat/:conversationId ao final
- [ ] URL invalida /checkout?offerId=fake: redireciona para /messages com toast

---
