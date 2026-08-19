import { NextResponse } from 'next/server';
import { adminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

type AppUserRow = {
  id: string;
  role: string;
  pin: string;
  active: boolean | null;
  name: string | null;
};

type ProfileRow = {
  id: string;
  role: string;
  active: boolean | null;
  name: string | null;
  estate: string | null;
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

function normalizeRole(role: string) {
  return role.trim().toLowerCase();
}

function allowedRole(role: string, allowedRoles: string[]) {
  return allowedRoles.map(normalizeRole).includes(normalizeRole(role));
}

async function requireSupabaseEmailUser(allowedRoles: string[]) {
  const sessionClient = await createClient();
  const {
    data: { user: authUser },
  } = await sessionClient.auth.getUser();

  if (!authUser) return null;

  const supabase = adminClient();
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('id, role, active, name, estate')
    .eq('id', authUser.id)
    .single<ProfileRow>();

  if (error || !profile) {
    return authError('Email session user could not be found. Sign out and sign back in.');
  }

  if (profile.active === false) {
    return authError('Email access is disabled for this user.', 403);
  }

  const role = normalizeRole(profile.role);
  if (!allowedRole(role, allowedRoles)) {
    return authError(`Email access is not enabled for this user role (${role}). Change this user to the hr role in Admin Controls.`, 403);
  }

  return {
    supabase,
    user: {
      id: profile.id,
      role,
      active: profile.active,
      name: profile.name || authUser.email || 'MSP User',
      estate: profile.estate,
    },
  };
}

export async function requireEmailUser(request: Request, allowedRoles = EMAIL_ROLES) {
  const sessionAuth = await requireSupabaseEmailUser(allowedRoles);
  if (sessionAuth) return sessionAuth;

  const headerUserId = request.headers.get('x-msp-user-id')?.trim();
  const cookieUserId = cookieValue(request, 'msp_user_id');
  const userId = [headerUserId, cookieUserId].find((value) => value && APP_USER_ID_RE.test(value)) ?? '';
  const userPin = request.headers.get('x-msp-user-pin')?.trim() || cookieValue(request, 'msp_user_pin');

  if (!userId) {
    return authError('Email session is missing the user id. Sign out and sign back in.');
  }

  if ((headerUserId || cookieUserId) && !userId) {
    return authError('Email session has an invalid user id. Sign out and sign back in.');
  }

  if (!userPin) {
    return authError('Email session is missing the PIN credential. Sign out and sign back in.');
  }

  const supabase = adminClient();
  const { data: user, error } = await supabase
    .from('app_users')
    .select('id, role, pin, active, name')
    .eq('id', userId)
    .single<AppUserRow>();

  if (error || !user) {
    return authError('Email session user could not be found. Sign out and sign back in.');
  }

  if (user.active === false) {
    return authError('Email access is disabled for this user.', 403);
  }

  if (user.pin !== userPin) {
    return authError('Email session PIN does not match the current user PIN. Sign out and sign back in.');
  }

  const role = normalizeRole(user.role);
  if (!allowedRole(role, allowedRoles)) {
    return authError(`Email access is not enabled for this user role (${role}). Change this user to the hr role in Admin Controls.`, 403);
  }

  return { supabase, user: { ...user, role } };
}
