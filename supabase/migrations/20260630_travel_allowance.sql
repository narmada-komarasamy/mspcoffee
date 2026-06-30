create extension if not exists pgcrypto;

create table if not exists public.travel_allowance_employees (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.travel_allowance_locations (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.travel_allowance_entries (
  id uuid primary key default gen_random_uuid(),
  entry_date date not null,
  employee_id uuid not null references public.travel_allowance_employees(id) on delete restrict,
  location_id uuid not null references public.travel_allowance_locations(id) on delete restrict,
  times integer not null default 1 check (times > 0),
  created_at timestamptz not null default now()
);

alter table public.travel_allowance_employees enable row level security;
alter table public.travel_allowance_locations enable row level security;
alter table public.travel_allowance_entries enable row level security;

create policy "travel allowance employees read" on public.travel_allowance_employees
  for select using (true);

create policy "travel allowance employees write" on public.travel_allowance_employees
  for all using (true) with check (true);

create policy "travel allowance locations read" on public.travel_allowance_locations
  for select using (true);

create policy "travel allowance locations write" on public.travel_allowance_locations
  for all using (true) with check (true);

create policy "travel allowance entries read" on public.travel_allowance_entries
  for select using (true);

create policy "travel allowance entries write" on public.travel_allowance_entries
  for all using (true) with check (true);
