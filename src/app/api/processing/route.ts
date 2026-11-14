import { NextResponse } from 'next/server';
import { cleanProcessingBatch, PROCESSING_SEASON } from '@/lib/processing';
import { processingAuth, processingError, processingSeason } from '@/lib/processing-server';

export async function GET(request: Request) {
  const auth = await processingAuth(request);
  if ('error' in auth) return auth.error;
  try {
    const season = await processingSeason(auth.supabase);
    const batches = [];
    for (let offset = 0; ; offset += 1000) {
      const result = await auth.supabase.from('processing_batches').select('*').eq('season_id', PROCESSING_SEASON).order('processing_date', { ascending: false }).order('id').range(offset, offset + 999);
      if (result.error) throw new Error('Unable to load batches. Please try again.');
      batches.push(...(result.data ?? []));
      if ((result.data?.length ?? 0) < 1000) break;
    }
    return NextResponse.json({ season, batches, canWrite: auth.canWrite }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (e) { return NextResponse.json({ error: e instanceof Error ? e.message : 'Unable to load batches.' }, { status: 503 }); }
}
async function save(request: Request, editing: boolean) {
  const auth = await processingAuth(request, true);
  if ('error' in auth) return auth.error;
  const body = await request.json().catch(() => null);
  let season;
  try { season = await processingSeason(auth.supabase); }
  catch { return NextResponse.json({ error: 'Unable to load season setup.' }, { status: 503 }); }
  let row;
  try { row = cleanProcessingBatch(body, season); }
  catch (e) { return NextResponse.json({ error: e instanceof Error ? e.message : 'Invalid batch.' }, { status: 400 }); }
  // The database assigns and preserves the lot number atomically; clients cannot override it.
  const { lot_number: ignoredLot, ...values } = row;
  void ignoredLot;
  const data = { ...values, updated_by: auth.user.id, updated_by_name: auth.user.name };
  if (editing && (!Number.isInteger(body.revision) || body.revision < 1)) return NextResponse.json({ error: 'Reopen the saved batch before editing.' }, { status: 400 });
  const query = editing
    ? auth.supabase.from('processing_batches').update(data).eq('id', row.id).eq('season_id', PROCESSING_SEASON).eq('revision', body.revision)
    : auth.supabase.from('processing_batches').insert(data);
  const result = await query.select('*').maybeSingle();
  if (result.error) return processingError(result.error);
  if (!result.data) return NextResponse.json({ error: 'This batch changed in another tab. Reload the register and reopen it before saving.' }, { status: 409 });
  return NextResponse.json({ batch: result.data }, { status: editing ? 200 : 201 });
}
export async function POST(request: Request) { return save(request, false); }
export async function PATCH(request: Request) { return save(request, true); }
