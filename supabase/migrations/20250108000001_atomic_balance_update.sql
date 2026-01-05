-- ============================================
-- ATOMIC BALANCE UPDATE FUNCTION
-- ============================================
-- This function provides atomic balance updates to prevent race conditions

CREATE OR REPLACE FUNCTION public.update_balance(
  p_card_id UUID,
  p_amount DECIMAL(10, 2)
)
RETURNS DECIMAL(10, 2)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_new_balance DECIMAL(10, 2);
BEGIN
  -- Atomic update: add amount to current balance
  UPDATE public.virtual_cards
  SET balance = balance + p_amount,
      updated_at = NOW()
  WHERE id = p_card_id
  RETURNING balance INTO v_new_balance;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Balance category not found';
  END IF;
  
  RETURN v_new_balance;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.update_balance(UUID, DECIMAL) TO authenticated;

COMMENT ON FUNCTION public.update_balance IS 'Atomically updates balance by adding amount, prevents race conditions';





