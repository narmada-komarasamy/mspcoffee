'use server';

import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { adminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { APP_USER_ID_RE } from '@/lib/auth/api';

export type Access = 'none' | 'view' | 'full';

export type AuthUserRow = {
  id: string;
  name: string;
  pin: string;
  role: string;
  estate: string | null;
  active: boolean;
};

export type UserActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string };

type AppUserRow = {
  id: string;
  name: string;
  role: string;
  pin: string;
  estate: string | null;
  active: boolean | null;
};

type UserInput = {
  pin?: string;
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

function validateUserInput(input: UserInput) {
  const name = cleanText(input.name);
  const role = normalizeRole(input.role);
  const estate = cleanEstate(input.estate);

  if (!name) return { ok: false as const, error: 'Name is required' };
  if (!ROLES.has(role)) return { ok: false as const, error: 'Invalid role' };

  return { ok: true as const, data: { name, role, estate } };
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
    .single<{ id: string; role: string; pin: string; active: boolean | null }>();

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

export async function listAuthUsersAction(): Promise<UserActionResult<AuthUserRow[]>> {
  try {
    const { supabase } = await requireAdmin();
    const { data, error } = await supabase
      .from('app_users')
      .select('id, name, pin, role, estate, active')
      .order('name')
      .returns<AppUserRow[]>();

    if (error) throw error;

    const users = (data ?? []).map((user) => ({
      id: user.id,
      name: user.name || 'MSP User',
      pin: user.pin,
      role: normalizeRole(user.role || 'worker'),
      estate: user.estate ?? null,
      active: user.active !== false,
    }));

    return { ok: true, data: users };
  } catch (error) {
    return actionError(error, 'Unable to load users');
  }
}

export async function inviteAuthUserAction(input: UserInput): Promise<UserActionResult> {
  try {
    const parsed = validateUserInput(input);
    if (!parsed.ok) return parsed;
    const pin = cleanText(input.pin);
    if (!/^\d{4}$/.test(pin)) return { ok: false, error: 'PIN must be exactly 4 digits' };

    const { supabase } = await requireAdmin();
    const { name, role, estate } = parsed.data;
    const { error } = await supabase.from('app_users').insert([{ name, pin, role, estate, active: true }]);

    if (error) throw error;
    revalidatePath('/admin-controls/users');
    return { ok: true, data: undefined };
  } catch (error) {
    return actionError(error, 'Unable to add user');
  }
}

export async function updateAuthUserAction(userId: string, input: UserInput): Promise<UserActionResult> {
  try {
    if (!APP_USER_ID_RE.test(userId)) return { ok: false, error: 'Invalid user id' };

    const parsed = validateUserInput(input);
    if (!parsed.ok) return parsed;

    const { supabase } = await requireAdmin();
    const { name, role, estate } = parsed.data;

    const { error } = await supabase
      .from('app_users')
      .update({ name, role, estate })
      .eq('id', userId);
    if (error) throw error;

    revalidatePath('/admin-controls/users');
    return { ok: true, data: undefined };
  } catch (error) {
    return actionError(error, 'Unable to update user');
  }
}

export async function setAuthUserActiveAction(userId: string, active: boolean): Promise<UserActionResult> {
  try {
    if (!APP_USER_ID_RE.test(userId)) return { ok: false, error: 'Invalid user id' };

    const { supabase, adminUserId } = await requireAdmin();
    if (userId === adminUserId && !active) return { ok: false, error: 'You cannot deactivate your own account' };

    const { error } = await supabase
      .from('app_users')
      .update({ active })
      .eq('id', userId);
    if (error) throw error;

    revalidatePath('/admin-controls/users');
    return { ok: true, data: undefined };
  } catch (error) {
    return actionError(error, 'Unable to update user status');
  }
}

export async function loadUserPermissionsAction(userId: string): Promise<UserActionResult<Record<string, Access>>> {
  try {
    if (!APP_USER_ID_RE.test(userId)) return { ok: false, error: 'Invalid user id' };

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
    if (!APP_USER_ID_RE.test(userId)) return { ok: false, error: 'Invalid user id' };

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

export async function resetAppUserPinAction(userId: string, pin: string): Promise<UserActionResult> {
  try {
    if (!APP_USER_ID_RE.test(userId)) return { ok: false, error: 'Invalid user id' };
    const cleanPin = cleanText(pin);
    if (!/^\d{4}$/.test(cleanPin)) return { ok: false, error: 'PIN must be exactly 4 digits' };

    const { supabase } = await requireAdmin();
    const { error } = await supabase.from('app_users').update({ pin: cleanPin }).eq('id', userId);
    if (error) throw error;

    revalidatePath('/admin-controls/users');
    return { ok: true, data: undefined };
  } catch (error) {
    return actionError(error, 'Unable to reset PIN');
  }
}
