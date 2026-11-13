-- Preserve existing future readings for review; reject new future readings at source.
create or replace function public.reject_future_rainfall_date()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if new.date > (now() at time zone 'Asia/Kolkata')::date then
    raise exception 'Rainfall readings cannot be dated in the future (India time).'
      using errcode = '23514';
  end if;
  return new;
end;
$$;
revoke all on function public.reject_future_rainfall_date() from public,anon,authenticated;
drop trigger if exists rainfall_reject_future_date on public.rainfall;
create trigger rainfall_reject_future_date
before insert or update of date on public.rainfall
for each row execute function public.reject_future_rainfall_date();
