-- ============================================================
-- Migration: Remove money-holding/transmission features
-- Adds custody split tracking; the app no longer holds, sends,
-- or transmits funds for anyone. Yoco is subscription-billing only.
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- Custody split percentage per child.
-- Represents the PRIMARY parent's (children.parent_id) share of
-- shared expenses. The co-parent's share is implicitly 100 - this value.
-- Used by the Receipt Ledger 50/50 (or custom-split) calculator.
-- ────────────────────────────────────────────────────────────
ALTER TABLE children
  ADD COLUMN IF NOT EXISTS custody_split_pct INTEGER NOT NULL DEFAULT 50
    CHECK (custody_split_pct >= 0 AND custody_split_pct <= 100);

COMMENT ON COLUMN children.custody_split_pct IS
  'Primary parent''s percentage share of shared expenses for this child (0-100). '
  'Co-parent''s share is 100 minus this value. Set from the Family page.';

-- ────────────────────────────────────────────────────────────
-- Downgrade any profile still on the retired 'family_plus' tier
-- to 'premium' so normaliseTierId() and TIER_RANK stay consistent.
-- ────────────────────────────────────────────────────────────
UPDATE profiles
SET subscription_tier = 'premium'
WHERE subscription_tier = 'family_plus';

-- ────────────────────────────────────────────────────────────
-- Note: wallet_pockets, withdrawal_requests tables are no longer
-- written to by any page (ChildCoffers/BalanceBudget/Expenses removed,
-- Yoco webhook locked to subscription events only). They are left in
-- place rather than dropped, since dropping is destructive and any
-- historical data they hold may still be useful for support/audit
-- purposes. No new rows will be created in either table.
-- ────────────────────────────────────────────────────────────
