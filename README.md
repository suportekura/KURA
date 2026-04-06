# Kura - Brecho Online

Kura ([kuralab.com.br](https://kuralab.com.br)) is a Brazilian online thrift store marketplace where individuals (PF) and businesses (PJ) list and sell second-hand clothing. Buyers browse products by category, filter by distance/price/condition, chat with sellers, make offers, and purchase via PIX or credit card.

## Features

- **Marketplace** — Browse products with infinite scroll, filter by category/condition/size/price/distance/gender, sort by distance/price/newest
- **Geolocation** — Proximity-based product discovery with Haversine distance calculation (coordinates rounded for LGPD compliance)
- **Real-time Chat** — Direct messaging between buyers and sellers with delivery/read receipts
- **Offer System** — Price negotiation with offers and counter-offers inside conversations
- **Shopping Cart** — Multi-seller cart with real-time stock monitoring (alerts when items are sold/reserved)
- **Product Queue** — Waitlist system for reserved products with automatic promotion when orders are cancelled
- **Payments** — PIX (QR code) and credit card via Pagar.me with webhook-based confirmation
- **Subscription Plans** — Free, Plus (R$39,90/mo), and Loja Oficial (R$99,90/mo) tiers with annual discounts
- **Product Boosts** — Paid visibility boosts (24h, 3 days, 7 days) purchasable individually or in packs
- **Content Moderation** — AI-powered image and text moderation via Google Gemini 2.5 Flash
- **Reputation System** — Buyer and seller reviews with weighted ratings
- **Coupon System** — Seller-created discount coupons (percentage or fixed, all or specific products)
- **Push Notifications** — Web Push (VAPID/RFC 8291) for messages, orders, offers, and moderation events
- **Admin Panel** — Dashboard analytics, user management, role management (admin/moderator), moderation queue, audit logs, suspension system
- **PWA** — Installable progressive web app with offline caching

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + TypeScript + Vite (SWC) |
| UI | shadcn/ui (Radix) + Tailwind CSS + Framer Motion |
| State | TanStack React Query v5 + React Context |
| Forms | React Hook Form + Zod |
| Backend | Supabase (PostgreSQL + Auth + Realtime + Edge Functions + Storage) |
| Auth | Email/Password + Google OAuth |
| Payments | Pagar.me v5 (PIX + Credit Card) |
| Moderation | Google Gemini 2.5 Flash |
| Email | Resend API |
| Push | Web Push API (VAPID) |
| Rate Limiting | Upstash Redis |
| Deployment | Vercel (SPA) |

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- Supabase account with a project configured
- (Optional) Docker for local Supabase development

### Installation

```bash
# Clone the repository
git clone https://github.com/LuisForasteiro/kura-lab.git
cd kura-lab

# Install dependencies
npm install

# Configure environment variables
cp .env.example .env
# Edit .env with your Supabase project credentials

# Start the development server
npm run dev
```

The app will be available at `http://localhost:8080`.

### Environment Variables

| Variable | Purpose |
|----------|---------|
| `VITE_SUPABASE_URL` | Supabase project API URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Supabase anon/public key |
| `VITE_SUPABASE_PROJECT_ID` | Supabase project ID |

Edge Function secrets (set via Supabase dashboard or `supabase secrets set`):

`SUPABASE_SERVICE_ROLE_KEY`, `DATA_ENCRYPTION_KEY`, `RESEND_API_KEY`, `GOOGLE_GEMINI_API_KEY`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, `PAGARME_API_KEY`, `PAGARME_WEBHOOK_SECRET`

## Project Structure

```
src/
├── assets/              # Static images (logos, badges)
├── components/
│   ├── ui/              # shadcn/ui primitives
│   ├── auth/            # ProtectedRoute, AdminRoute, ProfileSetupForm
│   ├── boost/           # Boost selection and payment modals
│   ├── cart/            # Cart overlays
│   ├── chat/            # OfferCard, OfferSheet
│   ├── dashboard/       # Sales/purchases tabs, premium metrics
│   ├── layout/          # AppLayout, Header, BottomNav
│   ├── location/        # Location permission modals
│   ├── notifications/   # NotificationCenter, PushPermissionPrompt
│   ├── products/        # ProductCard, ProductGrid, FilterSheet
│   ├── reputation/      # ReputationBadge, VerificationBadge
│   └── seller/          # SellerCard, ReviewsList, FollowersList
├── contexts/            # CartContext, ThemeContext
├── hooks/               # 19 custom hooks
├── integrations/
│   └── supabase/        # Client and auto-generated types
├── lib/                 # Utilities, validations, animations
├── pages/               # All page components
│   ├── admin/           # Admin panel pages
│   └── settings/        # Settings sub-pages
└── types/               # Shared TypeScript types

supabase/
├── config.toml          # Project config
├── functions/           # 14 Edge Functions (Deno)
│   └── _shared/         # Shared CORS headers
└── migrations/          # SQL schema migrations
```

## Database

29 tables with Row Level Security (RLS) enabled on all. Key tables:

- **profiles**, **pf_profiles**, **pj_profiles** — User identity (PF/PJ)
- **products**, **favorites**, **product_queue**, **product_boosts** — Marketplace
- **orders**, **order_items** — Purchases
- **conversations**, **messages**, **offers** — Messaging & negotiation
- **user_subscriptions**, **user_boosts**, **coupons** — Monetization
- **notifications**, **push_subscriptions** — Notifications
- **user_roles**, **admin_logs** — Admin & audit

Full schema in `supabase/migrations/00000000000000_initial_schema.sql`.

## Edge Functions

| Function | Purpose |
|----------|---------|
| `send-verification-code` | Send 6-digit OTP via email (Resend) |
| `verify-code` | Validate OTP |
| `complete-signup` | Mark email as verified |
| `reset-password` | Reset password with OTP |
| `save-user-profile` | Save profile with AES-256-GCM encryption for CPF/CNPJ |
| `moderate-image` | AI image moderation (Gemini) |
| `moderate-text` | AI text moderation (Gemini) |
| `create-boost-payment` | PIX payment for boosts (Pagar.me) |
| `create-boost-payment-card` | Card payment for boosts (Pagar.me) |
| `create-plan-payment` | PIX payment for plans (Pagar.me) |
| `create-plan-payment-card` | Card payment for plans (Pagar.me) |
| `pagarme-webhook` | Payment webhook handler (HMAC verified) |
| `send-push-notification` | Web Push delivery |
| `get-vapid-key` | Return VAPID public key |

## Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server (port 8080) |
| `npm run build` | Production build |
| `npm run build:dev` | Development mode build |
| `npm run lint` | Run ESLint |
| `npm run preview` | Preview production build |

## Claude Code Skills

This project includes 9 custom [Claude Code](https://claude.com/claude-code) skills in `.claude/skills/` that encode project-specific patterns and conventions:

| Skill | What it covers |
|-------|---------------|
| `supabase-data-fetching` | TanStack Query integration, RPC calls, realtime subscriptions |
| `supabase-edge-functions` | Edge Function boilerplate, CORS, auth, rate limiting |
| `supabase-rls-migrations` | RLS policies, triggers, migrations, SECURITY DEFINER |
| `react-hooks-pattern` | Custom hooks, context providers, stale closure prevention |
| `page-and-component-creation` | Routing, shadcn/ui, Framer Motion, loading states |
| `payment-integration` | Pagar.me PIX + card flows, webhook processing |
| `chat-and-realtime` | Messaging, offers, notifications, realtime channels |
| `admin-and-moderation` | Admin RPCs, AI moderation, roles, suspension |
| `brazilian-marketplace-patterns` | CPF/CNPJ validation, BRL currency, pt-BR conventions |

These skills are automatically loaded by Claude Code and help maintain consistency when contributing to the project.

## License

Private project. All rights reserved.
