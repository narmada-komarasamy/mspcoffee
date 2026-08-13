create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.family_decisions (
  id uuid primary key default gen_random_uuid(),
  question text not null,
  cost text not null default 'Not set',
  lead text not null default 'Not assigned',
  timeline text not null default 'Not set',
  rule text not null default 'Passes with 3 yes votes and no unresolved major objections.',
  status text not null default 'active' check (status in ('active', 'closed', 'archived')),
  created_by uuid references public.app_users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.family_decision_votes (
  id uuid primary key default gen_random_uuid(),
  decision_id uuid not null references public.family_decisions(id) on delete cascade,
  member_name text not null,
  vote text not null default 'Pending' check (vote in ('Yes', 'No', 'Pending')),
  note text not null default 'Waiting for response.',
  recorded_by uuid references public.app_users(id) on delete set null,
  recorded_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (decision_id, member_name)
);

create table if not exists public.family_decision_objections (
  id uuid primary key default gen_random_uuid(),
  decision_id uuid not null references public.family_decisions(id) on delete cascade,
  member_name text not null,
  concern text not null,
  response text not null default 'Needs response before close-out.',
  resolved boolean not null default false,
  recorded_by uuid references public.app_users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.family_decision_suggestions (
  id uuid primary key default gen_random_uuid(),
  decision_id uuid not null references public.family_decisions(id) on delete cascade,
  suggestion text not null,
  suggested_by text,
  recorded_by uuid references public.app_users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (decision_id, suggestion)
);

create index if not exists family_decisions_status_updated_idx
  on public.family_decisions (status, updated_at desc);

create index if not exists family_decision_votes_decision_idx
  on public.family_decision_votes (decision_id);

create index if not exists family_decision_objections_decision_idx
  on public.family_decision_objections (decision_id);

create index if not exists family_decision_suggestions_decision_idx
  on public.family_decision_suggestions (decision_id);

drop trigger if exists family_decisions_updated_at on public.family_decisions;
create trigger family_decisions_updated_at
  before update on public.family_decisions
  for each row execute function public.set_updated_at();

drop trigger if exists family_decision_votes_updated_at on public.family_decision_votes;
create trigger family_decision_votes_updated_at
  before update on public.family_decision_votes
  for each row execute function public.set_updated_at();

drop trigger if exists family_decision_objections_updated_at on public.family_decision_objections;
create trigger family_decision_objections_updated_at
  before update on public.family_decision_objections
  for each row execute function public.set_updated_at();

alter table public.family_decisions enable row level security;
alter table public.family_decision_votes enable row level security;
alter table public.family_decision_objections enable row level security;
alter table public.family_decision_suggestions enable row level security;

drop policy if exists "family_decisions_service_role_all" on public.family_decisions;
drop policy if exists "family_decision_votes_service_role_all" on public.family_decision_votes;
drop policy if exists "family_decision_objections_service_role_all" on public.family_decision_objections;
drop policy if exists "family_decision_suggestions_service_role_all" on public.family_decision_suggestions;

create policy "family_decisions_service_role_all"
  on public.family_decisions for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

create policy "family_decision_votes_service_role_all"
  on public.family_decision_votes for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

create policy "family_decision_objections_service_role_all"
  on public.family_decision_objections for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

create policy "family_decision_suggestions_service_role_all"
  on public.family_decision_suggestions for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');
