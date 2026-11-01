create table public.courier_bill_approvers (
 actor_id text primary key,
 assigned_by text not null,
 assigned_at timestamptz not null default now()
);
create table public.courier_bills (
 id uuid primary key,
 courier_key text not null check(courier_key in ('professional','dtdc','dhl')),
 invoice_key text not null check(length(invoice_key)>0),
 invoice jsonb not null check(jsonb_typeof(invoice)='object'),
 original_extraction jsonb not null,
 original_path text not null unique,
 original_hash text not null unique check(original_hash ~ '^[a-f0-9]{64}$'),
 status text not null default 'draft' check(status in ('draft','approved','paid')),
 version integer not null default 1,
 approval_snapshot jsonb,
 approved_by text,
 approved_at timestamptz,
 created_by text not null,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(courier_key,invoice_key)
);
create table public.courier_bill_links (
 bill_id uuid not null references public.courier_bills(id),
 line_id text not null,
 shipment_id uuid not null unique references public.courier_shipments(id),
 shipment_snapshot jsonb not null,
 primary key(bill_id,line_id)
);
create table public.courier_bill_payments (
 id uuid primary key,
 bill_id uuid not null unique references public.courier_bills(id),
 paid_on date not null,
 amount numeric(14,2) not null check(amount>0),
 deduction numeric(14,2) not null default 0 check(deduction>=0),
 deduction_reason text not null default '',
 method text not null check(method in ('Bank transfer','Cheque','Cash','Other')),
 reference text not null check(length(trim(reference))>0),
 recorded_by text not null,
 recorded_at timestamptz not null default now()
);
create unique index courier_bill_payment_reference on public.courier_bill_payments(method,lower(regexp_replace(reference,'\s+','','g')));
create table public.courier_bill_events (
 id bigint generated always as identity primary key,
 bill_id uuid not null references public.courier_bills(id),
 actor_id text not null,
 action text not null check(action in ('created','edited','approved','paid')),
 previous_data jsonb,
 saved_data jsonb not null,
 created_at timestamptz not null default now()
);
alter table public.courier_bill_approvers enable row level security;
alter table public.courier_bills enable row level security;
alter table public.courier_bill_links enable row level security;
alter table public.courier_bill_payments enable row level security;
alter table public.courier_bill_events enable row level security;
revoke all on public.courier_bill_approvers,public.courier_bills,public.courier_bill_links,public.courier_bill_payments,public.courier_bill_events from public,anon,authenticated;
grant select on public.courier_bill_approvers to service_role;
grant select,insert,update on public.courier_bills to service_role;
grant select,insert on public.courier_bill_links,public.courier_bill_payments,public.courier_bill_events to service_role;
grant usage,select on sequence public.courier_bill_events_id_seq to service_role;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('courier-bills','courier-bills',false,4194304,array['application/pdf','image/jpeg','image/png','image/webp']) on conflict(id) do nothing;

create function public.courier_company_key(value text) returns text language sql immutable security invoker set search_path=public,pg_temp as $$
 select case lower(regexp_replace(coalesce(value,''),'[^a-zA-Z0-9]','','g'))
 when 'professionalcourier' then 'professional' when 'professionalcouriers' then 'professional' when 'theprofessionalcouriers' then 'professional' when 'tpc' then 'professional'
 when 'ddtc' then 'dtdc' else lower(regexp_replace(coalesce(value,''),'[^a-zA-Z0-9]','','g')) end
$$;
create function public.courier_can_approve_bill(p_actor text) returns boolean language sql stable security invoker set search_path=public,pg_temp as $$
 select exists(select 1 from public.app_users u where u.id::text=p_actor and coalesce((to_jsonb(u)->>'active')::boolean,true) and (lower(trim(u.role))='admin' or exists(select 1 from public.courier_bill_approvers a where a.actor_id=p_actor)))
 or exists(select 1 from public.profiles p where p.id::text=p_actor and coalesce((to_jsonb(p)->>'active')::boolean,true) and (lower(trim(p.role))='admin' or exists(select 1 from public.courier_bill_approvers a where a.actor_id=p_actor)))
