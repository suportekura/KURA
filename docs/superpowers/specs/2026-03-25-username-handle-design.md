# Design Spec: @username Handle System

**Date:** 2026-03-25
**Status:** Approved
**Scope:** Username handle (@) creation, display, migration, and profile search

---

## Overview

Add an Instagram-style `@username` (handle) to each user profile on Kura. The handle is a unique, URL-safe identifier that allows users to find profiles on the search page. It is displayed on both the user's own profile (`/profile`) and the public seller profile (`/seller/:id`).

---

## 1. Database Changes

### 1.1 Migration — `profiles` table

All schema changes are in a **single migration file** to avoid dependency ordering issues:

```sql
-- Add columns
ALTER TABLE public.profiles
  ADD COLUMN username TEXT UNIQUE,
  ADD COLUMN username_updated_at TIMESTAMP WITH TIME ZONE;

-- Format constraint:
-- • 3–30 chars
-- • Must start and end with letter or digit
-- • Allowed interior chars: letters, digits, dot (.), underscore (_)
-- • Mixed consecutive specials (._  or _.) ARE allowed
-- • Only banned consecutive pairs: ".." and "__"
ALTER TABLE public.profiles
  ADD CONSTRAINT username_format CHECK (
    username ~ '^[a-zA-Z0-9][a-zA-Z0-9._]{1,28}[a-zA-Z0-9]$'
    AND username !~ '\.\.'
    AND username !~ '__'
  );

-- Case-insensitive unique index
CREATE UNIQUE INDEX idx_profiles_username_lower ON public.profiles (LOWER(username));

-- Update public_profiles view to expose username fields
-- (DROP and recreate the view with username and username_updated_at added)
```

**Field behavior:**
- `username` is nullable — existing users start with NULL
- `username_updated_at` is set to `now()` **only on updates** (not on first creation), so the cooldown does NOT apply after the initial username choice. The cooldown applies from the first change onward.
- `username_updated_at` IS NULL for users who have set their username only once and never changed it — this is the "never changed" state (free to edit)
- Case-insensitive lookup via `LOWER()` index; stored as typed by user

### 1.2 RLS Policy for `username`

- `username` is publicly readable via the `public_profiles` view (anon key access)
- Only the owner can UPDATE their own `username` (existing `profiles` RLS UPDATE policy covers this)

### 1.3 Update `public_profiles` view

Add `username` and `username_updated_at` to the existing `public_profiles` view. Done in the same migration file as the column addition (see 1.1).

### 1.4 Availability Check

Frontend availability checks query the `public_profiles` **view** (not the `profiles` table directly) using the anon key:

```typescript
const { data } = await supabase
  .from('public_profiles')
  .select('user_id')
  .eq('username', input.toLowerCase())
  .maybeSingle();
// available if data === null
```

This works because `public_profiles` is publicly readable via RLS. No separate RPC needed.

### 1.5 New RPC: `search_profiles`

```sql
CREATE OR REPLACE FUNCTION public.search_profiles(p_query TEXT)
RETURNS TABLE (
  user_id UUID,
  display_name TEXT,
  username TEXT,
  avatar_url TEXT,
  city TEXT,
  plan_type TEXT,
  sold_count INTEGER
)
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT
    p.user_id,
    p.display_name,
    p.username,
    p.avatar_url,
    p.city,
    us.plan_type,        -- NULL for free users (LEFT JOIN)
    p.sold_count
  FROM public.profiles p
  LEFT JOIN public.user_subscriptions us
    ON us.user_id = p.user_id
    AND us.expires_at > now()
  WHERE
    p.suspended_at IS NULL
    AND p.username IS NOT NULL
    AND (
      LOWER(p.username) LIKE '%' || LOWER(LTRIM(p_query, '@')) || '%'
      OR p.display_name ILIKE '%' || LTRIM(p_query, '@') || '%'
    )
  LIMIT 20;
$$;
```

**Notes:**
- Uses `LEFT JOIN` on `user_subscriptions` — free users (no subscription row) are included with `plan_type = NULL`
- Strips leading `@` from `p_query` with `LTRIM(p_query, '@')` in SQL, as a safety measure (frontend also strips it)
- Excludes users without a username (`username IS NOT NULL`)
- Excludes suspended users
- Limited to 20 results

### 1.6 Update `get_admin_users_list` RPC

Add `OR p.username ILIKE '%' || p_search || '%'` to the existing `WHERE` search condition so admin panel can find users by handle.

