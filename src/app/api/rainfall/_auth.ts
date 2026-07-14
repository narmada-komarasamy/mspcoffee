import { NextResponse } from 'next/server';
import { adminClient } from '@/lib/supabase/admin';

type AppUserRow = {
  id: string;
  role: string;
  pin: string;
  active: boolean | null;
};

export const RAINFALL_ROLES = ['admin', 'supervisor', 'worker', 'ceo'];
export const RAINFALL_DELETE_ROLES = ['admin', 'supervisor', 'ceo'];
export const VALID_ESTATES = ['Gowri', 'Hidden Falls', 'Moganad', 'Orchardale', 'Stanmore', 'Vyapurikuttai'];
export const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type RainfallPayload = {
  date: string;
  estate: string;
  rainfall_mm: number;
  inches: number;
};

export async function requireRainfallUser(request: Request, allowedRoles = RAINFALL_ROLES) {
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
    return { error: NextResponse.json({ error: 'Rainfall access required' }, { status: 403 }) };
  }

  return { supabase, user };
}

export function parseRainfallPayload(payload: unknown) {
  if (!payload || typeof payload !== 'object') return { error: 'Enter a valid rainfall record' };

  const row = payload as Record<string, unknown>;
  const date = typeof row.date === 'string' ? row.date.trim() : '';
  const estate = typeof row.estate === 'string' ? row.estate.trim() : '';
  const rainfallMm = Number(row.rainfall_mm);

  if (!DATE_RE.test(date) || Number.isNaN(new Date(`${date}T00:00:00Z`).getTime())) {
    return { error: 'Enter a valid date' };
  }

  if (!VALID_ESTATES.includes(estate)) {
    return { error: 'Enter a valid estate' };
  }

  if (!Number.isFinite(rainfallMm) || rainfallMm < 0 || rainfallMm > 2000) {
    return { error: 'Enter rainfall between 0 and 2000 mm' };
  }

  return {
    record: {
      date,
      estate,
      rainfall_mm: Math.round(rainfallMm * 10) / 10,
      inches: Math.round(rainfallMm * 0.0394 * 1000) / 1000,
    } satisfies RainfallPayload,
  };
}
