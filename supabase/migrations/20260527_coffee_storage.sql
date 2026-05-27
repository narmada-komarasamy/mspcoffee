-- ============================================================
-- Coffee Storage Central — Supabase Migration
-- MSP Coffee Trading Management
-- 2026-05-27
-- ============================================================
-- Run this in your Supabase SQL editor or via the CLI:
--   supabase db push
-- ============================================================

-- ── 0. Sequences (created first so table DEFAULTs can use them)

create sequence if not exists parchment_batch_seq start 1;
create sequence if not exists green_lot_seq       start 1;
create sequence if not exists coffee_sale_seq     start 1;
create sequence if not exists blend_seq           start 1;
create sequence if not exists audit_log_seq       start 1;


-- ── 1. Parchment Batches (Sheet 1 — Parchment Yard) ────────

create table if not exists public.parchment_batches (
  id              text        primary key default ('P-' || lpad(nextval('parchment_batch_seq')::text, 3, '0')),
  lot             text        not null,
  date            date        not null,
  field           text        not null,
  process         text        not null check (process in ('Bag Natural', 'Regular Washed', 'Watermelon Washed')),
  cherry_kg       numeric     not null default 0,
  floats_kg       numeric     not null default 0,
  nett_kg         numeric     not null default 0,
  parch_kg        numeric     not null default 0,
  rate_per_kg     numeric     not null default 0,
  status          text        not null default 'yard' check (status in ('yard', 'at-mill', 'milled', 'depleted')),
  bin             text,
  grade           text,
  score           numeric,
  notes           text,
  tasting_notes   text,
  -- milling fields (populated when sent to mill)
  sent_to_mill    date,
  expected_return date,
  miller          text,
  expected_green_kg numeric,
  truck_ref       text,
  -- metadata
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists parchment_batches_status_idx  on public.parchment_batches (status);
create index if not exists parchment_batches_field_idx   on public.parchment_batches (field);
create index if not exists parchment_batches_process_idx on public.parchment_batches (process);
create index if not exists parchment_batches_date_idx    on public.parchment_batches (date desc);


-- ── 2. Green Coffee Lots (Sheet 2 — Green Store) ───────────

create table if not exists public.green_lots (
  id            text        primary key default ('G-' || lpad(nextval('green_lot_seq')::text, 3, '0')),
  lot           text        not null,
  derived_from  text[]      not null default '{}',
  green_kg_in   numeric     not null default 0,
  current_kg    numeric     not null default 0,
  rate_per_kg   numeric     not null default 0,
  process       text        not null,
  field         text        not null,
  grade         text        not null default '',
  screen        text        not null default '',
  score         numeric,
  milled_date   date        not null,
  warehouse     text        not null default '',
  status        text        not null default 'in-stock' check (status in ('in-stock', 'reserved', 'depleted')),
  notes         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists green_lots_status_idx  on public.green_lots (status);
create index if not exists green_lots_field_idx   on public.green_lots (field);
create index if not exists green_lots_process_idx on public.green_lots (process);


-- ── 3. Coffee Sales ────────────────────────────────────────

create table if not exists public.coffee_sales (
  id              text        primary key default ('S-' || lpad(nextval('coffee_sale_seq')::text, 3, '0')),
  date            date        not null,
  channel         text        not null check (channel in ('exporter', 'cafe', 'internal-roast', 'retail')),
  customer        text        not null,
  green_lot_ids   text[]      not null default '{}',
  kg              numeric     not null,
  price_per_kg    numeric     not null,
  currency        text        not null default 'INR',
  status          text        not null default 'pending' check (status in ('pending', 'shipped', 'transferred')),
  incoterm        text,
  reference       text,
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists coffee_sales_channel_idx  on public.coffee_sales (channel);
create index if not exists coffee_sales_date_idx     on public.coffee_sales (date desc);
create index if not exists coffee_sales_customer_idx on public.coffee_sales (customer);


-- ── 4. Blends ──────────────────────────────────────────────

create table if not exists public.blends (
  id                       text        primary key default ('B-' || lpad(nextval('blend_seq')::text, 3, '0')),
  name                     text        not null,
  description              text,
  total_kg                 numeric     not null default 0,
  status                   text        not null default 'draft' check (status in ('draft', 'active', 'retired')),
  target_sell_price_per_kg numeric     not null default 0,
  created_date             date        not null default current_date,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);


-- ── 5. Blend Recipe Items ──────────────────────────────────

create table if not exists public.blend_recipe_items (
  id           serial      primary key,
  blend_id     text        not null references public.blends (id) on delete cascade,
  green_lot_id text        not null references public.green_lots (id),
  kg           numeric     not null,
  created_at   timestamptz not null default now()
);

create index if not exists blend_recipe_items_blend_idx on public.blend_recipe_items (blend_id);


-- ── 6. Audit Log ───────────────────────────────────────────

create table if not exists public.coffee_audit_log (
  id      text        primary key default ('A-' || lpad(nextval('audit_log_seq')::text, 5, '0')),
  ts      timestamptz not null default now(),
  actor   text        not null,
  action  text        not null check (action in (
            'batch-created', 'sent-to-mill', 'milling-return',
            'weight-adjust', 'transfer',     'sale-created',
            'blend-created', 'blend-produced'
          )),
  entity  text        not null,
  before  text,
  after   text,
  note    text
);

create index if not exists coffee_audit_log_ts_idx     on public.coffee_audit_log (ts desc);
create index if not exists coffee_audit_log_entity_idx on public.coffee_audit_log (entity);
create index if not exists coffee_audit_log_action_idx on public.coffee_audit_log (action);


-- ── 7. Updated-at triggers ────────────────────────────────

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$ begin
  if not exists (select 1 from pg_trigger where tgname = 'parchment_batches_updated_at') then
    create trigger parchment_batches_updated_at
      before update on public.parchment_batches
      for each row execute function public.set_updated_at();
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_trigger where tgname = 'green_lots_updated_at') then
    create trigger green_lots_updated_at
      before update on public.green_lots
      for each row execute function public.set_updated_at();
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_trigger where tgname = 'coffee_sales_updated_at') then
    create trigger coffee_sales_updated_at
      before update on public.coffee_sales
      for each row execute function public.set_updated_at();
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_trigger where tgname = 'blends_updated_at') then
    create trigger blends_updated_at
      before update on public.blends
      for each row execute function public.set_updated_at();
  end if;
