-- ============================================
-- ADD: Payment tracking for expense approvals
-- ============================================
ALTER TABLE public.expense_requests
  ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'unpaid',
  ADD COLUMN IF NOT EXISTS paid_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS payment_reference TEXT;

-- Normalize existing approved requests as paid
UPDATE public.expense_requests
SET payment_status = 'paid',
    paid_at = COALESCE(paid_at, updated_at, created_at)
WHERE status = 'approved'
  AND (payment_status IS NULL OR payment_status = 'unpaid');

-- Status constraint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'expense_requests_payment_status_check'
  ) THEN
    ALTER TABLE public.expense_requests
      ADD CONSTRAINT expense_requests_payment_status_check
      CHECK (payment_status IN ('unpaid', 'pending', 'paid', 'failed'));
  END IF;
END $$;

COMMENT ON COLUMN public.expense_requests.payment_status IS 'Payment lifecycle for approvals (unpaid/pending/paid/failed)';
COMMENT ON COLUMN public.expense_requests.paid_at IS 'Timestamp when expense approval payment was confirmed';
COMMENT ON COLUMN public.expense_requests.payment_reference IS 'External payment provider reference (Yoco)';

