import 'server-only';
import { createHash } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { requireApiUser, UUID_RE } from '@/lib/auth/api';
import { cleanReportConfig, indiaToday, previousPeriod, reportPeriod, summarizeReport, type ReportSnapshot, type RainRow, type FleetRow, type HoRow } from './reports';

export const REPORT_BUCKET = 'report-archive';
export async function reportsAuth(request: Request, write = false) {
  const auth = await requireApiUser(request, ['admin','ceo']);
  if ('error' in auth) return auth;
  if (write && request.headers.get('origin') && request.headers.get('origin') !== new URL(request.url).origin) return { error: NextResponse.json({ error: 'Invalid request origin.' }, { status: 403 }) };
  if (auth.user.role === 'admin') return { ...auth, canCreate: true };
  const role = await auth.supabase.from('role_permissions').select('access').eq('role', auth.user.role).eq('page_href', '/reports').maybeSingle();
  if (role.error) return { error: NextResponse.json({ error: 'Unable to verify report permissions.' }, { status: 503 }) };
  let access = role.data?.access || 'read';
  if (UUID_RE.test(auth.user.id)) {
    const user = await auth.supabase.from('user_permissions').select('access').eq('user_id', auth.user.id).eq('page_href', '/reports').maybeSingle();
    if (user.error) return { error: NextResponse.json({ error: 'Unable to verify report permissions.' }, { status: 503 }) };
    access = user.data?.access || access;
  }
  if (access === 'none' || (write && access !== 'write')) return { error: NextResponse.json({ error: 'Access denied.' }, { status: 403 }) };
  return { ...auth, canCreate: access === 'write' };
}
async function sourceRows(supabase: SupabaseClient, table: string, columns: string, start: string, end: string) {
  const rows: Record<string, unknown>[] = [];
  for (let offset = 0; ; offset += 1000) {
    const result = await supabase.from(table).select(columns).gte('date', start).lte('date', end).order('date').order('id').range(offset, offset + 999);
    if (result.error) throw new Error(`Unable to load ${table} report entries.`);
    rows.push(...((result.data || []) as unknown as Record<string, unknown>[]));
    if ((result.data?.length || 0) < 1000) break;
  }
  return rows;
}
export async function buildReportSnapshot(supabase: SupabaseClient, input: unknown): Promise<ReportSnapshot> {
  const config = cleanReportConfig(input), period = reportPeriod(config.type, config.anchor), comparisonPeriod = previousPeriod(config.type, period);
  const today = indiaToday();
  if (period.start > today) throw new Error('Choose a reporting period that has started.');
  const queryEnd = period.end > today ? today : period.end;
  const [rain, fleet, ho] = await Promise.all([
    config.modules.includes('rainfall') ? sourceRows(supabase, 'rainfall', 'date,estate,rainfall_mm', comparisonPeriod.start, queryEnd) : [],
    config.modules.some(m => m === 'fleet_fuel' || m === 'distance') ? sourceRows(supabase, 'fleet_daily', 'date,vehicle_id,km_run,fuel_filled_l,fuel_cost', comparisonPeriod.start, queryEnd) : [],
    config.modules.includes('ho_fuel') ? sourceRows(supabase, 'ho_fuel_log', 'date,transaction_type,fuel_type,qty_l,amount', comparisonPeriod.start, queryEnd) : [],
  ]) as unknown as [RainRow[], FleetRow[], HoRow[]];
  const inPeriod = <T extends { date: string }>(rows: T[], start: string, end: string) => rows.filter(r => r.date >= start && r.date <= end);
  const currentRain = inPeriod(rain, period.start, period.end), currentFleet = inPeriod(fleet, period.start, period.end), currentHo = inPeriod(ho, period.start, period.end);
  const warnings: string[] = ['Only recorded entries are included. Missing entries are not confirmed zeroes.'];
  if (period.end >= indiaToday()) warnings.push('This period is still open. Review late entries before archiving a final report.');
  if (config.modules.includes('rainfall') && !currentRain.length) warnings.push('No rainfall entries recorded for this period.');
  if (config.modules.some(m => m === 'fleet_fuel' || m === 'distance') && !currentFleet.length) warnings.push('No Fleet Fuel entries recorded for this period.');
  if (config.modules.includes('ho_fuel') && !currentHo.length) warnings.push('No HO Fuel entries recorded for this period.');
  if (currentRain.some(r => r.rainfall_mm === null) || currentFleet.some(r => r.km_run === null || r.fuel_cost === null || r.fuel_filled_l === null) || currentHo.some(r => r.qty_l === null)) warnings.push('Some entries have missing values; recorded totals may be incomplete.');
  const monthKeys: string[] = [];
  const month = new Date(`${period.start.slice(0, 7)}-01T00:00:00Z`);
  while (month.toISOString().slice(0, 10) <= period.end) { monthKeys.push(month.toISOString().slice(0,7)); month.setUTCMonth(month.getUTCMonth() + 1); }
  return {
    version: 1, reference: `MSP-RPT-${period.end.replaceAll('-', '')}-${crypto.randomUUID().slice(0,8).toUpperCase()}`,
    generatedAt: new Date().toISOString(), config, period, comparisonPeriod,
    current: summarizeReport(currentRain, currentFleet, currentHo),
    previous: summarizeReport(inPeriod(rain, comparisonPeriod.start, comparisonPeriod.end), inPeriod(fleet, comparisonPeriod.start, comparisonPeriod.end), inPeriod(ho, comparisonPeriod.start, comparisonPeriod.end)),
    months: monthKeys.map(month => ({ month, summary: summarizeReport(currentRain.filter(r => r.date.startsWith(month)), currentFleet.filter(r => r.date.startsWith(month)), currentHo.filter(r => r.date.startsWith(month))) })), warnings,
  };
}
export const pdfHash = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
