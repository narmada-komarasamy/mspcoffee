-- Migration: 30003_backfill_internal_signed_storage_links
-- Purpose: Replace legacy stored Supabase public object URLs with app-internal
-- signed URL routes wherever the storage path column is available.

create or replace function public.msp_internal_storage_url(bucket text, object_path text)
returns text
language sql
immutable
set search_path = public
as $$
  select case
    when object_path is null or btrim(object_path) = '' then null
    else '/api/storage/signed-url?bucket='
      || replace(bucket, ' ', '%20')
      || '&path='
      || replace(object_path, ' ', '%20')
  end;
$$;

do $$
begin
  if to_regclass('public.board_meeting_files') is not null then
    update public.board_meeting_files
    set public_url = public.msp_internal_storage_url('board-meetings', file_path)
    where file_path is not null;
  end if;

  if to_regclass('public.estate_staff_meeting_files') is not null then
    update public.estate_staff_meeting_files
    set public_url = public.msp_internal_storage_url('estate-staff-meetings', file_path)
    where file_path is not null;
  end if;

  if to_regclass('public.estate_employees') is not null then
    update public.estate_employees
    set photo_public_url = public.msp_internal_storage_url('employee-center', photo_path)
    where photo_path is not null;

    update public.estate_employees
    set application_form_public_url = public.msp_internal_storage_url('employee-center', application_form_path)
    where application_form_path is not null;
  end if;

  if to_regclass('public.estate_employee_documents') is not null then
    update public.estate_employee_documents
    set public_url = public.msp_internal_storage_url('employee-center', file_path)
    where file_path is not null;
  end if;

  if to_regclass('public.estate_employee_document_notes') is not null then
    update public.estate_employee_document_notes
    set attachment_public_url = public.msp_internal_storage_url('employee-center', attachment_file_path)
    where attachment_file_path is not null;
  end if;

  if to_regclass('public.coffee_sales') is not null then
    update public.coffee_sales
    set invoice_url = public.msp_internal_storage_url(
      'invoices',
      regexp_replace(invoice_url, '^.*/object/(?:sign|public)/invoices/', '')
    )
    where invoice_url like '%/object/%/invoices/%';
  end if;
end $$;

drop function if exists public.msp_internal_storage_url(text, text);
