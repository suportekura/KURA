# Project Overview

Kura (kuralab.com.br) is a Brazilian online thrift store marketplace (brechó online) where individual sellers (PF - Pessoa Física) and businesses (PJ - Pessoa Jurídica) list and sell second-hand clothing. Buyers browse products by category, filter by distance/price/condition, chat with sellers, make offers, and purchase via PIX or credit card. The platform includes seller subscriptions (free/plus/loja), product boosts for visibility, real-time messaging with offers, a reputation system, and a full admin panel for moderation.

# Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Frontend | React | 18.3.1 |
| Language | TypeScript | 5.8.2 |
| Build Tool | Vite + SWC | 6.0.5 |
| CSS | Tailwind CSS | 3.4.17 |
| Component Library | shadcn/ui (Radix UI primitives) | — |
| State Management | React Context + TanStack React Query | v5 |
| Forms | React Hook Form + Zod | 7.54.2 / 3.24.1 |
| Animations | Framer Motion | 11.18.2 |
| Backend/BaaS | Supabase (PostgreSQL, Auth, Realtime, Edge Functions, Storage) | 2.49.4 |
| Auth | Supabase Auth (Email/Password + Google OAuth) | — |
| Payments | Pagar.me (PIX + Credit Card) | — |
| Push Notifications | Web Push API (VAPID, RFC 8291/8292) | — |
| Content Moderation | Google Gemini 2.5 Flash (image + text) | — |
| Email | Resend API | — |
| Rate Limiting | Upstash Redis | — |
| PWA | vite-plugin-pwa | 0.21.1 |
| Deployment | Vercel (SPA rewrite) | — |
| Icons | Lucide React | — |
| Charts | Recharts | — |
| Date | date-fns | — |

# Project Structure

```
src/
├── assets/          # Static images (logos, badges, icons)
├── components/
│   ├── animations/  # AnimatedRoutes wrapper
│   ├── auth/        # ProtectedRoute, AdminRoute, PublicRoute
│   ├── boost/       # BoostSelectionModal, payment modals
│   ├── cart/        # SoldOverlay, cart components
│   ├── chat/        # OfferCard, OfferSheet
│   ├── dashboard/   # PremiumMetrics, PurchasesTab, SalesTab
│   ├── layout/      # AppLayout, BottomNav, Header
│   ├── location/    # Location permission modals and sheets
│   ├── notifications/ # NotificationCenter, PushPermissionPrompt
│   ├── products/    # ProductCard, ProductGrid, FilterSheet, CategorySlider
│   ├── profile/     # PublicProfileInfoDialog
│   ├── reputation/  # ReputationBadge, ReputationCard, VerificationBadge
│   ├── seller/      # SellerCard, SellerFilters, ReviewsList, FollowersList
│   └── ui/          # shadcn/ui primitives (80+ components)
├── contexts/        # CartContext, ThemeContext
├── data/            # mockProducts.ts
├── hooks/           # 21 custom hooks (useAuth, useProducts, useFavorites, etc.)
├── integrations/
│   └── supabase/    # Auto-generated client.ts and types.ts
├── lib/             # utils.ts, transformProduct.ts, documentValidation.ts, validations.ts
├── pages/           # All page components (Index, Auth, Product, Sell, etc.)
└── types/           # Product, User, Message, Conversation, FilterOptions types

supabase/
├── config.toml      # Project config (auth, storage, functions)
├── functions/       # 14 Edge Functions (Deno/TypeScript)
│   └── _shared/     # Shared CORS headers
└── migrations/      # SQL migrations (full schema)

public/              # PWA assets, service worker, favicon
```

# Environment Variables

| Variable | Purpose | Required |
|----------|---------|----------|
| `VITE_SUPABASE_URL` | Supabase project API URL | Yes |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Supabase anon/public key | Yes |
| `VITE_SUPABASE_PROJECT_ID` | Supabase project ID (used in config.toml) | Yes |

**Edge Function secrets (set via Supabase dashboard or CLI):**

