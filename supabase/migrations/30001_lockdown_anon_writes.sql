-- Lock down anonymous writes across MSP Coffee tables and storage buckets.
-- This keeps current public/anon reads where the app still relies on them,
-- but removes insert/update/delete access from the Supabase anon role.

do $$
begin
  if to_regclass('public.app_users') is not null then
    drop policy if exists "anon_write_app_users" on public.app_users;
    drop policy if exists "app_users_authenticated_write" on public.app_users;
    create policy "app_users_authenticated_write"
      on public.app_users for all
      to authenticated
      using (true)
      with check (true);
  end if;

  if to_regclass('public.user_permissions') is not null then
    drop policy if exists "anon_all_user_permissions" on public.user_permissions;
    drop policy if exists "user_permissions_authenticated_all" on public.user_permissions;
    create policy "user_permissions_authenticated_all"
      on public.user_permissions for all
      to authenticated
      using (true)
      with check (true);
  end if;

  if to_regclass('public.role_permissions') is not null then
    drop policy if exists "auth_write_role_permissions" on public.role_permissions;
    drop policy if exists "role_permissions_authenticated_write" on public.role_permissions;
    create policy "role_permissions_authenticated_write"
      on public.role_permissions for all
      to authenticated
      using (true)
      with check (true);
  end if;

  if to_regclass('public.rainfall') is not null then
    drop policy if exists "rainfall_all_write" on public.rainfall;
    drop policy if exists "rainfall_authenticated_write" on public.rainfall;
    create policy "rainfall_authenticated_write"
      on public.rainfall for all
      to authenticated
      using (true)
      with check (true);
  end if;

  if to_regclass('public.ho_fuel_log') is not null then
    drop policy if exists "ho_fuel_log_all_write" on public.ho_fuel_log;
    drop policy if exists "ho_fuel_log_authenticated_write" on public.ho_fuel_log;
    create policy "ho_fuel_log_authenticated_write"
      on public.ho_fuel_log for all
      to authenticated
      using (true)
      with check (true);
  end if;

  if to_regclass('public.hilltiller_stock') is not null then
    drop policy if exists "hilltiller_stock_write" on public.hilltiller_stock;
    drop policy if exists "hilltiller_stock_authenticated_write" on public.hilltiller_stock;
    create policy "hilltiller_stock_authenticated_write"
      on public.hilltiller_stock for all
      to authenticated
      using (true)
      with check (true);
  end if;

  if to_regclass('public.export_orders') is not null then
    drop policy if exists "export_orders_write" on public.export_orders;
    drop policy if exists "export_orders_authenticated_write" on public.export_orders;
    create policy "export_orders_authenticated_write"
      on public.export_orders for all
      to authenticated
      using (true)
      with check (true);
  end if;

  if to_regclass('public.fleet_daily') is not null then
    drop policy if exists "fleet_daily_all_write" on public.fleet_daily;
    drop policy if exists "fleet_daily_authenticated_write" on public.fleet_daily;
    create policy "fleet_daily_authenticated_write"
      on public.fleet_daily for all
      to authenticated
      using (true)
      with check (true);
  end if;

  if to_regclass('public.user_activity') is not null then
    drop policy if exists "user_activity_all" on public.user_activity;
    drop policy if exists "Allow all" on public.user_activity;
    drop policy if exists "user_activity_authenticated_all" on public.user_activity;
    create policy "user_activity_authenticated_all"
      on public.user_activity for all
      to authenticated
      using (true)
      with check (true);
  end if;
end $$;

