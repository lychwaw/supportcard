-- ─────────────────────────────────────────────────────────────────────────────
-- The monthly payout cap stops being a trap
-- ─────────────────────────────────────────────────────────────────────────────
--
-- partners.monthly_payout_cap defaulted to 20. qualify_referrals() skips any
-- referral once a partner has 20 qualified or paid referrals in the calendar
-- month, so the 21st simply does not qualify that month.
--
-- No partner agreement discloses this. A partner who earned it would be told
-- nothing and paid nothing, on a limit they never agreed to. The cap exists as
-- a guard against a runaway loop or an abused code, not as a commercial term,
-- so it is removed rather than tuned: a partner agreement that promises no
-- limit must not be quietly contradicted by this column.
--
-- If a real commercial ceiling is ever wanted, it belongs in the partner's
-- signed agreement first, and in this column second.

alter table public.partners
  alter column monthly_payout_cap set default 2147483647;

update public.partners
   set monthly_payout_cap = 2147483647
 where monthly_payout_cap = 20;
