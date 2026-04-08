# Auth Refactor: Standard Supabase OAuth + Identity Linking

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the custom Google OAuth flow (manual redirect + Edge Function token exchange) with the standard Supabase `signInWithOAuth` + PKCE flow, eliminating hardcoded URLs, enabling identity linking, and making the entire auth system work correctly in prod and dev.

**Architecture:** The current flow manually redirects to Google and uses a custom Edge Function (`google-oauth-exchange`) to exchange the auth code for tokens. The new flow uses Supabase's built-in PKCE OAuth: the frontend calls `supabase.auth.signInWithOAuth()`, Supabase redirects to Google and handles the initial handshake, then the callback page calls `supabase.auth.exchangeCodeForSession()` to exchange the PKCE code for a session. This removes a full Edge Function, ~60 lines of custom OAuth logic, and the `VITE_GOOGLE_CLIENT_ID` frontend env var.

**Tech Stack:** React 18, TypeScript, Supabase JS v2.49.4, Vite (`import.meta.env`), Vercel (SPA), Supabase Auth (Google OAuth + PKCE flow)

---

## Audit Results — Problems Found

| # | File | Problem |
|---|------|---------|
| 1 | `src/pages/Auth.tsx:341-343` | Hardcoded redirect URIs (`localhost:8080`, `kuralab.com.br`) |
| 2 | `src/pages/AuthCallback.tsx:50-52` | Hardcoded redirect URIs — same |
| 3 | `src/pages/AuthCallback.tsx` | Entire file built for custom flow — calls `google-oauth-exchange` + `signInWithIdToken`. Needs full replacement. |
| 4 | `src/pages/Auth.tsx:338-366` | `handleGoogleSignIn` manually builds OAuth URL. Must use `supabase.auth.signInWithOAuth()`. |
| 5 | `src/pages/Auth.tsx:299` | `console.log` leaks user email to console |
| 6 | `src/integrations/supabase/client.ts` | No `flowType` set — defaults to implicit flow. `exchangeCodeForSession` requires PKCE. Must add `flowType: 'pkce'`. |
| 7 | `supabase/functions/google-oauth-exchange/` | Becomes dead code after refactor — delete |
| 8 | Supabase Dashboard | Identity linking not confirmed enabled → same email via Google + email/password creates two users |
| 9 | Google Cloud Console | New OAuth client needs correct Authorized Redirect URI: `https://mfkmtmduspgckogfxggx.supabase.co/auth/v1/callback` |
| 10 | `.env` / Vercel | Missing `VITE_SITE_URL` variable (needed to replace hardcoded URLs) |
| 11 | `.env.example` | Missing `VITE_SITE_URL` entry |

---

## Files To Change

| File | Action | What changes |
|------|--------|-------------|
| `src/integrations/supabase/client.ts` | Modify | Add `flowType: 'pkce'` to auth config |
| `src/pages/Auth.tsx` | Modify | Replace `handleGoogleSignIn`; remove CSRF state logic; remove `VITE_GOOGLE_CLIENT_ID` usage; remove `console.log` with email |
| `src/pages/AuthCallback.tsx` | Replace | New PKCE callback: calls `exchangeCodeForSession()`, updates `email_verified`, handles new Google user profile routing |
| `supabase/functions/google-oauth-exchange/index.ts` | Delete | Dead code |
| `supabase/config.toml` | Modify | Remove `[functions.google-oauth-exchange]` block |
| `.env` | Modify | Add `VITE_SITE_URL=http://localhost:8080` |
| `.env.example` | Modify | Add `VITE_SITE_URL=http://localhost:8080` |

**Not touched:** `useAuth.tsx`, `ProtectedRoute.tsx`, `App.tsx`, all DB schema, RLS, any business logic outside auth.

---

## New Google user flow after refactor (for reference)

When a user signs in via Google for the first time with an incomplete Kura profile, the flow is:

1. `handleGoogleSignIn` saves `userType` (if chosen) to `sessionStorage['oauth_pending_user_type']`
2. Supabase redirects to Google → Google redirects to `/auth/callback?code=...`
3. `AuthCallback.tsx` exchanges code for session → updates `email_verified = true` in profiles
4. `AuthCallback.tsx` checks profile: `profile_completed = false` → `navigate('/auth')`
5. `Auth.tsx` mounts, `checkProfileStatus` effect runs → finds Google user with no `user_type` → reads `sessionStorage['oauth_pending_user_type']` → sets the correct signup step

