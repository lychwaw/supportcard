-- ============================================================
-- Subscription tier restructure — 2026-04-26
-- Collapses the 5-tier model (free/premium/family_plus/legal/executive)
-- into a 4-tier model (free/premium/family_plus/legal).
-- Executive is retired; existing executive subscribers are migrated
-- to the legal tier (highest available) and their expiry extended by
-- one month from this migration date so they do not lose access.
-- ============================================================

-- 1. MIGRATE EXISTING EXECUTIVE SUBSCRIBERS
UPDATE public.profiles
SET
  subscription_tier  = 'legal',
  -- Extend expiry by 1 month so they do not lose access during transition.
  expiry_date        = CASE
                         WHEN expiry_date IS NULL OR expiry_date < NOW()
                         THEN NOW() + INTERVAL '1 month'
                         ELSE expiry_date + INTERVAL '1 month'
                       END,
  updated_at         = NOW()
WHERE subscription_tier = 'executive';

-- 2. NORMALISE ANY OTHER UNEXPECTED TIER VALUES TO 'free'
-- Guards against stale or malformed data from old checkouts.
UPDATE public.profiles
SET
  subscription_tier = 'free',
  updated_at        = NOW()
WHERE subscription_tier NOT IN ('free', 'premium', 'family_plus', 'legal');

-- 3. ADD SUBSCRIPTION TIER CONSTRAINT
-- Prevents future invalid values at the DB level.
-- NOT VALID: does not scan existing rows (we just cleaned them above, but
-- a parallel session could have inserted new rows during this migration).
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_subscription_tier_valid
  CHECK (subscription_tier IN ('free', 'premium', 'family_plus', 'legal')) NOT VALID;

-- Validate immediately — the UPDATE above guarantees all rows are clean.
ALTER TABLE public.profiles
  VALIDATE CONSTRAINT profiles_subscription_tier_valid;

-- 4. ADD INDEX ON subscription_tier FOR REPORTING QUERIES
CREATE INDEX IF NOT EXISTS idx_profiles_subscription_tier
  ON public.profiles(subscription_tier);
