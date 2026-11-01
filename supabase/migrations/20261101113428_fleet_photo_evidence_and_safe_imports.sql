-- Additive photo evidence and server-only, versioned Fleet Fuel writes.
alter table public.fleet_daily
  add column if not exists entry_version bigint not null default 1,
  add column if not exists fuel_bill_path text not null default '',
  add column if not exists fuel_bill_name text not null default '',
  add column if not exists fuel_bill_sha256 text,
  add column if not exists odometer_photo_path text not null default '',
  add column if not exists odometer_photo_name text not null default '';
create unique index if not exists fleet_daily_fuel_bill_sha256_uq
  on public.fleet_daily(fuel_bill_sha256) where fuel_bill_sha256 is not null;

create or replace function public.fleet_entry_bump_version() returns trigger
language plpgsql security invoker set search_path=public,pg_temp as $$
begin new.entry_version:=old.entry_version+1; return new; end; $$;
revoke all on function public.fleet_entry_bump_version() from public,anon,authenticated;
drop trigger if exists fleet_entry_version on public.fleet_daily;
create trigger fleet_entry_version before update on public.fleet_daily
for each row execute function public.fleet_entry_bump_version();

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('fleet-entry-photos','fleet-entry-photos',false,3145728,array['image/jpeg','image/png','image/webp'])
on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

create table if not exists public.fleet_entry_events(
 id bigint generated always as identity primary key,
 entry_id bigint not null, actor text not null, action text not null,
 before_record jsonb, after_record jsonb, created_at timestamptz not null default now()
);
alter table public.fleet_entry_events enable row level security;
revoke all on public.fleet_entry_events from anon,authenticated;
grant all on public.fleet_entry_events to service_role;
grant usage,select on sequence public.fleet_entry_events_id_seq to service_role;

create or replace function public.save_fleet_entry(
 p_record jsonb,p_mode text,p_expected_version bigint,p_photos jsonb,
 p_confirmed_ids bigint[],p_date_reviewed boolean,p_expected_path text,p_actor text
) returns jsonb language plpgsql security invoker set search_path=public,pg_temp as $fn$
declare
 previous public.fleet_daily%rowtype; saved public.fleet_daily%rowtype; conflicting public.fleet_daily%rowtype;
 incoming public.fleet_daily%rowtype; result jsonb; photo jsonb; fuel jsonb; odometer jsonb;
begin
 if coalesce(p_actor,'')='' or p_mode not in ('create','edit','attach') then raise exception 'Invalid fleet save'; end if;
 -- Low-volume staff writes share this lock, including import and delete operations.
 perform pg_advisory_xact_lock(hashtextextended('fleet-entry-save',0));
 incoming:=jsonb_populate_record(null::public.fleet_daily,p_record);
 if p_mode<>'create' then
   select * into previous from public.fleet_daily where id=incoming.id for update;
   if not found then return jsonb_build_object('ok',false,'code','NOT_FOUND','error','The entry no longer exists.'); end if;
   if previous.entry_version is distinct from p_expected_version then
     return jsonb_build_object('ok',false,'code','STALE_ENTRY','error','Someone changed this entry. Reopen it and review the latest values.');
   end if;
   if p_mode='attach' and (previous.date is distinct from incoming.date or previous.maintenance_vehicle_key is distinct from regexp_replace(upper(incoming.vehicle_id),'[^A-Z0-9]','','g')) then
     return jsonb_build_object('ok',false,'code','STALE_ENTRY','error','The vehicle or date changed. Review the existing entry again.');
   end if;
 else
   incoming.id:=null;p_record:=p_record-'id';
 end if;
 select * into conflicting from public.fleet_daily where date=incoming.date
   and maintenance_vehicle_key=regexp_replace(upper(incoming.vehicle_id),'[^A-Z0-9]','','g')
   and (incoming.id is null or id<>incoming.id) order by id limit 1 for update;
 if found then return jsonb_build_object('ok',false,'code','EXISTING_ENTRY','error','This vehicle and date already have a record. Open it or attach the photos without changing its amounts.','existing',to_jsonb(conflicting)); end if;
 if jsonb_typeof(p_photos)<>'array' or jsonb_array_length(p_photos)>2 then raise exception 'Invalid photo metadata'; end if;
 for photo in select value from jsonb_array_elements(p_photos) loop
   if photo->>'kind' not in ('fuel','odometer') or coalesce(photo->>'path','')='' then raise exception 'Invalid photo'; end if;
   if photo->>'kind'='fuel' then
     if fuel is not null then raise exception 'Repeated fuel photo'; end if;
     fuel:=photo;
     select * into conflicting from public.fleet_daily where fuel_bill_sha256=photo->>'sha256' and (incoming.id is null or id<>incoming.id) limit 1;
     if found then return jsonb_build_object('ok',false,'code','DUPLICATE_PHOTO','error','This fuel bill is already saved. Open the existing entry.','existing',to_jsonb(conflicting)); end if;
     if coalesce(previous.fuel_bill_path,'')<>'' and previous.fuel_bill_sha256 is distinct from photo->>'sha256' then
       return jsonb_build_object('ok',false,'code','PHOTO_EXISTS','error','A fuel bill is already attached. Keep the original and review it first.');
     end if;
   else
     if odometer is not null then raise exception 'Repeated odometer photo'; end if;
     odometer:=photo;
     if coalesce(previous.odometer_photo_path,'')<>'' then return jsonb_build_object('ok',false,'code','PHOTO_EXISTS','error','An odometer photo is already attached. Keep the original and review it first.'); end if;
   end if;
 end loop;
 if p_mode='attach' then
   if jsonb_array_length(p_photos)=0 then raise exception 'Choose photos to attach'; end if;
   saved:=previous;
 else
   result:=public.save_fleet_maintenance_record(p_record,p_confirmed_ids,p_date_reviewed,p_expected_path,p_actor);
   if not coalesce((result->>'ok')::boolean,false) then return result; end if;
   select * into saved from public.fleet_daily where id=(result->>'id')::bigint;
 end if;
 if fuel is not null or odometer is not null then
   update public.fleet_daily set
     fuel_bill_path=case when fuel is not null and coalesce(fuel_bill_path,'')='' then fuel->>'path' else fuel_bill_path end,
     fuel_bill_name=case when fuel is not null and coalesce(fuel_bill_path,'')='' then fuel->>'name' else fuel_bill_name end,
     fuel_bill_sha256=coalesce(fuel_bill_sha256,fuel->>'sha256'),
     odometer_photo_path=coalesce(odometer->>'path',odometer_photo_path),
     odometer_photo_name=coalesce(odometer->>'name',odometer_photo_name)
     where id=saved.id returning * into saved;
 end if;
 insert into public.fleet_entry_events(entry_id,actor,action,before_record,after_record)
 values(saved.id,p_actor,p_mode,case when previous.id is not null then to_jsonb(previous) else null end,to_jsonb(saved));
 return jsonb_build_object('ok',true,'id',saved.id,'version',saved.entry_version);
