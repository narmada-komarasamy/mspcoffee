import processingOptions from './processing-options.json';

export const PROCESSING_SEASON = '2026-2027';
export const PROCESSING_ESTATES = [
  { slug: 'stanmore-estate', name: 'Stanmore Estate' },
  { slug: 'bve', name: 'Bison Valley Estate' },
  { slug: 'moganad-estate', name: 'Moganad Estate' },
  { slug: 'orchardale-estate', name: 'Orchardale Estate' },
  { slug: 'hidden-falls-estate', name: 'Hidden Falls Estate' },
] as const;
export const PROCESSING_OPTIONS = processingOptions;
export const PROCESSING_METHODS = processingOptions.methods;
export const PROCESSING_STAGES = ['Received', 'Fermenting', 'Drying', 'Dried'] as const;
export const PROCESSING_NUMBERS = ['gross_kg', 'floats_kg', 'wet_kg', 'actual_dry_kg', 'brix', 'ph', 'moisture', 'fermentation_hours'] as const;
export const PROCESSING_TEXT = ['field_name', 'variety', 'recipe_notes', 'remarks'] as const;

export type ProcessingBatch = {
  id: string; season_id: string; estate: string; lot_number: string; split_reference: string;
  harvest_date: string; processing_date: string; lot_type: string; quality_code: string; entry_version: number;
  drying_surface: string; storage_location: string; godown_date: string | null;
  product_type: 'Dry cherry' | 'Parchment'; method: string;
  stage: typeof PROCESSING_STAGES[number]; status: 'In progress' | 'Complete';
  field_name: string; variety: string; recipe_notes: string; remarks: string;
  picking_round: string; gross_kg: number | null; floats_kg: number | null; wet_kg: number | null;
  tare_kg?: number | null;
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
  if (!validProcessingDate(b.harvest_date) || b.harvest_date < season.start_date || b.harvest_date > b.processing_date) throw new Error('Harvest date must be between the season start and processing date.');
  if (!PROCESSING_ESTATES.some(e => e.slug === b.estate)) throw new Error('Choose an estate.');
  if (b.product_type !== 'Dry cherry' && b.product_type !== 'Parchment') throw new Error('Choose dry cherry or parchment.');
  if (!PROCESSING_STAGES.includes(b.stage as ProcessingBatch['stage'])) throw new Error('Choose a batch stage.');
  if (b.status !== 'In progress' && b.status !== 'Complete') throw new Error('Choose a batch status.');
  if (!processingOptions.rounds.includes(String(b.picking_round))) throw new Error('Choose a picking round from the register list.');
  if (!processingOptions.lotTypes.includes(String(b.lot_type))) throw new Error('Choose a lot type.');
  if (!processingQualities(String(b.lot_type)).includes(String(b.quality_code))) throw new Error('Choose a valid quality for this lot type. Gleanings must be Regular; cupping allows Special or Regular.');
  for (const key of ['drying_surface', 'storage_location']) {
    if (isGowriOption(String(b[key] ?? ''))) throw new Error('Gowri facilities are excluded from this register.');
  }
  const row = {
    id: text(b.id, 'batch identifier', 36, true), season_id: PROCESSING_SEASON,
    estate: b.estate as string, lot_number: '',
    split_reference: '', processing_date: b.processing_date, harvest_date: b.harvest_date,
    entry_version: 2, lot_type: String(b.lot_type), quality_code: String(b.quality_code),
    drying_surface: text(b.drying_surface, 'drying surface', 100), storage_location: text(b.storage_location, 'storage location', 100),
    godown_date: b.godown_date === '' || b.godown_date == null ? null : b.godown_date,
    product_type: b.product_type, method: text(b.method, 'processing method', 100, true),
    stage: b.stage as ProcessingBatch['stage'], status: b.status,
    field_name: text(b.field_name, 'field', 100, true), variety: text(b.variety, 'variety', 40, true),
    recipe_notes: text(b.recipe_notes, 'recipe notes'), remarks: text(b.remarks, 'remarks'),
    picking_round: String(b.picking_round),
    gross_kg: number(b.gross_kg, 'ripe cherry weight', 10000000), floats_kg: number(b.floats_kg, 'floats weight', 10000000), wet_kg: number(b.wet_kg, 'wet parchment weight', 10000000),
    actual_dry_kg: number(b.actual_dry_kg, 'actual dry weight', 10000000),
    brix: number(b.brix, 'BRIX', 100), ph: number(b.ph, 'pH', 14), moisture: number(b.moisture, 'moisture', 100),
    fermentation_hours: number(b.fermentation_hours, 'fermentation hours', 10000),
    dried_on: b.dried_on === '' || b.dried_on == null ? null : b.dried_on,
  };
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(row.id)) throw new Error('Invalid batch identifier.');
  if (row.floats_kg !== null && row.gross_kg === null) throw new Error('Enter ripe cherry weight when entering floats.');
  if (row.floats_kg !== null && row.gross_kg !== null && row.floats_kg > row.gross_kg) throw new Error('Floats cannot exceed ripe cherry weight.');
  if (!/^[A-Za-z0-9][A-Za-z0-9 ._-]*$/.test(row.variety)) throw new Error('Variety must use letters, numbers, spaces, dots, underscores or hyphens.');
  if (row.godown_date !== null && (!validProcessingDate(row.godown_date) || row.godown_date < (row.dried_on || row.processing_date) || row.godown_date > today)) throw new Error('Godown transfer must be on or after drying (or processing if drying date is pending), and no later than today.');
  if (row.dried_on !== null && (!validProcessingDate(row.dried_on) || row.dried_on < row.processing_date || row.dried_on > today)) throw new Error('Drying completion date must be between processing date and today.');
  const net = processingNet(row);
  if (row.actual_dry_kg !== null && net !== null && row.actual_dry_kg > net) throw new Error('Actual dry weight cannot exceed net cherry weight.');
  if (row.status === 'Complete' && (row.stage !== 'Dried' || row.actual_dry_kg === null || !row.dried_on || row.moisture === null || net === null || net <= 0)) throw new Error('To complete a batch, enter ripe cherry and floats weights, actual dry weight, moisture and drying date, and choose Dried.');
  return row as Omit<ProcessingBatch, 'revision'>;
}
type ProcessingWeights = { gross_kg: number | null; floats_kg?: number | null; tare_kg?: number | null; entry_version?: number };
export function processingNet(row: ProcessingWeights) {
  const deduction = row.entry_version === 1 ? row.tare_kg : row.floats_kg;
  return row.gross_kg == null || deduction == null ? null : Math.round((row.gross_kg - deduction) * 1000) / 1000;
}
export function processingOutturn(row: ProcessingWeights & { actual_dry_kg: number | null }) {
  const net = processingNet(row);
  return net !== null && net > 0 && row.actual_dry_kg !== null ? row.actual_dry_kg / net * 100 : null;
}
export function processingWetOutturn(row: ProcessingWeights & { wet_kg: number | null }) {
  const net = processingNet(row);
  return net !== null && net > 0 && row.wet_kg !== null ? row.wet_kg / net * 100 : null;
}
export function processingDryFromWet(row: { wet_kg: number | null; actual_dry_kg: number | null }) {
  return row.wet_kg !== null && row.wet_kg > 0 && row.actual_dry_kg !== null ? row.actual_dry_kg / row.wet_kg * 100 : null;
}
export function processingYardDays(row: { harvest_date: string; godown_date: string | null }) {
  if (!validProcessingDate(row.harvest_date) || !validProcessingDate(row.godown_date)) return null;
  return Math.round((Date.parse(row.godown_date) - Date.parse(row.harvest_date)) / 86400000);
}
export function isGowriOption(value: string) { return /gowri|^(?:ge|gwe)\b/i.test(value.trim()); }
export function processingQualities(lotType: string): string[] {
  if (lotType === 'Gleanings' || lotType === 'Regular') return ['2'];
  if (lotType === 'For Cupping') return ['1', '2'];
  if (lotType === 'Special' || lotType === '90+ Project') return ['1'];
  if (lotType === 'Stripping') return ['Stripping'];
  return [];
}
export function processingLotBase(row: Pick<ProcessingBatch, 'estate' | 'harvest_date' | 'variety' | 'quality_code'>) {
  const codes: Record<string, string> = { 'stanmore-estate': 'SE', bve: 'BVE', 'moganad-estate': 'ME', 'orchardale-estate': 'OE', 'hidden-falls-estate': 'HFE' };
  if (!codes[row.estate] || !validProcessingDate(row.harvest_date) || !row.variety || !row.quality_code) return '';
  const [year, month, day] = row.harvest_date.split('-');
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${codes[row.estate]}${day}${months[Number(month) - 1]}${year.slice(-2)}${row.variety}${row.quality_code}`;
}
export function processingLotKey(row: Pick<ProcessingBatch, 'estate' | 'lot_number'>) {
  return row.lot_number.trim().toLowerCase();
}
export function emptyProcessingBatch(estate = PROCESSING_ESTATES[0].slug as string): ProcessingBatch {
  return { id: crypto.randomUUID(), season_id: PROCESSING_SEASON, estate, lot_number: '', split_reference: '', processing_date: indiaToday(), harvest_date: indiaToday(), lot_type: 'Regular', quality_code: '2', entry_version: 2, drying_surface: '', storage_location: '', godown_date: null, product_type: 'Dry cherry', method: 'Naturals - No Fermentation', stage: 'Received', status: 'In progress', field_name: '', variety: '', recipe_notes: '', remarks: '', picking_round: '', gross_kg: null, floats_kg: null, wet_kg: null, actual_dry_kg: null, brix: null, ph: null, moisture: null, fermentation_hours: null, dried_on: null, revision: 0 };
}
