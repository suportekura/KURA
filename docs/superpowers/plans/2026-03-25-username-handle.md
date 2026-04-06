# @username Handle System — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a unique `@username` handle to every Kura profile, display it on profile pages, and enable profile search by handle on the `/search` page.

**Architecture:** A single database migration adds `username` + `username_updated_at` to `profiles`, updates the `public_profiles` view, and adds the `search_profiles` RPC. A shared validation utility centralises format rules. `AuthProvider` gains a `hasUsername` flag used by `AppLayout` to gate a blocking bottom sheet for existing users without a handle. Signup step 5, both profile pages, the search page, and `EditProfile` are updated accordingly.

**Tech Stack:** React 18, TypeScript, Supabase (PostgreSQL + anon client), TanStack React Query v5, Tailwind CSS, shadcn/ui, Framer Motion, Sonner (toasts)

**Spec:** `docs/superpowers/specs/2026-03-25-username-handle-design.md`

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `supabase/migrations/20260325000000_add_username_system.sql` | Create | All DB changes: column, constraint, index, view, RPCs |
| `src/lib/usernameValidation.ts` | Create | Shared format validation + suggestion generation |
| `src/hooks/useAuth.tsx` | Modify | Add `hasUsername` to `ProfileStatus`; fetch `username` from DB |
| `src/components/auth/UsernameSetupSheet.tsx` | Create | Blocking bottom sheet for existing users without a handle |
| `src/components/layout/AppLayout.tsx` | Modify | Render `UsernameSetupSheet` when `!hasUsername` (skip admins) |
| `src/pages/Auth.tsx` | Modify | Add `@username` field + chip suggestions to signup step `profile` |
| `src/pages/Profile.tsx` | Modify | Show `@username` below `display_name`, clickable to EditProfile |
| `src/pages/SellerProfile.tsx` | Modify | Show `@username` below `display_name`, read-only |
| `src/hooks/useProfileSearch.ts` | Create | Debounced `search_profiles` RPC query hook |
| `src/pages/Search.tsx` | Modify | Add Vestuário / Perfis tabs; Perfis tab uses `useProfileSearch` |
| `src/pages/settings/EditProfile.tsx` | Modify | Add inline `@username` section with cooldown logic |

---

## Task 1: Database Migration

**Files:**
- Create: `supabase/migrations/20260325000000_add_username_system.sql`

- [ ] **Step 1: Create the migration file**

```sql
-- supabase/migrations/20260325000000_add_username_system.sql

-- 1. Add columns to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS username TEXT,
  ADD COLUMN IF NOT EXISTS username_updated_at TIMESTAMP WITH TIME ZONE;

-- 2. Unique constraint (applied separately so violation messages are clear)
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_username_unique UNIQUE (username);

-- 3. Format constraint
--    • 3–30 chars
--    • Must start and end with a letter or digit
--    • Allowed interior: letters, digits, dot (.), underscore (_)
--    • ".." and "__" are banned; mixed "_." and "._" are allowed
ALTER TABLE public.profiles
  ADD CONSTRAINT username_format CHECK (
    username IS NULL
    OR (
      username ~ '^[a-zA-Z0-9][a-zA-Z0-9._]{1,28}[a-zA-Z0-9]$'
      AND username !~ '\.\.'
      AND username !~ '__'
    )
  );

-- 4. Case-insensitive unique index (enforces uniqueness across case)
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_username_lower
  ON public.profiles (LOWER(username))
  WHERE username IS NOT NULL;

-- 5. Update public_profiles view to expose username fields
--    (DROP + recreate to add the two new columns)
DROP VIEW IF EXISTS public.public_profiles;
CREATE OR REPLACE VIEW public.public_profiles
WITH (security_invoker = on) AS
SELECT
  user_id,
  display_name,
  username,
  username_updated_at,
  avatar_url,
  shop_logo_url,
  banner_url,
  shop_description,
  business_hours,
  city,
  social_instagram,
  social_website,
  seller_reviews_count,
  seller_reviews_sum,
  buyer_reviews_count,
  buyer_reviews_sum,
  sold_count,
  followers_count,
  created_at
FROM public.profiles;

-- 6. New RPC: search_profiles
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
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p.user_id,
    p.display_name,
    p.username,
    p.avatar_url,
    p.city,
    us.plan_type,
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

-- 7. Update get_admin_users_list to also search by username
--    Find the two WHERE clauses in the existing function and add the username condition.
--    The function body references p.display_name ILIKE and p.full_name ILIKE — add username:
CREATE OR REPLACE FUNCTION public.get_admin_users_list(
  p_limit INTEGER DEFAULT 20,
  p_offset INTEGER DEFAULT 0,
  p_search TEXT DEFAULT NULL,
  p_plan_filter TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result JSONB;
  total_count INTEGER;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT count(*) INTO total_count
  FROM profiles p
  LEFT JOIN user_subscriptions us ON us.user_id = p.user_id
  WHERE (
    p_search IS NULL
    OR p.display_name ILIKE '%' || p_search || '%'
    OR p.full_name ILIKE '%' || p_search || '%'
    OR p.username ILIKE '%' || p_search || '%'
  )
  AND (p_plan_filter IS NULL OR COALESCE(us.plan_type, 'free') = p_plan_filter);

  SELECT jsonb_build_object(
    'users', COALESCE(jsonb_agg(row_to_json(u.*) ORDER BY u.created_at DESC), '[]'::jsonb),
    'total', total_count
  ) INTO result
  FROM (
    SELECT
      p.user_id,
      p.display_name,
      p.full_name,
      p.username,
      p.avatar_url,
      p.city,
      p.created_at,
      p.updated_at,
      p.profile_completed,
      p.suspended_at,
      p.suspension_reason,
      COALESCE(us.plan_type, 'free') AS plan_type,
      us.expires_at AS plan_expires_at,
      (SELECT array_agg(ur.role) FROM user_roles ur WHERE ur.user_id = p.user_id) AS roles
    FROM profiles p
    LEFT JOIN user_subscriptions us ON us.user_id = p.user_id
    WHERE (
      p_search IS NULL
      OR p.display_name ILIKE '%' || p_search || '%'
      OR p.full_name ILIKE '%' || p_search || '%'
      OR p.username ILIKE '%' || p_search || '%'
    )
    AND (p_plan_filter IS NULL OR COALESCE(us.plan_type, 'free') = p_plan_filter)
    ORDER BY p.created_at DESC
    LIMIT p_limit OFFSET p_offset
  ) u;

  RETURN result;
END;
$$;
```