> This flow is preserved by keeping `oauth_pending_user_type` in `handleGoogleSignIn` (Task 3) and by `AuthCallback.tsx` navigating to `/auth` when profile is incomplete. The `checkProfileStatus` logic in `Auth.tsx` that reads `sessionStorage` is **not changed**.

---

## Task 1: Create branch

**Files:** none (git only)

- [ ] **Step 1: Create and switch to feature branch**

```bash
git checkout main
git pull origin main
git checkout -b feat/auth-refactor
```

- [ ] **Step 2: Verify you're on the new branch**

```bash
git branch
```
Expected: `* feat/auth-refactor`

---

## Task 2: Add `VITE_SITE_URL` env variable

**Files:**
- Modify: `.env` (local dev, never commit)
- Modify: `.env.example`

- [ ] **Step 1: Add `VITE_SITE_URL` to `.env`**

Open `.env` and add:
```
VITE_SITE_URL=http://localhost:8080
```

- [ ] **Step 2: Add `VITE_SITE_URL` to `.env.example`**

Open `.env.example` and add:
```
VITE_SITE_URL=http://localhost:8080
```

- [ ] **Step 3: Confirm `.env` is in `.gitignore`**

```bash
grep -n "\.env" .gitignore
```
Expected: `.env` is listed (`.env*` or explicit `.env`). If not, add it.

- [ ] **Step 4: Commit the `.env.example` change only**

```bash
git add .env.example
git commit -m "chore(env): add VITE_SITE_URL to env example"
```

---

## Task 3: Enable PKCE flow in Supabase client

**Files:**
- Modify: `src/integrations/supabase/client.ts`

`exchangeCodeForSession()` only works when the Supabase client uses PKCE flow. The current client has no `flowType` set (defaults to implicit). Add it explicitly.

> **Note:** The file header says "do not edit directly" (it was auto-generated by Lovable.dev), but this change is required and safe — it only adds one config key.

- [ ] **Step 1: Add `flowType: 'pkce'` to the client auth config**

The current auth config block is:
```typescript
export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  }
});
```

Replace with:
```typescript
export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
    flowType: 'pkce',
  }
});
```

- [ ] **Step 2: Commit**

```bash
git add src/integrations/supabase/client.ts
git commit -m "feat(auth): enable PKCE flow in Supabase client for signInWithOAuth"
```

---

## Task 4: Replace `handleGoogleSignIn` in `Auth.tsx`

**Files:**
- Modify: `src/pages/Auth.tsx`

The current `handleGoogleSignIn` (lines 338–366) manually builds a Google OAuth URL with CSRF state and uses `VITE_GOOGLE_CLIENT_ID`. Replace entirely with `supabase.auth.signInWithOAuth()`.

- [ ] **Step 1: Find and replace `handleGoogleSignIn`**

Replace the entire function (from `const handleGoogleSignIn = () => {` to its closing `};`) with:

```typescript
const handleGoogleSignIn = async () => {
  setLoading(true);
  try {
    if (userType) {
      sessionStorage.setItem('oauth_pending_user_type', userType);
    } else {
      sessionStorage.removeItem('oauth_pending_user_type');
    }

    const siteUrl = import.meta.env.VITE_SITE_URL || window.location.origin;

    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${siteUrl}/auth/callback`,
        queryParams: {
          access_type: 'offline',
          prompt: 'consent',
        },
      },
    });

    if (error) {
      toast({
        title: 'Erro ao entrar com Google',
        description: translateAuthError(error.message),
        variant: 'destructive',
      });
      setLoading(false);
    }
  } catch (err) {
    toast({
      title: 'Erro ao entrar com Google',
      description: 'Não foi possível conectar com o Google. Tente novamente.',
      variant: 'destructive',
    });
    setLoading(false);
  }
};
```

- [ ] **Step 2: Remove `console.log` lines with sensitive data**

Find and delete (~line 299):
```typescript
console.log("[Auth] Sending verification code to:", targetEmail);
```
And (~line 325):
```typescript
console.log("[Auth] Verification code sent successfully:", data.messageId);
```
> Do NOT remove `console.error` lines — errors should stay logged.

- [ ] **Step 3: Verify no orphaned CSRF state references remain**

The old `handleGoogleSignIn` used `crypto.randomUUID()` and `sessionStorage.setItem('oauth_state', state)`. Make sure no reference to `oauth_state` (not `oauth_pending_user_type`) remains anywhere in Auth.tsx:

```bash
grep -n "oauth_state" src/pages/Auth.tsx
```
Expected: no output. If found, remove those lines.

- [ ] **Step 4: Verify `VITE_GOOGLE_CLIENT_ID` is gone from Auth.tsx**

```bash
grep -n "VITE_GOOGLE_CLIENT_ID" src/pages/Auth.tsx
```
Expected: no output.

- [ ] **Step 5: Commit**

```bash
git add src/pages/Auth.tsx
git commit -m "refactor(auth): replace custom Google OAuth with supabase.auth.signInWithOAuth"
```

---

## Task 5: Replace `AuthCallback.tsx`

**Files:**
- Replace: `src/pages/AuthCallback.tsx`

The current callback invokes the `google-oauth-exchange` Edge Function and calls `signInWithIdToken`. The new version uses `exchangeCodeForSession()` (PKCE), updates `email_verified`, and routes new Google users to complete their Kura profile.

- [ ] **Step 1: Replace the entire file content**

```typescript
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';

