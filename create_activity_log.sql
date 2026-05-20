-- ============================================================
-- MSP Coffee — User Activity Log
-- Run in: Supabase Dashboard → SQL Editor
-- ============================================================

create table if not exists public.user_activity (
  id             bigserial primary key,
  user_id        text,
  user_name      text,
  user_role      text,
  page_path      text,
  page_label     text,
  entered_at     timestamptz default now(),
  duration_secs  integer,          -- filled on page exit
  device_type    text,             -- 'mobile' | 'tablet' | 'desktop'
  ip_address     text,
  user_agent     text,
  session_id     text
);

-- Allow the anon key to insert and read (internal tool — security via UI)
alter table public.user_activity enable row level security;
create policy "Allow all" on public.user_activity
  for all using (true) with check (true);

-- Index for fast admin queries
create index user_activity_entered_at_idx on public.user_activity (entered_at desc);
create index user_activity_user_name_idx  on public.user_activity (user_name);
