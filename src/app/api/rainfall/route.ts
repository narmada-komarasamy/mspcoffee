import { NextResponse } from 'next/server';
import { parseRainfallPayload, requireRainfallUser } from './_auth';

export async function POST(request: Request) {
  const auth = await requireRainfallUser(request);
  if ('error' in auth) return auth.error;

  const body = await request.json().catch(() => null);
  const parsed = parseRainfallPayload(body);
  if ('error' in parsed) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const { data, error } = await auth.supabase
    .from('rainfall')
    .insert(parsed.record)
    .select('id, date, estate, rainfall_mm, inches, year, month')
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ record: data }, { status: 201 });
}
