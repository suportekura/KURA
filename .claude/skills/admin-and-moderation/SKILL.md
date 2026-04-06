---
name: admin-and-moderation
description: Use when working with admin features, moderation, user management, role management, suspension, audit logs, admin dashboard, or admin RPC functions. Trigger on keywords like "admin", "moderation", "moderate", "moderator", "approve", "reject", "suspend", "ban", "unsuspend", "role management", "audit log", "admin dashboard", "admin RPC", "pending_review", "ModerationQueue", "AdminUsers", "AdminDashboard", "useAdmin", "has_role", "user_roles", "admin_logs", "content moderation", "image moderation", "text moderation", "Gemini moderation".
---

# Admin & Moderation

This skill documents the admin panel, content moderation system, user management, role-based access, and audit logging in Kura. Admin functionality is accessed via `/admin` routes.

## When to use this skill

- Adding admin features or RPC functions
- Working on the moderation queue
- Managing user roles (admin, moderator)
- Implementing suspension/unsuspension
- Adding audit logging
- Working with AI content moderation (Gemini)
- Creating admin-only database queries

## Core Patterns

### 1. Role-Based Access Control

Three roles defined in `app_role` enum: `admin`, `moderator`, `user`

```typescript
// Frontend check (src/hooks/useUserRoles.ts)
const { data: roles } = await supabase.rpc('get_user_roles', { _user_id: user.id });
const isAdmin = roles?.includes('admin');
const isModerator = roles?.includes('moderator') || isAdmin;
```

```sql
-- Database check (used in RLS policies)
CREATE FUNCTION has_role(_user_id UUID, _role app_role) RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN EXISTS (SELECT 1 FROM user_roles WHERE user_id = _user_id AND role = _role);
END;
$$;

-- RLS policy using has_role()
CREATE POLICY "Admins can view all" ON my_table
  FOR SELECT USING (has_role(auth.uid(), 'admin'));
```

Route protection in `src/App.tsx`:
```tsx
<Route path="/admin" element={<AdminRoute><AdminLayout /></AdminRoute>}>
  <Route index element={<AdminDashboard />} />
  <Route path="users" element={<AdminUsers />} />
  <Route path="moderation" element={<ModerationQueue />} />
</Route>
```

### 2. Admin RPC Functions

All admin operations use dedicated RPC functions (defined in migrations). The `useAdmin` hook in `src/hooks/useAdmin.ts` exposes them:

```typescript
// Dashboard stats
const stats = await supabase.rpc('admin_get_dashboard_stats');
// Returns: totalUsers, activeUsers, newUsersToday, proUsers, mrr, moderationQueue, totalProducts, totalOrders

// Analytics with period
const analytics = await supabase.rpc('admin_get_analytics', { p_days: 30 });
// Returns: daily_signups[], daily_orders[], daily_products[], plans_distribution[], top_categories[]

// User management
const users = await supabase.rpc('admin_list_users', {
  p_search: 'john',
  p_plan_filter: 'plus',
  p_limit: 20,
  p_offset: 0,
});

const details = await supabase.rpc('admin_get_user_details', { p_user_id: userId });

// Subscription management
await supabase.rpc('admin_update_subscription', {
  p_target_user_id: userId,
  p_plan_type: 'plus',
  p_expires_at: '2026-04-23T00:00:00Z',
  p_note: 'Courtesy upgrade',
});

// Boost management
await supabase.rpc('admin_update_boosts', {
  p_target_user_id: userId,
  p_total_boosts: 10,
  p_note: 'Compensation for bug',
});

// Role management
await supabase.rpc('admin_manage_role', {
  p_target_user_id: userId,
  p_role: 'moderator',
  p_action: 'add', // or 'remove'
});

// Suspension
await supabase.rpc('admin_suspend_user', {
  p_target_user_id: userId,
  p_suspend: true,
  p_reason: 'Policy violation',
});

// Audit logs
const logs = await supabase.rpc('admin_get_logs', {
  p_action_filter: 'suspend_user',
  p_limit: 50,
  p_offset: 0,
});
```

### 3. Content Moderation (AI)

Two Edge Functions handle AI moderation via Google Gemini 2.5 Flash:

**Image moderation** (`supabase/functions/moderate-image/index.ts`):
```typescript
// Called from Sell.tsx during product creation
const { data } = await supabase.functions.invoke('moderate-image', {
  body: { imageUrl: publicUrl },
});

// Response:
{
  imageApproved: boolean,
  moderationFlagged: boolean,
  moderationCategories: string[],  // e.g., ['not_product', 'low_quality']
  confidenceScore: number,         // 0.0 - 1.0
  needsManualReview: boolean,      // true if confidence < 0.7
}
```

Blocked categories: screenshots, heavily_edited, not_product, low_quality, sexual, violence, self-harm, illicit, hate

**Text moderation** (`supabase/functions/moderate-text/index.ts`):
```typescript
const { data } = await supabase.functions.invoke('moderate-text', {
  body: { title: productTitle, description: productDescription },
});

// Response:
{
  textApproved: boolean,
  moderationFlagged: boolean,
  moderationCategories: string[],
  flaggedField: 'title' | 'description' | 'both',
  confidenceScore: number,
  needsManualReview: boolean,
}
```

