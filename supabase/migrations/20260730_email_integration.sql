create table if not exists public.email_contacts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  organization text,
  contact_type text not null default 'partner',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.app_users(id) on delete set null,
  constraint email_contacts_email_check check (email ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'),
  constraint email_contacts_type_check check (contact_type in ('manager', 'partner', 'customer', 'supplier', 'internal', 'other'))
);

create unique index if not exists email_contacts_email_key
  on public.email_contacts (lower(email));

create table if not exists public.email_delivery_log (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  requested_by uuid references public.app_users(id) on delete set null,
  email_type text not null,
  source_path text not null,
  subject text not null,
  from_address text not null,
  recipients text[] not null,
  cc text[] not null default '{}',
  status text not null default 'queued',
  provider text,
  provider_message_id text,
  error_message text,
  note text,
  payload jsonb not null default '{}'::jsonb,
  provider_response jsonb,
  constraint email_delivery_log_type_check check (
    email_type in ('production_report', 'sales_inventory_summary', 'order_notification', 'alert', 'custom_report')
  ),
  constraint email_delivery_log_status_check check (status in ('queued', 'sent', 'failed', 'logged'))
);

create index if not exists email_delivery_log_created_at_idx
  on public.email_delivery_log (created_at desc);

create index if not exists email_delivery_log_status_idx
  on public.email_delivery_log (status);

create table if not exists public.email_schedules (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email_type text not null,
  source_path text not null,
  frequency text not null,
  send_time time not null,
  timezone text not null default 'Asia/Kolkata',
  recipients text[] not null,
  cc text[] not null default '{}',
  active boolean not null default true,
  last_sent_at timestamptz,
  next_run_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.app_users(id) on delete set null,
  constraint email_schedules_type_check check (
    email_type in ('production_report', 'sales_inventory_summary', 'order_notification', 'alert', 'custom_report')
  ),
  constraint email_schedules_frequency_check check (frequency in ('daily', 'weekly', 'monthly'))
);

create index if not exists email_schedules_next_run_idx
  on public.email_schedules (next_run_at)
  where active = true;

alter table public.email_contacts enable row level security;
alter table public.email_delivery_log enable row level security;
alter table public.email_schedules enable row level security;

drop policy if exists "email_contacts_service_role_all" on public.email_contacts;
create policy "email_contacts_service_role_all"
  on public.email_contacts
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

drop policy if exists "email_delivery_log_service_role_all" on public.email_delivery_log;
create policy "email_delivery_log_service_role_all"
  on public.email_delivery_log
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

drop policy if exists "email_schedules_service_role_all" on public.email_schedules;
create policy "email_schedules_service_role_all"
  on public.email_schedules
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');
