-- ============================================================
-- Estate Stock & Storage — MSP Coffee
-- Indent out/in transfers between estates, purchase invoices,
-- and estate stock balances.
-- All data is read/written through /api/estate-stock/* routes
-- using the service_role client; anon/authenticated get no direct
-- table access (same convention as the courier module).
-- ============================================================

create extension if not exists pgcrypto;

-- Reference estate list (drives validation and the UI estate picker).
create table if not exists public.estate_stock_estates (
  code text primary key,
  name text not null unique,
  sort_order int not null default 0
);
insert into public.estate_stock_estates (code, name, sort_order) values
 ('MG','Moganad Estate',1),
 ('ST','Stanmore Estate',2),
 ('STH','Stanmore Hospital',3),
 ('OR','Orchardale Estate',4),
 ('HF','Hidden Falls Estate',5)
on conflict (code) do nothing;

create table if not exists public.estate_stock_items (
  id uuid primary key default gen_random_uuid(),
  estate text not null check (estate in ('Moganad Estate','Stanmore Estate','Stanmore Hospital','Orchardale Estate','Hidden Falls Estate')),
  item text not null,
  unit text not null default 'Nos',
  quantity numeric(12,3) not null default 0 check (quantity >= 0),
  weight_kg numeric(12,3) not null default 0 check (weight_kg >= 0),
  storage_location text,
  status text not null default 'In Stock'
    check (status in ('In Stock','In Transit','Reserved','Maintained','Damaged','Out of Service')),
  notes text,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists estate_stock_items_estate_item_idx
  on public.estate_stock_items (estate, lower(item));

create table if not exists public.estate_stock_indents (
  id uuid primary key default gen_random_uuid(),
  indent_no text not null unique,
  indent_date date not null,
  from_estate text not null check (from_estate in ('Moganad Estate','Stanmore Estate','Stanmore Hospital','Orchardale Estate','Hidden Falls Estate')),
  to_estate text not null check (to_estate in ('Moganad Estate','Stanmore Estate','Stanmore Hospital','Orchardale Estate','Hidden Falls Estate')),
  item text not null,
  quantity numeric(12,3) not null default 0 check (quantity >= 0),
  weight_kg numeric(12,3) not null default 0 check (weight_kg >= 0),
  status text not null default 'In Transit'
    check (status in ('In Transit','Delivered','Settled','Returned','Cancelled')),
  signed_by text,
  received_by text,
  notes text,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (from_estate is distinct from to_estate)
);
create index if not exists estate_stock_indents_status_idx
  on public.estate_stock_indents (status);
create index if not exists estate_stock_indents_route_idx
  on public.estate_stock_indents (from_estate, to_estate, indent_date desc);

create table if not exists public.estate_stock_invoices (
  id uuid primary key default gen_random_uuid(),
  invoice_no text not null,
  invoice_date date not null,
  supplier text not null,
  item text not null,
  estate text not null check (estate in ('Moganad Estate','Stanmore Estate','Stanmore Hospital','Orchardale Estate','Hidden Falls Estate')),
  amount numeric(14,2) not null default 0 check (amount >= 0),
  attachment_path text,
  attachment_name text,
  attachment_content_type text,
  notes text,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists estate_stock_invoices_estate_idx
  on public.estate_stock_invoices (estate, invoice_date desc);
create index if not exists estate_stock_invoices_no_idx
  on public.estate_stock_invoices (lower(invoice_no));

-- Lock down to service_role only, mirroring the courier module.
alter table public.estate_stock_estates enable row level security;
alter table public.estate_stock_items   enable row level security;
alter table public.estate_stock_indents  enable row level security;
alter table public.estate_stock_invoices enable row level security;
revoke all on public.estate_stock_estates, public.estate_stock_items,
                 public.estate_stock_indents, public.estate_stock_invoices
                 from anon, authenticated;
grant all on public.estate_stock_estates, public.estate_stock_items,
              public.estate_stock_indents, public.estate_stock_invoices
              to service_role;

-- Private bucket for scanned purchase bills / indent scans.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('estate-stock-invoices', 'estate-stock-invoices', false, 4194304,
        array['application/pdf','image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;

drop policy if exists "estate_stock_invoices_storage_service_role_all" on storage.objects;
create policy "estate_stock_invoices_storage_service_role_all"
  on storage.objects for all
  using (bucket_id = 'estate-stock-invoices' and auth.role() = 'service_role')
  with check (bucket_id = 'estate-stock-invoices' and auth.role() = 'service_role');
