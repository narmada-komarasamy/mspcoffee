import { NextResponse } from 'next/server';
import { requireApiUser, UUID_RE } from '@/lib/auth/api';
export async function fleetAuth(request: Request, write = true) {
  const auth = await requireApiUser(request, ['admin','supervisor','ceo']);
  if ('error' in auth) return auth;
  if (write && request.headers.get('origin') && request.headers.get('origin') !== new URL(request.url).origin) return {error:NextResponse.json({error:'Invalid request origin.'},{status:403})};
  if (auth.user.role === 'admin') return auth;
  const {data,error} = await auth.supabase.from('role_permissions').select('access').eq('role',auth.user.role).eq('page_href','/fuel-expenses').maybeSingle();
  if (error) return {error:NextResponse.json({error:'Unable to verify permissions.'},{status:503})};
  let access = data?.access ?? 'write';
  if (UUID_RE.test(auth.user.id)) {
    const {data:user,error:userError} = await auth.supabase.from('user_permissions').select('access').eq('user_id',auth.user.id).eq('page_href','/fuel-expenses').maybeSingle();
    if (userError) return {error:NextResponse.json({error:'Unable to verify permissions.'},{status:503})};
    access = user?.access ?? access;
  }
  if (access === 'none' || (write && access === 'read')) return {error:NextResponse.json({error:'Access denied.'},{status:403})};
  return auth;
}
