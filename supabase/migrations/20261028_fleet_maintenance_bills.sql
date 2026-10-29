-- Original bills remain private; access is through the authenticated signed URL route.
alter table public.fleet_daily
  add column if not exists maintenance_vendor text not null default '',
  add column if not exists maintenance_bill_path text not null default '',
  add column if not exists maintenance_bill_name text not null default '',
  add column if not exists maintenance_bill_text text not null default '';

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('fleet-maintenance-bills', 'fleet-maintenance-bills', false, 4194304,
  array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
on conflict (id) do update set public = false,
  file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

-- No browser storage policies: upload and download use authenticated server routes.
