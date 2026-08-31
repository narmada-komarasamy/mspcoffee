-- Migration: 29999_drift_reconstructed
-- Purpose: Define the tables the app uses that exist ONLY in production (created
--          by hand in the SQL editor or by Google Apps Script) plus column
--          additions that drifted from earlier migrations. Folds in the
--          previously hand-run root .sql files so the schema is reproducible.
--
-- ⚠️  RECONSTRUCTED FROM APP USAGE, NOT FROM A PROD DUMP.
--     Column names/types are inferred from src/ (.insert/.select/.update calls
--     and TS types). Verify against the real prod schema when a dump is
--     available — see supabase/RECONSTRUCTION_NOTES.md. Items marked (VERIFY)
--     are the least certain.
--
-- RLS NOTE: the live app uses PIN auth with the anon key (no Supabase session),
-- so for the app to function the reconstructed tables allow the anon role. This
-- mirrors current prod behaviour; it is NOT the hardened target state (that is
-- handled separately in REMEDIATION.md Phase 2).

-- ════════════════════════════════════════════════════════════════════
--  1. app_users  (live: PIN login + admin user management)
-- ════════════════════════════════════════════════════════════════════
create table if not exists public.app_users (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  pin        text not null,                 -- 4-digit PIN (VERIFY: plain text in prod)
  role       text not null default 'worker' check (role in ('admin','supervisor','worker','ceo')),
  estate     text,
  active     boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists app_users_name_idx on public.app_users (name);

alter table public.app_users enable row level security;
drop policy if exists "anon_read_app_users"  on public.app_users;
drop policy if exists "anon_write_app_users" on public.app_users;
-- Login page reads the list with the anon key (this is the known PIN-exposure
-- issue — see ARCHITECTURE.md §8 / REMEDIATION.md Phase 0).
create policy "anon_read_app_users"  on public.app_users for select to anon, authenticated using (true);
create policy "anon_write_app_users" on public.app_users for all    to anon, authenticated using (true) with check (true);

-- ════════════════════════════════════════════════════════════════════
--  2. user_permissions  (per-user page access overrides; admin UI)
-- ════════════════════════════════════════════════════════════════════
create table if not exists public.user_permissions (
  id         bigserial primary key,
  user_id    uuid not null,                 -- app_users.id (VERIFY fk/type)
  page_href  text not null,
  access     text not null default 'full' check (access in ('none','view','full')),
  updated_at timestamptz not null default now(),
  unique (user_id, page_href)
);
alter table public.user_permissions enable row level security;
drop policy if exists "anon_all_user_permissions" on public.user_permissions;
create policy "anon_all_user_permissions" on public.user_permissions for all to anon, authenticated using (true) with check (true);

-- ════════════════════════════════════════════════════════════════════
--  3. rainfall  (Rain Gauge; also written by Apps Script)
-- ════════════════════════════════════════════════════════════════════
create table if not exists public.rainfall (
  id          bigserial primary key,
  date        date    not null,
  estate      text    not null,
  rainfall_mm numeric not null default 0,
  inches      numeric not null default 0,
  year        smallint,                      -- app/ai-insights read this
  month       smallint,
  created_at  timestamptz not null default now(),
  unique (date, estate)                      -- app upserts onConflict date,estate
);
create index if not exists rainfall_date_idx on public.rainfall (date desc);

-- Populate year/month from date so ai-insights queries work even when the app
-- does not send them (VERIFY: prod may compute these app-side instead).
create or replace function public.rainfall_set_year_month()
returns trigger language plpgsql as $$
begin
  new.year  := extract(year  from new.date);
  new.month := extract(month from new.date);
  return new;
end $$;
drop trigger if exists rainfall_year_month on public.rainfall;
create trigger rainfall_year_month before insert or update on public.rainfall
  for each row execute function public.rainfall_set_year_month();

alter table public.rainfall enable row level security;
drop policy if exists "rainfall_public_read"  on public.rainfall;
drop policy if exists "rainfall_all_write"     on public.rainfall;
create policy "rainfall_public_read" on public.rainfall for select using (true);
create policy "rainfall_all_write"   on public.rainfall for all using (true) with check (true);

-- ════════════════════════════════════════════════════════════════════
--  4. ho_fuel_log  (HO Fuel purchases/issues)
-- ════════════════════════════════════════════════════════════════════
create table if not exists public.ho_fuel_log (
  id               bigserial primary key,
  date             date    not null,
  month            smallint not null,
  year             smallint not null,
  transaction_type text    not null check (transaction_type in ('PURCHASE','ISSUE')),
  fuel_type        text    not null,
  source           text    not null default '',
  vehicle_number   text    not null default '',
  vehicle_name     text    not null default '',
  estate           text    not null default '',
  qty_l            numeric not null default 0,
  amount           numeric not null default 0,
  mode_of_payment  text    not null default '',
  receiver_name    text    not null default '',
  remarks          text    not null default '',
  created_at       timestamptz not null default now()
);
create index if not exists ho_fuel_log_date_idx on public.ho_fuel_log (date desc);
create index if not exists ho_fuel_log_estate_idx on public.ho_fuel_log (estate);

alter table public.ho_fuel_log enable row level security;
drop policy if exists "ho_fuel_log_public_read" on public.ho_fuel_log;
drop policy if exists "ho_fuel_log_all_write"    on public.ho_fuel_log;
create policy "ho_fuel_log_public_read" on public.ho_fuel_log for select using (true);
create policy "ho_fuel_log_all_write"   on public.ho_fuel_log for all using (true) with check (true);

-- ════════════════════════════════════════════════════════════════════
--  5. hilltiller_stock  (Hilltiller green coffee; mirrors green_lots) (VERIFY)
-- ════════════════════════════════════════════════════════════════════
create table if not exists public.hilltiller_stock (
  id            bigserial primary key,       -- (VERIFY: prod id type)
  lot           text    not null default '',
  warehouse     text    not null default '',
  grade         text    not null default '',
  screen        text    not null default '',
  process       text    not null default '',
  field         text    not null default '',
  green_kg_in   numeric not null default 0,
  current_kg    numeric not null default 0,
  rate_per_kg   numeric not null default 0,
  score         numeric,
  date_received date,
  status        text    not null default 'in-stock' check (status in ('in-stock','reserved','depleted')),
  notes         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists hilltiller_stock_status_idx on public.hilltiller_stock (status);

drop trigger if exists hilltiller_stock_updated_at on public.hilltiller_stock;
create trigger hilltiller_stock_updated_at before update on public.hilltiller_stock
  for each row execute function public.set_updated_at();

alter table public.hilltiller_stock enable row level security;
drop policy if exists "hilltiller_stock_read"  on public.hilltiller_stock;
drop policy if exists "hilltiller_stock_write" on public.hilltiller_stock;
create policy "hilltiller_stock_read"  on public.hilltiller_stock for select to anon, authenticated using (true);
create policy "hilltiller_stock_write" on public.hilltiller_stock for all    to anon, authenticated using (true) with check (true);

-- ════════════════════════════════════════════════════════════════════
--  6. export_orders  (Export Operations; columns from TS type ExportOrder)
-- ════════════════════════════════════════════════════════════════════
create table if not exists public.export_orders (
  id            bigserial primary key,
  date          date    not null,
  client        text    not null default '',
  product       text    not null default '',
  qty_kg        numeric not null default 0,
  price         numeric not null default 0,
  currency      text    not null default 'USD',
  contract_date date,
  rate_contract numeric,
  rate_receipt  numeric,
  borrowed      numeric not null default 0,
  date_borrowed date,
  int_rate      numeric not null default 0,
  date_received date,
  credited      numeric not null default 0,
  expenses      numeric not null default 0,
  days          numeric not null default 0,    -- app-computed, stored
  interest      numeric not null default 0,    -- app-computed, stored
  net_profit    numeric not null default 0,    -- app-computed, stored
  created_at    timestamptz not null default now()
);
alter table public.export_orders enable row level security;
drop policy if exists "export_orders_read"  on public.export_orders;
drop policy if exists "export_orders_write" on public.export_orders;
create policy "export_orders_read"  on public.export_orders for select to anon, authenticated using (true);
create policy "export_orders_write" on public.export_orders for all    to anon, authenticated using (true) with check (true);

-- ════════════════════════════════════════════════════════════════════
--  7. role_permissions  (role-level page access; from role_permissions_migration.sql)
-- ════════════════════════════════════════════════════════════════════
create table if not exists public.role_permissions (
  id         bigserial primary key,
  page_href  text not null,
  role       text not null,
  access     text not null default 'full' check (access in ('none','view','full')),
  updated_at timestamptz not null default now(),
  unique (page_href, role)
);
alter table public.role_permissions enable row level security;
drop policy if exists "anon_read_role_permissions"  on public.role_permissions;
drop policy if exists "auth_write_role_permissions" on public.role_permissions;
create policy "anon_read_role_permissions"  on public.role_permissions for select using (true);
create policy "auth_write_role_permissions" on public.role_permissions for all to anon, authenticated using (true) with check (true);

-- ════════════════════════════════════════════════════════════════════
--  8. fleet_daily  (Fleet Fuel Expenses; from fleet_setup.sql)
-- ════════════════════════════════════════════════════════════════════
create table if not exists public.fleet_daily (
  id                    bigserial primary key,
  date                  date not null,
  month                 smallint not null,
  year                  smallint not null,
  vehicle_id            text not null,
  vehicle_type          text not null default 'Estate' check (vehicle_type in ('Estate','Personal')),
  account               text not null default 'BVE' check (account in ('BVE','HFE','ME','ORE','RSE','SE')),
  fuel_type             text not null default 'Diesel' check (fuel_type in ('Diesel','Petrol')),
  starting_km           numeric(10,1) not null default 0,
  closing_km            numeric(10,1) not null default 0,
  km_run                numeric(10,1) not null default 0,
  fuel_filled_l         numeric(8,2)  not null default 0,
  fuel_cost             numeric(10,2) not null default 0,
  maint_cost            numeric(10,2) not null default 0,
  maintenance_performed text not null default '',
  total_cost            numeric(10,2) not null default 0,
  avg_mileage           numeric(8,3)  not null default 0,
  cost_per_km           numeric(8,3)  not null default 0,
  remarks               text not null default '',
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  constraint fleet_daily_date_vehicle_uq unique (date, vehicle_id)
);
create index if not exists fleet_daily_date_idx on public.fleet_daily (date);
drop trigger if exists fleet_daily_updated_at on public.fleet_daily;
create trigger fleet_daily_updated_at before update on public.fleet_daily
  for each row execute procedure public.update_updated_at_column();
alter table public.fleet_daily enable row level security;
drop policy if exists "fleet_daily_public_read" on public.fleet_daily;
drop policy if exists "fleet_daily_all_write"    on public.fleet_daily;
create policy "fleet_daily_public_read" on public.fleet_daily for select using (true);
create policy "fleet_daily_all_write"   on public.fleet_daily for all using (true) with check (true);

-- ════════════════════════════════════════════════════════════════════
--  9. user_activity  (activity tracking; from create_activity_log.sql)
-- ════════════════════════════════════════════════════════════════════
create table if not exists public.user_activity (
  id            bigserial primary key,
  user_id       text,
  user_name     text,
  user_role     text,
  page_path     text,
  page_label    text,
  entered_at    timestamptz default now(),
  duration_secs integer,
  device_type   text,
  ip_address    text,
  user_agent    text,
  session_id    text
);
create index if not exists user_activity_entered_at_idx on public.user_activity (entered_at desc);
alter table public.user_activity enable row level security;
drop policy if exists "user_activity_all" on public.user_activity;
create policy "user_activity_all" on public.user_activity for all using (true) with check (true);

-- ════════════════════════════════════════════════════════════════════
--  10. coffee_sales drift  (columns added in prod after 20260527 migration)
-- ════════════════════════════════════════════════════════════════════
alter table public.coffee_sales add column if not exists invoice_url      text;
alter table public.coffee_sales add column if not exists customer_address text;

-- Allow the anon key on the trading tables so the PIN-auth app can use them.
-- (VERIFY: prod almost certainly has equivalent anon policies that were added by
-- hand — the migrations only grant 'authenticated', which the PIN flow never is.)
do $$
declare t text;
begin
  foreach t in array array['parchment_batches','green_lots','coffee_sales','blends','blend_recipe_items','coffee_audit_log']
  loop
    execute format('drop policy if exists "anon_rw_%1$s" on public.%1$s', t);
    execute format('create policy "anon_rw_%1$s" on public.%1$s for all to anon using (true) with check (true)', t);
  end loop;
end $$;

-- ════════════════════════════════════════════════════════════════════
--  11. invoices storage bucket  (Record Sale invoice uploads)
--      The app uses supabase.storage.from('invoices'); it is a Storage bucket,
--      NOT a table. Create it so uploads work locally.
-- ════════════════════════════════════════════════════════════════════
insert into storage.buckets (id, name, public)
values ('invoices', 'invoices', true)
on conflict (id) do nothing;