do $$
begin
  if to_regclass('public.cup_scores') is not null then
    drop policy if exists "cup_scores_insert" on public.cup_scores;
    drop policy if exists "cup_scores_update" on public.cup_scores;
    drop policy if exists "cup_scores_delete" on public.cup_scores;
    drop policy if exists "cup_scores_authenticated_insert" on public.cup_scores;
    drop policy if exists "cup_scores_authenticated_update" on public.cup_scores;
    drop policy if exists "cup_scores_authenticated_delete" on public.cup_scores;

    create policy "cup_scores_authenticated_insert"
      on public.cup_scores for insert
      to authenticated
      with check (true);
    create policy "cup_scores_authenticated_update"
      on public.cup_scores for update
      to authenticated
      using (true)
      with check (true);
    create policy "cup_scores_authenticated_delete"
      on public.cup_scores for delete
      to authenticated
      using (is_seed = false);
  end if;
end $$;

do $$
begin
  if to_regclass('public.travel_allowance_employees') is not null then
    drop policy if exists "travel allowance employees write" on public.travel_allowance_employees;
    drop policy if exists "travel_allowance_employees_authenticated_write" on public.travel_allowance_employees;
    create policy "travel_allowance_employees_authenticated_write"
      on public.travel_allowance_employees for all
      to authenticated
      using (true)
      with check (true);
  end if;

  if to_regclass('public.travel_allowance_locations') is not null then
    drop policy if exists "travel allowance locations write" on public.travel_allowance_locations;
    drop policy if exists "travel_allowance_locations_authenticated_write" on public.travel_allowance_locations;
    create policy "travel_allowance_locations_authenticated_write"
      on public.travel_allowance_locations for all
      to authenticated
      using (true)
      with check (true);
  end if;

  if to_regclass('public.travel_allowance_entries') is not null then
    drop policy if exists "travel allowance entries write" on public.travel_allowance_entries;
    drop policy if exists "travel allowance entries insert" on public.travel_allowance_entries;
    drop policy if exists "travel allowance entries update" on public.travel_allowance_entries;
    drop policy if exists "travel_allowance_entries_authenticated_write" on public.travel_allowance_entries;
    create policy "travel_allowance_entries_authenticated_write"
      on public.travel_allowance_entries for all
      to authenticated
      using (true)
      with check (true);
  end if;
end $$;

do $$
begin
  if to_regclass('public.board_meetings') is not null then
    drop policy if exists "board_meetings_insert" on public.board_meetings;
    drop policy if exists "board_meetings_update" on public.board_meetings;
    drop policy if exists "board_meetings_delete" on public.board_meetings;
    drop policy if exists "board_meetings_authenticated_insert" on public.board_meetings;
    drop policy if exists "board_meetings_authenticated_update" on public.board_meetings;
    drop policy if exists "board_meetings_authenticated_delete" on public.board_meetings;

    create policy "board_meetings_authenticated_insert"
      on public.board_meetings for insert to authenticated with check (true);
    create policy "board_meetings_authenticated_update"
      on public.board_meetings for update to authenticated using (true) with check (true);
    create policy "board_meetings_authenticated_delete"
      on public.board_meetings for delete to authenticated using (true);
  end if;

  if to_regclass('public.board_meeting_participants') is not null then
    drop policy if exists "board_meeting_participants_all" on public.board_meeting_participants;
    drop policy if exists "board_meeting_participants_select" on public.board_meeting_participants;
    drop policy if exists "board_meeting_participants_authenticated_write" on public.board_meeting_participants;
    create policy "board_meeting_participants_select"
      on public.board_meeting_participants for select to anon, authenticated using (true);
    create policy "board_meeting_participants_authenticated_write"
      on public.board_meeting_participants for all to authenticated using (true) with check (true);
  end if;

  if to_regclass('public.board_meeting_agenda_items') is not null then
    drop policy if exists "board_meeting_agenda_items_all" on public.board_meeting_agenda_items;
    drop policy if exists "board_meeting_agenda_items_select" on public.board_meeting_agenda_items;
    drop policy if exists "board_meeting_agenda_items_authenticated_write" on public.board_meeting_agenda_items;
    create policy "board_meeting_agenda_items_select"
      on public.board_meeting_agenda_items for select to anon, authenticated using (true);
    create policy "board_meeting_agenda_items_authenticated_write"
      on public.board_meeting_agenda_items for all to authenticated using (true) with check (true);
  end if;

  if to_regclass('public.board_meeting_actions') is not null then
    drop policy if exists "board_meeting_actions_all" on public.board_meeting_actions;
    drop policy if exists "board_meeting_actions_select" on public.board_meeting_actions;
    drop policy if exists "board_meeting_actions_authenticated_write" on public.board_meeting_actions;
    create policy "board_meeting_actions_select"
      on public.board_meeting_actions for select to anon, authenticated using (true);
    create policy "board_meeting_actions_authenticated_write"
      on public.board_meeting_actions for all to authenticated using (true) with check (true);
  end if;

  if to_regclass('public.board_meeting_files') is not null then
    drop policy if exists "board_meeting_files_all" on public.board_meeting_files;
    drop policy if exists "board_meeting_files_select" on public.board_meeting_files;
    drop policy if exists "board_meeting_files_authenticated_write" on public.board_meeting_files;
    create policy "board_meeting_files_select"
      on public.board_meeting_files for select to anon, authenticated using (true);
    create policy "board_meeting_files_authenticated_write"
      on public.board_meeting_files for all to authenticated using (true) with check (true);
  end if;
