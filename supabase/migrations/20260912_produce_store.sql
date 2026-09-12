-- ============================================================
-- Estate Produce Store — fruit and bulk stock catalogue
-- ============================================================

create extension if not exists pgcrypto;

create table if not exists public.produce_store_items (
  id uuid primary key default gen_random_uuid(),
  source_record_id uuid references public.estate_produce_records(id) on delete set null,
  item_code text not null unique,
  received_date date not null,
  estate text not null check (estate in ('ME', 'SE', 'HFE', 'ORD', 'BVE')),
  product text not null,
  unit text not null default 'Pieces'
    check (unit in ('Pieces', 'Kg', 'Boxes', 'Bunches', 'Bags', 'Other')),
  quantity numeric(12,3) not null default 1 check (quantity >= 0),
  weight_kg numeric(12,3) not null default 0 check (weight_kg >= 0),
  condition_grade text,
  storage_location text,
  photo_path text,
  photo_file_name text,
  photo_content_type text,
  status text not null default 'In Store'
    check (status in ('In Store', 'Reserved', 'Sold', 'Internal Consumption', 'Damaged', 'Cold Storage')),
  notes text,
  created_by uuid references public.app_users(id) on delete set null,
  created_by_name text,
  updated_by uuid references public.app_users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists produce_store_items_status_idx
  on public.produce_store_items (status);

create index if not exists produce_store_items_estate_product_status_idx
  on public.produce_store_items (estate, product, status);

create index if not exists produce_store_items_received_date_idx
  on public.produce_store_items (received_date desc);

create table if not exists public.produce_store_movements (
  id uuid primary key default gen_random_uuid(),
  store_item_id uuid not null references public.produce_store_items(id) on delete cascade,
  movement_date timestamptz not null default now(),
  movement_type text not null
    check (movement_type in ('Created', 'Status Change', 'Location Change', 'Adjustment')),
  from_status text,
  to_status text,
  from_location text,
  to_location text,
  notes text,
  actor_id uuid references public.app_users(id) on delete set null,
  actor_name text,
  created_at timestamptz not null default now()
);

create index if not exists produce_store_movements_item_date_idx
  on public.produce_store_movements (store_item_id, movement_date desc);

drop trigger if exists produce_store_items_updated_at on public.produce_store_items;
create trigger produce_store_items_updated_at
  before update on public.produce_store_items
  for each row execute function public.set_updated_at();

alter table public.produce_store_items enable row level security;
alter table public.produce_store_movements enable row level security;

drop policy if exists "produce_store_items_service_role_all" on public.produce_store_items;
create policy "produce_store_items_service_role_all"
  on public.produce_store_items for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

drop policy if exists "produce_store_movements_service_role_all" on public.produce_store_movements;
create policy "produce_store_movements_service_role_all"
  on public.produce_store_movements for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');
