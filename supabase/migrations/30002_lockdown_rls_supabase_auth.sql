-- Migration: 30002_lockdown_rls_supabase_auth
-- Purpose: Remove broad anon/public RLS policies after moving auth to Supabase Auth.
--
-- Notes:
-- - Service-role API routes continue to bypass RLS for server-owned workflows.
-- - Browser clients must now be signed in with an active profile.
-- - Storage buckets are made private; existing public_url consumers should move
--   to server-generated signed URLs.

create or replace function public.current_profile_is_active()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = (select auth.uid())
      and p.active is not false
  );
$$;

create or replace function public.current_profile_has_any_role(allowed_roles text[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = (select auth.uid())
      and p.active is not false
      and p.role = any (allowed_roles)
  );
$$;

revoke all on function public.current_profile_is_active() from public;
revoke all on function public.current_profile_has_any_role(text[]) from public;
grant execute on function public.current_profile_is_active() to authenticated;
grant execute on function public.current_profile_has_any_role(text[]) to authenticated;

-- Remove any manually-created anon policies on targeted public tables, even if
-- their names differ from the reconstructed migrations.
do $$
declare
  table_name text;
  policy_record record;
begin
  foreach table_name in array array[
    'app_users',
    'user_permissions',
    'role_permissions',
    'rainfall',
    'ho_fuel_log',
    'fleet_daily',
    'user_activity',
    'travel_allowance_employees',
    'travel_allowance_locations',
    'travel_allowance_entries',
    'hilltiller_stock',
    'export_orders',
    'parchment_batches',
    'green_lots',
    'coffee_sales',
    'blends',
    'blend_recipe_items',
    'coffee_audit_log',
    'cup_scores',
    'estate_employees',
    'estate_employee_family_members',
    'estate_employee_documents',
    'employee_document_notes',
    'estate_employee_document_notes',
    'board_meetings',
    'board_meeting_participants',
    'board_meeting_agenda_items',
    'board_meeting_actions',
    'board_meeting_files',
    'estate_staff_meetings',
    'estate_staff_meeting_participants',
    'estate_staff_meeting_agenda_items',
    'estate_staff_meeting_actions',
    'estate_staff_meeting_files'
  ]
  loop
    if to_regclass(format('public.%I', table_name)) is not null then
      for policy_record in
        select policyname
        from pg_policies
        where schemaname = 'public'
          and tablename = table_name
          and 'anon'::name = any (roles)
      loop
        execute format('drop policy if exists %I on public.%I', policy_record.policyname, table_name);
      end loop;
    end if;
  end loop;
end $$;

-- Legacy PIN users are no longer a browser-readable login source.
do $$
begin
  if to_regclass('public.app_users') is not null then
    alter table public.app_users enable row level security;
    drop policy if exists "anon_read_app_users" on public.app_users;
    drop policy if exists "anon_write_app_users" on public.app_users;
    drop policy if exists "app_users_authenticated_write" on public.app_users;
    drop policy if exists "app_users_admin_all" on public.app_users;
    create policy "app_users_admin_all"
      on public.app_users for all
      to authenticated
      using ((select public.current_profile_has_any_role(array['admin'])))
      with check ((select public.current_profile_has_any_role(array['admin'])));
  end if;
end $$;

-- Admin configuration tables.
do $$
begin
  if to_regclass('public.user_permissions') is not null then
    alter table public.user_permissions enable row level security;
    drop policy if exists "anon_all_user_permissions" on public.user_permissions;
    drop policy if exists "user_permissions_authenticated_all" on public.user_permissions;
    drop policy if exists "user_permissions_admin_all" on public.user_permissions;
    create policy "user_permissions_admin_all"
      on public.user_permissions for all
      to authenticated
      using ((select public.current_profile_has_any_role(array['admin'])))
      with check ((select public.current_profile_has_any_role(array['admin'])));
  end if;

  if to_regclass('public.role_permissions') is not null then
    alter table public.role_permissions enable row level security;
    drop policy if exists "anon_read_role_permissions" on public.role_permissions;
    drop policy if exists "auth_write_role_permissions" on public.role_permissions;
    drop policy if exists "role_permissions_authenticated_write" on public.role_permissions;
    drop policy if exists "role_permissions_authenticated_read" on public.role_permissions;
    drop policy if exists "role_permissions_admin_write" on public.role_permissions;
    create policy "role_permissions_authenticated_read"
      on public.role_permissions for select
      to authenticated
      using ((select public.current_profile_is_active()));
    create policy "role_permissions_admin_write"
      on public.role_permissions for all
      to authenticated
      using ((select public.current_profile_has_any_role(array['admin'])))
      with check ((select public.current_profile_has_any_role(array['admin'])));
  end if;
end $$;

-- Operational estate/fleet/fuel data: active MSP users only.
do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'rainfall',
    'ho_fuel_log',
    'fleet_daily',
    'user_activity',
    'travel_allowance_employees',
    'travel_allowance_locations',
    'travel_allowance_entries'
  ]
  loop
    if to_regclass(format('public.%I', table_name)) is not null then
      execute format('alter table public.%I enable row level security', table_name);
      execute format('drop policy if exists "%s_public_read" on public.%I', table_name, table_name);
      execute format('drop policy if exists "%s_all_write" on public.%I', table_name, table_name);
      execute format('drop policy if exists "%s_authenticated_write" on public.%I', table_name, table_name);
      execute format('drop policy if exists "%s_authenticated_all" on public.%I', table_name, table_name);
      execute format('drop policy if exists "%s_pin_app_write" on public.%I', table_name, table_name);
      execute format('drop policy if exists "travel allowance employees read" on public.%I', table_name);
      execute format('drop policy if exists "travel allowance employees write" on public.%I', table_name);
      execute format('drop policy if exists "travel allowance locations read" on public.%I', table_name);
      execute format('drop policy if exists "travel allowance locations write" on public.%I', table_name);
      execute format('drop policy if exists "travel allowance entries read" on public.%I', table_name);
      execute format('drop policy if exists "travel allowance entries write" on public.%I', table_name);
      execute format('drop policy if exists "travel allowance entries insert" on public.%I', table_name);
      execute format('drop policy if exists "travel allowance entries update" on public.%I', table_name);
      execute format('drop policy if exists "user_activity_all" on public.%I', table_name);
      execute format('drop policy if exists "Allow all" on public.%I', table_name);
      execute format('drop policy if exists "%s_active_users_all" on public.%I', table_name, table_name);
      execute format(
        'create policy "%s_active_users_all" on public.%I for all to authenticated using ((select public.current_profile_is_active())) with check ((select public.current_profile_is_active()))',
        table_name,
        table_name
      );
    end if;
  end loop;
