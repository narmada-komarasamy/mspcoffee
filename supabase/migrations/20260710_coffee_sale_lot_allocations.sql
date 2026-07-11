alter table public.coffee_sales
  add column if not exists lot_allocations jsonb not null default '[]'::jsonb;

create index if not exists coffee_sales_lot_allocations_gin_idx
  on public.coffee_sales using gin (lot_allocations);