const AuthCallback = () => {
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    const handleCallback = async () => {
      const params = new URLSearchParams(window.location.search);
      const error = params.get('error');

      if (error) {
        toast({
          title: 'Erro ao entrar com Google',
          description: 'O login com Google foi cancelado ou falhou. Tente novamente.',
          variant: 'destructive',
        });
        navigate('/auth');
        return;
      }

      // Exchange the PKCE auth code for a Supabase session.
      // exchangeCodeForSession reads the `code` query param from the URL automatically.
      const { data, error: sessionError } = await supabase.auth.exchangeCodeForSession(
        window.location.href
      );

      if (sessionError || !data?.user) {
        toast({
          title: 'Erro ao autenticar',
          description: 'Não foi possível completar o login com Google. Tente novamente.',
          variant: 'destructive',
        });
        navigate('/auth');
        return;
      }

      const user = data.user;

      // Google verifies the user's email — ensure our profile reflects this so
      // useAuth doesn't sign the user out seeing email_verified = false.
      await supabase
        .from('profiles')
        .update({ email_verified: true })
        .eq('user_id', user.id);

      // Check if this Google user still needs to complete their Kura profile.
      // If incomplete, navigate to /auth where Auth.tsx checkProfileStatus() will
      // detect the Google user, read oauth_pending_user_type from sessionStorage,
      // and show the correct signup step.
      const { data: profile } = await supabase
        .from('profiles')
        .select('profile_completed, user_type')
        .eq('user_id', user.id)
        .single();

      if (!profile?.profile_completed || !profile?.user_type) {
        navigate('/auth');
        return;
      }

      navigate('/');
    };

    handleCallback();
  }, [navigate, toast]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
      <p className="text-muted-foreground text-sm">Autenticando com Google...</p>
    </div>
  );
};

export default AuthCallback;
```

- [ ] **Step 2: Verify no references to `google-oauth-exchange` or `signInWithIdToken` remain**

```bash
grep -n "google-oauth-exchange\|signInWithIdToken\|oauth_state" src/pages/AuthCallback.tsx
```
Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add src/pages/AuthCallback.tsx
git commit -m "refactor(auth): replace custom OAuth callback with PKCE exchangeCodeForSession"
```

---

## Task 6: Delete the `google-oauth-exchange` Edge Function

**Files:**
- Delete: `supabase/functions/google-oauth-exchange/` (directory)
- Modify: `supabase/config.toml`

- [ ] **Step 1: Verify the config.toml entry exists before editing**

```bash
grep -n "google-oauth-exchange" supabase/config.toml
```
Expected: shows `[functions.google-oauth-exchange]` and `verify_jwt = false`. If not present, skip Step 2.

- [ ] **Step 2: Remove the `google-oauth-exchange` block from `supabase/config.toml`**

Find and delete these two lines:
```toml
[functions.google-oauth-exchange]
verify_jwt = false
```

- [ ] **Step 3: Delete the Edge Function directory**

```bash
rm -rf supabase/functions/google-oauth-exchange
```

- [ ] **Step 4: Verify no file anywhere references this function**

```bash
grep -rn "google-oauth-exchange" src/ supabase/
```
Expected: no output.

- [ ] **Step 5: Commit**

```bash
git add -A supabase/
git commit -m "chore(auth): remove google-oauth-exchange edge function (replaced by supabase signInWithOAuth)"
```

---

## Task 7: Build verification

- [ ] **Step 1: Run the dev server and confirm it compiles**

```bash
npm run dev
```
Expected: server starts on port 8080, no TypeScript errors.

- [ ] **Step 2: Check no `VITE_GOOGLE_CLIENT_ID` references remain anywhere**

```bash
grep -rn "VITE_GOOGLE_CLIENT_ID" src/
```
Expected: no output. If found, remove.