- [ ] **Step 2: Push migration to Supabase**

```bash
npx supabase db push
```

Expected: no errors. Verify in Supabase dashboard → Table Editor → `profiles` table has `username` and `username_updated_at` columns.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260325000000_add_username_system.sql
git commit -m "feat(db): add username column, search_profiles RPC, update public_profiles view"
```

---

## Task 2: Username Validation Utility

**Files:**
- Create: `src/lib/usernameValidation.ts`

This module is the single source of truth for username rules used by signup, migration sheet, and settings.

- [ ] **Step 1: Create the file**

```typescript
// src/lib/usernameValidation.ts

export const USERNAME_REGEX = /^[a-zA-Z0-9][a-zA-Z0-9._]{1,28}[a-zA-Z0-9]$/;

export function isValidUsernameFormat(value: string): { valid: boolean; error?: string } {
  if (!value || value.length < 3) {
    return { valid: false, error: 'Mínimo de 3 caracteres' };
  }
  if (value.length > 30) {
    return { valid: false, error: 'Máximo de 30 caracteres' };
  }
  if (value.includes('..') || value.includes('__')) {
    return { valid: false, error: 'Não pode ter ".." ou "__" consecutivos' };
  }
  if (!USERNAME_REGEX.test(value)) {
    return { valid: false, error: 'Apenas letras, números, ponto (.) e _. Deve começar e terminar com letra ou número.' };
  }
  return { valid: true };
}

/**
 * Generates up to 3 username suggestions from a display name.
 * Strips accents, spaces and invalid chars; produces variant with no separator,
 * underscore, and dot.
 */
export function generateUsernameSuggestions(displayName: string): string[] {
  // Normalise: remove accents, lowercase, keep only valid chars
  const base = displayName
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // strip accent marks
    .toLowerCase()
    .replace(/[^a-z0-9]/g, ' ')       // replace invalid chars with space
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (base.length === 0) return [];

  const joined = base.join('');
  const withUnderscore = base.join('_');
  const withDot = base.join('.');

  // Deduplicate and filter by format validity
  return [joined, withUnderscore, withDot]
    .filter((s, i, arr) => arr.indexOf(s) === i)   // unique
    .filter(s => isValidUsernameFormat(s).valid)    // valid format
    .slice(0, 3);
}
```

- [ ] **Step 2: Verify build passes**

```bash
npm run build
```

Expected: no TypeScript errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/usernameValidation.ts
git commit -m "feat: add username format validation and suggestion utilities"
```

---

## Task 3: Update `useAuth` — add `hasUsername` to profile status

**Files:**
- Modify: `src/hooks/useAuth.tsx`

`ProfileStatus` gains `hasUsername: boolean`. `fetchProfileStatus` selects `username` from `profiles` and derives the flag.

- [ ] **Step 1: Extend `ProfileStatus` interface and query**

In `src/hooks/useAuth.tsx`, apply these changes:

```typescript
// 1. Extend the interface (around line 5)
interface ProfileStatus {
  emailVerified: boolean;
  profileCompleted: boolean;
  hasUsername: boolean;   // ← add this
  lastFetched: number;
}
```

```typescript
// 2. Update the Supabase SELECT (around line 66) — add "username" to the select
const profileQuery = supabase
  .from('profiles')
  .select('email_verified, profile_completed, suspended_at, username')
  .eq('user_id', userId)
  .maybeSingle();
```

```typescript
// 3. Set hasUsername in the status object (around line 91)
const status: ProfileStatus = {
  emailVerified: profile?.email_verified ?? false,
  profileCompleted: profile?.profile_completed ?? false,
  hasUsername: profile?.username != null,   // ← add this
  lastFetched: Date.now(),
};
```

- [ ] **Step 2: Expose `hasUsername` via context**

Add a convenience method `markUsernameSet` to allow `UsernameSetupSheet` to optimistically update the status without a full refetch:

