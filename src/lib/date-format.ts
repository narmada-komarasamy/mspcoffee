/** MSP Coffee date convention: DDMMYYYY on screen and in exports; ISO in storage. */
export const APP_DATE_FORMAT = 'DDMMYYYY';
export function validIsoDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
export function parseAppDate(value: unknown): string {
  if (typeof value !== 'string') return '';
  const text = value.trim();
  if (validIsoDate(text)) return text;
  const compact = /^(\d{2})(\d{2})(\d{4})$/.exec(text);
  const separated = /^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{4})$/.exec(text);
  const parts = compact || separated;
  if (!parts) return '';
  const iso = `${parts[3]}-${parts[2].padStart(2, '0')}-${parts[1].padStart(2, '0')}`;
  return validIsoDate(iso) ? iso : '';
}
export function formatDate(value: unknown, empty = '—'): string {
  if (value == null || value === '') return empty;
  const iso = typeof value === 'string' ? parseAppDate(value) : '';
  if (iso) return iso.slice(8, 10) + iso.slice(5, 7) + iso.slice(0, 4);
  // Only timestamps / Date objects reach the timezone conversion path.
  if (typeof value === 'string' && !/^\d{4}-\d{2}-\d{2}T/.test(value)) return value;
  if (!(value instanceof Date) && typeof value !== 'string' && typeof value !== 'number') return empty;
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) return empty;
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', day: '2-digit', month: '2-digit', year: 'numeric' }).formatToParts(date);
  const get = (type: string) => parts.find(part => part.type === type)?.value || '';
  return get('day') + get('month') + get('year');
}
export function formatDateTime(value: unknown, empty = '—'): string {
  if (value == null || value === '') return empty;
  const date = value instanceof Date ? value : new Date(String(value));
  if (!Number.isFinite(date.getTime())) return empty;
  return `${formatDate(date, empty)} ${new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(date)}`;
}
export function dateInputError(draft: string, min?: string, max?: string): string {
  if (!draft) return '';
  const iso = parseAppDate(draft);
  if (!iso) return 'Enter a real date as DDMMYYYY, for example 14112026.';
  if (min && iso < min) return `Choose ${formatDate(min)} or a later date.`;
  if (max && iso > max) return `Choose ${formatDate(max)} or an earlier date.`;
  return '';
}
