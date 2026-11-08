export const BILL_MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export type BillPayee = 'Mr. AM' | 'Mrs. NA';
export type PhoneBillRow = {
  month: string; year: string; billType: string; location: string; user: string;
  phone: string; accountNo: string; dueDate: string; amount: number | null;
  remarks: string; payee: BillPayee; manual?: boolean;
};
export type PhoneStatement = {
  id: string; period: string; reference: string; rows: PhoneBillRow[]; total: number;
  created_at: string; created_by: string; payment_date: string | null;
  payment_reference: string | null; payment_amount: number | null;
};
export type StatementFile = { id: string; file_name: string; created_at: string };

export function billPayee(row: { remarks?: string; accountNo?: string; payee?: string }): BillPayee {
  if (row.payee === 'Mr. AM' || row.payee === 'Mrs. NA') return row.payee;
  if (/Mrs\.?\s*NA\b/i.test(row.remarks || '')) return 'Mrs. NA';
  if (/Mr\.?\s*AM\b/i.test(row.remarks || '')) return 'Mr. AM';
  return ['7005724759', '9041904329'].includes(row.accountNo?.replace(/\s/g, '') || '') ? 'Mrs. NA' : 'Mr. AM';
}

export function billKey(row: PhoneBillRow) {
  return [row.year, row.month, row.billType.toLowerCase(), (row.accountNo || row.phone).replace(/[^a-z0-9]/gi, '').toLowerCase()].join('|');
}
export function billPeriod(row: Pick<PhoneBillRow, 'month' | 'year'>) {
  return `${row.year}-${String(BILL_MONTHS.indexOf(row.month) + 1).padStart(2, '0')}`;
}
export function validPeriod(value: unknown): value is string {
  return typeof value === 'string' && /^(20\d{2})-(0[1-9]|1[0-2])$/.test(value);
}
export function totalBills(rows: PhoneBillRow[]) {
  return rows.reduce((sum, row) => sum + Math.round((row.amount ?? 0) * 100), 0) / 100;
}
export function mergeBillRows(base: PhoneBillRow[], saved: PhoneBillRow[]) {
  const overrides = new Map(saved.map(r => [billKey(r), r]));
  const existing = new Set(base.map(billKey));
  return [...base.map(r => overrides.get(billKey(r)) || r), ...saved.filter(r => !existing.has(billKey(r)))];
}
export function payeeTotals(rows: PhoneBillRow[]) {
  return (['Mr. AM', 'Mrs. NA'] as const).map(payee => ({ payee, total: totalBills(rows.filter(r => billPayee(r) === payee)) }));
}
export function billMoney(value: number) {
  return `₹${value.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
export function parsePhoneCsv(csv: string): PhoneBillRow[] {
  const records: string[][] = []; let record: string[] = []; let cell = ''; let quoted = false;
  for (let i = 0; i < csv.length; i++) {
    const char = csv[i];
    if (char === '"' && quoted && csv[i + 1] === '"') { cell += '"'; i++; }
    else if (char === '"') quoted = !quoted;
    else if (char === ',' && !quoted) { record.push(cell.trim()); cell = ''; }
    else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && csv[i + 1] === '\n') i++;
      record.push(cell.trim()); if (record.some(Boolean)) records.push(record); record = []; cell = '';
    } else cell += char;
  }
  record.push(cell.trim()); if (record.some(Boolean)) records.push(record);
  return records.slice(1).map(c => {
    const amount = c[8] === '' ? null : Number(c[8]);
    const row = { month: c[0], year: c[1], billType: c[2], location: c[3], user: c[4], phone: c[5], accountNo: c[6], dueDate: c[7], amount: Number.isFinite(amount) ? amount : null, remarks: c[9] || '' };
    return { ...row, payee: billPayee(row) };
  });
}
export function cleanBillRow(value: unknown): PhoneBillRow {
  if (!value || typeof value !== 'object') throw new Error('A bill entry is required.');
  const raw = value as Record<string, unknown>;
  const text = (key: string) => typeof raw[key] === 'string' ? (raw[key] as string).trim().slice(0, 500) : '';
  const amount = raw.amount;
  if (amount !== null && (typeof amount !== 'number' || !Number.isFinite(amount) || amount < 0 || amount > 10000000 || Math.abs(amount * 100 - Math.round(amount * 100)) > 0.000001)) throw new Error('Enter a valid amount with up to two decimal places.');
  const row = { month: text('month'), year: text('year'), billType: text('billType'), location: text('location'), user: text('user'), phone: text('phone'), accountNo: text('accountNo'), dueDate: text('dueDate'), amount: amount as number | null, remarks: text('remarks'), payee: text('payee') as BillPayee, manual: true };
  if (!BILL_MONTHS.includes(row.month) || !/^20\d{2}$/.test(row.year) || !['BSNL Mobile', 'Jio Mobile', 'BSNL FTTH Internet'].includes(row.billType) || !row.location || !row.user || !(row.phone || row.accountNo) || !['Mr. AM', 'Mrs. NA'].includes(row.payee)) throw new Error('Month, year, bill type, location, user, phone/account and reimbursement recipient are required.');
  return row;
}
export function paymentError(value: { date?: unknown; reference?: unknown; amount?: unknown }, total: number) {
  if (typeof value.date !== 'string' || !/^20\d{2}-\d{2}-\d{2}$/.test(value.date) || Number.isNaN(new Date(value.date).getTime()) || new Date(value.date).toISOString().slice(0, 10) !== value.date) return 'Enter a valid payment date.';
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  if (value.date > today) return 'Payment date cannot be in the future.';
  if (typeof value.reference !== 'string' || !value.reference.trim() || value.reference.length > 200) return 'Enter the payment reference or voucher number.';
  if (typeof value.amount !== 'number' || !Number.isFinite(value.amount) || Math.round(value.amount * 100) !== Math.round(total * 100)) return 'Payment must match the full monthly statement total.';
  return '';
}
