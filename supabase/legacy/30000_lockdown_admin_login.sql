-- ============================================================
-- HOTFIX (2026-06-22): lock down admin login
-- ------------------------------------------------------------
-- Temporary mitigation until the real auth fix lands.
-- The PIN login page reads `app_users` as the `anon` role. This
-- replaces the permissive anon SELECT policy so anon can no longer
-- read ANY admin row EXCEPT one kept admin account, which keeps
-- the login page from being able to authenticate as those admins
-- (and stops their PINs from being shipped to the browser).
--
-- The kept admin's PIN change is intentionally NOT in this file
-- (secrets don't belong in committed migrations) — run the
-- accompanying UPDATE in the Supabase SQL editor.
--
-- NOTE: `ceo` rows are still readable/loginable. Add `, 'ceo'`
-- handling below if you also want to lock those out.
-- ============================================================

alter table public.app_users enable row level security;

drop policy if exists "anon_read_app_users" on public.app_users;

create policy "anon_read_app_users"
  on public.app_users for select
  using (
    role is distinct from 'admin'   -- hide every admin row from the login page
    or name = 'Ashok Rajes'         -- ...except the one kept admin account
  );
