-- ─────────────────────────────────────────────────────────────────────────────
-- The contact log, and who can see it
-- ─────────────────────────────────────────────────────────────────────────────
--
-- A parent who cannot reach their child has nowhere in this app to record it.
-- compliance_logs.event_type is free text, so the two new kinds need no schema
-- change: 'contact_attempted' and 'contact_denied' are simply written by the
-- Compliance screen alongside the existing kinds.
--
-- What does need changing is who can read them.
--
-- compliance_logs has only an owner policy, so a linked professional cannot
-- see any of it. Every other record a parent keeps is already visible to a
-- professional they invited: children, expenses, messages, care check-ins and
-- documents all have a professional_readonly policy. The log was the one
-- exception, and it is the record a mediator most needs, because a pattern of
-- missed contact is exactly what they are asked to resolve.
--
-- Deliberately NOT shared with the co-parent. Every other record in the app is
-- shared because it is a shared fact: an expense, an event, a handover. "I
-- tried to reach my child and could not" is one parent's account, not an
-- agreed fact, and putting it in front of the other parent turns a record into
-- an accusation. It goes to the professional the parent chose to involve, and
-- no further.

create policy "professional_readonly_compliance_logs" on public.compliance_logs
  for select using (public.is_active_professional_for(user_id));

comment on column public.compliance_logs.event_type is
  'Free text. Known kinds: contact_attempted, contact_denied, care_exchange, expense_approved, court_order_met, school_pickup, medical_visit, other.';
