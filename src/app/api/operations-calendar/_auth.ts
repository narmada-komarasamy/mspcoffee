import { NextResponse } from 'next/server';
import { adminClient } from '@/lib/supabase/admin';

type AppUserRow = {
  id: string;
  role: string;
  pin: string;
  active: boolean | null;
  name: string | null;
};

export const OPERATIONS_CALENDAR_ROLES = ['admin', 'supervisor', 'worker', 'ceo', 'hr'];
export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{12}$/i;
export const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
export const TIME_RE = /^\d{2}:\d{2}(:\d{2})?$/;

export async function requireOperationsCalendarUser(request: Request, allowedRoles = OPERATIONS_CALENDAR_ROLES) {
  const userId = request.headers.get('x-msp-user-id')?.trim();
  const userPin = request.headers.get('x-msp-user-pin')?.trim();

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

  if (!allowedRoles.includes(user.role.trim().toLowerCase())) {
    return { error: NextResponse.json({ error: 'Operations calendar access required' }, { status: 403 }) };
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

export function nullableTime(value: unknown) {
  const text = stringValue(value);
  if (!text) return null;
  return TIME_RE.test(text) ? text : null;
}
