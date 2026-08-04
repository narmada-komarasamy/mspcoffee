import type { SupabaseClient } from '@supabase/supabase-js';
import type { EmailMetric, EmailPayload, EmailSection } from './payload';

export type DigestBlock = 'rainfall' | 'labour_attendance' | 'fleet_fuel' | 'ho_fuel' | 'current_page';

type DailyOperationsOptions = {
  supabase: SupabaseClient;
  date: string;
  blocks: DigestBlock[];
  currentPage?: string;
  note?: string;
};

const BLOCK_LABELS: Record<DigestBlock, string> = {
  rainfall: 'Rainfall',
  labour_attendance: 'Labour Attendance',
  fleet_fuel: 'Fleet Fuel',
  ho_fuel: 'HO Fuel',
  current_page: 'Current Page',
};

function n(value: unknown) {
  return Number(value) || 0;
}

function fmt(value: number, digits = 0) {
  return value.toLocaleString('en-IN', {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  });
}

function rupee(value: number) {
  return `Rs ${fmt(value)}`;
}

function uniqueBlocks(blocks: DigestBlock[]) {
  return Array.from(new Set(blocks.filter((block) => block in BLOCK_LABELS)));
}

async function rainfallSection(supabase: SupabaseClient, date: string): Promise<{ summary: EmailMetric[]; section: EmailSection }> {
  const { data, error } = await supabase
    .from('rainfall')
    .select('estate, rainfall_mm, inches')
    .eq('date', date)
    .order('estate', { ascending: true });

  if (error) throw new Error(`Rainfall report failed: ${error.message}`);

  const rows = data ?? [];
  const totalMm = rows.reduce((sum, row) => sum + n(row.rainfall_mm), 0);
  const rainyRows = rows.filter((row) => n(row.rainfall_mm) > 0);
  const max = rainyRows.reduce<typeof rows[number] | null>(
    (best, row) => !best || n(row.rainfall_mm) > n(best.rainfall_mm) ? row : best,
    null
  );

  return {
    summary: [
      { label: 'Rainfall Total', value: `${fmt(totalMm, 1)} mm`, detail: `${rainyRows.length} estates reported rain` },
    ],
    section: {
      title: 'Rainfall',
      rows: rows.length
        ? [
            { label: 'Records', value: String(rows.length), detail: `For ${date}` },
            { label: 'Wettest Estate', value: max?.estate ?? 'No rainfall', detail: max ? `${fmt(n(max.rainfall_mm), 1)} mm` : 'All recorded values were zero' },
            ...rows.map((row) => ({
              label: String(row.estate),
              value: `${fmt(n(row.rainfall_mm), 1)} mm`,
              detail: `${fmt(n(row.inches), 3)} inches`,
            })),
          ]
        : [{ label: 'Status', value: 'No rainfall records', detail: `No entries found for ${date}` }],
    },
  };
}

async function fleetFuelSection(supabase: SupabaseClient, date: string): Promise<{ summary: EmailMetric[]; section: EmailSection }> {
  const { data, error } = await supabase
    .from('fleet_daily')
    .select('vehicle_id, account, km_run, fuel_filled_l, fuel_cost, maint_cost, total_cost')
    .eq('date', date)
    .order('vehicle_id', { ascending: true });

  if (error) throw new Error(`Fleet fuel report failed: ${error.message}`);

  const rows = data ?? [];
  const totalKm = rows.reduce((sum, row) => sum + n(row.km_run), 0);
  const totalLitres = rows.reduce((sum, row) => sum + n(row.fuel_filled_l), 0);
  const fuelCost = rows.reduce((sum, row) => sum + n(row.fuel_cost), 0);
  const maintCost = rows.reduce((sum, row) => sum + n(row.maint_cost), 0);
  const totalCost = rows.reduce((sum, row) => sum + n(row.total_cost), 0) || fuelCost + maintCost;

  return {
    summary: [
      { label: 'Fleet Fuel', value: `${fmt(totalLitres, 1)} L`, detail: `${rows.length} vehicles, ${rupee(fuelCost)} fuel cost` },
    ],
    section: {
      title: 'Fleet Fuel',
      rows: rows.length
        ? [
            { label: 'Vehicles Logged', value: String(rows.length), detail: `${fmt(totalKm, 1)} km run` },
            { label: 'Fuel Filled', value: `${fmt(totalLitres, 1)} L`, detail: rupee(fuelCost) },
            { label: 'Maintenance', value: rupee(maintCost), detail: `Total cost ${rupee(totalCost)}` },
            ...rows.slice(0, 12).map((row) => ({
              label: String(row.vehicle_id),
              value: `${fmt(n(row.fuel_filled_l), 1)} L`,
              detail: `${String(row.account)} - ${fmt(n(row.km_run), 1)} km - ${rupee(n(row.fuel_cost))}`,
            })),
          ]
        : [{ label: 'Status', value: 'No fleet fuel records', detail: `No entries found for ${date}` }],
    },
  };
}

