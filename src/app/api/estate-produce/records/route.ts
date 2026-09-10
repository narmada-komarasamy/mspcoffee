import { NextResponse } from 'next/server';
import {
  badRequest,
  buildRecordPayload,
  mapRecord,
  recordSelect,
  requireEstateProduceUser,
  type EstateProduceRow,
} from '../_helpers';

export async function GET(request: Request) {
  const auth = await requireEstateProduceUser(request);
  if ('error' in auth) return auth.error;

  const { searchParams } = new URL(request.url);
  const year = searchParams.get('year')?.trim();
  const estate = searchParams.get('estate')?.trim();
  const product = searchParams.get('product')?.trim();
  const unit = searchParams.get('unit')?.trim();
  const search = searchParams.get('search')?.trim();

  let query = auth.supabase
    .from('estate_produce_records')
    .select(recordSelect())
    .order('record_date', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(500);

  if (year && year !== 'All' && /^\d{4}$/.test(year)) {
    query = query.gte('record_date', `${year}-01-01`).lte('record_date', `${year}-12-31`);
  }
  if (estate && estate !== 'All') query = query.eq('estate', estate);
  if (product && product !== 'All') query = query.eq('product', product);
  if (unit && unit !== 'All') query = query.eq('unit', unit);
  if (search) {
    const term = search.replace(/[%_]/g, '\\$&');
    query = query.or(`product.ilike.%${term}%,estate.ilike.%${term}%,notes.ilike.%${term}%,damage_notes.ilike.%${term}%,location.ilike.%${term}%`);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ records: ((data ?? []) as EstateProduceRow[]).map((row) => mapRecord(row)) });
}

export async function POST(request: Request) {
  const auth = await requireEstateProduceUser(request);
  if ('error' in auth) return auth.error;

  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body) return badRequest('Entry details are required');

  const built = buildRecordPayload(body, auth.user.id, auth.user.name);
  if (!built.ok) return badRequest(built.error);

  const { data, error } = await auth.supabase
    .from('estate_produce_records')
    .insert([built.payload])
    .select(recordSelect())
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ record: mapRecord(data as EstateProduceRow) }, { status: 201 });
}
