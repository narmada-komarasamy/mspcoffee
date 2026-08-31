-- Migration: 0000_prereqs
-- Purpose: Shared objects that LATER migrations depend on but never defined.
-- WHY THIS EXISTS: migration 0001_auth_profiles creates a trigger that calls
-- update_updated_at_column(), but that function was only ever defined in the
-- hand-run root file fleet_setup.sql (not a migration). As a result the
-- migrations/ folder could not be applied from scratch. This file fixes the
-- ordering so `supabase db reset` works cleanly. Runs first (lexical order).

create or replace function public.update_updated_at_column()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
