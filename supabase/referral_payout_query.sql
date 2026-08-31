-- ============================================================
-- Monthly Referral Payout Query
-- Run in Supabase SQL editor at the start of each month.
-- Shows every qualified-and-unpaid referral grouped by partner.
-- After paying by EFT, run the mark-paid block at the bottom.
-- ============================================================

-- 1. PREVIEW — who to pay and how much
SELECT
  p.name                                          AS partner,
  p.email                                         AS partner_email,
  p.category,
  COUNT(r.id)                                     AS referral_count,
  SUM(r.commission_cents) / 100.0                 AS total_rands,
  ARRAY_AGG(r.id ORDER BY r.qualified_at)         AS referral_ids
FROM referrals r
JOIN partners p ON p.id = r.partner_id
WHERE r.status = 'qualified'
  AND p.commission_eligible = TRUE
GROUP BY p.id, p.name, p.email, p.category
ORDER BY total_rands DESC;


-- 2. DETAIL — individual referrals (run if you need to verify)
SELECT
  p.name                  AS partner,
  r.id                    AS referral_id,
  r.tier,
  r.commission_cents / 100.0 AS commission_rands,
  r.qualified_at,
  r.code_used
FROM referrals r
JOIN partners p ON p.id = r.partner_id
WHERE r.status = 'qualified'
  AND p.commission_eligible = TRUE
ORDER BY p.name, r.qualified_at;


-- 3. MARK PAID — run after EFT is sent
-- Replace '2026-09' with the current period and add the EFT reference.
-- This inserts a payout record and flips all qualifying referrals to paid.

BEGIN;

INSERT INTO payouts (partner_id, period, total_cents, paid_at, reference)
SELECT
  p.id,
  '2026-09',
  SUM(r.commission_cents),
  NOW(),
  'EFT-REF-XXXXXX'   -- replace with your actual EFT reference
FROM referrals r
JOIN partners p ON p.id = r.partner_id
WHERE r.status = 'qualified'
  AND p.commission_eligible = TRUE
GROUP BY p.id
ON CONFLICT (partner_id, period) DO UPDATE
  SET total_cents = EXCLUDED.total_cents,
      paid_at     = EXCLUDED.paid_at,
      reference   = EXCLUDED.reference;

UPDATE referrals
SET status = 'paid'
WHERE status = 'qualified';

INSERT INTO referral_events (referral_id, event_type, old_status, new_status, meta)
SELECT
  id,
  'paid',
  'qualified',
  'paid',
  jsonb_build_object('period', '2026-09')
FROM referrals
WHERE status = 'paid'
  AND qualified_at >= DATE_TRUNC('month', NOW()) - INTERVAL '1 month';

COMMIT;


-- 4. QUALIFICATION — run the weekly job manually if needed
SELECT qualify_referrals();