| Variable | Purpose |
|----------|---------|
| `SUPABASE_URL` | Supabase URL for service role client |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key for admin operations |
| `DATA_ENCRYPTION_KEY` | AES-256-GCM key for encrypting CPF/CNPJ/PIX |
| `RESEND_API_KEY` | Resend email service API key |
| `GOOGLE_AI_API_KEY` | Google Gemini API key for content moderation |
| `UPSTASH_REDIS_REST_URL` | Upstash Redis URL for rate limiting |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash Redis token |
| `VAPID_PUBLIC_KEY` | VAPID public key for web push |
| `VAPID_PRIVATE_KEY` | VAPID private key for web push |
| `VAPID_SUBJECT` | VAPID subject (mailto: or URL) |
| `PAGARME_API_KEY` | Pagar.me API key for payments |
| `PAGARME_WEBHOOK_SECRET` | Pagar.me webhook HMAC secret |
| `GOOGLE_AUTH_CLIENT_ID` | Google OAuth client ID |
| `GOOGLE_AUTH_SECRET` | Google OAuth client secret |

# Database Schema

## Enum Types

- **product_category**: camiseta, calca, vestido, jaqueta, saia, shorts, blazer, casaco, acessorios, calcados, camisa, bolsas_carteiras, bodies, roupas_intimas, moda_praia, roupas_esportivas, bones_chapeus, oculos, lencos_cachecois, roupas_infantis, outros
- **product_condition**: novo, usado
- **product_status**: draft, active, sold, reserved, inactive, pending_review
- **order_status**: pending, confirmed, in_transit, delivered, cancelled
- **delivery_method**: pickup, local_delivery
- **app_role**: admin, moderator, user
- **coupon_discount_type**: percentage, fixed
- **coupon_applies_to**: all, specific

## Tables (28 total, all with RLS enabled)

### User Management

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `profiles` | Main user profile | user_id, full_name, display_name, avatar_url, city, email_verified, profile_completed, user_type, suspended_at, followers_count, sold_count, seller_reviews_count/sum, buyer_reviews_count/sum |
| `pf_profiles` | Individual (Pessoa Física) | user_id, full_name, cpf_encrypted, age |
| `pj_profiles` | Business (Pessoa Jurídica) | user_id, company_name, cnpj_encrypted |
| `addresses` | User addresses | user_id, street, number, city, state, zip_code, is_primary |
| `payment_profiles` | PIX payment info | user_id, pix_key_encrypted, pix_key_type |
| `verification_codes` | Email verification OTP | email, code, type, expires_at, used |
| `user_locations` | Geolocation (LGPD compliant) | user_id, latitude, longitude, city, state |
| `user_roles` | RBAC roles | user_id, role (app_role enum) |
| `user_subscriptions` | Plan subscriptions | user_id, plan_type (free/plus/brecho/loja), expires_at |

### Marketplace

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `products` | Product listings | seller_id, title, price, category, condition, status, images[], seller_latitude/longitude, gender, view_count |
| `product_views` | View tracking (30-min dedup) | product_id, viewer_id, viewed_at |
| `product_boosts` | Visibility boosts | product_id, boost_type (24h/3d/7d), expires_at |
| `product_queue` | Waitlist for reserved products | product_id, user_id, position, status |
| `favorites` | Wishlist | user_id, product_id (unique pair) |
| `followers` | Seller follows | follower_id, following_id (unique pair) |
| `profile_views` | Seller profile visits | profile_user_id, viewer_id (30-min dedup) |
| `user_boosts` | Boost credit wallet | user_id, total/used per type (24h, 3d, 7d) |
| `coupons` | Seller discount coupons (loja plan only) | user_id, code, discount_type, discount_value, max_uses |

### Orders & Payments

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `orders` | Purchase orders | buyer_id, seller_id, product_id, status, delivery_method, total_price |
| `order_items` | Order item snapshots | order_id, product_id, title, price, image |
| `boost_payments` | Boost purchase records | user_id, boost_type, amount, asaas_payment_id, status, pix_payload |
| `plan_payments` | Subscription payment records | user_id, plan_type, billing_cycle, amount, pagarme_order_id, status |

