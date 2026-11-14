import { NextResponse } from 'next/server';
import { indiaToday, PROCESSING_SEASON, validProcessingDate } from '@/lib/processing';
import { processingAuth, processingError } from '@/lib/processing-server';

export async function PATCH(request: Request) {
  const auth = await processingAuth(request, true);
  if ('error' in auth) return auth.error;
  const body = await request.json().catch(() => null);
  if (!validProcessingDate(body?.start_date) || body.start_date > indiaToday() || !Number.isInteger(body?.revision) || body.revision < 1) return NextResponse.json({ error: 'Choose a season start date on or before today.' }, { status: 400 });
  const result = await auth.supabase.from('processing_seasons').update({ start_date: body.start_date, updated_by: auth.user.id, updated_by_name: auth.user.name }).eq('id', PROCESSING_SEASON).eq('revision', body.revision).select('id,start_date,revision').maybeSingle();
  if (result.error) return processingError(result.error);
  if (!result.data) return NextResponse.json({ error: 'Season setup changed in another tab. Reload before saving.' }, { status: 409 });
  return NextResponse.json({ season: result.data });
}