```typescript
// Add to AuthContextType interface (around line 26)
markUsernameSet: () => void;
```

```typescript
// Add implementation inside AuthProvider, alongside refreshProfileStatus
const markUsernameSet = useCallback(() => {
  setProfileStatus(prev => prev ? { ...prev, hasUsername: true } : prev);
}, []);
```

```typescript
// Include in context value object
value={{ ..., markUsernameSet }}
```

- [ ] **Step 3: Verify build**

```bash
npm run build
```

Expected: no errors. If there are "property does not exist" errors, also update `AuthContextType` to match.

- [ ] **Step 4: Commit**

```bash
git add src/hooks/useAuth.tsx
git commit -m "feat(auth): add hasUsername to profile status and markUsernameSet helper"
```

---

## Task 4: `UsernameSetupSheet` Component

**Files:**
- Create: `src/components/auth/UsernameSetupSheet.tsx`

Blocking bottom sheet that renders when an authenticated user has no `@username`. Cannot be dismissed. Shares validation logic from Task 2. Queries availability via `public_profiles` view.

- [ ] **Step 1: Create the component**

```typescript
// src/components/auth/UsernameSetupSheet.tsx
import { useState, useEffect, useRef } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { isValidUsernameFormat, generateUsernameSuggestions } from '@/lib/usernameValidation';
import { cn } from '@/lib/utils';

type CheckState = 'idle' | 'checking' | 'available' | 'taken' | 'invalid';

export function UsernameSetupSheet() {
  const { user, profileStatus, markUsernameSet } = useAuth();
  const [value, setValue] = useState('');
  const [checkState, setCheckState] = useState<CheckState>('idle');
  const [formatError, setFormatError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Generate suggestions from user metadata
  useEffect(() => {
    const name = user?.user_metadata?.full_name || '';
    if (name) setSuggestions(generateUsernameSuggestions(name));
  }, [user]);

  const checkAvailability = async (username: string) => {
    setCheckState('checking');
    const { data } = await supabase
      .from('public_profiles')
      .select('user_id')
      .ilike('username', username)
      .is('suspended_at', null)   // exclude suspended users from blocking availability
      .maybeSingle();
    setCheckState(data === null ? 'available' : 'taken');
  };

  const handleChange = (raw: string) => {
    setValue(raw);
    setSaveError(null);

    if (debounceRef.current) clearTimeout(debounceRef.current);

    const { valid, error } = isValidUsernameFormat(raw);
    if (!valid) {
      setFormatError(error || null);
      setCheckState('invalid');
      return;
    }

    setFormatError(null);
    setCheckState('idle');
    debounceRef.current = setTimeout(() => checkAvailability(raw), 500);
  };

  const handleSuggestionClick = (suggestion: string) => {
    setValue(suggestion);
    setSaveError(null);
    setFormatError(null);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    checkAvailability(suggestion);
  };

  const handleSave = async () => {
    if (!user || checkState !== 'available') return;
    setSaving(true);
    setSaveError(null);

    const { error } = await supabase
      .from('profiles')
      .update({ username: value })
      .eq('user_id', user.id);

    setSaving(false);

    if (error) {
      if (error.code === '23505') {
        setSaveError('Este @username acabou de ser escolhido por outra pessoa. Tente outro.');
        setCheckState('taken');
      } else {
        setSaveError('Erro ao salvar. Tente outro username ou tente novamente.');
      }
      return;
    }

    markUsernameSet();
  };

  const borderColor = {
    idle: 'border-border',
    checking: 'border-border',
    available: 'border-green-500',
    taken: 'border-destructive',
    invalid: 'border-amber-500',
  }[checkState];

  const statusMessage = {
    idle: null,
    checking: <span className="text-muted-foreground">⏳ Verificando disponibilidade...</span>,
    available: <span className="text-green-600">✓ @{value} está disponível</span>,
    taken: <span className="text-destructive">✗ @{value} já está em uso</span>,
    invalid: <span className="text-amber-600">{formatError}</span>,
  }[checkState];

  return (
    /* Overlay */
    <div className="fixed inset-0 z-50 bg-black/50 flex items-end">
      <div className="bg-background w-full rounded-t-2xl p-6 space-y-5">
        {/* Handle */}
        <div className="w-10 h-1 bg-muted rounded-full mx-auto" />

        <div className="space-y-1">
          <h2 className="font-display text-xl font-semibold">Escolha seu @username</h2>
          <p className="text-sm text-muted-foreground">
            É seu identificador único na Kura. Você pode alterar uma vez a cada 30 dias após a primeira mudança.
          </p>
        </div>

        {/* Input */}
        <div className="space-y-1">
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-primary font-semibold select-none">@</span>
            <Input
              value={value}
              onChange={(e) => handleChange(e.target.value)}
              placeholder="seu.username"
              className={cn('pl-7 transition-colors', borderColor)}
            />
          </div>
          <p className="text-xs text-muted-foreground">Letras, números, ponto (.) e _ • 3 a 30 caracteres</p>
          {statusMessage && <p className="text-xs mt-1">{statusMessage}</p>}
          {saveError && <p className="text-xs text-destructive mt-1">{saveError}</p>}
        </div>

        {/* Suggestions */}
        {suggestions.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">Sugestões:</p>
            <div className="flex gap-2 flex-wrap">
              {suggestions.map(s => (
                <button
                  key={s}
                  onClick={() => handleSuggestionClick(s)}
                  className="px-3 py-1 rounded-lg bg-primary/10 text-primary text-sm hover:bg-primary/20 transition-colors"
                >
                  @{s}
                </button>
              ))}
            </div>
          </div>
        )}

        <Button
          onClick={handleSave}
          disabled={checkState !== 'available' || saving}
          className="w-full"
        >
          {saving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
          Confirmar @username
        </Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify build**

```bash
npm run build
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/auth/UsernameSetupSheet.tsx
git commit -m "feat: add UsernameSetupSheet blocking bottom sheet for username migration"
```

---

## Task 5: Wire `UsernameSetupSheet` into `AppLayout`

**Files:**
- Modify: `src/components/layout/AppLayout.tsx`

Show the sheet for authenticated users without a username. Skip for admin/moderator users.

- [ ] **Step 1: Update AppLayout**

```typescript
// src/components/layout/AppLayout.tsx
import { ReactNode } from 'react';
import { BottomNav } from './BottomNav';
import { Header } from './Header';
import { PushPermissionPrompt } from '@/components/notifications/PushPermissionPrompt';
import { UsernameSetupSheet } from '@/components/auth/UsernameSetupSheet';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useEffect, useState } from 'react';

