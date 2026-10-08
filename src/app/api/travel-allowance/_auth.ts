import { requireApiUser, UUID_RE } from '@/lib/auth/api';
export { UUID_RE };

export const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const SLASH_DATE_RE = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;

function validDateKey(date: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) return false;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const parsed = new Date(Date.UTC(year, month - 1, day));

  return parsed.getUTCFullYear() === year
    && parsed.getUTCMonth() === month - 1
    && parsed.getUTCDate() === day;
}

export function normalizeDateKey(value: unknown) {
  if (typeof value !== 'string') return '';

  const trimmed = value.trim();
  if (DATE_RE.test(trimmed)) return validDateKey(trimmed) ? trimmed : '';

  const slashMatch = SLASH_DATE_RE.exec(trimmed);
  if (!slashMatch) return '';

  const first = Number(slashMatch[1]);
  const second = Number(slashMatch[2]);
  const year = Number(slashMatch[3]);
  const month = first > 12 ? second : first;
  const day = first > 12 ? first : second;
  const date = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

  return validDateKey(date) ? date : '';
}

export async function requireTravelAllowanceUser(request: Request, allowedRoles?: string[]) {
  return requireApiUser(request, allowedRoles);
}
