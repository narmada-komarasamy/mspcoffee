do $test$
declare
 vehicle text:='FLEET-SAFE-'||gen_random_uuid()::text; payload jsonb; result jsonb; entry bigint; version bigint; before_row jsonb;
 photos jsonb:=jsonb_build_array(jsonb_build_object('kind','fuel','path','test/fuel.jpg','name','original.jpg','sha256',encode(sha256(convert_to(gen_random_uuid()::text,'UTF8')),'hex')));
begin
 payload:=jsonb_build_object('date','2026-11-01','month',11,'year',2026,'vehicle_id',vehicle,'vehicle_type','Estate','account','BVE','fuel_type','Diesel',
   'starting_km',100,'closing_km',200,'km_run',100,'fuel_filled_l',10,'fuel_cost',1000,'maint_cost',0,'total_cost',1000,'avg_mileage',10,'cost_per_km',10,
   'maintenance_performed','','remarks','Keep existing notes','maintenance_vendor','','maintenance_bill_text','');
 result:=public.save_fleet_entry(payload,'create',null,photos,'{}',false,'','test-actor');
 assert (result->>'ok')::boolean,'Photo save failed';entry:=(result->>'id')::bigint;version:=(result->>'version')::bigint;
 assert exists(select 1 from public.fleet_daily where id=entry and fuel_bill_path='test/fuel.jpg'),'Original not retained';
 result:=public.save_fleet_entry(payload||jsonb_build_object('vehicle_id',replace(vehicle,'-',' ')),'create',null,'[]','{}',false,'','test-actor');
 assert result->>'code'='EXISTING_ENTRY','Normalised vehicle/date collision was overwritten';
 result:=public.save_fleet_entry(payload||'{"date":"2026-11-02"}'::jsonb,'create',null,photos,'{}',false,'','test-actor');
 assert result->>'code'='DUPLICATE_PHOTO','Renamed original was accepted again';
 select to_jsonb(f) into before_row from public.fleet_daily f where id=entry;
 result:=public.save_fleet_entry(payload||jsonb_build_object('id',entry,'fuel_cost',0,'maint_cost',1234),'attach',version,
   '[{"kind":"odometer","path":"test/odometer.png","name":"odometer.png"}]','{}',false,'','test-actor');
 assert (result->>'ok')::boolean,'Attachment-only failed';
 assert exists(select 1 from public.fleet_daily where id=entry and fuel_cost=1000 and maint_cost=0 and total_cost=1000 and remarks='Keep existing notes' and odometer_photo_path='test/odometer.png'),'Photo attachment changed financial values';
 result:=public.save_fleet_entry(payload||jsonb_build_object('id',entry,'fuel_cost',999),'edit',version,'[]','{}',false,'','test-actor');
 assert result->>'code'='STALE_ENTRY','Stale editor overwrote changes';
 result:=public.import_fleet_rows(jsonb_build_array(payload||'{"fuel_cost":1}'::jsonb,payload||'{"date":"2026-11-03"}'::jsonb),'test-import');
 assert (result->>'inserted')::integer=1 and jsonb_array_length(result->'skipped')=1,'Import counts incorrect';
 assert exists(select 1 from public.fleet_daily where id=entry and fuel_cost=1000 and fuel_bill_path='test/fuel.jpg'),'Import changed expense or attachment';
 result:=public.import_fleet_rows(jsonb_build_array(payload,payload||'{"date":"2026-11-03"}'::jsonb),'test-import');
 assert (result->>'inserted')::integer=0 and jsonb_array_length(result->'skipped')=2,'Retry created duplicate rows';
 result:=public.delete_fleet_entry(entry,version,'test-delete');
 assert not (result->>'ok')::boolean,'Stale delete removed a changed entry';
 assert not has_table_privilege('anon','public.fleet_daily','UPDATE'),'Anonymous writes can bypass protection';
 assert not has_function_privilege('anon','public.save_fleet_entry(jsonb,text,bigint,jsonb,bigint[],boolean,text,text)','EXECUTE'),'Anonymous RPC access is enabled';
 assert exists(select 1 from public.fleet_entry_events where entry_id=entry and actor='test-actor'),'Missing audit trail';
end;$test$;
select 'PASS: photo retention, duplicate originals, normalised collisions, attach-only preservation, stale edits/deletes, import skips/retries and API-only writes' as verification;
