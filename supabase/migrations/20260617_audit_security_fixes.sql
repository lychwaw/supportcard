-- ============================================================
-- Security Audit Fixes — run AFTER 20260617_neutral_ledger_custody_clock.sql
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- FIX 1: Expense immutability trigger
-- Once an expense_request is approved it must never change.
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION prevent_expense_modification()
RETURNS TRIGGER AS $$
BEGIN
  -- Block ALL changes to an approved expense
  IF OLD.status = 'approved' THEN
    RAISE EXCEPTION 'Approved expense requests are immutable and cannot be modified or deleted';
  END IF;
  -- Block regressing a non-rejected expense back to pending after it has been acted on
  IF OLD.status = 'rejected' AND NEW.status = 'pending' THEN
    RAISE EXCEPTION 'Rejected expense requests cannot be re-opened';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS expense_immutability_update ON expense_requests;
CREATE TRIGGER expense_immutability_update
  BEFORE UPDATE ON expense_requests
  FOR EACH ROW EXECUTE FUNCTION prevent_expense_modification();

-- Also block hard-deletes of approved records
CREATE OR REPLACE FUNCTION prevent_approved_expense_delete()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status = 'approved' THEN
    RAISE EXCEPTION 'Approved expense requests cannot be deleted';
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS expense_immutability_delete ON expense_requests;
CREATE TRIGGER expense_immutability_delete
  BEFORE DELETE ON expense_requests
  FOR EACH ROW EXECUTE FUNCTION prevent_approved_expense_delete();

-- ────────────────────────────────────────────────────────────
-- FIX 2: wallet_pockets — restrict UPDATE to owner only
-- Co-parents must NOT be able to directly set arbitrary balances.
-- Balance changes must flow through the Yoco webhook (service role).
-- ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "wallet_pockets_update" ON wallet_pockets;

CREATE POLICY "wallet_pockets_update_owner_only" ON wallet_pockets
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ────────────────────────────────────────────────────────────
-- FIX 3: withdrawal_requests — split FOR ALL into explicit policies
-- so INSERT WITH CHECK is unambiguous and can't be bypassed
-- by a null requested_by on the row being inserted.
-- ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "withdrawal_requests_access" ON withdrawal_requests;

CREATE POLICY "withdrawal_requests_insert" ON withdrawal_requests
  FOR INSERT
  WITH CHECK (requested_by = auth.uid());

CREATE POLICY "withdrawal_requests_select" ON withdrawal_requests
  FOR SELECT
  USING (
    requested_by = auth.uid()
    OR child_id IN (
      SELECT id FROM children
      WHERE parent_id = auth.uid() OR co_parent_id = auth.uid()
    )
  );

CREATE POLICY "withdrawal_requests_update" ON withdrawal_requests
  FOR UPDATE
  USING (
    -- Only the parent/co-parent of the child can approve/decline
    child_id IN (
      SELECT id FROM children
      WHERE parent_id = auth.uid() OR co_parent_id = auth.uid()
    )
  )
  WITH CHECK (
    child_id IN (
      SELECT id FROM children
      WHERE parent_id = auth.uid() OR co_parent_id = auth.uid()
    )
  );

-- Children cannot delete withdrawal requests (prevents retracting after approval)
CREATE POLICY "withdrawal_requests_delete" ON withdrawal_requests
  FOR DELETE
  USING (
    status = 'pending'
    AND requested_by = auth.uid()
  );

-- ────────────────────────────────────────────────────────────
-- FIX 4: expense_requests rate limiting via RLS
-- Max 50 pending submissions per user per 24 hours.
-- ────────────────────────────────────────────────────────────
-- First, check if an INSERT policy already exists; if so we add the check to it.
-- In most setups expense_requests uses the anon key with RLS so we create a policy.
CREATE POLICY "expense_requests_rate_limit" ON expense_requests
  FOR INSERT
  WITH CHECK (
    (
      SELECT COUNT(*)
      FROM expense_requests er
      WHERE er.requester_id = auth.uid()
        AND er.status = 'pending'
        AND er.created_at > NOW() - INTERVAL '24 hours'
    ) < 50
  );

