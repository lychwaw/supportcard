-- ─────────────────────────────────────────────────────────────────────────────
-- The Transactions page has never worked. This is why.
-- ─────────────────────────────────────────────────────────────────────────────
--
-- 20250108000002_enhance_transactions_for_logging.sql adds five columns to
-- public.transactions. The table itself is only created by
-- 20251001212404_f4276a7c-…, which by filename runs nine months LATER. The
-- ALTER therefore ran against a table that did not exist, failed, and nothing
-- after it in that file ran either.
--
-- Confirmed against the live database on 2026-10-15. transactions has exactly
-- nine columns: id, user_id, card_id, merchant_name, amount, category,
-- transaction_date, location, created_at. None of the five.
--
-- What that breaks, all of it silently:
--
--   * The page's query joins children:child_id(…), which cannot resolve, so
--     the select errors. The handler treats any error as "no results" and
--     sets an empty list, so the page shows "no transactions" forever rather
--     than reporting a fault.
--   * Logging a transaction inserts logged_by, notes, transaction_type,
--     is_parent_logged and child_id. Every insert fails.
--   * Editing and deleting have no RLS policy at all, because the only
--     migration that created them is the one that never ran.
--
-- This re-applies that work with a filename that sorts after the CREATE, and
-- is written to be safe whether or not any of it is already present.

-- ── The columns ──────────────────────────────────────────────────────────────

alter table public.transactions
  add column if not exists logged_by        uuid references public.profiles(id) on delete set null,
  add column if not exists transaction_type text default 'past',
  add column if not exists notes            text,
  add column if not exists is_parent_logged boolean default false,
  add column if not exists child_id         uuid references public.children(id) on delete set null,
  -- api/_korapay-webhook.ts reads and writes this for webhook idempotency and
  -- it is also absent, so that check has never worked either.
  add column if not exists payment_reference text;

-- The CHECK is added separately: ADD COLUMN IF NOT EXISTS carries no guard for
-- a constraint, so a re-run would fail on a duplicate name.
do $$
begin
  alter table public.transactions
    add constraint transactions_transaction_type_valid
    check (transaction_type in ('past', 'future', 'planned')) not valid;
exception
  when duplicate_object then null;
end;
$$;

-- Existing rows predate the column. They were all logged by their owner.
update public.transactions
   set logged_by = user_id,
       is_parent_logged = true
 where logged_by is null;

create index if not exists idx_transactions_logged_by ON public.transactions(logged_by);
create index if not exists idx_transactions_child_id  ON public.transactions(child_id);
create index if not exists idx_transactions_type      ON public.transactions(transaction_type);
create unique index if not exists idx_transactions_payment_reference
  on public.transactions(payment_reference)
  where payment_reference is not null;

-- ── The policies ─────────────────────────────────────────────────────────────
--
-- INSERT is left exactly as it is. The current policy requires the caller to
-- be the owner and to hold the 'parent' role, which is stricter than the one
-- in the original migration and is already working. Replacing it would be a
-- change in access control smuggled in under a bug fix.
--
-- UPDATE and DELETE genuinely do not exist, so the page's edit and delete
-- buttons fail silently today. Both are scoped to the person who logged the
-- row, which is what the original intended.

drop policy if exists "Users can update own logged transactions" on public.transactions;
create policy "Users can update own logged transactions" on public.transactions
  for update using ((select auth.uid()) = logged_by);

drop policy if exists "Users can delete own logged transactions" on public.transactions;
create policy "Users can delete own logged transactions" on public.transactions
  for delete using ((select auth.uid()) = logged_by);

comment on column public.transactions.logged_by         is 'Who recorded this transaction.';
comment on column public.transactions.transaction_type  is 'past (completed), future (scheduled), planned (proposed).';
comment on column public.transactions.notes             is 'Free text recorded with the transaction.';
comment on column public.transactions.is_parent_logged  is 'True when a parent recorded it rather than a child.';
comment on column public.transactions.child_id          is 'Child this transaction relates to.';
comment on column public.transactions.payment_reference is 'Provider payment id, used to make webhook delivery idempotent.';

-- ── Confirm ──────────────────────────────────────────────────────────────────
-- All six should be listed.
select column_name
  from information_schema.columns
 where table_schema = 'public'
   and table_name = 'transactions'
   and column_name in ('logged_by','transaction_type','notes','is_parent_logged','child_id','payment_reference')
 order by column_name;
