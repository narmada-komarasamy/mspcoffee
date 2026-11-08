import 'server-only';
import { readFile } from 'node:fs/promises';
import { NextResponse } from 'next/server';
import { requireApiUser, UUID_RE } from '@/lib/auth/api';
import { mergeBillRows, parsePhoneCsv, type PhoneBillRow } from '@/lib/phone-bills';

export const PHONE_BUCKET = 'phone-bill-signed-copies';
export async function phoneBillAuth(request: Request, write = false) {
  const auth = await requireApiUser(request, ['admin', 'supervisor', 'ceo']);
  if ('error' in auth) return auth;
  if (write && request.headers.get('origin') && request.headers.get('origin') !== new URL(request.url).origin) return { error: NextResponse.json({ error: 'Invalid request origin.' }, { status: 403 }) };
  if (auth.user.role === 'admin') return auth;
  const paths = ['/recurring-bills/phone-bills', '/ho-fuel/recurring-bills/phone-bills'];
  const role = await auth.supabase.from('role_permissions').select('page_href,access').eq('role', auth.user.role).in('page_href', paths);
  if (role.error) return { error: NextResponse.json({ error: 'Unable to verify permissions.' }, { status: 503 }) };
  let access = role.data?.find(r => r.page_href === paths[0])?.access ?? role.data?.[0]?.access ?? 'write';
  if (UUID_RE.test(auth.user.id)) {
    const user = await auth.supabase.from('user_permissions').select('page_href,access').eq('user_id', auth.user.id).in('page_href', paths);
    if (user.error) return { error: NextResponse.json({ error: 'Unable to verify permissions.' }, { status: 503 }) };
    access = user.data?.find(r => r.page_href === paths[0])?.access ?? user.data?.[0]?.access ?? access;
  }
  if (access === 'none' || (write && access === 'read')) return { error: NextResponse.json({ error: 'Access denied.' }, { status: 403 }) };
  return auth;
}
export async function basePhoneRows() {
  return parsePhoneCsv(await readFile(`${process.cwd()}/public/data/phone-bill-reimbursements.csv`, 'utf8'));
}
export async function allPhoneRows(supabase: Awaited<ReturnType<typeof requireApiUser>> extends infer T ? T extends { supabase: infer S } ? S : never : never) {
  const base = await basePhoneRows();
  // Paginate explicitly: the register is larger than Supabase's default row cap.
  const additions: PhoneBillRow[] = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await supabase.from('phone_bill_entries').select('row_data').order('id').range(offset, offset + 999);
    if (error) throw new Error('Monthly saving is not ready. Apply the phone-bill database migration before going live.');
    additions.push(...(data || []).map(r => r.row_data as PhoneBillRow));
    if ((data?.length ?? 0) < 1000) break;
  }
  return mergeBillRows(base, additions);
}
