do $$
begin
  if to_regclass('public.hilltiller_stock') is not null then
    update public.hilltiller_stock
    set
      current_kg = 0,
      green_kg_in = 0,
      status = 'depleted';
  end if;
end $$;