### Messaging & Reviews

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `conversations` | Chat threads | participant_1, participant_2, product_id, last_message_at |
| `messages` | Chat messages | conversation_id, sender_id, content, read_at |
| `offers` | Price negotiations | conversation_id, product_id, sender_id, amount, status, parent_offer_id |
| `reviews` | Post-order reviews | order_id, reviewer_id, reviewed_id, rating, comment, review_type |

### System

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `notifications` | In-app notifications | user_id, type, title, body, data (JSONB), read_at |
| `push_subscriptions` | Web push endpoints | user_id, endpoint, p256dh, auth |
| `admin_logs` | Admin audit trail | admin_user_id, action, target_type, target_id, metadata |

## Database Views

- `public_profiles` — Safe public seller profile view (no sensitive data)
- `public_products` — Active products from non-suspended sellers (no coordinates)
- `public_reviews` — Public review display with reviewer info

# Supabase Edge Functions

| Function | Method | Auth | Purpose |
|----------|--------|------|---------|
| `send-verification-code` | POST | Public (rate limited) | Send 6-digit OTP via Resend email |
| `verify-code` | POST | Public (rate limited) | Validate OTP for email/password reset |
| `complete-signup` | POST | Public (rate limited) | Verify code and mark email verified |
| `reset-password` | POST | Public (rate limited) | Reset password with verified OTP |
| `save-user-profile` | POST | JWT or signup flow | Save PF/PJ profile, address, PIX; validates CPF/CNPJ; encrypts with AES-256-GCM |
| `moderate-image` | POST | Public | Image moderation via Gemini 2.5 Flash (blocks screenshots, non-products, NSFW) |
| `moderate-text` | POST | Public | Text moderation via Gemini 2.5 Flash (profanity, spam, hate) |
| `get-vapid-key` | GET/POST | Bearer token | Return VAPID public key for push subscription |
| `send-push-notification` | POST | Service role (trigger) | Send web push to user's subscriptions |
| `create-boost-payment` | POST | Bearer JWT | Create PIX payment for boosts via Pagar.me |
| `create-boost-payment-card` | POST | Bearer JWT | Create credit card payment for boosts via Pagar.me |
| `create-plan-payment` | POST | Bearer JWT | Create PIX payment for plans via Pagar.me |
| `create-plan-payment-card` | POST | Bearer JWT | Create credit card payment for plans via Pagar.me |
| `pagarme-webhook` | POST | HMAC SHA-1 signature | Handle Pagar.me webhooks (paid, failed, cancelled, refunded) |

All functions have `verify_jwt = false` in config.toml (JWT validation done in function code). All include CORS support.

# Authentication Flow

**Providers**: Email/Password, Google OAuth
**Redirect URLs**: `https://kuralab.com.br`, `http://localhost:8080`, `http://localhost:5173`

**Sign Up Flow (5 steps)**:
1. Choose account type (PF individual or PJ business)
2. Enter name and email
3. Verify email with 6-digit OTP (via `send-verification-code` + `verify-code` Edge Functions)
4. Set password (min 8 chars, must contain letter + digit)
5. Complete profile (CPF/CNPJ, age for PF, address, optional PIX key)

**Post-Auth Checks** (enforced by `ProtectedRoute`):
- `email_verified` must be true → otherwise redirect to verify-email
- `profile_completed` must be true → otherwise redirect to profile-setup
- `suspended_at` must be null → otherwise block access with suspension message

**Session**: Persisted in localStorage, auto-refresh enabled, 30-second profile status cache in AuthProvider.

# Routing Structure

### Public Routes
| Path | Page | Notes |
|------|------|-------|
| `/` | Index (Marketplace) | Product grid with infinite scroll |
| `/product/:id` | ProductDetail | Single product view |
| `/seller/:sellerId` | SellerProfile | Public seller page |
| `/search` | Search | Product search with filters |
| `/cart` | Cart | Shopping cart |
| `/auth` | Auth | Login/signup/verify/reset (multi-view via query param) |
| `/terms` | Terms | Terms of service |
| `/privacy-policy` | PrivacyPolicy | Privacy policy |
| `/install` | Install | PWA install instructions |

