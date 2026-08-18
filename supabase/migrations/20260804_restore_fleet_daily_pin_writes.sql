-- Restore Fleet Fuel writes for the current PIN-auth app.
--
-- The dashboard uses application-level PIN auth, not Supabase Auth sessions.
-- Browser writes therefore arrive as the PostgREST anon role. The July 2026
-- lockdown migration removed anon writes, which makes Add/Edit Fleet Record fail
-- with: "new row violates row-level security policy for table fleet_daily".

alter table public.fleet_daily enable row level security;

drop policy if exists "fleet_daily_all_write" on public.fleet_daily;
drop policy if exists "fleet_daily_pin_app_write" on public.fleet_daily;

create policy "fleet_daily_pin_app_write"
  on public.fleet_daily
  for all
  to anon, authenticated
  using (true)
  with check (true);

