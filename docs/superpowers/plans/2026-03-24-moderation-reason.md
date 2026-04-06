# Moderation Reason & Gray-Area Logic Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Store and display an AI-generated reason whenever a product is sent to manual review, and auto-approve products when the AI service is unavailable.

**Architecture:** Migration adds `moderation_reason` column. Edge functions generate human-readable reasons for gray-area decisions and include them in responses. Sell.tsx persists the reason to the DB. ModerationQueue shows the reason in the card list and review dialog.

**Tech Stack:** PostgreSQL (Supabase), Deno/TypeScript Edge Functions, React/TypeScript frontend.

---

## File Map

| File | Change |
|---|---|
| `supabase/migrations/20260324200000_add_moderation_reason.sql` | Create — add `moderation_reason TEXT` to `products` |
| `supabase/functions/moderate-text/index.ts` | Modify — AI-down → auto-approve (needsManualReview: false); add `moderationReason` when low confidence |
| `supabase/functions/moderate-image/index.ts` | Modify — same two changes |
| `src/pages/Sell.tsx` | Modify — add `moderationReason` to interfaces; collect + persist reason to DB |
| `src/pages/admin/ModerationQueue.tsx` | Modify — show AI reason in card list + review dialog |

---

## Task 1: Database Migration

**Files:**
- Create: `supabase/migrations/20260324200000_add_moderation_reason.sql`

- [ ] **Step 1: Create the migration file**

```sql
-- Add AI-generated moderation reason to products
-- moderation_reason: set at publish time by the AI when needsManualReview=true
-- moderation_notes: admin's own notes written during manual review (already exists)
ALTER TABLE products ADD COLUMN IF NOT EXISTS moderation_reason TEXT DEFAULT NULL;
```

- [ ] **Step 2: Push to Supabase**

```bash
npx supabase db push
```

Expected: `Applying migration 20260324200000_add_moderation_reason.sql` with no errors.

- [ ] **Step 3: Verify column exists**

