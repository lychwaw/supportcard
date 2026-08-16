-- ============================================================
-- Migration: Per-action AI rate limits — 2026-08-16
--
-- The original ai_rate_limits table used a single shared counter
-- per (user, date). This caused cross-action interference: heavy
-- tone-check usage could exhaust the SCAI quota, and vice versa.
-- This migration adds per-action tracking.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.ai_usage_daily (
  user_id    UUID    NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  call_date  DATE    NOT NULL DEFAULT CURRENT_DATE,
  action     TEXT    NOT NULL,
  call_count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, call_date, action)
);

-- No client-facing RLS policies — only accessible via the SECURITY DEFINER function below.
ALTER TABLE public.ai_usage_daily ENABLE ROW LEVEL SECURITY;

-- Atomic check-and-increment per action type.
-- Returns TRUE  → call allowed (counter incremented)
-- Returns FALSE → daily limit exceeded (counter NOT incremented)
CREATE OR REPLACE FUNCTION public.check_ai_action_rate_limit(
  p_user_id     UUID,
  p_action      TEXT,
  p_max_per_day INTEGER
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  INSERT INTO public.ai_usage_daily (user_id, call_date, action, call_count)
  VALUES (p_user_id, CURRENT_DATE, p_action, 1)
  ON CONFLICT (user_id, call_date, action) DO UPDATE
    SET call_count = ai_usage_daily.call_count + 1
  RETURNING call_count INTO v_count;

  RETURN v_count <= p_max_per_day;
END;
$$;

REVOKE ALL ON FUNCTION public.check_ai_action_rate_limit(UUID, TEXT, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_ai_action_rate_limit(UUID, TEXT, INTEGER) TO service_role;
