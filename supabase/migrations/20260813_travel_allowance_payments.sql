create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.travel_allowance_payments (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.travel_allowance_employees(id) on delete restrict,
  period_start date not null,
  period_end date not null,
  report_type text not null default 'month'
    check (report_type in ('week', 'month', 'employee', 'custom')),
  events integer not null default 0 check (events >= 0),
  amount numeric(12,2) not null default 0 check (amount >= 0),
  status text not null default 'paid'
    check (status in ('paid', 'unpaid', 'void')),
  paid_at timestamptz,
  paid_by uuid references public.app_users(id) on delete set null,
  receipt_file_name text,
  receipt_file_path text,
  receipt_public_url text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint travel_allowance_payments_period_check check (period_end >= period_start)
);

create unique index if not exists travel_allowance_payments_employee_period_key
  on public.travel_allowance_payments (employee_id, period_start, period_end);

create index if not exists travel_allowance_payments_employee_idx
  on public.travel_allowance_payments (employee_id);

create index if not exists travel_allowance_payments_status_period_idx
  on public.travel_allowance_payments (status, period_start desc);

drop trigger if exists travel_allowance_payments_updated_at on public.travel_allowance_payments;
create trigger travel_allowance_payments_updated_at
  before update on public.travel_allowance_payments
  for each row execute function public.set_updated_at();

alter table public.travel_allowance_payments enable row level security;

drop policy if exists "travel_allowance_payments_select" on public.travel_allowance_payments;
drop policy if exists "travel_allowance_payments_write" on public.travel_allowance_payments;
drop policy if exists "travel_allowance_payments_service_role_all" on public.travel_allowance_payments;

create policy "travel_allowance_payments_service_role_all"
  on public.travel_allowance_payments for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

insert into storage.buckets (id, name, public)
values ('travel-allowance-receipts', 'travel-allowance-receipts', false)
on conflict (id) do nothing;

drop policy if exists "travel_allowance_receipts_select" on storage.objects;
drop policy if exists "travel_allowance_receipts_insert" on storage.objects;
drop policy if exists "travel_allowance_receipts_update" on storage.objects;
drop policy if exists "travel_allowance_receipts_delete" on storage.objects;

create policy "travel_allowance_receipts_select"
  on storage.objects for select
  using (bucket_id = 'travel-allowance-receipts' and auth.role() = 'service_role');

create policy "travel_allowance_receipts_insert"
  on storage.objects for insert
  with check (bucket_id = 'travel-allowance-receipts' and auth.role() = 'service_role');

create policy "travel_allowance_receipts_update"
  on storage.objects for update
  using (bucket_id = 'travel-allowance-receipts' and auth.role() = 'service_role')
  with check (bucket_id = 'travel-allowance-receipts' and auth.role() = 'service_role');

create policy "travel_allowance_receipts_delete"
  on storage.objects for delete
  using (bucket_id = 'travel-allowance-receipts' and auth.role() = 'service_role');
