import { NextResponse } from 'next/server';
import { requireTravelAllowanceUser } from '../_auth';

type NamePayload = {
  name?: unknown;
};

export async function POST(request: Request) {
  const auth = await requireTravelAllowanceUser(request, ['admin']);
  if ('error' in auth) return auth.error;

  const payload = await request.json().catch(() => null) as NamePayload | null;
  const name = typeof payload?.name === 'string' ? payload.name.trim() : '';

  if (!name || name.length > 120) {
    return NextResponse.json({ error: 'Enter a valid employee name' }, { status: 400 });
  }

  const { data, error } = await auth.supabase
    .from('travel_allowance_employees')
    .insert({ name })
    .select('id, name')
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ employee: data }, { status: 201 });
}
