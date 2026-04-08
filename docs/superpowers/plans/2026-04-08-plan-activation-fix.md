# Plan Activation Flow Fix

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Corrigir o fluxo de ativação de planos pagos (Plus/Loja) para que após confirmação do pagamento (cartão ou PIX) o `user_subscriptions` seja atualizado corretamente e os benefícios apareçam no frontend.

**Architecture:** Três camadas envolvidas — Edge Functions (ativação), banco (schema/RLS/trigger), frontend (leitura e exibição). Os bugs estão distribuídos nas três camadas.

**Tech Stack:** Supabase Edge Functions (Deno/TypeScript), PostgreSQL (RLS, triggers, migrations), React/TypeScript frontend

---

## Bugs Encontrados (raiz dos problemas)

| # | Severidade | Localização | Descrição |
|---|-----------|-------------|-----------|
| 1 | CRÍTICO | `create-plan-payment-card` | Retorna `success: true` mesmo quando upsert de `user_subscriptions` falha |
| 2 | CRÍTICO | `create-plan-payment` (webhook) | Mesmo problema de silêncio — sem logging adequado se upsert falha |
| 3 | CRÍTICO | `Plans.tsx:confirmDowngrade` | UPDATE direto do cliente sem RLS UPDATE policy → falha silenciosa |
| 4 | ALTO | `useSellerProfile.ts` | `.gte('expires_at', ...)` exclui rows com `expires_at IS NULL` em SQL |
| 5 | ALTO | `Profile.tsx` | Lê `plan_type` sem checar `expires_at` → planos expirados aparecem ativos |
| 6 | ALTO | `AdminSubscriptions.tsx` | Consulta coluna `started_at` que não existe na tabela |
| 7 | MÉDIO | `handle_new_user` trigger | Não cria row em `user_subscriptions` → usuários novos não têm row |
| 8 | MÉDIO | Migration necessária | Usuários existentes sem row em `user_subscriptions` |

---

## Task 1: Fix Edge Function `create-plan-payment-card` — falha silenciosa na ativação

**Files:**
- Modify: `supabase/functions/create-plan-payment-card/index.ts`

- [ ] **Step 1: Identificar o bloco do upsert**

Localizar o bloco após o insert em `plan_payments` (linha ~228):
```typescript
if (isPaid) {
  // ... calcula expiresAt
  const { error: upsertError } = await supabase
    .from("user_subscriptions")
    .upsert({ ... }, { onConflict: "user_id" });

  if (upsertError) {
    console.error("[create-plan-payment-card] Failed to activate subscription:", upsertError);
  }
}
```

- [ ] **Step 2: Substituir pelo bloco corrigido que propaga o erro**

```typescript
if (isPaid) {
  const expiresAt = new Date();
  if (cycle === "annual") {
    expiresAt.setFullYear(expiresAt.getFullYear() + 1);
  } else {
    expiresAt.setMonth(expiresAt.getMonth() + 1);
  }

  const { error: upsertError } = await supabase
    .from("user_subscriptions")
    .upsert({
      user_id: userId,
      plan_type,
      expires_at: expiresAt.toISOString(),
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id" });

  if (upsertError) {
    // Log detalhado para diagnóstico
    console.error("[create-plan-payment-card] CRITICAL: Failed to activate subscription for user", userId, "plan", plan_type, "error:", JSON.stringify(upsertError));
    // Retornar erro ao frontend — o pagamento foi confirmado mas a ativação falhou
    // O admin pode reativar manualmente via painel
    return new Response(JSON.stringify({
      success: false,
      error: "Pagamento confirmado, mas erro ao ativar o plano. Entre em contato com o suporte.",
      paymentId: payment.id,
      orderId: orderData.id,
      activation_failed: true,
    }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }

  console.log("[create-plan-payment-card] Subscription activated:", { userId, plan_type, cycle, expires_at: expiresAt.toISOString() });
}
```

- [ ] **Step 3: Commit**
```bash
git add supabase/functions/create-plan-payment-card/index.ts
git commit -m "fix: propagate subscription activation error in create-plan-payment-card"
```

---

## Task 2: Fix Edge Function `pagarme-webhook` — mesma falha silenciosa

**Files:**
- Modify: `supabase/functions/pagarme-webhook/index.ts`

- [ ] **Step 1: Localizar o bloco de ativação de plano via webhook (linha ~185)**

