-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Stop users granting themselves a paid plan
-- ─────────────────────────────────────────────────────────────────────────────
--
-- "Users can update own profile" allows an update to ANY column of the user's
-- own row. Nothing protected subscription_tier, and the API trusts that column to
-- decide who gets My SCAI. With the public anon key shipped in the app and their
-- own login, one request made a free user Premium, with the AI usage billed to us.
-- id_verified (the Verified badge a co-parent sees) and role had the same hole.
--
-- Only requests made from the app as an ordinary user are restricted. Payment
-- webhooks and sync-tier use the service role; the signup trigger and the SQL
-- editor carry no JWT. All of those keep full control.
--
-- Columns are compared through to_jsonb so a column missing from this database
-- is skipped rather than breaking every profile update.

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
    -- A profile a user creates for themselves starts with no paid plan, no
    -- verification and the ordinary parent role.
    if (v_new ? 'subscription_tier')
       and coalesce(lower(v_new ->> 'subscription_tier'), 'preview') not in ('preview', 'free') then
      raise exception 'PROFILE_PROTECTED:subscription_tier' using errcode = '42501';
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

drop trigger if exists guard_profile_protected_columns on public.profiles;
create trigger guard_profile_protected_columns
  before insert or update on public.profiles
  for each row execute function public.guard_profile_protected_columns();


-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Enforce the limits the pricing screen advertises
-- ─────────────────────────────────────────────────────────────────────────────
--
-- The pricing screen promised per-plan caps, but the app inserted straight into
-- these tables and nothing counted. Only expenses created through My SCAI were
-- checked. Enforcing it here covers every path: the app, My SCAI, recurring
-- expenses, and anything written later.
--
-- Nobody loses data. Existing rows stay; someone already over a limit simply
-- cannot add more until they upgrade, or until the 1st for monthly limits.
--
-- Deliberately not limited here:
--   messages   Cutting co-parents off from each other mid-dispute is a real harm.
--              Left for an explicit decision.
--   exports    Nothing records exports, so there is nothing to count.
--   Premium, and any tier this code does not recognise, are unlimited, so an
--   unexpected tier value can never lock out a paying user.

create or replace function public.tier_limit(p_tier text, p_resource text)
returns table (max_count integer, monthly boolean)
language plpgsql
immutable
as $$
declare
  t text := lower(coalesce(p_tier, 'preview'));
begin
  t := case t
         when 'free'        then 'preview'
         when 'family_plus' then 'plus'
         when 'legal'       then 'premium'
         else t
       end;

  if p_resource = 'children' then
    if t in ('preview', 'essential') then return query select 1, false;
    elsif t = 'plus'                  then return query select 3, false;
    end if;
  elsif p_resource = 'calendar_events' then
    if t = 'preview'      then return query select 5, false;
    elsif t = 'essential' then return query select 40, true;
    elsif t = 'plus'      then return query select 150, true;
    end if;
  elsif p_resource = 'expense_requests' then
    if t = 'preview'      then return query select 3, true;
    elsif t = 'essential' then return query select 20, true;
    elsif t = 'plus'      then return query select 100, true;
    end if;
  elsif p_resource = 'legal_documents' then
    if t = 'preview'      then return query select 3, false;
    elsif t = 'essential' then return query select 25, false;
    end if;
  end if;
  -- No row returned means unlimited.
end;
$$;

-- How much of a limited resource a user has used. Months follow South African
-- time, so a limit resets at local midnight on the 1st, not two hours later.
create or replace function public.tier_usage(p_user uuid, p_resource text)
returns table (tier text, max_count integer, used integer, monthly boolean)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_tier    text;
  v_max     integer;
  v_monthly boolean;
  v_used    integer;
  v_since   timestamptz := date_trunc('month', now() at time zone 'Africa/Johannesburg')
                             at time zone 'Africa/Johannesburg';
begin
  select p.subscription_tier into v_tier from profiles p where p.id = p_user;
  select l.max_count, l.monthly into v_max, v_monthly from tier_limit(v_tier, p_resource) l;
  if v_max is null then
    return;
  end if;

  if p_resource = 'children' then
    select count(*) into v_used from children c
     where c.parent_id = p_user and (not v_monthly or c.created_at >= v_since);
  elsif p_resource = 'calendar_events' then
    select count(*) into v_used from calendar_events e
     where e.user_id = p_user and (not v_monthly or e.created_at >= v_since);
  elsif p_resource = 'expense_requests' then
    select count(*) into v_used from expense_requests x
     where x.requester_id = p_user and (not v_monthly or x.created_at >= v_since);
  elsif p_resource = 'legal_documents' then
    select count(*) into v_used from legal_documents d
     where d.user_id = p_user and (not v_monthly or d.created_at >= v_since);
  else
    return;
  end if;

  return query select coalesce(v_tier, 'preview'), v_max, v_used, v_monthly;
end;
$$;

-- The caller's own usage, for checking before an upload rather than after it.
create or replace function public.my_tier_usage(p_resource text)
returns table (tier text, max_count integer, used integer, monthly boolean)
language sql
stable
security definer
set search_path = public
as $$
  select * from public.tier_usage(auth.uid(), p_resource);
$$;

-- Anyone could otherwise read another user's counts through tier_usage.
revoke execute on function public.tier_usage(uuid, text) from public, anon, authenticated;
revoke execute on function public.my_tier_usage(text) from public, anon;
grant  execute on function public.my_tier_usage(text) to authenticated;

create or replace function public.enforce_tier_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner uuid;
  v       record;
begin
  -- Read through jsonb. PL/pgSQL evaluates every new.<field> in an expression,
  -- so a plain CASE would fail on tables that lack the other branches' columns.
  v_owner := (to_jsonb(new) ->> case tg_table_name
                                  when 'children'         then 'parent_id'
                                  when 'calendar_events'  then 'user_id'
                                  when 'expense_requests' then 'requester_id'
                                  when 'legal_documents'  then 'user_id'
                                end)::uuid;
  if v_owner is null then
    return new;
  end if;

  select * into v from public.tier_usage(v_owner, tg_table_name);
  if found and v.used >= v.max_count then
    -- The app parses this: TIER_LIMIT:<resource>:<limit>:<tier>, hint monthly|total.
    raise exception 'TIER_LIMIT:%:%:%', tg_table_name, v.max_count, v.tier
      using errcode = 'P0001',
            hint = case when v.monthly then 'monthly' else 'total' end;
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_tier_limit on public.children;
create trigger enforce_tier_limit before insert on public.children
  for each row execute function public.enforce_tier_limit();

drop trigger if exists enforce_tier_limit on public.calendar_events;
create trigger enforce_tier_limit before insert on public.calendar_events
  for each row execute function public.enforce_tier_limit();

drop trigger if exists enforce_tier_limit on public.expense_requests;
create trigger enforce_tier_limit before insert on public.expense_requests
  for each row execute function public.enforce_tier_limit();

drop trigger if exists enforce_tier_limit on public.legal_documents;
create trigger enforce_tier_limit before insert on public.legal_documents
  for each row execute function public.enforce_tier_limit();
