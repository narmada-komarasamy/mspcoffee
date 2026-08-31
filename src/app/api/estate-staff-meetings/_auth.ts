import { requireApiUser } from '@/lib/auth/api';

export const ESTATE_STAFF_MEETING_ROLES = ['admin', 'supervisor', 'ceo'];

export async function requireEstateStaffMeetingUser(request: Request, allowedRoles = ESTATE_STAFF_MEETING_ROLES) {
  return requireApiUser(request, allowedRoles);
}

export function stringValue(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

export function nullableString(value: unknown) {
  const text = stringValue(value);
  return text ? text : null;
}

export function nullableDateOrTime(value: unknown) {
  const text = stringValue(value);
  return text ? text : null;
}
