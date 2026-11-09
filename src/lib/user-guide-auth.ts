import { NextResponse } from 'next/server';
import { courierAuth } from '@/app/api/courier/_auth';
import { fleetAuth } from '@/lib/fleet/auth';
import { requireApiUser, UUID_RE } from '@/lib/auth/api';

async function hoFuelGuideAuth(request: Request) {
  const auth = await requireApiUser(request, ['admin', 'supervisor', 'ceo']);
  if ('error' in auth || auth.user.role === 'admin') return auth;
  const { data, error } = await auth.supabase.from('role_permissions').select('access')
    .eq('role', auth.user.role).eq('page_href', '/ho-fuel').maybeSingle();
  if (error) return { error: NextResponse.json({ error: 'Unable to verify permissions.' }, { status: 503 }) };
  let access = data?.access ?? 'write';
  if (UUID_RE.test(auth.user.id)) {
    const { data: user, error: userError } = await auth.supabase.from('user_permissions').select('access')
      .eq('user_id', auth.user.id).eq('page_href', '/ho-fuel').maybeSingle();
    if (userError) return { error: NextResponse.json({ error: 'Unable to verify permissions.' }, { status: 503 }) };
    access = user?.access ?? access;
  }
  if (access === 'none') return { error: NextResponse.json({ error: 'Access denied.' }, { status: 403 }) };
  return auth;
}

export async function userGuideAuth(request: Request, id: string) {
  if (id === 'courier-tracking') return courierAuth(request);
  if (id === 'fleet-fuel') return fleetAuth(request, false);
  if (id === 'ho-fuel') return hoFuelGuideAuth(request);
  return {error:NextResponse.json({error:'Guide not found.'},{status:404})};
}
