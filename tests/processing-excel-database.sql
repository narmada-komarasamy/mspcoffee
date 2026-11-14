-- Append after processing-database.sql in the same disposable transaction.
set local role service_role;
insert into public.processing_batches (id,season_id,estate,harvest_date,processing_date,product_type,method,stage,status,field_name,variety,picking_round,lot_type,quality_code,entry_version,gross_kg,floats_kg,wet_kg,updated_by,updated_by_name)
values ('7f0049a0-0000-4000-8000-000000000011','2026-2027','stanmore-estate','2026-11-01','2026-11-02','Parchment','MSP 90 + Special Washed','Received','In progress','Leclar','MIXED','1st Round','For Cupping','1',2,1100,100,400,'verification','Transaction verification'),
('7f0049a0-0000-4000-8000-000000000012','2026-2027','stanmore-estate','2026-11-01','2026-11-02','Parchment','MSP 90 + Special Washed','Received','In progress','ThirudanThundu','MIXED','1st Round','For Cupping','1',2,550,50,200,'verification','Transaction verification');
do $$
declare first_lot text; next_lot text; old_revision int;
begin
  select lot_number,revision into first_lot,old_revision from public.processing_batches where id='7f0049a0-0000-4000-8000-000000000011';
  select lot_number into next_lot from public.processing_batches where id='7f0049a0-0000-4000-8000-000000000012';
  if first_lot <> 'SE01Nov26MIXED1-01' or next_lot <> 'SE01Nov26MIXED1-02' then raise exception 'Automatic lot allocation failed: % / %',first_lot,next_lot; end if;
  if (select net_kg from public.processing_batches where id='7f0049a0-0000-4000-8000-000000000011') <> 1000 then raise exception 'Floats calculation failed'; end if;
  update public.processing_batches set lot_number='FORGED', actual_dry_kg=200, dried_on='2026-11-10', moisture=11.5, stage='Dried', status='Complete', godown_date='2026-11-14', storage_location='SE Go-down - 1', drying_surface='SE Raised Table' where id='7f0049a0-0000-4000-8000-000000000011' and revision=old_revision;
  if (select lot_number from public.processing_batches where id='7f0049a0-0000-4000-8000-000000000011') <> first_lot then raise exception 'Editing reassigned the lot or accepted a forged number'; end if;
  begin
    update public.processing_batches set lot_type='Gleanings',quality_code='1' where id='7f0049a0-0000-4000-8000-000000000012';
    raise exception 'Special Gleanings was accepted';
  exception when check_violation then null; end;
  begin
    update public.processing_batches set drying_surface='GE Brick' where id='7f0049a0-0000-4000-8000-000000000012';
    raise exception 'Gowri facility was accepted';
  exception when check_violation then null; end;
  update public.processing_batches set quality_code='2', method='Naturals - No Fermentation' where id='7f0049a0-0000-4000-8000-000000000012';
  if (select lot_number from public.processing_batches where id='7f0049a0-0000-4000-8000-000000000012') <> 'SE01Nov26MIXED2-01' then raise exception 'Changing grade did not generate a new lot'; end if;
  update public.processing_lot_counters set last_sequence=99 where season_id='2026-2027' and base_key='se01nov26mixed1';
end;
$$;
insert into public.processing_batches (id,season_id,estate,harvest_date,processing_date,product_type,method,stage,status,field_name,variety,picking_round,lot_type,quality_code,entry_version,updated_by,updated_by_name)
values ('7f0049a0-0000-4000-8000-000000000013','2026-2027','stanmore-estate','2026-11-01','2026-11-02','Parchment','MSP 90 + Special Washed','Received','In progress','Leclar','MIXED','1st Round','For Cupping','1',2,'verification','Transaction verification');
do $$ begin
  if (select lot_number from public.processing_batches where id='7f0049a0-0000-4000-8000-000000000013') <> 'SE01Nov26MIXED1-100' then raise exception 'Sequence above 99 was truncated'; end if;
  if not exists (select 1 from public.processing_history where batch_id='7f0049a0-0000-4000-8000-000000000011' and after_data->>'godown_date'='2026-11-14') then raise exception 'New processing fields missing from audit'; end if;
end; $$;
reset role;
select 'Excel lot allocation, grade rules, floats, godown data and audit checks passed' as excel_verification;
