import { NextResponse } from 'next/server';
import { parseRainfallPayload, requireRainfallUser } from '../_auth';

type BulkPayload = {
  rows?: unknown;
};

export async function POST(request: Request) {
  const auth = await requireRainfallUser(request);
  if ('error' in auth) return auth.error;

  const body = await request.json().catch(() => null) as BulkPayload | null;
  const rows = Array.isArray(body?.rows) ? body.rows : null;

  if (!rows || rows.length === 0 || rows.length > 500) {
    return NextResponse.json({ error: 'Upload between 1 and 500 rainfall rows at a time' }, { status: 400 });
  }

  const parsedRows = [];
  for (const row of rows) {
    const parsed = parseRainfallPayload(row);
    if ('error' in parsed) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }
    parsedRows.push(parsed.record);
  }

  const { error } = await auth.supabase
    .from('rainfall')
    .upsert(parsedRows, { onConflict: 'date,estate' });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ count: parsedRows.length });
}