end $$;

do $$
begin
  if to_regclass('public.estate_staff_meetings') is not null then
    drop policy if exists "estate_staff_meetings_insert" on public.estate_staff_meetings;
    drop policy if exists "estate_staff_meetings_update" on public.estate_staff_meetings;
    drop policy if exists "estate_staff_meetings_delete" on public.estate_staff_meetings;
    drop policy if exists "estate_staff_meetings_authenticated_insert" on public.estate_staff_meetings;
    drop policy if exists "estate_staff_meetings_authenticated_update" on public.estate_staff_meetings;
    drop policy if exists "estate_staff_meetings_authenticated_delete" on public.estate_staff_meetings;

    create policy "estate_staff_meetings_authenticated_insert"
      on public.estate_staff_meetings for insert to authenticated with check (true);
    create policy "estate_staff_meetings_authenticated_update"
      on public.estate_staff_meetings for update to authenticated using (true) with check (true);
    create policy "estate_staff_meetings_authenticated_delete"
      on public.estate_staff_meetings for delete to authenticated using (true);
  end if;

  if to_regclass('public.estate_staff_meeting_participants') is not null then
    drop policy if exists "estate_staff_meeting_participants_all" on public.estate_staff_meeting_participants;
    drop policy if exists "estate_staff_meeting_participants_select" on public.estate_staff_meeting_participants;
    drop policy if exists "estate_staff_meeting_participants_authenticated_write" on public.estate_staff_meeting_participants;
    create policy "estate_staff_meeting_participants_select"
      on public.estate_staff_meeting_participants for select to anon, authenticated using (true);
    create policy "estate_staff_meeting_participants_authenticated_write"
      on public.estate_staff_meeting_participants for all to authenticated using (true) with check (true);
  end if;

  if to_regclass('public.estate_staff_meeting_agenda_items') is not null then
    drop policy if exists "estate_staff_meeting_agenda_items_all" on public.estate_staff_meeting_agenda_items;
    drop policy if exists "estate_staff_meeting_agenda_items_select" on public.estate_staff_meeting_agenda_items;
    drop policy if exists "estate_staff_meeting_agenda_items_authenticated_write" on public.estate_staff_meeting_agenda_items;
    create policy "estate_staff_meeting_agenda_items_select"
      on public.estate_staff_meeting_agenda_items for select to anon, authenticated using (true);
    create policy "estate_staff_meeting_agenda_items_authenticated_write"
      on public.estate_staff_meeting_agenda_items for all to authenticated using (true) with check (true);
  end if;

  if to_regclass('public.estate_staff_meeting_actions') is not null then
    drop policy if exists "estate_staff_meeting_actions_all" on public.estate_staff_meeting_actions;
    drop policy if exists "estate_staff_meeting_actions_select" on public.estate_staff_meeting_actions;
    drop policy if exists "estate_staff_meeting_actions_authenticated_write" on public.estate_staff_meeting_actions;
    create policy "estate_staff_meeting_actions_select"
      on public.estate_staff_meeting_actions for select to anon, authenticated using (true);
    create policy "estate_staff_meeting_actions_authenticated_write"
      on public.estate_staff_meeting_actions for all to authenticated using (true) with check (true);
  end if;

  if to_regclass('public.estate_staff_meeting_files') is not null then
    drop policy if exists "estate_staff_meeting_files_all" on public.estate_staff_meeting_files;
    drop policy if exists "estate_staff_meeting_files_select" on public.estate_staff_meeting_files;
    drop policy if exists "estate_staff_meeting_files_authenticated_write" on public.estate_staff_meeting_files;
    create policy "estate_staff_meeting_files_select"
      on public.estate_staff_meeting_files for select to anon, authenticated using (true);
    create policy "estate_staff_meeting_files_authenticated_write"
      on public.estate_staff_meeting_files for all to authenticated using (true) with check (true);
  end if;
