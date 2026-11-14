-- Actual fermentation duration is entered manually. Yard days are drying start to bagging.
alter table public.processing_batches
  add column drying_started_on date,
  add column workflow_version integer not null default 1 check (workflow_version in (1,2));
alter table public.processing_batches add constraint processing_drying_order_check check (
  drying_started_on is null or (drying_started_on >= processing_date and (dried_on is null or dried_on >= drying_started_on))
);
alter table public.processing_batches add constraint processing_drying_required_check check (
  workflow_version <> 2 or ((stage not in ('Drying','Dried') and dried_on is null) or drying_started_on is not null)
);
alter table public.processing_batches add constraint processing_fermentation_complete_check check (
  workflow_version <> 2 or status <> 'Complete' or fermentation_hours is not null
);
create function public.processing_validate_timeline() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  if tg_op = 'UPDATE' and old.workflow_version = 2 and new.workflow_version <> 2 then
    raise exception 'Reload the updated processing register before editing this batch.';
  end if;
  if new.drying_started_on > (current_timestamp at time zone 'Asia/Kolkata')::date then
    raise exception 'Put out to dry date cannot be in the future.';
  end if;
  if new.workflow_version = 2 and new.method ~* '\mno[[:space:]]+fermentation\M' then
    if new.stage = 'Fermenting' then raise exception 'No-fermentation batches go directly to drying.'; end if;
    new.fermentation_hours := 0;
  end if;
  return new;
end;
$$;
revoke all on function public.processing_validate_timeline() from public, anon, authenticated;
grant execute on function public.processing_validate_timeline() to service_role;
create trigger processing_batch_timeline before insert or update on public.processing_batches for each row execute function public.processing_validate_timeline();