end $$;

-- Trading / coffee storage data: active trading/admin roles only.
do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'hilltiller_stock',
    'export_orders',
    'parchment_batches',
    'green_lots',
    'coffee_sales',
    'blends',
    'blend_recipe_items',
    'coffee_audit_log',
    'cup_scores'
  ]
  loop
    if to_regclass(format('public.%I', table_name)) is not null then
      execute format('alter table public.%I enable row level security', table_name);
      execute format('drop policy if exists "%s_read" on public.%I', table_name, table_name);
      execute format('drop policy if exists "%s_write" on public.%I', table_name, table_name);
      execute format('drop policy if exists "%s_authenticated_write" on public.%I', table_name, table_name);
      execute format('drop policy if exists "anon_rw_%s" on public.%I', table_name, table_name);
      execute format('drop policy if exists "Authenticated users can read %s" on public.%I', table_name, table_name);
      execute format('drop policy if exists "Authenticated users can write %s" on public.%I', table_name, table_name);
      execute format('drop policy if exists "cup_scores_select" on public.%I', table_name);
      execute format('drop policy if exists "cup_scores_insert" on public.%I', table_name);
      execute format('drop policy if exists "cup_scores_update" on public.%I', table_name);
      execute format('drop policy if exists "cup_scores_delete" on public.%I', table_name);
      execute format('drop policy if exists "cup_scores_authenticated_insert" on public.%I', table_name);
      execute format('drop policy if exists "cup_scores_authenticated_update" on public.%I', table_name);
      execute format('drop policy if exists "cup_scores_authenticated_delete" on public.%I', table_name);
      execute format('drop policy if exists "%s_trading_roles_all" on public.%I', table_name, table_name);
      execute format(
        'create policy "%s_trading_roles_all" on public.%I for all to authenticated using ((select public.current_profile_has_any_role(array[''admin'',''ceo'',''supervisor'']))) with check ((select public.current_profile_has_any_role(array[''admin'',''ceo'',''supervisor''])))',
        table_name,
        table_name
      );
    end if;
  end loop;
end $$;

-- Employee registry data: active admin/hr/supervisor only.
do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'estate_employees',
    'estate_employee_family_members',
    'estate_employee_documents',
    'employee_document_notes',
    'estate_employee_document_notes'
  ]
  loop
    if to_regclass(format('public.%I', table_name)) is not null then
      execute format('alter table public.%I enable row level security', table_name);
      execute format('drop policy if exists "estate_employees_select" on public.%I', table_name);
      execute format('drop policy if exists "estate_employees_insert" on public.%I', table_name);
      execute format('drop policy if exists "estate_employees_update" on public.%I', table_name);
      execute format('drop policy if exists "estate_employees_delete" on public.%I', table_name);
      execute format('drop policy if exists "estate_employee_family_members_all" on public.%I', table_name);
      execute format('drop policy if exists "estate_employee_documents_all" on public.%I', table_name);
      execute format('drop policy if exists "employee_document_notes_all" on public.%I', table_name);
      execute format('drop policy if exists "%s_employee_roles_all" on public.%I', table_name, table_name);
      execute format(
        'create policy "%s_employee_roles_all" on public.%I for all to authenticated using ((select public.current_profile_has_any_role(array[''admin'',''hr'',''supervisor'']))) with check ((select public.current_profile_has_any_role(array[''admin'',''hr'',''supervisor''])))',
        table_name,
        table_name
      );
    end if;
  end loop;
end $$;