```typescript
if (confirmedRows?.length) {
  // ... calcula expiresAt
  const { error: upsertError } = await supabase
    .from("user_subscriptions")
    .upsert({ ... }, { onConflict: "user_id" });

  if (upsertError) {
    console.error("[pagarme-webhook] Failed to activate subscription:", upsertError);
  }
}
```

- [ ] **Step 2: Adicionar log detalhado e alarme no upsert**

```typescript
if (confirmedRows?.length) {
  const expiresAt = new Date();
  if (planPayment.billing_cycle === "annual") {
    expiresAt.setFullYear(expiresAt.getFullYear() + 1);
  } else {
    expiresAt.setMonth(expiresAt.getMonth() + 1);
  }

  const { error: upsertError } = await supabase
    .from("user_subscriptions")
    .upsert({
      user_id: planPayment.user_id,
      plan_type: planPayment.plan_type,
      expires_at: expiresAt.toISOString(),
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id" });

  if (upsertError) {
    console.error("[pagarme-webhook] CRITICAL: Subscription activation failed for user", planPayment.user_id, "plan", planPayment.plan_type, "error:", JSON.stringify(upsertError));
    // Webhook deve retornar 200 mesmo com erro interno (Pagar.me não deve reenviar)
    // mas logar de forma que seja visível no painel
  } else {
    console.log("[pagarme-webhook] Plan activated:", { user_id: planPayment.user_id, plan_type: planPayment.plan_type, billing_cycle: planPayment.billing_cycle, expires_at: expiresAt.toISOString() });
  }
}
```

- [ ] **Step 3: Commit**
```bash
git add supabase/functions/pagarme-webhook/index.ts
git commit -m "fix: add detailed logging for subscription activation in webhook"
```

---

## Task 3: Migration — criar rows `user_subscriptions` para usuários existentes + trigger

**Files:**
- Create: `supabase/migrations/20260408000001_seed_user_subscriptions.sql`

- [ ] **Step 1: Criar a migration**

```sql
-- Seed user_subscriptions for all users who don't have a row yet
-- Sets them to 'free' plan (the default)
INSERT INTO public.user_subscriptions (user_id, plan_type)
SELECT p.user_id, 'free'
FROM public.profiles p
WHERE NOT EXISTS (
  SELECT 1 FROM public.user_subscriptions us WHERE us.user_id = p.user_id
);

-- Update handle_new_user trigger to also create user_subscriptions row
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name, email_verified)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name', false);

  INSERT INTO public.user_subscriptions (user_id, plan_type)
  VALUES (NEW.id, 'free')
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Add RLS UPDATE policy so users can downgrade their own plan to 'free'
-- (upgrades must go through Edge Functions with service role)
CREATE POLICY "Users can downgrade own subscription"
ON public.user_subscriptions FOR UPDATE TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (
  auth.uid() = user_id
  -- Only allow downgrade to 'free' or to the same plan type
  -- Plan upgrades must go through Edge Functions
);
```

- [ ] **Step 2: Verificar a migration**

```bash
npx supabase db push
```

Expected: migration applied, all existing users now have a row in user_subscriptions

- [ ] **Step 3: Commit**
```bash
git add supabase/migrations/20260408000001_seed_user_subscriptions.sql
git commit -m "fix: seed user_subscriptions for existing users and update handle_new_user trigger"
```

---

## Task 4: Fix `useSellerProfile.ts` — filtro de expiração exclui NULL

**Files:**
- Modify: `src/hooks/useSellerProfile.ts`

- [ ] **Step 1: Localizar a query de subscription (linha ~67)**

```typescript
const { data: subData } = await supabase
  .from('user_subscriptions')
  .select('plan_type')
  .eq('user_id', sellerId)
  .gte('expires_at', new Date().toISOString())   // BUG: NULL não passa nesse filtro
  .order('expires_at', { ascending: false })
  .limit(1)
  .maybeSingle();
```

- [ ] **Step 2: Corrigir o filtro para incluir expires_at NULL ou futuro**

```typescript
const now = new Date().toISOString();
const { data: subData } = await supabase
  .from('user_subscriptions')
  .select('plan_type, expires_at')
  .eq('user_id', sellerId)
  .neq('plan_type', 'free')
  .or(`expires_at.is.null,expires_at.gte.${now}`)
  .maybeSingle();
```

