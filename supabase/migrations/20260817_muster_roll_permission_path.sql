-- Keep saved page permissions aligned with the real Muster Roll route prefix.
-- The Employee Center pages live under /estate-management/muster-roll/*.

insert into public.role_permissions (page_href, role, access, updated_at)
select '/estate-management/muster-roll', role, access, now()
from public.role_permissions
where page_href = '/muster-roll'
on conflict (page_href, role)
do update set
  access = excluded.access,
  updated_at = now();

delete from public.role_permissions
where page_href = '/muster-roll';

insert into public.user_permissions (user_id, page_href, access, updated_at)
select user_id, '/estate-management/muster-roll', access, now()
from public.user_permissions
where page_href = '/muster-roll'
on conflict (user_id, page_href)
do update set
  access = excluded.access,
  updated_at = now();

delete from public.user_permissions
where page_href = '/muster-roll';
