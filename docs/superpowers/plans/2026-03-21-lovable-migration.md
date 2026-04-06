# Kura — Migração Completa: Lovable → Stack Própria

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Desacoplar totalmente o projeto Kura da plataforma Lovable, migrando para infraestrutura própria: GitHub + Supabase próprio + Vercel + Hostinger + Resend + Pagar.me (consolidando pagamentos).

**Architecture:** O projeto é um PWA React/Vite com Supabase como BaaS. A migração ocorre em 4 frentes independentes: (1) remover código Lovable do codebase, (2) provisionar novo Supabase e migrar schema, (3) consolidar pagamentos Asaas → Pagar.me, (4) configurar CI/CD Vercel + domínio Hostinger.

**Tech Stack:** React 18 + Vite + TypeScript + Supabase JS v2 + Pagar.me API v5 + Resend + Vercel CLI + GitHub

---

> ⚠️ **ESCOPO — Este plano cobre 4 subsistemas independentes.** Podem ser executados em paralelo por agentes separados. Ordem recomendada: Fase 1 → Fase 2 → (Fase 3 + Fase 4 em paralelo) → Fase 5.

---

## ANÁLISE DO ESTADO ATUAL

### Dependências Lovable encontradas
| Arquivo | Dependência | Ação |
|---|---|---|
| `package.json` | `@lovable.dev/cloud-auth-js@^0.0.3` | Remover |
| `package.json` devDeps | `lovable-tagger@^1.1.13` | Remover |
| `vite.config.ts` | `componentTagger()` de `lovable-tagger` | Remover |
| `src/integrations/lovable/index.ts` | Arquivo inteiro de auth OAuth | Deletar |
| `src/pages/Auth.tsx:272` | `lovable.auth.signInWithOAuth("google")` | Substituir por Supabase OAuth nativo |
| `src/hooks/useAuth.tsx:252` | `ensure-asaas-customer` chamada no signIn | Substituir por `ensure-pagarme-customer` |

### Tabelas de banco de dados
| Tabela | Status | Ação |
|---|---|---|
| `asaas_customers` | Asaas-specific | Renomear para `pagarme_customers` |
| `boost_payments` | Tem `asaas_payment_id` | Migrar coluna para `pagarme_order_id` |
| `plan_payments` | Já usa pagar.me | Manter |
| Todas as outras 25 tabelas | Bem estruturadas | Manter sem alteração |

### Edge Functions Supabase
| Função | Status | Ação |
|---|---|---|
| `ensure-asaas-customer` | Asaas | Reescrever para Pagar.me |
| `create-boost-payment` | Asaas PIX | Reescrever para Pagar.me PIX |
| `create-boost-payment-card` | Asaas cartão | Reescrever para Pagar.me cartão |
| `retry-asaas-customers` | Asaas | Remover ou adaptar para Pagar.me |
| `create-plan-payment` | Já Pagar.me | Manter |
| `create-plan-payment-card` | Já Pagar.me | Manter |
| `pagarme-webhook` | Já Pagar.me (cobre planos) | Estender para cobrir boosts |
| `send-verification-code` | Resend já configurado | Manter |
| `reset-password` | Verificar uso de Resend | Verificar |
| `save-user-profile`, `complete-signup`, `verify-code` | Sem deps externas | Manter |
| `moderate-image`, `moderate-text` | AI moderation | Manter |
| `get-vapid-key`, `send-push-notification` | Push VAPID | Manter |

### Arquivo de Secrets necessários (novo Supabase + Vercel)
```
VITE_SUPABASE_URL=
VITE_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SERVICE_ROLE_KEY=
PAGARME_API_KEY=
PAGARME_WEBHOOK_SECRET=
RESEND_API_KEY=
UPSTASH_REDIS_URL=
UPSTASH_REDIS_TOKEN=
ENCRYPTION_SECRET=
VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
```

---

## FASE 1 — GitHub: Criar Repositório Próprio

### Task 1: Inicializar Git e subir para GitHub

**Files:**
- Create: `.gitignore` (verificar se existe)
- Create: `.env.example`

- [ ] **Step 1: Verificar .gitignore existente**

```bash
cat .gitignore
```

- [ ] **Step 2: Criar .env.example com todas as variáveis**

Criar `D:/PERSONAL_PROJECTS/kura_official/.env.example`:

