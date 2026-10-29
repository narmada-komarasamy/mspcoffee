
create table public.courier_recipients (
 id uuid primary key default gen_random_uuid(),
 data jsonb not null check(jsonb_typeof(data)='object' and length(data->>'name')>0),
 fingerprint text generated always as (md5(lower(regexp_replace(coalesce(data->>'name','') || '|' || coalesce(data->>'phone','') || '|' || coalesce(data->>'address','') || '|' || coalesce(data->>'city',''), '\s+', ' ', 'g')))) stored unique,
 review_required boolean not null default false,
 created_at timestamptz not null default now()
);
create table public.courier_shipments (
 id uuid primary key default gen_random_uuid(),
 recipient_id uuid not null references public.courier_recipients(id),
 data jsonb not null check(jsonb_typeof(data)='object' and length(data->>'recipientName')>0),
 receipt_path text,
 source_ref text unique,
 review_required boolean not null default false,
 created_by text not null,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index courier_shipments_recipient_idx on public.courier_shipments(recipient_id);
create index courier_shipments_sent_idx on public.courier_shipments((data->>'sent'));
create unique index courier_tracking_unique on public.courier_shipments (
 lower(regexp_replace(data->>'courier','\s+','','g')),
 lower(regexp_replace(data->>'tracking','\s+','','g'))
) where coalesce(data->>'tracking','') <> '';
create table public.courier_audit (
 id bigint generated always as identity primary key,
 shipment_id uuid not null references public.courier_shipments(id),
 actor text not null,
 previous_data jsonb,
 saved_data jsonb not null,
 created_at timestamptz not null default now()
);
alter table public.courier_recipients enable row level security;
alter table public.courier_shipments enable row level security;
alter table public.courier_audit enable row level security;
revoke all on public.courier_recipients,public.courier_shipments,public.courier_audit from anon,authenticated;
grant all on public.courier_recipients,public.courier_shipments,public.courier_audit to service_role;
grant usage,select on sequence public.courier_audit_id_seq to service_role;
create function public.save_courier_shipment(
 p_id uuid,p_data jsonb,p_recipient_id uuid,p_update_contact boolean,p_actor text,p_expected timestamptz,p_new boolean,p_reviewed boolean
) returns uuid language plpgsql security invoker set search_path=public,pg_temp as $$
declare old_row public.courier_shipments; contact_id uuid; contact jsonb;
begin
 perform pg_advisory_xact_lock(hashtextextended(p_id::text,0));
 select * into old_row from public.courier_shipments where id=p_id for update;
 if found then
   if p_new then return p_id; end if;
   if p_expected is null or old_row.updated_at <> p_expected then raise exception 'Shipment changed' using errcode='40001'; end if;
 elsif not p_new then raise exception 'Shipment missing' using errcode='40001';
 end if;
 if old_row.source_ref is not null then p_data=p_data || jsonb_build_object('sourceNotes',old_row.data->>'sourceNotes','registerBy',old_row.data->>'registerBy'); end if;
 contact=jsonb_build_object('name',p_data->>'recipientName','phone',p_data->>'phone','address',p_data->>'address','city',p_data->>'city');
 if p_recipient_id is not null then
   select id into contact_id from public.courier_recipients where id=p_recipient_id;
   if contact_id is null then raise exception 'Recipient missing'; end if;
   if p_update_contact then update public.courier_recipients set data=contact where id=contact_id; end if;
 else
   insert into public.courier_recipients(data) values(contact)
   on conflict(fingerprint) do update set data=courier_recipients.data returning id into contact_id;
 end if;
 insert into public.courier_shipments(id,recipient_id,data,created_by) values(p_id,contact_id,p_data,p_actor)
 on conflict(id) do update set recipient_id=excluded.recipient_id,data=excluded.data,updated_at=clock_timestamp(),
 review_required=case when p_reviewed then false else courier_shipments.review_required end;
 insert into public.courier_audit(shipment_id,actor,previous_data,saved_data) values(p_id,p_actor,old_row.data,p_data);
 return p_id;
end $$;
revoke all on function public.save_courier_shipment(uuid,jsonb,uuid,boolean,text,timestamptz,boolean,boolean) from public,anon,authenticated;
grant execute on function public.save_courier_shipment(uuid,jsonb,uuid,boolean,text,timestamptz,boolean,boolean) to service_role;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('courier-receipts','courier-receipts',false,4194304,array['application/pdf','image/jpeg','image/png','image/webp']) on conflict(id) do nothing;

