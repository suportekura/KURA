---
name: payment-integration
description: Use when working with payments, subscriptions, boosts, Pagar.me, PIX, credit card processing, webhook handling, plan upgrades, or pricing. Trigger on keywords like "payment", "pagar.me", "pagarme", "PIX", "credit card", "cartão", "subscription", "plan", "plano", "boost", "webhook", "qr code", "checkout payment", "plan payment", "boost payment", "subscription upgrade", "pricing", "BRL", "reais", "order.paid", "charge.refunded", "PixPaymentModal", "CreditCardPaymentModal". Also trigger when working with files in supabase/functions/create-*-payment* or supabase/functions/pagarme-webhook/.
---

# Payment Integration

This skill documents the complete payment flow in Kura, covering Pagar.me integration for PIX and credit card payments, subscription management, boost crediting, and webhook processing.

## When to use this skill

- Adding a new payment type or product
- Modifying payment edge functions
- Working with the Pagar.me webhook
- Changing subscription/boost pricing
- Building payment UI (PIX QR code, card form)
- Debugging payment failures
- Understanding the payment → crediting lifecycle

## Core Patterns

### 1. Payment Architecture Overview

```
Frontend                    Edge Functions              Pagar.me            Webhook
────────                    ──────────────              ────────            ───────
User clicks Pay →           create-*-payment →          POST /orders →      (async)
                            saves to DB (pending)       returns QR/status
                            returns QR/status to FE

(PIX: user scans QR)                                    order.paid event →  pagarme-webhook
                                                                            verifies HMAC
                                                                            credits boosts/plan
                                                                            updates DB status

(Card: immediate)           create-*-payment-card →     POST /orders →      (also handles
                            checks status immediately   returns paid/failed  via webhook as backup)
                            credits if paid
```

### 2. Payment Types & Pricing

**Subscription Plans:**

| Plan | Monthly | Annual (20% off) |
|------|---------|-------------------|
| Plus (Vendedor Plus) | R$ 39,90 | R$ 383,04 |
| Loja (Loja Oficial) | R$ 99,90 | R$ 959,04 |

**Boost Packages:**

| Duration | Single | Package (5x) |
|----------|--------|---------------|
| 24 horas | R$ 5,00 | R$ 19,90 |
| 3 dias | R$ 9,90 | R$ 39,90 |
| 7 dias | R$ 14,90 | R$ 59,90 |

### 3. PIX Payment Flow (Edge Function)

From `create-boost-payment/index.ts` and `create-plan-payment/index.ts`:

```typescript
// 1. Authenticate user
const { data: { user } } = await supabaseAdmin.auth.getUser(token);

// 2. Get user details (for Pagar.me customer)
const { data: profile } = await supabaseAdmin.from('profiles').select('*').eq('id', user.id).single();
const { data: pfProfile } = await supabaseAdmin.from('pf_profiles').select('cpf_encrypted, cpf_iv, cpf_tag').eq('user_id', user.id).single();

// 3. Decrypt CPF (AES-256-GCM)
const cpf = decryptField(pfProfile.cpf_encrypted, pfProfile.cpf_iv, pfProfile.cpf_tag);

// 4. Create Pagar.me order
const pagarmeResponse = await fetch('https://api.pagar.me/core/v5/orders', {
  method: 'POST',
  headers: {
    'Authorization': 'Basic ' + btoa(Deno.env.get('PAGARME_SECRET_KEY') + ':'),
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    customer: {
      name: profile.display_name,
      email: profile.email || user.email,
      document: cpf,
      document_type: 'CPF',
      type: 'individual',
    },
    items: [{
      amount: priceInCents,  // e.g., 3990 for R$ 39,90
      description: itemDescription,
      quantity: 1,
    }],
    payments: [{
      payment_method: 'pix',
      pix: {
        expires_in: 86400,  // 24 hours
      },
    }],
    metadata: {
      user_id: user.id,
      type: 'boost' | 'plan',
      // ... additional metadata
    },
  }),
});

// 5. Save payment record to DB
await supabaseAdmin.from('boost_payments').insert({
  user_id: user.id,
  pagarme_order_id: order.id,
  boost_type: boostType,
  quantity: quantity,
  amount_cents: priceInCents,
  status: 'pending',
  pix_qr_code: order.charges[0].last_transaction.qr_code,
  pix_qr_code_url: order.charges[0].last_transaction.qr_code_url,
  expires_at: new Date(Date.now() + 86400000).toISOString(),
});

// 6. Return QR code to frontend
return { success: true, paymentId, qrcode, payload, expiresAt };
```

### 4. Credit Card Payment Flow

From `create-boost-payment-card/index.ts` — key difference from PIX:

