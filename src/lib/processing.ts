export const PROCESSING_SEASON = '2026-2027';
export const PROCESSING_ESTATES = [
  { slug: 'stanmore-estate', name: 'Stanmore Estate' },
  { slug: 'bve', name: 'Bison Valley Estate' },
  { slug: 'moganad-estate', name: 'Moganad Estate' },
  { slug: 'orchardale-estate', name: 'Orchardale Estate' },
  { slug: 'hidden-falls-estate', name: 'Hidden Falls Estate' },
] as const;
export const PROCESSING_METHODS = ['Washed', 'Natural', 'Honey', 'Anaerobic'];
export const PROCESSING_STAGES = ['Received', 'Fermenting', 'Drying', 'Dried'] as const;
export const PROCESSING_NUMBERS = ['picking_round', 'gross_kg', 'tare_kg', 'actual_dry_kg', 'brix', 'ph', 'moisture', 'fermentation_hours'] as const;
export const PROCESSING_TEXT = ['field_name', 'variety', 'recipe_notes', 'remarks'] as const;

export type ProcessingBatch = {
  id: string; season_id: string; estate: string; lot_number: string; split_reference: string;
  processing_date: string; product_type: 'Dry cherry' | 'Parchment'; method: string;
  stage: typeof PROCESSING_STAGES[number]; status: 'In progress' | 'Complete';
  field_name: string; variety: string; recipe_notes: string; remarks: string;
  picking_round: number | null; gross_kg: number | null; tare_kg: number | null;
  actual_dry_kg: number | null; brix: number | null; ph: number | null; moisture: number | null;
  fermentation_hours: number | null; dried_on: string | null;
  net_kg?: number | null; revision: number; updated_at?: string; updated_by?: string;
};
export type ProcessingSeason = { id: string; start_date: string | null; revision: number };
export type ProcessingHistory = { id: number; batch_id: string | null; actor_name: string; changed_at: string; before_data: Record<string, unknown> | null; after_data: Record<string, unknown> };

export function indiaToday() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}
export function validProcessingDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}
function text(value: unknown, label: string, max = 2000, required = false) {
  if (value == null && !required) return '';
  if (typeof value !== 'string' || value.length > max || (required && !value.trim())) throw new Error(`Enter a valid ${label}.`);
  return value.trim();
}
function number(value: unknown, label: string, max: number, integer = false) {
  if (value == null || (typeof value === 'string' && !value.trim())) return null;
  if ((typeof value !== 'number' && typeof value !== 'string') || (typeof value === 'string' && !/^\d+(\.\d+)?$/.test(value.trim()))) throw new Error(`Enter a valid ${label}.`);
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0 || n > max || (integer && (!Number.isInteger(n) || n < 1))) throw new Error(`Enter a valid ${label}.`);
  return Math.round(n * 1000) / 1000;
}
export function cleanProcessingBatch(input: unknown, season: ProcessingSeason, today = indiaToday()): Omit<ProcessingBatch, 'revision'> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Enter batch details.');
  const b = input as Record<string, unknown>;
  if (!season.start_date) throw new Error('Choose and save the season start date before entering a batch.');
  if (!validProcessingDate(b.processing_date) || b.processing_date < season.start_date || b.processing_date > today) throw new Error('Processing date must be between the season start and today.');
  if (!PROCESSING_ESTATES.some(e => e.slug === b.estate)) throw new Error('Choose an estate.');
  if (b.product_type !== 'Dry cherry' && b.product_type !== 'Parchment') throw new Error('Choose dry cherry or parchment.');
  if (!PROCESSING_STAGES.includes(b.stage as ProcessingBatch['stage'])) throw new Error('Choose a batch stage.');
  if (b.status !== 'In progress' && b.status !== 'Complete') throw new Error('Choose a batch status.');
  const row = {
    id: text(b.id, 'batch identifier', 36, true), season_id: PROCESSING_SEASON,
    estate: b.estate as string, lot_number: text(b.lot_number, 'register lot number', 100, true),
    split_reference: text(b.split_reference, 'split reference', 100), processing_date: b.processing_date,
    product_type: b.product_type, method: text(b.method, 'processing method', 100, true),
    stage: b.stage as ProcessingBatch['stage'], status: b.status,
    field_name: text(b.field_name, 'field', 100), variety: text(b.variety, 'variety', 100),
    recipe_notes: text(b.recipe_notes, 'recipe notes'), remarks: text(b.remarks, 'remarks'),
    picking_round: number(b.picking_round, 'picking round', 1000, true),
    gross_kg: number(b.gross_kg, 'gross weight', 10000000), tare_kg: number(b.tare_kg, 'tare weight', 10000000),
    actual_dry_kg: number(b.actual_dry_kg, 'actual dry weight', 10000000),
    brix: number(b.brix, 'BRIX', 100), ph: number(b.ph, 'pH', 14), moisture: number(b.moisture, 'moisture', 100),
    fermentation_hours: number(b.fermentation_hours, 'fermentation hours', 10000),
    dried_on: b.dried_on === '' || b.dried_on == null ? null : b.dried_on,
  };
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(row.id)) throw new Error('Invalid batch identifier.');
  if (row.tare_kg !== null && row.gross_kg === null) throw new Error('Enter gross weight when entering tare weight.');
  if (row.tare_kg !== null && row.gross_kg !== null && row.tare_kg > row.gross_kg) throw new Error('Tare weight cannot exceed gross weight.');
  if (row.dried_on !== null && (!validProcessingDate(row.dried_on) || row.dried_on < row.processing_date || row.dried_on > today)) throw new Error('Drying completion date must be between processing date and today.');
  const net = processingNet(row);
  if (row.actual_dry_kg !== null && net !== null && row.actual_dry_kg > net) throw new Error('Actual dry weight cannot exceed net cherry weight.');
  if (row.status === 'Complete' && (row.stage !== 'Dried' || row.actual_dry_kg === null || !row.dried_on || row.moisture === null || net === null || net <= 0)) throw new Error('To complete a batch, enter gross and tare weights, actual dry weight, moisture and drying date, and choose Dried.');
  return row as Omit<ProcessingBatch, 'revision'>;
}
export function processingNet(row: { gross_kg: number | null; tare_kg: number | null }) {
  return row.gross_kg === null || row.tare_kg === null ? null : Math.round((row.gross_kg - row.tare_kg) * 1000) / 1000;
}
export function processingOutturn(row: { gross_kg: number | null; tare_kg: number | null; actual_dry_kg: number | null }) {
  const net = processingNet(row);
  return net !== null && net > 0 && row.actual_dry_kg !== null ? row.actual_dry_kg / net * 100 : null;
}
export function processingLotKey(row: Pick<ProcessingBatch, 'estate' | 'lot_number' | 'split_reference'>) {
  return [row.estate, row.lot_number.trim().toLowerCase(), row.split_reference.trim().toLowerCase()].join('|');
}
export function emptyProcessingBatch(estate = PROCESSING_ESTATES[0].slug as string): ProcessingBatch {
  return { id: crypto.randomUUID(), season_id: PROCESSING_SEASON, estate, lot_number: '', split_reference: '', processing_date: indiaToday(), product_type: 'Parchment', method: 'Washed', stage: 'Received', status: 'In progress', field_name: '', variety: '', recipe_notes: '', remarks: '', picking_round: null, gross_kg: null, tare_kg: null, actual_dry_kg: null, brix: null, ph: null, moisture: null, fermentation_hours: null, dried_on: null, revision: 0 };
}
