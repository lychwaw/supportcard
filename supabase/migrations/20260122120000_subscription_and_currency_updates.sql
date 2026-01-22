-- Align subscription fields with manual renewal model
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS subscription_status TEXT DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS expiry_date TIMESTAMP WITH TIME ZONE;

-- Normalize subscription tiers to a stable enum-like set
UPDATE public.profiles
SET subscription_tier = CASE
  WHEN subscription_tier IS NULL THEN 'free'
  WHEN lower(subscription_tier) IN ('free') THEN 'free'
  WHEN lower(subscription_tier) IN ('premium') THEN 'premium'
  WHEN lower(subscription_tier) IN ('legal', 'supportcard legal') THEN 'legal'
  WHEN lower(subscription_tier) IN ('family+', 'family_plus', 'family plus') THEN 'family_plus'
  WHEN lower(subscription_tier) IN ('executive', 'supportcard executive') THEN 'executive'
  ELSE 'free'
END;

-- Ensure default aligns with normalized tiers
ALTER TABLE public.profiles
  ALTER COLUMN subscription_tier SET DEFAULT 'free';

-- Status constraint (active / expired)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'profiles_subscription_status_check'
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_subscription_status_check
      CHECK (subscription_status IN ('active', 'expired'));
  END IF;
END $$;

-- Tier constraint for gating logic
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'profiles_subscription_tier_check'
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_subscription_tier_check
      CHECK (subscription_tier IN ('free', 'premium', 'family_plus', 'legal', 'executive'));
  END IF;
END $$;

-- Note: preferred_currency already serves as currency preference
COMMENT ON COLUMN public.profiles.preferred_currency IS 'User currency preference (USD/ZAR etc.)';

