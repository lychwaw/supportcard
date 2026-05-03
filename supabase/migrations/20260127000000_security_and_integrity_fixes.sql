-- ============================================================
-- Security and data-integrity fixes
-- ============================================================

-- 1. POSITIVE-AMOUNT CONSTRAINTS
-- NOT VALID means the constraint applies to all future inserts/updates but does
-- not scan existing rows, so the migration cannot fail on pre-existing test data.
-- Run `ALTER TABLE ... VALIDATE CONSTRAINT ...` separately once you have cleaned
-- any legacy rows you want to keep.
ALTER TABLE public.virtual_cards
  ADD CONSTRAINT balance_non_negative CHECK (balance >= 0) NOT VALID;

ALTER TABLE public.expense_requests
  ADD CONSTRAINT expense_amount_positive CHECK (amount > 0) NOT VALID;

ALTER TABLE public.transactions
  ADD CONSTRAINT transaction_amount_positive CHECK (amount > 0) NOT VALID;

-- monthly_limit = 0 means "no budget configured" and is a valid UI state,
-- so we allow >= 0 rather than > 0.
ALTER TABLE public.budget_categories
  ADD CONSTRAINT budget_limit_non_negative CHECK (monthly_limit >= 0) NOT VALID;

-- 2. EXPENSE STATUS ENUM CONSTRAINT
ALTER TABLE public.expense_requests
  ADD CONSTRAINT expense_status_valid
  CHECK (status IN ('pending', 'approved', 'rejected')) NOT VALID;

-- 3. APPROVAL AUDIT COLUMNS
-- Tracks who approved/rejected an expense and when, required for court records.
ALTER TABLE public.expense_requests
  ADD COLUMN IF NOT EXISTS approved_by_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS approved_at    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

-- 4. VISITATION LOG DISPUTE COLUMNS
-- Allows flagging a log entry as disputed without deleting immutable evidence.
ALTER TABLE public.visitation_logs
  ADD COLUMN IF NOT EXISTS is_disputed    BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS dispute_reason TEXT;

-- 5. PAYMENT REFERENCE COLUMN ON TRANSACTIONS
-- Used for topup webhook idempotency: store the Yoco payment ID so that
-- if Yoco retries the webhook the second delivery is a no-op.
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS payment_reference TEXT;

-- Partial unique index: only enforce uniqueness when a reference is present
-- (NULL rows are never considered equal by UNIQUE, so this is the right form).
CREATE UNIQUE INDEX IF NOT EXISTS idx_transactions_payment_reference
  ON public.transactions(payment_reference)
  WHERE payment_reference IS NOT NULL;

-- 7. MISSING FOREIGN-KEY INDEXES
-- These columns appear in WHERE clauses on almost every page load.
-- Without indexes Postgres does a full table scan on every query.
CREATE INDEX IF NOT EXISTS idx_expense_requests_child_id ON public.expense_requests(child_id);
CREATE INDEX IF NOT EXISTS idx_virtual_cards_child_id    ON public.virtual_cards(child_id);
CREATE INDEX IF NOT EXISTS idx_children_parent_id        ON public.children(parent_id);
CREATE INDEX IF NOT EXISTS idx_transactions_user_id      ON public.transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_card_id      ON public.transactions(card_id);

-- 8. UPDATED approve_expense_request FUNCTION
-- Drop first because the previous version may have a different return type.
DROP FUNCTION IF EXISTS public.approve_expense_request(UUID, UUID);
DROP FUNCTION IF EXISTS public.reject_expense_request(UUID, UUID);
DROP FUNCTION IF EXISTS public.reject_expense_request(UUID, UUID, TEXT);
-- Changes from the previous version:
--   a) Rejects if balance would go negative (was previously optional).
--   b) Writes approved_by_id and approved_at for the audit trail.
CREATE OR REPLACE FUNCTION public.approve_expense_request(
  p_request_id  UUID,
  p_approver_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_request     public.expense_requests%ROWTYPE;
  v_balance_card public.virtual_cards%ROWTYPE;
  v_new_balance  DECIMAL(10, 2);
BEGIN
  -- Lock row to prevent concurrent double-approvals
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

  IF v_request.requester_id = p_approver_id THEN
    RAISE EXCEPTION 'Cannot approve your own expense request';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.children
    WHERE id = v_request.child_id
      AND (parent_id = p_approver_id OR co_parent_id = p_approver_id)
  ) THEN
    RAISE EXCEPTION 'Only the parent or co-parent of this child can approve their expenses';
  END IF;

  -- Find the most specific virtual card (matching category first, then any card for this child)
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
    approved_by_id = p_approver_id,
    approved_at    = NOW(),
    updated_at     = NOW()
  WHERE id = p_request_id;
END;
$$;

-- 9. UPDATED reject_expense_request FUNCTION
-- Changes from the previous version:
--   a) Accepts optional rejection reason.
--   b) Writes approved_by_id, approved_at, and rejection_reason for audit trail.
CREATE OR REPLACE FUNCTION public.reject_expense_request(
  p_request_id  UUID,
  p_rejector_id UUID,
  p_reason      TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_request public.expense_requests%ROWTYPE;
BEGIN
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

  IF v_request.requester_id = p_rejector_id THEN
    RAISE EXCEPTION 'Cannot reject your own expense request';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.children
    WHERE id = v_request.child_id
      AND (parent_id = p_rejector_id OR co_parent_id = p_rejector_id)
  ) THEN
    RAISE EXCEPTION 'Only the parent or co-parent of this child can reject their expenses';
  END IF;

  UPDATE public.expense_requests
  SET
    status           = 'rejected',
    approved_by_id   = p_rejector_id,
    approved_at      = NOW(),
    rejection_reason = p_reason,
    updated_at       = NOW()
  WHERE id = p_request_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.approve_expense_request(UUID, UUID)         TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_expense_request(UUID, UUID, TEXT)    TO authenticated;
