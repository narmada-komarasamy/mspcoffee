create or replace function public.pay_courier_bill(p_id uuid,p_payment_id uuid,p_actor text,p_paid_on date,p_amount numeric,p_deduction numeric,p_deduction_reason text,p_method text,p_reference text)
returns uuid language plpgsql security invoker set search_path=public,pg_temp as $$
declare bill public.courier_bills; payment public.courier_bill_payments; ship public.courier_shipments;
begin
 if not public.courier_can_approve_bill(p_actor) then raise exception 'Only an assigned approver or administrator may record payment.' using errcode='42501'; end if;
 select * into bill from public.courier_bills where id=p_id for update;
 select * into payment from public.courier_bill_payments where bill_id=p_id;
 if found then
  if payment.id=p_payment_id then
   if payment.paid_on is distinct from p_paid_on or payment.amount is distinct from p_amount or payment.deduction is distinct from p_deduction or payment.deduction_reason is distinct from trim(coalesce(p_deduction_reason,'')) or payment.method is distinct from p_method or payment.reference is distinct from trim(p_reference) then
    raise exception 'A payment was already recorded with different details. Reload the bill.' using errcode='40001';
   end if;
   return payment.id;
  end if;
  raise exception 'This bill already has a payment record.' using errcode='23505';
 end if;
 if bill.id is null or bill.status<>'approved' then raise exception 'Approve the bill before recording payment.' using errcode='23514'; end if;
 if p_paid_on is null or p_paid_on>(now() at time zone 'Asia/Kolkata')::date or p_paid_on<(bill.invoice->>'invoiceDate')::date or p_amount is null or p_amount<=0 or p_deduction is null or p_deduction<0 or p_amount<>round(p_amount,2) or p_deduction<>round(p_deduction,2) or p_amount+p_deduction<>(bill.invoice->>'total')::numeric or (p_deduction>0 and length(trim(coalesce(p_deduction_reason,'')))<10) or length(trim(coalesce(p_reference,'')))<3 or p_method not in ('Bank transfer','Cheque','Cash','Other') then raise exception 'Enter an actual payment date, full settlement amount, method and reference; explain any deduction.' using errcode='23514'; end if;
 insert into public.courier_bill_payments(id,bill_id,paid_on,amount,deduction,deduction_reason,method,reference,recorded_by) values(p_payment_id,p_id,p_paid_on,p_amount,p_deduction,trim(p_deduction_reason),p_method,trim(p_reference),p_actor);
 update public.courier_bills set status='paid',version=version+1,updated_at=clock_timestamp() where id=p_id;
 for ship in select s.* from public.courier_shipments s join public.courier_bill_links l on l.shipment_id=s.id where l.bill_id=p_id for update of s loop
  update public.courier_shipments set data=data||jsonb_build_object('paymentStatus','Paid','courierBillPaymentId',p_payment_id),updated_at=clock_timestamp() where id=ship.id;
  insert into public.courier_audit(shipment_id,actor,previous_data,saved_data) values(ship.id,p_actor,ship.data,ship.data||jsonb_build_object('paymentStatus','Paid','courierBillPaymentId',p_payment_id));
 end loop;
 insert into public.courier_bill_events(bill_id,actor_id,action,previous_data,saved_data) values(p_id,p_actor,'paid',to_jsonb(bill),jsonb_build_object('paymentId',p_payment_id,'paidOn',p_paid_on,'amount',p_amount,'deduction',p_deduction,'deductionReason',p_deduction_reason,'method',p_method,'reference',p_reference));
 return p_payment_id;
end $$;
