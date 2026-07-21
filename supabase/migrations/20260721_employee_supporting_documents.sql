-- ============================================================
-- Estate Employee Registry — Supporting Documents
-- ============================================================

create extension if not exists pgcrypto;

create table if not exists public.estate_employee_documents (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.estate_employees (id) on delete cascade,
  document_type text not null
    check (
      document_type in (
        'aadhaar',
        'pan',
        'bank-account-check',
        'other-document',
        'short-term-break-letter',
        'long-term-break-letter',
        'other-letter-record'
      )
    ),
  file_name text not null,
  file_path text not null,
  public_url text not null,
  content_type text,
  file_size bigint,
  uploaded_by text,
  uploaded_at timestamptz not null default now()
);

create index if not exists estate_employee_documents_employee_type_idx
  on public.estate_employee_documents (employee_id, document_type);

create index if not exists estate_employee_documents_uploaded_at_idx
  on public.estate_employee_documents (uploaded_at desc);

alter table public.estate_employee_documents enable row level security;

drop policy if exists "estate_employee_documents_all" on public.estate_employee_documents;

create policy "estate_employee_documents_all"
  on public.estate_employee_documents for all to anon, authenticated using (true) with check (true);
