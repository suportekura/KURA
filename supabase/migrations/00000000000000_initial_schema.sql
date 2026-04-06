-- ============================================================
-- KURA - Consolidated Initial Schema
-- End-state of all migrations as of 2026-03-21
-- ============================================================

-- ============================================================
-- EXTENSIONS
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pg_net SCHEMA extensions;

-- ============================================================
-- ENUM TYPES
-- ============================================================

CREATE TYPE public.product_category AS ENUM (
  'camiseta',
  'calca',
  'vestido',
  'jaqueta',
  'saia',
  'shorts',
  'blazer',
  'casaco',
  'acessorios',
  'calcados',
  'outros',
  'camisa',
  'bolsas_carteiras',
  'bodies',
  'roupas_intimas',
  'moda_praia',
  'roupas_esportivas',
  'bones_chapeus',
  'oculos',
  'lencos_cachecois',
  'roupas_infantis'
);

CREATE TYPE public.product_condition AS ENUM (
  'novo',
  'usado'
);

CREATE TYPE public.product_status AS ENUM (
  'draft',
  'active',
  'sold',
  'reserved',
  'inactive',
  'pending_review'
);

CREATE TYPE public.order_status AS ENUM (
  'pending',
  'confirmed',
  'in_transit',
  'delivered',
  'cancelled'
);

CREATE TYPE public.delivery_method AS ENUM (
  'pickup',
  'local_delivery'
);

CREATE TYPE public.app_role AS ENUM (
  'admin',
  'moderator',
  'user'
);

CREATE TYPE public.coupon_discount_type AS ENUM (
  'percentage',
  'fixed'
);

CREATE TYPE public.coupon_applies_to AS ENUM (
  'all',
  'specific'
);

-- ============================================================
-- TABLES
-- ============================================================

-- profiles: core user profile table
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  avatar_url TEXT,
  city TEXT,
  phone TEXT,
  email_verified BOOLEAN DEFAULT false,
  display_name TEXT,
  profile_completed BOOLEAN NOT NULL DEFAULT false,
  terms_accepted BOOLEAN DEFAULT false,
  terms_accepted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  user_type TEXT CHECK (user_type IN ('PF', 'PJ')),
  banner_url TEXT,
  followers_count INTEGER DEFAULT 0,
  sold_count INTEGER DEFAULT 0,
  shop_description TEXT,
  business_hours JSONB DEFAULT '{}',
  social_instagram TEXT,
  social_whatsapp TEXT,
  social_website TEXT,
  shop_logo_url TEXT,
  seller_reviews_count INTEGER NOT NULL DEFAULT 0,
  seller_reviews_sum NUMERIC NOT NULL DEFAULT 0,
  buyer_reviews_count INTEGER NOT NULL DEFAULT 0,
  buyer_reviews_sum NUMERIC NOT NULL DEFAULT 0,
  suspended_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  suspended_by UUID DEFAULT NULL,
  suspension_reason TEXT DEFAULT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- verification_codes: email verification and password reset codes
CREATE TABLE public.verification_codes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL,
  code TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'email_verification',
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  used BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- pf_profiles: Pessoa Fisica extended profile
CREATE TABLE public.pf_profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  display_name TEXT NOT NULL,
  cpf_encrypted TEXT NOT NULL,
  age INTEGER NOT NULL CHECK (age >= 18),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- pj_profiles: Pessoa Juridica extended profile
CREATE TABLE public.pj_profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  company_name TEXT NOT NULL,
  display_name TEXT NOT NULL,
  cnpj_encrypted TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- addresses
CREATE TABLE public.addresses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  street TEXT NOT NULL,
  number TEXT NOT NULL,
  complement TEXT,
  neighborhood TEXT NOT NULL,
  city TEXT NOT NULL,
  state TEXT NOT NULL,
  zip_code TEXT NOT NULL,
  is_primary BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- payment_profiles: seller PIX payment info
CREATE TABLE public.payment_profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  pix_key_encrypted TEXT NOT NULL,
  pix_key_type TEXT NOT NULL CHECK (pix_key_type IN ('cpf', 'cnpj', 'email', 'phone', 'random')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- user_locations: for proximity-based marketplace features (LGPD compliant)
CREATE TABLE public.user_locations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  latitude NUMERIC(8, 4) NOT NULL,
  longitude NUMERIC(9, 4) NOT NULL,
  accuracy NUMERIC(10, 2),
  city TEXT,
  state TEXT,
  location_updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- products: marketplace listings
CREATE TABLE public.products (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  seller_id UUID NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  price NUMERIC(10, 2) NOT NULL CHECK (price > 0),
  original_price NUMERIC(10, 2),
  size TEXT NOT NULL,
  brand TEXT NOT NULL,
  category public.product_category NOT NULL,
  condition public.product_condition NOT NULL,
  status public.product_status NOT NULL DEFAULT 'active',
  images TEXT[] NOT NULL DEFAULT '{}',
  seller_latitude NUMERIC(8, 4),
  seller_longitude NUMERIC(9, 4),
  seller_city TEXT,
  seller_state TEXT,
  gender TEXT NOT NULL DEFAULT 'U' CHECK (gender IN ('M', 'F', 'U')),
  moderation_status TEXT DEFAULT NULL,
  moderation_notes TEXT DEFAULT NULL,
  moderated_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  reviewed_by UUID REFERENCES auth.users(id),
  review_notes TEXT,
  reserved_at TIMESTAMP WITH TIME ZONE,
  view_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- favorites
CREATE TABLE public.favorites (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, product_id)
);

-- followers
CREATE TABLE public.followers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  follower_id UUID NOT NULL,
  following_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(follower_id, following_id)
);

-- orders
CREATE TABLE public.orders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  buyer_id UUID NOT NULL,
  seller_id UUID NOT NULL,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE SET NULL,
  status public.order_status NOT NULL DEFAULT 'pending',
  delivery_method public.delivery_method NOT NULL,
  total_price NUMERIC NOT NULL,
  delivery_address TEXT,
  delivery_notes TEXT,
  confirmed_at TIMESTAMP WITH TIME ZONE,
  delivered_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- order_items: snapshot of product at time of order
CREATE TABLE public.order_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  product_id UUID NOT NULL,
  title TEXT NOT NULL,
  price NUMERIC NOT NULL,
  size TEXT NOT NULL,
  brand TEXT,
  image TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- reviews
CREATE TABLE public.reviews (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  reviewer_id UUID NOT NULL,
  reviewed_id UUID NOT NULL,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  review_type TEXT NOT NULL CHECK (review_type IN ('buyer_to_seller', 'seller_to_buyer')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(order_id, review_type)
);

-- conversations: messaging between users
CREATE TABLE public.conversations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  participant_1 UUID NOT NULL,
  participant_2 UUID NOT NULL,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  last_message_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(participant_1, participant_2, product_id)
);

-- messages
CREATE TABLE public.messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL,
  content TEXT NOT NULL,
  read_at TIMESTAMP WITH TIME ZONE,
  delivered_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- notifications
CREATE TABLE public.notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  data JSONB DEFAULT '{}',
  read_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- offers: price negotiation
CREATE TABLE public.offers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL,
  amount NUMERIC NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'countered', 'expired')),
  parent_offer_id UUID REFERENCES public.offers(id) ON DELETE SET NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + interval '24 hours'),
  responded_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- push_subscriptions: web push notification subscriptions
CREATE TABLE public.push_subscriptions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  endpoint TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, endpoint)
);

-- user_roles: RBAC roles
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role public.app_role NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

-- user_subscriptions: plan subscriptions (free, plus, brecho, loja)
CREATE TABLE public.user_subscriptions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  plan_type TEXT NOT NULL DEFAULT 'free',
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- user_boosts: boost credit wallet per user
CREATE TABLE public.user_boosts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  total_boosts INTEGER NOT NULL DEFAULT 0,
  used_boosts INTEGER NOT NULL DEFAULT 0,
  total_boosts_24h INTEGER NOT NULL DEFAULT 0,
  used_boosts_24h INTEGER NOT NULL DEFAULT 0,
  total_boosts_3d INTEGER NOT NULL DEFAULT 0,
  used_boosts_3d INTEGER NOT NULL DEFAULT 0,
  total_boosts_7d INTEGER NOT NULL DEFAULT 0,
  used_boosts_7d INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- product_boosts: individual boost records
CREATE TABLE public.product_boosts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  boost_type TEXT NOT NULL CHECK (boost_type IN ('24h', '3d', '7d')),
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- admin_logs: admin action audit trail
CREATE TABLE public.admin_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id UUID NOT NULL,
  action TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT,
  metadata JSONB DEFAULT '{}'::JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- product_views: deduplicated product view tracking
