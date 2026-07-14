import { NextResponse } from 'next/server';
import { RAINFALL_DELETE_ROLES, parseRainfallPayload, requireRainfallUser } from '../_auth';

function parseRecordId(id: string) {
  const value = Number(id);
  return Number.isInteger(value) && value > 0 ? value : null;
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const recordId = parseRecordId(id);
  if (!recordId) {
    return NextResponse.json({ error: 'Invalid rainfall record id' }, { status: 400 });
  }

  const auth = await requireRainfallUser(request);
  if ('error' in auth) return auth.error;

  const body = await request.json().catch(() => null);
  const parsed = parseRainfallPayload(body);
  if ('error' in parsed) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const { data, error } = await auth.supabase
    .from('rainfall')
    .update(parsed.record)
    .eq('id', recordId)
    .select('id, date, estate, rainfall_mm, inches, year, month')
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ record: data });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const recordId = parseRecordId(id);
  if (!recordId) {
    return NextResponse.json({ error: 'Invalid rainfall record id' }, { status: 400 });
  }

  const auth = await requireRainfallUser(request, RAINFALL_DELETE_ROLES);
  if ('error' in auth) return auth.error;

  const { error } = await auth.supabase
    .from('rainfall')
    .delete()
    .eq('id', recordId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
