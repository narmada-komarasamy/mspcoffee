import 'server-only';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import type { Role } from './access';

/**
 * Verify the current session and load the user's profile.
 * Redirects to /login if unauthenticated or profile is missing.
 * Call at the top of every dashboard Server Component.
 */
export async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, name, role, estate, must_change_password')
    .eq('id', user.id)
    .single();

  if (!profile) redirect('/login');

  return { user, profile };
}

/**
 * Like requireUser() but also enforces that the user has one of the given roles.
 * Redirects to /rainfall if authenticated but unauthorised.
 */
export async function requireRole(roles: Role[]) {
  const ctx = await requireUser();
  if (!roles.includes(ctx.profile.role as Role)) redirect('/rainfall');
  return ctx;
}
