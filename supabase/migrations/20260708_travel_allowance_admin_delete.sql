-- Lock direct browser deletes for travel allowance entries.
-- Admin deletes go through the Next.js route handler with the service-role client.

drop policy if exists "travel allowance entries write" on public.travel_allowance_entries;

create policy "travel allowance entries insert" on public.travel_allowance_entries
  for insert to anon, authenticated
  with check (true);

create policy "travel allowance entries update" on public.travel_allowance_entries
  for update to anon, authenticated
  using (true)
  with check (true);
