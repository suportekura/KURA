-- ============================================================
-- Fix subscription expiry check in RPCs
-- The condition `us.expires_at > now()` evaluates to NULL (not TRUE)
-- when expires_at IS NULL, silently hiding valid subscriptions.
-- Fix: use `(us.expires_at IS NULL OR us.expires_at > now())`
-- Also add plan_type != 'free' filter to avoid free rows matching.
-- ============================================================

-- Fix get_products_with_distance: seller_plan_type lateral join
CREATE OR REPLACE FUNCTION public.get_products_with_distance(
  user_lat DOUBLE PRECISION DEFAULT NULL,
  user_lng DOUBLE PRECISION DEFAULT NULL,
  p_category TEXT DEFAULT NULL,
  p_conditions TEXT[] DEFAULT NULL,
  p_sizes TEXT[] DEFAULT NULL,
  p_price_min DOUBLE PRECISION DEFAULT NULL,
  p_price_max DOUBLE PRECISION DEFAULT NULL,
  p_max_distance DOUBLE PRECISION DEFAULT NULL,
  p_sort_by TEXT DEFAULT 'distance',
  p_limit INTEGER DEFAULT 20,
  p_offset INTEGER DEFAULT 0,
  p_gender TEXT DEFAULT NULL
)
RETURNS TABLE(
  id UUID,
  title TEXT,
  description TEXT,
  price NUMERIC,
  original_price NUMERIC,
  size TEXT,
  brand TEXT,
  category TEXT,
  condition TEXT,
  status TEXT,
  images TEXT[],
  seller_id UUID,
  seller_city TEXT,
  seller_state TEXT,
  seller_display_name TEXT,
  seller_avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE,
  distance_km DOUBLE PRECISION,
  gender TEXT,
  is_boosted BOOLEAN,
  seller_plan_type TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT
    p.id, p.title, p.description, p.price, p.original_price,
    p.size, p.brand, p.category::text, p.condition::text, p.status::text,
    p.images, p.seller_id, p.seller_city, p.seller_state,
    pr.display_name AS seller_display_name,
    COALESCE(pr.shop_logo_url, pr.avatar_url) AS seller_avatar_url,
    p.created_at,
    CASE
      WHEN user_lat IS NOT NULL AND user_lng IS NOT NULL
           AND p.seller_latitude IS NOT NULL AND p.seller_longitude IS NOT NULL
      THEN public.calculate_distance(user_lat::numeric, user_lng::numeric, p.seller_latitude, p.seller_longitude)::double precision
      ELSE NULL
    END AS distance_km,
    p.gender,
    (boost.expires_at IS NOT NULL) AS is_boosted,
    sub.plan_type AS seller_plan_type
  FROM public.products p
  LEFT JOIN public.profiles pr ON p.seller_id = pr.user_id
  LEFT JOIN LATERAL (
    SELECT pb.expires_at
    FROM public.product_boosts pb
    WHERE pb.product_id = p.id AND pb.expires_at > now()
    ORDER BY pb.expires_at DESC
    LIMIT 1
  ) boost ON true
  LEFT JOIN LATERAL (
    SELECT us.plan_type
    FROM public.user_subscriptions us
    WHERE us.user_id = p.seller_id
      AND us.plan_type != 'free'
      AND (us.expires_at IS NULL OR us.expires_at > now())
    ORDER BY us.expires_at DESC NULLS LAST
    LIMIT 1
  ) sub ON true
  WHERE p.status = 'active'
    AND (p_category IS NULL OR p.category::text = p_category)
    AND (p_conditions IS NULL OR array_length(p_conditions, 1) IS NULL OR p.condition::text = ANY(p_conditions))
    AND (p_sizes IS NULL OR array_length(p_sizes, 1) IS NULL OR p.size = ANY(p_sizes))
    AND (p_price_min IS NULL OR p.price >= p_price_min)
    AND (p_price_max IS NULL OR p.price <= p_price_max)
    AND (p_gender IS NULL OR p.gender = p_gender)
    AND (
      p_max_distance IS NULL
      OR user_lat IS NULL
      OR user_lng IS NULL
      OR p.seller_latitude IS NULL
      OR p.seller_longitude IS NULL
      OR public.calculate_distance(user_lat::numeric, user_lng::numeric, p.seller_latitude, p.seller_longitude)::double precision <= p_max_distance
    )
  ORDER BY
    CASE WHEN boost.expires_at IS NOT NULL THEN 0 ELSE 1 END ASC,
    boost.expires_at ASC NULLS LAST,
    CASE
      WHEN p_sort_by = 'distance' AND user_lat IS NOT NULL AND user_lng IS NOT NULL THEN
        public.calculate_distance(user_lat::numeric, user_lng::numeric, p.seller_latitude, p.seller_longitude)::double precision
      ELSE NULL
    END ASC NULLS LAST,
    CASE WHEN p_sort_by = 'price_asc' THEN p.price END ASC,
    CASE WHEN p_sort_by = 'price_desc' THEN p.price END DESC,
    CASE WHEN p_sort_by = 'newest' OR p_sort_by = 'distance' THEN p.created_at END DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.get_products_with_distance TO authenticated, anon;

-- Fix search_profiles: same NULL expires_at issue
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
    AND us.plan_type != 'free'
    AND (us.expires_at IS NULL OR us.expires_at > now())
  WHERE
    p.suspended_at IS NULL
    AND p.username IS NOT NULL
    AND (
      LOWER(p.username) LIKE '%' || LOWER(LTRIM(p_query, '@')) || '%'
      OR p.display_name ILIKE '%' || LTRIM(p_query, '@') || '%'
    )
  LIMIT 20;
$$;

GRANT EXECUTE ON FUNCTION public.search_profiles TO authenticated, anon;