end $$;


-- ── 8. Row-Level Security ──────────────────────────────────

alter table public.parchment_batches  enable row level security;
alter table public.green_lots         enable row level security;
alter table public.coffee_sales       enable row level security;
alter table public.blends             enable row level security;
alter table public.blend_recipe_items enable row level security;
alter table public.coffee_audit_log   enable row level security;

-- Drop policies if they already exist (safe to re-run)
drop policy if exists "Authenticated users can read parchment_batches"  on public.parchment_batches;
drop policy if exists "Authenticated users can write parchment_batches" on public.parchment_batches;
drop policy if exists "Authenticated users can read green_lots"         on public.green_lots;
drop policy if exists "Authenticated users can write green_lots"        on public.green_lots;
drop policy if exists "Authenticated users can read coffee_sales"       on public.coffee_sales;
drop policy if exists "Authenticated users can write coffee_sales"      on public.coffee_sales;
drop policy if exists "Authenticated users can read blends"             on public.blends;
drop policy if exists "Authenticated users can write blends"            on public.blends;
drop policy if exists "Authenticated users can read blend_recipe_items" on public.blend_recipe_items;
drop policy if exists "Authenticated users can write blend_recipe_items" on public.blend_recipe_items;
drop policy if exists "Authenticated users can read coffee_audit_log"   on public.coffee_audit_log;
drop policy if exists "Authenticated users can write coffee_audit_log"  on public.coffee_audit_log;

create policy "Authenticated users can read parchment_batches"
  on public.parchment_batches for select to authenticated using (true);
create policy "Authenticated users can write parchment_batches"
  on public.parchment_batches for all to authenticated using (true) with check (true);

create policy "Authenticated users can read green_lots"
  on public.green_lots for select to authenticated using (true);
create policy "Authenticated users can write green_lots"
  on public.green_lots for all to authenticated using (true) with check (true);

create policy "Authenticated users can read coffee_sales"
  on public.coffee_sales for select to authenticated using (true);
create policy "Authenticated users can write coffee_sales"
  on public.coffee_sales for all to authenticated using (true) with check (true);

create policy "Authenticated users can read blends"
  on public.blends for select to authenticated using (true);
create policy "Authenticated users can write blends"
  on public.blends for all to authenticated using (true) with check (true);

create policy "Authenticated users can read blend_recipe_items"
  on public.blend_recipe_items for select to authenticated using (true);
create policy "Authenticated users can write blend_recipe_items"
  on public.blend_recipe_items for all to authenticated using (true) with check (true);

create policy "Authenticated users can read coffee_audit_log"
  on public.coffee_audit_log for select to authenticated using (true);
create policy "Authenticated users can write coffee_audit_log"
  on public.coffee_audit_log for all to authenticated using (true) with check (true);