---

## 2. Username Rules

| Rule | Detail |
|------|--------|
| Characters allowed | Letters (a–z, A–Z), digits (0–9), dot (`.`), underscore (`_`) |
| Length | 3–30 characters |
| Leading/trailing | Must start and end with a letter or digit |
| Consecutive banned pairs | `..` and `__` are banned. Mixed pairs `._` and `_.` **are allowed** |
| Uniqueness | Case-insensitive (stored as typed, compared with `LOWER()`) |
| Cooldown | 30 days between **changes** — first creation has no cooldown |

**Frontend regex:**
```typescript
const USERNAME_REGEX = /^[a-zA-Z0-9][a-zA-Z0-9._]{1,28}[a-zA-Z0-9]$/;
const hasBannedPairs = (v: string) => v.includes('..') || v.includes('__');
// Valid if: length >= 3, matches regex, !hasBannedPairs
```

**Valid examples:** `@luis.felipe`, `@luis_felipe`, `@luis12felipe`, `@luis._f`
**Invalid examples:** `@.luis`, `@luis.`, `@luis..f`, `@luis__f`, `@lu` (too short), `@luis felipe` (space)

---

## 3. Signup Flow (New Users)

### Step 5 — "Dados Complementares" (existing step, extended)

The `@username` field is added to the existing profile completion step (`Auth.tsx`, step `profile`).

**Field behavior:**
- `@` prefix is displayed as a fixed visual prefix (not part of the stored value)
- Auto-suggests 3 handles generated client-side from `display_name` (e.g., `luisfelipe`, `luis_felipe`, `luis.f`)
- Suggestions are checked for availability on selection (same debounced flow as manual typing)
- Real-time validation:
  1. **Format check** (local, immediate) — regex + length + banned pairs
  2. **Availability check** (remote, debounced 500ms) — queries `public_profiles` view
- Visual states: typing → checking → available (green) / taken (red) / invalid format (amber)
- Button "Continuar" disabled until state is "available"
- Field is **required** — cannot advance without a valid, available username
- On save: `profiles.update({ username })` — `username_updated_at` is **NOT set** on first creation

**Race condition on save (signup):** If two users race on the same username and the Postgres unique constraint rejects the save, show an inline error on the username field: "Este @username acabou de ser escolhido por outra pessoa. Escolha outro." The "Continuar" button returns to disabled, the field re-enters the "checking" state, and the user must pick a new handle.

---

## 4. Migration Flow (Existing Users)

Users with `username IS NULL` are shown a **bottom sheet** that cannot be dismissed.

**Trigger location:** `AuthProvider` adds `hasUsername: boolean` to profile status (derived from `profile.username !== null`). `AppLayout` renders `<UsernameSetupSheet>` when `!hasUsername`.

**Admin/moderator bypass:** Users with role `admin` or `moderator` skip this gate entirely — `AppLayout` checks for admin/moderator role before rendering `UsernameSetupSheet`. This ensures the admin panel remains accessible during the migration rollout. Admins and moderators should set their username voluntarily via Settings.

**Sheet behavior:**
- Renders on top of any page (except admin routes)
- Cannot be closed (no X button, no backdrop dismiss)
- Contains the same username input + validation as signup step
- Save button shows a loading spinner while the update is in flight; button is disabled during loading
- On save success: `profiles.update({ username })` — `username_updated_at` is NOT set (first creation)
- On save success: `AuthProvider` sets `hasUsername = true`, sheet unmounts
- On save error (network/constraint): show inline error message inside the sheet ("Erro ao salvar. Tente outro username ou tente novamente."); sheet remains open; button re-enables

**AuthProvider changes:**
- Add `hasUsername: boolean` to profile status interface
- Derived from `profile.username !== null`
- Cached alongside existing `emailVerified`, `profileCompleted` checks

---

## 5. Profile Display

### 5.1 `/profile` — Own profile

Below `display_name`:
```
Luis Felipe          ← display_name (existing, bold)
@luis.felipe         ← username (new, olive green #5a7a32, font-medium)
[✦ PLUS]             ← plan badge (existing, shown if plan != free)
```

- Clicking `@luis.felipe` navigates to `EditProfile` (settings) where username can be edited

### 5.2 `/seller/:id` — Public profile

Same visual hierarchy as own profile:
```
Luis Felipe
@luis.felipe
[✦ PLUS]
📍 São Paulo, SP
```

