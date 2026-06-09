# Admin Coupons — Design Spec

**Date:** 2026-06-08
**Status:** Approved

## Overview

Admin-created discount coupons for boost and plan purchases. Admins create coupon campaigns with percentage or fixed discounts, usage limits, expiration dates, and product scope. Users enter a coupon code before selecting their payment method and see the discounted price before paying.

---

## Database

### `admin_coupons`

```sql
CREATE TABLE public.admin_coupons (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  discount_type TEXT NOT NULL CHECK (discount_type IN ('percentage', 'fixed')),
  discount_value NUMERIC NOT NULL,
  applies_to TEXT NOT NULL CHECK (applies_to IN (
    'boost_24h', 'boost_3d', 'boost_7d', 'all_boosts',
    'plan_plus', 'plan_loja', 'all_plans', 'all'
  )),
  max_uses INTEGER, -- NULL = unlimited
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
```

### `admin_coupon_uses`

```sql
CREATE TABLE public.admin_coupon_uses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  coupon_id UUID NOT NULL REFERENCES public.admin_coupons(id),
  user_id UUID NOT NULL,
  payment_type TEXT NOT NULL CHECK (payment_type IN ('boost', 'plan')),
  payment_id UUID NOT NULL,
  discount_amount NUMERIC NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (coupon_id, user_id)
);
```

**RLS:**
- `admin_coupons`: read/write only for `admin` role; no user access
- `admin_coupon_uses`: insert by authenticated users (own rows); read by admin only

---

## Edge Functions

### New: `validate-coupon`

**POST** — public (JWT required)

**Body:** `{ code: string, applies_to: string, amount: number }`

**Validates:**
1. Coupon exists and `active = true`
2. `expires_at` > now()
3. `applies_to` matches the requested product (e.g. `boost_24h` matches `boost_24h`, `all_boosts`, `all`)
4. `max_uses` not reached (count of `admin_coupon_uses` < `max_uses`, or `max_uses IS NULL`)
5. User has not already used this coupon (`admin_coupon_uses` unique constraint check)

**Response (valid):**
```json
{
  "valid": true,
  "coupon_id": "uuid",
  "discount_type": "percentage",
  "discount_value": 20,
  "discount_amount": 1.00,
  "final_amount": 4.00
}
```

**Response (invalid):**
```json
{
  "valid": false,
  "error": "Cupom expirado" | "Cupom inválido" | "Cupom já utilizado" | "Não se aplica a este produto" | "Limite de usos atingido"
}
```

### Modified: `create-boost-payment` and `create-boost-payment-card`

Accept optional `coupon_id` and `discount_amount` in request body.

On receiving coupon fields:
1. Re-validate the coupon server-side (same checks as `validate-coupon`) — never trust client-sent discount
2. Apply discount to `amountInCents` sent to Pagar.me
3. After successful payment record insert, insert into `admin_coupon_uses`

Same changes apply to `create-plan-payment` and `create-plan-payment-card`.

---

## Admin UI — `/admin/coupons`

### Coupon list

- Table: Code | Discount | Applies to | Uses (X / max) | Expires | Status
- Status badge: `Ativo`, `Expirado`, `Desativado`
- Actions per row: toggle active/inactive, edit
- "Novo cupom" button → opens form

### Coupon form (create / edit)

| Field | Input |
|---|---|
| Code | Text input + "Gerar" button (random alphanumeric) |
| Discount type | Toggle: `%` / `R$` |
| Discount value | Number input |
| Applies to | Select dropdown |
| Max uses | Number input or "Ilimitado" checkbox |
| Expires at | Date + time picker |
| Active | Toggle (default on) |

Validation: discount_value > 0; if percentage, <= 100; expires_at in the future on create.

---

## User Flow — Boosts page

Before the PIX / credit card buttons, show a collapsible coupon section:

```
Tem um cupom?
[ BOOST20           ] [ Aplicar ]

✓ Cupom aplicado: -20%
  R$ 5,00  →  R$ 4,00
```

- On "Aplicar": calls `validate-coupon` with current boost type and amount
- Valid response: show original price crossed out + final price; store `coupon_id` and `discount_amount` in local state
- Invalid response: show inline error message
- If user changes boost type/quantity after applying: auto-invalidate and clear the coupon (product scope may no longer match)
- `coupon_id` and `discount_amount` passed in payment edge function body

---

## Error Handling

| Scenario | Behavior |
|---|---|
| Coupon used between validate and pay | Edge function re-validates; returns error; user shown toast |
| Discount > original price | Cap final amount at R$0.01 (Pagar.me minimum) |
| Edge function receives tampered discount_amount | Re-calculates server-side; ignores client value |

---

## Out of Scope

- Seller-created coupons (separate system, separate table)
- Coupon stacking (one coupon per purchase)
- Automatic coupon application (user must enter code)
