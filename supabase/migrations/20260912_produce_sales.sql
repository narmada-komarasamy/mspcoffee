-- ============================================================
-- Estate Produce Sales — invoices, customers, and sale tallies
-- ============================================================

create extension if not exists pgcrypto;

create table if not exists public.produce_customers (
  id uuid primary key default gen_random_uuid(),
  phone text not null unique,
  name text not null,
  address text,
  default_dispatch_method text,
  default_payment_mode text
    check (default_payment_mode is null or default_payment_mode in ('Cash', 'UPI', 'Bank', 'Cheque', 'Other')),
  last_sale_at timestamptz,
  created_by uuid references public.app_users(id) on delete set null,
  created_by_name text,
  updated_by uuid references public.app_users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists produce_customers_phone_idx
  on public.produce_customers (phone);

create index if not exists produce_customers_name_idx
  on public.produce_customers (lower(name));

create table if not exists public.produce_sales (
  id uuid primary key default gen_random_uuid(),
  store_item_id uuid references public.produce_store_items(id) on delete set null,
  customer_id uuid references public.produce_customers(id) on delete set null,
  sale_date date not null,
  buyer_name text not null,
  buyer_phone text,
  buyer_address text,
  dispatch_method text,
  estate text not null check (estate in ('ME', 'SE', 'HFE', 'ORD', 'BVE')),
  product text not null,
  pieces_sold numeric(12,3) not null default 0 check (pieces_sold >= 0),
  weight_sold_kg numeric(12,3) not null default 0 check (weight_sold_kg >= 0),
  rate_per_kg numeric(12,2) not null default 0 check (rate_per_kg >= 0),
  produce_amount numeric(12,2) not null default 0 check (produce_amount >= 0),
  courier_packing numeric(12,2) not null default 0 check (courier_packing >= 0),
  total_amount numeric(12,2) not null default 0 check (total_amount >= 0),
  sale_type text not null default 'Charged Sale'
    check (sale_type in ('Charged Sale', 'Complementary', 'Replacement')),
  payment_status text not null default 'Pending'
    check (payment_status in ('Paid', 'Pending', 'Partial')),
  payment_mode text not null default 'Bank'
    check (payment_mode in ('Cash', 'UPI', 'Bank', 'Cheque', 'Other')),
  payment_notes text,
  notes text,
  closed_at timestamptz,
  created_by uuid references public.app_users(id) on delete set null,
  created_by_name text,
  updated_by uuid references public.app_users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists produce_sales_sale_date_idx
  on public.produce_sales (sale_date desc);

create index if not exists produce_sales_store_item_idx
  on public.produce_sales (store_item_id);

create index if not exists produce_sales_customer_idx
  on public.produce_sales (customer_id);

create index if not exists produce_sales_payment_status_idx
  on public.produce_sales (payment_status);

create index if not exists produce_sales_sale_type_idx
  on public.produce_sales (sale_type);

drop trigger if exists produce_customers_updated_at on public.produce_customers;
create trigger produce_customers_updated_at
  before update on public.produce_customers
  for each row execute function public.set_updated_at();

drop trigger if exists produce_sales_updated_at on public.produce_sales;
create trigger produce_sales_updated_at
  before update on public.produce_sales
  for each row execute function public.set_updated_at();

alter table public.produce_customers enable row level security;
alter table public.produce_sales enable row level security;

drop policy if exists "produce_customers_service_role_all" on public.produce_customers;
create policy "produce_customers_service_role_all"
  on public.produce_customers for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

drop policy if exists "produce_sales_service_role_all" on public.produce_sales;
create policy "produce_sales_service_role_all"
  on public.produce_sales for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');
