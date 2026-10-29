import { NextResponse } from 'next/server';
import { requireApiUser, UUID_RE } from '@/lib/auth/api';
export async function courierAuth(request: Request, write = false) {
  const auth = await requireApiUser(request, ['admin','supervisor','ceo']);
  if ('error' in auth) return auth;
  if (write && request.headers.get('origin') && request.headers.get('origin') !== new URL(request.url).origin) return {error:NextResponse.json({error:'Invalid request origin.'},{status:403})};
  if (auth.user.role !== 'admin') {
    const paths = ['/employee-portal','/employee-portal/ramesh/courier-tracking'];
    const {data: roles,error} = await auth.supabase.from('role_permissions').select('page_href,access').eq('role',auth.user.role).in('page_href',paths);
    if (error) return {error:NextResponse.json({error:'Unable to verify permissions.'},{status:503})};
    let access = roles?.find(p=>p.page_href===paths[1])?.access ?? roles?.find(p=>p.page_href===paths[0])?.access ?? 'write';
    if (UUID_RE.test(auth.user.id)) {
      const {data:user,error:userError} = await auth.supabase.from('user_permissions').select('page_href,access').eq('user_id',auth.user.id).in('page_href',paths);
      if (userError) return {error:NextResponse.json({error:'Unable to verify permissions.'},{status:503})};
      access=user?.find(p=>p.page_href===paths[1])?.access ?? user?.find(p=>p.page_href===paths[0])?.access ?? access;
    }
    if (access==='none'||(write&&access==='read')) return {error:NextResponse.json({error:'Access denied.'},{status:403})};
  }
  return auth;
}
