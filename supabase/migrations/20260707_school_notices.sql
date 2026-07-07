-- School notices — logged by parents, visible to co-parent
-- Tracks school communications so both parents stay informed

create table if not exists public.school_notices (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  child_id    uuid references public.children(id) on delete set null,
  school_name text,
  notice_text text not null,
  category    text not null default 'General'
                check (category in ('General','Urgent','Permission')),
  notice_date date not null default current_date,
  created_at  timestamptz not null default now()
);

alter table public.school_notices enable row level security;

-- Creator can do everything
create policy "creator_all" on public.school_notices
  for all using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Co-parent can read notices for shared children
create policy "coparent_select" on public.school_notices
  for select using (
    child_id is null
    or exists (
      select 1 from public.children c
      where c.id = child_id
        and (c.parent_id = auth.uid() or c.co_parent_id = auth.uid())
    )
  );

create index if not exists school_notices_user_id_idx    on public.school_notices(user_id);
create index if not exists school_notices_child_id_idx   on public.school_notices(child_id);
create index if not exists school_notices_notice_date_idx on public.school_notices(notice_date desc);
