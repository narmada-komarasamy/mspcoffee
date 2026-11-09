export const REPORT_TYPES = ['daily', 'weekly', 'monthly', 'quarterly', 'half_yearly', 'yearly'] as const;
export type ReportType = typeof REPORT_TYPES[number];
export const REPORT_MODULES = ['rainfall', 'fleet_fuel', 'ho_fuel', 'distance'] as const;
export type ReportModule = typeof REPORT_MODULES[number];
export const REPORT_LABELS: Record<ReportType, string> = { daily: 'Daily', weekly: 'Weekly', monthly: 'Monthly', quarterly: 'Quarterly', half_yearly: 'Half-yearly', yearly: 'Yearly' };
export const MODULE_LABELS: Record<ReportModule, string> = { rainfall: 'Rainfall by estate', fleet_fuel: 'Fleet Fuel spending & litres', ho_fuel: 'HO Fuel issues & purchases', distance: 'All-vehicle kilometres' };
export const REPORT_TITLES: Record<ReportType, string> = { daily: 'MSP Yesterday at a Glance', weekly: 'MSP Last Week at a Glance', monthly: 'MSP Last Month at a Glance', quarterly: 'MSP Last Quarter at a Glance', half_yearly: 'MSP Last Half-year at a Glance', yearly: 'MSP Last Year at a Glance' };
export type ReportPeriod = { start: string; end: string; financialYear: number };
const iso = (date: Date) => date.toISOString().slice(0, 10);
export function validReportDate(value: unknown): value is string {
  return typeof value === 'string' && /^20\d{2}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)) && iso(new Date(value)) === value;
}
export function indiaToday() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}
export function reportPeriod(type: ReportType, anchor: string): ReportPeriod {
  if (!REPORT_TYPES.includes(type) || !validReportDate(anchor)) throw new Error('Choose a valid report type and date.');
  const date = new Date(`${anchor}T00:00:00Z`), year = date.getUTCFullYear(), month = date.getUTCMonth();
  let start = new Date(date), end = new Date(date);
  if (type === 'weekly') { start.setUTCDate(start.getUTCDate() - (start.getUTCDay() + 6) % 7); end = new Date(start); end.setUTCDate(end.getUTCDate() + 6); }
  if (type === 'monthly') { start = new Date(Date.UTC(year, month, 1)); end = new Date(Date.UTC(year, month + 1, 0)); }
  const fy = month < 3 ? year - 1 : year;
  if (['quarterly', 'half_yearly', 'yearly'].includes(type)) {
    const step = type === 'quarterly' ? 3 : type === 'half_yearly' ? 6 : 12;
    const offset = Math.floor(((month - 3 + 12) % 12) / step) * step;
    start = new Date(Date.UTC(fy, 3 + offset, 1)); end = new Date(Date.UTC(fy, 3 + offset + step, 0));
  }
  return { start: iso(start), end: iso(end), financialYear: end.getUTCMonth() < 3 ? end.getUTCFullYear() - 1 : end.getUTCFullYear() };
}
export function previousPeriod(type: ReportType, period: ReportPeriod) {
  const before = new Date(`${period.start}T00:00:00Z`); before.setUTCDate(before.getUTCDate() - 1);
  return reportPeriod(type, iso(before));
}
export function lastCompletedPeriod(type: ReportType, today = indiaToday()) { return previousPeriod(type, reportPeriod(type, today)); }
export function financialYearLabel(year: number) { return `FY ${year}–${String(year + 1).slice(-2)}`; }
export function periodLabel(period: Pick<ReportPeriod, 'start' | 'end'>) {
  const format = (date: string) => new Date(`${date}T00:00:00Z`).toLocaleDateString('en-IN', { timeZone: 'UTC', day: 'numeric', month: 'short', year: 'numeric' });
  return period.start === period.end ? format(period.start) : `${format(period.start)} – ${format(period.end)}`;
}
export type ReportConfig = { type: ReportType; anchor: string; modules: ReportModule[]; title: string; detail: boolean };
export function cleanReportConfig(raw: unknown): ReportConfig {
  if (!raw || typeof raw !== 'object') throw new Error('Choose report settings.');
  const value = raw as Record<string, unknown>;
  if (!REPORT_TYPES.includes(value.type as ReportType) || !validReportDate(value.anchor)) throw new Error('Choose a valid report type and date.');
  const type = value.type as ReportType;
  const modules = [...new Set(Array.isArray(value.modules) ? value.modules.filter((m): m is ReportModule => REPORT_MODULES.includes(m as ReportModule)) : [])];
  if (!modules.length) throw new Error('Select at least one report section.');
  if (value.detail && !['quarterly', 'half_yearly'].includes(type)) throw new Error('A second page is available for quarterly and half-yearly reports only.');
  return { type, anchor: value.anchor, modules, title: typeof value.title === 'string' && value.title.trim() ? value.title.trim().slice(0, 120) : REPORT_TITLES[type], detail: value.detail === true };
}
export type RainRow = { date: string; estate: string; rainfall_mm: number | string | null };
export type FleetRow = { date: string; vehicle_id: string; km_run: number | string | null; fuel_filled_l: number | string | null; fuel_cost: number | string | null };
export type HoRow = { date: string; transaction_type: string; fuel_type: string; qty_l: number | string | null; amount: number | string | null };
function sum<T>(rows: T[], get: (row: T) => unknown) {
  if (!rows.length) return null;
  const values = rows.map(get).filter(v => v !== null && v !== undefined && v !== '' && Number.isFinite(Number(v)));
  return values.length ? Math.round(values.reduce<number>((total, value) => total + Number(value), 0) * 100) / 100 : null;
}
const latest = (rows: { date: string }[]) => rows.map(r => r.date).sort().at(-1) || null;
export function summarizeReport(rain: RainRow[], fleet: FleetRow[], ho: HoRow[]) {
  const issued = ho.filter(r => r.transaction_type === 'ISSUE'), purchased = ho.filter(r => r.transaction_type === 'PURCHASE');
  const estates = [...new Set(rain.map(r => r.estate))].sort().map(estate => {
    const rows = rain.filter(r => r.estate === estate);
    return { estate, mm: sum(rows, r => r.rainfall_mm), days: new Set(rows.map(r => r.date)).size };
  });
  return {
    rainfall: { entries: rain.length, latest: latest(rain), estates },
    fleet: { entries: fleet.length, latest: latest(fleet), vehicles: new Set(fleet.map(r => r.vehicle_id)).size, km: sum(fleet, r => r.km_run), litres: sum(fleet, r => r.fuel_filled_l), spend: sum(fleet, r => r.fuel_cost) },
    ho: { entries: ho.length, latest: latest(ho), issued: sum(issued, r => r.qty_l), purchased: sum(purchased, r => r.qty_l), spend: sum(purchased, r => r.amount) },
  };
}
export type ReportSummary = ReturnType<typeof summarizeReport>;
export type ReportSnapshot = {
  version: 1; reference: string; generatedAt: string; config: ReportConfig; period: ReportPeriod;
  comparisonPeriod: ReportPeriod; current: ReportSummary; previous: ReportSummary;
  months: { month: string; summary: ReportSummary }[]; warnings: string[];
};
export const reportNumber = (value: number | null, unit = '') => value === null ? 'No entries' : `${value.toLocaleString('en-IN', { maximumFractionDigits: 2 })}${unit ? ` ${unit}` : ''}`;
export const reportMoney = (value: number | null) => value === null ? 'No entries' : `Rs ${value.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
