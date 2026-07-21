-- ============================================================
-- Estate Employee Registry — Document Notes
-- ============================================================

create extension if not exists pgcrypto;

create table if not exists public.estate_employee_document_notes (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.estate_employees (id) on delete cascade,
  note_text text not null,
  author_id text,
  author_name text not null,
  attachment_file_name text,
  attachment_file_path text,
  attachment_public_url text,
  attachment_content_type text,
  attachment_file_size bigint,
  created_at timestamptz not null default now()
);

create index if not exists estate_employee_document_notes_employee_created_idx
  on public.estate_employee_document_notes (employee_id, created_at desc);

alter table public.estate_employee_document_notes enable row level security;

drop policy if exists "estate_employee_document_notes_all" on public.estate_employee_document_notes;

create policy "estate_employee_document_notes_all"
  on public.estate_employee_document_notes for all to anon, authenticated using (true) with check (true);
