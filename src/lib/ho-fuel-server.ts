import 'server-only';
import { NextResponse } from 'next/server';
import { requireApiUser, UUID_RE } from '@/lib/auth/api';
export const HO_BILL_BUCKET = 'ho-fuel-bills';
export async function hoFuelAuth(request: Request, write = false) {
  const auth = await requireApiUser(request, ['admin', 'supervisor', 'ceo']);
  if ('error' in auth) return auth;
  if (write && request.headers.get('origin') && request.headers.get('origin') !== new URL(request.url).origin)
    return { error: NextResponse.json({ error: 'Invalid request origin.' }, { status: 403 }) };
  if (auth.user.role === 'admin') return auth;
  const role = await auth.supabase.from('role_permissions').select('access').eq('role', auth.user.role).eq('page_href', '/ho-fuel').maybeSingle();
  if (role.error) return { error: NextResponse.json({ error: 'Unable to verify permissions.' }, { status: 503 }) };
  let access = role.data?.access ?? 'write';
  if (UUID_RE.test(auth.user.id)) {
    const user = await auth.supabase.from('user_permissions').select('access').eq('user_id', auth.user.id).eq('page_href', '/ho-fuel').maybeSingle();
    if (user.error) return { error: NextResponse.json({ error: 'Unable to verify permissions.' }, { status: 503 }) };
    access = user.data?.access ?? access;
  }
  if (access === 'none' || (write && access === 'read')) return { error: NextResponse.json({ error: 'Access denied.' }, { status: 403 }) };
  return auth;
}
export const HO_FILE_TYPES: Record<string, string> = { 'application/pdf': '.pdf', 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' };
export function fuelBillMagic(bytes: Buffer, type: string) {
  if (type === 'application/pdf') return bytes.subarray(0, 5).toString() === '%PDF-';
  if (type === 'image/png') return bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
  if (type === 'image/jpeg') return bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
  return type === 'image/webp' && bytes.subarray(0,4).toString() === 'RIFF' && bytes.subarray(8,12).toString() === 'WEBP';
}
