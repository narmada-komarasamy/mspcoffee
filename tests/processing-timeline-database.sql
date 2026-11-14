set local role service_role;
insert into public.processing_batches (id,season_id,estate,harvest_date,processing_date,product_type,method,stage,status,field_name,variety,picking_round,lot_type,quality_code,entry_version,workflow_version,gross_kg,floats_kg,fermentation_hours,drying_started_on,updated_by,updated_by_name)
values ('7f0049a0-0000-4000-8000-000000000021','2026-2027','stanmore-estate','2026-11-01','2026-11-01','Parchment','MSP 90 + Special Washed','Drying','In progress','Leclar','MIXED','1st Round','Special','1',2,2,1100,100,76,'2026-11-04','verification','Timeline verification'),
('7f0049a0-0000-4000-8000-000000000022','2026-2027','stanmore-estate','2026-11-01','2026-11-01','Dry cherry','Naturals - No Fermentation','Drying','In progress','Leclar','MIXED','1st Round','Regular','2',2,2,550,50,86,'2026-11-01','verification','Timeline verification');
do $$ begin
  if (select fermentation_hours from public.processing_batches where id='7f0049a0-0000-4000-8000-000000000021') <> 76 then raise exception 'Manual fermentation hours were changed'; end if;
  if (select fermentation_hours from public.processing_batches where id='7f0049a0-0000-4000-8000-000000000022') <> 0 then raise exception 'No-fermentation was not set to zero'; end if;
  begin
    update public.processing_batches set drying_started_on='2026-10-31' where id='7f0049a0-0000-4000-8000-000000000021';
    raise exception 'Drying before processing was accepted';
  exception when check_violation then null; end;
  begin
    update public.processing_batches set dried_on='2026-11-03' where id='7f0049a0-0000-4000-8000-000000000021';
    raise exception 'Bagging before drying was accepted';
  exception when check_violation then null; end;
  begin
    update public.processing_batches set drying_started_on=null where id='7f0049a0-0000-4000-8000-000000000021';
    raise exception 'Drying without a start date was accepted';
  exception when check_violation then null; end;
  update public.processing_batches set dried_on='2026-11-12',godown_date='2026-11-14',actual_dry_kg=240,moisture=11.5,stage='Dried',status='Complete' where id='7f0049a0-0000-4000-8000-000000000021';
  if (select dried_on-drying_started_on from public.processing_batches where id='7f0049a0-0000-4000-8000-000000000021') <> 8 then raise exception 'Yard days did not use drying to bagging'; end if;
  if not exists (select 1 from public.processing_history where batch_id='7f0049a0-0000-4000-8000-000000000021' and after_data->>'drying_started_on'='2026-11-04') then raise exception 'Drying date missing from audit'; end if;
end; $$;
reset role;
select 'Manual hours, no-fermentation, drying-to-bagging timeline and audit checks passed' as timeline_verification;