```env
# Supabase
VITE_SUPABASE_URL=https://SEU_PROJETO.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=eyJ...

# Essas ficam apenas no Supabase Dashboard → Edge Functions Secrets
# SUPABASE_SERVICE_ROLE_KEY=
# PAGARME_API_KEY=
# PAGARME_WEBHOOK_SECRET=
# RESEND_API_KEY=
# UPSTASH_REDIS_URL=
# UPSTASH_REDIS_TOKEN=
# ENCRYPTION_SECRET=
# VAPID_PUBLIC_KEY=
# VAPID_PRIVATE_KEY=
```

- [ ] **Step 3: Verificar que .env e .env.local estão no .gitignore**

```bash
grep -E "^\.env" .gitignore
```

Esperado: linhas `.env` e `.env.local` listadas. Se não estiver, adicionar.

- [ ] **Step 4: Inicializar git**

```bash
cd D:/PERSONAL_PROJECTS/kura_official
git init
git add .
```

- [ ] **Step 5: Criar repositório no GitHub via gh CLI**

```bash
gh repo create kura-oficial --private --source=. --remote=origin --push
```

Esperado: URL do repositório retornada. Verificar com:

```bash
git remote -v
```

- [ ] **Step 6: Verificar push bem-sucedido**

```bash
git log --oneline -3
gh repo view --web
```

---

## FASE 2 — Supabase: Novo Projeto Próprio

### Task 2: Provisionar novo projeto Supabase

> ⚠️ Esta task exige ações manuais no dashboard Supabase. O agente deve guiar o usuário.

- [ ] **Step 1: Criar projeto no Supabase Dashboard**

Ir em: https://supabase.com/dashboard → New Project
- Nome: `kura-oficial`
- Região: South America (São Paulo) `sa-east-1`
- Anotar: `Project URL`, `anon key`, `service_role key`

- [ ] **Step 2: Instalar Supabase CLI se necessário**

```bash
supabase --version
```

Se não instalado:
```bash
npm install -g supabase
```

- [ ] **Step 3: Linkar projeto local ao novo Supabase**

```bash
cd D:/PERSONAL_PROJECTS/kura_official
supabase login
supabase link --project-ref SEU_PROJECT_REF
```

`SEU_PROJECT_REF` = slug do projeto (encontrado na URL do dashboard: `app.supabase.com/project/SLUG`).

- [ ] **Step 4: Rodar todas as migrations no novo projeto**

```bash
supabase db push
```

Esperado: todas as 80 migrations aplicadas sem erro. Se houver erro de conflito, verificar o output e resolver manualmente.

- [ ] **Step 5: Configurar Auth no novo Supabase**

No dashboard novo projeto → Authentication → Providers:
- Email: habilitado (confirm email: **ON**, mas Lovable usava flow próprio via `send-verification-code`, então pode ficar **OFF** se preferir o flow manual)
- Google OAuth: adicionar Client ID e Secret (obter no Google Cloud Console)

No dashboard → Authentication → URL Configuration:
- Site URL: `https://SEU_DOMINIO.com`
- Redirect URLs: `https://SEU_DOMINIO.com/**`

- [ ] **Step 6: Configurar Storage no novo projeto**

No dashboard → Storage:
- Verificar se o bucket `product-images` existe (criado via migration)
- Se não, criar manualmente com policy pública de leitura

- [ ] **Step 7: Deploy das Edge Functions**

```bash
supabase functions deploy --project-ref SEU_PROJECT_REF
```

Esperado: todas as funções de `supabase/functions/` deployadas.

> ⚠️ O deploy em lote usa as configurações do `supabase/config.toml` (que já tem `verify_jwt = false` para as funções corretas). Mas para `pagarme-webhook`, confirmar que o deploy não sobrescreve essa config — se sim, re-deployar só ela: `supabase functions deploy pagarme-webhook --project-ref SEU_PROJECT_REF --no-verify-jwt`

- [ ] **Step 8: Configurar Secrets nas Edge Functions**

No dashboard novo projeto → Edge Functions → Manage Secrets, ou via CLI:

```bash
supabase secrets set --project-ref SEU_PROJECT_REF \
  PAGARME_API_KEY="SUA_CHAVE_PAGARME" \
  PAGARME_WEBHOOK_SECRET="SEU_WEBHOOK_SECRET" \
  RESEND_API_KEY="SUA_CHAVE_RESEND" \
  UPSTASH_REDIS_URL="SEU_UPSTASH_URL" \
  UPSTASH_REDIS_TOKEN="SEU_UPSTASH_TOKEN" \
  ENCRYPTION_SECRET="SUA_CHAVE_CRIPTOGRAFIA_32CHARS" \
  VAPID_PUBLIC_KEY="SUA_VAPID_PUBLIC" \
  VAPID_PRIVATE_KEY="SUA_VAPID_PRIVATE"
```