interface AppLayoutProps {
  children: ReactNode;
  showHeader?: boolean;
}

export function AppLayout({ children, showHeader = true }: AppLayoutProps) {
  const { user, profileStatus } = useAuth();
  const [isAdminOrMod, setIsAdminOrMod] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .in('role', ['admin', 'moderator'])
      .maybeSingle()
      .then(({ data }) => setIsAdminOrMod(data !== null));
  }, [user]);

  const showUsernameSheet =
    user !== null &&
    profileStatus !== null &&
    !profileStatus.hasUsername &&
    !isAdminOrMod;

  return (
    <div className="min-h-screen bg-background pb-20">
      {showHeader && <Header />}
      <main>{children}</main>
      <BottomNav />
      <PushPermissionPrompt />
      {showUsernameSheet && <UsernameSetupSheet />}
    </div>
  );
}
```

- [ ] **Step 2: Verify build**

```bash
npm run build
```

- [ ] **Step 3: Manual smoke test**

```
1. Run: npm run dev
2. Log in as a user who has no username in the DB
3. Navigate to any protected page — UsernameSetupSheet should appear on top
4. Type an invalid username (e.g. "ab") — should show amber error
5. Type a valid, available username — green "disponível" message
6. Click "Confirmar" — sheet should disappear
7. Refresh — sheet should NOT reappear (username is now set)
```

- [ ] **Step 4: Commit**

```bash
git add src/components/layout/AppLayout.tsx
git commit -m "feat: render UsernameSetupSheet in AppLayout for users without a handle"
```

---

## Task 6: Add `@username` field to Signup Step 5

**Files:**
- Modify: `src/pages/Auth.tsx`

Add the username input with real-time validation and suggestion chips to the existing `profile` signup step.

- [ ] **Step 1: Add username state variables** (inside the `Auth` component, near the other signup states)

```typescript
// Add near the top of the Auth component, alongside other signup state
const [signupUsername, setSignupUsername] = useState('');
const [usernameCheckState, setUsernameCheckState] = useState<'idle' | 'checking' | 'available' | 'taken' | 'invalid'>('idle');
const [usernameFormatError, setUsernameFormatError] = useState<string | null>(null);
const [usernameSuggestions, setUsernameSuggestions] = useState<string[]>([]);
const usernameDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
```

- [ ] **Step 2: Add suggestion generation** (triggered when the user reaches the `profile` step)

Find the `useEffect` or the section where step data is initialised. Add:

```typescript
// When entering the 'profile' step, generate suggestions from the name entered earlier
useEffect(() => {
  if (currentStep === 'profile' && signupName) {
    setUsernameSuggestions(generateUsernameSuggestions(signupName));
  }
}, [currentStep, signupName]);
```

> Note: `signupName` is whatever state variable holds the user's entered name in step `name_email`. Check the variable name in the existing code and adjust accordingly.

- [ ] **Step 3: Add validation handler**

```typescript
const handleUsernameChange = (raw: string) => {
  setSignupUsername(raw);
  if (usernameDebounceRef.current) clearTimeout(usernameDebounceRef.current);

  const { valid, error } = isValidUsernameFormat(raw);
  if (!valid) {
    setUsernameFormatError(error || null);
    setUsernameCheckState('invalid');
    return;
  }

  setUsernameFormatError(null);
  setUsernameCheckState('idle');
  usernameDebounceRef.current = setTimeout(async () => {
    setUsernameCheckState('checking');
    const { data } = await supabase
      .from('public_profiles')
      .select('user_id')
      .ilike('username', raw)
      .is('suspended_at', null)   // exclude suspended users from blocking availability
      .maybeSingle();
    setUsernameCheckState(data === null ? 'available' : 'taken');
  }, 500);
};
```

- [ ] **Step 4: Add username field to the profile step JSX**

Find the JSX section that renders the `profile` step (search for `step === 'profile'` or `currentStep === 'profile'`). Add the following block **after** the existing fields (CPF/CNPJ etc.) and **before** the submit button:

```tsx
{/* @username field */}
<div className="space-y-2">
  <Label>Seu @username</Label>
  <div className="relative">
    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-primary font-semibold select-none">@</span>
    <Input
      value={signupUsername}
      onChange={(e) => handleUsernameChange(e.target.value)}
      placeholder="seu.username"
      className={cn(
        'pl-7',
        usernameCheckState === 'available' && 'border-green-500',
        usernameCheckState === 'taken' && 'border-destructive',
        usernameCheckState === 'invalid' && 'border-amber-500',
      )}
    />
  </div>
  <p className="text-xs text-muted-foreground">Letras, números, ponto (.) e _ • 3 a 30 caracteres</p>
  {usernameCheckState === 'checking' && (
    <p className="text-xs text-muted-foreground">⏳ Verificando disponibilidade...</p>
  )}
  {usernameCheckState === 'available' && (
    <p className="text-xs text-green-600">✓ @{signupUsername} está disponível</p>
  )}
  {usernameCheckState === 'taken' && (
    <p className="text-xs text-destructive">✗ @{signupUsername} já está em uso</p>
  )}
  {usernameCheckState === 'invalid' && (
    <p className="text-xs text-amber-600">{usernameFormatError}</p>
  )}

  {/* Suggestion chips */}
  {usernameSuggestions.length > 0 && (
    <div className="flex gap-2 flex-wrap pt-1">
      {usernameSuggestions.map(s => (
        <button
          key={s}
          type="button"
          onClick={() => handleUsernameChange(s)}
          className="px-3 py-1 rounded-lg bg-primary/10 text-primary text-sm hover:bg-primary/20 transition-colors"
        >
          @{s}
        </button>
      ))}
    </div>
  )}
