-- ─────────────────────────────────────────────────────────────────────────────
-- Partner payout rates
-- ─────────────────────────────────────────────────────────────────────────────
--
-- Every partner was created with payout rates of 0, so a referral could qualify
-- after 90 days and earn nothing. Rates are paid in ZAR only:
--
--   Essential  R70
--   Plus       R130
--   Premium    R270
--
-- Fixed alongside:
--   * Essential had no rate of its own and was paid the Plus rate.
--   * Plan names were compared exactly, so 'Premium', 'family_plus' or 'legal'
--     earned nothing. They are now normalised the same way the app reads plans.
--   * The rate is captured when a referral qualifies, so any referral that
--     qualified while rates were 0 is corrected here. Referrals already marked
--     paid are left alone.

alter table public.partners
  add column if not exists payout_essential_cents integer not null default 0;

-- New partners start on the standard rates.
alter table public.partners
  alter column payout_essential_cents set default 7000,
  alter column payout_plus_cents      set default 13000,
  alter column payout_premium_cents   set default 27000;

-- Existing partners on the zero default move to the standard rates. Anyone
-- already given a custom rate by hand is not overwritten.
update public.partners
   set payout_essential_cents = 7000,
       payout_plus_cents      = 13000,
       payout_premium_cents   = 27000
 where payout_essential_cents = 0
   and payout_plus_cents      = 0
   and payout_premium_cents   = 0;

-- A partner on a custom deal has no Essential rate yet. Before this, Essential
-- referrals were paid their Plus rate, so keep that rather than dropping them
-- to nothing.
update public.partners
   set payout_essential_cents = payout_plus_cents
 where payout_essential_cents = 0
   and payout_plus_cents > 0;

-- The commission a partner earns for a referral on a given plan. Zero for free
-- plans and anything unrecognised.
create or replace function public.partner_commission_cents(
  p_tier text, p_essential integer, p_plus integer, p_premium integer
)
returns integer
language sql
immutable
as $$
  select case lower(coalesce(p_tier, ''))
           when 'essential'   then p_essential
           when 'plus'        then p_plus
           when 'family_plus' then p_plus
           when 'premium'     then p_premium
           when 'legal'       then p_premium
           else 0
         end;
$$;

create or replace function public.qualify_referrals()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rec         record;
  v_commission  integer;
  v_month       text := to_char(now(), 'YYYY-MM');
  v_month_count integer;
  v_qualified   integer := 0;
begin
  for v_rec in
    select r.id, r.partner_id, r.tier,
           p.payout_essential_cents, p.payout_plus_cents, p.payout_premium_cents,
           p.monthly_payout_cap
      from referrals r
      join partners p on p.id = r.partner_id
     where r.status = 'pending'
       and r.subscription_started_at is not null
       and r.subscription_started_at <= now() - interval '90 days'
       and p.commission_eligible = true
  loop
    v_commission := partner_commission_cents(
      v_rec.tier, v_rec.payout_essential_cents, v_rec.payout_plus_cents, v_rec.payout_premium_cents);

    -- Free plans earn nothing and stay pending, as before.
    if v_commission <= 0 then
      continue;
    end if;

    select count(*) into v_month_count
      from referrals
     where partner_id = v_rec.partner_id
       and status in ('qualified', 'paid')
       and to_char(qualified_at, 'YYYY-MM') = v_month;

    if v_month_count >= v_rec.monthly_payout_cap then
      continue;
    end if;

    update referrals
       set status = 'qualified', qualified_at = now(), commission_cents = v_commission
     where id = v_rec.id;

    insert into referral_events (referral_id, event_type, old_status, new_status, meta)
    values (v_rec.id, 'qualified', 'pending', 'qualified',
            jsonb_build_object('commission_cents', v_commission, 'tier', v_rec.tier));

    v_qualified := v_qualified + 1;
  end loop;

  return v_qualified;
end;
$$;

-- Referrals that qualified while every rate was 0. Corrected to what they should
-- have earned, and logged, so the audit trail shows why the amount changed.
with fixed as (
  update public.referrals r
     set commission_cents = public.partner_commission_cents(
           r.tier, p.payout_essential_cents, p.payout_plus_cents, p.payout_premium_cents)
    from public.partners p
   where p.id = r.partner_id
     and r.status = 'qualified'
     and coalesce(r.commission_cents, 0) = 0
     and public.partner_commission_cents(
           r.tier, p.payout_essential_cents, p.payout_plus_cents, p.payout_premium_cents) > 0
  returning r.id, r.tier, r.commission_cents
)
insert into public.referral_events (referral_id, event_type, old_status, new_status, meta)
select id, 'commission_corrected', 'qualified', 'qualified',
       jsonb_build_object('commission_cents', commission_cents, 'tier', tier,
                          'reason', 'qualified while payout rates were 0')
  from fixed;
