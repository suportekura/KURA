---
name: supabase-edge-functions
description: Use when creating, modifying, or debugging Supabase Edge Functions. Trigger on keywords like "edge function", "supabase function", "serverless", "deno", "cors", "rate limit", "upstash", "pagar.me", "payment function", "webhook", "moderate", "moderation", "send email", "resend", "push notification", "verification code", "JWT", "getClaims", "admin client", "service role", "functions.invoke". Also trigger when working with any file in supabase/functions/.
---

# Supabase Edge Functions

This skill documents how to create and modify Edge Functions in the Kura project. All functions are in `supabase/functions/` and run on Deno Deploy.

## When to use this skill

- Creating a new Edge Function
- Modifying an existing function's logic
- Adding CORS handling to a function
- Implementing rate limiting
- Integrating with external APIs (Pagar.me, Resend, Gemini)
- Handling webhook signatures
- Working with Supabase admin client in server context

## Core Patterns

### 1. Function File Structure

Each function lives in its own folder with an `index.ts`:

```
supabase/functions/
├── _shared/
│   └── cors.ts           # Shared CORS handler
├── my-function/
│   └── index.ts          # Function entry point
```

### 2. CORS Setup (Required for all browser-called functions)

Always import from the shared CORS module:

```typescript
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";
```

Start every function with CORS preflight handling:

```typescript
Deno.serve(async (req) => {
  // CORS preflight
  const preflightResponse = handleCorsPreflightRequest(req);
  if (preflightResponse) return preflightResponse;

  const corsHeaders = getCorsHeaders(req);

  try {
    // ... function logic
    return new Response(JSON.stringify({ success: true, data }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
```

Allowed origins are defined in `_shared/cors.ts`: `kuralab.com.br`, `*.kuralab.com.br`, `*.vercel.app`, and `localhost:5173/8080/3000`.

### 3. JWT Authentication Pattern

For functions requiring user auth:

```typescript
// Extract and verify JWT
const authHeader = req.headers.get("Authorization");
if (!authHeader || !authHeader.startsWith("Bearer ")) {
  return new Response(JSON.stringify({ error: "Missing authorization" }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
    status: 401,
  });
}

const token = authHeader.replace("Bearer ", "");
const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);

if (authError || !user) {
  return new Response(JSON.stringify({ error: "Invalid token" }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
    status: 401,
  });
}

const userId = user.id;
```

### 4. Supabase Admin Client

For server-side operations that bypass RLS:

```typescript
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseAdmin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);
```

### 5. Rate Limiting with Upstash Redis

```typescript
import { Redis } from "https://esm.sh/@upstash/redis@1.34.3";

const redis = new Redis({
  url: Deno.env.get("UPSTASH_REDIS_REST_URL")!,
  token: Deno.env.get("UPSTASH_REDIS_REST_TOKEN")!,
});

// Rate limit check (example: 10 requests/hour per identifier)
const rateLimitKey = `ratelimit:function-name:${identifier}`;
const currentCount = await redis.incr(rateLimitKey);

if (currentCount === 1) {
  await redis.expire(rateLimitKey, 3600); // 1 hour window
}

if (currentCount > 10) {
  return new Response(
    JSON.stringify({ error: "Rate limit exceeded. Try again later." }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 429 }
  );
}
```

Rate limit windows used in the project:
- `send-verification-code`: 5 req / 15 min per email
- `verify-code`: 10 req / 15 min per email
- `reset-password`: 3 req / 1 hour per email
- `save-user-profile`: 20 req / 1 hour per user
- `complete-signup`: 10 req / 1 hour per email

### 6. Response Format

All functions return JSON with consistent structure:

```typescript
// Success
{ success: true, data: { ... } }

// Error
{ error: "Human-readable error message" }

// Payment-specific success
{ success: true, paymentId: "...", qrcode: "...", payload: "...", expiresAt: "..." }

// Payment-specific failure (card declined — still HTTP 200)
{ success: false, error: "Card declined message" }
```

### 7. Config: Disabling JWT Verification

For functions that handle their own auth or are public, add to `supabase/config.toml`:

```toml
[functions.my-function]
verify_jwt = false
```

## Step-by-step Guide

### Creating a new Edge Function

1. Create directory: `supabase/functions/my-function/`
2. Create `index.ts` with the boilerplate above
3. Add CORS + auth pattern as needed
4. Add rate limiting if user-facing
5. Add to `config.toml` if JWT verification should be disabled
6. Test locally: `supabase functions serve my-function`
7. Deploy: `supabase functions deploy my-function`

### Calling an Edge Function from the frontend

```typescript
// From any component or hook
const { data, error } = await supabase.functions.invoke('my-function', {
  body: { param1: 'value1', param2: 'value2' },
});

if (error) throw error;
// data contains the parsed JSON response
```

## Code Examples

### Basic authenticated function

```typescript
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseAdmin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

Deno.serve(async (req) => {
  const preflightResponse = handleCorsPreflightRequest(req);
  if (preflightResponse) return preflightResponse;
  const corsHeaders = getCorsHeaders(req);

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 401,
      });
    }

    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(
      authHeader.replace("Bearer ", "")
    );
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 401,
      });
    }

    const { someParam } = await req.json();

    // ... business logic using supabaseAdmin and user.id

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Function error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
```

### Webhook handler (signature verification)

Based on `pagarme-webhook/index.ts`:

```typescript
import { createHmac } from "https://deno.land/std@0.177.0/node/crypto.ts";

Deno.serve(async (req) => {
  try {
    const signature = req.headers.get("x-hub-signature");
    if (!signature) {
      return new Response(JSON.stringify({ error: "Missing signature" }), { status: 401 });
    }

    const body = await req.text();
    const secret = Deno.env.get("PAGARME_WEBHOOK_SECRET")!;
    const expectedSignature = "sha1=" + createHmac("sha1", secret).update(body).digest("hex");

    if (signature !== expectedSignature) {
      return new Response(JSON.stringify({ error: "Invalid signature" }), { status: 401 });
    }

    const event = JSON.parse(body);
    // ... process event

    return new Response(JSON.stringify({ received: true }), { status: 200 });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
});
```

## Common Mistakes to Avoid

1. **Never forget CORS handling** — browser requests will fail silently without it
2. **Never use `SUPABASE_PUBLISHABLE_KEY` server-side** — always use `SUPABASE_SERVICE_ROLE_KEY` for admin operations
3. **Never skip rate limiting on user-facing endpoints** — all functions that accept user input must be rate-limited
4. **Don't return 500 for expected errors** — card declines, validation errors should return 200 with `{ success: false, error }` or 400
5. **Don't forget to add `verify_jwt = false`** in `config.toml` for functions that handle auth manually
6. **Never log sensitive data** (CPF, CNPJ, card numbers, tokens) — the project encrypts these with AES-256-GCM
7. **Always handle the `OPTIONS` method** — preflight requests must return 204, not proceed to business logic

## Checklist

- [ ] CORS preflight handling at the top of the function
- [ ] Auth extraction (JWT or webhook signature) if needed
- [ ] Rate limiting with Upstash Redis if user-facing
- [ ] Supabase admin client for server-side DB operations
- [ ] Consistent JSON response format (`{ success, ... }` or `{ error }`)
- [ ] `config.toml` updated if `verify_jwt = false` needed
- [ ] No sensitive data in console.log/error
- [ ] Error responses include human-readable messages
