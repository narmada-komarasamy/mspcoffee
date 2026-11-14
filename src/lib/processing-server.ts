import 'server-only';
import { NextResponse } from 'next/server';
import { requireApiUser, UUID_RE } from '@/lib/auth/api';
import { PROCESSING_SEASON } from '@/lib/processing';

export async function processingAuth(request: Request, write = false) {
  const auth = await requireApiUser(request, ['admin', 'supervisor', 'ceo']);
  if ('error' in auth) return auth;
  if (write && request.headers.get('origin') && request.headers.get('origin') !== new URL(request.url).origin) return { error: NextResponse.json({ error: 'Invalid request origin.' }, { status: 403 }) };
  if (auth.user.role === 'admin') return { ...auth, canWrite: true };
  const role = await auth.supabase.from('role_permissions').select('access').eq('role', auth.user.role).eq('page_href', '/processing-dashboard').maybeSingle();
  if (role.error) return { error: NextResponse.json({ error: 'Unable to verify permissions.' }, { status: 503 }) };
  let access = role.data?.access ?? 'read';
  if (UUID_RE.test(auth.user.id)) {
    const user = await auth.supabase.from('user_permissions').select('access').eq('user_id', auth.user.id).eq('page_href', '/processing-dashboard').maybeSingle();
    if (user.error) return { error: NextResponse.json({ error: 'Unable to verify permissions.' }, { status: 503 }) };
    access = user.data?.access ?? access;
  }
  // Ashok is the sole data-entry operator for Part 1. Other permitted roles can review.
  if (access === 'none' || write) return { error: NextResponse.json({ error: 'Only an administrator can update the processing register.' }, { status: 403 }) };
  return { ...auth, canWrite: false };
}
export type ProcessingClient = Exclude<Awaited<ReturnType<typeof processingAuth>>, { error: unknown }>['supabase'];
export async function processingSeason(db: ProcessingClient) {
  const result = await db.from('processing_seasons').select('id,start_date,revision').eq('id', PROCESSING_SEASON).single();
  if (result.error || !result.data) throw new Error('Unable to load the processing season. Please try again.');
  return result.data;
}
export function processingError(error: { code?: string; message?: string }) {
  if (error.code === '23505') return NextResponse.json({ error: 'This estate already has that lot and split reference. Open the existing batch, or enter a distinct split reference for a legitimate split.' }, { status: 409 });
  if (error.code === '23514' || error.code === 'P0001') return NextResponse.json({ error: error.code === 'P0001' ? error.message : 'The batch contains invalid measurements. Check the dates, weights and completion details.' }, { status: 400 });
  return NextResponse.json({ error: 'Unable to save the processing record. Please retry.' }, { status: 503 });
}