</div>
```

- [ ] **Step 5: Disable "Continuar" when username is not available**

Find the submit/continue button for the `profile` step and add `usernameCheckState !== 'available'` to its `disabled` condition.

- [ ] **Step 6: Save username on profile submit**

Find where the profile step saves data (look for `save-user-profile` Edge Function call or `supabase.from('profiles').update(...)` within the profile step handler). After the existing profile save succeeds, add:

```typescript
// Save username (no username_updated_at on first creation)
await supabase
  .from('profiles')
  .update({ username: signupUsername })
  .eq('user_id', userId); // userId from the signup response
```

Handle the unique constraint violation (error code `23505`) inline:

```typescript
if (error?.code === '23505') {
  setUsernameCheckState('taken');
  // Show inline error on the username field — user must pick another
  return; // don't advance step
}
```

- [ ] **Step 7: Add imports to Auth.tsx**

```typescript
import { isValidUsernameFormat, generateUsernameSuggestions } from '@/lib/usernameValidation';
```

- [ ] **Step 8: Verify build**

```bash
npm run build
```

- [ ] **Step 9: Commit**

```bash
git add src/pages/Auth.tsx
git commit -m "feat(signup): add @username field with validation and suggestions to step 5"
```

---

## Task 7: Display `@username` on `/profile`

**Files:**
- Modify: `src/pages/Profile.tsx`

Show `@username` below `display_name` in the profile card. Clicking it navigates to EditProfile.

- [ ] **Step 1: Read the profile username**

In the section around line 324 (where `userName` and `userEmail` are derived), add:

```typescript
// Profile.tsx — read username from profiles table via useUserProfile or direct query
const userUsername = profile?.username || null; // assuming useUserProfile returns the full profile row
```

> If `useUserProfile` doesn't currently return `username`, update its SELECT query to include it (read `src/hooks/useUserProfile.ts` and add `username, username_updated_at` to the `.select()` call).

- [ ] **Step 2: Add username display in JSX**

Find the profile card section where `userName` is displayed (around line 344–380). After the `<div>` that shows `userName`, add:

```tsx
{userUsername && (
  <button
    onClick={() => navigate('/settings/profile')}
    className="text-sm text-primary font-medium hover:underline text-left"
  >
    @{userUsername}
  </button>
)}
```

- [ ] **Step 3: Verify build and smoke test**

```bash
npm run build
```

Then: `npm run dev` → log in → open `/profile` → verify `@username` appears in olive green below the display name and is clickable.

- [ ] **Step 4: Commit**

```bash
git add src/pages/Profile.tsx src/hooks/useUserProfile.ts
git commit -m "feat(profile): display @username below display_name on own profile page"
```

---

## Task 8: Display `@username` on `/seller/:id`

**Files:**
- Modify: `src/pages/SellerProfile.tsx`

Show read-only `@username` below `display_name` using data already fetched from `public_profiles`.

- [ ] **Step 1: Verify `public_profiles` now returns `username`**

The Task 1 migration updated the view. The existing `useSellerProfile` or similar hook that fetches from `public_profiles` should now include `username`. Check `src/hooks/useSellerProfile.ts` (or equivalent) — if the `.select('*')` pattern is used, no change is needed. If specific columns are listed, add `username`.

- [ ] **Step 2: Add username display in JSX**

Find where `profile.display_name` is rendered (around line 256). After it, add:

```tsx
{profile.username && (
  <p className="text-sm text-primary font-medium">@{profile.username}</p>
)}
```

The plan badge that already exists should remain after this line.

- [ ] **Step 3: Verify build and smoke test**

```bash
npm run build
```

Then: `npm run dev` → open any seller profile that has a username → verify `@username` appears in olive green, read-only.

- [ ] **Step 4: Commit**

```bash
git add src/pages/SellerProfile.tsx
git commit -m "feat(seller): display read-only @username on public seller profile"
```

---

## Task 9: `useProfileSearch` Hook

**Files:**
- Create: `src/hooks/useProfileSearch.ts`

Debounced hook that calls `search_profiles` RPC. Returns typed results.

- [ ] **Step 1: Create the hook**

```typescript
// src/hooks/useProfileSearch.ts
import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface ProfileSearchResult {
  user_id: string;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
  city: string | null;
  plan_type: string | null;
  sold_count: number | null;
}

