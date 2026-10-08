import { NextResponse } from 'next/server';
import { UUID_RE, normalizeDateKey, requireTravelAllowanceUser } from '../_auth';

type EntryPayload = {
  entry_date?: unknown;
  employee_id?: unknown;
  location_id?: unknown;
  times?: unknown;
};

export async function POST(request: Request) {
  const auth = await requireTravelAllowanceUser(request);
  if ('error' in auth) return auth.error;

  const payload = await request.json().catch(() => null) as EntryPayload | null;
  const entryDate = normalizeDateKey(payload?.entry_date);
  const employeeId = typeof payload?.employee_id === 'string' ? payload.employee_id.trim() : '';
  const locationId = typeof payload?.location_id === 'string' ? payload.location_id.trim() : '';
  const times = Number(payload?.times ?? 1);

  if (!entryDate) {
    return NextResponse.json({ error: 'Enter a valid date' }, { status: 400 });
  }

  if (!UUID_RE.test(employeeId)) {
    return NextResponse.json({ error: 'Choose a valid employee' }, { status: 400 });
  }

  if (!UUID_RE.test(locationId)) {
    return NextResponse.json({ error: 'Choose a valid location' }, { status: 400 });
  }

  if (!Number.isInteger(times) || times < 1 || times > 100) {
    return NextResponse.json({ error: 'Enter an event count from 1 to 100' }, { status: 400 });
  }

  const { data, error } = await auth.supabase
    .from('travel_allowance_entries')
    .insert({
      entry_date: entryDate,
      employee_id: employeeId,
      location_id: locationId,
      times,
    })
    .select('id, entry_date, employee_id, location_id, times')
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ entry: data }, { status: 201 });
}