$$;
create function public.save_courier_bill(p_id uuid,p_invoice jsonb,p_path text,p_hash text,p_actor text,p_expected integer default null)
returns uuid language plpgsql security invoker set search_path=public,pg_temp as $$
declare old public.courier_bills; company text; invoice_no text; saved public.courier_bills;
begin
 perform pg_advisory_xact_lock(hashtextextended(p_id::text,0));
 select * into old from public.courier_bills where id=p_id for update;
 if found then
  if p_expected is null and old.original_hash=p_hash then return p_id; end if;
  if old.status<>'draft' then raise exception 'Approved bills are locked.' using errcode='23514'; end if;
  if p_expected is null or old.version<>p_expected then raise exception 'Bill changed. Reload before saving.' using errcode='40001'; end if;
  p_path=old.original_path; p_hash=old.original_hash;
 elsif p_expected is not null then raise exception 'Bill missing.' using errcode='40001';
 end if;
 company=public.courier_company_key(p_invoice->>'courier');
 invoice_no=lower(regexp_replace(coalesce(p_invoice->>'invoiceNumber',''),'[^a-zA-Z0-9]','','g'));
 if company not in ('professional','dtdc','dhl') or invoice_no='' or coalesce(p_invoice->>'billedTo','')='' or p_invoice->>'currency'<>'INR' or jsonb_typeof(p_invoice->'lines')<>'array' or jsonb_array_length(p_invoice->'lines')>500 then raise exception 'Confirm courier, INR currency, invoice number, billed company and line items.' using errcode='23514'; end if;
 if not exists(select 1 from storage.objects where bucket_id='courier-bills' and name=p_path) or split_part(p_path,'/',1)<>p_id::text then raise exception 'Original bill is not stored privately.' using errcode='23514'; end if;
 insert into public.courier_bills(id,courier_key,invoice_key,invoice,original_extraction,original_path,original_hash,created_by)
 values(p_id,company,invoice_no,p_invoice,p_invoice,p_path,p_hash,p_actor)
 on conflict(id) do update set courier_key=excluded.courier_key,invoice_key=excluded.invoice_key,invoice=excluded.invoice,version=courier_bills.version+1,updated_at=clock_timestamp()
 returning * into saved;
 insert into public.courier_bill_events(bill_id,actor_id,action,previous_data,saved_data) values(p_id,p_actor,case when old.id is null then 'created' else 'edited' end,case when old.id is null then null else to_jsonb(old) end,to_jsonb(saved));
 return p_id;
end $$;

