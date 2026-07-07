-- Child emergency medical profiles
-- One profile per child (upsert on child_id)

create table if not exists public.child_emergency_profiles (
  id                  uuid primary key default gen_random_uuid(),
  child_id            uuid not null references public.children(id) on delete cascade,
  medical_aid_scheme  text,
  medical_aid_number  text,
  blood_type          text check (blood_type in ('A+','A-','B+','B-','O+','O-','AB+','AB-','Unknown')),
  allergies           text[],
  medications         text[],
  doctor_name         text,
  doctor_phone        text,
  dentist_name        text,
  dentist_phone       text,
  medical_notes       text,
  emergency_notes     text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (child_id)
);

alter table public.child_emergency_profiles enable row level security;

-- Parents who own the child (via children table) can read/write
create policy "owner_select" on public.child_emergency_profiles
  for select using (
    exists (
      select 1 from public.children c
      where c.id = child_id
        and (c.parent_id = auth.uid() or c.co_parent_id = auth.uid())
    )
  );

create policy "owner_insert" on public.child_emergency_profiles
  for insert with check (
    exists (
      select 1 from public.children c
      where c.id = child_id
        and (c.parent_id = auth.uid() or c.co_parent_id = auth.uid())
    )
  );

create policy "owner_update" on public.child_emergency_profiles
  for update using (
    exists (
      select 1 from public.children c
      where c.id = child_id
        and (c.parent_id = auth.uid() or c.co_parent_id = auth.uid())
    )
  );

-- Auto-update updated_at
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_updated_at_child_emergency_profiles on public.child_emergency_profiles;
create trigger set_updated_at_child_emergency_profiles
  before update on public.child_emergency_profiles
  for each row execute function public.set_updated_at();
