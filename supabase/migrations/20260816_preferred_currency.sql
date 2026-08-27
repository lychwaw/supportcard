-- Adds persistent currency preference to user profiles.
-- Used by CurrencyProvider to remember the user's ZAR/USD choice across sessions.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS preferred_currency text DEFAULT 'ZAR'
  CHECK (preferred_currency IN ('ZAR', 'USD'));
