import { NextResponse } from 'next/server';
import { UUID_RE } from '@/lib/auth/api';
import { PROCESSING_SEASON } from '@/lib/processing';
import { processingAuth } from '@/lib/processing-server';

export async function GET(request: Request) {
  const auth = await processingAuth(request);
  if ('error' in auth) return auth.error;
  const id = new URL(request.url).searchParams.get('batch');
  if (id && !UUID_RE.test(id)) return NextResponse.json({ error: 'Invalid batch identifier.' }, { status: 400 });
  const history = [];
  for (let offset = 0; ; offset += 1000) {
    let query = auth.supabase.from('processing_history').select('*').eq('season_id', PROCESSING_SEASON).order('id', { ascending: false });
    query = id ? query.eq('batch_id', id) : query.is('batch_id', null);
    const result = await query.range(offset, offset + 999);
    if (result.error) return NextResponse.json({ error: 'Unable to load correction history.' }, { status: 503 });
    history.push(...(result.data ?? []));
    if ((result.data?.length ?? 0) < 1000) break;
  }
  return NextResponse.json({ history }, { headers: { 'Cache-Control': 'private, no-store' } });
}
