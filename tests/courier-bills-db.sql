-- Run against the linked Supabase database as an administrative SQL role.
-- Synthetic bill, storage metadata, dispatch and payment are always rolled back.
begin;
set local role service_role;
DO $test$
declare actor text; bill_id uuid:=gen_random_uuid(); payment_id uuid:=gen_random_uuid(); contact uuid; shipment uuid:=gen_random_uuid(); inv jsonb; links jsonb; stamp timestamptz; caught boolean; v integer;
begin
 select id::text into actor from public.app_users where lower(role)='admin' limit 1;
 insert into public.courier_recipients(data) values(jsonb_build_object('name','TEMP bill workflow verification','phone','','address','Test only','city','TestCity')) returning id into contact;
 insert into public.courier_shipments(id,recipient_id,data,created_by) values(shipment,contact,jsonb_build_object('recipientName','TEMP bill workflow verification','sent','2026-10-01','courier','DHL','tracking','TEST-'||shipment::text,'city','TestCity','cost',null,'paymentStatus','Not recorded'),'courier-bill-test') returning updated_at into stamp;
 insert into storage.objects(bucket_id,name) values('courier-bills',bill_id::text||'/test.pdf');
 inv=jsonb_build_object('courier','DHL','currency','INR','invoiceNumber','TEST-'||bill_id::text,'invoiceDate','2026-10-02','periodFrom','2026-10-01','periodTo','2026-10-01','billedTo','Test account','subtotal',100,'fuel',0,'cgst',0,'sgst',0,'igst',0,'other',0,'rounding',0,'total',100,'warnings','[]'::jsonb,'lines',jsonb_build_array(jsonb_build_object('id','line-1','tracking','TEST-'||shipment::text,'sent','2026-10-01','destination','TestCity','amount',100)));
 perform public.save_courier_bill(bill_id,inv,bill_id::text||'/test.pdf',repeat('a',64),actor,null);
 perform public.save_courier_bill(bill_id,inv,bill_id::text||'/test.pdf',repeat('a',64),actor,null);

 links=jsonb_build_array(jsonb_build_object('lineId','line-1','shipmentId',shipment,'updatedAt',stamp));
 caught=false;begin perform public.approve_courier_bill(bill_id,1,'not-an-approver',links,'[]'::jsonb,'Checked original for verification');exception when insufficient_privilege then caught=true;end;
 if not caught then raise exception 'Unauthorized approval was accepted'; end if;
 perform public.approve_courier_bill(bill_id,1,actor,links,coalesce((select jsonb_agg(jsonb_build_object('shipmentId',s.id,'reason','Temporary verification deferral only')) from public.courier_shipments s where s.id<>shipment and public.courier_company_key(s.data->>'courier')='dhl' and s.data->>'sent'='2026-10-01'),'[]'::jsonb),'Original bill checked for verification');
 caught=false;begin perform public.save_courier_bill(bill_id,inv,bill_id::text||'/test.pdf',repeat('a',64),actor,2);exception when check_violation then caught=true;end;
 if not caught then raise exception 'Approved bill editing was accepted'; end if;
 caught=false;begin update public.courier_shipments set data=data||'{"cost":12}'::jsonb where id=shipment;exception when check_violation then caught=true;end;
 if not caught then raise exception 'Approved shipment mutation was accepted'; end if;
 perform public.pay_courier_bill(bill_id,payment_id,actor,current_date,100,0,'','Bank transfer','TEST-'||payment_id::text);
 perform public.pay_courier_bill(bill_id,payment_id,actor,current_date,100,0,'','Bank transfer','TEST-'||payment_id::text);
 caught=false;begin perform public.pay_courier_bill(bill_id,payment_id,actor,current_date,99,1,'Changed deduction on retry','Bank transfer','TEST-'||payment_id::text);exception when serialization_failure then caught=true;end;
 if not caught then raise exception 'Changed payment details were silently accepted on retry'; end if;
 caught=false;begin perform public.pay_courier_bill(bill_id,gen_random_uuid(),actor,current_date,100,0,'','Bank transfer','TEST-other');exception when unique_violation then caught=true;end;
 if not caught then raise exception 'Second payment was accepted'; end if;
 if (select status from public.courier_bills b where b.id=bill_id)<>'paid' then raise exception 'Payment did not persist';end if;
end $test$;
rollback;
