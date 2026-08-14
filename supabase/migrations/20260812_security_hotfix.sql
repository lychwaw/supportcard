-- ============================================================
-- Security Hotfix — 2026-08-12
-- Fixes 5 confirmed vulnerabilities from internal audit:
--
--   1. (CRITICAL) approve/reject_expense_request: caller-controlled
--      p_approver_id/p_rejector_id parameter allowed self-approval and
--      audit trail impersonation. Replaced with auth.uid() internally.
--
--   2. (HIGH) child_safe_expenses view ran in security-definer context
--      (view owner = postgres superuser), bypassing RLS on the underlying
--      expense_requests table. Any authenticated user could read all families'
--      approved expenses. Fixed with security_invoker = on.
--
--   3. (HIGH) children table UPDATE policy allowed a co-parent to overwrite
--      parent_id with their own uid, stealing the primary parent role.
--      Fixed by trigger that makes parent_id immutable and restricts
--      co_parent_id reassignment to the primary parent only.
--
--   4. (MEDIUM) is_founder column added to profiles so the founder price
--      eligibility can be enforced server-side in dodo-checkout API.
--
-- ============================================================

-- ── FIX 1: approve_expense_request — derive approver from auth.uid() ─────────

-- Drop old 2-parameter signatures
DROP FUNCTION IF EXISTS public.approve_expense_request(UUID, UUID);

CREATE OR REPLACE FUNCTION public.approve_expense_request(p_request_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_approver_id  UUID := auth.uid();
  v_request      public.expense_requests%ROWTYPE;
  v_balance_card public.virtual_cards%ROWTYPE;
  v_new_balance  DECIMAL(10, 2);
BEGIN
  IF v_approver_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_request
  FROM public.expense_requests
  WHERE id = p_request_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Expense request not found';
  END IF;

  IF v_request.status != 'pending' THEN
    RAISE EXCEPTION 'Expense request is not pending';
  END IF;

  IF v_request.requester_id = v_approver_id THEN
    RAISE EXCEPTION 'Cannot approve your own expense request';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.children
    WHERE id = v_request.child_id
      AND (parent_id = v_approver_id OR co_parent_id = v_approver_id)
  ) THEN
    RAISE EXCEPTION 'Only the parent or co-parent of this child can approve their expenses';
  END IF;

  SELECT * INTO v_balance_card
  FROM public.virtual_cards
  WHERE child_id = v_request.child_id
  ORDER BY
    CASE WHEN card_type = v_request.category THEN 0 ELSE 1 END,
    created_at ASC
  LIMIT 1
  FOR UPDATE;

  IF FOUND THEN
    v_new_balance := v_balance_card.balance - v_request.amount;
    IF v_new_balance < 0 THEN
      RAISE EXCEPTION 'Insufficient balance: card has % but expense requires %',
        v_balance_card.balance, v_request.amount;
    END IF;

    UPDATE public.virtual_cards
    SET balance = v_new_balance, updated_at = NOW()
    WHERE id = v_balance_card.id;

    UPDATE public.budget_categories
    SET current_spent = current_spent + v_request.amount
    WHERE child_id = v_request.child_id
      AND category = v_request.category;
  END IF;

  UPDATE public.expense_requests
  SET
    status         = 'approved',
    approved_by_id = v_approver_id,
    approved_at    = NOW(),
    updated_at     = NOW()
  WHERE id = p_request_id;
END;
$$;

-- ── FIX 1b: reject_expense_request — same treatment ───────────────────────────

DROP FUNCTION IF EXISTS public.reject_expense_request(UUID, UUID);
DROP FUNCTION IF EXISTS public.reject_expense_request(UUID, UUID, TEXT);

CREATE OR REPLACE FUNCTION public.reject_expense_request(
  p_request_id UUID,
  p_reason     TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rejector_id UUID := auth.uid();
  v_request     public.expense_requests%ROWTYPE;
BEGIN
  IF v_rejector_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_request
  FROM public.expense_requests
  WHERE id = p_request_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Expense request not found';
  END IF;

  IF v_request.status != 'pending' THEN
    RAISE EXCEPTION 'Expense request is not pending';
  END IF;

  IF v_request.requester_id = v_rejector_id THEN
    RAISE EXCEPTION 'Cannot reject your own expense request';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.children
    WHERE id = v_request.child_id
      AND (parent_id = v_rejector_id OR co_parent_id = v_rejector_id)
  ) THEN
    RAISE EXCEPTION 'Only the parent or co-parent of this child can reject their expenses';
  END IF;

  UPDATE public.expense_requests
  SET
    status           = 'rejected',
    approved_by_id   = v_rejector_id,
    approved_at      = NOW(),
    rejection_reason = p_reason,
    updated_at       = NOW()
  WHERE id = p_request_id;
END;
$$;

-- Grant new single-argument signatures (old 2-param grants become no-ops once dropped)
GRANT EXECUTE ON FUNCTION public.approve_expense_request(UUID)      TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_expense_request(UUID, TEXT) TO authenticated;

-- ── FIX 2: child_safe_expenses view — enforce RLS on base table ───────────────
-- PostgreSQL 15 views default to security_invoker = off (run as view owner =
-- postgres superuser), which bypasses RLS. Setting security_invoker = on forces
-- the view to run in the calling user's security context, so RLS applies normally.

ALTER VIEW public.child_safe_expenses SET (security_invoker = on);

-- ── FIX 3: Prevent parent_id / co_parent_id hijacking via UPDATE ──────────────

CREATE OR REPLACE FUNCTION public.prevent_child_ownership_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- parent_id is immutable after creation
  IF NEW.parent_id IS DISTINCT FROM OLD.parent_id THEN
    RAISE EXCEPTION 'parent_id cannot be changed after creation';
  END IF;

  -- Only the primary parent can reassign co_parent_id
  IF NEW.co_parent_id IS DISTINCT FROM OLD.co_parent_id
     AND auth.uid() IS DISTINCT FROM OLD.parent_id THEN
    RAISE EXCEPTION 'Only the primary parent can change co_parent_id';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prevent_child_ownership_change_trigger ON public.children;
CREATE TRIGGER prevent_child_ownership_change_trigger
  BEFORE UPDATE ON public.children
  FOR EACH ROW EXECUTE FUNCTION public.prevent_child_ownership_change();

-- ── FIX 4: is_founder column for server-side founder price eligibility ─────────
-- The dodo-checkout API checks this column instead of trusting useFounderPrice
-- from the client request body.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_founder BOOLEAN NOT NULL DEFAULT FALSE;
