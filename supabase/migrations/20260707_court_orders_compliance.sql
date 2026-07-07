-- Court orders and compliance event log
-- court_orders: parenting plan / maintenance order records
-- compliance_logs: auto-logged events (custody exchange, expense approval, etc.)

create table if not exists public.court_orders (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  child_id         uuid references public.children(id) on delete set null,
  title            text not null,
  reference_number text,
  order_type       text not null default 'custody'
                     check (order_type in ('custody','maintenance','parenting_plan','other')),
  status           text not null default 'active'
                     check (status in ('active','pending','expired','superseded')),
  issued_date      date,
  due_date         date,
  document_url     text,
  notes            text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

alter table public.court_orders enable row level security;

create policy "owner_all" on public.court_orders
  for all using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Co-parent read access for shared children
create policy "coparent_select" on public.court_orders
  for select using (
    child_id is null
    or exists (
      select 1 from public.children c
      where c.id = child_id
        and (c.parent_id = auth.uid() or c.co_parent_id = auth.uid())
    )
  );

create index if not exists court_orders_user_id_idx on public.court_orders(user_id);
create index if not exists court_orders_due_date_idx on public.court_orders(due_date asc nulls last);

-- Auto-update updated_at (reuse function from child_emergency_profiles if it exists)
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_updated_at_court_orders on public.court_orders;
create trigger set_updated_at_court_orders
  before update on public.court_orders
  for each row execute function public.set_updated_at();

-- ─── Compliance event log ─────────────────────────────────────────────────────

create table if not exists public.compliance_logs (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  child_id    uuid references public.children(id) on delete set null,
  event_type  text not null,  -- e.g. 'custody_exchange', 'expense_approved', 'court_order_met'
  description text,
  source      text default 'manual'  -- 'manual' | 'system' | 'scai'
                check (source in ('manual','system','scai')),
  created_at  timestamptz not null default now()
);

alter table public.compliance_logs enable row level security;

create policy "owner_all" on public.compliance_logs
  for all using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "coparent_select" on public.compliance_logs
  for select using (
    child_id is null
    or exists (
      select 1 from public.children c
      where c.id = child_id
        and (c.parent_id = auth.uid() or c.co_parent_id = auth.uid())
    )
  );

create index if not exists compliance_logs_user_id_idx  on public.compliance_logs(user_id);
create index if not exists compliance_logs_created_idx  on public.compliance_logs(created_at desc);
