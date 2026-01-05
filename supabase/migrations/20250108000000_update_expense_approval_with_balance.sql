-- ============================================
-- UPDATE: Expense Approval with Balance Deduction
-- ============================================
-- This migration updates the approve_expense_request function
-- to automatically deduct from the balance category when approved

-- Drop and recreate the function with balance deduction
DROP FUNCTION IF EXISTS public.approve_expense_request(UUID, UUID);

CREATE OR REPLACE FUNCTION public.approve_expense_request(
  p_request_id UUID,
  p_approver_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_request RECORD;
  v_is_parent BOOLEAN;
  v_balance_card RECORD;
  v_new_balance DECIMAL(10, 2);
BEGIN
  -- Lock row and fetch request (prevents race conditions)
  SELECT * INTO v_request
  FROM public.expense_requests
  WHERE id = p_request_id
  FOR UPDATE;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Expense request not found';
  END IF;
  
  -- Verify status is pending
  IF v_request.status != 'pending' THEN
    RAISE EXCEPTION 'Request already processed';
  END IF;
  
  -- CRITICAL: Prevent self-approval
  IF v_request.requester_id = p_approver_id THEN
    RAISE EXCEPTION 'Cannot approve own expense request';
  END IF;
  
  -- Verify approver is parent of the child
  IF v_request.child_id IS NULL THEN
    RAISE EXCEPTION 'Expense request must be associated with a child';
  END IF;
  
  SELECT EXISTS (
    SELECT 1 FROM public.children c
    WHERE c.id = v_request.child_id
    AND (c.parent_id = p_approver_id OR c.co_parent_id = p_approver_id)
  ) INTO v_is_parent;
  
  IF NOT v_is_parent THEN
    RAISE EXCEPTION 'Only parents can approve expenses for their children';
  END IF;
  
  -- Find the balance category (virtual_card) matching the expense category and child
  SELECT * INTO v_balance_card
  FROM public.virtual_cards
  WHERE child_id = v_request.child_id
    AND card_type = v_request.category
  LIMIT 1
  FOR UPDATE;
  
  -- If balance category exists, deduct the expense amount
  IF FOUND THEN
    v_new_balance := (v_balance_card.balance - v_request.amount);
    
    -- Check if balance would go negative (optional - you can allow negative or prevent it)
    -- For now, we'll allow negative balances but log it
    
    -- Update balance atomically
    UPDATE public.virtual_cards
    SET balance = v_new_balance,
        updated_at = NOW()
    WHERE id = v_balance_card.id;
    
    -- Update budget category current_spent if it exists
    UPDATE public.budget_categories
    SET current_spent = COALESCE(current_spent, 0) + v_request.amount
    WHERE user_id = v_balance_card.user_id
      AND child_id = v_request.child_id
      AND category = v_request.category;
  ELSE
    -- No balance category found - still approve but don't deduct
    -- This allows expenses to be approved even if no balance category exists yet
  END IF;
  
  -- Atomic update (prevents duplicate approvals)
  UPDATE public.expense_requests
  SET status = 'approved',
      updated_at = NOW()
  WHERE id = p_request_id
    AND status = 'pending'; -- Double-check status hasn't changed
  
  RETURN TRUE;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.approve_expense_request(UUID, UUID) TO authenticated;

COMMENT ON FUNCTION public.approve_expense_request IS 'Secure expense approval function that deducts from balance category and updates budget tracking';





