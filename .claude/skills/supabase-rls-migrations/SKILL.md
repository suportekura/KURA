---
name: supabase-rls-migrations
description: Use when creating database migrations, writing RLS (Row Level Security) policies, adding tables, columns, indexes, triggers, database functions, enums, or views. Trigger on keywords like "migration", "RLS", "policy", "row level security", "create table", "alter table", "add column", "trigger", "database function", "plpgsql", "SECURITY DEFINER", "index", "enum", "view", "has_role", "update_updated_at", "schema change", "permission denied", "policy violation". Also trigger when working with any file in supabase/migrations/.
---

# Supabase RLS & Migrations

This skill documents the database schema conventions, RLS policy patterns, trigger patterns, and migration file standards used in Kura's Supabase backend. The primary schema is in `supabase/migrations/00000000000000_initial_schema.sql`.

## When to use this skill

- Adding a new table to the database
- Writing RLS policies for a table
- Creating a migration file
- Adding triggers (updated_at, notification, etc.)
- Creating database functions (RPCs)
- Adding indexes for performance
- Modifying enums or views

## Core Patterns

### 1. Migration File Naming

```
supabase/migrations/YYYYMMDDHHMMSS_description.sql
```

Example: `20260321000001_increment_coupon_use_count.sql`

### 2. Table Structure Convention

Every table follows this pattern:

```sql
CREATE TABLE public.my_table (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- domain-specific columns
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Enable RLS
ALTER TABLE public.my_table ENABLE ROW LEVEL SECURITY;

-- Trigger for updated_at
CREATE TRIGGER update_my_table_updated_at
  BEFORE UPDATE ON public.my_table
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

Key conventions:
- UUIDs for all primary keys (via `gen_random_uuid()`)
- `user_id` references `auth.users(id)` with `ON DELETE CASCADE`
- `created_at` and `updated_at` as TIMESTAMPTZ with defaults
- RLS always enabled
- `update_updated_at_column()` trigger on every table

### 3. RLS Policy Templates

**Anonymous denial (every table that needs auth):**
```sql
CREATE POLICY "Deny anonymous access to my_table"
  ON public.my_table FOR ALL
  USING (auth.role() = 'authenticated');
```

**Owner-only read:**
```sql
CREATE POLICY "Users can view own records"
  ON public.my_table FOR SELECT
  USING (auth.uid() = user_id);
```

**Owner-only insert:**
```sql
CREATE POLICY "Users can insert own records"
  ON public.my_table FOR INSERT
  WITH CHECK (auth.uid() = user_id);
```

**Owner-only update:**
```sql
CREATE POLICY "Users can update own records"
  ON public.my_table FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
```

**Owner-only delete:**
```sql
CREATE POLICY "Users can delete own records"
  ON public.my_table FOR DELETE
  USING (auth.uid() = user_id);
```

**Admin access:**
```sql
CREATE POLICY "Admins can view all records"
  ON public.my_table FOR SELECT
  USING (has_role(auth.uid(), 'admin'));
```

**Participant-based access (conversations, orders):**
```sql
CREATE POLICY "Users can view their conversations"
  ON public.conversations FOR SELECT
  USING (
    auth.uid() = participant_1 OR auth.uid() = participant_2
  );
```

**Public read for active items:**
```sql
CREATE POLICY "Public can view active products"
  ON public.products FOR SELECT
  USING (
    status = 'active'
    AND NOT EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = products.seller_id AND p.suspended_at IS NOT NULL
    )
  );
```

### 4. The `has_role()` Function

Used to prevent RLS recursion when checking roles:

```sql
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  );
END;
$$;
```

This is `SECURITY DEFINER` so it bypasses RLS on `user_roles` to avoid infinite recursion.

### 5. Notification Trigger Pattern

The project uses triggers to auto-create notifications:

```sql
CREATE OR REPLACE FUNCTION notify_new_message()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_recipient UUID;
  v_sender_name TEXT;
BEGIN
  -- Determine recipient (the other participant)
  SELECT CASE
    WHEN c.participant_1 = NEW.sender_id THEN c.participant_2
    ELSE c.participant_1
  END INTO v_recipient
  FROM public.conversations c WHERE c.id = NEW.conversation_id;

  -- Get sender name
  SELECT display_name INTO v_sender_name
  FROM public.profiles WHERE id = NEW.sender_id;

  -- Insert notification
  INSERT INTO public.notifications (user_id, type, title, body, data)
  VALUES (
    v_recipient,
    'message',
    'Nova mensagem',
    v_sender_name || ' enviou uma mensagem',
    jsonb_build_object(
      'conversation_id', NEW.conversation_id,
      'sender_id', NEW.sender_id
    )
  );

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_new_message_notify
  AFTER INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION notify_new_message();
