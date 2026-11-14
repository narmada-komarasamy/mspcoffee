import { includesValue, INDENT_STATUSES, nonNegative, requireEstate, text, validDate, STOCK_STATUSES, STOCK_UNITS } from '@/lib/estate-stock';

export function cleanIndent(body: Record<string, unknown>, actor: string) {
  const date = text(body.date);
  if (!validDate(date)) throw new Error('Enter a valid indent date.');
  const fromEst = requireEstate(text(body.fromEstate));
  const toEst = requireEstate(text(body.toEstate));
  if (fromEst === toEst) throw new Error('An indent must move between two different estates.');
  const item = text(body.item);
  if (!item) throw new Error('Enter the item being transferred.');
  const status = text(body.status) || 'In Transit';
  if (!includesValue(INDENT_STATUSES, status)) throw new Error('Choose a valid status.');
  const no = text(body.no) || `IND-${Date.now().toString(36).toUpperCase()}`;
  return {
    indent_no: no,
    indent_date: date,
    from_estate: fromEst,
    to_estate: toEst,
    item,
    quantity: nonNegative(body.quantity),
    weight_kg: nonNegative(body.weight_kg),
    status,
    signed_by: actor,
    received_by: status === 'In Transit' ? null : text(body.receivedBy) || null,
    notes: text(body.notes, 2000) || null,
    created_by: actor,
  };
}

export function cleanInvoice(body: Record<string, unknown>, actor: string) {
  const no = text(body.no);
  if (!no) throw new Error('Enter the invoice number.');
  const date = text(body.date);
  if (!validDate(date)) throw new Error('Enter a valid invoice date.');
  const supplier = text(body.supplier);
  if (!supplier) throw new Error('Enter the supplier.');
  const item = text(body.item);
  if (!item) throw new Error('Enter the item purchased.');
  const estate = requireEstate(text(body.estate));
  return {
    invoice_no: no,
    invoice_date: date,
    supplier,
    item,
    estate,
    amount: nonNegative(body.amount),
    notes: text(body.notes, 2000) || null,
    created_by: actor,
  };
}

export function cleanItem(body: Record<string, unknown>, actor: string) {
  const item = text(body.item);
  if (!item) throw new Error('Enter the item name.');
  const estate = requireEstate(text(body.estate));
  const status = text(body.status) || 'In Stock';
  if (!includesValue(STOCK_STATUSES, status)) throw new Error('Choose a valid status.');
  const unit = text(body.unit) || 'Nos';
  if (!includesValue(STOCK_UNITS, unit)) throw new Error('Choose a valid unit.');
  return {
    item,
    estate,
    unit,
    status,
    quantity: nonNegative(body.quantity),
    weight_kg: nonNegative(body.weight_kg),
    storage_location: text(body.storage_location, 200) || null,
    notes: text(body.notes, 2000) || null,
    created_by: actor,
  };
}