end $$;

do $$
begin
  if to_regclass('storage.objects') is not null then
    drop policy if exists "board_meetings_storage_insert" on storage.objects;
    drop policy if exists "board_meetings_storage_update" on storage.objects;
    drop policy if exists "board_meetings_storage_delete" on storage.objects;
    drop policy if exists "estate_staff_meetings_storage_insert" on storage.objects;
    drop policy if exists "estate_staff_meetings_storage_update" on storage.objects;
    drop policy if exists "estate_staff_meetings_storage_delete" on storage.objects;

    drop policy if exists "board_meetings_storage_authenticated_insert" on storage.objects;
    drop policy if exists "board_meetings_storage_authenticated_update" on storage.objects;
    drop policy if exists "board_meetings_storage_authenticated_delete" on storage.objects;
    drop policy if exists "estate_staff_meetings_storage_authenticated_insert" on storage.objects;
    drop policy if exists "estate_staff_meetings_storage_authenticated_update" on storage.objects;
    drop policy if exists "estate_staff_meetings_storage_authenticated_delete" on storage.objects;

    create policy "board_meetings_storage_authenticated_insert"
      on storage.objects for insert to authenticated
      with check (bucket_id = 'board-meetings');
    create policy "board_meetings_storage_authenticated_update"
      on storage.objects for update to authenticated
      using (bucket_id = 'board-meetings')
      with check (bucket_id = 'board-meetings');
    create policy "board_meetings_storage_authenticated_delete"
      on storage.objects for delete to authenticated
      using (bucket_id = 'board-meetings');

    create policy "estate_staff_meetings_storage_authenticated_insert"
      on storage.objects for insert to authenticated
      with check (bucket_id = 'estate-staff-meetings');
    create policy "estate_staff_meetings_storage_authenticated_update"
      on storage.objects for update to authenticated
      using (bucket_id = 'estate-staff-meetings')
      with check (bucket_id = 'estate-staff-meetings');
    create policy "estate_staff_meetings_storage_authenticated_delete"
      on storage.objects for delete to authenticated
      using (bucket_id = 'estate-staff-meetings');
  end if;
end $$;

do $$
declare
  table_name text;
begin
  -- Remove broad anonymous write policies generated by the reconstructed drift
  -- migration for coffee storage tables when those policies exist in prod.
  foreach table_name in array array[
    'parchment_batches',
    'green_lots',
    'coffee_sales',
    'blends',
    'blend_recipe_items',
    'coffee_audit_log'
  ]
  loop
    if to_regclass(format('public.%I', table_name)) is not null then
      execute format('drop policy if exists "anon_rw_%1$s" on public.%1$I', table_name);
    end if;
  end loop;
end $$;
