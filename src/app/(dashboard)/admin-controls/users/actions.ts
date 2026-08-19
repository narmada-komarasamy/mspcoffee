'use server';

import { headers } from 'next/headers';
import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { adminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { APP_USER_ID_RE, UUID_RE } from '@/lib/auth/api';

export type Access = 'none' | 'view' | 'full';

export type AuthUserRow = {
  id: string;
  email: string;
  name: string;
  role: string;
  estate: string | null;
  active: boolean;
  createdAt: string | null;
  lastSignInAt: string | null;
};

export type UserActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string };

type ProfileRow = {
  id: string;
  name: string | null;
  role: string | null;
  estate: string | null;
  active: boolean | null;
};

type AppUserRow = {
  id: string;
  role: string;
  pin: string;
  active: boolean | null;
};

type UserInput = {
  email?: string;
  name: string;
  role: string;
  estate: string | null;
};

const ROLES = new Set(['admin', 'supervisor', 'ceo', 'worker', 'hr']);
const ACCESS = new Set<Access>(['none', 'view', 'full']);

function cleanText(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function cleanEstate(value: unknown) {
  const estate = cleanText(value);
  return estate || null;
}

function normalizeRole(value: unknown) {
  return cleanText(value).toLowerCase();
}

function actionError(error: unknown, fallback: string): UserActionResult<never> {
  const message = error instanceof Error ? error.message : fallback;
  return { ok: false, error: message };
}

function validateUserInput(input: UserInput, requireEmail: boolean) {
  const name = cleanText(input.name);
  const role = normalizeRole(input.role);
  const estate = cleanEstate(input.estate);
  const email = cleanText(input.email).toLowerCase();

  if (!name) return { ok: false as const, error: 'Name is required' };
  if (!ROLES.has(role)) return { ok: false as const, error: 'Invalid role' };
  if (requireEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false as const, error: 'Valid email is required' };
  }

  return { ok: true as const, data: { name, role, estate, email } };
}

async function requireAdmin() {
  const sessionClient = await createClient();
  const supabase = adminClient();
  const {
    data: { user },
  } = await sessionClient.auth.getUser();

  if (user) {
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('id, role, active')
      .eq('id', user.id)
      .single<{ id: string; role: string | null; active: boolean | null }>();

    if (error || !profile || profile.role !== 'admin' || profile.active === false) {
      throw new Error('Admin access required');
    }

    return { supabase, adminUserId: user.id };
  }

  const cookieStore = await cookies();
  const legacyUserId = cookieStore.get('msp_user_id')?.value ?? '';
  const legacyPin = cookieStore.get('msp_user_pin')?.value ?? '';
  if (!legacyUserId || !legacyPin || !APP_USER_ID_RE.test(legacyUserId)) throw new Error('Unauthorized');

  const { data: legacyUser, error } = await supabase
    .from('app_users')
    .select('id, role, pin, active')
    .eq('id', legacyUserId)
    .single<AppUserRow>();

  if (
    error ||
    !legacyUser ||
    legacyUser.active === false ||
    legacyUser.pin !== legacyPin ||
    normalizeRole(legacyUser.role) !== 'admin'
  ) {
    throw new Error('Admin access required');
  }

  return { supabase, adminUserId: legacyUser.id };
}

async function getOrigin() {
  const h = await headers();
  const proto = h.get('x-forwarded-proto') || 'http';
  const host = h.get('x-forwarded-host') || h.get('host') || 'localhost:3000';
  return `${proto}://${host}`;
}

export async function listAuthUsersAction(): Promise<UserActionResult<AuthUserRow[]>> {
  try {
    const { supabase } = await requireAdmin();
    const [{ data: authData, error: authError }, { data: profiles, error: profileError }] = await Promise.all([
      supabase.auth.admin.listUsers({ page: 1, perPage: 1000 }),
      supabase.from('profiles').select('id, name, role, estate, active').returns<ProfileRow[]>(),
    ]);

    if (authError) throw authError;
    if (profileError) throw profileError;

    const profileById = new Map((profiles ?? []).map((profile) => [profile.id, profile]));
    const users = (authData.users ?? [])
      .map((user) => {
        const profile = profileById.get(user.id);
        const email = user.email ?? '';
        return {
          id: user.id,
          email,
          name: profile?.name || user.user_metadata?.name || email || 'MSP User',
          role: normalizeRole(profile?.role || user.user_metadata?.role || 'worker'),
          estate: profile?.estate ?? user.user_metadata?.estate ?? null,
          active: profile?.active !== false && !user.banned_until,
          createdAt: user.created_at ?? null,
          lastSignInAt: user.last_sign_in_at ?? null,
        } satisfies AuthUserRow;
      })
      .sort((a, b) => a.name.localeCompare(b.name));

    return { ok: true, data: users };
  } catch (error) {
    return actionError(error, 'Unable to load users');
  }
}

