-- Store uploaded filled/signed application forms against employee records.

alter table public.estate_employees
  add column if not exists application_form_path text,
  add column if not exists application_form_public_url text,
  add column if not exists application_form_file_name text,
  add column if not exists application_form_uploaded_at timestamptz;
