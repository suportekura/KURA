-- Fix handle_new_user trigger to set email_verified=true for OAuth users.
-- When a user signs in via Google OAuth, Supabase sets email_confirmed_at automatically.
-- The previous trigger always set email_verified=false, causing useAuth to immediately
-- sign out Google OAuth users.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name, email_verified)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'full_name',
    -- OAuth providers (Google, etc.) have email_confirmed_at set at creation time
    CASE WHEN NEW.email_confirmed_at IS NOT NULL THEN true ELSE false END
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
