-- admin_coupons: admin-created discount coupons for boost/plan purchases
CREATE TABLE public.admin_coupons (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT NOT NULL,
  discount_type TEXT NOT NULL CHECK (discount_type IN ('percentage', 'fixed')),
  discount_value NUMERIC NOT NULL CHECK (discount_value > 0),
  applies_to TEXT NOT NULL CHECK (applies_to IN (
    'boost_24h', 'boost_3d', 'boost_7d', 'all_boosts',
    'plan_plus', 'plan_loja', 'all_plans', 'all'
  )),
  max_uses INTEGER CHECK (max_uses IS NULL OR max_uses > 0),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT admin_coupons_code_unique UNIQUE (code),
  CONSTRAINT admin_coupons_percentage_max CHECK (
    discount_type != 'percentage' OR discount_value <= 100
  )
);

-- admin_coupon_uses: records each use (enforces one-use-per-user)
CREATE TABLE public.admin_coupon_uses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  coupon_id UUID NOT NULL REFERENCES public.admin_coupons(id),
  user_id UUID NOT NULL,
  payment_type TEXT NOT NULL CHECK (payment_type IN ('boost', 'plan')),
  payment_id UUID NOT NULL,
  discount_amount NUMERIC NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT admin_coupon_uses_one_per_user UNIQUE (coupon_id, user_id)
);

-- Enable RLS
ALTER TABLE public.admin_coupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_coupon_uses ENABLE ROW LEVEL SECURITY;

-- admin_coupons: only admins/moderators can read/write
CREATE POLICY "Admins can manage coupons"
ON public.admin_coupons FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'moderator')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'moderator')
  )
);

-- admin_coupon_uses: authenticated users can insert their own; admins read all
CREATE POLICY "Users can insert own coupon uses"
ON public.admin_coupon_uses FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can read coupon uses"
ON public.admin_coupon_uses FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'moderator')
  )
);
