-- Migration: 0001_auth_profiles
-- Purpose: Add profiles table 1:1 with auth.users, trigger to seed it, and RLS policies.
-- Applied: 2026-04-20
--
-- Email template notes for Supabase Auth (configure in Supabase dashboard):
--   Invite: "You've been invited to MSP Coffee — click the link below to set your password and get started."
--   Confirm signup: "Welcome to MSP Coffee — confirm your email to activate your account."
--   Reset password: "Reset your MSP Coffee password — click the link below. If you didn't request this, ignore this email."

-- profiles: app-specific user data, 1:1 with auth.users
create table public.profiles (
  id                     uuid primary key references auth.users(id) on delete cascade,
  name                   text not null,
  role                   text not null check (role in ('admin','supervisor','worker')),
  estate                 text,
  phone                  text,  -- denormalized from auth.users.phone for search
  must_change_password   boolean not null default false,
  created_by             uuid references auth.users(id),
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

create index profiles_role_idx on public.profiles (role);
create index profiles_estate_idx on public.profiles (estate);
create index profiles_created_by_idx on public.profiles (created_by);

-- Auto-update updated_at
create trigger profiles_updated_at
  before update on public.profiles
  for each row execute procedure update_updated_at_column();

-- Seed profile on new auth.users row from user_metadata
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, name, role, estate, phone, created_by)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', new.email, new.phone, 'Unnamed'),
    coalesce(new.raw_user_meta_data->>'role', 'worker'),
    new.raw_user_meta_data->>'estate',
    new.phone,
    (new.raw_user_meta_data->>'created_by')::uuid
  );
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- RLS
alter table public.profiles enable row level security;

-- Self-read / self-update (limited fields — role/estate only updatable by admin)
-- auth.uid() wrapped in (select ...) to avoid per-row re-evaluation (auth_rls_initplan fix)
create policy profiles_self_read on public.profiles
  for select using ((select auth.uid()) = id);

create policy profiles_self_update on public.profiles
  for update using ((select auth.uid()) = id)
  with check (
    (select auth.uid()) = id
    -- Prevent self role/estate escalation: enforce these columns stay the same on self-update
    and role = (select role from public.profiles where id = (select auth.uid()))
    and estate is not distinct from (select estate from public.profiles where id = (select auth.uid()))
  );

-- Admin: full read/write
create policy profiles_admin_all on public.profiles
  for all using (
    exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid()) and p.role = 'admin'
    )
  );
