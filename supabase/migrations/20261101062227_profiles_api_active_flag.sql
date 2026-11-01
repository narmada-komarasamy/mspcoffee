alter table public.profiles add column if not exists active boolean not null default true;
comment on column public.profiles.active is 'Server-side account status checked by requireApiUser. Existing profiles remain active.';
