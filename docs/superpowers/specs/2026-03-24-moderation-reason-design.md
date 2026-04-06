# Design: Moderation Reason & Gray-Area Logic

**Date:** 2026-03-24
**Status:** Approved

## Summary

Refine the automatic content moderation system so that:
1. Only truly uncertain ("gray area") content goes to manual review — not content the AI confidently approves.
2. When the AI service is unavailable, items are auto-approved (fail-open), not queued for review.
3. When an item IS sent to manual review, the AI's reason is stored and shown to the admin.

## Current State

- `moderate-text` and `moderate-image` edge functions call Gemini.
- If AI is unavailable → `needsManualReview: true` → product gets `status: pending_review`.
- If AI returns low confidence → same `needsManualReview: true` path.
- If AI is confident and safe → `status: active`.
- No reason is stored explaining why an item went to manual review.
- ModerationQueue shows items with no context — admin has to guess why it was flagged.

## Changes

### 1. Database Migration

Add column to `products`:

```sql
ALTER TABLE products ADD COLUMN moderation_reason TEXT DEFAULT NULL;
```

`moderation_reason` = AI-generated reason the item needs human review (set at publish time).
`moderation_notes` = admin's own notes written during review (already exists, unchanged).

### 2. Edge Functions: `moderate-text` and `moderate-image`

**When AI is unavailable (all retries failed):**
- Return `textApproved: true` / `imageApproved: true`, `needsManualReview: false` — auto-approve, no reason stored.
- No 503, no pending_review.

**When AI returns low confidence (gray area):**
- Return `needsManualReview: true`.
- Include new field `moderationReason: string` with a human-readable explanation.

Example reasons:
- Text: `"Texto com confiança baixa na análise (58%). Não foi possível determinar com certeza se o conteúdo é adequado."`
- Image: `"Imagem na área cinzenta: confiança de 62% na análise. Revisão humana necessária."`

The edge function response interface gains:
```typescript
moderationReason?: string;
```

### 3. Sell.tsx

- Collect `moderationReason` from both text and image moderation results.
- When product status is `pending_review`, write the combined reason to `moderation_reason` in the DB insert/update.
- Format: if both have reasons, join with `" | "`. If only one, use that.

### 4. ModerationQueue.tsx

- Add `moderation_reason` to the `PendingProduct` interface.
- **In the card list**: show a small amber badge with the reason if present (truncated to ~60 chars).
- **In the review dialog**: show a highlighted box (amber background) with the full AI reason before the admin notes field.

## Behavior Matrix

| Scenario | Result |
|---|---|
| AI confident, content safe | `status: active` — no manual review |
| AI low confidence (gray area) | `status: pending_review` + `moderation_reason` stored |
| AI flags clear violation | Blocked at publish, toast shown to user |
| AI service unavailable | `status: active` — auto-approved, no queue |

## Files Changed

| File | Change |
|---|---|
| `supabase/migrations/YYYYMMDD_add_moderation_reason.sql` | Add `moderation_reason` column |
| `supabase/functions/moderate-text/index.ts` | AI-down → approve; add `moderationReason` to response |
| `supabase/functions/moderate-image/index.ts` | Same |
| `src/pages/Sell.tsx` | Collect + persist `moderation_reason` |
| `src/pages/admin/ModerationQueue.tsx` | Display AI reason in card + dialog |
