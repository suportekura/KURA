-- increment_coupon_use_count: atomically increment coupon use_count
-- Returns TRUE if incremented, FALSE if max_uses already reached
CREATE OR REPLACE FUNCTION public.increment_coupon_use_count(p_coupon_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_updated INTEGER;
BEGIN
  UPDATE coupons
  SET use_count = use_count + 1,
      updated_at = now()
  WHERE id = p_coupon_id
    AND is_active = true
    AND (max_uses IS NULL OR use_count < max_uses);

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated > 0;
END;
$$;

-- Explicitly revoke public access (SECURITY DEFINER bypasses RLS, so restrict to authenticated only)
REVOKE EXECUTE ON FUNCTION public.increment_coupon_use_count FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.increment_coupon_use_count TO authenticated;
