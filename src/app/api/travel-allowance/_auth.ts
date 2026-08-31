import { requireApiUser, UUID_RE } from '@/lib/auth/api';
export { UUID_RE };

export const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function requireTravelAllowanceUser(request: Request, allowedRoles?: string[]) {
  return requireApiUser(request, allowedRoles);
}
