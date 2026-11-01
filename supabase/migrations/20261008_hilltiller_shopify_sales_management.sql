-- HillTiller Coffee Sales Management foundation.
-- Phase 1 creates read-only Shopify mirror tables and settings placeholders.

create table if not exists public.hilltiller_shopify_connections (
  id bigint generated always as identity primary key,
  shop_domain text not null unique,
  display_name text not null default 'HillTiller Coffee Roasters',
  connection_status text not null default 'not_connected'
    check (connection_status in ('not_connected', 'pending', 'connected', 'error', 'disabled')),
  api_version text,
  last_sync_at timestamptz,
  last_error text,
  scopes text[] not null default '{}',
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.hilltiller_shopify_customers (
  id bigint generated always as identity primary key,
  connection_id bigint not null references public.hilltiller_shopify_connections(id) on delete cascade,
  shopify_customer_gid text not null,
  email text,
  phone text,
  first_name text,
  last_name text,
  orders_count integer not null default 0,
  total_spent numeric(14, 2) not null default 0,
  currency_code text not null default 'INR',
  tags text[] not null default '{}',
  accepts_marketing boolean,
  first_order_at timestamptz,
  last_order_at timestamptz,
  raw_payload jsonb not null default '{}'::jsonb,
  synced_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (connection_id, shopify_customer_gid)
);

create table if not exists public.hilltiller_shopify_products (
  id bigint generated always as identity primary key,
  connection_id bigint not null references public.hilltiller_shopify_connections(id) on delete cascade,
  shopify_product_gid text not null,
  title text not null,
  vendor text,
  product_type text,
  status text,
  handle text,
  tags text[] not null default '{}',
  published_at timestamptz,
  raw_payload jsonb not null default '{}'::jsonb,
  synced_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (connection_id, shopify_product_gid)
);

create table if not exists public.hilltiller_shopify_variants (
  id bigint generated always as identity primary key,
  connection_id bigint not null references public.hilltiller_shopify_connections(id) on delete cascade,
  product_id bigint references public.hilltiller_shopify_products(id) on delete cascade,
  shopify_variant_gid text not null,
  title text not null,
  sku text,
  barcode text,
  weight_label text,
  option_values jsonb not null default '{}'::jsonb,
  price numeric(14, 2),
  compare_at_price numeric(14, 2),
  inventory_quantity integer,
  inventory_policy text,
  raw_payload jsonb not null default '{}'::jsonb,
  synced_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (connection_id, shopify_variant_gid)
);

create table if not exists public.hilltiller_shopify_orders (
  id bigint generated always as identity primary key,
  connection_id bigint not null references public.hilltiller_shopify_connections(id) on delete cascade,
  customer_id bigint references public.hilltiller_shopify_customers(id) on delete set null,
  shopify_order_gid text not null,
  order_number text,
  name text,
  source_name text,
  channel text not null default 'unknown'
    check (channel in ('online', 'pos', 'draft', 'unknown')),
  financial_status text,
  fulfillment_status text,
  currency_code text not null default 'INR',
  subtotal_price numeric(14, 2) not null default 0,
  total_discounts numeric(14, 2) not null default 0,
  total_tax numeric(14, 2) not null default 0,
  total_shipping numeric(14, 2) not null default 0,
  total_refunded numeric(14, 2) not null default 0,
  total_price numeric(14, 2) not null default 0,
  net_sales numeric(14, 2) not null default 0,
  payment_gateway_names text[] not null default '{}',
  processed_at timestamptz,
  cancelled_at timestamptz,
  closed_at timestamptz,
  raw_payload jsonb not null default '{}'::jsonb,
  synced_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (connection_id, shopify_order_gid)
);

create table if not exists public.hilltiller_shopify_order_line_items (
  id bigint generated always as identity primary key,
  connection_id bigint not null references public.hilltiller_shopify_connections(id) on delete cascade,
  order_id bigint not null references public.hilltiller_shopify_orders(id) on delete cascade,
  product_id bigint references public.hilltiller_shopify_products(id) on delete set null,
  variant_id bigint references public.hilltiller_shopify_variants(id) on delete set null,
  shopify_line_item_gid text not null,
  title text not null,
  variant_title text,
  sku text,
  weight_label text,
  quantity integer not null default 0,
  unit_price numeric(14, 2) not null default 0,
  total_discount numeric(14, 2) not null default 0,
  total_tax numeric(14, 2) not null default 0,
  gross_sales numeric(14, 2) not null default 0,
  net_sales numeric(14, 2) not null default 0,
  raw_payload jsonb not null default '{}'::jsonb,
  synced_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (connection_id, shopify_line_item_gid)
);

create table if not exists public.hilltiller_shopify_inventory_levels (
  id bigint generated always as identity primary key,
  connection_id bigint not null references public.hilltiller_shopify_connections(id) on delete cascade,
  variant_id bigint references public.hilltiller_shopify_variants(id) on delete cascade,
  shopify_inventory_item_gid text not null,
  shopify_location_gid text not null,
  location_name text,
  available_quantity integer not null default 0,
  low_stock_unit_threshold integer,
  low_stock_days_threshold numeric(8, 2),
  raw_payload jsonb not null default '{}'::jsonb,
  synced_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (connection_id, shopify_inventory_item_gid, shopify_location_gid)
);

create table if not exists public.hilltiller_shopify_refunds (
  id bigint generated always as identity primary key,
  connection_id bigint not null references public.hilltiller_shopify_connections(id) on delete cascade,
  order_id bigint references public.hilltiller_shopify_orders(id) on delete cascade,
  shopify_refund_gid text not null,
  refund_date timestamptz,
  amount numeric(14, 2) not null default 0,
  tax_amount numeric(14, 2) not null default 0,
  currency_code text not null default 'INR',
  note text,
  raw_payload jsonb not null default '{}'::jsonb,
  synced_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (connection_id, shopify_refund_gid)
);

create table if not exists public.hilltiller_shopify_transactions (
  id bigint generated always as identity primary key,
  connection_id bigint not null references public.hilltiller_shopify_connections(id) on delete cascade,
  order_id bigint references public.hilltiller_shopify_orders(id) on delete cascade,
  shopify_transaction_gid text not null,
  gateway text,
  kind text,
  status text,
  amount numeric(14, 2) not null default 0,
  fees numeric(14, 2),
  currency_code text not null default 'INR',
  processed_at timestamptz,
  raw_payload jsonb not null default '{}'::jsonb,
  synced_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (connection_id, shopify_transaction_gid)
);

create table if not exists public.hilltiller_sales_report_recipients (
  id bigint generated always as identity primary key,
  name text not null,
  email text not null,
  is_active boolean not null default true,
  report_frequency text not null default 'daily'
    check (report_frequency in ('daily', 'weekly')),
  send_time time not null default '11:00',
  timezone text not null default 'Asia/Kolkata',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (email)
);

create table if not exists public.hilltiller_sales_alert_settings (
  id bigint generated always as identity primary key,
  alert_key text not null unique,
  label text not null,
  is_enabled boolean not null default true,
  unit_threshold integer,
  days_threshold numeric(8, 2),
  amount_threshold numeric(14, 2),
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.hilltiller_sales_sync_runs (
  id bigint generated always as identity primary key,
  connection_id bigint references public.hilltiller_shopify_connections(id) on delete cascade,
  sync_type text not null
    check (sync_type in ('historical_import', 'incremental', 'webhook', 'manual_check')),
  status text not null default 'queued'
    check (status in ('queued', 'running', 'succeeded', 'failed', 'cancelled')),
  started_at timestamptz,
  finished_at timestamptz,
  records_processed integer not null default 0,
  error_message text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.hilltiller_sales_import_batches (
  id bigint generated always as identity primary key,
  source text not null default 'csv_upload'
    check (source in ('csv_upload', 'shopify_api')),
  status text not null default 'saved'
    check (status in ('draft', 'saved', 'failed')),
  summary jsonb not null default '{}'::jsonb,
  imported_by text,
  imported_by_name text,
  created_at timestamptz not null default now()
);

create table if not exists public.hilltiller_sales_import_files (
  id bigint generated always as identity primary key,
  batch_id bigint not null references public.hilltiller_sales_import_batches(id) on delete cascade,
  file_kind text not null
    check (file_kind in ('orders', 'transactions', 'products', 'inventory')),
  file_name text not null,
  row_count integer not null default 0,
  column_count integer not null default 0,
  rows jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  unique (batch_id, file_kind)
);

create index if not exists hilltiller_customers_connection_idx on public.hilltiller_shopify_customers (connection_id);
create index if not exists hilltiller_products_connection_idx on public.hilltiller_shopify_products (connection_id);
create index if not exists hilltiller_variants_connection_product_idx on public.hilltiller_shopify_variants (connection_id, product_id);
create index if not exists hilltiller_variants_sku_idx on public.hilltiller_shopify_variants (sku);
create index if not exists hilltiller_orders_connection_processed_idx on public.hilltiller_shopify_orders (connection_id, processed_at desc);
create index if not exists hilltiller_orders_channel_processed_idx on public.hilltiller_shopify_orders (channel, processed_at desc);
create index if not exists hilltiller_orders_customer_idx on public.hilltiller_shopify_orders (customer_id);
create index if not exists hilltiller_line_items_order_idx on public.hilltiller_shopify_order_line_items (order_id);
create index if not exists hilltiller_line_items_variant_idx on public.hilltiller_shopify_order_line_items (variant_id);
create index if not exists hilltiller_inventory_variant_idx on public.hilltiller_shopify_inventory_levels (variant_id);
create index if not exists hilltiller_refunds_order_idx on public.hilltiller_shopify_refunds (order_id);
create index if not exists hilltiller_refunds_date_idx on public.hilltiller_shopify_refunds (refund_date desc);
create index if not exists hilltiller_transactions_order_idx on public.hilltiller_shopify_transactions (order_id);
create index if not exists hilltiller_sync_runs_connection_idx on public.hilltiller_sales_sync_runs (connection_id, created_at desc);
create index if not exists hilltiller_import_batches_created_idx on public.hilltiller_sales_import_batches (created_at desc);
create index if not exists hilltiller_import_files_batch_idx on public.hilltiller_sales_import_files (batch_id);
create index if not exists hilltiller_import_files_kind_idx on public.hilltiller_sales_import_files (file_kind);

create or replace function public.current_profile_is_active()
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  has_active_column boolean;
  is_active boolean;
begin
  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'profiles'
      and column_name = 'active'
  )
  into has_active_column;

  if has_active_column then
    execute 'select exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.active is not false)'
    into is_active;
  else
    select exists (
      select 1
      from public.profiles p
      where p.id = (select auth.uid())
    )
    into is_active;
  end if;

  return is_active;
end;
$$;

create or replace function public.current_profile_has_any_role(allowed_roles text[])
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  has_active_column boolean;
  has_role boolean;
begin
  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'profiles'
      and column_name = 'active'
  )
  into has_active_column;

  if has_active_column then
    execute 'select exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.active is not false and p.role = any ($1))'
    using allowed_roles
    into has_role;
  else
    select exists (
      select 1
      from public.profiles p
      where p.id = (select auth.uid())
        and p.role = any (allowed_roles)
    )
    into has_role;
  end if;

  return has_role;
end;
$$;

revoke all on function public.current_profile_is_active() from public;
revoke all on function public.current_profile_has_any_role(text[]) from public;
grant execute on function public.current_profile_is_active() to authenticated;
grant execute on function public.current_profile_has_any_role(text[]) to authenticated;

alter table public.hilltiller_shopify_connections enable row level security;
alter table public.hilltiller_shopify_customers enable row level security;
alter table public.hilltiller_shopify_products enable row level security;
alter table public.hilltiller_shopify_variants enable row level security;
alter table public.hilltiller_shopify_orders enable row level security;
alter table public.hilltiller_shopify_order_line_items enable row level security;
alter table public.hilltiller_shopify_inventory_levels enable row level security;
alter table public.hilltiller_shopify_refunds enable row level security;
alter table public.hilltiller_shopify_transactions enable row level security;
alter table public.hilltiller_sales_report_recipients enable row level security;
alter table public.hilltiller_sales_alert_settings enable row level security;
alter table public.hilltiller_sales_sync_runs enable row level security;
alter table public.hilltiller_sales_import_batches enable row level security;
alter table public.hilltiller_sales_import_files enable row level security;

insert into public.hilltiller_shopify_connections (shop_domain, display_name, connection_status, scopes)
values (
  'hilltiller.com',
  'HillTiller Coffee Roasters',
  'not_connected',
  array[
    'read_orders',
    'read_all_orders',
    'read_products',
    'read_inventory',
    'read_customers',
    'read_discounts',
    'read_fulfillments',
    'read_locations'
  ]
)
on conflict (shop_domain) do nothing;

insert into public.hilltiller_sales_alert_settings (alert_key, label, unit_threshold, days_threshold)
values
  ('low_stock_units', 'Low stock by units', 10, null),
  ('low_stock_days', 'Low stock by days of cover', null, 7),
  ('refund_spike', 'Refund spike', null, null),
  ('unfulfilled_aging', 'Unfulfilled order aging', null, null)
on conflict (alert_key) do nothing;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'hilltiller_shopify_connections',
    'hilltiller_shopify_customers',
    'hilltiller_shopify_products',
    'hilltiller_shopify_variants',
    'hilltiller_shopify_orders',
    'hilltiller_shopify_order_line_items',
    'hilltiller_shopify_inventory_levels',
    'hilltiller_shopify_refunds',
    'hilltiller_shopify_transactions',
    'hilltiller_sales_report_recipients',
    'hilltiller_sales_alert_settings',
    'hilltiller_sales_sync_runs',
    'hilltiller_sales_import_batches',
    'hilltiller_sales_import_files'
  ]
  loop
    execute format('drop policy if exists "%s_admin_all" on public.%I', table_name, table_name);
    execute format(
      'create policy "%s_admin_all" on public.%I for all to authenticated using ((select public.current_profile_has_any_role(array[''admin'']))) with check ((select public.current_profile_has_any_role(array[''admin''])))',
      table_name,
      table_name
    );
  end loop;
end $$;