end;$fn$;
revoke all on function public.save_fleet_entry(jsonb,text,bigint,jsonb,bigint[],boolean,text,text) from public,anon,authenticated;
grant execute on function public.save_fleet_entry(jsonb,text,bigint,jsonb,bigint[],boolean,text,text) to service_role;

create or replace function public.import_fleet_rows(p_rows jsonb,p_actor text)
returns jsonb language plpgsql security invoker set search_path=public,pg_temp as $fn$
declare row jsonb;result jsonb; inserted_count integer:=0;skipped jsonb:='[]';
begin
 if coalesce(p_actor,'')='' or jsonb_typeof(p_rows)<>'array' or jsonb_array_length(p_rows)>500 then raise exception 'Invalid import'; end if;
 perform pg_advisory_xact_lock(hashtextextended('fleet-entry-save',0));
 for row in select value from jsonb_array_elements(p_rows) loop
   result:=public.save_fleet_entry(row,'create',null,'[]','{}',false,'',p_actor);
   if coalesce((result->>'ok')::boolean,false) then inserted_count:=inserted_count+1;
   else skipped:=skipped||jsonb_build_array(jsonb_build_object('date',row->>'date','vehicle_id',row->>'vehicle_id','reason',result->>'error')); end if;
 end loop;
 return jsonb_build_object('ok',true,'inserted',inserted_count,'skipped',skipped);
end;$fn$;
revoke all on function public.import_fleet_rows(jsonb,text) from public,anon,authenticated;
grant execute on function public.import_fleet_rows(jsonb,text) to service_role;

create or replace function public.delete_fleet_entry(p_id bigint,p_version bigint,p_actor text)
returns jsonb language plpgsql security invoker set search_path=public,pg_temp as $fn$
declare previous public.fleet_daily%rowtype;
begin
 if coalesce(p_actor,'')='' then raise exception 'Authenticated staff required'; end if;
 perform pg_advisory_xact_lock(hashtextextended('fleet-entry-save',0));
 select * into previous from public.fleet_daily where id=p_id for update;
 if not found or previous.entry_version is distinct from p_version then return jsonb_build_object('ok',false,'error','This entry changed. Reopen it before deleting.'); end if;
 insert into public.fleet_entry_events(entry_id,actor,action,before_record) values(p_id,p_actor,'delete',to_jsonb(previous));
 delete from public.fleet_daily where id=p_id;
 return jsonb_build_object('ok',true);
end;$fn$;
revoke all on function public.delete_fleet_entry(bigint,bigint,text) from public,anon,authenticated;
grant execute on function public.delete_fleet_entry(bigint,bigint,text) to service_role;

-- Activate with the matching app release: old browser upserts must fail closed.
revoke insert,update,delete on public.fleet_daily from anon,authenticated;
