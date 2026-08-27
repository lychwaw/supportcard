-- ============================================================
-- Family Mechanics Fix — 2026-08-16
--
-- Three root-cause bugs that broke every co-parent feature:
--
--   1. children SELECT policy only allowed parent_id = auth.uid().
--      Co-parents could not read the children table at all, which
--      is the access-gate for every screen (expenses, calendar,
--      messages, goals, contacts…). Fixed to include co_parent_id.
--
--   2. profiles "view family members" policy was dropped in a
--      recursion-fix migration and never replaced with a version
--      using co_parent_id. Family.tsx load() returned null for the
--      co-parent's profile → showed "No co-parent linked" even after
--      a successful link. Fixed with a non-recursive policy.
--
--   3. approve/reject_expense_request failed when child_id IS NULL
--      (all existing requests were submitted without one). Fixed to
--      fall back to checking the family relationship between approver
--      and requester when child_id is absent.
-- ============================================================


-- ── FIX 1: children SELECT — include co_parent_id ────────────────────────────
-- The migration 20250106000000_fix_infinite_recursion.sql simplified this to
-- only allow parent_id = auth.uid(), which locked co-parents out of everything.

DROP POLICY IF EXISTS "Users can view own children" ON public.children;
CREATE POLICY "Users can view own children" ON public.children
  FOR SELECT USING (
    (SELECT auth.uid()) = parent_id
    OR (SELECT auth.uid()) = co_parent_id
  );


-- ── FIX 2: profiles — co-parents can read each other's profile ───────────────
-- "Users can view family members" was dropped for recursion reasons.
-- This replacement queries the children table (no self-referential join).

DROP POLICY IF EXISTS "Co-parents can view each other profile" ON public.profiles;
CREATE POLICY "Co-parents can view each other profile" ON public.profiles
  FOR SELECT USING (
    auth.uid() = id
    OR EXISTS (
      SELECT 1 FROM public.children c
      WHERE (c.parent_id = auth.uid() OR c.co_parent_id = auth.uid())
        AND (c.parent_id = profiles.id   OR c.co_parent_id = profiles.id)
    )
  );

-- Drop the restrictive "own profile only" policy so the above covers everything.
-- (If the policy name differs across envs, add the common variants here.)
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;


-- ── Safety: ensure expense_requests has the columns the RPCs reference ────────
ALTER TABLE public.expense_requests
  ADD COLUMN IF NOT EXISTS approved_by_id   UUID REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS approved_at      TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT,
  ADD COLUMN IF NOT EXISTS updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW();


-- ── FIX 3a: approve_expense_request — handle NULL child_id ───────────────────
DROP FUNCTION IF EXISTS public.approve_expense_request(UUID);

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

  -- Check family relationship. When child_id IS NOT NULL, the approver must be
  -- linked to that specific child. When child_id IS NULL (older requests submitted
  -- without one), we fall back to checking any shared child between the two users.
  IF NOT EXISTS (
    SELECT 1 FROM public.children c
    WHERE (c.parent_id   = v_approver_id         OR c.co_parent_id = v_approver_id)
      AND (c.parent_id   = v_request.requester_id OR c.co_parent_id = v_request.requester_id)
      AND (v_request.child_id IS NULL OR c.id = v_request.child_id)
  ) THEN
    RAISE EXCEPTION 'Only the parent or co-parent of this child can approve their expenses';
  END IF;

  -- Deduct from virtual card balance when child_id is set.
  IF v_request.child_id IS NOT NULL THEN
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
        AND category   = v_request.category;
    END IF;
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

GRANT EXECUTE ON FUNCTION public.approve_expense_request(UUID) TO authenticated;


-- ── FIX 3b: reject_expense_request — same NULL child_id treatment ─────────────
DROP FUNCTION IF EXISTS public.reject_expense_request(UUID, TEXT);
DROP FUNCTION IF EXISTS public.reject_expense_request(UUID);

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
    SELECT 1 FROM public.children c
    WHERE (c.parent_id   = v_rejector_id          OR c.co_parent_id = v_rejector_id)
      AND (c.parent_id   = v_request.requester_id  OR c.co_parent_id = v_request.requester_id)
      AND (v_request.child_id IS NULL OR c.id = v_request.child_id)
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

GRANT EXECUTE ON FUNCTION public.reject_expense_request(UUID, TEXT) TO authenticated;
