-- ─────────────────────────────────────────────────────────────────────────────
-- The free month a referred client is promised actually happens
-- ─────────────────────────────────────────────────────────────────────────────
--
-- Clause 3.1 of the partner agreement says a client who joins using a partner
-- code receives one month of free Premium. Nothing implemented it.
-- capture_referral() inserted a referral row and an audit event and stopped.
-- The client stayed on Preview, so the one thing the partner offers her clients
-- did not exist.
--
-- ── The trap this has to avoid ───────────────────────────────────────────────
--
-- A partner is paid once a referral has been on a PAID plan for 90 continuous
-- days. The clock starts in referralSubscriptionActive(), which decides "is
-- this a paid plan" by reading subscription_tier. Granting a free trial by
-- setting subscription_tier = 'premium' therefore looks identical to buying
-- Premium. A client who took the free month, never paid a cent, and simply left
-- the app installed would qualify after 90 days and the partner would be paid
-- R270 out of revenue that never existed.
--
-- So the trial is marked, not disguised: subscription_status = 'trialing' and
-- referral_trial_ends_at set. referralSubscriptionActive() refuses to start the
-- clock while both hold. A real purchase moves status to 'active', the guard
-- stops applying, and the clock starts then, which is the correct moment.
--
-- referral_trial_ends_at is added to the protected columns, because a column
-- that grants Premium and is writable by its own owner is the same hole the
-- profile guard was written to close.

-- ── 1. Where the trial is recorded ───────────────────────────────────────────

alter table public.profiles
  add column if not exists referral_trial_ends_at timestamptz;

comment on column public.profiles.referral_trial_ends_at is
  'When a partner-referral free month ends. Set by capture_referral, cleared by expire_referral_trials. Never writable by the user.';


-- ── 2. Users cannot extend their own trial ───────────────────────────────────

create or replace function public.guard_profile_protected_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text := coalesce(
    nullif(current_setting('request.jwt.claim.role', true), ''),
    nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role',
    ''
  );
  v_new jsonb := to_jsonb(new);
  v_old jsonb;
  v_col text;
  v_protected text[] := array[
    'subscription_tier', 'subscription_status',
    'referral_trial_ends_at',
    'id_verified', 'id_verified_at',
    'role',
    'dodo_customer_id', 'dodo_subscription_id'
  ];
begin
  if v_role not in ('authenticated', 'anon') then
    return new;
  end if;

  if tg_op = 'UPDATE' then
    v_old := to_jsonb(old);
    foreach v_col in array v_protected loop
      if (v_new ? v_col) and (v_new -> v_col) is distinct from (v_old -> v_col) then
        raise exception 'PROFILE_PROTECTED:%', v_col using errcode = '42501';
      end if;
    end loop;
  else
    if (v_new ? 'subscription_tier')
       and coalesce(lower(v_new ->> 'subscription_tier'), 'preview') not in ('preview', 'free') then
      raise exception 'PROFILE_PROTECTED:subscription_tier' using errcode = '42501';
    end if;
    if (v_new ? 'referral_trial_ends_at') and (v_new -> 'referral_trial_ends_at') is not null then
      raise exception 'PROFILE_PROTECTED:referral_trial_ends_at' using errcode = '42501';
    end if;
    if (v_new ? 'id_verified') and coalesce((v_new ->> 'id_verified')::boolean, false) then
      raise exception 'PROFILE_PROTECTED:id_verified' using errcode = '42501';
    end if;
    if (v_new ? 'role') and coalesce(v_new ->> 'role', 'parent') <> 'parent' then
      raise exception 'PROFILE_PROTECTED:role' using errcode = '42501';
    end if;
  end if;

  return new;
end;
$$;


-- ── 3. Granting the month, at the moment the code is accepted ────────────────
-- Everything above the grant is unchanged from the original function.

create or replace function capture_referral(
  p_user_id  UUID,
  p_code     TEXT,
  p_family_id TEXT DEFAULT NULL
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_partner       partners%ROWTYPE;
  v_signup_at     TIMESTAMPTZ;
  v_referral_id   UUID;
  v_tier          TEXT;
  v_trial         INTERVAL := INTERVAL '1 month';   -- the offer, in one place
BEGIN
  p_code := UPPER(TRIM(p_code));

  SELECT * INTO v_partner FROM partners WHERE UPPER(code) = p_code;
  IF NOT FOUND THEN
    RETURN 'invalid_code';
  END IF;

  IF EXISTS (
    SELECT 1 FROM profiles
    WHERE id = p_user_id AND email = v_partner.email
  ) THEN
    RETURN 'self_referral';
  END IF;

  SELECT created_at INTO v_signup_at FROM profiles WHERE id = p_user_id;

  IF NOW() > v_signup_at + INTERVAL '7 days' THEN
    RETURN 'expired';
  END IF;

  IF EXISTS (SELECT 1 FROM referrals WHERE user_id = p_user_id) THEN
    RETURN 'already_referred';
  END IF;

  IF p_family_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM referrals WHERE family_id = p_family_id
  ) THEN
    RETURN 'family_already_referred';
  END IF;

  INSERT INTO referrals (partner_id, user_id, family_id, code_used, code_entered_at, signed_up_at)
  VALUES (v_partner.id, p_user_id, p_family_id, p_code, NOW(), v_signup_at)
  RETURNING id INTO v_referral_id;

  INSERT INTO referral_events (referral_id, event_type, new_status, meta)
  VALUES (v_referral_id, 'created', 'pending', jsonb_build_object('code', p_code));

  -- ── The free month ──────────────────────────────────────────────────────
  -- Only for someone on a free plan. A client who already pays must never be
  -- moved onto a trial: it would replace a real subscription with a temporary
  -- one and, when the trial expired, downgrade a paying customer.
  SELECT lower(coalesce(subscription_tier, 'preview')) INTO v_tier
    FROM profiles WHERE id = p_user_id;

  IF v_tier IN ('preview', 'free', '') THEN
    UPDATE profiles
       SET subscription_tier    = 'premium',
           subscription_status  = 'trialing',
           referral_trial_ends_at = NOW() + v_trial
     WHERE id = p_user_id;

    INSERT INTO referral_events (referral_id, event_type, new_status, meta)
    VALUES (v_referral_id, 'trial_granted', 'pending',
            jsonb_build_object('tier', 'premium', 'ends_at', NOW() + v_trial));
  END IF;

  RETURN 'ok';
END;
$$;


-- ── 4. Ending it when the month is up ────────────────────────────────────────
-- Only touches rows still marked 'trialing'. Someone who subscribed during the
-- trial has status 'active' by then and is left alone, which is the case that
-- would otherwise cancel a paying customer.

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
           subscription_status = 'inactive',
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

create extension if not exists pg_cron;

do $$
begin
  perform cron.unschedule('expire-referral-trials-daily');
exception when others then null;
end;
$$;

select cron.schedule(
  'expire-referral-trials-daily',
  '15 3 * * *',                      -- daily, just after the weekly qualifier
  $$select expire_referral_trials();$$
);
