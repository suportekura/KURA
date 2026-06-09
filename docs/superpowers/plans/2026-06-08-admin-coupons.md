# Admin Coupons — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Admin-created discount coupons applied before payment on boost and plan purchases, with full admin management UI.

**Architecture:** New `admin_coupons` + `admin_coupon_uses` tables; new `validate-coupon` edge function; reusable `CheckoutModal` component replaces inline payment-method selection in Boosts.tsx and Plans.tsx; four payment edge functions updated to re-validate and record coupon use server-side.

**Tech Stack:** React 18, TypeScript, Supabase (PostgreSQL + Edge Functions / Deno), shadcn/ui, Tailwind CSS, Pagar.me

---

## File Map

| Action | File | Purpose |
|--------|------|---------|
| Create | `supabase/migrations/20260608000001_admin_coupons.sql` | Tables + RLS |
| Create | `supabase/functions/validate-coupon/index.ts` | Coupon validation edge function |
| Create | `src/components/boost/CheckoutModal.tsx` | Coupon input + method selection modal |
| Create | `src/pages/admin/AdminCoupons.tsx` | Admin coupon list + form |
| Modify | `supabase/config.toml` | Register validate-coupon function |
| Modify | `supabase/functions/create-boost-payment/index.ts` | Accept + re-validate + record coupon |
| Modify | `supabase/functions/create-boost-payment-card/index.ts` | Same |
| Modify | `supabase/functions/create-plan-payment/index.ts` | Same |
| Modify | `supabase/functions/create-plan-payment-card/index.ts` | Same |
| Modify | `src/pages/Boosts.tsx` | Open CheckoutModal instead of direct payment |
| Modify | `src/pages/Plans.tsx` | Open CheckoutModal instead of direct payment |
| Modify | `src/pages/admin/AdminLayout.tsx` | Add Cupons nav item |
| Modify | `src/App.tsx` | Add /admin/coupons route |

---

## Task 1: Database Migration

**Files:**
- Create: `supabase/migrations/20260608000001_admin_coupons.sql`

- [ ] **Step 1: Create migration file**

```sql
-- admin_coupons: admin-created discount coupons for boost/plan purchases
CREATE TABLE public.admin_coupons (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT NOT NULL,
  discount_type TEXT NOT NULL CHECK (discount_type IN ('percentage', 'fixed')),
  discount_value NUMERIC NOT NULL CHECK (discount_value > 0),
  applies_to TEXT NOT NULL CHECK (applies_to IN (
    'boost_24h', 'boost_3d', 'boost_7d', 'all_boosts',
    'plan_plus', 'plan_loja', 'all_plans', 'all'
  )),
  max_uses INTEGER CHECK (max_uses IS NULL OR max_uses > 0),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT admin_coupons_code_unique UNIQUE (code),
  CONSTRAINT admin_coupons_percentage_max CHECK (
    discount_type != 'percentage' OR discount_value <= 100
  )
);

-- admin_coupon_uses: records each use (enforces one-use-per-user)
CREATE TABLE public.admin_coupon_uses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  coupon_id UUID NOT NULL REFERENCES public.admin_coupons(id),
  user_id UUID NOT NULL,
  payment_type TEXT NOT NULL CHECK (payment_type IN ('boost', 'plan')),
  payment_id UUID NOT NULL,
  discount_amount NUMERIC NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT admin_coupon_uses_one_per_user UNIQUE (coupon_id, user_id)
);

-- Enable RLS
ALTER TABLE public.admin_coupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_coupon_uses ENABLE ROW LEVEL SECURITY;

-- admin_coupons: only admins/moderators can read/write
CREATE POLICY "Admins can manage coupons"
ON public.admin_coupons FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'moderator')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'moderator')
  )
);

-- admin_coupon_uses: authenticated users can insert their own; admins read all
CREATE POLICY "Users can insert own coupon uses"
ON public.admin_coupon_uses FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can read coupon uses"
ON public.admin_coupon_uses FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'moderator')
  )
);
```

- [ ] **Step 2: Apply migration**

```bash
npx supabase db push
```

Expected: migration applied with no errors.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260608000001_admin_coupons.sql
git commit -m "feat(db): add admin_coupons and admin_coupon_uses tables"
```

---

## Task 2: validate-coupon Edge Function

**Files:**
- Create: `supabase/functions/validate-coupon/index.ts`
- Modify: `supabase/config.toml`

- [ ] **Step 1: Create the edge function**

```typescript
// supabase/functions/validate-coupon/index.ts
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";

function couponAppliesToProduct(couponAppliesTo: string, productKey: string): boolean {
  if (couponAppliesTo === "all") return true;
  if (couponAppliesTo === productKey) return true;
  if (couponAppliesTo === "all_boosts" && productKey.startsWith("boost_")) return true;
  if (couponAppliesTo === "all_plans" && productKey.startsWith("plan_")) return true;
  return false;
}

function calcDiscount(discountType: string, discountValue: number, amount: number): number {
  if (discountType === "percentage") {
    return Math.round((amount * discountValue / 100) * 100) / 100;
  }
  return Math.min(discountValue, amount - 0.01);
}

