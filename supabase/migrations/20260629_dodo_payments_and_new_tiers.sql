-- ============================================================
-- Migration: Dodo Payments + 4-tier restructure
-- (preview / essential / plus / premium)
-- Replaces Yoco as the subscription-billing processor. Dodo is
-- used ONLY for SupportCard's own subscription billing — no money
-- moves between co-parents through this app.
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1. Dodo identifiers, for matching webhook events back to profiles
--    and letting a customer manage billing without re-entering details.
-- ────────────────────────────────────────────────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS dodo_subscription_id TEXT,
  ADD COLUMN IF NOT EXISTS dodo_customer_id TEXT;

-- ────────────────────────────────────────────────────────────
-- 2. Drop prior CHECK constraints so the data migration below can
--    write the new tier/status vocabulary without violating them.
-- ────────────────────────────────────────────────────────────
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_subscription_tier_check;
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_subscription_tier_valid;
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_subscription_status_check;

-- ────────────────────────────────────────────────────────────
-- 3. Normalise existing tier values to the new 4-tier model.
--    Mirrors src/lib/subscriptions.ts normaliseTierId().
-- ────────────────────────────────────────────────────────────
UPDATE public.profiles
SET subscription_tier = CASE
  WHEN subscription_tier = 'free' THEN 'preview'
  WHEN subscription_tier = 'basic' THEN 'essential'
  WHEN subscription_tier = 'family_plus' THEN 'plus'
  WHEN subscription_tier IN ('legal', 'executive', 'professional') THEN 'premium'
  WHEN subscription_tier IN ('preview', 'essential', 'plus', 'premium') THEN subscription_tier
  ELSE 'preview'
END;

ALTER TABLE public.profiles
  ALTER COLUMN subscription_tier SET DEFAULT 'preview';

-- ────────────────────────────────────────────────────────────
-- 4. Normalise existing status values to the vocabulary the Dodo
--    webhook writes ('expired' folds into 'cancelled' — both mean
--    "no active access").
-- ────────────────────────────────────────────────────────────
UPDATE public.profiles
SET subscription_status = CASE
  WHEN subscription_status = 'expired' THEN 'cancelled'
  WHEN subscription_status IN ('active', 'cancelled', 'past_due') THEN subscription_status
  ELSE 'active'
END;

ALTER TABLE public.profiles
  ALTER COLUMN subscription_status SET DEFAULT 'active';

-- ────────────────────────────────────────────────────────────
-- 5. Re-add CHECK constraints against the new vocabulary.
-- ────────────────────────────────────────────────────────────
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_subscription_tier_check
  CHECK (subscription_tier IN ('preview', 'essential', 'plus', 'premium'));

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_subscription_status_check
  CHECK (subscription_status IN ('active', 'cancelled', 'past_due'));
