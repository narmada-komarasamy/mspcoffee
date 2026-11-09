-- Filename matches the version applied to the hosted project.
create table public.report_snapshots (
  id uuid primary key,
  reference text not null unique,
  title text not null,
  report_type text not null check (report_type in ('daily','weekly','monthly','quarterly','half_yearly','yearly')),
  period_start date not null,
  period_end date not null check (period_end >= period_start),
  financial_year integer not null,
  modules jsonb not null check (jsonb_typeof(modules) = 'array'),
  snapshot jsonb not null check (jsonb_typeof(snapshot) = 'object'),
  pdf_path text not null unique,
  pdf_sha256 text not null check (pdf_sha256 ~ '^[a-f0-9]{64}$'),
  page_count integer not null check (page_count in (1,2)),
  created_at timestamptz not null default now(),
  created_by text not null,
  check (page_count = 1 or report_type in ('quarterly','half_yearly'))
);
create index report_snapshots_period on public.report_snapshots(financial_year, report_type, period_end desc);
create index report_snapshots_created on public.report_snapshots(created_at desc, id);
alter table public.report_snapshots enable row level security;
revoke all on public.report_snapshots from public, anon, authenticated, service_role;
grant select, insert on public.report_snapshots to service_role;
create function public.protect_report_snapshot() returns trigger
language plpgsql security invoker set search_path = public as $$
begin
  raise exception 'Archived report snapshots cannot be changed or deleted. Generate a new version.';
end;
$$;
revoke all on function public.protect_report_snapshot() from public, anon, authenticated;
create trigger report_snapshot_immutable before update or delete on public.report_snapshots
for each row execute function public.protect_report_snapshot();
insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values ('report-archive', 'report-archive', false, 5242880, array['application/pdf'])
on conflict (id) do nothing;
-- No direct client bucket policies: authenticated server routes enforce access.