```typescript
// Card payments are processed immediately
payments: [{
  payment_method: 'credit_card',
  credit_card: {
    card: {
      number: cardNumber,
      holder_name: holderName,
      exp_month: expMonth,
      exp_year: expYear,
      cvv: cvv,
    },
    installments: 1,
    statement_descriptor: 'KURA',
  },
}],

// After creation, check status immediately
const orderStatus = order.status;
const chargeStatus = order.charges?.[0]?.status;

if (chargeStatus === 'paid' || chargeStatus === 'captured') {
  // Credit immediately
  await creditBoostsToUser(userId, boostType, quantity);
  return { success: true, paymentId: order.id };
} else if (chargeStatus === 'failed' || chargeStatus === 'refused') {
  // Return friendly error
  const gatewayMessage = order.charges[0]?.last_transaction?.gateway_response?.message;
  return { success: false, error: translateGatewayError(gatewayMessage) };
}
```

### 5. Webhook Processing

From `pagarme-webhook/index.ts`:

```typescript
// 1. Verify HMAC-SHA1 signature
const signature = req.headers.get('x-hub-signature');
const body = await req.text();
const expectedSignature = 'sha1=' + createHmac('sha1', WEBHOOK_SECRET).update(body).digest('hex');

if (signature !== expectedSignature) return 401;

// 2. Parse event
const { type, data } = JSON.parse(body);
const orderId = data.id || data.order?.id;

// 3. Find payment record
let payment = await findInBoostPayments(orderId);
let paymentType = 'boost';
if (!payment) {
  payment = await findInPlanPayments(orderId);
  paymentType = 'plan';
}

// 4. Handle event types
switch (type) {
  case 'order.paid':
  case 'charge.paid':
    if (payment.status === 'confirmed') return; // idempotent
    await updateStatus(payment.id, 'confirmed');
    if (paymentType === 'boost') {
      await creditBoosts(payment.user_id, payment.boost_type, payment.quantity);
    } else {
      await activateSubscription(payment.user_id, payment.plan_type, payment.billing_cycle);
    }
    break;

  case 'order.payment_failed':
  case 'order.canceled':
    await updateStatus(payment.id, 'failed');
    break;

  case 'charge.refunded':
    await updateStatus(payment.id, 'refunded');
    if (paymentType === 'boost') {
      await debitBoosts(payment.user_id, payment.boost_type, payment.quantity);
    } else {
      await downgradeToFree(payment.user_id);
    }
    break;
}
```

### 6. Frontend Payment UI

Invoking payment from the frontend:

```typescript
// PIX payment
const { data, error } = await supabase.functions.invoke('create-boost-payment', {
  body: { boost_type: '24h', quantity: 1 },
});

if (data?.success) {
  // Show PixPaymentModal with data.qrcode, data.payload, data.expiresAt
}

// Credit card payment
const { data, error } = await supabase.functions.invoke('create-boost-payment-card', {
  body: {
    boost_type: '24h',
    quantity: 1,
    card_number: '4111111111111111',
    holder_name: 'JOAO SILVA',
    exp_month: 12,
    exp_year: 2027,
    cvv: '123',
  },
});

if (data?.success) {
  // Payment confirmed immediately — show success
} else if (data && !data.success) {
  // Card declined — show data.error message
}
```

### 7. Crediting Logic

**Boosts** — stored in `user_boosts` table (one row per user):
```sql
-- Columns: boosts_24h, boosts_3d, boosts_7d (integer counters)
INSERT INTO user_boosts (user_id, boosts_24h) VALUES (userId, quantity)
ON CONFLICT (user_id) DO UPDATE SET boosts_24h = user_boosts.boosts_24h + quantity;
```

**Subscriptions** — stored in `user_subscriptions` table:
```sql
INSERT INTO user_subscriptions (user_id, plan_type, started_at, expires_at)
VALUES (userId, planType, now(), now() + interval '1 month')
ON CONFLICT (user_id) DO UPDATE SET
  plan_type = planType,
  started_at = now(),
  expires_at = now() + interval '1 month';
```

## Common Mistakes to Avoid

1. **Never store card numbers in the database** — send directly to Pagar.me, never persist
2. **Never process webhook events without signature verification** — always verify HMAC-SHA1
3. **Always implement idempotency** — check `payment.status === 'confirmed'` before crediting again
4. **Don't return 500 for card declines** — return HTTP 200 with `{ success: false, error: "message" }` so the frontend shows a friendly error
5. **Always save the payment record BEFORE calling Pagar.me** — if the API call succeeds but DB insert fails, you lose the record
6. **Never expose `PAGARME_SECRET_KEY`** on the frontend — all payment creation happens server-side via Edge Functions
7. **Prices are always in centavos** — R$ 39,90 = 3990 centavos in the Pagar.me API

## Checklist

- [ ] Payment edge function has CORS + auth handling
- [ ] Price in centavos (not reais) when calling Pagar.me
- [ ] Payment record saved to `boost_payments` or `plan_payments` before API call
- [ ] PIX: QR code + payload + expiration returned to frontend
- [ ] Card: Status checked immediately, credits applied if paid
- [ ] Webhook verifies HMAC-SHA1 signature
- [ ] Webhook processing is idempotent (skip if already confirmed)
- [ ] Refunds debit boosts or downgrade subscription
- [ ] Frontend handles both `success: true` and `success: false` responses
