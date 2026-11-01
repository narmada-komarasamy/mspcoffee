create function public.protect_profile_active_flag() returns trigger
language plpgsql security invoker set search_path=public,pg_temp as $$
begin
 if current_user in ('anon','authenticated') and new.active is distinct from old.active then
  raise exception 'Account status can only be changed by an administrative server action.' using errcode='42501';
 end if;
 return new;
end $$;
create trigger protect_profile_active_flag before update on public.profiles for each row execute function public.protect_profile_active_flag();
revoke all on function public.protect_profile_active_flag() from public,anon,authenticated;
