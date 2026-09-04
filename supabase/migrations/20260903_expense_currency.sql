-- Add currency column to expense_requests.
-- Existing rows default to 'ZAR' (the app's primary market).
-- New rows must pass currency explicitly at insert time.

ALTER TABLE public.expense_requests
  ADD COLUMN IF NOT EXISTS currency TEXT NOT NULL DEFAULT 'ZAR'
    CHECK (currency IN ('ZAR', 'USD'));