const handler = async (req: Request): Promise<Response> => {
  const origin = req.headers.get("origin");
  const corsHeaders = getCorsHeaders(origin);
  const preflightResponse = handleCorsPreflightRequest(req);
  if (preflightResponse) return preflightResponse;

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ valid: false, error: "Não autenticado" }), {
        status: 401, headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnon = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData } = await supabaseAnon.auth.getClaims(token);
    if (!claimsData?.claims) {
      return new Response(JSON.stringify({ valid: false, error: "Não autenticado" }), {
        status: 401, headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }
    const userId = claimsData.claims.sub as string;

    const { code, applies_to, amount } = await req.json();
    if (!code || !applies_to || !amount) {
      return new Response(JSON.stringify({ valid: false, error: "Parâmetros inválidos" }), {
        status: 400, headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch coupon
    const { data: coupon } = await supabase
      .from("admin_coupons")
      .select("id, code, discount_type, discount_value, applies_to, max_uses, expires_at, active")
      .eq("code", code.toUpperCase().trim())
      .maybeSingle();

    if (!coupon || !coupon.active) {
      return new Response(JSON.stringify({ valid: false, error: "Cupom inválido" }), {
        status: 200, headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    if (new Date(coupon.expires_at) < new Date()) {
      return new Response(JSON.stringify({ valid: false, error: "Cupom expirado" }), {
        status: 200, headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    if (!couponAppliesToProduct(coupon.applies_to, applies_to)) {
      return new Response(JSON.stringify({ valid: false, error: "Cupom não se aplica a este produto" }), {
        status: 200, headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Check max uses
    if (coupon.max_uses !== null) {
      const { count } = await supabase
        .from("admin_coupon_uses")
        .select("id", { count: "exact", head: true })
        .eq("coupon_id", coupon.id);
      if ((count ?? 0) >= coupon.max_uses) {
        return new Response(JSON.stringify({ valid: false, error: "Limite de usos atingido" }), {
          status: 200, headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }
    }

    // Check user already used
    const { data: existingUse } = await supabase
      .from("admin_coupon_uses")
      .select("id")
      .eq("coupon_id", coupon.id)
      .eq("user_id", userId)
      .maybeSingle();

    if (existingUse) {
      return new Response(JSON.stringify({ valid: false, error: "Cupom já utilizado" }), {
        status: 200, headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const discountAmount = calcDiscount(coupon.discount_type, coupon.discount_value, amount);
    const finalAmount = Math.max(0.01, amount - discountAmount);

    return new Response(JSON.stringify({
      valid: true,
      coupon_id: coupon.id,
      discount_type: coupon.discount_type,
      discount_value: coupon.discount_value,
      discount_amount: Math.round(discountAmount * 100) / 100,
      final_amount: Math.round(finalAmount * 100) / 100,
    }), {
      status: 200, headers: { "Content-Type": "application/json", ...corsHeaders },
    });

  } catch (error: unknown) {
    console.error("[validate-coupon] Error:", error);
    return new Response(JSON.stringify({ valid: false, error: "Erro interno" }), {
      status: 500, headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
};

serve(handler);
```

- [ ] **Step 2: Register in config.toml**

Add inside `supabase/config.toml` alongside the other `[functions.xxx]` entries:

```toml
[functions.validate-coupon]
verify_jwt = false
```

- [ ] **Step 3: Commit**

```bash
git add supabase/functions/validate-coupon/index.ts supabase/config.toml
git commit -m "feat(functions): add validate-coupon edge function"
```

---

## Task 3: CheckoutModal Component

**Files:**
- Create: `src/components/boost/CheckoutModal.tsx`

This modal replaces inline payment-method selection in Boosts.tsx and Plans.tsx. It shows coupon input + discounted price + PIX/Card buttons.

- [ ] **Step 1: Create the component**

```tsx
// src/components/boost/CheckoutModal.tsx
import { useState, useCallback } from 'react';
import { Tag, X, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';

export interface CouponData {
  couponId: string;
  discountAmount: number;
  finalAmount: number;
}

interface CheckoutModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  appliesTo: string; // e.g. 'boost_24h', 'plan_plus'
  originalAmount: number;
  loading?: boolean;
  onPayPix: (finalAmount: number, coupon?: CouponData) => void;
  onPayCard: (finalAmount: number, coupon?: CouponData) => void;
}

export function CheckoutModal({
  open,
  onOpenChange,
  title,
  description,
  appliesTo,
  originalAmount,
  loading = false,
  onPayPix,
  onPayCard,
}: CheckoutModalProps) {
  const [couponCode, setCouponCode] = useState('');
  const [couponData, setCouponData] = useState<CouponData | null>(null);
  const [couponError, setCouponError] = useState('');
  const [validating, setValidating] = useState(false);

  const finalAmount = couponData ? couponData.finalAmount : originalAmount;

  const handleApplyCoupon = useCallback(async () => {
    if (!couponCode.trim()) return;
    setValidating(true);
    setCouponError('');
    setCouponData(null);
    try {
      const { data, error } = await supabase.functions.invoke('validate-coupon', {
        body: { code: couponCode.trim(), applies_to: appliesTo, amount: originalAmount },
      });
      if (error || !data?.valid) {
        setCouponError(data?.error || 'Cupom inválido');
      } else {
        setCouponData({
          couponId: data.coupon_id,
          discountAmount: data.discount_amount,
          finalAmount: data.final_amount,
        });
      }
    } catch {
      setCouponError('Erro ao validar cupom');
    } finally {
      setValidating(false);
    }
  }, [couponCode, appliesTo, originalAmount]);

  const handleRemoveCoupon = () => {
    setCouponData(null);
    setCouponCode('');
    setCouponError('');
  };

  const handleClose = (val: boolean) => {
    if (!val) {
      setCouponCode('');
      setCouponData(null);
      setCouponError('');
    }
    onOpenChange(val);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-sm rounded-2xl border-border/30 p-0 gap-0 overflow-hidden">
        <div className="px-6 pt-6 pb-4">
          <DialogHeader>
            <DialogTitle className="text-base">{title}</DialogTitle>
            {description && (
              <DialogDescription className="text-xs mt-1">{description}</DialogDescription>
            )}
          </DialogHeader>
        </div>

        {/* Price */}
        <div className="px-6 pb-4">
          <div className="flex items-baseline gap-2">
            {couponData && (
              <span className="text-sm text-muted-foreground line-through">
                R$ {originalAmount.toFixed(2).replace('.', ',')}
              </span>
            )}
            <span className="text-2xl font-bold text-foreground">
              R$ {finalAmount.toFixed(2).replace('.', ',')}
            </span>
            {couponData && (
              <span className="text-xs text-green-600 font-medium">
                -{((couponData.discountAmount / originalAmount) * 100).toFixed(0)}%
              </span>
            )}
          </div>
        </div>

        {/* Coupon input */}
        <div className="px-6 pb-4">
          {couponData ? (
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800">
              <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
              <span className="text-xs text-green-700 dark:text-green-400 flex-1">
                Cupom <strong>{couponCode.toUpperCase()}</strong> aplicado — economia de R$ {couponData.discountAmount.toFixed(2).replace('.', ',')}
              </span>
              <button onClick={handleRemoveCoupon} className="text-muted-foreground hover:text-foreground">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Tag className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <Input
                  className="pl-8 rounded-xl text-sm uppercase"
                  placeholder="Código do cupom"
                  value={couponCode}
                  onChange={(e) => { setCouponCode(e.target.value); setCouponError(''); }}
                  onKeyDown={(e) => e.key === 'Enter' && handleApplyCoupon()}
                  disabled={validating}
                />
              </div>
              <Button
                variant="outline"
                size="sm"
                className="rounded-xl shrink-0"
                onClick={handleApplyCoupon}
                disabled={!couponCode.trim() || validating}
              >
                {validating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Aplicar'}
              </Button>
            </div>
          )}
          {couponError && (
            <div className="flex items-center gap-1.5 mt-2">
              <AlertCircle className="w-3.5 h-3.5 text-destructive shrink-0" />
              <p className="text-xs text-destructive">{couponError}</p>
            </div>
          )}
        </div>

        {/* Payment buttons */}
        <div className="px-6 pb-6 flex flex-col gap-2">
          <Button
            className="w-full rounded-xl"
            onClick={() => onPayPix(finalAmount, couponData ?? undefined)}
            disabled={loading}
          >
            {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
            Pagar com PIX
          </Button>
          <Button
            variant="outline"
            className="w-full rounded-xl"
            onClick={() => onPayCard(finalAmount, couponData ?? undefined)}
            disabled={loading}
          >
            Pagar com Cartão
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Verify it compiles**

```bash
npm run build 2>&1 | grep -E "error|Error"
```

Expected: no TypeScript errors for the new file.

- [ ] **Step 3: Commit**

```bash
git add src/components/boost/CheckoutModal.tsx
git commit -m "feat(ui): add CheckoutModal with coupon input and method selection"
```

---

## Task 4: Boosts.tsx — Integrate CheckoutModal

**Files:**
- Modify: `src/pages/Boosts.tsx`

- [ ] **Step 1: Add import and checkoutModal state**

At the top of `Boosts.tsx`, add import:

```tsx
import { CheckoutModal, type CouponData } from '@/components/boost/CheckoutModal';
```

Add state after existing state declarations (around line 128):

```tsx
const [checkoutModal, setCheckoutModal] = useState<{
  open: boolean;
  boostType: string;
  amount: number;
  quantity: number;
} | null>(null);
```

- [ ] **Step 2: Replace inline payment trigger with checkout modal**

Find the block inside `handleActivateBoost` that currently handles `!selectedProduct` PIX + card (lines ~222-254). Replace it:

```tsx
// If no product selected, open checkout modal for credit purchase
if (!selectedProduct) {
  const quantity = option.type === 'monthly' ? 5 : 1;
  const amount = quantity === 5 ? BOOST_PRICES_PACKAGE[option.boostType] : BOOST_PRICES_SINGLE[option.boostType];
  setCheckoutModal({
    open: true,
    boostType: option.boostType,
    amount: amount ?? optionPrice,
    quantity,
  });
  return;
}
```

Add the price maps near the top of the component (after existing state):

```tsx
const BOOST_PRICES_SINGLE: Record<string, number> = { '24h': 5.00, '3d': 9.90, '7d': 14.90 };
const BOOST_PRICES_PACKAGE: Record<string, number> = { '24h': 19.90, '3d': 39.90, '7d': 59.90 };
```

- [ ] **Step 3: Add handleCheckoutPix and handleCheckoutCard handlers**

Add these functions after `refetchCredits`:

```tsx
const handleCheckoutPix = async (finalAmount: number, coupon?: CouponData) => {
  if (!checkoutModal) return;
  setBuyingBoost(`${checkoutModal.boostType}_pix`);
  try {
    const { data, error } = await supabase.functions.invoke('create-boost-payment', {
      body: {
        boost_type: checkoutModal.boostType,
        quantity: checkoutModal.quantity,
        amount_override: finalAmount,
        coupon_id: coupon?.couponId ?? null,
        discount_amount: coupon?.discountAmount ?? null,
      },
    });
    if (error || !data?.success) {
      toast({ title: 'Erro ao gerar pagamento', description: data?.error || error?.message || 'Tente novamente.', variant: 'destructive' });
      return;
    }
    setCheckoutModal(null);
    setPixModal({
      open: true,
      paymentId: data.paymentId,
      qrcode: data.qrcode || '',
      qrcodeUrl: data.qrcode_url || data.qrcode || '',
      payload: data.payload,
      expiration: data.expiration,
      amount: data.amount,
      boostType: checkoutModal.boostType,
    });
  } catch (err: any) {
    toast({ title: 'Erro ao gerar PIX', description: err.message, variant: 'destructive' });
  } finally {
    setBuyingBoost(null);
  }
};

const handleCheckoutCard = (finalAmount: number, coupon?: CouponData) => {
  if (!checkoutModal) return;
  setCheckoutModal(null);
  setCardModal({
    open: true,
    boostType: checkoutModal.boostType,
    amount: finalAmount,
    quantity: checkoutModal.quantity,
    couponId: coupon?.couponId,
    discountAmount: coupon?.discountAmount,
  });
};
```

- [ ] **Step 4: Update cardModal state type to include coupon fields**

Find the `cardModal` state declaration and update its type:

```tsx
const [cardModal, setCardModal] = useState<{
  open: boolean;
  boostType: string;
  amount: number;
  quantity: number;
  couponId?: string;
  discountAmount?: number;
} | null>(null);
```

- [ ] **Step 5: Pass coupon data to CreditCardPaymentModal**

Find the `CreditCardPaymentModal` usage in the JSX and update `edgeFunctionBody`:

```tsx
edgeFunctionBody={{
  boost_type: cardModal.boostType,
  quantity: cardModal.quantity,
  amount_override: cardModal.amount,
  coupon_id: cardModal.couponId ?? null,
  discount_amount: cardModal.discountAmount ?? null,
}}
```

- [ ] **Step 6: Add CheckoutModal to JSX**

Before the closing `</div>` at the end of the return, add:

```tsx
{checkoutModal && (
  <CheckoutModal
    open={checkoutModal.open}
    onOpenChange={(open) => { if (!open) setCheckoutModal(null); }}
    title={`Boost ${checkoutModal.boostType === '24h' ? '24 horas' : checkoutModal.boostType === '3d' ? '3 dias' : '7 dias'}`}
    description={checkoutModal.quantity === 5 ? 'Pacote com 5 boosts' : undefined}
    appliesTo={`boost_${checkoutModal.boostType}`}
    originalAmount={checkoutModal.amount}
    loading={!!buyingBoost}
    onPayPix={handleCheckoutPix}
    onPayCard={handleCheckoutCard}
  />
)}
```

- [ ] **Step 7: Verify in browser**

```bash
npm run dev
```

Open `/boosts`, click a boost option → CheckoutModal should open with coupon field and payment buttons.

- [ ] **Step 8: Commit**

```bash
git add src/pages/Boosts.tsx
git commit -m "feat(boosts): open CheckoutModal before payment with coupon support"
```

---

## Task 5: create-boost-payment — Server-side Coupon

**Files:**
- Modify: `supabase/functions/create-boost-payment/index.ts`

- [ ] **Step 1: Add coupon helper function at the top (after imports)**

```typescript
function couponAppliesToProduct(couponAppliesTo: string, productKey: string): boolean {
  if (couponAppliesTo === "all") return true;
  if (couponAppliesTo === productKey) return true;
  if (couponAppliesTo === "all_boosts" && productKey.startsWith("boost_")) return true;
  if (couponAppliesTo === "all_plans" && productKey.startsWith("plan_")) return true;
  return false;
}
```

- [ ] **Step 2: Read coupon fields from request body**

Find the line that parses the request body:

```typescript
const { boost_type, quantity: reqQuantity, amount_override } = await req.json();
```

Replace with:

```typescript
const { boost_type, quantity: reqQuantity, amount_override, coupon_id, discount_amount: clientDiscount } = await req.json();
```

- [ ] **Step 3: Add server-side coupon re-validation before Pagar.me call**

After the `amountInCents` calculation and before the Pagar.me order creation, add:

```typescript
let validatedCouponId: string | null = null;
let serverDiscount = 0;

if (coupon_id) {
  const { data: coupon } = await supabase
    .from("admin_coupons")
    .select("id, discount_type, discount_value, applies_to, max_uses, expires_at, active")
    .eq("id", coupon_id)
    .maybeSingle();

  const isValid = coupon &&
    coupon.active &&
    new Date(coupon.expires_at) > new Date() &&
    couponAppliesToProduct(coupon.applies_to, `boost_${boost_type}`);

  if (isValid) {
    // Check max uses
    let usesOk = true;
    if (coupon.max_uses !== null) {
      const { count } = await supabase
        .from("admin_coupon_uses")
        .select("id", { count: "exact", head: true })
        .eq("coupon_id", coupon.id);
      usesOk = (count ?? 0) < coupon.max_uses;
    }
    // Check user already used
    const { data: existingUse } = await supabase
      .from("admin_coupon_uses")
      .select("id")
      .eq("coupon_id", coupon.id)
      .eq("user_id", userId)
      .maybeSingle();

    if (usesOk && !existingUse) {
      validatedCouponId = coupon.id;
      if (coupon.discount_type === "percentage") {
        serverDiscount = amount * (coupon.discount_value / 100);
      } else {
        serverDiscount = Math.min(coupon.discount_value, amount - 0.01);
      }
    }
  }
}

const finalAmount = validatedCouponId ? Math.max(0.01, amount - serverDiscount) : amount;
const finalAmountInCents = Math.round(finalAmount * 100);
```

- [ ] **Step 4: Use finalAmountInCents in Pagar.me payload**

Find the `orderPayload` items array and replace `amount: amountInCents` with `amount: finalAmountInCents`.

- [ ] **Step 5: Record coupon use after successful payment insert**

After the `boost_payments` insert succeeds, add:

```typescript
if (validatedCouponId && payment?.id) {
  await supabase.from("admin_coupon_uses").insert({
    coupon_id: validatedCouponId,
    user_id: userId,
    payment_type: "boost",
    payment_id: payment.id,
    discount_amount: Math.round(serverDiscount * 100) / 100,
  });
}
```

- [ ] **Step 6: Return finalAmount in response**

In the success response, update `amount` to return `finalAmount` instead of `amount`:

```typescript
amount: finalAmount,
```

- [ ] **Step 7: Commit**

```bash
git add supabase/functions/create-boost-payment/index.ts
git commit -m "feat(functions): add server-side coupon validation to create-boost-payment"
```

---

## Task 6: create-boost-payment-card — Server-side Coupon

**Files:**
- Modify: `supabase/functions/create-boost-payment-card/index.ts`

- [ ] **Step 1: Read create-boost-payment-card to understand its structure**

```bash
cat supabase/functions/create-boost-payment-card/index.ts
```

- [ ] **Step 2: Apply the same coupon helper and validation pattern as Task 5**

Add `couponAppliesToProduct` helper at top (identical to Task 5).

Parse `coupon_id` and `discount_amount` from request body.

Add server-side coupon re-validation block (identical logic to Task 5 — copy it).

Use `finalAmountInCents` in Pagar.me payload instead of `amountInCents`.

After successful `boost_payments` insert, record in `admin_coupon_uses` (identical to Task 5).

Return `finalAmount` in the success response.

- [ ] **Step 3: Commit**

```bash
git add supabase/functions/create-boost-payment-card/index.ts
git commit -m "feat(functions): add server-side coupon validation to create-boost-payment-card"
```

---

## Task 7: Plans.tsx — Integrate CheckoutModal

**Files:**
- Modify: `src/pages/Plans.tsx`

- [ ] **Step 1: Add import**

```tsx
import { CheckoutModal, type CouponData } from '@/components/boost/CheckoutModal';
```

- [ ] **Step 2: Add checkoutModal state**

```tsx
const [checkoutModal, setCheckoutModal] = useState<{
  open: boolean;
  planId: string;
  amount: number;
  billing: BillingCycle;
} | null>(null);
```

- [ ] **Step 3: Replace handleBuyPlan to open CheckoutModal instead**

Find `handleBuyPlan` and replace its body:

```tsx
const handleBuyPlan = (planId: string, _paymentMethod?: string) => {
  if (!user) {
    toast({ title: 'Faça login para continuar', variant: 'destructive' });
    navigate('/auth');
    return;
  }
  const amount = pricing[planId]?.[billing] ?? 0;
  setCheckoutModal({ open: true, planId, amount, billing });
};
```

- [ ] **Step 4: Add handleCheckoutPix and handleCheckoutCard for plans**

```tsx
const handleCheckoutPix = async (finalAmount: number, coupon?: CouponData) => {
  if (!checkoutModal) return;
  setBuyingPlan(checkoutModal.planId);
  try {
    const { data, error } = await supabase.functions.invoke('create-plan-payment', {
      body: {
        plan_type: checkoutModal.planId,
        billing_cycle: checkoutModal.billing,
        amount_override: finalAmount,
        coupon_id: coupon?.couponId ?? null,
        discount_amount: coupon?.discountAmount ?? null,
      },
    });
    if (error || !data?.success) {
      toast({ title: 'Erro ao gerar pagamento', description: data?.error || error?.message || 'Tente novamente.', variant: 'destructive' });
      return;
    }
    setCheckoutModal(null);
    setPixModal({
      open: true,
      paymentId: data.paymentId,
      qrcodeUrl: data.qrcode_url || '',
      payload: data.payload,
      expiration: data.expiration,
      amount: data.amount,
      planType: checkoutModal.planId,
      billingCycle: checkoutModal.billing,
    });
  } catch (err: any) {
    toast({ title: 'Erro ao gerar PIX', description: err.message, variant: 'destructive' });
  } finally {
    setBuyingPlan(null);
  }
};

const handleCheckoutCard = (finalAmount: number, coupon?: CouponData) => {
  if (!checkoutModal) return;
  setCheckoutModal(null);
  setCardModal({
    open: true,
    planType: checkoutModal.planId,
    billingCycle: checkoutModal.billing,
    amount: finalAmount,
    couponId: coupon?.couponId,
    discountAmount: coupon?.discountAmount,
  });
};
```

- [ ] **Step 5: Update cardModal state type**

```tsx
const [cardModal, setCardModal] = useState<{
  open: boolean;
  planType: string;
  billingCycle: BillingCycle;
  amount: number;
  couponId?: string;
  discountAmount?: number;
} | null>(null);
```

- [ ] **Step 6: Pass coupon to CreditCardPaymentModal**

```tsx
edgeFunctionBody={{
  plan_type: cardModal.planType,
  billing_cycle: cardModal.billingCycle,
  amount_override: cardModal.amount,
  coupon_id: cardModal.couponId ?? null,
  discount_amount: cardModal.discountAmount ?? null,
}}
```

- [ ] **Step 7: Add CheckoutModal to JSX**

```tsx
{checkoutModal && (
  <CheckoutModal
    open={checkoutModal.open}
    onOpenChange={(open) => { if (!open) setCheckoutModal(null); }}
    title={`Plano ${checkoutModal.planId === 'plus' ? 'Vendedor Plus' : 'Loja Oficial'}`}
    description={checkoutModal.billing === 'annual' ? 'Cobrança anual' : 'Cobrança mensal'}
    appliesTo={`plan_${checkoutModal.planId}`}
    originalAmount={checkoutModal.amount}
    loading={!!buyingPlan}
    onPayPix={handleCheckoutPix}
    onPayCard={handleCheckoutCard}
  />
)}
```

- [ ] **Step 8: Commit**

```bash
git add src/pages/Plans.tsx
git commit -m "feat(plans): open CheckoutModal before payment with coupon support"
```

---

## Task 8: create-plan-payment — Server-side Coupon

**Files:**
- Modify: `supabase/functions/create-plan-payment/index.ts`

- [ ] **Step 1: Apply same coupon pattern as Task 5**

Add `couponAppliesToProduct` helper.

Parse `coupon_id` from request body:
```typescript
const { plan_type, billing_cycle, amount_override, coupon_id } = await req.json();
```

Add server-side coupon re-validation (use `plan_${plan_type}` as productKey).

Use `finalAmountInCents` in Pagar.me payload.

After successful `plan_payments` insert, record in `admin_coupon_uses`:
```typescript
if (validatedCouponId && payment?.id) {
  await supabase.from("admin_coupon_uses").insert({
    coupon_id: validatedCouponId,
    user_id: userId,
    payment_type: "plan",
    payment_id: payment.id,
    discount_amount: Math.round(serverDiscount * 100) / 100,
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add supabase/functions/create-plan-payment/index.ts
git commit -m "feat(functions): add server-side coupon validation to create-plan-payment"
```

---

## Task 9: create-plan-payment-card — Server-side Coupon

**Files:**
- Modify: `supabase/functions/create-plan-payment-card/index.ts`

- [ ] **Step 1: Apply same coupon pattern as Task 8**

Same as Task 8: add helper, parse `coupon_id`, re-validate, use `finalAmountInCents`, record use after insert.

- [ ] **Step 2: Commit**

```bash
git add supabase/functions/create-plan-payment-card/index.ts
git commit -m "feat(functions): add server-side coupon validation to create-plan-payment-card"
```

---

## Task 10: AdminCoupons Page

**Files:**
- Create: `src/pages/admin/AdminCoupons.tsx`

- [ ] **Step 1: Create the page**

```tsx
// src/pages/admin/AdminCoupons.tsx
import { useEffect, useState, useCallback } from 'react';
import { Plus, Tag, Pencil, ToggleLeft, ToggleRight, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Coupon {
  id: string;
  code: string;
  discount_type: 'percentage' | 'fixed';
  discount_value: number;
  applies_to: string;
  max_uses: number | null;
  expires_at: string;
  active: boolean;
  created_at: string;
  uses_count?: number;
}

const APPLIES_TO_LABEL: Record<string, string> = {
  boost_24h: 'Boost 24h',
  boost_3d: 'Boost 3 dias',
  boost_7d: 'Boost 7 dias',
  all_boosts: 'Todos os boosts',
  plan_plus: 'Plano Plus',
  plan_loja: 'Plano Loja',
  all_plans: 'Todos os planos',
  all: 'Tudo',
};

function couponStatus(c: Coupon): 'active' | 'expired' | 'inactive' {
  if (!c.active) return 'inactive';
  if (new Date(c.expires_at) < new Date()) return 'expired';
  return 'active';
}

const emptyForm = {
  code: '',
  discount_type: 'percentage' as 'percentage' | 'fixed',
  discount_value: '',
  applies_to: 'all_boosts',
  max_uses: '',
  unlimited: true,
  expires_at: '',
  active: true,
};

export default function AdminCoupons() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const fetchCoupons = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('admin_coupons')
      .select('*')
      .order('created_at', { ascending: false });

    if (data) {
      // Get use counts
      const withCounts = await Promise.all(
        data.map(async (c) => {
          const { count } = await supabase
            .from('admin_coupon_uses')
            .select('id', { count: 'exact', head: true })
            .eq('coupon_id', c.id);
          return { ...c, uses_count: count ?? 0 };
        })
      );
      setCoupons(withCounts);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchCoupons(); }, [fetchCoupons]);

  const generateCode = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    const code = Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
    setForm(f => ({ ...f, code }));
  };

  const openCreate = () => {
    setEditId(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (c: Coupon) => {
    setEditId(c.id);
    setForm({
      code: c.code,
      discount_type: c.discount_type,
      discount_value: String(c.discount_value),
      applies_to: c.applies_to,
      max_uses: c.max_uses ? String(c.max_uses) : '',
      unlimited: c.max_uses === null,
      expires_at: c.expires_at.slice(0, 16),
      active: c.active,
    });
    setDialogOpen(true);
  };

  const handleToggleActive = async (c: Coupon) => {
    await supabase.from('admin_coupons').update({ active: !c.active }).eq('id', c.id);
    fetchCoupons();
  };

  const handleSave = async () => {
    if (!form.code || !form.discount_value || !form.expires_at || !form.applies_to) {
      toast({ title: 'Preencha todos os campos obrigatórios', variant: 'destructive' });
      return;
    }
    const discountVal = parseFloat(form.discount_value);
    if (isNaN(discountVal) || discountVal <= 0) {
      toast({ title: 'Valor de desconto inválido', variant: 'destructive' });
      return;
    }
    if (form.discount_type === 'percentage' && discountVal > 100) {
      toast({ title: 'Desconto percentual não pode ser maior que 100%', variant: 'destructive' });
      return;
    }
    setSaving(true);
    const payload = {
      code: form.code.toUpperCase().trim(),
      discount_type: form.discount_type,
      discount_value: discountVal,
      applies_to: form.applies_to,
      max_uses: form.unlimited ? null : (parseInt(form.max_uses) || null),
      expires_at: new Date(form.expires_at).toISOString(),
      active: form.active,
      ...(editId ? {} : { created_by: user!.id }),
    };
    const { error } = editId
      ? await supabase.from('admin_coupons').update(payload).eq('id', editId)
      : await supabase.from('admin_coupons').insert(payload);
    setSaving(false);
    if (error) {
      toast({ title: 'Erro ao salvar cupom', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: editId ? 'Cupom atualizado!' : 'Cupom criado!' });
    setDialogOpen(false);
    fetchCoupons();
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Cupons</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Gerencie cupons de desconto para boosts e planos</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchCoupons}><RefreshCw className="w-3.5 h-3.5 mr-1.5" />Atualizar</Button>
          <Button size="sm" onClick={openCreate}><Plus className="w-3.5 h-3.5 mr-1.5" />Novo cupom</Button>
        </div>
      </div>

      <div className="rounded-xl border border-border/50 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Código</TableHead>
              <TableHead>Desconto</TableHead>
              <TableHead>Aplica-se a</TableHead>
              <TableHead>Usos</TableHead>
              <TableHead>Validade</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-20">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Carregando...</TableCell></TableRow>
            ) : coupons.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Nenhum cupom criado</TableCell></TableRow>
            ) : coupons.map(c => {
              const status = couponStatus(c);
              return (
                <TableRow key={c.id}>
                  <TableCell><code className="text-sm font-mono bg-muted px-1.5 py-0.5 rounded">{c.code}</code></TableCell>
                  <TableCell className="text-sm">
                    {c.discount_type === 'percentage' ? `${c.discount_value}%` : `R$ ${c.discount_value.toFixed(2).replace('.', ',')}`}
                  </TableCell>
                  <TableCell className="text-sm">{APPLIES_TO_LABEL[c.applies_to] ?? c.applies_to}</TableCell>
                  <TableCell className="text-sm">{c.uses_count ?? 0}{c.max_uses ? ` / ${c.max_uses}` : ''}</TableCell>
                  <TableCell className="text-sm">{format(new Date(c.expires_at), 'dd/MM/yy HH:mm', { locale: ptBR })}</TableCell>
                  <TableCell>
                    <Badge variant={status === 'active' ? 'default' : 'secondary'} className="text-xs">
                      {status === 'active' ? 'Ativo' : status === 'expired' ? 'Expirado' : 'Desativado'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(c)}>
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleToggleActive(c)}>
                        {c.active ? <ToggleRight className="w-3.5 h-3.5 text-primary" /> : <ToggleLeft className="w-3.5 h-3.5 text-muted-foreground" />}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Tag className="w-4 h-4" />
              {editId ? 'Editar cupom' : 'Novo cupom'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Código *</Label>
              <div className="flex gap-2">
                <Input
                  className="uppercase"
                  placeholder="EX: BOOST20"
                  value={form.code}
                  onChange={e => setForm(f => ({ ...f, code: e.target.value.toUpperCase() }))}
                />
                <Button type="button" variant="outline" size="sm" className="shrink-0" onClick={generateCode}>
                  Gerar
                </Button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Tipo</Label>
                <Select value={form.discount_type} onValueChange={v => setForm(f => ({ ...f, discount_type: v as 'percentage' | 'fixed' }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percentage">Percentual (%)</SelectItem>
                    <SelectItem value="fixed">Fixo (R$)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Valor *</Label>
                <Input
                  type="number"
                  min="0.01"
                  max={form.discount_type === 'percentage' ? '100' : undefined}
                  step="0.01"
                  placeholder={form.discount_type === 'percentage' ? '20' : '5.00'}
                  value={form.discount_value}
                  onChange={e => setForm(f => ({ ...f, discount_value: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Aplica-se a *</Label>
              <Select value={form.applies_to} onValueChange={v => setForm(f => ({ ...f, applies_to: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(APPLIES_TO_LABEL).map(([v, l]) => (
                    <SelectItem key={v} value={v}>{l}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label>Limite de usos</Label>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Ilimitado</span>
                  <Switch checked={form.unlimited} onCheckedChange={v => setForm(f => ({ ...f, unlimited: v, max_uses: '' }))} />
                </div>
              </div>
              {!form.unlimited && (
                <Input
                  type="number"
                  min="1"
                  placeholder="100"
                  value={form.max_uses}
                  onChange={e => setForm(f => ({ ...f, max_uses: e.target.value }))}
                />
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Validade *</Label>
              <Input
                type="datetime-local"
                value={form.expires_at}
                onChange={e => setForm(f => ({ ...f, expires_at: e.target.value }))}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label>Ativo</Label>
              <Switch checked={form.active} onCheckedChange={v => setForm(f => ({ ...f, active: v }))} />
            </div>
          </div>
          <DialogFooter className="mt-2">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Salvando...' : editId ? 'Salvar' : 'Criar cupom'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/admin/AdminCoupons.tsx
git commit -m "feat(admin): add AdminCoupons page with list and create/edit form"
```

---

## Task 11: Route + Nav Link

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/pages/admin/AdminLayout.tsx`

- [ ] **Step 1: Add lazy import in App.tsx**

Find the admin lazy imports block (around line 60) and add:

```tsx
const AdminCoupons = lazy(() => import("./pages/admin/AdminCoupons"));
```

- [ ] **Step 2: Add route in App.tsx**

Find the admin routes block (around line 264) and add after the subscriptions route:

```tsx
<Route path="coupons" element={<AdminCoupons />} />
```

- [ ] **Step 3: Add nav item in AdminLayout.tsx**

Find the `navItems` array and add:

```tsx
{ icon: Tag, label: 'Cupons', href: '/admin/coupons' },
```

Also add `Tag` to the lucide-react import at the top of AdminLayout.tsx.

- [ ] **Step 4: Verify in browser**

```bash
npm run dev
```

Open `/admin/coupons` → page should load with the coupon table and "Novo cupom" button.

- [ ] **Step 5: Commit**

```bash
git add src/App.tsx src/pages/admin/AdminLayout.tsx
git commit -m "feat(admin): add /admin/coupons route and nav link"
```

---

## Task 12: Deploy Edge Functions

- [ ] **Step 1: Deploy validate-coupon**

```bash
npx supabase functions deploy validate-coupon --project-ref mfkmtmduspgckogfxggx
```

Expected: `Deployed Functions on project mfkmtmduspgckogfxggx: validate-coupon`

- [ ] **Step 2: Re-deploy the four modified payment functions**

```bash
npx supabase functions deploy create-boost-payment --project-ref mfkmtmduspgckogfxggx
npx supabase functions deploy create-boost-payment-card --project-ref mfkmtmduspgckogfxggx
npx supabase functions deploy create-plan-payment --project-ref mfkmtmduspgckogfxggx
npx supabase functions deploy create-plan-payment-card --project-ref mfkmtmduspgckogfxggx
```

- [ ] **Step 3: Push frontend to trigger Vercel deploy**

```bash
git push origin fix/pix-webhook-charge-id
```

Then create and merge PR to main on suportekura/KURA.

- [ ] **Step 4: End-to-end test**

1. In admin panel `/admin/coupons`, create a coupon: code `TESTE20`, 20%, applies to `Boost 24h`, max uses 10, expires tomorrow
2. In `/boosts`, click a 24h boost option → CheckoutModal opens
3. Enter `TESTE20` → click Aplicar → price shows R$5,00 ~~R$4,00~~ with -20%
4. Click Pagar com PIX → QR code appears with R$4,00
5. Confirm boost credited in `user_boosts` and use recorded in `admin_coupon_uses`
