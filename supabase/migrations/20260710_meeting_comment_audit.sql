-- Track who last edited the minutes/comment fields on meeting records.

alter table public.board_meetings
  add column if not exists minutes_updated_by text,
  add column if not exists minutes_updated_at timestamptz;

alter table public.estate_staff_meetings
  add column if not exists minutes_updated_by text,
  add column if not exists minutes_updated_at timestamptz;
