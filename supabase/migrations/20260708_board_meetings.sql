-- ============================================================
-- Board Meetings — MSP Coffee Trading Management
-- ============================================================

create table if not exists public.board_meetings (
  id uuid primary key default gen_random_uuid(),
  meeting_date date not null default current_date,
  meeting_type text not null default 'Board Meeting',
  title text not null default 'Board Meeting',
  start_time time,
  end_time time,
  location text,
  quorum_status text not null default 'pending'
    check (quorum_status in ('pending', 'met', 'not-met', 'not-required')),
  confidentiality text not null default 'board-restricted'
    check (confidentiality in ('open', 'internal', 'board-restricted', 'confidential')),
  agenda_summary text,
  minutes_draft text,
  decisions text,
  approval_status text not null default 'draft'
    check (approval_status in ('draft', 'in-review', 'approved', 'signed')),
  minute_owner text,
  reviewer text,
  approver text,
  approval_date date,
  next_meeting_date date,
  next_meeting_time time,
  next_meeting_location text,
  next_meeting_agenda text,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.board_meeting_participants (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references public.board_meetings (id) on delete cascade,
  name text not null,
  role text,
  attendance_status text not null default 'present'
    check (attendance_status in ('present', 'apology', 'invitee', 'absent')),
  conflict_declared boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.board_meeting_agenda_items (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references public.board_meetings (id) on delete cascade,
  item_no integer not null default 1,
  topic text not null,
  presenter text,
  time_minutes integer,
  status text not null default 'pending'
    check (status in ('pending', 'discussed', 'deferred', 'approved')),
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.board_meeting_actions (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references public.board_meetings (id) on delete cascade,
  action_text text not null,
  assigned_to text not null,
  due_date date,
  status text not null default 'open'
    check (status in ('open', 'in-progress', 'blocked', 'completed')),
  priority text not null default 'medium'
    check (priority in ('low', 'medium', 'high', 'critical')),
  progress integer not null default 0 check (progress >= 0 and progress <= 100),
  closure_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.board_meeting_files (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references public.board_meetings (id) on delete cascade,
  file_type text not null
    check (file_type in ('board-pack', 'audio', 'minutes-draft', 'signed-minutes', 'attachment')),
  file_name text not null,
  file_path text not null,
  public_url text,
  content_type text,
  file_size bigint,
  uploaded_by text,
  created_at timestamptz not null default now()
);

create index if not exists board_meetings_date_idx
  on public.board_meetings (meeting_date desc);
create index if not exists board_meetings_status_idx
  on public.board_meetings (approval_status);
create index if not exists board_meetings_next_meeting_idx
  on public.board_meetings (next_meeting_date)
  where next_meeting_date is not null;

create index if not exists board_meeting_participants_meeting_idx
  on public.board_meeting_participants (meeting_id);
create index if not exists board_meeting_agenda_items_meeting_idx
  on public.board_meeting_agenda_items (meeting_id, item_no);
create index if not exists board_meeting_actions_meeting_idx
  on public.board_meeting_actions (meeting_id);
create index if not exists board_meeting_actions_status_due_idx
  on public.board_meeting_actions (status, due_date);
create index if not exists board_meeting_files_meeting_idx
  on public.board_meeting_files (meeting_id, file_type);

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists board_meetings_updated_at on public.board_meetings;
create trigger board_meetings_updated_at
  before update on public.board_meetings
  for each row execute function public.set_updated_at();

drop trigger if exists board_meeting_actions_updated_at on public.board_meeting_actions;
create trigger board_meeting_actions_updated_at
  before update on public.board_meeting_actions
  for each row execute function public.set_updated_at();

alter table public.board_meetings enable row level security;
alter table public.board_meeting_participants enable row level security;
alter table public.board_meeting_agenda_items enable row level security;
alter table public.board_meeting_actions enable row level security;
alter table public.board_meeting_files enable row level security;

drop policy if exists "board_meetings_select" on public.board_meetings;
drop policy if exists "board_meetings_insert" on public.board_meetings;
drop policy if exists "board_meetings_update" on public.board_meetings;
drop policy if exists "board_meetings_delete" on public.board_meetings;
drop policy if exists "board_meeting_participants_all" on public.board_meeting_participants;
drop policy if exists "board_meeting_agenda_items_all" on public.board_meeting_agenda_items;
drop policy if exists "board_meeting_actions_all" on public.board_meeting_actions;
drop policy if exists "board_meeting_files_all" on public.board_meeting_files;

create policy "board_meetings_select"
  on public.board_meetings for select to anon, authenticated using (true);
create policy "board_meetings_insert"
  on public.board_meetings for insert to anon, authenticated with check (true);
create policy "board_meetings_update"
  on public.board_meetings for update to anon, authenticated using (true) with check (true);
create policy "board_meetings_delete"
  on public.board_meetings for delete to anon, authenticated using (true);

create policy "board_meeting_participants_all"
  on public.board_meeting_participants for all to anon, authenticated using (true) with check (true);
create policy "board_meeting_agenda_items_all"
  on public.board_meeting_agenda_items for all to anon, authenticated using (true) with check (true);
create policy "board_meeting_actions_all"
  on public.board_meeting_actions for all to anon, authenticated using (true) with check (true);
create policy "board_meeting_files_all"
  on public.board_meeting_files for all to anon, authenticated using (true) with check (true);

insert into storage.buckets (id, name, public)
values ('board-meetings', 'board-meetings', true)
on conflict (id) do nothing;

drop policy if exists "board_meetings_storage_select" on storage.objects;
drop policy if exists "board_meetings_storage_insert" on storage.objects;
drop policy if exists "board_meetings_storage_update" on storage.objects;
drop policy if exists "board_meetings_storage_delete" on storage.objects;

create policy "board_meetings_storage_select"
  on storage.objects for select to anon, authenticated
  using (bucket_id = 'board-meetings');
create policy "board_meetings_storage_insert"
  on storage.objects for insert to anon, authenticated
  with check (bucket_id = 'board-meetings');
create policy "board_meetings_storage_update"
  on storage.objects for update to anon, authenticated
  using (bucket_id = 'board-meetings')
  with check (bucket_id = 'board-meetings');
create policy "board_meetings_storage_delete"
  on storage.objects for delete to anon, authenticated
  using (bucket_id = 'board-meetings');
