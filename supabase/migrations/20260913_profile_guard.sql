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