### Protected Routes (auth + verified email + completed profile)
| Path | Page | Notes |
|------|------|-------|
| `/profile` | Profile | User profile |
| `/dashboard` | Dashboard | Seller/buyer analytics |
| `/favorites` | Favorites | Saved products |
| `/sell` | Sell | Create/edit listing |
| `/messages` | Messages | Conversation list |
| `/chat/:conversationId` | Chat | Direct messaging + offers |
| `/my-listings` | MyListings | Seller's products |
| `/my-sales` | MySales | Seller's completed sales |
| `/my-purchases` | MyPurchases | Buyer's purchases |
| `/checkout` | Checkout | Payment flow |
| `/reviews` | Reviews | View reviews |
| `/review/:orderId` | ReviewOrder | Leave review |
| `/notifications` | Notifications | Notification center |
| `/following` | Following | Followed sellers |
| `/plans` | Plans | Subscription plans |
| `/boosts` | Boosts | Product boost purchase |
| `/profile/coupons` | Coupons | Coupon management |
| `/settings/*` | Settings | Profile, phone, address, PIX, password, shop, support, delete account |

### Admin Routes (admin or moderator role)
| Path | Page |
|------|------|
| `/admin` | Dashboard overview |
| `/admin/moderation` | Moderation queue |
| `/admin/users` | User management |
| `/admin/subscriptions` | Subscription management |
| `/admin/logs` | Admin action logs |

# Data Fetching Patterns

**React Query defaults** (configured in App.tsx):
```typescript
retry: 2, staleTime: 60_000, gcTime: 300_000, refetchOnWindowFocus: false
```

**Query Key Convention**:
```typescript
['products', category, filters, sortOption, lat, lng]
['product', productId, lat, lng]
['infinite-products', category, filters, sortOption, lat, lng]
['favorites', userId]
['notifications', userId]
['notification-count', userId]
```

**Canonical query example** (useProducts.ts):
```typescript
const { data } = useQuery({
  queryKey: ['product', productId, latitude, longitude],
  queryFn: async () => {
    const { data } = await supabase.rpc('get_product_with_distance', {
      p_product_id: productId, user_lat: latitude, user_lng: longitude
    });
    return transformProduct(data);
  },
  staleTime: 5 * 60 * 1000,
});
```

**Canonical mutation example** (useFavorites.ts):
```typescript
const toggleFavorite = useMutation({
  mutationFn: async (productId: string) => {
    await supabase.from('favorites').insert({ user_id, product_id });
  },
  onSuccess: () => queryClient.invalidateQueries({ queryKey: ['favorites', userId] }),
});
```

**Realtime subscriptions**: Cart product status, infinite scroll catalog updates, offers, notifications — all use `supabase.channel().on('postgres_changes', ...).subscribe()`.

# State Management

| State Type | Approach | Location |
|-----------|----------|----------|
| Server state | TanStack React Query v5 | Hooks (useProducts, useFavorites, useNotifications, etc.) |
| Auth state | React Context (AuthProvider) | `src/hooks/useAuth.tsx` |
| Cart state | React Context + localStorage (`kuralab_cart`) | `src/contexts/CartContext.tsx` |
| Theme | React Context + localStorage (`brecho-theme`) | `src/contexts/ThemeContext.tsx` |
| Geolocation | React Context + DB/localStorage | `src/hooks/useGeolocation.tsx` |
| Form state | React Hook Form + Zod | Per-component |

**Provider hierarchy** (in App.tsx):
```
QueryClientProvider → ThemeProvider → AuthProvider → GeolocationProvider → TooltipProvider → CartProvider → BrowserRouter
```

# Payment Integration

**Provider**: Pagar.me (Brazilian payment gateway)

**PIX Flow**:
1. User selects boost/plan → frontend calls Edge Function (`create-boost-payment` or `create-plan-payment`)
2. Edge Function creates Pagar.me order → returns QR code URL + PIX payload + 24h expiration
3. User scans QR or copies payload → pays in banking app
4. Pagar.me sends webhook to `pagarme-webhook` Edge Function (HMAC SHA-1 verified)
5. Function updates `boost_payments`/`plan_payments` status → credits boosts or activates subscription