create function public.approve_courier_bill(p_id uuid,p_version integer,p_actor text,p_links jsonb,p_deferrals jsonb,p_note text)
returns uuid language plpgsql security invoker set search_path=public,pg_temp as $$
declare bill public.courier_bills; item jsonb; line jsonb; ship public.courier_shipments; amount numeric; charges numeric; expected_count integer; saved public.courier_bills;
begin
 if not public.courier_can_approve_bill(p_actor) then raise exception 'Only an assigned bill approver or administrator may approve.' using errcode='42501'; end if;
 select * into bill from public.courier_bills where id=p_id for update;
 if not found then raise exception 'Bill missing.' using errcode='23514'; end if;
 if bill.status<>'draft' or bill.version<>p_version then raise exception 'Bill changed or is already approved. Reload.' using errcode='40001'; end if;
 if length(trim(coalesce(p_note,'')))<10 then raise exception 'Record how you checked the original bill and resolved its warnings.' using errcode='23514'; end if;
 lock table public.courier_shipments in share row exclusive mode;
 if jsonb_typeof(p_links)<>'array' or jsonb_typeof(p_deferrals)<>'array' then raise exception 'Invalid reconciliation.' using errcode='23514'; end if;
 if jsonb_array_length(p_links)<>jsonb_array_length(bill.invoice->'lines') or jsonb_array_length(p_links)=0 or (select count(distinct value->>'lineId') from jsonb_array_elements(p_links))<>jsonb_array_length(p_links) then raise exception 'Every bill line must have one unique dispatch match.' using errcode='23514'; end if;
 select sum((value->>'amount')::numeric) into amount from jsonb_array_elements(bill.invoice->'lines');
 charges=(bill.invoice->>'fuel')::numeric+(bill.invoice->>'cgst')::numeric+(bill.invoice->>'sgst')::numeric+(bill.invoice->>'igst')::numeric+(bill.invoice->>'other')::numeric+(bill.invoice->>'rounding')::numeric;
 if amount is null or charges is null or (bill.invoice->>'subtotal')::numeric is null or (bill.invoice->>'total')::numeric is null or amount<>(bill.invoice->>'subtotal')::numeric or amount+charges<>(bill.invoice->>'total')::numeric then raise exception 'Invoice totals do not balance.' using errcode='23514'; end if;
 if exists(select 1 from jsonb_array_elements(bill.invoice->'lines') l group by upper(regexp_replace(l->>'tracking','\s+','','g')) having count(*)>1) then raise exception 'Duplicate consignment on bill.' using errcode='23514'; end if;
 for item in select value from jsonb_array_elements(p_links) loop
  select value into line from jsonb_array_elements(bill.invoice->'lines') where value->>'id'=item->>'lineId';
  select * into ship from public.courier_shipments where id=(item->>'shipmentId')::uuid for update;
  if line is null or ship.id is null or ship.updated_at is distinct from (item->>'updatedAt')::timestamptz then raise exception 'Dispatch changed. Reload reconciliation.' using errcode='40001'; end if;
  if coalesce(line->>'tracking','')='' or coalesce(line->>'destination','')='' or line->>'amount' is null or upper(regexp_replace(ship.data->>'tracking','\s+','','g')) is distinct from upper(regexp_replace(line->>'tracking','\s+','','g')) or public.courier_company_key(ship.data->>'courier')<>bill.courier_key or ship.data->>'sent' is distinct from line->>'sent' or (line->>'sent')::date<(bill.invoice->>'periodFrom')::date or (line->>'sent')::date>(bill.invoice->>'periodTo')::date or (line->>'amount')::numeric<0 then raise exception 'Dispatch and bill line do not match.' using errcode='23514'; end if;
  if coalesce(ship.data->>'city','')<>'' and lower(trim(ship.data->>'city'))<>lower(trim(line->>'destination')) then raise exception 'Destination mismatch.' using errcode='23514'; end if;
  if line->>'totalIncludingTax' is not null and ship.data->>'cost' is not null and (line->>'totalIncludingTax')::numeric<>(ship.data->>'cost')::numeric then raise exception 'GST-inclusive charge mismatch.' using errcode='23514'; end if;
  insert into public.courier_bill_links(bill_id,line_id,shipment_id,shipment_snapshot) values(p_id,item->>'lineId',ship.id,ship.data);
 end loop;
 -- Each remaining dispatch for this courier/period needs an explicit late-billing note.
 for ship in select * from public.courier_shipments s where public.courier_company_key(s.data->>'courier')=bill.courier_key and s.data->>'sent'>=bill.invoice->>'periodFrom' and s.data->>'sent'<=bill.invoice->>'periodTo' and not exists(select 1 from public.courier_bill_links l where l.shipment_id=s.id) loop
  select value into item from jsonb_array_elements(p_deferrals) where value->>'shipmentId'=ship.id::text;
  if item is null or length(trim(coalesce(item->>'reason','')))<10 then raise exception 'Record a reason for every dispatch absent from the bill.' using errcode='23514'; end if;
 end loop;
 for ship in select s.* from public.courier_shipments s join public.courier_bill_links l on l.shipment_id=s.id where l.bill_id=p_id loop
  update public.courier_shipments set data=data||jsonb_build_object('reconciledBillId',p_id,'reconciledInvoiceNumber',bill.invoice->>'invoiceNumber'),updated_at=clock_timestamp() where id=ship.id;
  insert into public.courier_audit(shipment_id,actor,previous_data,saved_data) values(ship.id,p_actor,ship.data,ship.data||jsonb_build_object('reconciledBillId',p_id,'reconciledInvoiceNumber',bill.invoice->>'invoiceNumber'));
 end loop;
 update public.courier_bills set status='approved',version=version+1,approved_by=p_actor,approved_at=clock_timestamp(),updated_at=clock_timestamp(),approval_snapshot=jsonb_build_object('invoice',invoice,'links',p_links,'deferredDispatches',p_deferrals,'reviewNote',trim(p_note)) where id=p_id returning * into saved;
 insert into public.courier_bill_events(bill_id,actor_id,action,previous_data,saved_data) values(p_id,p_actor,'approved',to_jsonb(bill),to_jsonb(saved));
 return p_id;
end $$;

