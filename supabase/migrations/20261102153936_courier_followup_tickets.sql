-- Tickets use the same server-side courier permission checks as shipments.
create table public.courier_tickets (
 id uuid primary key default gen_random_uuid(),
 ticket_number bigint generated always as identity unique,
 shipment_id uuid not null unique references public.courier_shipments(id),
 status text not null default 'Open' check (status in ('Open','Following up','Resolved')),
 problem text not null default 'Package reported missing or delayed. Please confirm its location and delivery.',
 owner text not null default '',
 next_followup date,
 history jsonb not null default '[]'::jsonb check(jsonb_typeof(history)='array'),
 revision integer not null default 1 check(revision>0),
 created_by text not null,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index courier_tickets_followup_idx on public.courier_tickets(status,next_followup);
alter table public.courier_tickets enable row level security;
revoke all on public.courier_tickets from public,anon,authenticated;
grant select,insert,update on public.courier_tickets to service_role;
grant usage,select on sequence public.courier_tickets_ticket_number_seq to service_role;
