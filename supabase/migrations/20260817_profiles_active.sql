-- Migration: 20260817_profiles_active
-- Purpose: Let admin user management disable Supabase Auth-backed profiles.

alter table public.profiles
  add column if not exists active boolean not null default true;

create index if not exists profiles_active_idx on public.profiles (active);

drop policy if exists profiles_self_update on public.profiles;
create policy profiles_self_update on public.profiles
  for update using ((select auth.uid()) = id)
  with check (
    (select auth.uid()) = id
    and role = (select role from public.profiles where id = (select auth.uid()))
    and estate is not distinct from (select estate from public.profiles where id = (select auth.uid()))
    and active is not distinct from (select active from public.profiles where id = (select auth.uid()))
  );