create function public.pay_courier_bill(p_id uuid,p_payment_id uuid,p_actor text,p_paid_on date,p_amount numeric,p_deduction numeric,p_deduction_reason text,p_method text,p_reference text)
returns uuid language plpgsql security invoker set search_path=public,pg_temp as $$
declare bill public.courier_bills; payment public.courier_bill_payments; ship public.courier_shipments;
begin
 if not public.courier_can_approve_bill(p_actor) then raise exception 'Only an assigned approver or administrator may record payment.' using errcode='42501'; end if;
 select * into bill from public.courier_bills where id=p_id for update;
 select * into payment from public.courier_bill_payments where bill_id=p_id;
 if found then
  if payment.id=p_payment_id then return payment.id; end if;
  raise exception 'This bill already has a payment record.' using errcode='23505';
 end if;
 if bill.id is null or bill.status<>'approved' then raise exception 'Approve the bill before recording payment.' using errcode='23514'; end if;
 if p_paid_on is null or p_paid_on>current_date or p_paid_on<(bill.invoice->>'invoiceDate')::date or p_amount is null or p_amount<=0 or p_deduction is null or p_deduction<0 or p_amount<>round(p_amount,2) or p_deduction<>round(p_deduction,2) or p_amount+p_deduction<>(bill.invoice->>'total')::numeric or (p_deduction>0 and length(trim(coalesce(p_deduction_reason,'')))<10) or length(trim(coalesce(p_reference,'')))<3 or p_method not in ('Bank transfer','Cheque','Cash','Other') then raise exception 'Enter an actual payment date, full settlement amount, method and reference; explain any deduction.' using errcode='23514'; end if;
 insert into public.courier_bill_payments(id,bill_id,paid_on,amount,deduction,deduction_reason,method,reference,recorded_by) values(p_payment_id,p_id,p_paid_on,p_amount,p_deduction,trim(p_deduction_reason),p_method,trim(p_reference),p_actor);
 update public.courier_bills set status='paid',version=version+1,updated_at=clock_timestamp() where id=p_id;
 for ship in select s.* from public.courier_shipments s join public.courier_bill_links l on l.shipment_id=s.id where l.bill_id=p_id for update of s loop
  update public.courier_shipments set data=data||jsonb_build_object('paymentStatus','Paid','courierBillPaymentId',p_payment_id),updated_at=clock_timestamp() where id=ship.id;
  insert into public.courier_audit(shipment_id,actor,previous_data,saved_data) values(ship.id,p_actor,ship.data,ship.data||jsonb_build_object('paymentStatus','Paid','courierBillPaymentId',p_payment_id));
 end loop;
 insert into public.courier_bill_events(bill_id,actor_id,action,previous_data,saved_data) values(p_id,p_actor,'paid',to_jsonb(bill),jsonb_build_object('paymentId',p_payment_id,'paidOn',p_paid_on,'amount',p_amount,'deduction',p_deduction,'deductionReason',p_deduction_reason,'method',p_method,'reference',p_reference));
 return p_payment_id;
end $$;
revoke all on function public.courier_company_key(text),public.courier_can_approve_bill(text),public.save_courier_bill(uuid,jsonb,text,text,text,integer),public.approve_courier_bill(uuid,integer,text,jsonb,jsonb,text),public.pay_courier_bill(uuid,uuid,text,date,numeric,numeric,text,text,text) from public,anon,authenticated;
grant execute on function public.courier_company_key(text),public.courier_can_approve_bill(text),public.save_courier_bill(uuid,jsonb,text,text,text,integer),public.approve_courier_bill(uuid,integer,text,jsonb,jsonb,text),public.pay_courier_bill(uuid,uuid,text,date,numeric,numeric,text,text,text) to service_role;
comment on table public.courier_bill_approvers is 'Explicit account IDs only. Ramesh has no account yet; assign after his account is created. Administrators retain oversight.';

create function public.lock_approved_courier_bill() returns trigger language plpgsql security invoker set search_path=public,pg_temp as $$
begin
 if new.original_path is distinct from old.original_path or new.original_hash is distinct from old.original_hash or new.original_extraction is distinct from old.original_extraction then raise exception 'The original bill cannot be replaced.' using errcode='23514'; end if;
 if old.status<>'draft' and (new.invoice is distinct from old.invoice or new.approval_snapshot is distinct from old.approval_snapshot or new.approved_by is distinct from old.approved_by or new.status='draft') then raise exception 'Approved bill details are locked.' using errcode='23514'; end if;
 if old.status='paid' and new.status<>'paid' then raise exception 'Paid bills are locked.' using errcode='23514'; end if;
 return new;
end $$;
create trigger lock_approved_courier_bill before update on public.courier_bills for each row execute function public.lock_approved_courier_bill();
create function public.lock_billed_courier_shipment() returns trigger language plpgsql security invoker set search_path=public,pg_temp as $$
declare field text;
begin
 if old.data->>'reconciledBillId' is not null then
  foreach field in array array['recipientName','address','city','courier','tracking','sent','onBehalfOf','cost','reconciledBillId','reconciledInvoiceNumber'] loop
   if new.data->field is distinct from old.data->field then raise exception 'Booking details are locked by an approved courier bill.' using errcode='23514'; end if;
  end loop;
  if new.data->>'paymentStatus' is distinct from old.data->>'paymentStatus' and not (new.data->>'paymentStatus'='Paid' and exists(select 1 from public.courier_bill_payments p where p.id::text=new.data->>'courierBillPaymentId' and p.bill_id::text=old.data->>'reconciledBillId')) then raise exception 'Record payment against the approved bill.' using errcode='23514'; end if;
 end if;
 return new;
end $$;
create trigger lock_billed_courier_shipment before update on public.courier_shipments for each row execute function public.lock_billed_courier_shipment();
revoke all on function public.lock_approved_courier_bill(),public.lock_billed_courier_shipment() from public,anon,authenticated;