export function useProfileSearch(query: string) {
  const [results, setResults] = useState<ProfileSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const stripped = query.replace(/^@/, '').trim();

    if (stripped.length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }

    if (debounceRef.current) clearTimeout(debounceRef.current);
    setLoading(true);
    setError(null);

    debounceRef.current = setTimeout(async () => {
      const { data, error: rpcError } = await supabase
        .rpc('search_profiles', { p_query: stripped });

      setLoading(false);

      if (rpcError) {
        setError('Erro ao buscar perfis. Tente novamente.');
        return;
      }

      setResults((data as ProfileSearchResult[]) || []);
    }, 500);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  return { results, loading, error };
}
```

- [ ] **Step 2: Verify build**

```bash
npm run build
```

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useProfileSearch.ts
git commit -m "feat: add useProfileSearch hook with debounced search_profiles RPC call"
```

---

## Task 10: Search Page — Add Profile Tab

**Files:**
- Modify: `src/pages/Search.tsx`

Add a tab switcher (Vestuário / Perfis). The Perfis tab renders profile cards using `useProfileSearch`.

- [ ] **Step 1: Add tab state and imports**

At the top of `Search.tsx`, add:

```typescript
import { useProfileSearch, ProfileSearchResult } from '@/hooks/useProfileSearch';
import { User } from 'lucide-react'; // for profile card avatar fallback icon
```

Inside the component, add:

```typescript
const [activeTab, setActiveTab] = useState<'clothing' | 'profiles'>('clothing');
const [profileQuery, setProfileQuery] = useState('');
const { results: profileResults, loading: profileLoading, error: profileError } = useProfileSearch(profileQuery);
```

- [ ] **Step 2: Add tab UI** — replace the single search input section with a tabbed layout

After the search input `<div>`, add the tab switcher:

```tsx
{/* Tab Switcher */}
<div className="flex border-b border-border">
  {(['clothing', 'profiles'] as const).map((tab) => (
    <button
      key={tab}
      onClick={() => setActiveTab(tab)}
      className={cn(
        'flex-1 py-2.5 text-sm font-medium transition-colors',
        activeTab === tab
          ? 'text-primary border-b-2 border-primary -mb-px'
          : 'text-muted-foreground hover:text-foreground'
      )}
    >
      {tab === 'clothing' ? 'Vestuário' : 'Perfis'}
    </button>
  ))}
</div>
```

- [ ] **Step 3: Wire profile query to search input**

The existing input writes to `query` (for product search). When `activeTab === 'profiles'`, it should write to `profileQuery` instead. The simplest approach: use a single input value and route it to the correct state:

```typescript
// Replace onChange handler on the input
onChange={(e) => {
  const v = e.target.value;
  if (activeTab === 'profiles') {
    setProfileQuery(v);
  } else {
    setQuery(v);
  }
}}
// Keep input value in sync with active tab
value={activeTab === 'profiles' ? profileQuery : query}
// Update placeholder
placeholder={activeTab === 'profiles' ? 'Buscar por @username ou nome...' : 'Buscar por nome, marca ou categoria...'}
```

Also update the clear button to clear the right state:
```typescript
onClick={() => activeTab === 'profiles' ? setProfileQuery('') : setQuery('')}
```

- [ ] **Step 4: Add profile results section**

Below the tab switcher, replace the existing conditional rendering with a tab-aware version:

```tsx
{activeTab === 'clothing' ? (
  /* ---- EXISTING clothing content unchanged ---- */
  <>
    {/* gender chips */}
    {/* showResults → product grid, else discovery content */}
  </>
) : (
  /* ---- PROFILES tab ---- */
  <div className="space-y-3">
    {profileQuery.replace(/^@/, '').trim().length < 2 ? (
      <p className="text-center text-muted-foreground text-sm py-10">
        Digite @username ou nome de uma loja
      </p>
    ) : profileLoading ? (
      /* Skeleton */
      <div className="space-y-3">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="flex items-center gap-3 p-3">
            <Skeleton className="w-11 h-11 rounded-full shrink-0" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-20" />
            </div>
          </div>
        ))}
      </div>
    ) : profileError ? (
      <p className="text-center text-destructive text-sm py-10">{profileError}</p>
    ) : profileResults.length === 0 ? (
      <p className="text-center text-muted-foreground text-sm py-10">
        Nenhum perfil encontrado para "{profileQuery}"
      </p>
    ) : (
      profileResults.map((p) => <ProfileCard key={p.user_id} profile={p} />)
    )}
  </div>
)}
```

