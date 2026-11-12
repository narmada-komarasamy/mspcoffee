-- Explicit user request: remove only the 200 L diesel purchase of 04/12/2026, Rs 19,364.
-- Refuse ambiguous matches. A missing row is safe on rerun.
begin;
do $$
declare matches integer;
begin
 select count(*) into matches from public.ho_fuel_log
 where date='2026-12-04' and transaction_type='PURCHASE' and fuel_type='DIESEL' and qty_l=200 and amount=19364;
 if matches > 1 then raise exception 'Multiple matches: inspect before removing'; end if;
end $$;
delete from public.ho_fuel_log where date='2026-12-04' and transaction_type='PURCHASE' and fuel_type='DIESEL' and qty_l=200 and amount=19364 returning *;
commit;
