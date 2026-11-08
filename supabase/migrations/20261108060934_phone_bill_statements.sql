-- Local preparation only. The CLI migration generator exited 137 twice;
-- timestamp obtained from the system clock. Apply after preview approval.
create table public.phone_bill_entries (
  id uuid primary key default gen_random_uuid(),
  entry_key text not null unique,
  period text not null check (period ~ '^20[0-9]{2}-(0[1-9]|1[0-2])$'),
  row_data jsonb not null check (jsonb_typeof(row_data) = 'object'),
  created_by text not null,
  created_at timestamptz not null default now()
);
create table public.phone_bill_statements (
  id uuid primary key default gen_random_uuid(),
  period text not null unique check (period ~ '^20[0-9]{2}-(0[1-9]|1[0-2])$'),
  reference text not null unique,
  rows jsonb not null check (jsonb_typeof(rows) = 'array'),
  total numeric(14,2) not null check (total > 0),
  created_by text not null,
  created_at timestamptz not null default now(),
  payment_date date,
  payment_reference text,
  payment_amount numeric(14,2),
  paid_by text,
  check ((payment_date is null and payment_reference is null and payment_amount is null and paid_by is null)
    or (payment_date is not null and length(btrim(payment_reference)) > 0 and payment_amount = total and paid_by is not null))
);
create table public.phone_bill_statement_files (
  id uuid primary key default gen_random_uuid(),
  statement_id uuid not null references public.phone_bill_statements(id),
  file_name text not null,
  file_path text not null unique,
  uploaded_by text not null,
  created_at timestamptz not null default now()
);
create index phone_bill_entries_period on public.phone_bill_entries(period);
create index phone_bill_statement_files_statement on public.phone_bill_statement_files(statement_id);
alter table public.phone_bill_entries enable row level security;
alter table public.phone_bill_statements enable row level security;
alter table public.phone_bill_statement_files enable row level security;
-- Existing app uses PIN and Supabase sessions; authorize both through server APIs.
revoke all on public.phone_bill_entries, public.phone_bill_statements, public.phone_bill_statement_files from public, anon, authenticated;
grant select, insert, update on public.phone_bill_entries to service_role;
grant select, insert on public.phone_bill_statement_files to service_role;
grant select, insert, update on public.phone_bill_statements to service_role;

create function public.lock_phone_bill_entry() returns trigger
language plpgsql security invoker set search_path = public as $$
begin
  perform pg_advisory_xact_lock(hashtext('phone-bill:' || new.period));
  if exists(select 1 from public.phone_bill_statements where period = new.period) then
    raise exception 'This month already has an issued statement';
  end if;
  return new;
end;
$$;
revoke all on function public.lock_phone_bill_entry() from public, anon, authenticated;
create trigger phone_bill_entry_lock before insert or update on public.phone_bill_entries for each row execute function public.lock_phone_bill_entry();

create function public.protect_phone_bill_statement() returns trigger
language plpgsql security invoker set search_path = public as $$
begin
  if new.id <> old.id or new.period <> old.period or new.reference <> old.reference
    or new.rows <> old.rows or new.total <> old.total or new.created_by <> old.created_by
    or new.created_at <> old.created_at or old.payment_date is not null then
    raise exception 'Issued statements and recorded payments cannot be overwritten';
  end if;
  return new;
end;
$$;
revoke all on function public.protect_phone_bill_statement() from public, anon, authenticated;
create trigger phone_bill_statement_immutable before update on public.phone_bill_statements for each row execute function public.protect_phone_bill_statement();

create function public.issue_phone_bill_statement(bill_period text, base_rows jsonb, actor text)
returns jsonb language plpgsql security invoker set search_path = public as $$
declare
  snapshot jsonb;
  amount numeric(14,2);
  result public.phone_bill_statements;
begin
  if bill_period !~ '^20[0-9]{2}-(0[1-9]|1[0-2])$' or jsonb_typeof(base_rows) <> 'array' then
    raise exception 'Invalid statement period';
  end if;
  perform pg_advisory_xact_lock(hashtext('phone-bill:' || bill_period));
  select coalesce(jsonb_agg(r - 'entryKey'), '[]'::jsonb) into snapshot
    from jsonb_array_elements(base_rows) r
    where not exists(select 1 from public.phone_bill_entries e where e.period = bill_period and e.entry_key = r->>'entryKey');
  select snapshot || coalesce(jsonb_agg(row_data order by created_at, id), '[]'::jsonb)
    into snapshot from public.phone_bill_entries where period = bill_period;
  if jsonb_array_length(snapshot) = 0 or exists (
    select 1 from jsonb_array_elements(snapshot) r
    where jsonb_typeof(r->'amount') is distinct from 'number' or (r->>'amount')::numeric < 0
  ) then raise exception 'Missing bill amounts'; end if;
  if exists (
    select 1 from jsonb_array_elements(snapshot) r
    group by lower(r->>'billType'), regexp_replace(coalesce(nullif(r->>'accountNo', ''), r->>'phone'), '[^a-zA-Z0-9]', '', 'g')
    having count(*) > 1
  ) then raise exception 'Duplicate account entries'; end if;
  select sum(round((r->>'amount')::numeric, 2)) into amount from jsonb_array_elements(snapshot) r;
  if amount <= 0 then raise exception 'Statement total must be positive'; end if;
  insert into public.phone_bill_statements(period, reference, rows, total, created_by)
    values(bill_period, 'MSP-PH-' || replace(bill_period, '-', ''), snapshot, amount, actor)
    returning * into result;
  return to_jsonb(result);
end;
$$;
revoke all on function public.issue_phone_bill_statement(text, jsonb, text) from public, anon, authenticated;
grant execute on function public.issue_phone_bill_statement(text, jsonb, text) to service_role;

insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values ('phone-bill-signed-copies', 'phone-bill-signed-copies', false, 3145728, array['application/pdf','image/jpeg','image/png'])
on conflict (id) do nothing;
-- Private bucket with no client policies; files open through an authorized API.
