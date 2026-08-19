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

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{12}$/i;

function unauthorized(message = 'Unauthorized', status = 401) {
  return { error: NextResponse.json({ error: message }, { status }) };
}

function normalizeRole(role: string) {
  return role.trim().toLowerCase();
}

export async function requireApiUser(_request: Request, allowedRoles?: string[]) {
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

  return unauthorized();
}
