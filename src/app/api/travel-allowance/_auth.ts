import { NextResponse } from 'next/server';
import { adminClient } from '@/lib/supabase/admin';

type AppUserRow = {
  id: string;
  role: string;
  pin: string;
  active: boolean | null;
};

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function requireTravelAllowanceUser(request: Request, allowedRoles?: string[]) {
  const userId = request.headers.get('x-msp-user-id')?.trim();
  const userPin = request.headers.get('x-msp-user-pin')?.trim();

  if (!userId || !userPin || !UUID_RE.test(userId)) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }

  const supabase = adminClient();
  const { data: user, error: userError } = await supabase
    .from('app_users')
    .select('id, role, pin, active')
    .eq('id', userId)
    .single<AppUserRow>();

  if (userError || !user || user.pin !== userPin || user.active === false) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return { error: NextResponse.json({ error: 'Admin access required' }, { status: 403 }) };
  }

  return { supabase, user };
}
