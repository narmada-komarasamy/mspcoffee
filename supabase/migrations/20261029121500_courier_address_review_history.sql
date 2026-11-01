create table public.courier_address_reviews (
 id uuid primary key default gen_random_uuid(),
 canonical_recipient_id uuid not null,
 review_group text not null,
 confirmed_by text not null,
 original_recipients jsonb not null,
 original_shipment_links jsonb not null,
 approved_contact jsonb not null,
 created_at timestamptz not null default now()
);
alter table public.courier_address_reviews enable row level security;
revoke all on public.courier_address_reviews from anon,authenticated;
grant all on public.courier_address_reviews to service_role;
comment on table public.courier_address_reviews is 'Restorable snapshots of user-confirmed recipient cleanup. Shipment address snapshots remain unchanged.';
