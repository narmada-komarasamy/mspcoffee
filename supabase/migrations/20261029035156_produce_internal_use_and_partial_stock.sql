-- Preserve received quantities; allocation counters track sales and internal use.
alter table public.produce_store_items
  add column if not exists allocated_quantity numeric(12,3) not null default 0,
  add column if not exists allocated_weight_kg numeric(12,3) not null default 0,
  add constraint produce_store_allocations_check check (
    allocated_quantity >= 0 and allocated_quantity <= quantity and
    allocated_weight_kg >= 0 and allocated_weight_kg <= weight_kg
  );
alter table public.produce_sales add column if not exists recipient_name text not null default '';
alter table public.produce_sales drop constraint if exists produce_sales_sale_type_check;
alter table public.produce_sales add constraint produce_sales_sale_type_check check (
  sale_type in ('Charged Sale', 'Complementary', 'Replacement', 'MSP Coffee Processing', 'Bungalow Consumption')
);
alter table public.produce_sales add constraint produce_internal_use_zero_check check (
  sale_type not in ('MSP Coffee Processing', 'Bungalow Consumption') or
  (rate_per_kg = 0 and produce_amount = 0 and courier_packing = 0 and total_amount = 0 and length(trim(recipient_name)) > 0)
);

create or replace function public.record_produce_sale(p_payload jsonb)
returns jsonb language plpgsql security invoker
set search_path = public, pg_temp
as $function$
declare
  item public.produce_store_items%rowtype;
  saved public.produce_sales%rowtype;
  customer_uuid uuid;
  actor uuid := (p_payload->>'actor_id')::uuid;
  actor_name text := p_payload->>'actor_name';
  kind text := p_payload->>'sale_type';
  internal boolean := kind in ('MSP Coffee Processing', 'Bungalow Consumption');
  used_qty numeric(12,3) := (p_payload->>'pieces_sold')::numeric;
  used_weight numeric(12,3) := (p_payload->>'weight_sold_kg')::numeric;
  qty_left numeric(12,3);
  weight_left numeric(12,3);
  rate numeric(12,2) := case when kind='Charged Sale' then (p_payload->>'rate_per_kg')::numeric else 0 end;
  courier numeric(12,2) := case when internal then 0 else (p_payload->>'courier_packing')::numeric end;
  amount numeric(12,2);
  next_status text;
  recipient text := coalesce(trim(p_payload->>'recipient_name'), '');
begin
  if actor is null then raise exception 'An authenticated staff member is required'; end if;
  if used_qty is null or used_weight is null or used_qty < 0 or used_weight < 0 or (used_qty = 0 and used_weight = 0) then
    raise exception 'Enter a positive quantity or weight';
  end if;
  if internal and recipient = '' then raise exception 'Enter the person receiving the fruit'; end if;
  select * into item from public.produce_store_items
    where id=(p_payload->>'store_item_id')::uuid for update;
  if not found then raise exception 'Produce token was not found'; end if;
  if item.status not in ('In Store','Reserved','Cold Storage') then
    raise exception 'This produce token is no longer available';
  end if;
  qty_left := item.quantity - item.allocated_quantity;
  weight_left := item.weight_kg - item.allocated_weight_kg;
  if used_qty > qty_left or used_weight > weight_left then
    raise exception 'Quantity or weight exceeds remaining stock. Refresh and try again';
  end if;
  if (qty_left > 0 and used_qty = 0) or (weight_left > 0 and used_weight = 0) then
    raise exception 'Enter both quantity and weight used when both are tracked';
  end if;
  if qty_left > 0 and weight_left > 0 and ((used_qty = qty_left) <> (used_weight = weight_left)) then
    raise exception 'Using all pieces requires the full remaining weight, and vice versa';
  end if;
  qty_left := qty_left - used_qty;
  weight_left := weight_left - used_weight;
  next_status := case when qty_left = 0 and weight_left = 0
    then case when internal then 'Internal Consumption' else 'Sold' end else item.status end;
  amount := used_weight * rate;

  if not internal and coalesce(p_payload->>'buyer_phone','') <> '' then
    insert into public.produce_customers as existing (
      phone, name, email, address, default_dispatch_method, default_payment_mode,
      last_sale_at, created_by, created_by_name, updated_by
    ) values (
      p_payload->>'buyer_phone', p_payload->>'buyer_name', coalesce(p_payload->>'buyer_email',''),
      nullif(p_payload->>'buyer_address',''), p_payload->>'dispatch_method', p_payload->>'payment_mode',
      now(), actor, actor_name, actor
    ) on conflict(phone) do update set
      name=excluded.name,
      email=case when coalesce((p_payload->>'email_supplied')::boolean,false) then excluded.email else existing.email end,
      address=excluded.address, default_dispatch_method=excluded.default_dispatch_method,
      default_payment_mode=excluded.default_payment_mode, last_sale_at=excluded.last_sale_at, updated_by=actor
    returning id into customer_uuid;
  end if;

  insert into public.produce_sales (
    store_item_id, store_item_code, customer_id, sale_date, sale_type, recipient_name,
    buyer_name, buyer_phone, buyer_email, buyer_address, dispatch_method, estate, product,
    pieces_sold, weight_sold_kg, rate_per_kg, produce_amount, courier_packing, total_amount,
    payment_status, payment_mode, payment_notes, notes, closed_at, created_by, created_by_name, updated_by
  ) values (
    item.id, item.item_code, customer_uuid, (p_payload->>'sale_date')::date, kind, recipient,
    case when internal then recipient else p_payload->>'buyer_name' end,
    case when internal then null else nullif(p_payload->>'buyer_phone','') end,
    case when internal then '' else coalesce(p_payload->>'buyer_email','') end,
    case when internal then null else nullif(p_payload->>'buyer_address','') end,
    case when internal then 'Internal use' else p_payload->>'dispatch_method' end, item.estate, item.product,
    used_qty, used_weight, rate, amount, courier, amount+courier,
    case when kind <> 'Charged Sale' then 'Paid' else p_payload->>'payment_status' end,
    p_payload->>'payment_mode', case when internal then null else nullif(p_payload->>'payment_notes','') end,
    nullif(p_payload->>'notes',''),
    case when kind <> 'Charged Sale' or p_payload->>'payment_status'='Paid' then now() else null end,
    actor, actor_name, actor
  ) returning * into saved;

  update public.produce_store_items set
    allocated_quantity=allocated_quantity+used_qty,
    allocated_weight_kg=allocated_weight_kg+used_weight,
    status=next_status, updated_by=actor
    where id=item.id;
  insert into public.produce_store_movements (
    store_item_id, movement_type, from_status, to_status, notes, actor_id, actor_name
  ) values (
    item.id, case when next_status=item.status then 'Adjustment' else 'Status Change' end,
    item.status, next_status,
    format('%s: %s units / %s kg to %s on %s. Record %s. Remaining %s units / %s kg. %s',
      kind, used_qty, used_weight, p_payload->>'buyer_name', p_payload->>'sale_date', saved.id,
      qty_left, weight_left, coalesce(p_payload->>'notes','')),
    actor, actor_name
  );
  return to_jsonb(saved);
end;
$function$;

-- Only the authenticated server route may invoke this transaction.
revoke all on function public.record_produce_sale(jsonb) from public, anon, authenticated;
grant execute on function public.record_produce_sale(jsonb) to service_role;
