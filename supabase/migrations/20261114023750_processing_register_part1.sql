-- Processing register Part 1. Browser access is through authenticated Next.js APIs only.
create table public.processing_seasons (
  id text primary key check (id = '2026-2027'),
  start_date date,
  revision integer not null default 1,
  updated_at timestamptz not null default now(),
  updated_by text not null default 'setup',
  updated_by_name text not null default 'System setup'
);

create table public.processing_batches (
  id uuid primary key,
  season_id text not null references public.processing_seasons(id),
  estate text not null check (estate in ('stanmore-estate','bve','moganad-estate','orchardale-estate','hidden-falls-estate')),
  lot_number text not null check (length(btrim(lot_number)) between 1 and 100),
  split_reference text not null default '' check (length(split_reference) <= 100),
  processing_date date not null,
  product_type text not null check (product_type in ('Dry cherry','Parchment')),
  method text not null check (length(btrim(method)) between 1 and 100),
  stage text not null check (stage in ('Received','Fermenting','Drying','Dried')),
  status text not null check (status in ('In progress','Complete')),
  field_name text not null default '' check (length(field_name) <= 100),
  variety text not null default '' check (length(variety) <= 100),
  picking_round integer check (picking_round between 1 and 1000),
  gross_kg numeric(14,3) check (gross_kg between 0 and 10000000),
  tare_kg numeric(14,3) check (tare_kg between 0 and 10000000),
  net_kg numeric(14,3) generated always as (gross_kg - tare_kg) stored,
  actual_dry_kg numeric(14,3) check (actual_dry_kg between 0 and 10000000),
  brix numeric(7,3) check (brix between 0 and 100),
  ph numeric(7,3) check (ph between 0 and 14),
  moisture numeric(7,3) check (moisture between 0 and 100),
  fermentation_hours numeric(9,3) check (fermentation_hours between 0 and 10000),
  recipe_notes text not null default '' check (length(recipe_notes) <= 2000),
  remarks text not null default '' check (length(remarks) <= 2000),
  dried_on date,
  revision integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by text not null,
  updated_by_name text not null,
  check (tare_kg is null or (gross_kg is not null and tare_kg <= gross_kg)),
  check (actual_dry_kg is null or net_kg is null or actual_dry_kg <= net_kg),
  check (dried_on is null or dried_on >= processing_date),
  check (status <> 'Complete' or (stage = 'Dried' and actual_dry_kg is not null and dried_on is not null and moisture is not null and net_kg > 0 and net_kg is not null))
);
create unique index processing_batch_lot_unique on public.processing_batches (season_id, estate, lower(btrim(lot_number)), lower(btrim(split_reference)));
create index processing_batch_register_idx on public.processing_batches (season_id, processing_date desc, id);

create table public.processing_history (
  id bigint generated always as identity primary key,
  season_id text not null references public.processing_seasons(id),
  batch_id uuid references public.processing_batches(id),
  actor_id text not null,
  actor_name text not null,
  changed_at timestamptz not null default now(),
  before_data jsonb,
  after_data jsonb not null
);
create index processing_history_lookup_idx on public.processing_history (season_id, batch_id, id desc);
create index processing_history_batch_idx on public.processing_history (batch_id);

alter table public.processing_seasons enable row level security;
alter table public.processing_batches enable row level security;
alter table public.processing_history enable row level security;
revoke all on public.processing_seasons, public.processing_batches, public.processing_history from public, anon, authenticated, service_role;
grant select, insert, update on public.processing_seasons, public.processing_batches to service_role;
grant select, insert on public.processing_history to service_role;
grant usage, select on sequence public.processing_history_id_seq to service_role;

create function public.processing_validate_record() returns trigger
language plpgsql security invoker set search_path = '' as $$
declare season_start date;
begin
  if tg_table_name = 'processing_seasons' then
    if new.start_date > (current_timestamp at time zone 'Asia/Kolkata')::date then
      raise exception 'Season start cannot be in the future.';
    end if;
    if tg_op = 'UPDATE' then
      if new.id <> old.id then raise exception 'Season identity cannot change.'; end if;
      if exists (select 1 from public.processing_batches where season_id = old.id and (new.start_date is null or processing_date < new.start_date)) then
        raise exception 'Season start cannot exclude an existing batch. Choose an earlier date.';
      end if;
    end if;
  else
    -- Lock the season while checking it, so a concurrent setup change cannot invalidate a batch.
    select start_date into season_start from public.processing_seasons where id = new.season_id for share;
    if season_start is null then raise exception 'Save the season start date before entering batches.'; end if;
    if new.processing_date < season_start or new.processing_date > (current_timestamp at time zone 'Asia/Kolkata')::date then
      raise exception 'Processing date must be between the season start and today.';
    end if;
    if new.dried_on > (current_timestamp at time zone 'Asia/Kolkata')::date then raise exception 'Drying completion date cannot be in the future.'; end if;
    if tg_op = 'UPDATE' then
      if new.id <> old.id or new.season_id <> old.season_id then raise exception 'Batch identity cannot change.'; end if;
      new.created_at := old.created_at;
    end if;
    new.lot_number := btrim(new.lot_number);
    new.split_reference := btrim(new.split_reference);
  end if;
  new.revision := case when tg_op = 'INSERT' then 1 else old.revision + 1 end;
  new.updated_at := clock_timestamp();
  return new;
end;
$$;

create function public.processing_audit_record() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  insert into public.processing_history (season_id, batch_id, actor_id, actor_name, before_data, after_data)
  values (
    coalesce(to_jsonb(new)->>'season_id', new.id::text),
    case when tg_table_name = 'processing_batches' then new.id::uuid else null end,
    new.updated_by, new.updated_by_name,
    case when tg_op = 'UPDATE' then to_jsonb(old) else null end, to_jsonb(new)
  );
  return new;
end;
$$;
revoke all on function public.processing_validate_record(), public.processing_audit_record() from public, anon, authenticated;
grant execute on function public.processing_validate_record(), public.processing_audit_record() to service_role;
create trigger processing_season_validate before insert or update on public.processing_seasons for each row execute function public.processing_validate_record();
create trigger processing_batch_validate before insert or update on public.processing_batches for each row execute function public.processing_validate_record();
create trigger processing_season_audit after insert or update on public.processing_seasons for each row execute function public.processing_audit_record();
create trigger processing_batch_audit after insert or update on public.processing_batches for each row execute function public.processing_audit_record();

insert into public.processing_seasons (id) values ('2026-2027');
