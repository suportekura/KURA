---
name: page-and-component-creation
description: Use when creating new pages, components, routes, or modifying the UI layout. Trigger on keywords like "new page", "new component", "add route", "create page", "create component", "protected route", "layout", "navigation", "bottom nav", "header", "shadcn", "ui component", "modal", "sheet", "dialog", "form", "skeleton", "loading state", "framer motion", "animation", "ProductCard", "FilterSheet", "AppLayout", "BottomNav". Also trigger when adding files to src/pages/ or src/components/.
---

# Page & Component Creation

This skill documents how to create new pages and components in Kura following existing conventions for routing, layout, UI components, animations, and loading states.

## When to use this skill

- Creating a new page (route)
- Creating a new reusable component
- Adding a route to the router
- Setting up protected/admin routes
- Using shadcn/ui components
- Adding loading skeletons
- Implementing Framer Motion animations

## Core Patterns

### 1. Route Registration

All routes are defined in `src/App.tsx` using React Router v6:

```tsx
// src/App.tsx
<Routes>
  {/* Public routes */}
  <Route path="/auth" element={<PublicRoute><Auth /></PublicRoute>} />
  <Route path="/privacy" element={<PrivacyPolicy />} />
  <Route path="/terms" element={<Terms />} />

  {/* Protected routes (require auth + email verified + profile completed) */}
  <Route path="/" element={<ProtectedRoute><Index /></ProtectedRoute>} />
  <Route path="/product/:id" element={<ProtectedRoute><ProductDetail /></ProtectedRoute>} />
  <Route path="/sell" element={<ProtectedRoute><Sell /></ProtectedRoute>} />
  <Route path="/chat/:conversationId" element={<ProtectedRoute><Chat /></ProtectedRoute>} />

  {/* Admin routes */}
  <Route path="/admin" element={<AdminRoute><AdminLayout /></AdminRoute>}>
    <Route index element={<AdminDashboard />} />
    <Route path="users" element={<AdminUsers />} />
    <Route path="moderation" element={<ModerationQueue />} />
  </Route>

  {/* Settings sub-routes */}
  <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
  <Route path="/settings/edit-profile" element={<ProtectedRoute><EditProfile /></ProtectedRoute>} />

  <Route path="*" element={<NotFound />} />
</Routes>
```

Route wrappers:
- `<ProtectedRoute>` — requires auth + email verified + profile completed
- `<PublicRoute>` — prevents logged-in users from seeing auth page
- `<AdminRoute>` — requires admin or moderator role

### 2. Page Structure

Every page follows this template:

```tsx
// src/pages/MyPage.tsx
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useAuth } from "@/hooks/useAuth";
import { fadeUpVariants, staggerContainer, staggerItem } from "@/lib/animations";
import { Skeleton } from "@/components/ui/skeleton";
// ... other imports

export default function MyPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);

  useEffect(() => {
    // fetch data
    setLoading(false);
  }, [user?.id]);

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-6 space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  return (
    <motion.div
      className="container mx-auto px-4 py-6 pb-24"
      variants={staggerContainer}
      initial="hidden"
      animate="visible"
    >
      <motion.h1
        className="text-2xl font-bold mb-6"
        variants={staggerItem}
      >
        Page Title
      </motion.h1>

      <motion.div variants={staggerItem}>
        {/* Page content */}
      </motion.div>
    </motion.div>
  );
}
```

Key conventions:
- `pb-24` padding-bottom for BottomNav clearance
- `container mx-auto px-4` for consistent horizontal padding
- Framer Motion `staggerContainer` + `staggerItem` for enter animations
- Skeleton loading states matching final layout shape
- Default export for pages

### 3. Component Structure

Components are organized by domain:

```
src/components/
├── ui/              # shadcn/ui primitives (don't modify)
├── auth/            # ProtectedRoute, ProfileSetupForm
├── boost/           # BoostSelectionModal, PaymentModals
├── cart/            # SoldOverlay
├── chat/            # OfferCard, OfferSheet
├── dashboard/       # PremiumMetricsSection, tabs
├── layout/          # AppLayout, Header, BottomNav
├── location/        # LocationPermissionModal, etc.
├── notifications/   # NotificationCenter, PushPrompt
├── products/        # ProductCard, ProductGrid, FilterSheet
├── profile/         # PublicProfileInfoDialog
├── reputation/      # ReputationBadge, VerificationBadge
├── seller/          # SellerCard, ReviewsList, FollowersList
├── animations/      # AnimatedRoutes
```

Component file template:

```tsx
// src/components/my-domain/MyComponent.tsx
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

interface MyComponentProps {
  title: string;
  onAction: () => void;
  className?: string;
}

export function MyComponent({ title, onAction, className }: MyComponentProps) {
  return (
    <Card className={cn("overflow-hidden", className)}>
      <CardContent className="p-4">
        <h3 className="font-semibold">{title}</h3>
        <Button onClick={onAction} className="mt-2">
          Action
        </Button>
      </CardContent>
    </Card>
  );
}
```

Conventions:
- Named exports for components (not default)
- `cn()` utility for conditional class merging
- `className` prop for external styling
- TypeScript interface for props

### 4. shadcn/ui Usage