- [ ] **Step 5: Add `ProfileCard` sub-component** (define above the `Search` function in the same file)

```tsx
function ProfileCard({ profile }: { profile: ProfileSearchResult }) {
  const navigate = useNavigate();
  const initials = (profile.display_name || '?').slice(0, 2).toUpperCase();
  const hasPaidPlan = profile.plan_type && ['plus', 'brecho', 'loja'].includes(profile.plan_type);
  const badgeLabel = profile.plan_type === 'loja' ? 'LOJA' : profile.plan_type === 'brecho' ? 'BRECHÓ' : 'PLUS';

  return (
    <div className="flex items-center gap-3 p-3 rounded-2xl bg-card border border-border/50">
      <div className="w-11 h-11 rounded-full bg-primary/20 flex items-center justify-center shrink-0 text-primary font-semibold text-sm overflow-hidden">
        {profile.avatar_url
          ? <img src={profile.avatar_url} alt={profile.display_name || ''} className="w-full h-full object-cover" />
          : initials}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-sm truncate">{profile.display_name || 'Usuário'}</p>
        {profile.username && (
          <p className="text-xs text-primary">@{profile.username}</p>
        )}
        {hasPaidPlan && (
          <span className="inline-block mt-0.5 px-2 py-0.5 rounded-full bg-primary text-primary-foreground text-[10px] font-semibold">
            ✦ {badgeLabel}
          </span>
        )}
      </div>
      <Button
        size="sm"
        variant="outline"
        className="shrink-0 text-xs"
        onClick={() => navigate(`/seller/${profile.user_id}`)}
      >
        Ver perfil
      </Button>
    </div>
  );
}
```

Add `import { Button } from '@/components/ui/button';` if not already imported, and `import { useNavigate } from 'react-router-dom';`.

- [ ] **Step 6: Verify build and smoke test**

```bash
npm run build
```

Then: `npm run dev` → open `/search` → switch to "Perfis" tab → type `@` + any letter → verify results appear as profile cards with avatars, handles, and plan badges.

- [ ] **Step 7: Commit**

```bash
git add src/pages/Search.tsx
git commit -m "feat(search): add Perfis tab with profile search using search_profiles RPC"
```

---

## Task 11: Edit `@username` in `EditProfile` (with cooldown)

**Files:**
- Modify: `src/pages/settings/EditProfile.tsx`

Add an inline `@username` section below the `displayName` field. Shows edit UI if cooldown is clear; shows locked state with days-remaining otherwise.

- [ ] **Step 1: Add username state**

In `EditProfile.tsx`, add new state alongside the existing `displayName` etc.:

```typescript
const [username, setUsername] = useState('');
const [usernameUpdatedAt, setUsernameUpdatedAt] = useState<string | null>(null);
const [usernameCheckState, setUsernameCheckState] = useState<'idle' | 'checking' | 'available' | 'taken' | 'invalid'>('idle');
const [usernameFormatError, setUsernameFormatError] = useState<string | null>(null);
const [savingUsername, setSavingUsername] = useState(false);
const usernameDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
```

- [ ] **Step 2: Populate from profile**

Inside the existing `useEffect` that loads profile data (around line 25), also load:

```typescript
// Read username from profiles table
const { data: profileRow } = await supabase
  .from('profiles')
  .select('username, username_updated_at')
  .eq('user_id', user.id)
  .single();

if (profileRow) {
  setUsername(profileRow.username || '');
  setUsernameUpdatedAt(profileRow.username_updated_at);
}
```

> Alternatively, if `useUserProfile` already returns this data after Task 7, read from there.

- [ ] **Step 3: Add cooldown helper**

```typescript
// Above the component
function getDaysUntilUsernameEditable(updatedAt: string | null): number | null {
  if (!updatedAt) return null; // never changed → free to edit
  const cooldownEnd = new Date(updatedAt).getTime() + 30 * 24 * 60 * 60 * 1000;
  const remaining = cooldownEnd - Date.now();
  if (remaining <= 0) return null; // cooldown over → free to edit
  return Math.ceil(remaining / (24 * 60 * 60 * 1000));
}
```

- [ ] **Step 4: Add validation handler** (same pattern as UsernameSetupSheet)

```typescript
const handleUsernameChange = (raw: string) => {
  setUsername(raw);
  if (usernameDebounceRef.current) clearTimeout(usernameDebounceRef.current);

  const { valid, error } = isValidUsernameFormat(raw);
  if (!valid) {
    setUsernameFormatError(error || null);
    setUsernameCheckState('invalid');
    return;
  }
  setUsernameFormatError(null);
  setUsernameCheckState('idle');
  usernameDebounceRef.current = setTimeout(async () => {
    setUsernameCheckState('checking');
    const { data } = await supabase
      .from('public_profiles')
      .select('user_id')
      .ilike('username', raw)
      .neq('user_id', user!.id)   // exclude self (so current value shows available)
      .maybeSingle();
    setUsernameCheckState(data === null ? 'available' : 'taken');
  }, 500);
};
```

