-- ============================================================
-- Estate Employee Registry — Employee Center / Muster Roll
-- ============================================================

create extension if not exists pgcrypto;

create table if not exists public.estate_employees (
  id uuid primary key default gen_random_uuid(),
  estate_name text not null default 'Stanmore Estate',
  employee_code text,
  status text not null default 'applicant'
    check (status in ('applicant', 'active', 'inactive', 'left')),

  full_name text not null,
  parent_spouse_name text,
  date_of_birth date,
  age integer check (age is null or (age >= 0 and age <= 120)),
  gender text check (gender is null or gender in ('M', 'F', 'Other')),
  marital_status text check (marital_status is null or marital_status in ('Single', 'Married', 'Widowed', 'Divorced')),
  aadhaar_number text,
  pan_number text,
  mobile_number text,
  alternate_contact text,
  reference_name text,
  permanent_address text,
  current_address text,

  date_of_joining date,
  job_role text,
  section_division text,
  daily_wage numeric(12,2),
  wage_text text,
  payment_mode text check (payment_mode is null or payment_mode in ('Cash', 'Bank')),
  bank_account_number text,
  ifsc_code text,
  previous_experience_years numeric(5,2),
  experience_text text,
  education_level text,
  epf_uan text,
  esi_number text,

  emergency_contact_name_relation text,
  emergency_contact_number text,
  blood_group text check (blood_group is null or blood_group in ('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-')),
  medical_conditions text,
  nominee_name text,
  nominee_relation text,

  employee_signature_date date,
  hr_signature_date date,
  md_signature_date date,

  photo_path text,
  photo_public_url text,
  application_form_path text,
  application_form_public_url text,
  application_form_file_name text,
  application_form_uploaded_at timestamptz,
  created_by text,
  updated_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.estate_employee_family_members (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.estate_employees (id) on delete cascade,
  sort_order integer not null default 1,
  name text,
  relationship text,
  age integer check (age is null or (age >= 0 and age <= 120)),
  aadhaar_number text,
  created_at timestamptz not null default now()
);

create unique index if not exists estate_employees_employee_code_unique_idx
  on public.estate_employees (employee_code)
  where employee_code is not null and employee_code <> '';

create index if not exists estate_employees_estate_status_name_idx
  on public.estate_employees (estate_name, status, full_name);

create index if not exists estate_employees_joining_date_idx
  on public.estate_employees (date_of_joining desc)
  where date_of_joining is not null;

create index if not exists estate_employees_mobile_idx
  on public.estate_employees (mobile_number)
  where mobile_number is not null and mobile_number <> '';

create index if not exists estate_employee_family_members_employee_idx
  on public.estate_employee_family_members (employee_id, sort_order);

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists estate_employees_updated_at on public.estate_employees;
create trigger estate_employees_updated_at
  before update on public.estate_employees
  for each row execute function public.set_updated_at();

alter table public.estate_employees enable row level security;
alter table public.estate_employee_family_members enable row level security;

drop policy if exists "estate_employees_select" on public.estate_employees;
drop policy if exists "estate_employees_insert" on public.estate_employees;
drop policy if exists "estate_employees_update" on public.estate_employees;
drop policy if exists "estate_employees_delete" on public.estate_employees;
drop policy if exists "estate_employee_family_members_all" on public.estate_employee_family_members;

create policy "estate_employees_select"
  on public.estate_employees for select to anon, authenticated using (true);
create policy "estate_employees_insert"
  on public.estate_employees for insert to anon, authenticated with check (true);
create policy "estate_employees_update"
  on public.estate_employees for update to anon, authenticated using (true) with check (true);
create policy "estate_employees_delete"
  on public.estate_employees for delete to anon, authenticated using (true);

create policy "estate_employee_family_members_all"
  on public.estate_employee_family_members for all to anon, authenticated using (true) with check (true);

insert into storage.buckets (id, name, public)
values ('employee-center', 'employee-center', true)
on conflict (id) do nothing;

drop policy if exists "employee_center_storage_select" on storage.objects;
drop policy if exists "employee_center_storage_insert" on storage.objects;
drop policy if exists "employee_center_storage_update" on storage.objects;
drop policy if exists "employee_center_storage_delete" on storage.objects;

create policy "employee_center_storage_select"
  on storage.objects for select to anon, authenticated
  using (bucket_id = 'employee-center');
create policy "employee_center_storage_insert"
  on storage.objects for insert to anon, authenticated
  with check (bucket_id = 'employee-center');
create policy "employee_center_storage_update"
  on storage.objects for update to anon, authenticated
  using (bucket_id = 'employee-center')
  with check (bucket_id = 'employee-center');
create policy "employee_center_storage_delete"
  on storage.objects for delete to anon, authenticated
  using (bucket_id = 'employee-center');
