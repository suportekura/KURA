-- Update get_queue_info to also return user_is_promoted and promotion_expires_at.
-- Previously the RPC only checked status='waiting', so promoted users were
-- indistinguishable from users not in queue (both returned user_in_queue=false).
CREATE OR REPLACE FUNCTION public.get_queue_info(p_product_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_queue_count          integer;
  v_user_position        integer;
  v_user_in_queue        boolean := false;
  v_user_is_promoted     boolean := false;
  v_promotion_expires_at timestamptz;
  v_user_entry           record;
BEGIN
  -- Count users still waiting (not promoted)
  SELECT COUNT(*) INTO v_queue_count
  FROM product_queue
  WHERE product_id = p_product_id AND status = 'waiting';

  -- Look up the authenticated user's own entry (waiting OR promoted)
  IF auth.uid() IS NOT NULL THEN
    SELECT position, status, promotion_expires_at
    INTO v_user_entry
    FROM product_queue
    WHERE product_id = p_product_id
      AND user_id = auth.uid()
      AND status IN ('waiting', 'promoted')
    LIMIT 1;

    IF FOUND THEN
      IF v_user_entry.status = 'waiting' THEN
        v_user_in_queue := true;
        v_user_position := v_user_entry.position;
      ELSIF v_user_entry.status = 'promoted' THEN
        v_user_is_promoted     := true;
        v_promotion_expires_at := v_user_entry.promotion_expires_at;
      END IF;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'queue_count',          v_queue_count,
    'user_position',        v_user_position,
    'user_in_queue',        v_user_in_queue,
    'user_is_promoted',     v_user_is_promoted,
    'promotion_expires_at', v_promotion_expires_at
  );
END;
$$;