- [ ] **Step 9: Criar arquivo .env.local com as chaves do novo projeto**

```bash
cat > .env.local << 'EOF'
VITE_SUPABASE_URL=https://SEU_NOVO_PROJECT.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=eyJ...anon_key...
EOF
```

- [ ] **Step 10: Testar conexão local**

```bash
npm run dev
```

Acessar `http://localhost:8080` e verificar que a página carrega e que o login por e-mail funciona.

---

## FASE 3 — Remoção das Dependências Lovable

### Task 3: Remover lovable-tagger do build

**Files:**
- Modify: `vite.config.ts`
- Modify: `package.json`

- [ ] **Step 1: Remover import e uso de componentTagger em vite.config.ts**

Em `vite.config.ts`, remover linha 4:
```diff
-import { componentTagger } from "lovable-tagger";
```
E linha 15:
```diff
-    mode === "development" && componentTagger(),
```

- [ ] **Step 2: Verificar que o build compila o vite.config sem erros (build ainda pode falhar por causa do import lovable no Auth.tsx — isso é resolvido no Task 4)**

```bash
npm run build 2>&1 | head -20
```

Esperado: erro de TypeScript/módulo em `Auth.tsx` sobre `@lovable.dev/cloud-auth-js` é aceitável aqui — será corrigido no Task 4. O objetivo deste step é confirmar que `lovable-tagger` foi removido do config sem quebrar o pipeline de build em si.

- [ ] **Step 3: Remover dependências Lovable do package.json**

```bash
npm uninstall @lovable.dev/cloud-auth-js lovable-tagger
```

Esperado: `package.json` sem essas duas entradas.

- [ ] **Step 4: Verificar que não quebrou nada**

```bash
npm run build
```

Esperado: BUILD bem-sucedido. Se falhar com erro de import faltando, o Task 4 resolverá.

- [ ] **Step 5: Commit**

```bash
git add vite.config.ts package.json package-lock.json
git commit -m "chore: remove lovable-tagger from build pipeline"
```

---

### Task 4: Substituir integração Lovable OAuth por Supabase OAuth nativo

**Files:**
- Delete: `src/integrations/lovable/index.ts`
- Modify: `src/pages/Auth.tsx`

**Contexto:** O único uso de `lovable` no código é em `Auth.tsx:272` — o botão "Continuar com Google". Substituiremos por `supabase.auth.signInWithOAuth`.

- [ ] **Step 1: Ler o contexto completo do uso em Auth.tsx**

```bash
grep -n "lovable\|signInWithOAuth\|google" src/pages/Auth.tsx
```

- [ ] **Step 2: Substituir a chamada Lovable por Supabase OAuth nativo em Auth.tsx**

Localizar em `src/pages/Auth.tsx` perto da linha 272:

```typescript
// ANTES:
const { error } = await lovable.auth.signInWithOAuth("google", {
  redirect_uri: `${window.location.origin}/`,
});

// DEPOIS:
const { error } = await supabase.auth.signInWithOAuth({
  provider: 'google',
  options: {
    redirectTo: `${window.location.origin}/`,
  },
});
```

- [ ] **Step 3: Remover o import de lovable no topo de Auth.tsx**

```diff
-import { lovable } from '@/integrations/lovable/index';
```

- [ ] **Step 4: Deletar o arquivo de integração Lovable**

```bash
rm src/integrations/lovable/index.ts
rmdir src/integrations/lovable 2>/dev/null || true
```

- [ ] **Step 5: Verificar que não há outros usos de lovable**

```bash
grep -r "lovable" src/ --include="*.ts" --include="*.tsx"
```

Esperado: nenhum resultado.

- [ ] **Step 6: Build e teste manual**

```bash
npm run build
npm run dev
```

Testar: acessar `/auth`, verificar que o botão Google aparece e redireciona para o OAuth do Google (sem erros no console).

- [ ] **Step 7: Commit**

```bash
git add src/integrations/ src/pages/Auth.tsx
git commit -m "feat: replace Lovable OAuth with native Supabase signInWithOAuth"
```

---

## FASE 4 — Consolidação de Pagamentos: Asaas → Pagar.me