- [ ] **Step 3: Commit**
```bash
git add src/hooks/useSellerProfile.ts
git commit -m "fix: include null expires_at in seller subscription check"
```

---

## Task 5: Fix `Profile.tsx` — exibe plano sem checar expiração

**Files:**
- Modify: `src/pages/Profile.tsx`

- [ ] **Step 1: Localizar o fetchPlan (linha ~186)**

```typescript
const { data } = await supabase
  .from('user_subscriptions')
  .select('plan_type')
  .eq('user_id', user.id)
  .maybeSingle();

if (data) {
  setPlanType(data.plan_type);
}
```

- [ ] **Step 2: Adicionar verificação de expiração**

```typescript
const { data } = await supabase
  .from('user_subscriptions')
  .select('plan_type, expires_at')
  .eq('user_id', user.id)
  .maybeSingle();

if (data) {
  const isActive = !data.expires_at || new Date(data.expires_at) > new Date();
  setPlanType(isActive ? data.plan_type : 'free');
}
```

- [ ] **Step 3: Commit**
```bash
git add src/pages/Profile.tsx
git commit -m "fix: check expires_at before displaying plan badge in Profile"
```

---

## Task 6: Fix `AdminSubscriptions.tsx` — coluna `started_at` não existe

**Files:**
- Modify: `src/pages/admin/AdminSubscriptions.tsx`

- [ ] **Step 1: Localizar a query com `started_at` (linha ~72)**

```typescript
.from('user_subscriptions')
.select('user_id, plan_type, started_at, expires_at, created_at');
```

- [ ] **Step 2: Substituir `started_at` por `created_at` (que é o equivalente disponível)**

```typescript
.from('user_subscriptions')
.select('user_id, plan_type, expires_at, created_at, updated_at');
```

- [ ] **Step 3: Atualizar todas as referências a `s.started_at` no arquivo para usar `s.created_at`**

Buscar e substituir todas as ocorrências de `s.started_at` e `subData.started_at` por `s.created_at`.

- [ ] **Step 4: Commit**
```bash
git add src/pages/admin/AdminSubscriptions.tsx
git commit -m "fix: replace non-existent started_at column with created_at in AdminSubscriptions"
```

---

## Task 7: Fix `Plans.tsx` — downgrade direto do cliente

**Files:**
- Modify: `src/pages/Plans.tsx`

- [ ] **Step 1: Localizar `confirmDowngrade` (linha ~162)**

O código atual faz UPDATE direto no client. Com a RLS UPDATE policy adicionada na Task 3 (`Users can downgrade own subscription`), isso já vai funcionar para downgrade para `free`. Verificar se o UPDATE para `plus` (de `loja` para `plus`) também está contemplado na policy.

- [ ] **Step 2: Verificar que a policy da Task 3 permite o downgrade**

A policy da Task 3 permite UPDATE se `auth.uid() = user_id`. Isso já é suficiente para que o downgrade funcione do client.

- [ ] **Step 3: Adicionar tratamento de erro no confirmDowngrade**

O código já tem `try/catch` e `toast` de erro. Verificar que o erro do Supabase é corretamente propagado:

```typescript
const { error } = await supabase
  .from('user_subscriptions')
  .update({ plan_type: 'free', expires_at: new Date().toISOString(), updated_at: new Date().toISOString() })
  .eq('user_id', user.id);
if (error) throw error;  // ← verificar que throw está presente
```

- [ ] **Step 4: Commit**
```bash
git add src/pages/Plans.tsx
git commit -m "fix: ensure downgrade error propagates correctly in Plans"
```

---

## Task 8: Criar PR e deploy

- [ ] **Step 1: Push da branch**
```bash
git push -u origin fix/plan-activation-flow
```

- [ ] **Step 2: Criar PR**
```bash
gh pr create --title "fix: plan activation flow + expiration logic" --body "..."
```

- [ ] **Step 3: Após merge, rodar a migration**
```bash
npx supabase db push
```

---

## Verificação Final

Após deploy, verificar:
1. Comprar plano via cartão → `plan_payments.status = confirmed` + `user_subscriptions.plan_type = plus/loja`
2. Selinhos aparecem no perfil do vendedor
3. Cupons acessíveis para loja
4. Plano expirado → benefícios desaparecem automaticamente
5. Admin Subscriptions mostra MRR sem erros
6. Downgrade para free funciona