CREATE TABLE public.product_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  viewer_id UUID NOT NULL,
  viewed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- product_queue: waitlist for reserved products
CREATE TABLE public.product_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL,
  user_id UUID NOT NULL,
  position INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'waiting',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  promoted_at TIMESTAMP WITH TIME ZONE,
  promotion_expires_at TIMESTAMP WITH TIME ZONE,
  UNIQUE(product_id, user_id)
);

-- boost_payments: payment records for boost purchases
CREATE TABLE public.boost_payments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  boost_type TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  amount NUMERIC NOT NULL,
  asaas_payment_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  pix_payload TEXT,
  pix_qrcode_base64 TEXT,
  pix_expiration TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- plan_payments: payment records for plan subscriptions
CREATE TABLE public.plan_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  plan_type TEXT NOT NULL,
  billing_cycle TEXT NOT NULL DEFAULT 'monthly',
  amount NUMERIC NOT NULL,
  pagarme_order_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  pix_payload TEXT,
  pix_qrcode_url TEXT,
  pix_expiration TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- profile_views: seller profile visit tracking
CREATE TABLE public.profile_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_user_id UUID NOT NULL,
  viewer_id UUID NOT NULL,
  viewed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- coupons: seller discount coupons (loja plan only)
CREATE TABLE public.coupons (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  code TEXT NOT NULL,
  discount_type public.coupon_discount_type NOT NULL,
  discount_value NUMERIC NOT NULL,
  applies_to public.coupon_applies_to NOT NULL DEFAULT 'all',
  listing_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  max_uses INTEGER,
  expires_at TIMESTAMP WITH TIME ZONE,
  use_count INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, code)
);

-- ============================================================
-- ENABLE ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.verification_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pf_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pj_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.followers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_boosts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_boosts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.boost_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plan_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profile_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- INDEXES
-- ============================================================

CREATE INDEX idx_verification_codes_email ON public.verification_codes(email);
CREATE INDEX idx_verification_codes_code ON public.verification_codes(code);
CREATE INDEX idx_verification_codes_expires_at ON public.verification_codes(expires_at);

CREATE INDEX idx_user_locations_user_id ON public.user_locations(user_id);
CREATE INDEX idx_user_locations_coords ON public.user_locations(latitude, longitude);

CREATE INDEX idx_products_seller_id ON public.products(seller_id);
CREATE INDEX idx_products_status ON public.products(status);
CREATE INDEX idx_products_category ON public.products(category);
CREATE INDEX idx_products_created_at ON public.products(created_at DESC);
CREATE INDEX idx_products_price ON public.products(price);
CREATE INDEX idx_products_coords ON public.products(seller_latitude, seller_longitude);

CREATE INDEX idx_favorites_user_id ON public.favorites(user_id);
CREATE INDEX idx_favorites_product_id ON public.favorites(product_id);

CREATE INDEX idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX idx_notifications_user_read ON public.notifications(user_id, read_at);
CREATE INDEX idx_notifications_created ON public.notifications(created_at DESC);

CREATE INDEX idx_offers_conversation ON public.offers(conversation_id);
CREATE INDEX idx_offers_product ON public.offers(product_id);
CREATE INDEX idx_offers_status ON public.offers(status) WHERE status = 'pending';

CREATE INDEX idx_user_roles_user_id ON public.user_roles(user_id);
CREATE INDEX idx_user_roles_role ON public.user_roles(role);

CREATE INDEX idx_admin_logs_created_at ON public.admin_logs(created_at DESC);
CREATE INDEX idx_admin_logs_action ON public.admin_logs(action);
CREATE INDEX idx_admin_logs_target ON public.admin_logs(target_type, target_id);

CREATE INDEX idx_product_views_product_id ON public.product_views(product_id);
CREATE INDEX idx_product_views_viewer_product ON public.product_views(viewer_id, product_id, viewed_at DESC);

CREATE INDEX idx_product_queue_product_status ON public.product_queue(product_id, status);
CREATE INDEX idx_product_queue_user ON public.product_queue(user_id, status);

CREATE INDEX idx_profile_views_profile_user_id ON public.profile_views(profile_user_id);
CREATE INDEX idx_profile_views_viewed_at ON public.profile_views(viewed_at);
CREATE INDEX idx_profile_views_dedup ON public.profile_views(profile_user_id, viewer_id, viewed_at);

-- ============================================================
-- FUNCTIONS
-- ============================================================

-- update_updated_at_column: generic trigger helper
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- handle_new_user: auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name, email_verified)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name', false);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- calculate_distance: Haversine formula (returns km)
CREATE OR REPLACE FUNCTION public.calculate_distance(
  lat1 NUMERIC,
  lon1 NUMERIC,
  lat2 NUMERIC,
  lon2 NUMERIC
)
RETURNS NUMERIC
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  earth_radius NUMERIC := 6371;
  dlat NUMERIC;
  dlon NUMERIC;
  a NUMERIC;
  c NUMERIC;
BEGIN
  IF lat1 IS NULL OR lon1 IS NULL OR lat2 IS NULL OR lon2 IS NULL THEN
    RETURN NULL;
  END IF;
  dlat := radians(lat2 - lat1);
  dlon := radians(lon2 - lon1);
  a := sin(dlat / 2) * sin(dlat / 2) +
       cos(radians(lat1)) * cos(radians(lat2)) *
       sin(dlon / 2) * sin(dlon / 2);
  c := 2 * atan2(sqrt(a), sqrt(1 - a));
  RETURN round(earth_radius * c, 1);
END;
$$;

-- calculate_weighted_rating: Bayesian weighted rating
CREATE OR REPLACE FUNCTION public.calculate_weighted_rating(
  reviews_sum NUMERIC,
  reviews_count INTEGER
)
RETURNS NUMERIC
LANGUAGE plpgsql
IMMUTABLE
SET search_path TO 'public'
AS $$
DECLARE
  initial_rating NUMERIC := 5.0;
  initial_weight INTEGER := 10;
BEGIN
  RETURN ROUND(
    (initial_rating * initial_weight + COALESCE(reviews_sum, 0))
    / (initial_weight + COALESCE(reviews_count, 0)),
    2
  );
END;
$$;