> ⚠️ Antes de iniciar esta fase, confirmar que a nova Pagar.me account tem as credenciais disponíveis. API v5 docs: https://developers.pagar.me/docs

### Task 5: Migrar schema do banco — asaas_customers → pagarme_customers

**Files:**
- Create: `supabase/migrations/TIMESTAMP_migrate_asaas_to_pagarme.sql`

- [ ] **Step 1: Gerar migration com Supabase CLI (timestamp automático)**

```bash
supabase migration new migrate_asaas_to_pagarme
```

Esperado: arquivo criado em `supabase/migrations/TIMESTAMP_migrate_asaas_to_pagarme.sql`. Abrir esse arquivo para editar no próximo step.

> ⚠️ Não usar `date +%Y%m%d%H%M%S` manualmente — pode ter comportamento diferente no Windows.

- [ ] **Step 2: Criar migration SQL**

Criar `supabase/migrations/TIMESTAMP_migrate_asaas_to_pagarme.sql`:

```sql
-- Rename asaas_customers to pagarme_customers
ALTER TABLE asaas_customers RENAME TO pagarme_customers;

-- Rename Asaas-specific columns to Pagar.me equivalents
ALTER TABLE pagarme_customers
  RENAME COLUMN asaas_customer_id TO pagarme_customer_id;

ALTER TABLE pagarme_customers
  RENAME COLUMN asaas_date_created TO pagarme_date_created;

ALTER TABLE pagarme_customers
  RENAME COLUMN asaas_object TO pagarme_object;

-- Migrate boost_payments: rename asaas_payment_id to pagarme_order_id
ALTER TABLE boost_payments
  RENAME COLUMN asaas_payment_id TO pagarme_order_id;

-- Update pix_qrcode_base64 to pix_qrcode_url for consistency with plan_payments
ALTER TABLE boost_payments
  RENAME COLUMN pix_qrcode_base64 TO pix_qrcode_url;
```

- [ ] **Step 3: Aplicar migration no novo Supabase**

```bash
supabase db push
```

Esperado: migration aplicada sem erros.

- [ ] **Step 4: Atualizar o arquivo types.ts para refletir as mudanças**

Em `src/integrations/supabase/types.ts`, fazer replace em massa.

No Windows Git Bash, usar sed com backup explícito (obrigatório no Windows):

```bash
sed -i.bak \
  's/asaas_customers/pagarme_customers/g;
   s/asaas_customer_id/pagarme_customer_id/g;
   s/asaas_date_created/pagarme_date_created/g;
   s/asaas_object/pagarme_object/g;
   s/asaas_payment_id/pagarme_order_id/g;
   s/pix_qrcode_base64/pix_qrcode_url/g' \
  src/integrations/supabase/types.ts
rm -f src/integrations/supabase/types.ts.bak
```

> ⚠️ O `.bak` é necessário no Windows — sem ele `sed -i` pode corromper o arquivo.

- [ ] **Step 5: Build para verificar que types não quebraram**

```bash
npm run build
```

Se houver erros de tipo, corrigir os componentes que referenciam as colunas renomeadas.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/ src/integrations/supabase/types.ts
git commit -m "feat: rename asaas tables/columns to pagarme equivalents"
```

---

### Task 6: Reescrever ensure-asaas-customer → ensure-pagarme-customer

**Files:**
- Modify: `supabase/functions/ensure-asaas-customer/index.ts`
- Modify: `supabase/config.toml`
- Modify: `src/hooks/useAuth.tsx`
- Modify: `src/components/auth/ProfileSetupForm.tsx` (linha 282: também chama `ensure-asaas-customer`)

**Referência API Pagar.me:** `POST https://api.pagar.me/core/v5/customers`

- [ ] **Step 1: Ler a função atual completa**

```bash
cat supabase/functions/ensure-asaas-customer/index.ts
```

- [ ] **Step 2: Reescrever a função para usar Pagar.me v5**

Substituir o conteúdo de `supabase/functions/ensure-asaas-customer/index.ts`:

