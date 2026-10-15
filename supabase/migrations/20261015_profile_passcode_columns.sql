-- ─────────────────────────────────────────────────────────────────────────────
-- The parent passcode has never worked. Same cause as the Transactions page.
-- ─────────────────────────────────────────────────────────────────────────────
--
-- 20251124093000_wallet_security_and_permissions.sql adds six passcode columns
-- to public.profiles. Confirmed against the live database on 2026-10-15 (the
-- regenerated types file is the live schema): profiles has none of them, and
-- neither does virtual_cards get the columns from the same file. The whole
-- migration never reached the project.
--
-- What that breaks:
--
--   * AccountSwitcher, rendered on Index, Family, Budget and Transactions,
--     selects all five on mount. The select errors, the catch logs it, and the
--     config stays at its defaults.
--   * Settings has a full "Require passcode" panel. Saving writes columns that
--     do not exist, so the toggle has never persisted.
--
-- It is not a hole. When no passcode is configured, switching back to the
-- parent account falls through to handleSwitchRequest, which re-authenticates
-- with the account password via signInWithPassword — strictly stronger than a
-- short passcode. So this restores a convenience that was advertised and never
-- delivered, rather than closing an open door.
--
-- Only the profiles half is re-applied. The same file also adds cardholder_name,
-- cvv, expiry_month, expiry_year and last_four to virtual_cards; nothing in the
-- app or the API reads that table, and creating a cvv column full of generated
-- digits that no code consumes is new exposure for no gain.

alter table public.profiles
  add column if not exists parent_passcode_hash     text,
  add column if not exists parent_passcode_hint     text,
  add column if not exists require_child_passcode   boolean default false,
  add column if not exists passcode_failed_attempts integer default 0,
  add column if not exists passcode_locked_until    timestamptz,
  add column if not exists passcode_updated_at      timestamptz;

-- Existing rows predate the columns and come back null, which the client reads
-- as "no passcode required" anyway. Setting them explicitly keeps the lockout
-- counter arithmetic (attempts + 1) off null.
update public.profiles
   set passcode_failed_attempts = coalesce(passcode_failed_attempts, 0),
       require_child_passcode   = coalesce(require_child_passcode, false)
 where passcode_failed_attempts is null
    or require_child_passcode is null;

comment on column public.profiles.parent_passcode_hash     is 'SHA-256 of the passcode that unlocks adult controls. A convenience gate on top of the account password, not a security boundary — child mode is a client-side switch on the parent''s own session.';
comment on column public.profiles.parent_passcode_hint     is 'Optional hint shown on the unlock dialog.';
comment on column public.profiles.require_child_passcode   is 'Whether switching from child mode back to parent prompts for the passcode.';
comment on column public.profiles.passcode_failed_attempts is 'Consecutive failures; five triggers a five-minute lockout.';
comment on column public.profiles.passcode_locked_until    is 'When the next attempt is allowed.';
comment on column public.profiles.passcode_updated_at      is 'When the passcode was last set or changed.';

-- ── Confirm ──────────────────────────────────────────────────────────────────
-- All six should be listed.
select column_name
  from information_schema.columns
 where table_schema = 'public'
   and table_name = 'profiles'
   and (column_name like 'passcode%'
        or column_name in ('parent_passcode_hash','parent_passcode_hint','require_child_passcode'))
 order by column_name;