- [ ] **Step 3: Check no `oauth_state` CSRF references remain (not `oauth_pending_user_type`)**

```bash
grep -rn "\"oauth_state\"" src/
```
Expected: no output. `oauth_pending_user_type` is fine to keep — it preserves account type selection.

- [ ] **Step 4: Run lint**

```bash
npm run lint
```
Expected: no new errors related to changed files.

- [ ] **Step 5: Run production build**

```bash
npm run build
```
Expected: build succeeds with no TypeScript errors.

---

## Task 8: Manual configuration checklist (external systems)

These steps are done in browser dashboards — NOT in code.

### 8.1 — Google Cloud Console

> Go to: https://console.cloud.google.com → APIs & Services → Credentials → your OAuth 2.0 Client ID

- [ ] **Authorized JavaScript Origins** — add:
  ```
  https://kuralab.com.br
  http://localhost:8080
  http://localhost:5173
  ```

- [ ] **Authorized Redirect URIs** — set to ONLY this (remove any previous app-domain URIs like `/auth/callback`):
  ```
  https://mfkmtmduspgckogfxggx.supabase.co/auth/v1/callback
  ```

- [ ] Save → copy the new **Client ID** and **Client Secret**

### 8.2 — Supabase Dashboard

> Go to: https://supabase.com/dashboard → project `mfkmtmduspgckogfxggx`

**Authentication → Providers → Google:**
- [ ] Enable Google provider
- [ ] Paste the new **Client ID** and **Client Secret** from Google Cloud Console
- [ ] Save

**Authentication → URL Configuration:**
- [ ] **Site URL:** `https://kuralab.com.br`
- [ ] **Redirect URLs (allow list):** ensure these are present:
  ```
  https://kuralab.com.br/auth/callback
  http://localhost:8080/auth/callback
  http://localhost:5173/auth/callback
  ```

**Authentication → Settings → "Enable Manual Linking":**
- [ ] Navigate to **Authentication → Settings** (not Providers — the general Settings tab)
- [ ] Find **"Enable Manual Linking"** and toggle it ON
- [ ] Save
> This setting allows a Google sign-in to link with an existing email/password account that shares the same email, instead of creating a duplicate user.

### 8.3 — Vercel

> Go to: Vercel Dashboard → kura project → Settings → Environment Variables

- [ ] Add or confirm these variables exist:
  | Variable | Value |
  |----------|-------|
  | `VITE_SUPABASE_URL` | `https://mfkmtmduspgckogfxggx.supabase.co` |
  | `VITE_SUPABASE_PUBLISHABLE_KEY` | (your anon key) |
  | `VITE_SITE_URL` | `https://kuralab.com.br` |

- [ ] Remove `VITE_GOOGLE_CLIENT_ID` from Vercel if it was set (no longer needed)
- [ ] Trigger a new deployment after saving env vars

---

## Task 9: Local end-to-end test

Before pushing, test all flows manually on `http://localhost:8080`:

- [ ] **Email/password login**: login with existing account → reaches `/`
- [ ] **Email/password login with wrong password**: shows error toast, does not crash
- [ ] **Google login (existing Kura user)**: click "Entrar com Google" → completes auth → redirected to `/`
- [ ] **Google login (new user, PF/PJ not yet selected)**: Google auth completes → lands on `/auth` with account type step
- [ ] **Google login (user had selected PF before clicking Google)**: returns to `/auth` at profile step (not type step) — verifying `oauth_pending_user_type` was preserved
- [ ] **Identity linking**: use a Google account whose email matches an existing email/password account → logs into the SAME account (check Supabase → Auth → Users: only one user for that email)

---

## Task 10: Push and PR

- [ ] **Step 1: Push branch**

```bash
git push origin feat/auth-refactor
```

- [ ] **Step 2: After Vercel auto-deploys, test on production:**
  - [ ] Google login on `https://kuralab.com.br` works — no `redirect_uri_mismatch`
  - [ ] Email/password login works

---

## Summary of what was hardcoded and is now env-driven

| Was hardcoded | Now uses |
|---------------|----------|
| `'https://kuralab.com.br/auth/callback'` | `import.meta.env.VITE_SITE_URL` + `/auth/callback` |
| `'http://localhost:8080/auth/callback'` | removed (handled by `VITE_SITE_URL` in `.env`) |
| Manual Google OAuth URL construction | `supabase.auth.signInWithOAuth()` — Supabase handles everything |
| `VITE_GOOGLE_CLIENT_ID` in frontend bundle | removed — Client ID lives only in Supabase Dashboard |