**Credit Card Flow**: Same but via `create-boost-payment-card` / `create-plan-payment-card` (card data tokenized, never stored).

**Webhook events handled**: `order.paid`, `charge.paid`, `order.payment_failed`, `charge.payment_failed`, `order.canceled`, `charge.refunded`

**Pricing**:
- Boosts: Single 24h=R$5, 3d=R$9.90, 7d=R$14.90 | Pack 5x: 24h=R$19.90, 3d=R$39.90, 7d=R$59.90
- Plans: Plus=R$39.90/mo (R$383.04/yr), Loja=R$99.90/mo (R$959.04/yr)

# UI & Styling Conventions

- **Component library**: shadcn/ui with Radix UI primitives, installed via `components.json` (style: default, base color: slate)
- **Theme colors**: Primary olive green (#5a7a32), cream background (#f7f5f0), custom `olive`, `success`, `muted` palettes
- **Dark mode**: CSS class-based via ThemeProvider
- **Animations**: Framer Motion for page transitions, list stagger, tap feedback; Tailwind keyframes for accordion, fade-up, scale-in
- **Mobile-first**: Fixed bottom nav with safe-area padding, glass-effect header with backdrop blur, pull-to-refresh, scroll-direction detection
- **All UI text is in Portuguese (PT-BR)**: dates, currency (R$), error messages, labels

# Common Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Start Vite dev server on port 8080 |
| `npm run build` | Production build (tsc -b && vite build) |
| `npm run build:dev` | Development mode build |
| `npm run lint` | Run ESLint |
| `npm run preview` | Preview production build |
| `npx supabase start` | Start local Supabase |
| `npx supabase db push` | Push migrations to remote |
| `npx supabase functions serve` | Serve Edge Functions locally |
| `npx supabase migration new <name>` | Create new migration file |

# Development Workflow

1. Clone repo and run `npm install`
2. Copy `.env.example` to `.env` and fill in Supabase credentials
3. Run `npm run dev` — app starts at `http://localhost:8080`
4. For Supabase local dev: `npx supabase start` (requires Docker)
5. Edge Functions: `npx supabase functions serve` (set secrets via `npx supabase secrets set`)
6. Migrations: create with `npx supabase migration new`, apply with `npx supabase db push`
7. Deploy: push to main branch → Vercel auto-deploys

# Code Conventions

- **Components**: PascalCase files, feature-based folders with `index.ts` barrel exports
- **Hooks**: `use` prefix, one hook per file in `src/hooks/`, return objects with named properties
- **Types**: Shared types in `src/types/index.ts`, Supabase auto-generated types in `src/integrations/supabase/types.ts`
- **Path alias**: `@/` maps to `src/` (e.g., `import { supabase } from "@/integrations/supabase/client"`)
- **Styling**: `cn()` utility from `src/lib/utils.ts` for merging Tailwind classes
- **Error handling**: Portuguese toast messages via `sonner`, `translateAuthError()` for Supabase errors
- **Product data**: Always fetched via RPC functions (`get_products_with_distance`, `get_product_with_distance`) — never raw table queries — to calculate distance without exposing coordinates
- **RPC response mapping**: `transformProduct()` in `src/lib/transformProduct.ts` maps snake_case DB responses to camelCase frontend types
- **Edge Functions**: Deno/TypeScript, shared CORS headers in `supabase/functions/_shared/cors.ts`, Upstash rate limiting pattern
- **TypeScript config**: Lenient — `strict: false`, `noImplicitAny: false`, `strictNullChecks: false`
- **ESLint**: `@typescript-eslint/no-unused-vars` disabled

# Key Files Reference

| File | Role |
|------|------|
| `src/App.tsx` | Route definitions, provider hierarchy, React Query config |
| `src/hooks/useAuth.tsx` | Auth provider — session, login, signup, profile status |
| `src/contexts/CartContext.tsx` | Cart state with localStorage persistence and realtime status |
| `src/hooks/useProducts.ts` | Product queries via RPC with distance calculation |
| `src/hooks/useInfiniteProducts.ts` | Infinite scroll product pagination (PAGE_SIZE: 12) |
| `src/hooks/useFavorites.ts` | Favorites with optimistic updates |
| `src/hooks/useOffers.ts` | Offer/counter-offer negotiation logic |
| `src/hooks/useNotifications.ts` | Notifications with realtime subscription |
| `src/hooks/useAdmin.ts` | Admin dashboard operations (stats, users, moderation, logs) |
| `src/hooks/useGeolocation.tsx` | Browser geolocation + reverse geocoding (Nominatim) |
| `src/integrations/supabase/client.ts` | Supabase client singleton |
| `src/integrations/supabase/types.ts` | Auto-generated database types |
| `src/lib/transformProduct.ts` | RPC response → Product type mapper |
| `src/lib/documentValidation.ts` | CPF/CNPJ validation utilities |
| `src/lib/validations.ts` | Zod schemas for forms |
| `src/components/auth/ProtectedRoute.tsx` | Route guard (auth + email + profile checks) |
| `src/components/layout/AppLayout.tsx` | Main layout wrapper (Header + BottomNav) |
| `supabase/functions/pagarme-webhook/index.ts` | Payment webhook handler |
| `supabase/functions/save-user-profile/index.ts` | Profile save with encryption |

# Known Constraints & Decisions

- **Product queries must use RPC functions** — never query the `products` table directly. The RPC calculates distance server-side and hides raw seller coordinates for privacy/LGPD compliance.
- **TypeScript is intentionally lenient** — `strict: false`, no unused var checks. The project was bootstrapped via Lovable.dev (AI code generation platform) and has not been tightened.
- **All Edge Functions set `verify_jwt = false`** in config.toml — JWT validation is handled manually inside each function to support both authenticated and signup flows.
- **CPF, CNPJ, and PIX keys are AES-256-GCM encrypted** in the database — use `DATA_ENCRYPTION_KEY` secret. Never store these in plaintext.
- **Location data rounds to 4 decimal places** (~11m accuracy) for LGPD compliance. Guests store location in localStorage; authenticated users in `user_locations` table.
- **The `profiles` table trigger `handle_new_user()`** auto-creates a profile row on Supabase auth signup — do not create profiles manually.
- **Suspended users** (`suspended_at IS NOT NULL`) are blocked at the AuthProvider level and excluded from product/profile queries via RLS.
- **Boost credits are per-type** (24h, 3d, 7d) — the `user_boosts` table has separate total/used columns for each duration.
- **Product queue system** allows users to join a waitlist for reserved products. When an order is cancelled, the next in queue is automatically promoted via database trigger.

# What NOT to Do

- **Never query `products` table directly** — always use `get_products_with_distance()` or `get_product_with_distance()` RPCs. Direct queries bypass distance calculation and may expose seller coordinates.
- **Never store CPF/CNPJ/PIX in plaintext** — these must always be encrypted via the `save-user-profile` Edge Function.
- **Never skip the `transformProduct()` mapping** when consuming RPC results — the frontend Product type expects camelCase properties.
- **Never add `verify_jwt = true` to Edge Function config** without updating the function code — the current architecture handles JWT manually for flexibility.
- **Never create profile rows manually** — the `handle_new_user()` trigger handles this on auth signup.
- **Never use `refetchOnWindowFocus: true`** — it's globally disabled and enabling it would cause unnecessary API calls on mobile tab switches.
- **Never modify `src/integrations/supabase/types.ts` manually** — it's auto-generated from the database schema.
- **Never expose raw latitude/longitude in public views or API responses** — use the `public_products` view or RPC functions that calculate distance without exposing coordinates.

# Versioning

**Consulte `VERSIONING.md` antes de qualquer merge para `main`.**

- Versão definida em `package.json` → exposta no build como `__APP_VERSION__` (vide `vite.config.ts`) → exibida em `src/pages/Settings.tsx`
- Bump obrigatório a cada merge: `npm run version:patch | version:minor | version:major`
- Versão atual: verifique `package.json` antes de sugerir bump

<!-- Generated by Claude Code on 2026-03-23 -->
