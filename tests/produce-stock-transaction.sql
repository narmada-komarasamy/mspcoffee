begin;
do $test$
declare
  actor uuid;
  token uuid := gen_random_uuid();
  weight_token uuid := gen_random_uuid();
  payload jsonb;
  result jsonb;
  row_data public.produce_store_items%rowtype;
  test_phone text := 'transaction-test-' || gen_random_uuid()::text;
  failed boolean;
begin
  select id into actor from public.app_users limit 1;
  if actor is null then raise exception 'Test requires an existing staff ID'; end if;
  insert into public.produce_store_items(id,item_code,received_date,estate,product,unit,quantity,weight_kg,status)
    values(token,'TRANSACTION-TEST-'||token,current_date,'ME','Test fruit','Pieces',10,20,'In Store');
  payload := jsonb_build_object('actor_id',actor,'actor_name','Transaction test',
    'store_item_id',token,'sale_date',current_date,'sale_type','MSP Coffee Processing',
    'recipient_name','Test recipient','buyer_name','Test recipient','buyer_phone','',
    'pieces_sold',2,'weight_sold_kg',4,'rate_per_kg',999,'courier_packing',999,
    'payment_mode','Bank','payment_status','Pending');
  result := public.record_produce_sale(payload);
  assert (result->>'total_amount')::numeric=0, 'Internal use was charged';
  assert (result->>'courier_packing')::numeric=0, 'Courier was charged';
  select * into row_data from public.produce_store_items where id=token;
  assert row_data.quantity=10 and row_data.weight_kg=20, 'Receipt totals changed';
  assert row_data.allocated_quantity=2 and row_data.allocated_weight_kg=4, 'Partial deduction incorrect';
  assert row_data.status='In Store', 'Partial use removed the token';
  result := public.record_produce_sale(payload || '{"sale_type":"Bungalow Consumption","pieces_sold":3,"weight_sold_kg":6}'::jsonb);
  assert result->>'sale_type'='Bungalow Consumption' and (result->>'total_amount')::numeric=0, 'Bungalow usage incorrect';

  failed := false;
  begin perform public.record_produce_sale(payload || '{"pieces_sold":6,"weight_sold_kg":12}'::jsonb);
  exception when raise_exception then failed := true; end;
  assert failed, 'Overconsumption accepted';
  failed := false;
  begin perform public.record_produce_sale(payload || '{"pieces_sold":5,"weight_sold_kg":9}'::jsonb);
  exception when raise_exception then failed := true; end;
  assert failed, 'Mismatched full quantity/weight accepted';
  failed := false;
  begin perform public.record_produce_sale(payload || '{"recipient_name":""}'::jsonb);
  exception when raise_exception then failed := true; end;
  assert failed, 'Missing recipient accepted';

  failed := false;
  begin
    perform public.record_produce_sale(payload || jsonb_build_object('sale_type','Invalid type','buyer_phone',test_phone,'buyer_email','test@example.com','pieces_sold',1,'weight_sold_kg',2));
  exception when check_violation then failed := true; end;
  assert failed, 'Invalid type accepted';
  assert not exists(select 1 from public.produce_customers where phone=test_phone), 'Failed record saved customer';
  assert (select count(*) from public.produce_sales where store_item_id=token)=2, 'Failed save left a record';
  select * into row_data from public.produce_store_items where id=token;
  assert row_data.allocated_quantity=5 and row_data.allocated_weight_kg=10, 'Failed save deducted stock';

  result := public.record_produce_sale(payload || jsonb_build_object('sale_type','Charged Sale','pieces_sold',5,'weight_sold_kg',10,'rate_per_kg',100,'courier_packing',25,'buyer_phone',test_phone,'buyer_email','test@example.com','email_supplied',true,'buyer_name','Test buyer'));
  assert (result->>'total_amount')::numeric=1025, 'Charged sale calculation incorrect';
  assert exists(select 1 from public.produce_customers where phone=test_phone and email='test@example.com'), 'Customer email not saved';
  select * into row_data from public.produce_store_items where id=token;
  assert row_data.allocated_quantity=10 and row_data.allocated_weight_kg=20 and row_data.status='Sold', 'Full deduction incorrect';
  failed := false;
  begin perform public.record_produce_sale(payload);
  exception when raise_exception then failed := true; end;
  assert failed, 'Exhausted token reused';

  insert into public.produce_store_items(id,item_code,received_date,estate,product,unit,quantity,weight_kg,status)
    values(weight_token,'TRANSACTION-TEST-'||weight_token,current_date,'ME','Test bulk','Kg',0,5,'In Store');
  perform public.record_produce_sale(payload || jsonb_build_object('store_item_id',weight_token,'pieces_sold',0,'weight_sold_kg',1));
  assert (select status from public.produce_store_items where id=weight_token)='In Store', 'Partial weight-only use removed stock';
  perform public.record_produce_sale(payload || jsonb_build_object('store_item_id',weight_token,'pieces_sold',0,'weight_sold_kg',4));
  assert (select status from public.produce_store_items where id=weight_token)='Internal Consumption', 'Final internal use was not closed';
end;
$test$;
rollback;
select 'PASS: zero charges, partial/full deductions, overconsumption prevention, rollback, weight-only stock, customer email' as verification;
