-- Onboarding walkthrough: track whether a user has completed the intro tour.
-- NULL = has not seen it yet; a timestamp = completed (or skipped).

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS onboarded_at TIMESTAMPTZ;

-- Backfill: every account that exists right now has already been using the app,
-- so mark them complete. Without this, the OTA/update would throw the tour at
-- the entire existing user base on their next launch.
UPDATE public.profiles
  SET onboarded_at = NOW()
  WHERE onboarded_at IS NULL;