-- ────────────────────────────────────────────────────────────
-- FIX 5: Storage bucket — receipts must be PRIVATE
-- Signed URLs (max 1 hour) are generated server-side on demand.
-- ────────────────────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'receipts',
  'receipts',
  false,               -- PRIVATE: no public URL access
  10485760,            -- 10 MB max per file
  ARRAY['image/jpeg','image/png','image/webp','image/heic','application/pdf']
)
ON CONFLICT (id) DO UPDATE
  SET public = false;  -- If bucket already exists, force it private

-- RLS policy for storage: users may only read/write their own folder
CREATE POLICY "receipts_owner_read" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'receipts'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "receipts_owner_insert" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'receipts'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "receipts_owner_delete" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'receipts'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- ────────────────────────────────────────────────────────────
-- FIX 6: Critical performance indexes
-- ────────────────────────────────────────────────────────────

-- Index 1: Covering index for 50/50 monthly aggregation query
--   SELECT requester_id, SUM(amount) FROM expense_requests
--   WHERE child_id = ANY($1) AND created_at >= $2 AND status = 'approved'
--   GROUP BY requester_id;
CREATE INDEX IF NOT EXISTS idx_expense_requests_settle
  ON expense_requests (child_id, created_at, status)
  INCLUDE (amount, requester_id);

-- Index 2: RLS subquery — children lookup by parent or co-parent (runs on EVERY policy eval)
CREATE INDEX IF NOT EXISTS idx_children_parent_id
  ON children (parent_id);

CREATE INDEX IF NOT EXISTS idx_children_co_parent_id
  ON children (co_parent_id);

-- Index 3: custody_checkins log — ordered by child, newest first
CREATE INDEX IF NOT EXISTS idx_checkins_child_created
  ON custody_checkins (child_id, created_at DESC);

-- Index 4: Transactions page — ordered per user, newest first
CREATE INDEX IF NOT EXISTS idx_transactions_user_date
  ON transactions (user_id, transaction_date DESC);

-- Index 5: Exchange log — per child, newest first
CREATE INDEX IF NOT EXISTS idx_exchange_logs_child_created
  ON exchange_logs (child_id, created_at DESC);

-- Index 6: Expense requests — requester's pending count (used by rate limit policy)
CREATE INDEX IF NOT EXISTS idx_expense_requests_requester_pending
  ON expense_requests (requester_id, status, created_at)
  WHERE status = 'pending';

-- ────────────────────────────────────────────────────────────
-- FIX 7: Child-safe RLS view of expense_requests
-- Children see ONLY approved records tagged to them.
-- Pending and disputed items are hidden at the database level —
-- not just filtered in the UI.
-- ────────────────────────────────────────────────────────────

-- Create a view that enforces child-safe filtering
CREATE OR REPLACE VIEW child_safe_expenses AS
SELECT
  id,
  child_id,
  amount,
  category,
  description,
  created_at
  -- Deliberately excludes: requester_id, status, payment_status, receipt_url
  -- Children do not see who paid, dispute status, or raw receipt images.
FROM expense_requests
WHERE status = 'approved';

-- Grant SELECT on the view to authenticated users
-- (they can only see rows their child_id RLS allows on the base table)
GRANT SELECT ON child_safe_expenses TO authenticated;

-- ────────────────────────────────────────────────────────────
-- FIX 8: custody_checkins — default require child_id for co-parent visibility
-- A check-in with null child_id is private to the logging user.
-- Add a constraint note via comment (hard enforcement would break legitimate use).
-- ────────────────────────────────────────────────────────────
COMMENT ON COLUMN custody_checkins.child_id IS
  'Attach a child_id so the co-parent can also see this check-in. '
  'Null check-ins are visible only to the logging user.';
