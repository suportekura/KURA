-- 1. Add columns to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS username TEXT,
  ADD COLUMN IF NOT EXISTS username_updated_at TIMESTAMP WITH TIME ZONE;

-- 2. Unique constraint (applied separately so violation messages are clear)
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_username_unique;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_username_unique UNIQUE (username);

-- 3. Format constraint
--    • 3–30 chars
--    • Must start and end with a letter or digit
--    • Allowed interior: letters, digits, dot (.), underscore (_)
--    • ".." and "__" are banned; mixed "_." and "._" are allowed
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS username_format;
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