```typescript
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";

const PAGARME_API_KEY = Deno.env.get("PAGARME_API_KEY")!;
const PAGARME_BASE = "https://api.pagar.me/core/v5";

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return handleCorsPreflightRequest(req);

  const corsHeaders = getCorsHeaders(req.headers.get("origin"));

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Get auth user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", "")
    );
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if customer already exists
    const { data: existing } = await supabase
      .from("pagarme_customers")
      .select("pagarme_customer_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (existing?.pagarme_customer_id) {
      return new Response(JSON.stringify({ customer_id: existing.pagarme_customer_id }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get user profile for customer creation
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name, phone")
      .eq("user_id", user.id)
      .maybeSingle();

    // Create Pagar.me customer
    const customerPayload = {
      name: profile?.full_name ?? user.email!.split("@")[0],
      email: user.email!,
      type: "individual",
      phones: profile?.phone ? {
        mobile_phone: {
          country_code: "55",
          area_code: profile.phone.replace(/\D/g, "").substring(0, 2),
          number: profile.phone.replace(/\D/g, "").substring(2),
        },
      } : undefined,
    };

    const pagarmeRes = await fetch(`${PAGARME_BASE}/customers`, {
      method: "POST",
      headers: {
        "Authorization": `Basic ${btoa(PAGARME_API_KEY + ":")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(customerPayload),
    });

    if (!pagarmeRes.ok) {
      const err = await pagarmeRes.text();
      console.error("[ensure-pagarme-customer] API error:", err);
      return new Response(JSON.stringify({ error: "Failed to create customer" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const customer = await pagarmeRes.json();

    // Save to DB
    await supabase.from("pagarme_customers").insert({
      user_id: user.id,
      pagarme_customer_id: customer.id,
      pagarme_object: "customer",
      environment: PAGARME_API_KEY.startsWith("sk_test") ? "sandbox" : "live",
      status: "active",
    });

    return new Response(JSON.stringify({ customer_id: customer.id }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (e) {
    console.error("[ensure-pagarme-customer] Error:", e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
};

serve(handler);
```

- [ ] **Step 3: Verificar e atualizar todas as chamadas no frontend**

A função continua com o mesmo nome de endpoint (`ensure-asaas-customer`), então os invokes podem permanecer iguais:

Em `src/hooks/useAuth.tsx:252`:
```typescript
// Pode permanecer como está - o nome do endpoint não muda
supabase.functions.invoke('ensure-asaas-customer')
```

Em `src/components/auth/ProfileSetupForm.tsx:282`:
```typescript
// Também pode permanecer como está
supabase.functions.invoke('ensure-asaas-customer').then(({ error: asaasError }) => {
```

Nenhuma alteração de código necessária nesses arquivos — só a Edge Function muda internamente.

- [ ] **Step 4: Deploy da função atualizada**

```bash
supabase functions deploy ensure-asaas-customer --project-ref SEU_PROJECT_REF
```

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/ensure-asaas-customer/
git commit -m "feat: migrate ensure-customer from Asaas to Pagar.me v5"
```

---

### Task 7: Reescrever create-boost-payment (PIX) para Pagar.me

**Files:**
- Modify: `supabase/functions/create-boost-payment/index.ts`

**Referência:** Pagar.me v5 Orders API com payment_method `pix`

- [ ] **Step 1: Ler a função atual completa**

```bash
cat supabase/functions/create-boost-payment/index.ts
```

- [ ] **Step 2: Identificar campos de saída esperados pelo frontend**

```bash
grep -r "create-boost-payment\|boost_payments\|pix_payload\|pix_qrcode" src/ --include="*.ts" --include="*.tsx" -n
```

Anotar quais campos o frontend consome (pix_payload, pix_qrcode_url/base64, pix_expiration).

- [ ] **Step 3: Substituir chamadas Asaas por Pagar.me v5 na função**

A lógica de negócio (preços, tipos de boost, decrypt de CPF/CNPJ) permanece igual.
Substituir apenas o bloco de chamada à API externa:

```typescript
// SUBSTITUIR bloco Asaas por:
const pagarmeCustomer = await supabase
  .from("pagarme_customers")
  .select("pagarme_customer_id")
  .eq("user_id", userId)
  .maybeSingle();

const orderId = crypto.randomUUID();
const orderPayload = {
  code: orderId,
  customer_id: pagarmeCustomer.data?.pagarme_customer_id,
  items: [{
    amount: Math.round(amount * 100), // Pagar.me usa centavos
    description: `Boost ${boostType}`,
    quantity: 1,
    code: `boost-${boostType}`,
  }],
  payments: [{
    payment_method: "pix",
    pix: {
      expires_in: 3600, // 1 hora
    },
  }],
};

const pagarmeRes = await fetch(`${PAGARME_BASE}/orders`, {
  method: "POST",
  headers: {
    "Authorization": `Basic ${btoa(PAGARME_API_KEY + ":")}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify(orderPayload),
});

const order = await pagarmeRes.json();
const charge = order.charges?.[0];
const pixData = charge?.last_transaction;

// Save to boost_payments
await supabase.from("boost_payments").insert({
  user_id: userId,
  boost_type: boostType,
  quantity: isPackage ? 5 : 1,
  amount,
  pagarme_order_id: order.id,
  pix_payload: pixData?.qr_code,
  pix_qrcode_url: pixData?.qr_code_url,
  pix_expiration: pixData?.expires_at,
  status: "pending",
});
```

- [ ] **Step 4: Deploy**

```bash
supabase functions deploy create-boost-payment --project-ref SEU_PROJECT_REF
```

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/create-boost-payment/
git commit -m "feat: migrate create-boost-payment from Asaas to Pagar.me PIX"
```

---

### Task 8: Reescrever create-boost-payment-card para Pagar.me

**Files:**
- Modify: `supabase/functions/create-boost-payment-card/index.ts`

- [ ] **Step 1: Ler a função atual**

```bash
cat supabase/functions/create-boost-payment-card/index.ts
```

- [ ] **Step 2: Substituir chamadas Asaas por Pagar.me cartão de crédito**

Substituir bloco de API por:

```typescript
const orderPayload = {
  code: crypto.randomUUID(),
  customer_id: pagarmeCustomerId,
  items: [{
    amount: Math.round(amount * 100),
    description: `Boost ${boostType}`,
    quantity: 1,
    code: `boost-${boostType}`,
  }],
  payments: [{
    payment_method: "credit_card",
    credit_card: {
      installments: 1,
      statement_descriptor: "KURA BOOST",
      card: {
        number: cardData.number.replace(/\s/g, ""),
        holder_name: cardData.holderName,
        exp_month: parseInt(cardData.expMonth),
        exp_year: parseInt(cardData.expYear),
        cvv: cardData.cvv,
      },
    },
  }],
};
```

> ⚠️ Pagar.me v5 aceita dados de cartão brutos apenas com certificação PCI. Verificar se o projeto usa tokenização via Pagar.me.js ou se aceita dados diretos.

- [ ] **Step 3: Deploy**

```bash
supabase functions deploy create-boost-payment-card --project-ref SEU_PROJECT_REF
```

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/create-boost-payment-card/
git commit -m "feat: migrate create-boost-payment-card from Asaas to Pagar.me"
```

---

### Task 9: Estender pagarme-webhook para cobrir boost_payments

**Files:**
- Modify: `supabase/functions/pagarme-webhook/index.ts`

- [ ] **Step 1: Ler a lógica atual do webhook**

```bash
cat supabase/functions/pagarme-webhook/index.ts
```

- [ ] **Step 2: Identificar quais eventos já são tratados**

Procurar por `eventType` e os cases tratados (provavelmente `order.paid`, `order.payment_failed`).

- [ ] **Step 3: Adicionar tratamento para boost_payments**

`boost_payments` NÃO tem `product_id` — são créditos de boost para a conta. A RPC `activate_product_boost(p_product_id, p_boost_type)` é chamada DEPOIS, quando o usuário aplica o boost em um produto específico. No webhook, apenas creditamos os créditos na tabela `user_boosts`.

Dentro do handler de `order.paid`, antes do bloco `plan_payments`:

```typescript
// Após confirmar order.paid:
const orderId = data.id;

// Verificar se é pagamento de boost
const { data: boostPayment } = await supabase
  .from("boost_payments")
  .select("id, boost_type, quantity, user_id")
  .eq("pagarme_order_id", orderId)
  .maybeSingle();

if (boostPayment) {
  // Marcar pagamento como pago
  await supabase
    .from("boost_payments")
    .update({ status: "paid" })
    .eq("pagarme_order_id", orderId);

  // Creditar boosts no saldo do usuário
  const boostColumn = `total_boosts_${boostPayment.boost_type}` as const;
  await supabase.rpc("increment_user_boosts", {
    p_user_id: boostPayment.user_id,
    p_boost_type: boostPayment.boost_type,
    p_quantity: boostPayment.quantity,
  });

  return new Response(JSON.stringify({ received: true }), { status: 200 });
}

// Caso contrário, verificar plan_payments (lógica já existente)
```

> ⚠️ Se não existir RPC `increment_user_boosts`, fazer o update direto na tabela `user_boosts` incrementando a coluna correspondente ao tipo de boost.

- [ ] **Step 4: Deploy com flag --no-verify-jwt (obrigatório para webhooks externos)**

```bash
supabase functions deploy pagarme-webhook --project-ref SEU_PROJECT_REF --no-verify-jwt
```

> ⚠️ O `--no-verify-jwt` é essencial aqui. Pagar.me envia o webhook sem Bearer token do Supabase — sem essa flag, todas as requisições recebem `401 Unauthorized`.

- [ ] **Step 5: Configurar webhook URL no dashboard Pagar.me**

No Pagar.me Dashboard → Webhooks → Criar novo:
- URL: `https://SEU_PROJETO.supabase.co/functions/v1/pagarme-webhook`
- Eventos: `order.paid`, `order.payment_failed`, `order.canceled`

- [ ] **Step 6: Commit**

```bash
git add supabase/functions/pagarme-webhook/
git commit -m "feat: extend pagarme-webhook to handle boost_payments"
```

---

### Task 9b: Verificar reset-password usa Resend (confirmação)

> `reset-password` usa um **fluxo code-based** — o usuário recebe o código via `send-verification-code` (que já usa Resend), depois submete o código via `reset-password` para trocar a senha. A função `reset-password` em si NÃO envia e-mails, então não precisa de `RESEND_API_KEY`. Mas precisa de `UPSTASH_REDIS_URL` e `UPSTASH_REDIS_TOKEN` para rate limiting.

- [ ] **Step 1: Confirmar que reset-password não envia emails**

```bash
grep -n "RESEND\|fetch.*resend\|sendEmail\|sendMail" supabase/functions/reset-password/index.ts
```

Esperado: nenhum resultado. Se houver, adicionar `RESEND_API_KEY` nos secrets (já configurado no Task 2 Step 8).

- [ ] **Step 2: Confirmar que UPSTASH credentials estão configuradas**

Já cobertas no Task 2 Step 8. Sem ação adicional.

---

### Task 10: Remover retry-asaas-customers

**Files:**
- Delete: `supabase/functions/retry-asaas-customers/` (pasta inteira)
- Modify: `supabase/config.toml`

- [ ] **Step 1: Verificar se retry-asaas-customers é chamado do frontend**

```bash
grep -r "retry-asaas-customers" src/ --include="*.ts" --include="*.tsx"
```

Esperado: nenhum resultado. Se houver, remover os usos antes de deletar.

- [ ] **Step 2: Remover a pasta da função**

```bash
rm -rf supabase/functions/retry-asaas-customers/
```

- [ ] **Step 3: Remover entrada do config.toml se existir**

Verificar `supabase/config.toml` por `retry-asaas-customers` e remover se presente.

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/ supabase/config.toml
git commit -m "chore: remove retry-asaas-customers function"
```

---

## FASE 5 — Deploy: Vercel + Domínio Hostinger

### Task 11: Configurar deploy Vercel

**Files:**
- Create: `vercel.json`

- [ ] **Step 1: Instalar Vercel CLI**

```bash
npm install -g vercel
vercel --version
```

- [ ] **Step 2: Criar vercel.json para SPA routing**

```json
{
  "rewrites": [
    { "source": "/(.*)", "destination": "/index.html" }
  ],
  "headers": [
    {
      "source": "/sw.js",
      "headers": [
        { "key": "Cache-Control", "value": "public, max-age=0, must-revalidate" },
        { "key": "Service-Worker-Allowed", "value": "/" }
      ]
    }
  ]
}
```

> O `rewrites` é necessário porque é um SPA com react-router-dom. Sem isso, refresh em `/profile` retorna 404.

- [ ] **Step 3: Conectar repositório GitHub ao Vercel**

```bash
vercel login
vercel link
```

Ou via dashboard Vercel: New Project → Import from GitHub → selecionar `kura-oficial`.

- [ ] **Step 4: Configurar variáveis de ambiente na Vercel**

No Vercel Dashboard → Project Settings → Environment Variables, adicionar:

```
VITE_SUPABASE_URL = https://SEU_NOVO_PROJECT.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY = eyJ...anon_key...
```

> Somente as variáveis com prefixo `VITE_` são expostas ao browser. As demais ficam só no Supabase.

- [ ] **Step 5: Deploy para produção**

```bash
vercel --prod
```

Esperado: URL de produção retornada (algo como `kura-oficial.vercel.app`).

- [ ] **Step 6: Verificar PWA e build**

Acessar a URL de produção e verificar:
- App carrega sem erros no console
- O service worker registra (aba Application no DevTools)
- Login funciona

- [ ] **Step 7: Commit**

```bash
git add vercel.json
git commit -m "chore: add vercel.json for SPA routing"
```

---

### Task 12: Configurar domínio personalizado (Hostinger)

> ⚠️ Esta task é majoritariamente manual no painel Hostinger + Vercel.

- [ ] **Step 1: Adicionar domínio na Vercel**

No Vercel Dashboard → Project → Domains → Add Domain:
- Digitar o domínio registrado na Hostinger (ex: `kuralab.com.br`)

Vercel exibirá os registros DNS necessários.

- [ ] **Step 2: Configurar DNS na Hostinger**

No painel Hostinger → Domínios → SEU_DOMINIO → DNS Zone, adicionar:

```
Tipo: A
Nome: @
Valor: 76.76.21.21   (IP da Vercel)
TTL: 3600

Tipo: CNAME
Nome: www
Valor: cname.vercel-dns.com
TTL: 3600
```

> Os valores exatos são fornecidos pelo painel Vercel após adicionar o domínio.

- [ ] **Step 3: Aguardar propagação DNS**

```bash
dig kuralab.com.br A +short
```

Esperado: retornar o IP da Vercel. Propagação pode levar até 24h, mas geralmente < 30 min.

- [ ] **Step 4: Atualizar Site URL no Supabase**

No Supabase Dashboard → Authentication → URL Configuration:
- Site URL: `https://kuralab.com.br`
- Redirect URLs: `https://kuralab.com.br/**`, `https://www.kuralab.com.br/**`

- [ ] **Step 5: Atualizar webhook URL no Pagar.me**

Trocar a URL do webhook de `*.supabase.co` para continuar usando Supabase Edge Functions (não muda, pois o webhook vai direto para o Supabase).

- [ ] **Step 6: Verificação final**

```bash
curl -I https://kuralab.com.br
```

Esperado: `HTTP/2 200` com headers da Vercel.

---

## CHECKLIST DE VERIFICAÇÃO FINAL

Antes de considerar a migração completa:

- [ ] `npm run build` passa sem warnings sobre Lovable
- [ ] Nenhuma referência a `lovable` no código: `grep -r "lovable" src/`
- [ ] Login por e-mail/senha funcionando na produção
- [ ] Login Google OAuth funcionando na produção
- [ ] Criação de anúncio (produto) funcionando
- [ ] Pagamento PIX de boost funcionando (testar em sandbox Pagar.me)
- [ ] Pagamento PIX de plano funcionando
- [ ] E-mail de verificação sendo enviado via Resend
- [ ] Push notifications funcionando (VAPID keys configuradas)
- [ ] Webhook Pagar.me recebendo eventos (testar via CLI do Pagar.me ou ngrok em dev)
- [ ] Domínio personalizado com HTTPS funcionando
- [ ] PWA instalável no mobile

---

## SECRETS CHECKLIST — Onde configurar cada secret

| Secret | Onde fica | Quem usa |
|---|---|---|
| `VITE_SUPABASE_URL` | Vercel Env Vars | Frontend (build time) |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Vercel Env Vars | Frontend (build time) |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Edge Fn Secrets (auto) | Edge Functions |
| `PAGARME_API_KEY` | Supabase Edge Fn Secrets | ensure-pagarme-customer, create-boost-payment*, create-plan-payment* |
| `PAGARME_WEBHOOK_SECRET` | Supabase Edge Fn Secrets | pagarme-webhook |
| `RESEND_API_KEY` | Supabase Edge Fn Secrets | send-verification-code (reset-password usa fluxo code-based, não envia email) |
| `UPSTASH_REDIS_URL` | Supabase Edge Fn Secrets | send-verification-code (rate limit) |
| `UPSTASH_REDIS_TOKEN` | Supabase Edge Fn Secrets | send-verification-code (rate limit) |
| `ENCRYPTION_SECRET` | Supabase Edge Fn Secrets | save-user-profile, create-boost-payment* |
| `VAPID_PUBLIC_KEY` | Supabase Edge Fn Secrets | get-vapid-key |
| `VAPID_PRIVATE_KEY` | Supabase Edge Fn Secrets | send-push-notification |

> ⚠️ NUNCA commitar secrets no git. O arquivo `.env.local` já está (ou deve estar) no `.gitignore`.
