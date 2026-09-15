-- ─────────────────────────────────────────────────────────────────────────────
-- The trial has to speak the vocabulary the table allows
-- ─────────────────────────────────────────────────────────────────────────────
--
-- 20260919 granted the referral free month by setting
-- subscription_status = 'trialing'. profiles carries a CHECK constraint from
-- 20260629:
--
--   CHECK (subscription_status IN ('active', 'cancelled', 'past_due'))
--
-- so every grant raised a constraint violation. capture_referral() aborted, and
-- because the grant sits inside the same function as the insert, the referral
-- row rolled back with it. The client saw "Failed to capture referral", stayed
-- on Preview, and no referral existed for the partner to be paid on. The code
-- was not merely ungranted, it was lost.
--
-- expire_referral_trials() had the same fault the other way: it wrote
-- 'inactive', which is equally not in the list, so no trial could have ended
-- either.
--
-- 'trialing' is added to the vocabulary, and the expiry now returns people to
-- 'active', which is what an ordinary Preview user already has: the default for
-- the column is 'active', and free is expressed by tier 'preview', not by the
-- status.

alter table public.profiles
  drop constraint if exists profiles_subscription_status_check;

alter table public.profiles
  add constraint profiles_subscription_status_check
  check (subscription_status in ('active', 'cancelled', 'past_due', 'trialing'));


-- Expiry returns the account to an ordinary free user: tier 'preview',
-- status 'active'. Writing 'inactive' was never a legal value.
create or replace function public.expire_referral_trials()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer := 0;
begin
  with expired as (
    update public.profiles
       set subscription_tier   = 'preview',
           subscription_status = 'active',
           referral_trial_ends_at = null
     where referral_trial_ends_at is not null
       and referral_trial_ends_at <= now()
       and lower(coalesce(subscription_status, '')) = 'trialing'
    returning id
  )
  insert into public.referral_events (referral_id, event_type, old_status, new_status, meta)
  select r.id, 'trial_ended', r.status, r.status,
         jsonb_build_object('reverted_to', 'preview')
    from expired e
    join public.referrals r on r.user_id = e.id;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;


-- Anyone who hit the broken window entered a valid code and got nothing: no
-- referral, no trial. There is no record of them to repair, because the
-- transaction rolled back. They can re-enter the code under Settings, which
-- still works inside the seven day window.
--
-- This reports whether anyone was affected, by finding accounts created since
-- 20260919 was applied that have no referral row.
select count(*) as signups_since_the_break_with_no_referral
  from public.profiles p
 where p.created_at >= now() - interval '1 day'
   and not exists (select 1 from public.referrals r where r.user_id = p.id);