### 4. Moderation Queue

Products flagged by AI go to `status = 'pending_review'`. The ModerationQueue page handles manual review:

```typescript
// Fetch pending items
const { data: pendingProducts } = await supabase
  .from('products')
  .select('*, profiles!products_seller_id_fkey(display_name, avatar_url)')
  .eq('status', 'pending_review')
  .order('created_at', { ascending: true });

// Approve
await supabase
  .from('products')
  .update({ status: 'active' })
  .eq('id', productId);

// Send approval notification
await supabase.from('notifications').insert({
  user_id: sellerId,
  type: 'moderation',
  title: 'Produto aprovado',
  body: `Seu produto "${productTitle}" foi aprovado!`,
  data: { product_id: productId },
});

// Reject (with mandatory reason)
await supabase
  .from('products')
  .update({ status: 'inactive' })
  .eq('id', productId);

await supabase.from('notifications').insert({
  user_id: sellerId,
  type: 'moderation',
  title: 'Produto rejeitado',
  body: `Seu produto "${productTitle}" foi rejeitado. Motivo: ${reviewNotes}`,
  data: { product_id: productId },
});
```

### 5. Audit Logging

All admin actions are logged to the `admin_logs` table:

```sql
-- Table structure
admin_logs (
  id UUID PRIMARY KEY,
  admin_id UUID REFERENCES auth.users(id),
  action TEXT NOT NULL,           -- e.g., 'suspend_user', 'update_subscription'
  target_type TEXT,               -- e.g., 'user', 'product'
  target_id TEXT,                 -- the affected entity ID
  details JSONB,                  -- action-specific metadata
  created_at TIMESTAMPTZ
)
```

Admin RPC functions automatically insert logs:
```sql
INSERT INTO admin_logs (admin_id, action, target_type, target_id, details)
VALUES (
  auth.uid(),
  'suspend_user',
  'user',
  p_target_user_id::text,
  jsonb_build_object('reason', p_reason, 'suspended', p_suspend)
);
```

### 6. Suspension System

Suspension affects the entire app:

```typescript
// In useAuth.tsx — blocks login
if (profileData?.suspended_at) {
  throw new Error('Conta suspensa');
}

// In useConversation.ts — blocks messaging
if (targetProfile?.suspended_at) {
  throw new Error('Este usuário está suspenso');
}

// In RLS policies — hides products from suspended sellers
CREATE POLICY "Public can view active products" ON products
  FOR SELECT USING (
    status = 'active'
    AND NOT EXISTS (
      SELECT 1 FROM profiles p WHERE p.id = products.seller_id AND p.suspended_at IS NOT NULL
    )
  );

// In public_profiles view — hides suspended profiles
CREATE VIEW public_profiles AS SELECT ... FROM profiles WHERE suspended_at IS NULL;
```

## Step-by-step Guide

### Adding a new admin RPC function

1. Create migration with the RPC function:
   ```sql
   CREATE OR REPLACE FUNCTION admin_my_action(
     p_target_id UUID,
     p_param TEXT
   ) RETURNS JSONB
   LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
   BEGIN
     -- Verify admin role
     IF NOT has_role(auth.uid(), 'admin') THEN
       RAISE EXCEPTION 'Unauthorized';
     END IF;

     -- Business logic
     -- ...

     -- Audit log
     INSERT INTO admin_logs (admin_id, action, target_type, target_id, details)
     VALUES (auth.uid(), 'my_action', 'entity', p_target_id::text,
       jsonb_build_object('param', p_param));

     RETURN jsonb_build_object('success', true);
   END;
   $$;
   ```

2. Add to `useAdmin.ts`:
   ```typescript
   const myAction = async (targetId: string, param: string) => {
     const { data, error } = await supabase.rpc('admin_my_action', {
       p_target_id: targetId,
       p_param: param,
     });
     if (error) throw error;
     return data;
   };
   ```

3. Add UI in the appropriate admin page

### Adding a new moderation category

1. Update the Gemini prompt in `moderate-image/index.ts` or `moderate-text/index.ts`
2. Add the new category to the response parsing
3. Update `ModerationQueue.tsx` to display the new category
4. Test with sample content

## Common Mistakes to Avoid

1. **Never skip `has_role()` check in admin RPCs** — all admin functions must verify the caller is admin/moderator
2. **Never forget audit logging** — every admin action must be logged to `admin_logs`
3. **Don't use `auth.uid()` as admin check** — always use `has_role()` which is `SECURITY DEFINER`
4. **Moderation rejection requires a reason** — never reject without `reviewNotes`
5. **Suspension must be checked everywhere** — auth, messaging, product visibility, profile views
6. **Don't expose admin RPCs without `SECURITY DEFINER`** — they bypass RLS intentionally, so the role check inside is critical

## Checklist

- [ ] Admin RPC function starts with `has_role()` authorization check
- [ ] `SECURITY DEFINER` and `SET search_path = public` on the function
- [ ] Audit log inserted for every admin action
- [ ] Frontend calls via `useAdmin` hook
- [ ] Confirmation dialog for destructive actions (suspend, remove role)
- [ ] Toast notification on success/error
- [ ] Moderation notifications sent to affected users
