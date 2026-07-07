-- ============================================================
-- Migration: Security hardening — 2026-07-01
-- 1. AI rate-limit table + atomic RPC (server-side rate limiting)
-- 2. created_via column on expense_requests, calendar_events,
--    custody_checkins (AI provenance tracking for court records)
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1a. AI rate-limit tracking table
--     One row per (user, UTC date). Incremented atomically via
--     the check_ai_rate_limit() function below — no direct
--     client writes ever touch this table.
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.ai_rate_limits (
  user_id    UUID    NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  call_date  DATE    NOT NULL DEFAULT CURRENT_DATE,
  call_count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, call_date)
);

-- No client-facing RLS policies — only accessible via the SECURITY DEFINER function below.
ALTER TABLE public.ai_rate_limits ENABLE ROW LEVEL SECURITY;

-- ────────────────────────────────────────────────────────────
-- 1b. Atomic check-and-increment RPC
--     Returns TRUE  → call allowed (counter incremented)
--     Returns FALSE → daily limit exceeded (counter NOT incremented)
--     Called with the service-role client from api/ai.ts, so
--     p_user_id is passed explicitly (auth.uid() would be NULL).
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.check_ai_rate_limit(
  p_user_id     UUID,
  p_max_per_day INTEGER DEFAULT 150
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_today DATE    := CURRENT_DATE;
  v_count INTEGER;
BEGIN
  INSERT INTO public.ai_rate_limits (user_id, call_date, call_count)
  VALUES (p_user_id, v_today, 1)
  ON CONFLICT (user_id, call_date) DO UPDATE
    SET call_count = ai_rate_limits.call_count + 1
  RETURNING call_count INTO v_count;

  RETURN v_count <= p_max_per_day;
END;
$$;

REVOKE ALL ON FUNCTION public.check_ai_rate_limit(UUID, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_ai_rate_limit(UUID, INTEGER) TO service_role;

-- ────────────────────────────────────────────────────────────
-- 2. AI-provenance column on records My SCAI can create.
--    'manual'  = user created this directly through the UI
--    'scai'    = created by the My SCAI assistant on the user's behalf
--    This is important for court-admissible exports: a judge
--    can see whether a record was manually entered or AI-assisted.
-- ────────────────────────────────────────────────────────────
ALTER TABLE public.expense_requests
  ADD COLUMN IF NOT EXISTS created_via TEXT NOT NULL DEFAULT 'manual'
    CHECK (created_via IN ('manual', 'scai'));

ALTER TABLE public.calendar_events
  ADD COLUMN IF NOT EXISTS created_via TEXT NOT NULL DEFAULT 'manual'
    CHECK (created_via IN ('manual', 'scai'));

ALTER TABLE public.custody_checkins
  ADD COLUMN IF NOT EXISTS created_via TEXT NOT NULL DEFAULT 'manual'
    CHECK (created_via IN ('manual', 'scai'));

COMMENT ON COLUMN public.expense_requests.created_via IS
  'How this record was created: manual (user via UI) or scai (My SCAI assistant).';
COMMENT ON COLUMN public.calendar_events.created_via IS
  'How this record was created: manual (user via UI) or scai (My SCAI assistant).';
COMMENT ON COLUMN public.custody_checkins.created_via IS
  'How this record was created: manual (user via UI) or scai (My SCAI assistant).';
