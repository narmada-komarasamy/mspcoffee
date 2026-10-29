export const BILL_BUCKET = 'fleet-maintenance-bills';
// Leave room for multipart fields within the hosting request limit.
export const MAX_BILL_BYTES = 4 * 1024 * 1024;
export const BILL_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];

export const fleetVehicleKey = (vehicle: string) => vehicle.toUpperCase().replace(/[^A-Z0-9]/g, '');
export function validBillDate(date: string) {
  return !date || (/^\d{4}-\d{2}-\d{2}$/.test(date) && !Number.isNaN(Date.parse(date)) && new Date(date).toISOString().slice(0, 10) === date);
}
export function possibleMaintenanceDuplicates<T extends { id?: number; vehicle_id: string; maint_cost: number | string }>(rows: T[], entry: T, original?: T | null) {
  const amount = Math.round(Number(entry.maint_cost) * 100);
  const vehicle = fleetVehicleKey(entry.vehicle_id);
  if (!vehicle || amount <= 0 || !Number.isFinite(amount)) return [];
  if (original?.id === entry.id && original?.id != null && fleetVehicleKey(original.vehicle_id) === vehicle && Math.round(Number(original.maint_cost) * 100) === amount) return [];
  return rows.filter(row => row.id !== entry.id && fleetVehicleKey(row.vehicle_id) === vehicle && Math.round(Number(row.maint_cost) * 100) === amount);
}

type MaintenanceEntry = {
  date: string;
  maint_cost: number | string | null;
  maintenance_bill_path?: string | null;
  maintenance_performed?: string | null;
  maintenance_vendor?: string | null;
};

export function maintenanceEntries<T extends MaintenanceEntry>(rows: T[]): T[] {
  return rows.filter(row => Number(row.maint_cost) !== 0 || row.maintenance_bill_path ||
    row.maintenance_performed?.trim() || row.maintenance_vendor?.trim())
    .sort((a, b) => b.date.localeCompare(a.date));
}

// Keep the list when an unreceipted entry also contributes to the total.
export function singleMaintenanceBillPath(rows: MaintenanceEntry[]) {
  const entries = maintenanceEntries(rows);
  return entries.length === 1 ? entries[0].maintenance_bill_path || '' : '';
}

export function billFileError(file: { size: number; type: string }) {
  if (!BILL_TYPES.includes(file.type)) return 'Choose a JPG, PNG, WebP photo or PDF bill.';
  if (!file.size) return 'The bill file is empty.';
  if (file.size > MAX_BILL_BYTES) return 'The bill must be 4 MB or smaller.';
  return '';
}

export function matchesMaintenanceSearch(record: {
  vehicle_id: string;
  maintenance_performed: string;
  remarks: string;
  maintenance_vendor?: string | null;
  maintenance_bill_text?: string | null;
}, query: string) {
  const text = [record.vehicle_id, record.maintenance_performed, record.remarks,
    record.maintenance_vendor, record.maintenance_bill_text].join(' ').normalize('NFKC').toLowerCase();
  return query.normalize('NFKC').toLowerCase().trim().split(/\s+/).every(term => text.includes(term));
}

export function cleanBillExtraction(value: Record<string, unknown>) {
  const string = (v: unknown, max = 500) => typeof v === 'string' ? v.trim().slice(0, max) : '';
  const total = value.total;
  const date = string(value.date);
  return {
    total: typeof total === 'number' && Number.isFinite(total) && total >= 0 ? total : null,
    date: /^\d{4}-\d{2}-\d{2}$/.test(date) && !Number.isNaN(Date.parse(date)) && new Date(date).toISOString().slice(0, 10) === date ? date : '',
    workshop: string(value.workshop),
    maintenance_items: string(value.maintenance_items, 10000),
    bill_text: string(value.bill_text, 50000),
    notes: string(value.notes, 1000),
  };
}
