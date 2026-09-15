-- ─────────────────────────────────────────────────────────────────────────────
-- "Custody" is renamed to "care"
-- ─────────────────────────────────────────────────────────────────────────────
--
-- The Children's Act 38 of 2005 replaced "custody" with "care" and "access"
-- with "contact". The app now says care everywhere, so the values already
-- stored need to say it too, otherwise an event created last week and one
-- created today are labelled differently on the same calendar.
--
-- Only display values change. Table and column names (custody_checkins,
-- custody_zones, custody_split_pct) are internal and stay as they are, so
-- nothing that reads them has to change.

-- Calendar events. The app's month counter matches both spellings, so this is
-- safe to run before or after the app update reaches everyone.
update public.calendar_events
   set event_type = 'Care Day'
 where event_type = 'Custody Day';

-- Compliance log entries. The label shown is the stored value with underscores
-- turned into spaces, so the value itself carries the wording.
update public.compliance_logs
   set event_type = 'care_exchange'
 where event_type = 'custody_exchange';
