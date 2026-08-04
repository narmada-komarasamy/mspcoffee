import { NextResponse } from 'next/server';
import { adminClient } from '@/lib/supabase/admin';

type AppUserRow = {
  id: string;
  role: string;
  pin: string;
  active: boolean | null;
  name: string | null;
};

export const EMAIL_ROLES = ['admin'];
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{12}$/i;

function cookieValue(request: Request, name: string) {
  const cookie = request.headers.get('cookie');
  if (!cookie) return '';

  const match = cookie
    .split(';')
    .map((item) => item.trim())
    .find((item) => item.startsWith(`${name}=`));

  return match ? decodeURIComponent(match.slice(name.length + 1)) : '';
}

export async function requireEmailUser(request: Request, allowedRoles = EMAIL_ROLES) {
  const userId = request.headers.get('x-msp-user-id')?.trim() || cookieValue(request, 'msp_user_id');
  const userPin = request.headers.get('x-msp-user-pin')?.trim() || cookieValue(request, 'msp_user_pin');

  if (!userId || !userPin || !UUID_RE.test(userId)) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }

  const supabase = adminClient();
  const { data: user, error } = await supabase
    .from('app_users')
    .select('id, role, pin, active, name')
    .eq('id', userId)
    .single<AppUserRow>();

  if (error || !user || user.pin !== userPin || user.active === false) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }

  if (!allowedRoles.includes(user.role)) {
    return { error: NextResponse.json({ error: 'Email access required' }, { status: 403 }) };
  }

  return { supabase, user };
}
