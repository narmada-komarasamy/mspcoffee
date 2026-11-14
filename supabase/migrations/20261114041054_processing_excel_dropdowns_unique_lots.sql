-- Excel-aligned inputs and unique lots. Legacy entries retain their original weight basis.
alter table public.processing_batches
  add column entry_version integer not null default 1 check (entry_version in (1,2)),
  add column harvest_date date,
  add column lot_type text,
  add column quality_code text,
  add column floats_kg numeric(14,3) check (floats_kg between 0 and 10000000),
  add column wet_kg numeric(14,3) check (wet_kg between 0 and 10000000),
  add column drying_surface text not null default '' check (length(drying_surface) <= 100),
  add column storage_location text not null default '' check (length(storage_location) <= 100),
  add column godown_date date,
  add column lot_base text,
  add column lot_sequence integer;
alter table public.processing_batches drop constraint processing_batches_picking_round_check;
alter table public.processing_batches alter column picking_round type text using picking_round::text;
alter table public.processing_batches alter column net_kg set expression as (
  case when entry_version = 2 then gross_kg - floats_kg else gross_kg - tare_kg end
);
alter table public.processing_batches add constraint processing_excel_fields_check check (
  entry_version <> 2 or (
    harvest_date is not null and harvest_date <= processing_date
    and length(btrim(field_name)) > 0
    and length(btrim(variety)) between 1 and 40
    and picking_round is not null and picking_round in ('Fly','1st Round','2nd Round','3rd Round','Stripping','Special','Award','Gleanings')
    and quality_code is not null and lot_type is not null
    and ((lot_type in ('Regular','Gleanings') and quality_code = '2')
      or (lot_type in ('Special','90+ Project') and quality_code = '1')
      or (lot_type = 'For Cupping' and quality_code in ('1','2'))
      or (lot_type = 'Stripping' and quality_code = 'Stripping'))
    and drying_surface !~* '(gowri|^(ge|gwe)\M)' and storage_location !~* '(gowri|^(ge|gwe)\M)'
  )
);
alter table public.processing_batches add constraint processing_floats_check check (
  floats_kg is null or (gross_kg is not null and floats_kg <= gross_kg)
);
alter table public.processing_batches add constraint processing_godown_check check (
  godown_date is null or godown_date >= coalesce(dried_on, processing_date)
);
drop index public.processing_batch_lot_unique;
create unique index processing_batch_lot_unique on public.processing_batches (season_id, lower(btrim(lot_number)));

create table public.processing_lot_counters (
  season_id text not null references public.processing_seasons(id),
  base_key text not null,
  last_sequence integer not null check (last_sequence > 0),
  primary key (season_id, base_key)
);
alter table public.processing_lot_counters enable row level security;
revoke all on public.processing_lot_counters from public, anon, authenticated, service_role;
grant select, insert, update on public.processing_lot_counters to service_role;

create function public.processing_assign_lot() returns trigger
language plpgsql security invoker set search_path = '' as $$
declare
  estate_code text;
  generated_base text;
  next_sequence integer;
  season_start date;
  months text[] := array['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
begin
  if tg_op = 'UPDATE' and old.entry_version = 2 and new.entry_version <> 2 then
    raise exception 'Reload the updated register before editing this batch.';
  end if;
  if new.entry_version <> 2 then return new; end if;
  select start_date into season_start from public.processing_seasons where id = new.season_id for share;
  if season_start is null or new.harvest_date is null or new.harvest_date < season_start or new.harvest_date > new.processing_date then
    raise exception 'Harvest date must be between the season start and processing date.';
  end if;
  if new.godown_date > (current_timestamp at time zone 'Asia/Kolkata')::date then
    raise exception 'Godown transfer date cannot be in the future.';
  end if;
  estate_code := case new.estate when 'stanmore-estate' then 'SE' when 'bve' then 'BVE' when 'moganad-estate' then 'ME' when 'orchardale-estate' then 'OE' when 'hidden-falls-estate' then 'HFE' else null end;
  if estate_code is null or new.variety is null or btrim(new.variety) !~ '^[A-Za-z0-9][A-Za-z0-9 ._-]*$' or new.quality_code is null then
    raise exception 'Choose an estate, variety and quality before saving.';
  end if;
  new.variety := btrim(new.variety);
  generated_base := estate_code || to_char(new.harvest_date,'DD') || months[extract(month from new.harvest_date)::integer] || to_char(new.harvest_date,'YY') || new.variety || new.quality_code;
  if tg_op = 'UPDATE' and old.entry_version = 2 and lower(old.lot_base) = lower(generated_base) then
    new.lot_number := old.lot_number;
    new.lot_base := old.lot_base;
    new.lot_sequence := old.lot_sequence;
  else
    -- ON CONFLICT serializes concurrent allocations for the same base inside this transaction.
    loop
      insert into public.processing_lot_counters as counter (season_id, base_key, last_sequence)
      values (new.season_id, lower(generated_base), 1)
      on conflict (season_id, base_key) do update set last_sequence = counter.last_sequence + 1
      returning last_sequence into next_sequence;
      new.lot_number := generated_base || '-' || lpad(next_sequence::text, greatest(2,length(next_sequence::text)), '0');
      exit when not exists (select 1 from public.processing_batches where season_id = new.season_id and lower(btrim(lot_number)) = lower(new.lot_number));
    end loop;
    new.lot_base := generated_base;
    new.lot_sequence := next_sequence;
  end if;
  new.tare_kg := null; -- v2 net weight uses floats; legacy tare remains available only on legacy entries.
  new.split_reference := '';
  return new;
end;
$$;
revoke all on function public.processing_assign_lot() from public, anon, authenticated;
grant execute on function public.processing_assign_lot() to service_role;
create trigger processing_batch_lot before insert or update on public.processing_batches for each row execute function public.processing_assign_lot();
