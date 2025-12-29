-- ============================================
-- SECURITY FIXES: Secure Expense Approval
-- ============================================
-- This migration adds a secure RPC function for expense approvals
-- that prevents self-approval and ensures proper authorization

-- Drop old function if it exists (may have different signature)
DROP FUNCTION IF EXISTS public.approve_expense_request(UUID);
DROP FUNCTION IF EXISTS public.approve_expense_request(UUID, UUID);

-- Create secure expense approval function
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
  
  -- Atomic update (prevents duplicate approvals)
  UPDATE public.expense_requests
  SET status = 'approved',
      updated_at = NOW()
  WHERE id = p_request_id
    AND status = 'pending'; -- Double-check status hasn't changed
  
  RETURN TRUE;
END;
$$;

-- Drop old rejection function if it exists
DROP FUNCTION IF EXISTS public.reject_expense_request(UUID);
DROP FUNCTION IF EXISTS public.reject_expense_request(UUID, UUID);

-- Create secure expense rejection function
CREATE OR REPLACE FUNCTION public.reject_expense_request(
  p_request_id UUID,
  p_rejector_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_request RECORD;
  v_is_parent BOOLEAN;
BEGIN
  -- Lock row and fetch request
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
  
  -- Prevent self-rejection (though less critical)
  IF v_request.requester_id = p_rejector_id THEN
    RAISE EXCEPTION 'Cannot reject own expense request';
  END IF;
  
  -- Verify rejector is parent of the child
  IF v_request.child_id IS NULL THEN
    RAISE EXCEPTION 'Expense request must be associated with a child';
  END IF;
  
  SELECT EXISTS (
    SELECT 1 FROM public.children c
    WHERE c.id = v_request.child_id
    AND (c.parent_id = p_rejector_id OR c.co_parent_id = p_rejector_id)
  ) INTO v_is_parent;
  
  IF NOT v_is_parent THEN
    RAISE EXCEPTION 'Only parents can reject expenses for their children';
  END IF;
  
  -- Atomic update
  UPDATE public.expense_requests
  SET status = 'rejected',
      updated_at = NOW()
  WHERE id = p_request_id
    AND status = 'pending';
  
  RETURN TRUE;
END;
$$;

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION public.approve_expense_request(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_expense_request(UUID, UUID) TO authenticated;

COMMENT ON FUNCTION public.approve_expense_request IS 'Secure expense approval function that prevents self-approval and ensures proper authorization';
COMMENT ON FUNCTION public.reject_expense_request IS 'Secure expense rejection function that prevents self-rejection and ensures proper authorization';

