/** Use the transaction date, never imported month/year fields, for reporting. */
export function fuelPeriod(date: string) {
  const [year, month] = date.split('-').map(Number);
  return { year, month };
}

export function hoFuelToday() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());
}

type FuelTransaction = { date: string; fuel_type: string; transaction_type: string; qty_l: number; amount: number };

export function currentFuelRows<T extends FuelTransaction>(rows: T[], asOf: string) {
  return rows.filter(row => row.date <= asOf);
}

export function fuelTotals(rows: FuelTransaction[]) {
  let dP = 0, dI = 0, pP = 0, pI = 0, amt = 0;
  for (const row of rows) {
    const qty = Number(row.qty_l);
    if (row.transaction_type === 'PURCHASE') {
      if (row.fuel_type === 'DIESEL') dP += qty;
      if (row.fuel_type === 'PETROL') pP += qty;
      amt += Number(row.amount);
    } else if (row.transaction_type === 'ISSUE') {
      if (row.fuel_type === 'DIESEL') dI += qty;
      if (row.fuel_type === 'PETROL') pI += qty;
    }
  }
  return { dP, dI, pP, pI, amt, dieselStock: dP - dI, petrolStock: pP - pI,
    totalPurchased: dP + pP, totalIssued: dI + pI };
}

export function formatFuelDate(date: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(date) ? date.split('-').reverse().join('/') : date;
}
export function parseFuelDate(value: string) {
  if (!/^\d{2}\/\d{2}\/\d{4}$/.test(value)) return '';
  const iso = value.split('/').reverse().join('-');
  const parsed = new Date(iso);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === iso ? iso : '';
}
export function cleanFuelExtraction(value: Record<string, unknown>) {
  const str = (v: unknown, max = 500) => typeof v === 'string' ? v.trim().slice(0, max) : '';
  const number = (v: unknown) => typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : null;
  const date = str(value.date);
  return {
    date: /^\d{4}-\d{2}-\d{2}$/.test(date) && parseFuelDate(formatFuelDate(date)) === date ? date : '',
    source: str(value.source),
    fuel_type: value.fuel_type === 'DIESEL' || value.fuel_type === 'PETROL' ? value.fuel_type : '',
    qty_l: number(value.qty_l), amount: number(value.amount),
    notes: str(value.notes, 2000),
  };
}
