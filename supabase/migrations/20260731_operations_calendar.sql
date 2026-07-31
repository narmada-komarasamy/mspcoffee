-- ============================================================
-- Operations Calendar — MSP Coffee
-- ============================================================

create table if not exists public.operations_calendar_events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  event_date date not null,
  start_time time,
  end_time time,
  estate text not null default 'All Estates',
  owner text,
  event_type text not null default 'schedule'
    check (event_type in ('schedule', 'report', 'email', 'timeline')),
  status text not null default 'scheduled'
    check (status in ('scheduled', 'queued', 'sent', 'risk', 'draft', 'cancelled', 'completed')),
  report_href text,
  email_href text,
  reminder text,
  notes text,
  conflict_note text,
  recurrence_rule text,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references public.app_users(id) on delete set null,
  updated_by uuid references public.app_users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint operations_calendar_event_time_check check (
    start_time is null
    or end_time is null
    or end_time >= start_time
  ),
  constraint operations_calendar_report_href_check check (
    report_href is null or report_href like '/%'
  ),
  constraint operations_calendar_email_href_check check (
    email_href is null or email_href like '/%'
  )
);

create index if not exists operations_calendar_events_date_idx
  on public.operations_calendar_events (event_date, start_time);

create index if not exists operations_calendar_events_type_date_idx
  on public.operations_calendar_events (event_type, event_date);

create index if not exists operations_calendar_events_status_date_idx
  on public.operations_calendar_events (status, event_date);

create index if not exists operations_calendar_events_created_by_idx
  on public.operations_calendar_events (created_by);

create index if not exists operations_calendar_events_conflicts_idx
  on public.operations_calendar_events (event_date)
  where status = 'risk';

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists operations_calendar_events_updated_at on public.operations_calendar_events;
create trigger operations_calendar_events_updated_at
  before update on public.operations_calendar_events
  for each row execute function public.set_updated_at();

alter table public.operations_calendar_events enable row level security;

drop policy if exists "operations_calendar_events_service_role_all" on public.operations_calendar_events;
create policy "operations_calendar_events_service_role_all"
  on public.operations_calendar_events
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');
