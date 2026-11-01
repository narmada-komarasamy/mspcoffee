export const ESTATE_STOCK_ROLES = ['admin', 'supervisor', 'ceo'];

export const ESTATE_NAMES = [
  'Moganad Estate',
  'Stanmore Estate',
  'Stanmore Hospital',
  'Orchardale Estate',
  'Hidden Falls Estate',
] as const;
export type EstateName = (typeof ESTATE_NAMES)[number];

export const INDENT_STATUSES = [
  'In Transit',
  'Delivered',
  'Settled',
  'Returned',
  'Cancelled',
] as const;

export const STOCK_STATUSES = [
  'In Stock',
  'In Transit',
  'Reserved',
  'Maintained',
  'Damaged',
  'Out of Service',
] as const;

export const STOCK_UNITS = ['Nos', 'Kg', 'L', 'Set', 'Box', 'Bag', 'Other'] as const;

export const BUCKET = 'estate-stock-invoices';

export function text(value: unknown, max = 500) {
  return (typeof value === 'string' || typeof value === 'number' ? String(value) : '')
    .trim()
    .slice(0, max);
}

export function validDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value));
}

export function nonNegative(value: unknown, allowEmpty = true): number {
  if (value === '' || value === null || value === undefined) return allowEmpty ? 0 : -1;
  const parsed = Number(String(value).replace(/,/g, ''));
  if (!Number.isFinite(parsed) || parsed < 0) throw new Error('Enter a non-negative number.');
  return parsed;
}

export function includesValue(list: readonly string[], value: string): boolean {
  return list.includes(value);
}

export function requireEstate(value: string): EstateName {
  if (!ESTATE_NAMES.includes(value as EstateName)) {
    throw new Error(`Choose one of: ${ESTATE_NAMES.join(', ')}.`);
  }
  return value as EstateName;
}

export function indentFileError(file: { type: string; size: number }) {
  if (!['application/pdf', 'image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
    return 'Choose a PDF, JPG, PNG or WebP file.';
  }
  return file.size > 4 * 1024 * 1024 || file.size === 0
    ? 'Choose a non-empty file no larger than 4 MB.'
    : '';
}
