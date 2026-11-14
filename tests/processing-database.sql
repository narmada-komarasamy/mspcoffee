-- Run inside a transaction and roll back; no trial batches remain in the live register.
set local role service_role;
update public.processing_seasons set start_date = '2026-04-01', updated_by = 'verification', updated_by_name = 'Transaction verification' where id = '2026-2027';
insert into public.processing_batches (id,season_id,estate,lot_number,processing_date,product_type,method,stage,status,gross_kg,tare_kg,updated_by,updated_by_name)
values ('7f0049a0-0000-4000-8000-000000000001','2026-2027','stanmore-estate','VERIFY-ONLY','2026-11-01','Parchment','Washed','Received','In progress',1000,0,'verification','Transaction verification');
do $$
declare original_revision int; changes int;
begin
  if (select net_kg from public.processing_batches where id='7f0049a0-0000-4000-8000-000000000001') <> 1000 then raise exception 'Net calculation failed'; end if;
  begin
    insert into public.processing_batches (id,season_id,estate,lot_number,processing_date,product_type,method,stage,status,updated_by,updated_by_name)
    values ('7f0049a0-0000-4000-8000-000000000002','2026-2027','stanmore-estate',' verify-only ','2026-11-01','Parchment','Washed','Received','In progress','verification','Verification');
    raise exception 'Duplicate was accepted';
  exception when unique_violation then null; end;
  begin
    update public.processing_batches set tare_kg = 1001 where id='7f0049a0-0000-4000-8000-000000000001';
    raise exception 'Invalid tare was accepted';
  exception when check_violation then null; end;
  begin
    update public.processing_batches set status = 'Complete' where id='7f0049a0-0000-4000-8000-000000000001';
    raise exception 'Incomplete measurements were accepted';
  exception when check_violation then null; end;
  select revision into original_revision from public.processing_batches where id='7f0049a0-0000-4000-8000-000000000001';
  update public.processing_batches set actual_dry_kg=250, moisture=11, dried_on='2026-11-02', stage='Dried', status='Complete', recipe_notes='Verified recipe', fermentation_hours=48 where id='7f0049a0-0000-4000-8000-000000000001' and revision=original_revision;
  update public.processing_batches set remarks='Stale update' where id='7f0049a0-0000-4000-8000-000000000001' and revision=original_revision;
  get diagnostics changes = row_count;
  if changes <> 0 then raise exception 'Stale revision overwrote batch'; end if;
  if (select count(*) from public.processing_history where batch_id='7f0049a0-0000-4000-8000-000000000001') <> 2 then raise exception 'Audit history missing'; end if;
  if not exists (select 1 from public.processing_history where batch_id='7f0049a0-0000-4000-8000-000000000001' and before_data->>'actual_dry_kg' is null and (after_data->>'actual_dry_kg')::numeric=250) then raise exception 'Before and after snapshots missing'; end if;
end;
$$;
reset role;
select 'Processing constraints, audit history, server-only privileges and stale-version protection passed' as verification;
