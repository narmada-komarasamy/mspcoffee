import { NextResponse } from 'next/server';
import { adminClient } from '@/lib/supabase/admin';

type AppUserRow = {
  id: string;
  role: string;
  pin: string;
  active: boolean | null;
};

export const ESTATE_STAFF_MEETING_ROLES = ['admin', 'supervisor', 'ceo'];
export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{12}$/i;

export async function requireEstateStaffMeetingUser(request: Request, allowedRoles = ESTATE_STAFF_MEETING_ROLES) {
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

  if (!allowedRoles.includes(user.role)) {
    return { error: NextResponse.json({ error: 'Estate staff meeting access required' }, { status: 403 }) };
  }

  return { supabase, user };
}

export function stringValue(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

export function nullableString(value: unknown) {
  const text = stringValue(value);
  return text ? text : null;
}

export function nullableDateOrTime(value: unknown) {
  const text = stringValue(value);
  return text ? text : null;
}