-- has_role: check if user has a given role (prevents RLS recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- get_user_roles: get all roles for a user
CREATE OR REPLACE FUNCTION public.get_user_roles(_user_id UUID)
RETURNS public.app_role[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT ARRAY_AGG(role)
  FROM public.user_roles
  WHERE user_id = _user_id
$$;

-- has_loja_plan: check if user has active loja plan
CREATE OR REPLACE FUNCTION public.has_loja_plan(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_subscriptions
    WHERE user_id = _user_id
      AND plan_type = 'loja'
      AND (expires_at IS NULL OR expires_at > now())
  )
$$;

-- get_seller_info: RPC to retrieve seller display info
CREATE OR REPLACE FUNCTION public.get_seller_info(seller_user_id UUID)
RETURNS TABLE (
  id UUID,
  display_name TEXT,
  avatar_url TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.user_id AS id,
    p.display_name,
    p.avatar_url
  FROM public.profiles p
  WHERE p.user_id = seller_user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_seller_info TO authenticated, anon;

-- get_products_with_distance: main marketplace product listing RPC
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
    WHERE us.user_id = p.seller_id AND us.expires_at > now()
    ORDER BY us.expires_at DESC
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

-- get_product_with_distance: single product detail RPC
CREATE OR REPLACE FUNCTION public.get_product_with_distance(
  product_id UUID,
  user_lat DOUBLE PRECISION DEFAULT NULL,
  user_lng DOUBLE PRECISION DEFAULT NULL
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
  gender TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
    p.gender
  FROM public.products p
  LEFT JOIN public.profiles pr ON p.seller_id = pr.user_id
  WHERE p.id = product_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_product_with_distance TO authenticated, anon;

-- reserve_product_for_checkout: reserve products (supports queue promoted users)
CREATE OR REPLACE FUNCTION public.reserve_product_for_checkout(product_ids UUID[], buyer_id UUID)
RETURNS TABLE(product_id UUID, success BOOLEAN, error_message TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  pid UUID;
  product_record RECORD;
  is_promoted BOOLEAN;
BEGIN
  FOREACH pid IN ARRAY product_ids
  LOOP
    SELECT id, status, seller_id INTO product_record
    FROM products WHERE id = pid;

    IF NOT FOUND THEN
      product_id := pid;
      success := false;
      error_message := 'Produto não encontrado';
      RETURN NEXT;
      CONTINUE;
    END IF;

    IF product_record.seller_id = buyer_id THEN
      product_id := pid;
      success := false;
      error_message := 'Não é possível comprar seu próprio produto';
      RETURN NEXT;
      CONTINUE;
    END IF;

    SELECT EXISTS(
      SELECT 1 FROM product_queue pq
      WHERE pq.product_id = pid AND pq.user_id = buyer_id
      AND pq.status = 'promoted' AND pq.promotion_expires_at > now()
    ) INTO is_promoted;

    IF product_record.status = 'active' THEN
      UPDATE products SET
        status = 'reserved',
        reserved_at = now(),
        updated_at = now()
      WHERE id = pid AND status = 'active';

      product_id := pid;
      success := true;
      error_message := null;
      RETURN NEXT;
    ELSIF product_record.status = 'reserved' AND is_promoted THEN
      UPDATE product_queue SET status = 'cancelled'
      WHERE product_queue.product_id = pid AND user_id = buyer_id AND status = 'promoted';

      UPDATE products SET reserved_at = now(), updated_at = now() WHERE id = pid;

      product_id := pid;
      success := true;
      error_message := null;
      RETURN NEXT;
    ELSE
      product_id := pid;
      success := false;
      error_message := 'Produto já reservado ou vendido';
      RETURN NEXT;
    END IF;
  END LOOP;
END;
$$;

-- release_product_reservations: release reserved products back to active
CREATE OR REPLACE FUNCTION public.release_product_reservations(product_ids UUID[])
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  pid UUID;
BEGIN
  FOREACH pid IN ARRAY product_ids
  LOOP
    UPDATE products
    SET status = 'active',
        reserved_at = NULL,
        updated_at = now()
    WHERE id = pid AND status = 'reserved';
  END LOOP;
END;
$$;

-- cleanup_expired_reservations: release stale reservations and handle queue promotions
CREATE OR REPLACE FUNCTION public.cleanup_expired_reservations()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  released_count INTEGER := 0;
  expired_promo RECORD;
BEGIN
  FOR expired_promo IN
    SELECT DISTINCT product_id FROM product_queue
    WHERE status = 'promoted' AND promotion_expires_at < now()
  LOOP
    UPDATE product_queue SET status = 'expired'
    WHERE product_id = expired_promo.product_id
    AND status = 'promoted' AND promotion_expires_at < now();
    PERFORM public.promote_next_in_queue(expired_promo.product_id);
  END LOOP;

  WITH released AS (
    UPDATE products
    SET status = 'active', reserved_at = NULL, updated_at = now()
    WHERE status = 'reserved'
      AND reserved_at IS NOT NULL
      AND reserved_at < now() - interval '24 hours'
      AND NOT EXISTS (
        SELECT 1 FROM product_queue pq
        WHERE pq.product_id = products.id AND pq.status IN ('waiting', 'promoted')
      )
      AND NOT EXISTS (
        SELECT 1 FROM orders o
        WHERE o.product_id = products.id AND o.status IN ('pending', 'confirmed', 'in_transit')
      )
    RETURNING id
  )
  SELECT count(*) INTO released_count FROM released;

  IF released_count > 0 THEN
    RAISE LOG 'cleanup_expired_reservations: Released % stale reservations', released_count;
  END IF;

  RETURN released_count;
END;
$$;

-- join_product_queue: join waitlist for a reserved product
CREATE OR REPLACE FUNCTION public.join_product_queue(p_product_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_product RECORD;
  v_existing_position INTEGER;
  v_next_position INTEGER;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Não autenticado');
  END IF;

  SELECT id, seller_id, status INTO v_product FROM products WHERE id = p_product_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Produto não encontrado');
  END IF;

  IF v_product.seller_id = v_user_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Não pode entrar na fila do próprio produto');
  END IF;

  IF v_product.status != 'reserved' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Produto não está em negociação');
  END IF;

  IF EXISTS (
    SELECT 1 FROM orders
    WHERE product_id = p_product_id AND buyer_id = v_user_id
    AND status IN ('pending', 'confirmed', 'in_transit')
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Você é o comprador ativo');
  END IF;

  SELECT position INTO v_existing_position
  FROM product_queue
  WHERE product_id = p_product_id AND user_id = v_user_id AND status = 'waiting';

  IF FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Já está na fila', 'position', v_existing_position);
  END IF;

  SELECT COALESCE(MAX(position), 0) + 1 INTO v_next_position
  FROM product_queue
  WHERE product_id = p_product_id AND status = 'waiting';

  INSERT INTO product_queue (product_id, user_id, position)
  VALUES (p_product_id, v_user_id, v_next_position);

  RETURN jsonb_build_object('success', true, 'position', v_next_position);
END;
$$;

-- leave_product_queue: leave waitlist
CREATE OR REPLACE FUNCTION public.leave_product_queue(p_product_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id UUID := auth.uid();
  v_deleted BOOLEAN;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Não autenticado');
  END IF;

  DELETE FROM product_queue
  WHERE product_id = p_product_id AND user_id = v_user_id AND status = 'waiting';

  v_deleted := FOUND;

  IF NOT v_deleted THEN
    RETURN jsonb_build_object('success', false, 'error', 'Você não está na fila');
  END IF;

  RETURN jsonb_build_object('success', true);
END;
$function$;

-- get_queue_info: get queue state for a product
CREATE OR REPLACE FUNCTION public.get_queue_info(p_product_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_count INTEGER;
  v_position INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM product_queue
  WHERE product_id = p_product_id AND status = 'waiting';

  IF v_user_id IS NOT NULL THEN
    SELECT position INTO v_position
    FROM product_queue
    WHERE product_id = p_product_id AND user_id = v_user_id AND status = 'waiting';
  END IF;

  RETURN jsonb_build_object(
    'queue_count', v_count,
    'user_position', v_position,
    'user_in_queue', v_position IS NOT NULL
  );
END;
$$;

-- promote_next_in_queue: promote next user in queue or release product
CREATE OR REPLACE FUNCTION public.promote_next_in_queue(p_product_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_next RECORD;
  v_product_title TEXT;
BEGIN
  SELECT id, user_id INTO v_next
  FROM product_queue
  WHERE product_id = p_product_id AND status = 'waiting'
  ORDER BY position ASC
  LIMIT 1
  FOR UPDATE SKIP LOCKED;

  IF NOT FOUND THEN
    UPDATE products SET status = 'active', reserved_at = NULL, updated_at = now()
    WHERE id = p_product_id AND status = 'reserved';
    RETURN jsonb_build_object('success', true, 'action', 'released');
  END IF;

  SELECT title INTO v_product_title FROM products WHERE id = p_product_id;

  UPDATE product_queue
  SET status = 'promoted', promoted_at = now(), promotion_expires_at = now() + interval '30 minutes'
  WHERE id = v_next.id;

  UPDATE products SET reserved_at = now(), updated_at = now() WHERE id = p_product_id;

  INSERT INTO notifications (user_id, type, title, body, data)
  VALUES (
    v_next.user_id,
    'queue_promotion',
    'Sua vez chegou! 🎉',
    'O item "' || COALESCE(v_product_title, 'produto') || '" está disponível para você. Você tem 30 minutos para finalizar a compra.',
    jsonb_build_object('product_id', p_product_id)
  );

  RETURN jsonb_build_object('success', true, 'action', 'promoted', 'user_id', v_next.user_id);
END;
$$;

-- record_product_view: record deduplicated product view (30-min window)
CREATE OR REPLACE FUNCTION public.record_product_view(p_product_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_viewer_id UUID;
  v_seller_id UUID;
  v_recent_view BOOLEAN;
BEGIN
  v_viewer_id := auth.uid();

  IF v_viewer_id IS NULL THEN
    RETURN false;
  END IF;

  SELECT seller_id INTO v_seller_id FROM products WHERE id = p_product_id;
  IF v_seller_id IS NULL OR v_seller_id = v_viewer_id THEN
    RETURN false;
  END IF;

  SELECT EXISTS(
    SELECT 1 FROM product_views
    WHERE product_id = p_product_id
      AND viewer_id = v_viewer_id
      AND viewed_at > now() - interval '30 minutes'
  ) INTO v_recent_view;

  IF v_recent_view THEN
    RETURN false;
  END IF;

  INSERT INTO product_views (product_id, viewer_id)
  VALUES (p_product_id, v_viewer_id);

  UPDATE products SET view_count = view_count + 1 WHERE id = p_product_id;

  RETURN true;
END;
$$;

-- record_profile_view: record deduplicated profile view (30-min window)
CREATE OR REPLACE FUNCTION public.record_profile_view(p_profile_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_viewer_id UUID := auth.uid();
  v_recent_exists BOOLEAN;
BEGIN
  IF v_viewer_id IS NULL OR v_viewer_id = p_profile_user_id THEN
    RETURN false;
  END IF;

  SELECT EXISTS(
    SELECT 1 FROM public.profile_views
    WHERE profile_user_id = p_profile_user_id
      AND viewer_id = v_viewer_id
      AND viewed_at > now() - interval '30 minutes'
  ) INTO v_recent_exists;

  IF v_recent_exists THEN
    RETURN false;
  END IF;

  INSERT INTO public.profile_views (profile_user_id, viewer_id)
  VALUES (p_profile_user_id, v_viewer_id);

  RETURN true;
END;
$$;

-- activate_product_boost: activate a boost using per-type credits
CREATE OR REPLACE FUNCTION public.activate_product_boost(p_product_id UUID, p_boost_type TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  product_record RECORD;
  boost_record RECORD;
  boost_duration INTERVAL;
  expires TIMESTAMP WITH TIME ZONE;
  v_total INT;
  v_used INT;
BEGIN
  IF p_boost_type NOT IN ('24h', '3d', '7d') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Tipo de boost inválido');
  END IF;

  SELECT id, seller_id, status INTO product_record
  FROM products WHERE id = p_product_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Produto não encontrado');
  END IF;

  IF product_record.seller_id != auth.uid() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Você não é o dono deste produto');
  END IF;

  IF product_record.status != 'active' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Produto precisa estar ativo para ser impulsionado');
  END IF;

  IF EXISTS (SELECT 1 FROM product_boosts WHERE product_id = p_product_id AND expires_at > now()) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Este produto já possui um boost ativo');
  END IF;

  SELECT * INTO boost_record FROM user_boosts WHERE user_id = auth.uid();

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Você não possui créditos de boost disponíveis');
  END IF;

  CASE p_boost_type
    WHEN '24h' THEN
      v_total := boost_record.total_boosts_24h;
      v_used := boost_record.used_boosts_24h;
      boost_duration := interval '24 hours';
    WHEN '3d' THEN
      v_total := boost_record.total_boosts_3d;
      v_used := boost_record.used_boosts_3d;
      boost_duration := interval '3 days';
    WHEN '7d' THEN
      v_total := boost_record.total_boosts_7d;
      v_used := boost_record.used_boosts_7d;
      boost_duration := interval '7 days';
  END CASE;

  IF v_used >= v_total THEN
    RETURN jsonb_build_object('success', false, 'error', 'Você não possui créditos de boost ' || p_boost_type || ' disponíveis');
  END IF;

  expires := now() + boost_duration;

  INSERT INTO product_boosts (product_id, user_id, boost_type, expires_at)
  VALUES (p_product_id, auth.uid(), p_boost_type, expires);

  CASE p_boost_type
    WHEN '24h' THEN
      UPDATE user_boosts SET used_boosts_24h = used_boosts_24h + 1, updated_at = now() WHERE id = boost_record.id;
    WHEN '3d' THEN
      UPDATE user_boosts SET used_boosts_3d = used_boosts_3d + 1, updated_at = now() WHERE id = boost_record.id;
    WHEN '7d' THEN
      UPDATE user_boosts SET used_boosts_7d = used_boosts_7d + 1, updated_at = now() WHERE id = boost_record.id;
  END CASE;

  RETURN jsonb_build_object(
    'success', true,
    'expires_at', expires,
    'remaining_boosts_24h', CASE WHEN p_boost_type = '24h' THEN v_total - v_used - 1 ELSE boost_record.total_boosts_24h - boost_record.used_boosts_24h END,
    'remaining_boosts_3d', CASE WHEN p_boost_type = '3d' THEN v_total - v_used - 1 ELSE boost_record.total_boosts_3d - boost_record.used_boosts_3d END,
    'remaining_boosts_7d', CASE WHEN p_boost_type = '7d' THEN v_total - v_used - 1 ELSE boost_record.total_boosts_7d - boost_record.used_boosts_7d END
  );
END;
$function$;

-- admin_get_dashboard_stats: admin dashboard statistics
CREATE OR REPLACE FUNCTION public.admin_get_dashboard_stats()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result JSONB;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT jsonb_build_object(
    'total_users', (SELECT count(*) FROM profiles),
    'active_users_30d', (SELECT count(*) FROM profiles WHERE updated_at > now() - interval '30 days'),
    'free_users', (SELECT count(*) FROM profiles p WHERE NOT EXISTS (
      SELECT 1 FROM user_subscriptions us WHERE us.user_id = p.user_id AND us.plan_type != 'free' AND (us.expires_at IS NULL OR us.expires_at > now())
    )),
    'pro_users', (SELECT count(*) FROM user_subscriptions WHERE plan_type != 'free' AND (expires_at IS NULL OR expires_at > now())),
    'moderation_queue', (SELECT count(*) FROM products WHERE status = 'pending_review'),
    'new_users_7d', (SELECT count(*) FROM profiles WHERE created_at > now() - interval '7 days'),
    'total_products', (SELECT count(*) FROM products WHERE status = 'active'),
    'total_orders', (SELECT count(*) FROM orders)
  ) INTO result;

  RETURN result;
END;
$$;

-- admin_list_users: paginated user list with search
CREATE OR REPLACE FUNCTION public.admin_list_users(
  p_search TEXT DEFAULT NULL,
  p_plan_filter TEXT DEFAULT NULL,
  p_limit INTEGER DEFAULT 20,
  p_offset INTEGER DEFAULT 0
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
  WHERE (p_search IS NULL OR p.display_name ILIKE '%' || p_search || '%' OR p.full_name ILIKE '%' || p_search || '%')
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
    WHERE (p_search IS NULL OR p.display_name ILIKE '%' || p_search || '%' OR p.full_name ILIKE '%' || p_search || '%')
      AND (p_plan_filter IS NULL OR COALESCE(us.plan_type, 'free') = p_plan_filter)
    ORDER BY p.created_at DESC
    LIMIT p_limit OFFSET p_offset
  ) u;

  RETURN result;
END;
$$;

-- admin_get_user_details: detailed user info for admin
CREATE OR REPLACE FUNCTION public.admin_get_user_details(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result JSONB;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT jsonb_build_object(
    'profile', row_to_json(p.*),
    'subscription', (SELECT row_to_json(us.*) FROM user_subscriptions us WHERE us.user_id = p.user_id),
    'roles', (SELECT array_agg(ur.role) FROM user_roles ur WHERE ur.user_id = p.user_id),
    'boosts', (SELECT row_to_json(ub.*) FROM user_boosts ub WHERE ub.user_id = p.user_id),
    'products_count', (SELECT count(*) FROM products pr WHERE pr.seller_id = p.user_id),
    'orders_as_buyer', (SELECT count(*) FROM orders o WHERE o.buyer_id = p.user_id),
    'orders_as_seller', (SELECT count(*) FROM orders o WHERE o.seller_id = p.user_id)
  ) INTO result
  FROM profiles p
  WHERE p.user_id = p_user_id;

  RETURN result;
END;
$$;

-- admin_update_subscription: admin upsert user subscription plan
CREATE OR REPLACE FUNCTION public.admin_update_subscription(
  p_target_user_id UUID,
  p_plan_type TEXT,
  p_expires_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  p_note TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  admin_id UUID := auth.uid();
BEGIN
  IF NOT public.has_role(admin_id, 'admin') THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  INSERT INTO user_subscriptions (user_id, plan_type, expires_at)
  VALUES (p_target_user_id, p_plan_type, p_expires_at)
  ON CONFLICT (user_id) DO UPDATE SET
    plan_type = p_plan_type,
    expires_at = p_expires_at,
    updated_at = now();

  INSERT INTO admin_logs (admin_user_id, action, target_type, target_id, metadata)
  VALUES (admin_id, 'update_subscription', 'user', p_target_user_id::text,
    jsonb_build_object('plan_type', p_plan_type, 'expires_at', p_expires_at, 'note', p_note));

  RETURN jsonb_build_object('success', true);
END;
$$;

-- admin_update_boosts: admin update user boost credits (per type)
CREATE OR REPLACE FUNCTION public.admin_update_boosts(
  p_target_user_id UUID,
  p_total_boosts INTEGER,
  p_note TEXT DEFAULT NULL,
  p_boost_type TEXT DEFAULT '24h'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  admin_id UUID := auth.uid();
BEGIN
  IF NOT public.has_role(admin_id, 'admin') THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  INSERT INTO user_boosts (user_id, total_boosts_24h)
  VALUES (p_target_user_id, 0)
  ON CONFLICT (user_id) DO NOTHING;

  CASE p_boost_type
    WHEN '24h' THEN
      UPDATE user_boosts SET total_boosts_24h = p_total_boosts, updated_at = now() WHERE user_id = p_target_user_id;
    WHEN '3d' THEN
      UPDATE user_boosts SET total_boosts_3d = p_total_boosts, updated_at = now() WHERE user_id = p_target_user_id;
    WHEN '7d' THEN
      UPDATE user_boosts SET total_boosts_7d = p_total_boosts, updated_at = now() WHERE user_id = p_target_user_id;
    ELSE
      RETURN jsonb_build_object('success', false, 'error', 'Tipo inválido');
  END CASE;

  INSERT INTO admin_logs (admin_user_id, action, target_type, target_id, metadata)
  VALUES (admin_id, 'update_boosts', 'user', p_target_user_id::text,
    jsonb_build_object('total_boosts', p_total_boosts, 'boost_type', p_boost_type, 'note', p_note));

  RETURN jsonb_build_object('success', true);
END;
$function$;

-- admin_manage_role: add/remove admin roles
CREATE OR REPLACE FUNCTION public.admin_manage_role(
  p_target_user_id UUID,
  p_role public.app_role,
  p_action TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  admin_id UUID := auth.uid();
BEGIN
  IF NOT public.has_role(admin_id, 'admin') THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF p_action = 'remove' AND p_role = 'admin' AND p_target_user_id = admin_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Não é possível remover seu próprio papel de admin');
  END IF;

  IF p_action = 'add' THEN
    INSERT INTO user_roles (user_id, role) VALUES (p_target_user_id, p_role)
    ON CONFLICT (user_id, role) DO NOTHING;
  ELSIF p_action = 'remove' THEN
    DELETE FROM user_roles WHERE user_id = p_target_user_id AND role = p_role;
  ELSE
    RETURN jsonb_build_object('success', false, 'error', 'Ação inválida');
  END IF;

  INSERT INTO admin_logs (admin_user_id, action, target_type, target_id, metadata)
  VALUES (admin_id, p_action || '_role', 'user', p_target_user_id::text,
    jsonb_build_object('role', p_role));

  RETURN jsonb_build_object('success', true);
END;
$$;

-- admin_get_logs: retrieve admin audit logs
CREATE OR REPLACE FUNCTION public.admin_get_logs(
  p_action_filter TEXT DEFAULT NULL,
  p_limit INTEGER DEFAULT 50,
  p_offset INTEGER DEFAULT 0
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
  FROM admin_logs
  WHERE (p_action_filter IS NULL OR action = p_action_filter);

  SELECT jsonb_build_object(
    'logs', COALESCE(jsonb_agg(row_to_json(l.*) ORDER BY l.created_at DESC), '[]'::jsonb),
    'total', total_count
  ) INTO result
  FROM (
    SELECT
      al.*,
      p.display_name AS admin_name
    FROM admin_logs al
    LEFT JOIN profiles p ON p.user_id = al.admin_user_id
    WHERE (p_action_filter IS NULL OR al.action = p_action_filter)
    ORDER BY al.created_at DESC
    LIMIT p_limit OFFSET p_offset
  ) l;

  RETURN result;
END;
$$;

-- admin_suspend_user: suspend or unsuspend a user
CREATE OR REPLACE FUNCTION public.admin_suspend_user(
  p_target_user_id UUID,
  p_suspend BOOLEAN,
  p_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  admin_id UUID := auth.uid();
BEGIN
  IF NOT public.has_role(admin_id, 'admin') THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF p_target_user_id = admin_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Não é possível suspender a si mesmo');
  END IF;

  IF public.has_role(p_target_user_id, 'admin') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Não é possível suspender outro administrador');
  END IF;

  IF p_suspend THEN
    UPDATE profiles SET
      suspended_at = now(),
      suspended_by = admin_id,
      suspension_reason = p_reason,
      updated_at = now()
    WHERE user_id = p_target_user_id;
  ELSE
    UPDATE profiles SET
      suspended_at = NULL,
      suspended_by = NULL,
      suspension_reason = NULL,
      updated_at = now()
    WHERE user_id = p_target_user_id;
  END IF;

  INSERT INTO admin_logs (admin_user_id, action, target_type, target_id, metadata)
  VALUES (admin_id, CASE WHEN p_suspend THEN 'suspend_user' ELSE 'unsuspend_user' END,
    'user', p_target_user_id::text,
    jsonb_build_object('reason', p_reason));

  RETURN jsonb_build_object('success', true);
END;
$$;

-- admin_get_analytics: time-series analytics for admin dashboard
CREATE OR REPLACE FUNCTION public.admin_get_analytics(p_days INTEGER DEFAULT 30)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  result JSONB;
  start_date DATE;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  start_date := current_date - p_days;

  SELECT jsonb_build_object(
    'daily_signups', (
      SELECT COALESCE(jsonb_agg(row_to_json(d.*) ORDER BY d.day), '[]'::jsonb)
      FROM (
        SELECT
          gs.day::date AS day,
          COALESCE(cnt.total, 0) AS count
        FROM generate_series(start_date, current_date, '1 day'::interval) gs(day)
        LEFT JOIN (
          SELECT created_at::date AS day, count(*)::int AS total
          FROM profiles
          WHERE created_at::date >= start_date
          GROUP BY created_at::date
        ) cnt ON cnt.day = gs.day::date
      ) d
    ),
    'daily_orders', (
      SELECT COALESCE(jsonb_agg(row_to_json(d.*) ORDER BY d.day), '[]'::jsonb)
      FROM (
        SELECT
          gs.day::date AS day,
          COALESCE(cnt.total, 0) AS count,
          COALESCE(cnt.revenue, 0) AS revenue
        FROM generate_series(start_date, current_date, '1 day'::interval) gs(day)
        LEFT JOIN (
          SELECT created_at::date AS day, count(*)::int AS total, sum(total_price)::numeric AS revenue
          FROM orders
          WHERE created_at::date >= start_date
          GROUP BY created_at::date
        ) cnt ON cnt.day = gs.day::date
      ) d
    ),
    'daily_products', (
      SELECT COALESCE(jsonb_agg(row_to_json(d.*) ORDER BY d.day), '[]'::jsonb)
      FROM (
        SELECT
          gs.day::date AS day,
          COALESCE(cnt.total, 0) AS count
        FROM generate_series(start_date, current_date, '1 day'::interval) gs(day)
        LEFT JOIN (
          SELECT created_at::date AS day, count(*)::int AS total
          FROM products
          WHERE created_at::date >= start_date AND status = 'active'
          GROUP BY created_at::date
        ) cnt ON cnt.day = gs.day::date
      ) d
    ),
    'plans_distribution', jsonb_build_object(
      'free', (SELECT count(*) FROM user_subscriptions WHERE plan_type = 'free'),
      'pro', (SELECT count(*) FROM user_subscriptions WHERE plan_type = 'pro' AND (expires_at IS NULL OR expires_at > now()))
    ),
    'top_categories', (
      SELECT COALESCE(jsonb_agg(row_to_json(c.*) ORDER BY c.total DESC), '[]'::jsonb)
      FROM (
        SELECT category::text AS name, count(*)::int AS total
        FROM products
        WHERE status = 'active'
        GROUP BY category
        ORDER BY total DESC
        LIMIT 8
      ) c
    )
  ) INTO result;

  RETURN result;
END;
$function$;

-- trigger_push_notification: calls edge function to send push notification
CREATE OR REPLACE FUNCTION public.trigger_push_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  supabase_url TEXT;
  request_id BIGINT;
BEGIN
  IF NEW.type NOT IN ('message', 'offer', 'order_update', 'favorite_sold', 'queue_promotion') THEN
    RETURN NEW;
  END IF;

  supabase_url := 'https://zgtnulbupxjvpjwladcf.supabase.co';

  SELECT net.http_post(
    url := supabase_url || '/functions/v1/send-push-notification',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpndG51bGJ1cHhqdnBqd2xhZGNmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgzNDEzMjEsImV4cCI6MjA4MzkxNzMyMX0.XDYwe4RPQ26w1kVjXSF46dVnRENGEDgZ6NkGuPWe3Cc'
    ),
    body := jsonb_build_object(
      'user_id', NEW.user_id,
      'notification', jsonb_build_object(
        'title', NEW.title,
        'body', NEW.body,
        'type', NEW.type,
        'data', COALESCE(NEW.data, '{}'::jsonb)
      )
    )
  ) INTO request_id;

  RETURN NEW;
END;
$$;

-- update_conversation_last_message: update conversation timestamp on new message
CREATE OR REPLACE FUNCTION public.update_conversation_last_message()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.conversations
  SET last_message_at = NEW.created_at
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- notify_new_message: create notification for new chat message
CREATE OR REPLACE FUNCTION public.notify_new_message()
RETURNS TRIGGER AS $$
DECLARE
  recipient_id UUID;
  sender_name TEXT;
  product_title TEXT;
BEGIN
  SELECT
    CASE WHEN c.participant_1 = NEW.sender_id THEN c.participant_2 ELSE c.participant_1 END,
    (SELECT p.display_name FROM public.profiles p WHERE p.user_id = NEW.sender_id),
    (SELECT pr.title FROM public.products pr WHERE pr.id = c.product_id)
  INTO recipient_id, sender_name, product_title
  FROM public.conversations c
  WHERE c.id = NEW.conversation_id;

  INSERT INTO public.notifications (user_id, type, title, body, data)
  VALUES (
    recipient_id,
    'message',
    COALESCE(sender_name, 'Alguém') || ' enviou uma mensagem',
    LEFT(NEW.content, 100),
    jsonb_build_object('conversation_id', NEW.conversation_id, 'message_id', NEW.id, 'product_title', product_title)
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- notify_order_update: create notification on order status change
CREATE OR REPLACE FUNCTION public.notify_order_update()
RETURNS TRIGGER AS $$
DECLARE
  status_text TEXT;
  notify_user_id UUID;
BEGIN
  IF OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;

  CASE NEW.status
    WHEN 'confirmed' THEN
      status_text := 'Pedido confirmado pelo vendedor';
      notify_user_id := NEW.buyer_id;
    WHEN 'in_transit' THEN
      status_text := 'Pedido está a caminho';
      notify_user_id := NEW.buyer_id;
    WHEN 'delivered' THEN
      status_text := 'Pedido foi entregue';
      notify_user_id := NEW.buyer_id;
    WHEN 'cancelled' THEN
      status_text := 'Pedido foi cancelado';
      INSERT INTO public.notifications (user_id, type, title, body, data)
      VALUES (
        NEW.buyer_id, 'order_update', status_text,
        'Verifique os detalhes do pedido.',
        jsonb_build_object('order_id', NEW.id, 'status', NEW.status)
      );
      INSERT INTO public.notifications (user_id, type, title, body, data)
      VALUES (
        NEW.seller_id, 'order_update', status_text,
        'Verifique os detalhes do pedido.',
        jsonb_build_object('order_id', NEW.id, 'status', NEW.status)
      );
      RETURN NEW;
    WHEN 'pending' THEN
      status_text := 'Novo pedido recebido!';
      notify_user_id := NEW.seller_id;
    ELSE
      RETURN NEW;
  END CASE;

  INSERT INTO public.notifications (user_id, type, title, body, data)
  VALUES (
    notify_user_id, 'order_update', status_text,
    'Toque para ver detalhes.',
    jsonb_build_object('order_id', NEW.id, 'status', NEW.status)
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- notify_favorite_sold: notify users when a favorited item is sold/reserved
CREATE OR REPLACE FUNCTION public.notify_favorite_sold()
RETURNS TRIGGER AS $$
DECLARE
  fav RECORD;
BEGIN
  IF NEW.status NOT IN ('sold', 'reserved') THEN
    RETURN NEW;
  END IF;

  IF OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;

  FOR fav IN
    SELECT f.user_id
    FROM public.favorites f
    WHERE f.product_id = NEW.id
      AND f.user_id != NEW.seller_id
  LOOP
    INSERT INTO public.notifications (user_id, type, title, body, data)
    VALUES (
      fav.user_id,
      'favorite_sold',
      CASE NEW.status
        WHEN 'sold' THEN 'Item favorito foi vendido 😢'
        ELSE 'Item favorito foi reservado'
      END,
      NEW.title,
      jsonb_build_object('product_id', NEW.id, 'product_title', NEW.title)
    );
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- notify_new_offer: notify on new offer
CREATE OR REPLACE FUNCTION public.notify_new_offer()
RETURNS TRIGGER AS $$
DECLARE
  recipient_id UUID;
  product_title TEXT;
  sender_name TEXT;
BEGIN
  SELECT CASE
    WHEN c.participant_1 = NEW.sender_id THEN c.participant_2
    ELSE c.participant_1
  END INTO recipient_id
  FROM public.conversations c
  WHERE c.id = NEW.conversation_id;

  SELECT title INTO product_title FROM public.products WHERE id = NEW.product_id;

  SELECT COALESCE(display_name, 'Usuário') INTO sender_name
  FROM public.profiles WHERE user_id = NEW.sender_id;

  INSERT INTO public.notifications (user_id, type, title, body, data)
  VALUES (
    recipient_id,
    'offer',
    CASE
      WHEN NEW.parent_offer_id IS NULL THEN 'Nova oferta recebida'
      ELSE 'Contra-oferta recebida'
    END,
    sender_name || ' fez uma oferta de R$ ' || NEW.amount || ' em ' || product_title,
    jsonb_build_object('conversation_id', NEW.conversation_id, 'offer_id', NEW.id, 'product_id', NEW.product_id)
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- notify_offer_response: notify when offer is accepted or rejected
CREATE OR REPLACE FUNCTION public.notify_offer_response()
RETURNS TRIGGER AS $$
DECLARE
  product_title TEXT;
  responder_name TEXT;
BEGIN
  IF OLD.status = 'pending' AND NEW.status IN ('accepted', 'rejected') THEN
    SELECT title INTO product_title FROM public.products WHERE id = NEW.product_id;

    SELECT COALESCE(p.display_name, 'Usuário') INTO responder_name
    FROM public.conversations c
    JOIN public.profiles p ON p.user_id = CASE
      WHEN c.participant_1 = NEW.sender_id THEN c.participant_2
      ELSE c.participant_1
    END
    WHERE c.id = NEW.conversation_id;

    INSERT INTO public.notifications (user_id, type, title, body, data)
    VALUES (
      NEW.sender_id,
      'offer',
      CASE NEW.status
        WHEN 'accepted' THEN 'Oferta aceita! 🎉'
        ELSE 'Oferta recusada'
      END,
      responder_name || CASE NEW.status
        WHEN 'accepted' THEN ' aceitou sua oferta de R$ ' || NEW.amount
        ELSE ' recusou sua oferta de R$ ' || NEW.amount
      END || ' em ' || product_title,
      jsonb_build_object('conversation_id', NEW.conversation_id, 'offer_id', NEW.id, 'product_id', NEW.product_id, 'status', NEW.status)
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- update_follower_count: maintain cached follower count on profiles
CREATE OR REPLACE FUNCTION public.update_follower_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE profiles SET followers_count = followers_count + 1 WHERE user_id = NEW.following_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE profiles SET followers_count = GREATEST(0, followers_count - 1) WHERE user_id = OLD.following_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

-- update_profile_ratings: update cached rating counters on new review
CREATE OR REPLACE FUNCTION public.update_profile_ratings()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.review_type = 'buyer_to_seller' THEN
    UPDATE public.profiles
    SET
      seller_reviews_count = seller_reviews_count + 1,
      seller_reviews_sum = seller_reviews_sum + NEW.rating
    WHERE user_id = NEW.reviewed_id;
  ELSIF NEW.review_type = 'seller_to_buyer' THEN
    UPDATE public.profiles
    SET
      buyer_reviews_count = buyer_reviews_count + 1,
      buyer_reviews_sum = buyer_reviews_sum + NEW.rating
    WHERE user_id = NEW.reviewed_id;
  END IF;

  RETURN NEW;
END;
$$;

-- handle_order_cancellation_queue: promote next in queue when order is cancelled
CREATE OR REPLACE FUNCTION public.handle_order_cancellation_queue()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  IF OLD.status != 'cancelled' AND NEW.status = 'cancelled' THEN
    PERFORM public.promote_next_in_queue(NEW.product_id);
  END IF;
  RETURN NEW;
END;
$$;

-- handle_product_sold_clear_queue: cancel queue entries when product is sold
CREATE OR REPLACE FUNCTION public.handle_product_sold_clear_queue()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  IF NEW.status = 'sold' AND OLD.status != 'sold' THEN
    UPDATE product_queue SET status = 'cancelled'
    WHERE product_id = NEW.id AND status IN ('waiting', 'promoted');
  END IF;
  RETURN NEW;
END;
$$;

-- ============================================================
-- TRIGGERS
-- ============================================================

CREATE TRIGGER update_profiles_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_user();

CREATE TRIGGER update_pf_profiles_updated_at
BEFORE UPDATE ON public.pf_profiles
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_pj_profiles_updated_at
BEFORE UPDATE ON public.pj_profiles
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_addresses_updated_at
BEFORE UPDATE ON public.addresses
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_payment_profiles_updated_at
BEFORE UPDATE ON public.payment_profiles
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_products_updated_at
BEFORE UPDATE ON public.products
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_orders_updated_at
BEFORE UPDATE ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER on_message_created
AFTER INSERT ON public.messages
FOR EACH ROW
EXECUTE FUNCTION public.update_conversation_last_message();

CREATE TRIGGER on_new_message_notify
AFTER INSERT ON public.messages
FOR EACH ROW
EXECUTE FUNCTION public.notify_new_message();

CREATE TRIGGER on_order_status_change_notify
AFTER INSERT OR UPDATE ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.notify_order_update();

CREATE TRIGGER on_product_sold_notify_favorites
AFTER UPDATE ON public.products
FOR EACH ROW
EXECUTE FUNCTION public.notify_favorite_sold();

CREATE TRIGGER on_new_offer
AFTER INSERT ON public.offers
FOR EACH ROW
EXECUTE FUNCTION public.notify_new_offer();

CREATE TRIGGER on_offer_response
AFTER UPDATE ON public.offers
FOR EACH ROW
EXECUTE FUNCTION public.notify_offer_response();

CREATE TRIGGER on_follower_change
AFTER INSERT OR DELETE ON public.followers
FOR EACH ROW
EXECUTE FUNCTION public.update_follower_count();

CREATE TRIGGER on_review_created
AFTER INSERT ON public.reviews
FOR EACH ROW
EXECUTE FUNCTION public.update_profile_ratings();

CREATE TRIGGER on_notification_created_send_push
AFTER INSERT ON public.notifications
FOR EACH ROW
EXECUTE FUNCTION public.trigger_push_notification();

CREATE TRIGGER on_order_cancelled_promote_queue
AFTER UPDATE ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.handle_order_cancellation_queue();

CREATE TRIGGER on_product_sold_clear_queue
AFTER UPDATE ON public.products
FOR EACH ROW
EXECUTE FUNCTION public.handle_product_sold_clear_queue();

CREATE TRIGGER update_push_subscriptions_updated_at
BEFORE UPDATE ON public.push_subscriptions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_boost_payments_updated_at
BEFORE UPDATE ON public.boost_payments
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_plan_payments_updated_at
BEFORE UPDATE ON public.plan_payments
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- VIEWS
-- ============================================================

-- public_profiles: safe public view of seller profiles
CREATE OR REPLACE VIEW public.public_profiles
WITH (security_invoker = on) AS
SELECT
  user_id,
  display_name,
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

-- public_products: safe public product listing (no coordinates)
CREATE OR REPLACE VIEW public.public_products
WITH (security_invoker = true) AS
SELECT
  p.id, p.title, p.description, p.price, p.original_price,
  p.size, p.brand, p.category, p.condition, p.status,
  p.images, p.seller_id, p.seller_city, p.seller_state, p.created_at
FROM public.products p
INNER JOIN public.profiles pr ON pr.user_id = p.seller_id
WHERE p.status = 'active' AND pr.suspended_at IS NULL;

GRANT SELECT ON public.public_products TO authenticated, anon;

-- public_reviews: safe public review display (no raw IDs)
CREATE OR REPLACE VIEW public.public_reviews
WITH (security_invoker = on) AS
SELECT
  r.id,
  r.rating,
  r.comment,
  r.review_type,
  r.created_at,
  r.reviewed_id,
  p.display_name AS reviewer_display_name,
  p.avatar_url AS reviewer_avatar_url
FROM public.reviews r
LEFT JOIN public.profiles p ON p.user_id = r.reviewer_id;

-- ============================================================
-- RLS POLICIES
-- ============================================================

-- profiles
CREATE POLICY "Authenticated users can view own profile"
ON public.profiles FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Authenticated users can update own profile"
ON public.profiles FOR UPDATE TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Authenticated users can insert own profile"
ON public.profiles FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own profile"
ON public.profiles FOR DELETE TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Deny anonymous access to profiles"
ON public.profiles FOR ALL TO anon
USING (false) WITH CHECK (false);

CREATE POLICY "Order participants can view counterpart profiles"
ON public.profiles FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.orders
    WHERE (orders.buyer_id = auth.uid() AND orders.seller_id = profiles.user_id)
       OR (orders.seller_id = auth.uid() AND orders.buyer_id = profiles.user_id)
  )
);

CREATE POLICY "Admins can view all profiles"
ON public.profiles FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- verification_codes (backend-only, no direct user access)
CREATE POLICY "No direct access - backend only"
ON public.verification_codes FOR ALL TO authenticated, anon
USING (false) WITH CHECK (false);

-- pf_profiles
CREATE POLICY "Authenticated users can view own PF profile"
ON public.pf_profiles FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Authenticated users can update own PF profile"
ON public.pf_profiles FOR UPDATE TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Authenticated users can insert own PF profile"
ON public.pf_profiles FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own PF profile"
ON public.pf_profiles FOR DELETE TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Deny anonymous access to pf_profiles"
ON public.pf_profiles FOR ALL TO anon
USING (false) WITH CHECK (false);

-- pj_profiles
CREATE POLICY "Authenticated users can view own PJ profile"
ON public.pj_profiles FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Authenticated users can update own PJ profile"
ON public.pj_profiles FOR UPDATE TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Authenticated users can insert own PJ profile"
ON public.pj_profiles FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own PJ profile"
ON public.pj_profiles FOR DELETE TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Deny anonymous access to pj_profiles"
ON public.pj_profiles FOR ALL TO anon
USING (false) WITH CHECK (false);

-- addresses
CREATE POLICY "Authenticated users can view own addresses"
ON public.addresses FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Authenticated users can update own addresses"
ON public.addresses FOR UPDATE TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Authenticated users can insert own addresses"
ON public.addresses FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Authenticated users can delete own addresses"
ON public.addresses FOR DELETE TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Deny anonymous access to addresses"
ON public.addresses FOR ALL TO anon
USING (false) WITH CHECK (false);

-- payment_profiles
CREATE POLICY "Authenticated users can view own payment profile"
ON public.payment_profiles FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Authenticated users can update own payment profile"
ON public.payment_profiles FOR UPDATE TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Authenticated users can insert own payment profile"
ON public.payment_profiles FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own payment profile"
ON public.payment_profiles FOR DELETE TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Deny anonymous access to payment_profiles"
ON public.payment_profiles FOR ALL TO anon
USING (false) WITH CHECK (false);

-- user_locations
CREATE POLICY "Authenticated users can view own location"
ON public.user_locations FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Authenticated users can update own location"
ON public.user_locations FOR UPDATE TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Authenticated users can insert own location"
ON public.user_locations FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own location"
ON public.user_locations FOR DELETE TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Deny anonymous access to user_locations"
ON public.user_locations FOR ALL TO anon
USING (false) WITH CHECK (false);

-- products
CREATE POLICY "Public can view active products"
ON public.products FOR SELECT
USING (
  status = 'active'
  AND NOT EXISTS (
    SELECT 1 FROM public.profiles pr
    WHERE pr.user_id = products.seller_id
    AND pr.suspended_at IS NOT NULL
  )
);

CREATE POLICY "Public can view reserved products"
ON public.products FOR SELECT
USING (
  status = 'reserved'
  AND NOT EXISTS (
    SELECT 1 FROM profiles pr
    WHERE pr.user_id = products.seller_id AND pr.suspended_at IS NOT NULL
  )
);

CREATE POLICY "Sellers can view own products"
ON public.products FOR SELECT TO authenticated
USING (auth.uid() = seller_id);

CREATE POLICY "Sellers can update own products"
ON public.products FOR UPDATE TO authenticated
USING (auth.uid() = seller_id);

CREATE POLICY "Sellers can insert own products"
ON public.products FOR INSERT TO authenticated
WITH CHECK (auth.uid() = seller_id);

CREATE POLICY "Sellers can delete own products"
ON public.products FOR DELETE TO authenticated
USING (auth.uid() = seller_id);

CREATE POLICY "Admins can view pending_review products"
ON public.products FOR SELECT TO authenticated
USING (
  status = 'pending_review' AND
  (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'moderator'))
);

CREATE POLICY "Moderators can update products for moderation"
ON public.products FOR UPDATE TO authenticated
USING (
  public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'moderator')
);

-- favorites
CREATE POLICY "Users can view own favorites"
ON public.favorites FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can only view own favorites"
ON public.favorites FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own favorites"
ON public.favorites FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own favorites"
ON public.favorites FOR DELETE
USING (auth.uid() = user_id);

CREATE POLICY "Deny anonymous access to favorites"
ON public.favorites FOR ALL TO anon
USING (false) WITH CHECK (false);

-- followers
CREATE POLICY "Anyone can view followers"
ON public.followers FOR SELECT
USING (true);

CREATE POLICY "Users can follow others"
ON public.followers FOR INSERT
WITH CHECK (auth.uid() = follower_id);

CREATE POLICY "Users can unfollow"
ON public.followers FOR DELETE
USING (auth.uid() = follower_id);

-- orders
CREATE POLICY "Buyers can view their orders"
ON public.orders FOR SELECT
USING (auth.uid() = buyer_id);

CREATE POLICY "Sellers can view their orders"
ON public.orders FOR SELECT
USING (auth.uid() = seller_id);

CREATE POLICY "Users can create orders"
ON public.orders FOR INSERT
WITH CHECK (auth.uid() = buyer_id);

CREATE POLICY "Sellers can update orders"
ON public.orders FOR UPDATE
USING (auth.uid() = seller_id);

-- order_items
CREATE POLICY "Users can view their order items"
ON public.order_items FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.orders
    WHERE orders.id = order_items.order_id
    AND (orders.buyer_id = auth.uid() OR orders.seller_id = auth.uid())
  )
);

CREATE POLICY "Users can create order items"
ON public.order_items FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.orders
    WHERE orders.id = order_items.order_id
    AND orders.buyer_id = auth.uid()
  )
);

-- reviews
CREATE POLICY "Reviews viewable by order participants or for public display"
ON public.reviews FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM orders
    WHERE orders.id = reviews.order_id
    AND (orders.buyer_id = auth.uid() OR orders.seller_id = auth.uid())
  )
  OR true
);

CREATE POLICY "Anon can view reviews via secure view"
ON public.reviews FOR SELECT TO anon
USING (true);

CREATE POLICY "Users can create reviews"
ON public.reviews FOR INSERT
WITH CHECK (
  auth.uid() = reviewer_id
  AND EXISTS (
    SELECT 1 FROM public.orders
    WHERE orders.id = order_id
    AND (orders.buyer_id = auth.uid() OR orders.seller_id = auth.uid())
    AND orders.status = 'delivered'
  )
);

-- conversations
CREATE POLICY "Users can view their conversations"
ON public.conversations FOR SELECT
USING (auth.uid() = participant_1 OR auth.uid() = participant_2);

CREATE POLICY "Users can create conversations"
ON public.conversations FOR INSERT
WITH CHECK (auth.uid() = participant_1 OR auth.uid() = participant_2);

CREATE POLICY "Users can update their conversations"
ON public.conversations FOR UPDATE
USING (auth.uid() = participant_1 OR auth.uid() = participant_2);

-- messages
CREATE POLICY "Users can view conversation messages"
ON public.messages FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.conversations
    WHERE conversations.id = messages.conversation_id
    AND (conversations.participant_1 = auth.uid() OR conversations.participant_2 = auth.uid())
  )
);

CREATE POLICY "Users can send messages"
ON public.messages FOR INSERT
WITH CHECK (
  auth.uid() = sender_id
  AND EXISTS (
    SELECT 1 FROM public.conversations
    WHERE conversations.id = messages.conversation_id
    AND (conversations.participant_1 = auth.uid() OR conversations.participant_2 = auth.uid())
  )
);

CREATE POLICY "Users can update messages"
ON public.messages FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.conversations
    WHERE conversations.id = messages.conversation_id
    AND (conversations.participant_1 = auth.uid() OR conversations.participant_2 = auth.uid())
  )
);

-- notifications
CREATE POLICY "Users can view their own notifications"
ON public.notifications FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own notifications"
ON public.notifications FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own notifications"
ON public.notifications FOR DELETE
USING (auth.uid() = user_id);

CREATE POLICY "Authenticated users can insert own notifications"
ON public.notifications FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Deny anonymous insert notifications"
ON public.notifications FOR INSERT TO anon
WITH CHECK (false);

-- offers
CREATE POLICY "Users can view offers in their conversations"
ON public.offers FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.conversations c
    WHERE c.id = conversation_id
    AND (c.participant_1 = auth.uid() OR c.participant_2 = auth.uid())
  )
);

CREATE POLICY "Users can create offers in their conversations"
ON public.offers FOR INSERT
WITH CHECK (
  auth.uid() = sender_id AND
  EXISTS (
    SELECT 1 FROM public.conversations c
    WHERE c.id = conversation_id
    AND (c.participant_1 = auth.uid() OR c.participant_2 = auth.uid())
  )
);

CREATE POLICY "Users can respond to offers"
ON public.offers FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.conversations c
    WHERE c.id = conversation_id
    AND (c.participant_1 = auth.uid() OR c.participant_2 = auth.uid())
  ) AND sender_id != auth.uid()
);

-- push_subscriptions
CREATE POLICY "Users can view their own subscriptions"
ON public.push_subscriptions FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own subscriptions"
ON public.push_subscriptions FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own subscriptions"
ON public.push_subscriptions FOR DELETE
USING (auth.uid() = user_id);

-- user_roles
CREATE POLICY "Admins can view all roles"
ON public.user_roles FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can view own roles"
ON public.user_roles FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Admins can insert roles"
ON public.user_roles FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete roles"
ON public.user_roles FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- user_subscriptions
CREATE POLICY "Users can view own subscriptions"
ON public.user_subscriptions FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all subscriptions"
ON public.user_subscriptions FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- user_boosts
CREATE POLICY "Users can view own boosts"
ON public.user_boosts FOR SELECT TO authenticated
USING (auth.uid() = user_id);

-- product_boosts
CREATE POLICY "Users can view own product boosts"
ON public.product_boosts FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own product boosts"
ON public.product_boosts FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- admin_logs
CREATE POLICY "Admins can view all logs"
ON public.admin_logs FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert logs"
ON public.admin_logs FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- product_views
CREATE POLICY "Users can insert own views"
ON public.product_views FOR INSERT TO authenticated
WITH CHECK (auth.uid() = viewer_id);

CREATE POLICY "Users can view own views"
ON public.product_views FOR SELECT TO authenticated
USING (auth.uid() = viewer_id);

CREATE POLICY "Deny anonymous access to product_views"
ON public.product_views FOR ALL TO anon
USING (false) WITH CHECK (false);

-- product_queue
CREATE POLICY "Users can view own queue entries"
ON public.product_queue FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Sellers can view queue for own products"
ON public.product_queue FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM products p WHERE p.id = product_id AND p.seller_id = auth.uid()));

CREATE POLICY "Deny anon access to product_queue"
ON public.product_queue FOR ALL TO anon
USING (false) WITH CHECK (false);

-- boost_payments
CREATE POLICY "Users can view own boost_payments"
ON public.boost_payments FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own boost_payments"
ON public.boost_payments FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Deny anonymous access to boost_payments"
ON public.boost_payments FOR ALL TO anon
USING (false) WITH CHECK (false);

-- plan_payments
CREATE POLICY "Deny anonymous access to plan_payments"
ON public.plan_payments FOR ALL TO anon
USING (false) WITH CHECK (false);

CREATE POLICY "Users can view own plan_payments"
ON public.plan_payments FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own plan_payments"
ON public.plan_payments FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all plan_payments"
ON public.plan_payments FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- profile_views
CREATE POLICY "Deny anonymous access to profile_views"
ON public.profile_views FOR ALL TO anon
USING (false) WITH CHECK (false);

CREATE POLICY "Authenticated users can insert profile views"
ON public.profile_views FOR INSERT TO authenticated
WITH CHECK (auth.uid() = viewer_id);

CREATE POLICY "Sellers can view their own profile views"
ON public.profile_views FOR SELECT TO authenticated
USING (auth.uid() = profile_user_id);

-- coupons
CREATE POLICY "Users can view own coupons"
ON public.coupons FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own coupons"
ON public.coupons FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND public.has_loja_plan(auth.uid())
);

CREATE POLICY "Users can update own coupons"
ON public.coupons FOR UPDATE TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own coupons"
ON public.coupons FOR DELETE TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Deny anonymous access to coupons"
ON public.coupons FOR ALL TO anon
USING (false) WITH CHECK (false);

CREATE POLICY "Anyone can view active coupons"
ON public.coupons FOR SELECT TO public
USING (is_active = true);

-- ============================================================
-- STORAGE BUCKETS
-- ============================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'product-images',
  'product-images',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
) ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public read access for product images"
ON storage.objects FOR SELECT
USING (bucket_id = 'product-images');

CREATE POLICY "Authenticated users can upload product images"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'product-images'
  AND auth.role() = 'authenticated'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can update their own product images"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'product-images'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can delete their own product images"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'product-images'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Avatar images are publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'avatars');

CREATE POLICY "Users can upload their own avatar"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'avatars'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can update their own avatar"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'avatars'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can delete their own avatar"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'avatars'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- ============================================================
-- REALTIME PUBLICATIONS
-- ============================================================

ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE public.offers;
ALTER PUBLICATION supabase_realtime ADD TABLE public.products;

-- ============================================================
-- TABLE COMMENTS
-- ============================================================

COMMENT ON TABLE public.products IS 'Marketplace product listings with seller location for proximity-based features';
COMMENT ON TABLE public.user_locations IS 'Stores user geolocation for proximity-based marketplace features. Coordinates rounded for privacy (LGPD).';
COMMENT ON FUNCTION public.calculate_distance IS 'Calculates distance between two coordinates using Haversine formula (returns km)';
