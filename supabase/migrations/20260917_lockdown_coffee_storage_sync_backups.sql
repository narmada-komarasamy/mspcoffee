do $$
begin
  if to_regclass('public.coffee_storage_sync_backups') is not null then
    alter table public.coffee_storage_sync_backups enable row level security;

    revoke all on table public.coffee_storage_sync_backups from anon, authenticated;
    grant all on table public.coffee_storage_sync_backups to service_role;

    drop policy if exists "coffee_storage_sync_backups_service_role_all"
      on public.coffee_storage_sync_backups;

    create policy "coffee_storage_sync_backups_service_role_all"
      on public.coffee_storage_sync_backups
      for all
      to service_role
      using (true)
      with check (true);
  end if;
end
$$;