- [ ] **Step 5: Add save handler**

```typescript
const handleSaveUsername = async () => {
  if (!user || usernameCheckState !== 'available') return;
  setSavingUsername(true);

  const { error } = await supabase
    .from('profiles')
    .update({
      username,
      username_updated_at: new Date().toISOString(), // set cooldown on change
    })
    .eq('user_id', user.id);

  setSavingUsername(false);

  if (error) {
    toast({
      title: error.code === '23505'
        ? 'Este @username foi escolhido por outra pessoa agora mesmo. Tente outro.'
        : 'Erro ao salvar.',
      variant: 'destructive',
    });
    return;
  }

  setUsernameUpdatedAt(new Date().toISOString());
  toast({ title: '@username atualizado com sucesso.' });
};
```

- [ ] **Step 6: Add JSX section** — insert after the `displayName` field inside the `<CardContent>`:

```tsx
{/* @username section */}
<div className="space-y-2 pt-2 border-t border-border">
  <Label>@username</Label>
  {(() => {
    const daysLeft = getDaysUntilUsernameEditable(usernameUpdatedAt);
    if (daysLeft !== null) {
      // Cooldown active
      return (
        <div className="space-y-2">
          <div className="flex items-center gap-2 p-3 rounded-xl bg-destructive/10 border border-destructive/20">
            <span className="text-destructive text-sm font-semibold">🔒</span>
            <div>
              <p className="text-sm font-medium text-destructive">Alteração bloqueada</p>
              <p className="text-xs text-muted-foreground">Próxima troca disponível em {daysLeft} dias</p>
            </div>
          </div>
          <div className="relative opacity-50">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-semibold">@</span>
            <Input value={username} disabled className="pl-7" />
          </div>
        </div>
      );
    }

    // Free to edit
    return (
      <div className="space-y-2">
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-primary font-semibold select-none">@</span>
          <Input
            value={username}
            onChange={(e) => handleUsernameChange(e.target.value)}
            placeholder="seu.username"
            className={cn(
              'pl-7',
              usernameCheckState === 'available' && 'border-green-500',
              usernameCheckState === 'taken' && 'border-destructive',
              usernameCheckState === 'invalid' && 'border-amber-500',
            )}
          />
        </div>
        {usernameCheckState === 'checking' && <p className="text-xs text-muted-foreground">⏳ Verificando...</p>}
        {usernameCheckState === 'available' && <p className="text-xs text-green-600">✓ Disponível</p>}
        {usernameCheckState === 'taken' && <p className="text-xs text-destructive">✗ Já está em uso</p>}
        {usernameCheckState === 'invalid' && <p className="text-xs text-amber-600">{usernameFormatError}</p>}
        <p className="text-xs text-muted-foreground">⚠ Após alterar, você só poderá trocar novamente em 30 dias.</p>
        <Button
          onClick={handleSaveUsername}
          disabled={usernameCheckState !== 'available' || savingUsername}
          className="w-full"
        >
          {savingUsername && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
          Salvar @username
        </Button>
      </div>
    );
  })()}
</div>
```

- [ ] **Step 7: Add imports**

```typescript
import { isValidUsernameFormat } from '@/lib/usernameValidation';
import { useRef } from 'react'; // add to existing import
```

> **Important:** `EditProfile.tsx` already imports `useToast` from `@/hooks/use-toast` (shadcn). Use that existing hook for `toast()` calls. Do **not** import sonner's `toast` function — it would introduce a second toast library in this file.

- [ ] **Step 8: Verify build and smoke test**

```bash
npm run build
```

Manual test:
```
1. Log in as a user with a username set less than 30 days ago (set username_updated_at to now in DB)
   → EditProfile should show locked state with days remaining

2. Log in as a user with username_updated_at = NULL (or older than 30 days)
   → EditProfile should show editable input
   → Type a taken username → red border
   → Type an available username → green border → click Save → toast "atualizado"
   → username_updated_at is now set in DB → returning to EditProfile shows locked state
```

- [ ] **Step 9: Commit**

```bash
git add src/pages/settings/EditProfile.tsx
git commit -m "feat(settings): add @username inline edit section with 30-day cooldown to EditProfile"
```

---

## Final Verification

- [ ] **Full build**

```bash
npm run build
```

Expected: zero TypeScript errors, zero lint errors.

- [ ] **End-to-end smoke test**

```
1. New user signup → step 5 has @username field → suggestions appear → complete signup
2. Old user (no username) logs in → UsernameSetupSheet appears → blocking → set username → sheet disappears
3. Admin user (no username) logs in → NO sheet appears, can access /admin
4. /profile shows @username below display_name, clickable → navigates to EditProfile
5. /seller/:id shows @username below display_name, not clickable
6. /search → Perfis tab → type "@luis" → profile cards appear with handle + badge
7. EditProfile → username section → try to save taken username → error → save available → locked for 30 days
```

- [ ] **Commit any final cleanup**

```bash
git add -A
git commit -m "feat: @username handle system — complete implementation"
```
