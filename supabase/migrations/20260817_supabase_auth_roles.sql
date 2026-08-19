-- Supabase Auth hardening bridge.
-- Keep profile roles aligned with the app roles used by navigation and API guards.

alter table public.profiles
  drop constraint if exists profiles_role_check;

alter table public.profiles
  add constraint profiles_role_check
  check (role in ('admin', 'supervisor', 'worker', 'ceo', 'hr'));

