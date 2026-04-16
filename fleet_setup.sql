-- ─── fleet_daily table ────────────────────────────────────────────────────────
-- Run this in your Supabase SQL Editor (Dashboard → SQL Editor → New query)

create table if not exists fleet_daily (
  id                    bigserial    primary key,

  -- Date info
  date                  date         not null,
  month                 smallint     not null,   -- app-computed from date
  year                  smallint     not null,   -- app-computed from date

  -- Vehicle
  vehicle_id            text         not null,
  vehicle_type          text         not null default 'Estate'
                          check (vehicle_type in ('Estate','Personal')),
  account               text         not null default 'BVE'
                          check (account in ('BVE','HFE','ME','ORE','RSE','SE')),
  fuel_type             text         not null default 'Diesel'
                          check (fuel_type in ('Diesel','Petrol')),

  -- Odometer
  starting_km           numeric(10,1) not null default 0,
  closing_km            numeric(10,1) not null default 0,
  km_run                numeric(10,1) not null default 0,   -- closing - starting

  -- Fuel
  fuel_filled_l         numeric(8,2)  not null default 0,
  fuel_cost             numeric(10,2) not null default 0,

  -- Maintenance
  maint_cost            numeric(10,2) not null default 0,
  maintenance_performed text          not null default '',

  -- Derived (app-computed, stored for fast queries)
  total_cost            numeric(10,2) not null default 0,   -- fuel + maint
  avg_mileage           numeric(8,3)  not null default 0,   -- km / litres
  cost_per_km           numeric(8,3)  not null default 0,   -- total / km

  -- Notes
  remarks               text          not null default '',

  -- Uniqueness: one row per vehicle per day
  constraint fleet_daily_date_vehicle_uq unique (date, vehicle_id),

  created_at            timestamptz   not null default now(),
  updated_at            timestamptz   not null default now()
);

-- Auto-update updated_at on edit
create or replace function update_updated_at_column()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists fleet_daily_updated_at on fleet_daily;
create trigger fleet_daily_updated_at
  before update on fleet_daily
  for each row execute procedure update_updated_at_column();

-- Indexes
create index if not exists fleet_daily_date_idx       on fleet_daily (date);
create index if not exists fleet_daily_vehicle_idx    on fleet_daily (vehicle_id);
create index if not exists fleet_daily_year_month_idx on fleet_daily (year, month);
create index if not exists fleet_daily_account_idx    on fleet_daily (account);

-- Row Level Security (same pattern as rainfall table)
alter table fleet_daily enable row level security;

create policy "fleet_daily_public_read"
  on fleet_daily for select using (true);

create policy "fleet_daily_all_write"
  on fleet_daily for all using (true) with check (true);
