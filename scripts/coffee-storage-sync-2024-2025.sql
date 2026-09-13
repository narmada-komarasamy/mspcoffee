do $$
declare
  v_sheetlots numeric;
  v_sheetkg numeric;
  v_sheetvalue numeric;
  v_instocklots numeric;
  v_instockkg numeric;
begin
  create table if not exists public.coffee_storage_sync_backups (
    id text primary key,
    created_at timestamptz not null default now(),
    note text,
    green_lots jsonb not null,
    coffee_sales jsonb not null
  );

  drop table if exists public.coffeesyncsheet;

  create table public.coffeesyncsheet (
    lot text primary key,
    estate text,
    process text,
    grade text,
    screen text,
    score numeric,
    sheetkg numeric not null,
    rateperkg numeric not null
  );

  insert into public.coffeesyncsheet (lot, estate, process, grade, screen, score, sheetkg, rateperkg)
  values
  ('31','MOGANAD ESTATE','Bag Natural','ARABICA','',null,175,900),
  ('106','MOGANAD ESTATE','Bag Natural','ARABICA','',null,220,900),
  ('144','MOGANAD ESTATE','Arabica PSD','ARABICA','',null,257,800),
  ('163','MOGANAD ESTATE','Bag Natural','ROBUSTA','',null,563,650),
  ('166','MOGANAD ESTATE','Watermelon Washed','ARABICA','',null,284,750),
  ('167','MOGANAD ESTATE','Regular Washed','ARABICA','',null,339,750),
  ('170','MOGANAD ESTATE','Robusta PSD','ROBUSTA','',null,344,650),
  ('173','MOGANAD ESTATE','Robusta PSD','ROBUSTA','',null,144,650),
  ('188','MOGANAD ESTATE','Bag Natural','ROBUSTA','',null,600,650),
  ('189','MOGANAD ESTATE','Bag Natural','ROBUSTA','',null,737,650),
  ('206','MOGANAD ESTATE','Arabica PSD','ARABICA','',null,409,800),
  ('211','MOGANAD ESTATE','Bag Natural','ROBUSTA','',null,1673,650),
  ('216','MOGANAD ESTATE','Bag Natural','ROBUSTA','',null,1524,600),
  ('217','MOGANAD ESTATE','Regular Washed','ROBUSTA','',null,3450,650),
  ('218','MOGANAD ESTATE','Bag Natural','ROBUSTA','',null,18,650),
  ('220','MOGANAD ESTATE','Bag Natural','ARABICA','',null,232,900),
  ('221','MOGANAD ESTATE','Bag Natural','ARABICA','',null,42,300),
  ('137','BISON VALLEY ESTATE','Bag Natural','ARABICA','',null,158,900),
  ('139','BISON VALLEY ESTATE','Bag Natural','ARABICA','',null,200,900),
  ('160','BISON VALLEY ESTATE','Regular Washed','ARABICA','',null,950,750),
  ('187','BISON VALLEY ESTATE','Arabica PSD','ARABICA','',null,406,800),
  ('203','BISON VALLEY ESTATE','Bag Natural','ARABICA','',null,42,900),
  ('210','BISON VALLEY ESTATE','Bag Natural','ARABICA','',null,130,900),
  ('67','STANMORE ESTATE','Regular Washed','ARABICA','',null,350,750),
  ('109','STANMORE ESTATE','Bag Natural','ARABICA','',null,400,900),
  ('111','STANMORE ESTATE','Bag Natural','ARABICA','',null,306,900),
  ('177','STANMORE ESTATE','Watermelon Washed','ARABICA','',null,25,750),
  ('180','STANMORE ESTATE','Arabica PSD','ARABICA','',null,258,800),
  ('200','STANMORE ESTATE','Bag Natural','ARABICA','',null,141,900),
  ('50','HIDDEN FALLS ESTATE','Regular Washed','ARABICA','',null,297,750),
  ('54','HIDDEN FALLS ESTATE','Bag Natural','ARABICA','',null,24,900),
  ('155','HIDDEN FALLS ESTATE','Regular Washed','ARABICA','',null,59,750),
  ('212','HIDDEN FALLS ESTATE','Watermelon Washed','ROBUSTA','',null,795,650),
  ('48','ORCHARDALE ESTATE','Regular Washed','ARABICA','',null,309,750),
  ('49','ORCHARDALE ESTATE','Regular Washed','ARABICA','',null,355,750),
  ('148','ORCHARDALE ESTATE','Arabica PSD','ARABICA','',null,250,800),
  ('156','ORCHARDALE ESTATE','Watermelon Washed','ARABICA','',null,350,800),
  ('157','ORCHARDALE ESTATE','Watermelon Washed','ARABICA','',null,50,750),
  ('201','ORCHARDALE ESTATE','Bag Natural','ARABICA','',null,129,900);

  insert into public.coffee_storage_sync_backups (id, note, green_lots, coffee_sales)
  select
    'coffee-sync-' || to_char(now(), 'YYYYMMDD-HH24MISS'),
    'Before 2024-2025 green stock sync',
    coalesce((select jsonb_agg(to_jsonb(g)) from public.green_lots g), '[]'::jsonb),
    coalesce((select jsonb_agg(to_jsonb(s)) from public.coffee_sales s), '[]'::jsonb);

  update public.green_lots g
  set current_kg = least(sh.sheetkg, case when g.green_kg_in > 0 then g.green_kg_in else sh.sheetkg end),
      field = case when sh.estate <> '' then sh.estate else g.field end,
      process = case when sh.process <> '' then sh.process else g.process end,
      grade = case when sh.grade <> '' then sh.grade else g.grade end,
      screen = case when sh.screen <> '' then sh.screen else g.screen end,
      score = coalesce(sh.score, g.score),
      rate_per_kg = case when sh.rateperkg > 0 then sh.rateperkg else g.rate_per_kg end,
      status = 'in-stock',
      updated_at = now()
  from public.coffeesyncsheet sh
  where g.lot = sh.lot
    and coalesce(g.season, '2024-2025') = '2024-2025';

  insert into public.green_lots (
    id, lot, derived_from, green_kg_in, current_kg, rate_per_kg,
    process, field, grade, screen, score, milled_date, warehouse, status, season
  )
  select
    'G-SYNC-' || sh.lot,
    sh.lot,
    array[]::text[],
    sh.sheetkg,
    sh.sheetkg,
    sh.rateperkg,
    coalesce(nullif(sh.process, ''), 'Unknown'),
    coalesce(nullif(sh.estate, ''), 'Unknown'),
    coalesce(sh.grade, ''),
    coalesce(sh.screen, ''),
    sh.score,
    current_date,
    '',
    'in-stock',
    '2024-2025'
  from public.coffeesyncsheet sh
  where not exists (
    select 1 from public.green_lots g
    where g.lot = sh.lot
      and coalesce(g.season, '2024-2025') = '2024-2025'
  );

  update public.green_lots
  set green_kg_in = case lot
      when '163' then 563
      when '166' then 284
      when '211' then 1673
      when '31' then 175
      when '210' then 130
      when '212' then 795
      when '156' then 350
      else green_kg_in
    end,
    current_kg = case lot
      when '163' then 563
      when '166' then 284
      when '211' then 1673
      when '31' then 175
      when '210' then 130
      when '212' then 795
      when '156' then 350
      else current_kg
    end,
    status = 'in-stock',
    updated_at = now()
  where coalesce(season, '2024-2025') = '2024-2025'
    and lot in ('163', '166', '211', '31', '210', '212', '156');

  select count(*), round(sum(s.sheetkg)), round(sum(s.sheetkg * s.rateperkg))
  into v_sheetlots, v_sheetkg, v_sheetvalue
  from public.coffeesyncsheet s;

  select count(*), round(sum(g.current_kg))
  into v_instocklots, v_instockkg
  from public.green_lots g
  where coalesce(g.season, '2024-2025') = '2024-2025'
    and g.status = 'in-stock';

  drop table if exists public.coffeesyncsheet;

  raise notice 'SYNC COMPLETE: sheet lots %, sheet kg %, sheet value INR %, in-stock lots after %, in-stock kg after %',
    v_sheetlots, v_sheetkg, v_sheetvalue, v_instocklots, v_instockkg;
end $$;
