-- Preserve the current expense at the database lock when attaching a bill.
create or replace function public.save_fleet_maintenance_record(
  p_record jsonb, p_confirmed_ids bigint[], p_date_reviewed boolean,
  p_expected_path text, p_actor text
) returns jsonb language plpgsql security invoker set search_path=public,pg_temp
as $function$
declare
  incoming public.fleet_daily%rowtype;
  previous public.fleet_daily%rowtype;
  matched public.fleet_daily%rowtype;
  saved public.fleet_daily%rowtype;
  normalized text;
  matching_ids bigint[];
  matches jsonb;
  review jsonb := '{}'::jsonb;
  reviewed_at timestamptz;
begin
  incoming := jsonb_populate_record(null::public.fleet_daily,p_record);
  normalized := regexp_replace(upper(incoming.vehicle_id),'[^A-Z0-9]','','g');
  if coalesce(p_actor,'')='' then raise exception 'Authenticated staff required'; end if;
  perform pg_advisory_xact_lock(hashtextextended('fleet-maintenance:'||normalized||':'||round(incoming.maint_cost,2)::text,0));
  if incoming.id is not null then
    select * into previous from public.fleet_daily where id=incoming.id for update;
    if not found then return jsonb_build_object('ok',false,'code','NOT_FOUND','error','Fleet entry no longer exists. Refresh and try again.'); end if;
    if previous.maintenance_bill_path is distinct from p_expected_path then
      return jsonb_build_object('ok',false,'code','STALE_ENTRY','error','The attachment changed while you were editing. Reopen the entry before saving.');
    end if;
    if p_record->>'attachment_only'='true' then
      if previous.date is distinct from incoming.date or previous.maintenance_vehicle_key is distinct from normalized or previous.maint_cost is distinct from incoming.maint_cost then
        return jsonb_build_object('ok',false,'code','STALE_ENTRY','error','The matching expense changed. Reopen it before attaching the bill.');
      end if;
      -- Keep the current expense intact, including concurrent fuel/KM edits.
      incoming.month:=previous.month; incoming.year:=previous.year;
      incoming.vehicle_id:=previous.vehicle_id; incoming.vehicle_type:=previous.vehicle_type;
      incoming.account:=previous.account; incoming.fuel_type:=previous.fuel_type;
      incoming.starting_km:=previous.starting_km; incoming.closing_km:=previous.closing_km;
      incoming.km_run:=previous.km_run; incoming.fuel_filled_l:=previous.fuel_filled_l;
      incoming.fuel_cost:=previous.fuel_cost; incoming.total_cost:=previous.total_cost;
      incoming.avg_mileage:=previous.avg_mileage; incoming.cost_per_km:=previous.cost_per_km;
      incoming.remarks:=previous.remarks;
      incoming.maintenance_performed:=coalesce(nullif(previous.maintenance_performed,''),incoming.maintenance_performed);
      incoming.maintenance_vendor:=coalesce(nullif(previous.maintenance_vendor,''),incoming.maintenance_vendor);
    end if;
    if not(p_record ? 'maintenance_bill_date') then incoming.maintenance_bill_date := previous.maintenance_bill_date; end if;
  end if;
  if incoming.maintenance_bill_sha256 is not null then
    select * into matched from public.fleet_daily where maintenance_bill_sha256=incoming.maintenance_bill_sha256
      and (incoming.id is null or id<>incoming.id) limit 1;
    if found then return jsonb_build_object('ok',false,'code','DUPLICATE_FILE','error','This exact bill is already attached to another entry.',
      'existing',jsonb_build_object('id',matched.id,'date',matched.date,'vehicle_id',matched.vehicle_id,'maint_cost',matched.maint_cost,
        'maintenance_bill_path',matched.maintenance_bill_path,'maintenance_bill_name',matched.maintenance_bill_name)); end if;
  end if;
  if incoming.maintenance_bill_date is not null and incoming.maintenance_bill_date<>incoming.date then
    if p_date_reviewed then reviewed_at:=now();
    elsif previous.id is not null and previous.date=incoming.date and previous.maintenance_bill_date=incoming.maintenance_bill_date
      and previous.maintenance_bill_date_reviewed_at is not null then reviewed_at:=previous.maintenance_bill_date_reviewed_at;
    else return jsonb_build_object('ok',false,'code','BILL_DATE_REVIEW_REQUIRED','error','Review the different bill date and vehicle-log date before saving.'); end if;
  end if;
  if incoming.maint_cost>0 and (previous.id is null or previous.maintenance_vehicle_key is distinct from normalized or previous.maint_cost is distinct from incoming.maint_cost) then
    select coalesce(array_agg(id order by id),'{}'::bigint[]),coalesce(jsonb_agg(jsonb_build_object(
      'id',id,'date',date,'vehicle_id',vehicle_id,'maint_cost',maint_cost,'maintenance_vendor',maintenance_vendor,
      'maintenance_bill_path',maintenance_bill_path,'maintenance_bill_name',maintenance_bill_name) order by date desc),'[]'::jsonb)
    into matching_ids,matches from public.fleet_daily where maintenance_vehicle_key=normalized and maint_cost=incoming.maint_cost
      and (incoming.id is null or id<>incoming.id);
    if not(matching_ids <@ coalesce(p_confirmed_ids,'{}'::bigint[])) then
      return jsonb_build_object('ok',false,'code','POSSIBLE_DUPLICATES','error','The same vehicle already has maintenance entries for this amount. Review them before saving.','matches',matches);
    end if;
    if cardinality(matching_ids)>0 then review:=jsonb_build_object('matching_ids',matching_ids,'confirmed_by',p_actor,'confirmed_at',now()); end if;
  elsif previous.id is not null then review:=previous.maintenance_duplicate_review;
  end if;
  if incoming.id is null then
    insert into public.fleet_daily(date,month,year,vehicle_id,vehicle_type,account,fuel_type,
      starting_km,closing_km,km_run,fuel_filled_l,fuel_cost,maint_cost,total_cost,avg_mileage,cost_per_km,
      maintenance_performed,remarks,maintenance_vendor,maintenance_bill_path,maintenance_bill_name,maintenance_bill_text,
      maintenance_bill_date,maintenance_bill_sha256,maintenance_bill_date_reviewed_at,maintenance_duplicate_review)
    values(incoming.date,incoming.month,incoming.year,incoming.vehicle_id,incoming.vehicle_type,incoming.account,incoming.fuel_type,
      incoming.starting_km,incoming.closing_km,incoming.km_run,incoming.fuel_filled_l,incoming.fuel_cost,incoming.maint_cost,
      incoming.total_cost,incoming.avg_mileage,incoming.cost_per_km,incoming.maintenance_performed,incoming.remarks,incoming.maintenance_vendor,
      coalesce(incoming.maintenance_bill_path,''),coalesce(incoming.maintenance_bill_name,''),incoming.maintenance_bill_text,
      incoming.maintenance_bill_date,incoming.maintenance_bill_sha256,reviewed_at,review) returning * into saved;
  else
    update public.fleet_daily set date=incoming.date,month=incoming.month,year=incoming.year,
      vehicle_id=incoming.vehicle_id,vehicle_type=incoming.vehicle_type,account=incoming.account,fuel_type=incoming.fuel_type,
      starting_km=incoming.starting_km,closing_km=incoming.closing_km,km_run=incoming.km_run,fuel_filled_l=incoming.fuel_filled_l,
      fuel_cost=incoming.fuel_cost,maint_cost=incoming.maint_cost,total_cost=incoming.total_cost,avg_mileage=incoming.avg_mileage,cost_per_km=incoming.cost_per_km,
      maintenance_performed=incoming.maintenance_performed,remarks=incoming.remarks,maintenance_vendor=incoming.maintenance_vendor,
      maintenance_bill_path=case when p_record ? 'maintenance_bill_path' then incoming.maintenance_bill_path else previous.maintenance_bill_path end,
      maintenance_bill_name=case when p_record ? 'maintenance_bill_name' then incoming.maintenance_bill_name else previous.maintenance_bill_name end,
      maintenance_bill_sha256=case when p_record ? 'maintenance_bill_sha256' then incoming.maintenance_bill_sha256 else previous.maintenance_bill_sha256 end,
      maintenance_bill_text=incoming.maintenance_bill_text,maintenance_bill_date=incoming.maintenance_bill_date,
      maintenance_bill_date_reviewed_at=reviewed_at,maintenance_duplicate_review=review where id=incoming.id returning * into saved;
  end if;
  return jsonb_build_object('ok',true,'id',saved.id);
end;
$function$;
revoke all on function public.save_fleet_maintenance_record(jsonb,bigint[],boolean,text,text) from public,anon,authenticated;
grant execute on function public.save_fleet_maintenance_record(jsonb,bigint[],boolean,text,text) to service_role;