```

### 6. RPC Function Pattern

For complex queries exposed to the frontend:

```sql
CREATE OR REPLACE FUNCTION get_products_with_distance(
  p_user_lat DOUBLE PRECISION DEFAULT NULL,
  p_user_lon DOUBLE PRECISION DEFAULT NULL,
  p_category TEXT DEFAULT NULL,
  p_condition TEXT DEFAULT NULL,
  p_sizes TEXT[] DEFAULT NULL,
  p_price_min NUMERIC DEFAULT NULL,
  p_price_max NUMERIC DEFAULT NULL,
  p_max_distance NUMERIC DEFAULT NULL,
  p_gender TEXT DEFAULT NULL,
  p_sort TEXT DEFAULT 'newest',
  p_limit INTEGER DEFAULT 20,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
  id UUID,
  title TEXT,
  -- ... all return columns
  distance DOUBLE PRECISION
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT ...
  FROM products p
  LEFT JOIN user_locations ul ON ul.user_id = p.seller_id
  LEFT JOIN profiles pr ON pr.id = p.seller_id
  WHERE p.status = 'active'
    AND (p_category IS NULL OR p.category::text = p_category)
    AND (p_condition IS NULL OR p.condition::text = p_condition)
    -- ... more filters
  ORDER BY
    CASE WHEN p_sort = 'newest' THEN p.created_at END DESC,
    CASE WHEN p_sort = 'price_asc' THEN p.price END ASC,
    CASE WHEN p_sort = 'price_desc' THEN p.price END DESC,
    CASE WHEN p_sort = 'distance' THEN calculate_distance(...) END ASC
  LIMIT p_limit OFFSET p_offset;
END;
$$;

-- Grant access to both authenticated and anonymous users
GRANT EXECUTE ON FUNCTION get_products_with_distance TO authenticated, anon;
```

### 7. Enum Types

Existing enums in the project:

```sql
CREATE TYPE product_category AS ENUM (
  'camiseta', 'calca', 'vestido', 'jaqueta', 'saia', 'shorts',
  'blazer', 'casaco', 'acessorios', 'calcados', 'outros', 'camisa',
  'bolsas_carteiras', 'bodies', 'roupas_intimas', 'moda_praia',
  'roupas_esportivas', 'bones_chapeus', 'oculos', 'lencos_cachecois',
  'roupas_infantis'
);

CREATE TYPE product_condition AS ENUM ('novo', 'usado');
CREATE TYPE product_status AS ENUM ('draft', 'active', 'sold', 'reserved', 'inactive', 'pending_review');
CREATE TYPE order_status AS ENUM ('pending', 'confirmed', 'in_transit', 'delivered', 'cancelled');
CREATE TYPE delivery_method AS ENUM ('pickup', 'local_delivery');
CREATE TYPE app_role AS ENUM ('admin', 'moderator', 'user');
CREATE TYPE coupon_discount_type AS ENUM ('percentage', 'fixed');
CREATE TYPE coupon_applies_to AS ENUM ('all', 'specific');
```

To add a value to an existing enum:
```sql
ALTER TYPE product_category ADD VALUE 'new_category';
```

### 8. Index Strategy

Follow these patterns:

```sql
-- Foreign key lookups
CREATE INDEX idx_products_seller_id ON products(seller_id);

-- Status filtering
CREATE INDEX idx_products_status ON products(status);

-- Sorting
CREATE INDEX idx_products_created_at ON products(created_at DESC);

-- Composite for common query patterns
CREATE INDEX idx_notifications_user_unread ON notifications(user_id, read_at)
  WHERE read_at IS NULL;

-- Deduplication
CREATE UNIQUE INDEX idx_favorites_unique ON favorites(user_id, product_id);
```

### 9. Public Views (Safe Data Exposure)

Views hide sensitive columns from public access:

```sql
CREATE OR REPLACE VIEW public_profiles AS
SELECT
  id, display_name, avatar_url, bio, city, state,
  seller_reviews_count, seller_reviews_sum,
  buyer_reviews_count, buyer_reviews_sum,
  followers_count, created_at, user_type
FROM profiles
WHERE suspended_at IS NULL;
```

## Step-by-step Guide

### Adding a new table

1. Create migration file: `supabase/migrations/YYYYMMDDHHMMSS_add_my_table.sql`
2. Define table with UUID PK, user_id FK, timestamps
3. Enable RLS: `ALTER TABLE ... ENABLE ROW LEVEL SECURITY`
4. Add anonymous denial policy
5. Add owner-only CRUD policies
6. Add admin policies if needed
7. Add `update_updated_at_column()` trigger
8. Add relevant indexes
9. Update `src/integrations/supabase/types.ts` (regenerate or manually add)
10. Run migration: `supabase db push` or `supabase migration up`

## Common Mistakes to Avoid

1. **Never forget `ENABLE ROW LEVEL SECURITY`** — without it, all rows are accessible to everyone
2. **Never use `auth.uid()` inside `SECURITY DEFINER` functions** — it resolves to the function owner, not the caller. Pass user_id as parameter instead.
3. **Don't create RLS policies that reference other RLS-protected tables without `SECURITY DEFINER`** — this causes infinite recursion. Use `has_role()` pattern.
4. **Never forget the anonymous denial policy** — without it, unauthenticated users can access data
5. **Don't use `ON DELETE CASCADE` on `profiles`** — profiles reference `auth.users`, cascading deletions should go auth.users → profiles, not the reverse
6. **Always filter out suspended sellers** in public-facing queries — check `suspended_at IS NOT NULL`
7. **Don't add columns to the types file manually if you can regenerate** — run `supabase gen types typescript` to keep `types.ts` in sync

## Checklist

- [ ] Migration file follows naming convention (`YYYYMMDDHHMMSS_description.sql`)
- [ ] Table has UUID primary key with `gen_random_uuid()`
- [ ] Foreign keys use `ON DELETE CASCADE` where appropriate
- [ ] `created_at` and `updated_at` TIMESTAMPTZ columns with defaults
- [ ] RLS enabled on the table
- [ ] Anonymous denial policy added
- [ ] Owner-only CRUD policies added
- [ ] Admin policies added if table needs admin access
- [ ] `update_updated_at_column()` trigger added
- [ ] Relevant indexes created
- [ ] `src/integrations/supabase/types.ts` updated