async function hoFuelSection(supabase: SupabaseClient, date: string): Promise<{ summary: EmailMetric[]; section: EmailSection }> {
  const { data, error } = await supabase
    .from('ho_fuel_log')
    .select('transaction_type, fuel_type, source, vehicle_number, estate, qty_l, amount, receiver_name')
    .eq('date', date)
    .order('fuel_type', { ascending: true });

  if (error) throw new Error(`HO fuel report failed: ${error.message}`);

  const rows = data ?? [];
  const purchased = rows.filter((row) => row.transaction_type === 'PURCHASE');
  const issued = rows.filter((row) => row.transaction_type === 'ISSUE');
  const purchasedLitres = purchased.reduce((sum, row) => sum + n(row.qty_l), 0);
  const issuedLitres = issued.reduce((sum, row) => sum + n(row.qty_l), 0);
  const amount = purchased.reduce((sum, row) => sum + n(row.amount), 0);

  return {
    summary: [
      { label: 'HO Fuel', value: `${fmt(issuedLitres, 1)} L issued`, detail: `${fmt(purchasedLitres, 1)} L purchased, ${rupee(amount)}` },
    ],
    section: {
      title: 'HO Fuel',
      rows: rows.length
        ? [
            { label: 'Purchases', value: `${fmt(purchasedLitres, 1)} L`, detail: rupee(amount) },
            { label: 'Issues', value: `${fmt(issuedLitres, 1)} L`, detail: `${issued.length} issue entries` },
            ...rows.slice(0, 12).map((row) => ({
              label: `${String(row.fuel_type)} ${String(row.transaction_type).toLowerCase()}`,
              value: `${fmt(n(row.qty_l), 1)} L`,
              detail: row.transaction_type === 'PURCHASE'
                ? `${String(row.source || 'Source not set')} - ${rupee(n(row.amount))}`
                : `${String(row.vehicle_number || row.estate || 'Receiver not set')} - ${String(row.receiver_name || 'Receiver not set')}`,
            })),
          ]
        : [{ label: 'Status', value: 'No HO fuel records', detail: `No entries found for ${date}` }],
    },
  };
}

function labourAttendanceSection(date: string): { summary: EmailMetric[]; section: EmailSection } {
  return {
    summary: [
      { label: 'Labour Attendance', value: 'Not connected', detail: 'Daily attendance is not stored in Supabase yet' },
    ],
    section: {
      title: 'Labour Attendance',
      rows: [
        { label: 'Status', value: 'Needs data connection', detail: `The Stanmore daily report for ${date} currently lives in browser state only` },
        { label: 'Phase 2 Prep', value: 'Add attendance table', detail: 'Once attendance is saved, this block can report present, half-day, absent, and work allocation totals' },
      ],
    },
  };
}

function currentPageSection(currentPage?: string): { summary: EmailMetric[]; section: EmailSection } {
  const page = currentPage || '/';
  return {
    summary: [
      { label: 'Linked Page', value: page, detail: 'Included from the global email button' },
    ],
    section: {
      title: 'Current Page',
      rows: [
        { label: 'Page', value: page, detail: 'Use this as context for the recipients' },
      ],
    },
  };
}

export async function buildDailyOperationsDigest({
  supabase,
  date,
  blocks,
  currentPage,
  note,
}: DailyOperationsOptions): Promise<EmailPayload> {
  const selected = uniqueBlocks(blocks);
  const summary: EmailMetric[] = [];
  const sections: EmailSection[] = [];

  for (const block of selected) {
    const part =
      block === 'rainfall' ? await rainfallSection(supabase, date)
      : block === 'fleet_fuel' ? await fleetFuelSection(supabase, date)
      : block === 'ho_fuel' ? await hoFuelSection(supabase, date)
      : block === 'labour_attendance' ? labourAttendanceSection(date)
      : currentPageSection(currentPage);

    summary.push(...part.summary);
    sections.push(part.section);
  }

  return {
    type: 'daily_operations_digest',
    recipients: [],
    cc: [],
    reportTitle: `Daily Operations Digest - ${date}`,
    sourcePath: currentPage || '/email-composer',
    subject: `MSP Coffee Daily Operations Digest - ${date}`,
    note,
    attachmentName: `daily-operations-digest-${date}.html`,
    data: {
      summary: summary.length ? summary : [{ label: 'Digest', value: 'No sections selected' }],
      sections,
    },
  };
}

export function normalizeDigestBlocks(value: unknown): DigestBlock[] {
  if (!Array.isArray(value)) return ['rainfall', 'labour_attendance', 'fleet_fuel', 'ho_fuel'];
  const blocks = uniqueBlocks(value.filter((item): item is DigestBlock => typeof item === 'string' && item in BLOCK_LABELS));
  return blocks.length ? blocks : ['rainfall', 'labour_attendance', 'fleet_fuel', 'ho_fuel'];
}