The project uses shadcn/ui with the default style. Available components are in `src/components/ui/`. Common ones:

```tsx
// Buttons
import { Button } from "@/components/ui/button";
<Button variant="default|destructive|outline|secondary|ghost|link" size="default|sm|lg|icon">

// Cards
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// Dialogs (modals)
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

// Sheets (bottom/side panels)
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

// Forms
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

// Feedback
import { useToast } from "@/hooks/use-toast";
const { toast } = useToast();
toast({ title: "Sucesso!", description: "Operação concluída." });
toast({ title: "Erro", description: "Algo deu errado.", variant: "destructive" });

// Also available: Tabs, Badge, Skeleton, Avatar, Separator, ScrollArea, Tooltip, etc.
```

### 5. Framer Motion Animations

Import presets from `src/lib/animations.ts`:

```tsx
import {
  fadeUpVariants,    // Fade in + slide up
  fadeInVariants,    // Fade in only
  scaleInVariants,   // Scale from 0.95 + fade
  staggerContainer,  // Parent for staggered children
  staggerItem,       // Child items with stagger delay
  gridStagger,       // Parent for grid animations
  gridItem,          // Grid child items
  tapFeedback,       // scale: 0.97 on tap
  cardInteraction,   // hover: translateY(-2px), tap: scale(0.98)
} from "@/lib/animations";
```

Usage:

```tsx
// List with stagger
<motion.div variants={staggerContainer} initial="hidden" animate="visible">
  {items.map(item => (
    <motion.div key={item.id} variants={staggerItem}>
      {/* content */}
    </motion.div>
  ))}
</motion.div>

// Interactive card
<motion.div {...cardInteraction}>
  <Card>...</Card>
</motion.div>

// Simple fade-up
<motion.div variants={fadeUpVariants} initial="hidden" animate="visible">
  Content
</motion.div>
```

### 6. Icons

The project uses `lucide-react`:

```tsx
import { Heart, ShoppingCart, MessageCircle, MapPin, Star, ChevronLeft, Loader2 } from "lucide-react";

// Loading spinner
<Loader2 className="h-4 w-4 animate-spin" />

// Back button pattern
<Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
  <ChevronLeft className="h-5 w-5" />
</Button>
```

### 7. Navigation Patterns

```tsx
import { useNavigate, useParams, useSearchParams } from "react-router-dom";

const navigate = useNavigate();
const { id } = useParams();
const [searchParams] = useSearchParams();

// Navigate with state
navigate('/chat/' + conversationId);
navigate('/auth', { state: { view: 'verify-email' } });
navigate(-1); // go back

// Read query params
const productId = searchParams.get('product');
```

### 8. Layout System

`AppLayout` wraps all main pages with Header + BottomNav:

```tsx
// src/components/layout/AppLayout.tsx
<div className="min-h-screen bg-background">
  <Header />
  <main className="pb-20"> {/* space for BottomNav */}
    <Outlet />
  </main>
  <BottomNav />
</div>
```

Admin pages use `AdminLayout` with a sidebar instead.

## Step-by-step Guide

### Adding a new protected page

1. Create `src/pages/MyPage.tsx` with the page template above
2. Add route in `src/App.tsx`:
   ```tsx
   <Route path="/my-page" element={<ProtectedRoute><MyPage /></ProtectedRoute>} />
   ```
3. Add navigation link where appropriate (BottomNav, Settings menu, etc.)
4. Implement loading skeleton matching the final layout
5. Add Framer Motion enter animations

### Adding a new component

1. Create folder if new domain: `src/components/my-domain/`
2. Create component file: `MyComponent.tsx`
3. Create `index.ts` barrel export if multiple components:
   ```typescript
   export { MyComponent } from './MyComponent';
   export { MyOtherComponent } from './MyOtherComponent';
   ```
4. Use `cn()` for className merging
5. Accept `className` prop for flexibility

## Common Mistakes to Avoid

1. **Don't forget `pb-24` on page containers** — BottomNav overlaps content without it
2. **Don't modify files in `src/components/ui/`** — these are shadcn/ui generated; customize via `tailwind.config.ts` CSS variables instead
3. **Don't use `useEffect` for data fetching** when TanStack Query works — only Chat.tsx has a valid reason (complex realtime merging)
4. **Don't forget the loading skeleton** — every page should have a skeleton that matches its layout shape
5. **Don't import from `react-router-dom` without checking** — use `useNavigate()`, not `<Link>` for programmatic nav; use `<Link>` for SEO-relevant links
6. **Don't create pages without `ProtectedRoute`** — only auth, privacy, terms are public
7. **Don't hardcode colors** — use Tailwind theme tokens (`text-primary`, `bg-muted`, etc.) which respect dark mode

## Checklist

- [ ] Page registered in `src/App.tsx` routes
- [ ] Wrapped in `ProtectedRoute` (or `PublicRoute` / `AdminRoute` if applicable)
- [ ] Loading skeleton implemented
- [ ] `pb-24` on main container for BottomNav clearance
- [ ] Framer Motion enter animations applied
- [ ] `cn()` used for conditional classes
- [ ] Icons from `lucide-react`
- [ ] Toast notifications for user feedback
- [ ] Component uses TypeScript interface for props
