-- ============================================================
-- Schedule qualify_referrals()
--
-- The referral system has been live since 2026-09-01, but nothing ever called
-- qualify_referrals(). Referrals therefore stayed 'pending' forever, never
-- reached 'qualified', and never appeared in the monthly payout query — so
-- every partner earned R0 regardless of what they were promised.
--
-- Runs weekly rather than daily: qualification only depends on a 90-day
-- boundary, so the worst case is a referral qualifying up to six days late,
-- well inside a monthly payout cycle.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Idempotent: drop any previous copy before scheduling, so re-running this
-- migration doesn't create duplicate jobs that double-count referrals.
DO $$
BEGIN
  PERFORM cron.unschedule('qualify-referrals-weekly');
EXCEPTION
  WHEN OTHERS THEN NULL;  -- no existing job, which is the normal first run
END;
$$;

-- Mondays at 03:00 UTC (05:00 SAST) — off-peak, and lands before the start of
-- any month so the payout query has fresh data when you run it.
SELECT cron.schedule(
  'qualify-referrals-weekly',
  '0 3 * * 1',
  $$SELECT qualify_referrals();$$
);
