begin;
do $test$
declare
  token text := 'SAFEGUARD-'||gen_random_uuid()::text;
  payload jsonb;
  result jsonb;
  first_id bigint;
  second_id bigint;
  hash text := encode(sha256(convert_to(gen_random_uuid()::text,'UTF8')),'hex');
begin
  payload := jsonb_build_object('date','2026-09-17','month',9,'year',2026,'vehicle_id',token,
    'vehicle_type','Estate','account','BVE','fuel_type','Diesel','starting_km',100,'closing_km',200,
    'km_run',100,'fuel_filled_l',10,'fuel_cost',200,'maint_cost',34362,'total_cost',34562,
    'avg_mileage',10,'cost_per_km',345.62,'maintenance_performed','Test service','remarks','Test only',
    'maintenance_vendor','Test workshop','maintenance_bill_text','Test bill text');
  result:=public.save_fleet_maintenance_record(payload,'{}',false,'','fixture');
  assert (result->>'ok')::boolean, 'Initial record failed';
  first_id:=(result->>'id')::bigint;
  result:=public.save_fleet_maintenance_record(payload||'{"date":"2020-09-15","year":2020}'::jsonb,'{}',false,'','fixture');
  assert result->>'code'='POSSIBLE_DUPLICATES', 'Cross-year duplicate was not flagged';
  assert (select count(*) from public.fleet_daily where vehicle_id=token)=1, 'Warning created an expense';
  result:=public.save_fleet_maintenance_record(payload||jsonb_build_object('date','2020-09-15','year',2020,'vehicle_id',replace(token,'-',' ')),array[first_id],false,'','fixture');
  assert (result->>'ok')::boolean, 'Reviewed separate expense failed';
  second_id:=(result->>'id')::bigint;
  assert exists(select 1 from public.fleet_daily where id=second_id and maintenance_duplicate_review->'matching_ids' @> to_jsonb(array[first_id])), 'Duplicate review was not recorded';

  result:=public.save_fleet_maintenance_record(payload||jsonb_build_object('id',first_id,'maintenance_bill_date','2020-09-15','maintenance_bill_path','test/bill.pdf','maintenance_bill_name','test.pdf','maintenance_bill_sha256',hash),'{}',false,'','fixture');
  assert result->>'code'='BILL_DATE_REVIEW_REQUIRED', 'Different bill date accepted without review';
  result:=public.save_fleet_maintenance_record(payload||jsonb_build_object('id',first_id,'maintenance_bill_date','2020-09-15','maintenance_bill_path','test/bill.pdf','maintenance_bill_name','test.pdf','maintenance_bill_sha256',hash),'{}',true,'','fixture');
  assert (result->>'ok')::boolean, 'Attaching to existing record failed';
  assert (select date from public.fleet_daily where id=first_id)=date '2026-09-17', 'Bill date changed log date';
  assert (select maintenance_bill_date_reviewed_at from public.fleet_daily where id=first_id) is not null, 'Date review was not recorded';
  result:=public.save_fleet_maintenance_record(payload||jsonb_build_object('vehicle_id','OTHER-'||token,'date','2024-01-01','maintenance_bill_path','another/renamed.pdf','maintenance_bill_sha256',hash),'{}',false,'','fixture');
  assert result->>'code'='DUPLICATE_FILE', 'Same fingerprint accepted for another vehicle';
  result:=public.save_fleet_maintenance_record(payload||jsonb_build_object('id',first_id),'{}',true,'','fixture');
  assert result->>'code'='STALE_ENTRY', 'Stale attachment overwrite was accepted';
  assert (select maintenance_bill_path from public.fleet_daily where id=first_id)='test/bill.pdf', 'Original attachment changed on rejection';
  result:=public.save_fleet_maintenance_record(payload||'{"date":"2026-09-18"}'::jsonb,array[first_id],false,'','fixture');
  assert result->>'code'='POSSIBLE_DUPLICATES', 'A newly appearing duplicate did not require review';
  result:=public.save_fleet_maintenance_record(payload||'{"date":"2026-09-18"}'::jsonb,array[first_id,second_id],false,'','fixture');
  assert (result->>'ok')::boolean, 'Separate expense could not be explicitly confirmed';
end;
$test$;
rollback;
select 'PASS: cross-date/normalized-vehicle warnings, explicit override audit, separate bill date review, fingerprint rejection, stale attachment and fresh duplicate checks' as verification;

begin;
do $test$
declare payload jsonb; result jsonb; entry_id bigint; vehicle text:='ATTACH-SAFEGUARD-'||gen_random_uuid()::text;
begin
  payload:=jsonb_build_object('date','2026-09-17','month',9,'year',2026,'vehicle_id',vehicle,'vehicle_type','Estate','account','BVE','fuel_type','Diesel',
    'starting_km',100,'closing_km',200,'km_run',100,'fuel_filled_l',10,'fuel_cost',20,'maint_cost',100,'total_cost',120,'avg_mileage',10,'cost_per_km',1.2,
    'maintenance_performed','Test','remarks','Old remarks','maintenance_vendor','','maintenance_bill_text','Test');
  result:=public.save_fleet_maintenance_record(payload,'{}',false,'','fixture');
  entry_id:=(result->>'id')::bigint;
  update public.fleet_daily set fuel_cost=500,total_cost=600,starting_km=300,closing_km=400,remarks='Newer remarks' where id=entry_id;
  result:=public.save_fleet_maintenance_record(payload||jsonb_build_object('id',entry_id,'attachment_only',true,'maintenance_bill_path','test/attach.pdf',
    'maintenance_bill_date','2020-09-15'),'{}',true,'','fixture');
  assert (result->>'ok')::boolean, 'Attachment-only save failed';
  assert exists(select 1 from public.fleet_daily where id=entry_id and fuel_cost=500 and total_cost=600 and starting_km=300 and closing_km=400 and remarks='Newer remarks'),
    'Attaching a bill overwrote concurrent expense changes';
  update public.fleet_daily set maint_cost=200,total_cost=700 where id=entry_id;
  result:=public.save_fleet_maintenance_record(payload||jsonb_build_object('id',entry_id,'attachment_only',true),'{}',true,'test/attach.pdf','fixture');
  assert result->>'code'='STALE_ENTRY', 'Changed matching amount was not rejected';
end;
$test$;
rollback;
select 'PASS: attaching preserves concurrent fuel/KM edits and rejects a changed matching amount' as verification;
