-- Ensure HR is a first-class configurable role for the new operational menus.

insert into public.role_permissions (page_href, role, access)
values
  ('/operations-calendar', 'hr', 'full'),
  ('/labour-activities', 'hr', 'full')
on conflict (page_href, role)
do update set
  access = excluded.access,
  updated_at = now();
