alter table public.green_lots
  add column if not exists season text not null default '2024-2025';

alter table public.coffee_sales
  add column if not exists invoice_url text,
  add column if not exists customer_address text,
  add column if not exists lot_allocations jsonb not null default '[]'::jsonb;

create index if not exists green_lots_season_idx
  on public.green_lots (season);

create index if not exists coffee_sales_lot_allocations_gin_idx
  on public.coffee_sales using gin (lot_allocations);

alter table public.coffee_sales
  drop constraint if exists coffee_sales_status_check;

alter table public.coffee_sales
  add constraint coffee_sales_status_check
  check (status in ('pending', 'shipped', 'transferred', 'cancelled'));