- `@username` is read-only (no link)

---

## 6. Search Page — Profile Tab

### 6.1 Tab structure

The existing `/search` page gains two tabs:
- **"Vestuário"** (default, active) — existing product search, no changes
- **"Perfis"** — new profile search

Tab state: `activeTab: 'clothing' | 'profiles'`, controlled with `useState`. Uses existing `cn()` styling pattern.

### 6.2 Profile search behavior

- Input placeholder: `"Buscar por @username ou nome"`
- Strips leading `@` from query before calling `search_profiles` RPC
- Minimum 2 characters to trigger search
- Debounce: 500ms
- Results: vertical list of profile cards (not grid)

### 6.3 Profile card

```
[Avatar] Luis Felipe         [Ver perfil →]
         @luis.felipe
         [✦ LOJA]
```

- Avatar: 44×44px circle, fallback to initials from `display_name`
- Plan badge shown only if `plan_type` is `plus`, `brecho`, or `loja` (NULL / free = no badge)
- "Ver perfil" navigates to `/seller/:user_id`
- Suspended users excluded from results (RPC handles this)

### 6.4 Empty / loading states

- **No query yet (< 2 chars):** "Digite @username ou nome de uma loja"
- **Loading:** 3 skeleton cards
- **No results:** "Nenhum perfil encontrado para '@{query}'"
- **Error:** "Erro ao buscar perfis. Tente novamente."

---

## 7. Edit @username (Settings)

### 7.1 Access

- From `/profile`: click on `@username` text → navigates to `EditProfile`
- In `EditProfile` (`/settings/profile`): dedicated `@username` row with inline edit section

**Decision: inline in `EditProfile`** — no new page or route created. The username edit section is rendered inside the existing `EditProfile.tsx` page, below the `display_name` field.

### 7.2 Edit section in EditProfile

**State: can edit** (`username_updated_at IS NULL` OR `username_updated_at < now() - interval '30 days'`)
- Input with `@` prefix, real-time validation (same as signup)
- Warning: "Após alterar, você só poderá trocar novamente em 30 dias"
- Save button calls `profiles.update({ username, username_updated_at: new Date().toISOString() })`

**State: cooldown active** (`username_updated_at IS NOT NULL AND username_updated_at > now() - interval '30 days'`)
- Input disabled
- Shows: "🔒 Alteração bloqueada — Próxima troca disponível em X dias"
- Days remaining: `Math.ceil((new Date(username_updated_at).getTime() + 30 * 86400000 - Date.now()) / 86400000)`
- Save button disabled

**Note on first creation vs. update:**
- First creation (via signup or migration sheet): `username_updated_at` is NOT set → user is always in "can edit" state for their first voluntary change
- After the first change via Settings: `username_updated_at` is set → 30-day cooldown begins

### 7.3 Error handling

- Postgres unique constraint violation (race condition): toast "Este @username foi escolhido por outra pessoa agora mesmo. Tente outro."
- Network error: toast "Erro ao salvar. Tente novamente."

---

## 8. Out of Scope

- `/seller/@luis.felipe` URL routing (navigation continues via UUID)
- `seller_username` in `get_products_with_distance` RPC (product cards don't show seller's `@`)
- Username reservation for deleted accounts
- Username history tracking

---

## 9. Files Affected

| File | Change |
|------|--------|
| `supabase/migrations/YYYYMMDD_add_username_system.sql` | Single migration: column, constraint, index, view update, `search_profiles` RPC, `get_admin_users_list` update |
| `src/hooks/useAuth.tsx` | Add `hasUsername` to profile status |
| `src/pages/Auth.tsx` | Add username field + suggestions to signup step 5 |
| `src/components/auth/UsernameSetupSheet.tsx` | New component — migration bottom sheet (blocking, with loading/error states) |
| `src/components/layout/AppLayout.tsx` | Render `UsernameSetupSheet` when `!hasUsername` (skip for admin/moderator) |
| `src/pages/Profile.tsx` | Display `@username` below display_name |
| `src/pages/SellerProfile.tsx` | Display `@username` below display_name |
| `src/pages/Search.tsx` | Add tabs (Vestuário / Perfis) + profile search |
| `src/pages/settings/EditProfile.tsx` | Add inline username edit section with cooldown logic |
| `src/hooks/useProfileSearch.ts` | New hook — calls `search_profiles` RPC with debounce |