-- Board and estate staff meetings: active admin/ceo/supervisor only.
do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'board_meetings',
    'board_meeting_participants',
    'board_meeting_agenda_items',
    'board_meeting_actions',
    'board_meeting_files',
    'estate_staff_meetings',
    'estate_staff_meeting_participants',
    'estate_staff_meeting_agenda_items',
    'estate_staff_meeting_actions',
    'estate_staff_meeting_files'
  ]
  loop
    if to_regclass(format('public.%I', table_name)) is not null then
      execute format('alter table public.%I enable row level security', table_name);
      execute format('drop policy if exists "%s_select" on public.%I', table_name, table_name);
      execute format('drop policy if exists "%s_insert" on public.%I', table_name, table_name);
      execute format('drop policy if exists "%s_update" on public.%I', table_name, table_name);
      execute format('drop policy if exists "%s_delete" on public.%I', table_name, table_name);
      execute format('drop policy if exists "%s_all" on public.%I', table_name, table_name);
      execute format('drop policy if exists "%s_authenticated_insert" on public.%I', table_name, table_name);
      execute format('drop policy if exists "%s_authenticated_update" on public.%I', table_name, table_name);
      execute format('drop policy if exists "%s_authenticated_delete" on public.%I', table_name, table_name);
      execute format('drop policy if exists "%s_authenticated_write" on public.%I', table_name, table_name);
      execute format('drop policy if exists "%s_meeting_roles_all" on public.%I', table_name, table_name);
      execute format(
        'create policy "%s_meeting_roles_all" on public.%I for all to authenticated using ((select public.current_profile_has_any_role(array[''admin'',''ceo'',''supervisor'']))) with check ((select public.current_profile_has_any_role(array[''admin'',''ceo'',''supervisor''])))',
        table_name,
        table_name
      );
    end if;
  end loop;
end $$;

-- Storage: remove anon policies, make sensitive buckets private, and allow only
-- signed-in users in the appropriate role group to access bucket objects.
update storage.buckets
set public = false
where id in (
  'board-meetings',
  'estate-staff-meetings',
  'employee-center',
  'invoices',
  'travel-allowance-receipts'
);

do $$
declare
  policy_name text;
  policy_record record;
begin
  for policy_record in
    select policyname
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and 'anon'::name = any (roles)
  loop
    execute format('drop policy if exists %I on storage.objects', policy_record.policyname);
  end loop;

  foreach policy_name in array array[
    'board_meetings_storage_select',
    'board_meetings_storage_insert',
    'board_meetings_storage_update',
    'board_meetings_storage_delete',
    'board_meetings_storage_authenticated_insert',
    'board_meetings_storage_authenticated_update',
    'board_meetings_storage_authenticated_delete',
    'estate_staff_meetings_storage_select',
    'estate_staff_meetings_storage_insert',
    'estate_staff_meetings_storage_update',
    'estate_staff_meetings_storage_delete',
    'estate_staff_meetings_storage_authenticated_insert',
    'estate_staff_meetings_storage_authenticated_update',
    'estate_staff_meetings_storage_authenticated_delete',
    'employee_center_storage_select',
    'employee_center_storage_insert',
    'employee_center_storage_update',
    'employee_center_storage_delete',
    'travel_allowance_receipts_select',
    'travel_allowance_receipts_insert',
    'travel_allowance_receipts_update',
    'travel_allowance_receipts_delete',
    'msp_storage_meetings_all',
    'msp_storage_employee_center_all',
    'msp_storage_invoices_all',
    'msp_storage_travel_receipts_service_role_all'
  ]
  loop
    execute format('drop policy if exists %I on storage.objects', policy_name);
  end loop;
end $$;

create policy "msp_storage_meetings_all"
  on storage.objects for all
  to authenticated
  using (
    bucket_id in ('board-meetings', 'estate-staff-meetings')
    and (select public.current_profile_has_any_role(array['admin','ceo','supervisor']))
  )
  with check (
    bucket_id in ('board-meetings', 'estate-staff-meetings')
    and (select public.current_profile_has_any_role(array['admin','ceo','supervisor']))
  );

create policy "msp_storage_employee_center_all"
  on storage.objects for all
  to authenticated
  using (
    bucket_id = 'employee-center'
    and (select public.current_profile_has_any_role(array['admin','hr','supervisor']))
  )
  with check (
    bucket_id = 'employee-center'
    and (select public.current_profile_has_any_role(array['admin','hr','supervisor']))
  );

create policy "msp_storage_invoices_all"
  on storage.objects for all
  to authenticated
  using (
    bucket_id = 'invoices'
    and (select public.current_profile_has_any_role(array['admin','ceo','supervisor']))
  )
  with check (
    bucket_id = 'invoices'
    and (select public.current_profile_has_any_role(array['admin','ceo','supervisor']))
  );

create policy "msp_storage_travel_receipts_service_role_all"
  on storage.objects for all
  using (bucket_id = 'travel-allowance-receipts' and auth.role() = 'service_role')
  with check (bucket_id = 'travel-allowance-receipts' and auth.role() = 'service_role');