Go to Supabase dashboard → Table Editor → `products` → confirm `moderation_reason` column is present.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260324200000_add_moderation_reason.sql
git commit -m "feat: add moderation_reason column to products"
```

---

## Task 2: Update `moderate-text` Edge Function

**Files:**
- Modify: `supabase/functions/moderate-text/index.ts`

Two changes:
1. When AI is **unavailable** (all retries failed): return `needsManualReview: false` — auto-approve, no queue.
2. When AI returns **low confidence** (gray area): include `moderationReason` string in response.

- [ ] **Step 1: Fix AI-unavailable response (auto-approve)**

Find the block that currently returns `needsManualReview: true` when all retries fail and change it:

```typescript
// BEFORE (around line 176):
    if (!moderationResponse || !moderationResponse.ok) {
      console.warn('[moderate-text] All retry attempts failed, failing open:', lastError);

      return new Response(
        JSON.stringify({
          textApproved: true,
          moderationFlagged: false,
          moderationCategories: {},
          needsManualReview: true,         // ← CHANGE THIS to false
          error: 'Serviço de moderação temporariamente indisponível',
        } as TextModerationResult),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }
```

```typescript
// AFTER:
    if (!moderationResponse || !moderationResponse.ok) {
      console.warn('[moderate-text] AI unavailable — auto-approving:', lastError);

      return new Response(
        JSON.stringify({
          textApproved: true,
          moderationFlagged: false,
          moderationCategories: {},
          needsManualReview: false,
        } as TextModerationResult),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }
```

- [ ] **Step 2: Add `moderationReason` to the `TextModerationResult` interface**

```typescript
// BEFORE:
interface TextModerationResult {
  textApproved: boolean;
  moderationFlagged: boolean;
  moderationCategories: Record<string, boolean>;
  flaggedField?: 'title' | 'description' | 'both';
  confidenceScore?: number;
  needsManualReview?: boolean;
  error?: string;
}
```

```typescript
// AFTER: add moderationReason field
interface TextModerationResult {
  textApproved: boolean;
  moderationFlagged: boolean;
  moderationCategories: Record<string, boolean>;
  flaggedField?: 'title' | 'description' | 'both';
  confidenceScore?: number;
  needsManualReview?: boolean;
  moderationReason?: string;
  error?: string;
}
```

- [ ] **Step 3: Generate `moderationReason` when confidence is low**

Find the section that computes `needsManualReview` and `textApproved` (around line 252) and add reason generation right after:

```typescript
// Determine if manual review is needed (low confidence)
const needsManualReview = confidence < LOW_CONFIDENCE_THRESHOLD;

// Text is approved only if NOT flagged AND confidence is high enough
const textApproved = !flagged && !needsManualReview;

// Generate human-readable reason for gray-area decisions
const moderationReason = needsManualReview
  ? `Texto com confiança baixa na análise (${Math.round(confidence * 100)}%). Não foi possível determinar com certeza se o conteúdo é adequado.`
  : undefined;
```

- [ ] **Step 4: Include `moderationReason` in the final return**

```typescript
// BEFORE:
    return new Response(
      JSON.stringify({
        textApproved,
        moderationFlagged: flagged,
        moderationCategories: categories,
        flaggedField: flagged ? flaggedField : undefined,
        confidenceScore: confidence,
        needsManualReview,
      } as TextModerationResult),
```

```typescript
// AFTER:
    return new Response(
      JSON.stringify({
        textApproved,
        moderationFlagged: flagged,
        moderationCategories: categories,
        flaggedField: flagged ? flaggedField : undefined,
        confidenceScore: confidence,
        needsManualReview,
        moderationReason,
      } as TextModerationResult),
```

- [ ] **Step 5: Deploy**

```bash
npx supabase functions deploy moderate-text --no-verify-jwt
```

Expected: `Deployed Functions on project ...: moderate-text`

- [ ] **Step 6: Commit**

```bash
git add supabase/functions/moderate-text/index.ts
git commit -m "feat: moderate-text — auto-approve on AI outage, add moderationReason for gray area"
```

---

## Task 3: Update `moderate-image` Edge Function

**Files:**
- Modify: `supabase/functions/moderate-image/index.ts`

Same two changes as Task 2.

- [ ] **Step 1: Fix AI-unavailable response (auto-approve)**

```typescript
// BEFORE (around line 271):
    if (!moderationResponse || !moderationResponse.ok) {
      console.warn('[moderate-image] All retry attempts failed, failing open:', lastError);

      return new Response(
        JSON.stringify({
          imageApproved: true,
          moderationFlagged: false,
          moderationCategories: {},
          needsManualReview: true,         // ← CHANGE THIS to false
          error: 'Serviço de moderação temporariamente indisponível',
        } as ModerationResult),
```

```typescript
// AFTER:
    if (!moderationResponse || !moderationResponse.ok) {
      console.warn('[moderate-image] AI unavailable — auto-approving:', lastError);

      return new Response(
        JSON.stringify({
          imageApproved: true,
          moderationFlagged: false,
          moderationCategories: {},
          needsManualReview: false,
        } as ModerationResult),
```

- [ ] **Step 2: Add `moderationReason` to the `ModerationResult` interface**

```typescript
// BEFORE:
interface ModerationResult {
  imageApproved: boolean;
  moderationFlagged: boolean;
  moderationCategories: Record<string, boolean>;
  confidenceScore?: number;
  needsManualReview?: boolean;
  error?: string;
}
```

```typescript
// AFTER:
interface ModerationResult {
  imageApproved: boolean;
  moderationFlagged: boolean;
  moderationCategories: Record<string, boolean>;
  confidenceScore?: number;
  needsManualReview?: boolean;
  moderationReason?: string;
  error?: string;
}
```

- [ ] **Step 3: Generate `moderationReason` after computing `needsManualReview`**

Find the line `const needsManualReview = !hasBlockingCategory && confidence < LOW_CONFIDENCE_THRESHOLD;` (around line 364) and add right after:

```typescript
const needsManualReview = !hasBlockingCategory && confidence < LOW_CONFIDENCE_THRESHOLD;

const moderationReason = needsManualReview
  ? `Imagem na área cinzenta: confiança de ${Math.round(confidence * 100)}% na análise. Revisão humana necessária.`
  : undefined;
```

- [ ] **Step 4: Include `moderationReason` in the final return**

```typescript
// BEFORE:
    return new Response(
      JSON.stringify({
        imageApproved,
        moderationFlagged: flagged || hasBlockingCategory,
        moderationCategories: categories,
        confidenceScore: confidence,
        needsManualReview,
      } as ModerationResult),
```

```typescript
// AFTER:
    return new Response(
      JSON.stringify({
        imageApproved,
        moderationFlagged: flagged || hasBlockingCategory,
        moderationCategories: categories,
        confidenceScore: confidence,
        needsManualReview,
        moderationReason,
      } as ModerationResult),
```

- [ ] **Step 5: Deploy**

```bash
npx supabase functions deploy moderate-image --no-verify-jwt
```

- [ ] **Step 6: Commit**

```bash
git add supabase/functions/moderate-image/index.ts
git commit -m "feat: moderate-image — auto-approve on AI outage, add moderationReason for gray area"
```

---

## Task 4: Update Sell.tsx — Collect and Persist Reason

**Files:**
- Modify: `src/pages/Sell.tsx`

- [ ] **Step 1: Add `moderationReason` to the `ModerationResult` and `TextModerationResult` interfaces**

```typescript
// ModerationResult interface (around line 36):
interface ModerationResult {
  imageApproved: boolean;
  moderationFlagged: boolean;
  moderationCategories: Record<string, boolean>;
  confidenceScore?: number;
  needsManualReview?: boolean;
  reason?: string;
  moderationReason?: string;   // ← add this
  error?: string;
}

// TextModerationResult interface (around line 113):
interface TextModerationResult {
  textApproved: boolean;
  moderationFlagged: boolean;
  moderationCategories: Record<string, boolean>;
  flaggedField?: 'title' | 'description' | 'both';
  confidenceScore?: number;
  needsManualReview?: boolean;
  moderationReason?: string;   // ← add this
  error?: string;
}
```

- [ ] **Step 2: Fix error/catch handlers in `moderateText` to NOT send to manual review when AI is down**

Find the error handler inside `moderateText` function (around line 348) and update both handlers:

```typescript
// BEFORE (error handler):
      if (error) {
        console.warn('[Sell] Text moderation API error, failing open:', error);
        return {
          textApproved: true,
          moderationFlagged: false,
          moderationCategories: {},
          needsManualReview: true,
          error: error.message || 'Erro ao verificar texto',
        };
      }
```

```typescript
// AFTER:
      if (error) {
        console.warn('[Sell] Text moderation API error, auto-approving:', error);
        return {
          textApproved: true,
          moderationFlagged: false,
          moderationCategories: {},
          needsManualReview: false,
        };
      }
```

```typescript
// BEFORE (catch handler):
    } catch (error) {
      console.warn('[Sell] Text moderation error, failing open:', error);
      return {
        textApproved: true,
        moderationFlagged: false,
        moderationCategories: {},
        needsManualReview: true,
        error: 'Erro ao conectar com o serviço de moderação',
      };
    }
```

```typescript
// AFTER:
    } catch (error) {
      console.warn('[Sell] Text moderation error, auto-approving:', error);
      return {
        textApproved: true,
        moderationFlagged: false,
        moderationCategories: {},
        needsManualReview: false,
      };
    }
```

- [ ] **Step 3: Collect reasons from image and text moderation results**

Find the section after `needsManualReview` is set to true for text (around line 549) and add reason collection:

```typescript
// Declare reasons array near the top of handleSubmit, alongside needsManualReview:
// (add right after: let needsManualReview = false;)
const moderationReasons: string[] = [];
```

Then, where image moderation sets `needsManualReview = true` (around line 505):

```typescript
// BEFORE:
        if (moderationResult.needsManualReview) {
          needsManualReview = true;
          console.log('[Sell] Image needs manual review due to low confidence:', moderationResult.confidenceScore);
        }
```

```typescript
// AFTER:
        if (moderationResult.needsManualReview) {
          needsManualReview = true;
          if (moderationResult.moderationReason) moderationReasons.push(moderationResult.moderationReason);
          console.log('[Sell] Image needs manual review due to low confidence:', moderationResult.confidenceScore);
        }
```

And where text moderation sets `needsManualReview = true` (around line 551):

```typescript
// BEFORE:
      if (textModerationResult.needsManualReview) {
        needsManualReview = true;
        console.log('[Sell] Text needs manual review due to low confidence:', textModerationResult.confidenceScore);
      }
```

```typescript
// AFTER:
      if (textModerationResult.needsManualReview) {
        needsManualReview = true;
        if (textModerationResult.moderationReason) moderationReasons.push(textModerationResult.moderationReason);
        console.log('[Sell] Text needs manual review due to low confidence:', textModerationResult.confidenceScore);
      }
```

- [ ] **Step 4: Persist `moderation_reason` in `productData`**

Find where `productData` is constructed (around line 566) and add the field:

```typescript
const productData: Record<string, unknown> = {
  // ... existing fields ...
  status: productStatus,
  moderation_status: needsManualReview ? 'pending' : 'approved',
  moderated_at: new Date().toISOString(),
  review_notes: null,
  reviewed_by: null,
  moderation_reason: moderationReasons.length > 0 ? moderationReasons.join(' | ') : null,  // ← add
};
```

- [ ] **Step 5: Verify manually**

Publish a product with clear content (e.g., "Camiseta branca tamanho M"). Expected:
- Network tab: `moderate-text` and `moderate-image` both return `needsManualReview: false`
- Product is saved with `status: active` (not `pending_review`)
- `moderation_reason` is `null` in the DB

Then test the gray-area path by checking Supabase logs after publishing. Products with confidence < threshold should show `moderation_reason` set.

- [ ] **Step 6: Commit**

```bash
git add src/pages/Sell.tsx
git commit -m "feat: collect and persist moderation_reason for gray-area products"
```

---

## Task 5: Update ModerationQueue — Display AI Reason

**Files:**
- Modify: `src/pages/admin/ModerationQueue.tsx`

- [ ] **Step 1: Add `moderation_reason` to the `PendingProduct` interface**

```typescript
// BEFORE:
interface PendingProduct {
  id: string;
  title: string;
  description: string;
  price: number;
  images: string[];
  brand: string;
  size: string;
  category: string;
  condition: string;
  created_at: string;
  seller_id: string;
  seller_city: string | null;
  seller_state: string | null;
  moderation_status: string | null;
  moderation_notes: string | null;
}
```

```typescript
// AFTER: add moderation_reason
interface PendingProduct {
  id: string;
  title: string;
  description: string;
  price: number;
  images: string[];
  brand: string;
  size: string;
  category: string;
  condition: string;
  created_at: string;
  seller_id: string;
  seller_city: string | null;
  seller_state: string | null;
  moderation_status: string | null;
  moderation_notes: string | null;
  moderation_reason: string | null;
}
```

- [ ] **Step 2: Show truncated reason in the card list**

Find the card list `<div className="flex gap-2 mt-2">` (around line 341) and add a reason badge below the "Revisão pendente" badge:

```tsx
<div className="flex flex-col gap-1 mt-2">
  <Badge variant="secondary">
    <AlertTriangle className="w-3 h-3 mr-1" />
    Revisão pendente
  </Badge>
  {product.moderation_reason && (
    <p className="text-xs text-amber-600 dark:text-amber-400 line-clamp-2">
      {product.moderation_reason}
    </p>
  )}
</div>
```

- [ ] **Step 3: Show full reason in the review dialog**

Find the `{/* Product Info */}` section inside the Dialog (around line 418) and add an AI reason box at the top of that section:

```tsx
{/* AI Moderation Reason */}
{selectedProduct.moderation_reason && (
  <div className="rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 p-3">
    <div className="flex items-start gap-2">
      <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
      <div>
        <p className="text-xs font-medium text-amber-800 dark:text-amber-300 mb-1">
          Motivo do envio para revisão (IA)
        </p>
        <p className="text-xs text-amber-700 dark:text-amber-400">
          {selectedProduct.moderation_reason}
        </p>
      </div>
    </div>
  </div>
)}
```

Place this block right before the "Título" field inside the `<div className="space-y-3">`.

- [ ] **Step 4: Verify manually**

Go to `/admin/moderation`. If any product has `moderation_reason` set, it should show:
- In card list: amber text below the badge
- In review dialog: amber box at top of product info section

- [ ] **Step 5: Commit**

```bash
git add src/pages/admin/ModerationQueue.tsx
git commit -m "feat: show AI moderation reason in moderation queue"
```
