-- Fix RLS so co-parents can see and action each other's expense requests,
-- calendar events, and messages. Without this, the co-parent side of the app is
-- completely blind — the screen loads but shows nothing.

-- ─────────────────────────────────────────────────────────────────
-- expense_requests
-- ─────────────────────────────────────────────────────────────────

-- Allow co-parents to view expense requests in the same family
DROP POLICY IF EXISTS "Co-parents can view expense requests" ON public.expense_requests;
CREATE POLICY "Co-parents can view expense requests"
  ON public.expense_requests FOR SELECT
  USING (
    auth.uid() = requester_id
    OR EXISTS (
      SELECT 1 FROM public.children c
      WHERE
        (c.parent_id = auth.uid() OR c.co_parent_id = auth.uid())
        AND (c.parent_id = expense_requests.requester_id OR c.co_parent_id = expense_requests.requester_id)
    )
  );

-- Allow co-parents to approve or reject pending requests (not their own)
DROP POLICY IF EXISTS "Co-parents can update expense request status" ON public.expense_requests;
CREATE POLICY "Co-parents can update expense request status"
  ON public.expense_requests FOR UPDATE
  USING (
    auth.uid() != requester_id
    AND status = 'pending'
    AND EXISTS (
      SELECT 1 FROM public.children c
      WHERE
        (c.parent_id = auth.uid() OR c.co_parent_id = auth.uid())
        AND (c.parent_id = expense_requests.requester_id OR c.co_parent_id = expense_requests.requester_id)
    )
  )
  WITH CHECK (status IN ('approved', 'rejected'));

-- ─────────────────────────────────────────────────────────────────
-- calendar_events
-- ─────────────────────────────────────────────────────────────────

-- Allow co-parents to view the shared family calendar
DROP POLICY IF EXISTS "Co-parents can view calendar events" ON public.calendar_events;
CREATE POLICY "Co-parents can view calendar events"
  ON public.calendar_events FOR SELECT
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM public.children c
      WHERE
        (c.parent_id = auth.uid() OR c.co_parent_id = auth.uid())
        AND (c.parent_id = calendar_events.user_id OR c.co_parent_id = calendar_events.user_id)
    )
  );

-- Allow co-parents to add events to the shared calendar
DROP POLICY IF EXISTS "Co-parents can insert calendar events" ON public.calendar_events;
CREATE POLICY "Co-parents can insert calendar events"
  ON public.calendar_events FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.children c
      WHERE c.parent_id = auth.uid() OR c.co_parent_id = auth.uid()
    )
  );

-- ─────────────────────────────────────────────────────────────────
-- children: ensure co-parent can also update custody_split_pct
-- ─────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Co-parents can update children" ON public.children;
CREATE POLICY "Co-parents can update children"
  ON public.children FOR UPDATE
  USING (auth.uid() = parent_id OR auth.uid() = co_parent_id)
  WITH CHECK (auth.uid() = parent_id OR auth.uid() = co_parent_id);

-- ─────────────────────────────────────────────────────────────────
-- DELETE policies — allow owners to remove their own records
-- ─────────────────────────────────────────────────────────────────

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
