-- Seed data for LOCAL DEV ONLY (run automatically by `supabase db reset`).
-- Safe, fake data. Do NOT put real PINs, customers, or prices here.

-- ── Test login users (PIN auth) ────────────────────────────────────────
-- Log in at /login by selecting the name and entering the PIN.
insert into public.app_users (name, pin, role, estate, active) values
  ('Admin',      '1234', 'admin',      null,             true),
  ('Manager',    '3333', 'admin',      null,             true),
  ('Supervisor', '1111', 'supervisor', 'Stanmore',       true),
  ('Worker',     '2222', 'worker',     'Stanmore',       true),
  ('CEO',        '9999', 'ceo',        null,             true)
on conflict do nothing;

-- ── Role-level page access defaults (from role_permissions_migration.sql) ──
insert into public.role_permissions (page_href, role, access) values
  ('/rainfall','supervisor','full'), ('/rainfall','worker','full'),
  ('/fuel-expenses','supervisor','full'), ('/fuel-expenses','worker','none'),
  ('/ho-fuel','supervisor','full'), ('/ho-fuel','worker','none'),
  ('/processing-dashboard','supervisor','full'), ('/processing-dashboard','worker','none'),
  ('/harvest-yield','supervisor','full'), ('/harvest-yield','worker','none'),
  ('/ai-insights','supervisor','full'), ('/ai-insights','worker','full')
on conflict (page_href, role) do nothing;

-- ── A little sample data so dashboards render ──────────────────────────
insert into public.rainfall (date, estate, rainfall_mm, inches) values
  (current_date - 2, 'Stanmore', 12.5, 0.49),
  (current_date - 1, 'Stanmore',  8.0, 0.31),
  (current_date,     'Moganad',  20.0, 0.79)
on conflict (date, estate) do nothing;

insert into public.fleet_daily
  (date, month, year, vehicle_id, account, fuel_type, starting_km, closing_km, km_run,
   fuel_filled_l, fuel_cost, total_cost, avg_mileage, cost_per_km)
values
  (current_date - 1, extract(month from current_date - 1), extract(year from current_date - 1),
   'TN-01-AA-1234', 'SE', 'Diesel', 10000, 10120, 120, 15, 1500, 1500, 8.0, 12.5)
on conflict (date, vehicle_id) do nothing;

insert into public.ho_fuel_log
  (date, month, year, transaction_type, fuel_type, source, qty_l, amount, mode_of_payment)
values
  (current_date - 1, extract(month from current_date - 1), extract(year from current_date - 1),
   'PURCHASE', 'DIESEL', 'HP Petrol Bunk', 500, 50000, 'BANK')
on conflict do nothing;

insert into public.cup_scores (lot, name, estate, score, year) values
  ('SE-001', 'Stanmore Natural', 'Stanmore', 86.5, 2025)
on conflict (lot, year, estate) do nothing;
