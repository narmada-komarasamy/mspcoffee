import { NextResponse } from 'next/server';
import { adminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

export type ApiUser = {
  id: string;
  name: string;
  role: string;
  estate: string | null;
  active: boolean;
};

type ProfileRow = {
  id: string;
  name: string | null;
  role: string;
  estate: string | null;
  active: boolean | null;
};

type AppUserRow = {
  id: string;
  name: string;
  role: string;
  estate: string | null;
  pin: string;
  active: boolean | null;
};

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{12}$/i;
export const APP_USER_ID_RE = /^[A-Za-z0-9_-]{1,128}$/;

function unauthorized(message = 'Unauthorized', status = 401) {
  return { error: NextResponse.json({ error: message }, { status }) };
}

function normalizeRole(role: string) {
  return role.trim().toLowerCase();
}

function cookieValue(request: Request, name: string) {
  const cookie = request.headers.get('cookie');
  if (!cookie) return '';

  const match = cookie
    .split(';')
    .map((item) => item.trim())
    .find((item) => item.startsWith(`${name}=`));

  return match ? decodeURIComponent(match.slice(name.length + 1)) : '';
}

export async function requireApiUser(request: Request, allowedRoles?: string[]) {
  const allowed = allowedRoles?.map(normalizeRole);
  const supabase = adminClient();

  const sessionClient = await createClient();
  const {
    data: { user: authUser },
  } = await sessionClient.auth.getUser();

  if (authUser) {
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('id, name, role, estate, active')
      .eq('id', authUser.id)
      .single<ProfileRow>();

    if (error || !profile) return unauthorized();
    if (profile.active === false) return unauthorized('Account disabled', 403);

    const role = normalizeRole(profile.role);
    if (allowed && !allowed.includes(role)) return unauthorized('Access denied', 403);

    return {
      supabase,
      user: {
        id: profile.id,
        name: profile.name || authUser.email || 'MSP User',
        role,
        estate: profile.estate,
        active: true,
      } satisfies ApiUser,
    };
  }

  const headerUserId = request.headers.get('x-msp-user-id')?.trim();
  const cookieUserId = cookieValue(request, 'msp_user_id');
  const legacyUserId = [headerUserId, cookieUserId].find((value) => value && APP_USER_ID_RE.test(value)) ?? '';
  const legacyPin = request.headers.get('x-msp-user-pin')?.trim() || cookieValue(request, 'msp_user_pin');

  if (legacyUserId && legacyPin && APP_USER_ID_RE.test(legacyUserId)) {
    const { data: user, error } = await supabase
      .from('app_users')
      .select('id, name, role, estate, pin, active')
      .eq('id', legacyUserId)
      .single<AppUserRow>();

    if (error || !user) return unauthorized();
    if (user.active === false) return unauthorized('Account disabled', 403);
    if (user.pin !== legacyPin) return unauthorized();

    const role = normalizeRole(user.role);
    if (allowed && !allowed.includes(role)) return unauthorized('Access denied', 403);

    return {
      supabase,
      user: {
        id: user.id,
        name: user.name,
        role,
        estate: user.estate,
        active: true,
      } satisfies ApiUser,
    };
  }

  return unauthorized();
}
