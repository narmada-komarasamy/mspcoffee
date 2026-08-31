import { requireApiUser, UUID_RE } from '@/lib/auth/api';
export { UUID_RE };

export const OPERATIONS_CALENDAR_ROLES = ['admin', 'supervisor', 'worker', 'ceo', 'hr'];
export const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
export const TIME_RE = /^\d{2}:\d{2}(:\d{2})?$/;

export async function requireOperationsCalendarUser(request: Request, allowedRoles = OPERATIONS_CALENDAR_ROLES) {
  return requireApiUser(request, allowedRoles);
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
