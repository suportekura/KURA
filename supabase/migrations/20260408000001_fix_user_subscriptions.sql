-- ============================================================
-- Fix user_subscriptions: seed missing rows, update trigger,
-- and add RLS UPDATE policy for client-side downgrade
-- ============================================================

-- 1. Seed user_subscriptions for all existing users without a row
INSERT INTO public.user_subscriptions (user_id, plan_type)
SELECT p.user_id, 'free'
FROM public.profiles p
WHERE NOT EXISTS (
  SELECT 1 FROM public.user_subscriptions us WHERE us.user_id = p.user_id
);

-- 2. Update handle_new_user to also create user_subscriptions row on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name, email_verified)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name', false);

  INSERT INTO public.user_subscriptions (user_id, plan_type)
  VALUES (NEW.id, 'free')
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 3. Add RLS UPDATE policy so users can manage their own subscription
--    (downgrades to 'free' from the client; upgrades go through Edge Functions)
CREATE POLICY "Users can update own subscription"
ON public.user_subscriptions FOR UPDATE TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);
