-- Wipe-history RPC + per-item DELETE policies
-- Paste this entire file into Supabase SQL Editor and click Run.

-- ─── wipe_my_history() ───────────────────────────────────────────────────────
-- SECURITY DEFINER means it runs as the DB owner and bypasses RLS entirely.
-- The app calls this via supabase.rpc('wipe_my_history').

CREATE OR REPLACE FUNCTION wipe_my_history()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM custody_checkins WHERE user_id = auth.uid();
  DELETE FROM custody_zones    WHERE user_id = auth.uid();
  DELETE FROM expense_requests WHERE requester_id = auth.uid();
  DELETE FROM calendar_events  WHERE user_id = auth.uid();
END;
$$;

GRANT EXECUTE ON FUNCTION wipe_my_history() TO authenticated;

-- ─── Per-item DELETE policies (trash icons in each screen) ────────────────────

DROP POLICY IF EXISTS "Parents can delete their children" ON public.children;
CREATE POLICY "Parents can delete their children"
  ON public.children FOR DELETE
  USING (auth.uid() = parent_id);

DROP POLICY IF EXISTS "Requesters can delete expense requests" ON public.expense_requests;
CREATE POLICY "Requesters can delete expense requests"
  ON public.expense_requests FOR DELETE
  USING (auth.uid() = requester_id);

DROP POLICY IF EXISTS "Users can delete their calendar events" ON public.calendar_events;
CREATE POLICY "Users can delete their calendar events"
  ON public.calendar_events FOR DELETE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their custody checkins" ON public.custody_checkins;
CREATE POLICY "Users can delete their custody checkins"
  ON public.custody_checkins FOR DELETE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their custody zones" ON public.custody_zones;
CREATE POLICY "Users can delete their custody zones"
  ON public.custody_zones FOR DELETE
  USING (auth.uid() = user_id);
