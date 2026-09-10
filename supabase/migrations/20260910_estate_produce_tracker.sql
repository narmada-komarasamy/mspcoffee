-- ============================================================
-- Estate Produce Tracker — MSP Coffee
-- ============================================================

create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.estate_produce_records (
  id uuid primary key default gen_random_uuid(),
  record_date date not null,
  record_time time,
  estate text not null check (estate in ('ME', 'SE', 'HFE', 'ORD', 'BVE')),
  product text not null,
  unit text not null default 'Pieces'
    check (unit in ('Pieces', 'Kg', 'Boxes', 'Bunches', 'Bags', 'Other')),
  qty numeric(12,3) not null default 0 check (qty >= 0),
  weight_kg numeric(12,3) not null default 0 check (weight_kg >= 0),
  previous_qty numeric(12,3) not null default 0 check (previous_qty >= 0),
  previous_weight_kg numeric(12,3) not null default 0 check (previous_weight_kg >= 0),
  damage_qty numeric(12,3) not null default 0 check (damage_qty >= 0),
  damage_weight_kg numeric(12,3) not null default 0 check (damage_weight_kg >= 0),
  damage_notes text,
  source text not null default 'Manual'
    check (source in ('Manual', 'WhatsApp Paste')),
  source_message text,
  photo_path text,
  photo_file_name text,
  photo_content_type text,
  ai_photo_count jsonb not null default '{}'::jsonb,
  location text,
  notes text,
  follow_up text,
  entered_by uuid references public.app_users(id) on delete set null,
  entered_by_name text,
  updated_by uuid references public.app_users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists estate_produce_records_date_idx
  on public.estate_produce_records (record_date desc);

create index if not exists estate_produce_records_estate_product_date_idx
  on public.estate_produce_records (estate, product, record_date desc);

create index if not exists estate_produce_records_product_date_idx
  on public.estate_produce_records (product, record_date desc);

create index if not exists estate_produce_records_entered_by_idx
  on public.estate_produce_records (entered_by);

drop trigger if exists estate_produce_records_updated_at on public.estate_produce_records;
create trigger estate_produce_records_updated_at
  before update on public.estate_produce_records
  for each row execute function public.set_updated_at();

alter table public.estate_produce_records enable row level security;

drop policy if exists "estate_produce_records_service_role_all" on public.estate_produce_records;
create policy "estate_produce_records_service_role_all"
  on public.estate_produce_records for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

insert into storage.buckets (id, name, public)
values ('estate-produce', 'estate-produce', false)
on conflict (id) do nothing;

drop policy if exists "estate_produce_storage_service_role_all" on storage.objects;
create policy "estate_produce_storage_service_role_all"
  on storage.objects for all
  using (bucket_id = 'estate-produce' and auth.role() = 'service_role')
  with check (bucket_id = 'estate-produce' and auth.role() = 'service_role');
