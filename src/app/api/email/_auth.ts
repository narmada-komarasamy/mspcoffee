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
const APP_USER_ID_RE = /^[A-Za-z0-9_-]{1,128}$/;

function authError(message: string, status = 401) {
  return { error: NextResponse.json({ error: message }, { status }) };
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

export async function requireEmailUser(request: Request, allowedRoles = EMAIL_ROLES) {
  const headerUserId = request.headers.get('x-msp-user-id')?.trim();
  const cookieUserId = cookieValue(request, 'msp_user_id');
  const userId = [headerUserId, cookieUserId].find((value) => value && APP_USER_ID_RE.test(value)) ?? '';
  const userPin = request.headers.get('x-msp-user-pin')?.trim() || cookieValue(request, 'msp_user_pin');

  if (!userId) {
    return authError('Email session is missing the admin user id. Sign out and sign back in as admin.');
  }

  if ((headerUserId || cookieUserId) && !userId) {
    return authError('Email session has an invalid admin user id. Sign out and sign back in as admin.');
  }

  if (!userPin) {
    return authError('Email session is missing the admin PIN credential. Sign out and sign back in as admin.');
  }

  const supabase = adminClient();
  const { data: user, error } = await supabase
    .from('app_users')
    .select('id, role, pin, active, name')
    .eq('id', userId)
    .single<AppUserRow>();

  if (error || !user) {
    return authError('Email session user could not be found. Sign out and sign back in as admin.');
  }

  if (user.active === false) {
    return authError('Email access is disabled for this user.');
  }

  if (user.pin !== userPin) {
    return authError('Email session PIN does not match the current admin PIN. Sign out and sign back in as admin.');
  }

  const role = user.role.trim().toLowerCase();
  if (!allowedRoles.includes(role)) {
    return authError('Email Reports is restricted to admin users.', 403);
  }

  return { supabase, user: { ...user, role } };
}
