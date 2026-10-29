export const COURIERS = ['Professional Courier', 'DHL', 'MSS (Mettur Transport)', 'VRL', 'Hand delivered', 'Other'] as const;
export const SHIPMENT_STATUSES = ['Pending', 'Dispatched', 'Delivered', 'Delayed', 'Returned', 'Not recorded'] as const;
export const PAYMENT_STATUSES = ['Unpaid', 'Paid', 'Not recorded'] as const;
export function text(value: unknown, max = 500) { return typeof value === 'string' ? value.trim().slice(0, max) : ''; }
export function validDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0,10) === value;
}
export function cleanShipment(input: Record<string, unknown>) {
  const row: Record<string, string | number | null> = {};
  for (const key of ['recipientName','phone','city','address','courier','tracking','sent','expected','status','contents','invoiceNumber','paymentStatus','onBehalfOf','deliveredBy']) row[key] = text(input[key], ['address','contents'].includes(key) ? 5000 : 500);
  row.paymentStatus ||= 'Not recorded'; row.status ||= 'Pending';
  if (!row.recipientName || !row.courier || !validDate(String(row.sent))) throw new Error('Enter a recipient name, courier and valid date sent.');
  if (!SHIPMENT_STATUSES.includes(row.status as typeof SHIPMENT_STATUSES[number]) || !PAYMENT_STATUSES.includes(row.paymentStatus as typeof PAYMENT_STATUSES[number])) throw new Error('Choose a valid shipment and payment status.');
  if (row.status === 'Dispatched' && row.courier !== 'Hand delivered' && !row.tracking) throw new Error('Enter the tracking number before marking this package Dispatched.');
  if (row.courier === 'Hand delivered' && !row.deliveredBy) throw new Error('Enter the name of the person making the hand delivery.');
  if (row.expected && (!validDate(String(row.expected)) || String(row.expected) < String(row.sent))) throw new Error('Expected delivery must be a valid date on or after the date sent.');
  const cost = input.cost;
  if (cost === '' || cost === null || cost === undefined) row.cost = null;
  else {
    if (!/^(?:\d+)(?:\.\d{1,2})?$/.test(String(cost)) || Number(cost) > 99999999) throw new Error('Enter a non-negative cost with up to two decimal places.');
    row.cost = Number(cost);
  }
  return row;
}
export function fileError(file: {type:string; size:number}) {
  if (!['application/pdf','image/jpeg','image/png','image/webp'].includes(file.type)) return 'Choose a PDF, JPG, PNG or WebP file.';
  return file.size > 4 * 1024 * 1024 || file.size === 0 ? 'Choose a non-empty file no larger than 4 MB.' : '';
}