export async function inviteAuthUserAction(input: UserInput): Promise<UserActionResult> {
  try {
    const parsed = validateUserInput(input, true);
    if (!parsed.ok) return parsed;

    const { supabase, adminUserId } = await requireAdmin();
    const origin = await getOrigin();
    const { email, name, role, estate } = parsed.data;
    const { data, error } = await supabase.auth.admin.inviteUserByEmail(email, {
      data: { name, role, estate, created_by: adminUserId },
      redirectTo: `${origin}/auth/callback?type=invite`,
    });

    if (error) throw error;
    if (!data.user?.id) throw new Error('Supabase did not return the invited user');

    const { error: profileError } = await supabase.from('profiles').upsert(
      {
        id: data.user.id,
        name,
        role,
        estate,
        active: true,
        created_by: adminUserId,
      },
      { onConflict: 'id' }
    );

    if (profileError) throw profileError;
    revalidatePath('/admin-controls/users');
    return { ok: true, data: undefined };
  } catch (error) {
    return actionError(error, 'Unable to invite user');
  }
}

export async function updateAuthUserAction(userId: string, input: UserInput): Promise<UserActionResult> {
  try {
    if (!UUID_RE.test(userId)) return { ok: false, error: 'Invalid user id' };

    const parsed = validateUserInput(input, false);
    if (!parsed.ok) return parsed;

    const { supabase } = await requireAdmin();
    const { name, role, estate } = parsed.data;

    const { error: authError } = await supabase.auth.admin.updateUserById(userId, {
      user_metadata: { name, role, estate },
    });
    if (authError) throw authError;

    const { error: profileError } = await supabase
      .from('profiles')
      .update({ name, role, estate })
      .eq('id', userId);
    if (profileError) throw profileError;

    revalidatePath('/admin-controls/users');
    return { ok: true, data: undefined };
  } catch (error) {
    return actionError(error, 'Unable to update user');
  }
}

export async function setAuthUserActiveAction(userId: string, active: boolean): Promise<UserActionResult> {
  try {
    if (!UUID_RE.test(userId)) return { ok: false, error: 'Invalid user id' };

    const { supabase, adminUserId } = await requireAdmin();
    if (userId === adminUserId && !active) return { ok: false, error: 'You cannot deactivate your own account' };

    const { error: profileError } = await supabase
      .from('profiles')
      .update({ active })
      .eq('id', userId);
    if (profileError) throw profileError;

    const { error: authError } = await supabase.auth.admin.updateUserById(userId, {
      ban_duration: active ? 'none' : '876000h',
    });
    if (authError) throw authError;

    revalidatePath('/admin-controls/users');
    return { ok: true, data: undefined };
  } catch (error) {
    return actionError(error, 'Unable to update user status');
  }
}

export async function sendPasswordResetAction(email: string): Promise<UserActionResult> {
  try {
    const cleanEmail = cleanText(email).toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) return { ok: false, error: 'Valid email is required' };

    const { supabase } = await requireAdmin();
    const origin = await getOrigin();
    const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
      redirectTo: `${origin}/auth/callback?type=recovery`,
    });
    if (error) throw error;

    return { ok: true, data: undefined };
  } catch (error) {
    return actionError(error, 'Unable to send reset email');
  }
}

export async function loadUserPermissionsAction(userId: string): Promise<UserActionResult<Record<string, Access>>> {
  try {
    if (!UUID_RE.test(userId)) return { ok: false, error: 'Invalid user id' };

    const { supabase } = await requireAdmin();
    const { data, error } = await supabase
      .from('user_permissions')
      .select('page_href, access')
      .eq('user_id', userId);

    if (error) throw error;

    const permissions: Record<string, Access> = {};
    for (const row of data ?? []) {
      const access = row.access === 'edit' ? 'full' : row.access;
      if (typeof row.page_href === 'string' && ACCESS.has(access as Access)) {
        permissions[row.page_href] = access as Access;
      }
    }

    return { ok: true, data: permissions };
  } catch (error) {
    return actionError(error, 'Unable to load permissions');
  }
}

export async function saveUserPermissionsAction(
  userId: string,
  permissions: Record<string, Access>
): Promise<UserActionResult> {
  try {
    if (!UUID_RE.test(userId)) return { ok: false, error: 'Invalid user id' };

    const rows = Object.entries(permissions).map(([page_href, access]) => ({
      user_id: userId,
      page_href,
      access: ACCESS.has(access) ? access : 'none',
    }));

    const { supabase } = await requireAdmin();
    const { error } = await supabase
      .from('user_permissions')
      .upsert(rows, { onConflict: 'user_id,page_href' });

    if (error) throw error;
    revalidatePath('/admin-controls/users');
    return { ok: true, data: undefined };
  } catch (error) {
    return actionError(error, 'Unable to save permissions');
  }
}
