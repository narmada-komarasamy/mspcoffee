-- Run once in the MSP Coffee Supabase SQL editor before publishing the application.
-- All schema and data changes below commit together or roll back together.
begin;

-- Private attachments. Legacy purchases remain valid; new purchases need a saved bill.
create table public.ho_fuel_bills (
 id uuid primary key default gen_random_uuid(),
 purchase_id bigint references public.ho_fuel_log(id) on delete restrict,
 uploaded_by text not null,
 file_path text not null unique,
 file_name text not null,
 content_type text not null,
 created_at timestamptz not null default now()
);
create index ho_fuel_bills_purchase_idx on public.ho_fuel_bills(purchase_id);
alter table public.ho_fuel_bills enable row level security;
revoke all on public.ho_fuel_bills from public, anon, authenticated;
grant all on public.ho_fuel_bills to service_role;
insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('ho-fuel-bills','ho-fuel-bills',false,3145728,array['application/pdf','image/jpeg','image/png','image/webp']);

create function public.check_ho_fuel_purchase_bill() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
 if new.transaction_type <> 'PURCHASE' then return new; end if;
 if TG_OP = 'UPDATE' and old.transaction_type = 'PURCHASE' then return new; end if;
 if not exists (
   select 1 from public.ho_fuel_bills b join storage.objects o
   on o.bucket_id = 'ho-fuel-bills' and o.name = b.file_path where b.purchase_id = new.id
 ) then raise exception 'A bill is required for every new fuel purchase'; end if;
 return new;
end; $$;
revoke all on function public.check_ho_fuel_purchase_bill() from public,anon,authenticated;
create constraint trigger ho_fuel_purchase_bill_required after insert or update of transaction_type on public.ho_fuel_log
 deferrable initially deferred for each row execute function public.check_ho_fuel_purchase_bill();

-- Service role only, after the API has verified identity and page write permission.
-- Row locks and one transaction make retries safe: an attachment cannot create two purchases.
create function public.save_ho_fuel_purchase(p_user text, p_bill_ids uuid[], p_entry jsonb)
returns bigint language plpgsql security invoker set search_path = '' as $$
declare purchase bigint; bill_count integer;
begin
 if cardinality(p_bill_ids) < 1 or cardinality(p_bill_ids) > 10 or p_bill_ids is null then raise exception 'Bills required'; end if;
 perform id from public.ho_fuel_bills where id = any(p_bill_ids) order by id for update;
 select count(*) into bill_count from public.ho_fuel_bills b join storage.objects o
 on o.bucket_id='ho-fuel-bills' and o.name=b.file_path
 where b.id=any(p_bill_ids) and b.uploaded_by=p_user and b.purchase_id is null;
 if bill_count <> cardinality(p_bill_ids) then raise exception 'Invalid or already used bills'; end if;
 if (p_entry->>'date')::date > (now() at time zone 'Asia/Kolkata')::date
 or (p_entry->>'qty_l')::numeric <= 0 or (p_entry->>'amount')::numeric <= 0
 then raise exception 'Invalid purchase'; end if;
 insert into public.ho_fuel_log(date,month,year,transaction_type,fuel_type,source,vehicle_number,vehicle_name,estate,qty_l,amount,mode_of_payment,receiver_name,remarks)
 values ((p_entry->>'date')::date,extract(month from (p_entry->>'date')::date),extract(year from (p_entry->>'date')::date),'PURCHASE',p_entry->>'fuel_type',p_entry->>'source','','','',(p_entry->>'qty_l')::numeric,(p_entry->>'amount')::numeric,p_entry->>'mode_of_payment','',p_entry->>'remarks') returning id into purchase;
 update public.ho_fuel_bills set purchase_id=purchase where id=any(p_bill_ids);
 return purchase;
end; $$;
revoke all on function public.save_ho_fuel_purchase(text,uuid[],jsonb) from public,anon,authenticated;
grant execute on function public.save_ho_fuel_purchase(text,uuid[],jsonb) to service_role;

-- Explicit user request: remove only the 200 L diesel purchase of 04/12/2026, Rs 19,364.
-- Refuse ambiguous matches. A missing row is safe on rerun.
do $$
declare matches integer;
begin
 select count(*) into matches from public.ho_fuel_log
 where date='2026-12-04' and transaction_type='PURCHASE' and fuel_type='DIESEL' and qty_l=200 and amount=19364;
 if matches > 1 then raise exception 'Multiple matches: inspect before removing'; end if;
end $$;
delete from public.ho_fuel_log where date='2026-12-04' and transaction_type='PURCHASE' and fuel_type='DIESEL' and qty_l=200 and amount=19364 returning *;

commit;
-- Expected: remaining_december_diesel = 0; private_bill_bucket = true.
select count(*) as remaining_december_diesel from public.ho_fuel_log
where date='2026-12-04' and transaction_type='PURCHASE' and fuel_type='DIESEL' and qty_l=200 and amount=19364;
select not public as private_bill_bucket from storage.buckets where id='ho-fuel-bills';
