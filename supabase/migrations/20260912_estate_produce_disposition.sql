-- ============================================================
-- Estate Produce Tracker — Disposition
-- ============================================================

alter table public.estate_produce_records
  add column if not exists disposition text not null default 'Store'
  check (disposition in ('Store', 'Direct Sale', 'Internal Consumption', 'Damaged'));

create index if not exists estate_produce_records_disposition_idx
  on public.estate_produce_records (disposition);
