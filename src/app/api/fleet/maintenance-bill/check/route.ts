import { NextResponse } from 'next/server';
import { requireApiUser } from '@/lib/auth/api';
import { checkRateLimit, rateLimitKey } from '@/lib/auth/rate-limit';
import { billFileError } from '@/lib/fleet/maintenance';
import { billFingerprint, findExactBill } from '@/lib/fleet/maintenance-server';

export const maxDuration = 60;
export async function POST(request: Request) {
  const auth = await requireApiUser(request, ['admin', 'supervisor', 'ceo']);
  if ('error' in auth) return auth.error;
  const limited = checkRateLimit({ key: rateLimitKey('maintenance-bill-check', auth.user.id), limit: 60, windowMs: 3600000 });
  if ('error' in limited) return limited.error;
  try {
    const form = await request.formData();
    const file = form.get('file');
    if (!(file instanceof File)) return NextResponse.json({ error: 'Choose a maintenance bill.' }, { status: 400 });
    const error = billFileError(file);
    if (error) return NextResponse.json({ error }, { status: 400 });
    const existing = await findExactBill(auth.supabase, billFingerprint(await file.arrayBuffer()));
    return NextResponse.json({ existing });
  } catch {
    return NextResponse.json({ error: 'Could not verify whether this bill is already saved. Please retry.' }, { status: 503 });
  }
}
