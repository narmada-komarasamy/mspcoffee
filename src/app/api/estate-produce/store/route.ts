import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { signedStorageUrl } from '@/lib/storage/urls';
import {
  BUCKET,
  DATE_RE,
  ESTATES,
  STORE_STATUSES,
  badRequest,
  estateProduceSetupError,
  numberValue,
  requireEstateProduceUser,
  text,
} from '../_helpers';

type StoreItemRow = Record<string, unknown>;
type ProduceRecordRow = {
  id: string;
  record_date: string;
  estate: string;
  product: string;
  unit: string;
  qty: number;
  weight_kg: number;
  damage_qty: number;
  damage_weight_kg: number;
  photo_path: string | null;
  photo_file_name: string | null;
  photo_content_type: string | null;
  disposition: string | null;
};

function itemSelect() {
  return [
    'id',
    'source_record_id',
    'item_code',
    'received_date',
    'estate',
    'product',
    'unit',
    'quantity',
    'weight_kg',
    'condition_grade',
    'storage_location',
    'photo_path',
    'photo_file_name',
    'photo_content_type',
    'status',
    'notes',
    'created_by_name',
    'created_at',
    'updated_at',
  ].join(', ');
}

function mapItem(row: StoreItemRow) {
  const photoPath = text(row.photo_path);
  return {
    id: text(row.id),
    sourceRecordId: text(row.source_record_id) || undefined,
    itemCode: text(row.item_code),
    receivedDate: text(row.received_date),
    estate: text(row.estate),
    product: text(row.product),
    unit: text(row.unit),
    quantity: numberValue(row.quantity),
    weightKg: numberValue(row.weight_kg),
    conditionGrade: text(row.condition_grade),
    storageLocation: text(row.storage_location),
    photoPath: photoPath || undefined,
    photoUrl: photoPath ? signedStorageUrl(BUCKET, photoPath) : undefined,
    photoFileName: text(row.photo_file_name) || undefined,
    photoContentType: text(row.photo_content_type) || undefined,
    status: text(row.status) || 'In Store',
    notes: text(row.notes),
    createdBy: text(row.created_by_name) || 'MSP User',
    createdAt: text(row.created_at),
    updatedAt: text(row.updated_at),
  };
}

function productPrefix(product: string) {
  const clean = product.toUpperCase().replace(/[^A-Z0-9]/g, '');
  return (clean || 'PRO').slice(0, 3).padEnd(3, 'X');
}

async function nextItemCodes(
  supabase: SupabaseClient,
  product: string,
  estate: string,
  receivedDate: string,
  count: number,
) {
  const prefix = `${productPrefix(product)}-${estate}-${receivedDate.replaceAll('-', '')}`;
  const { data } = await supabase
    .from('produce_store_items')
    .select('item_code')
    .ilike('item_code', `${prefix}-%`);

  const maxExisting = (data ?? []).reduce((max: number, row: { item_code?: string | null }) => {
    const suffix = String(row.item_code ?? '').split('-').at(-1);
    const parsed = Number(suffix);
    return Number.isFinite(parsed) ? Math.max(max, parsed) : max;
  }, 0);

  return Array.from({ length: count }, (_, index) => `${prefix}-${String(maxExisting + index + 1).padStart(3, '0')}`);
}

export async function GET(request: Request) {
  const auth = await requireEstateProduceUser(request);
  if ('error' in auth) return auth.error;

  const { searchParams } = new URL(request.url);
  const estate = searchParams.get('estate')?.trim();
  const product = searchParams.get('product')?.trim();
  const status = searchParams.get('status')?.trim();
  const search = searchParams.get('search')?.trim();

  let query = auth.supabase
    .from('produce_store_items')
    .select(itemSelect())
    .order('received_date', { ascending: false })
    .order('item_code', { ascending: true })
    .limit(800);

  if (estate && estate !== 'All') query = query.eq('estate', estate);
  if (product && product !== 'All') query = query.eq('product', product);
  if (status && status !== 'All') query = query.eq('status', status);
  if (search) {
    const term = search.replace(/[%_]/g, '\\$&');
    query = query.or(`item_code.ilike.%${term}%,product.ilike.%${term}%,estate.ilike.%${term}%,condition_grade.ilike.%${term}%,storage_location.ilike.%${term}%,notes.ilike.%${term}%`);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: estateProduceSetupError(error.message) }, { status: 500 });

  return NextResponse.json({ items: ((data ?? []) as unknown as StoreItemRow[]).map(mapItem) });
}

export async function POST(request: Request) {
  const auth = await requireEstateProduceUser(request);
  if ('error' in auth) return auth.error;

  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body) return badRequest('Store item details are required');

  const sourceRecordId = text(body.sourceRecordId);
  const estate = text(body.estate);
  const product = text(body.product);
  const receivedDate = text(body.receivedDate);
  const status = text(body.status) || 'In Store';
  const storageLocation = text(body.storageLocation);
  const conditionGrade = text(body.conditionGrade);
  const notes = text(body.notes);
  const requestedQuantity = numberValue(body.quantity);
  const requestedWeight = numberValue(body.weightKg);

  if (!STORE_STATUSES.includes(status)) return badRequest('Choose a valid store status');
  if (estate && !ESTATES.includes(estate)) return badRequest('Choose a valid estate');
  if (receivedDate && !DATE_RE.test(receivedDate)) return badRequest('Enter a valid received date');

  let sourceRecord: ProduceRecordRow | null = null;
  if (sourceRecordId) {
    const { data, error } = await auth.supabase
      .from('estate_produce_records')
      .select('id, record_date, estate, product, unit, qty, weight_kg, damage_qty, damage_weight_kg, photo_path, photo_file_name, photo_content_type, disposition')
      .eq('id', sourceRecordId)
      .single<ProduceRecordRow>();

    if (error) return NextResponse.json({ error: estateProduceSetupError(error.message) }, { status: 500 });
    if (!data) return NextResponse.json({ error: 'Source produce record was not found' }, { status: 404 });
    sourceRecord = data;
  }

  const finalEstate = estate || sourceRecord?.estate || '';
  const finalProduct = product || sourceRecord?.product || '';
  const finalDate = receivedDate || sourceRecord?.record_date || '';
  const finalUnit = sourceRecord?.unit || text(body.unit) || 'Pieces';

  if (!finalEstate || !ESTATES.includes(finalEstate)) return badRequest('Choose a valid estate');
  if (!finalProduct) return badRequest('Product is required');
  if (!DATE_RE.test(finalDate)) return badRequest('Enter a valid received date');

  const sourceQty = Math.max(0, numberValue(sourceRecord?.qty) - numberValue(sourceRecord?.damage_qty));
  const sourceWeight = Math.max(0, numberValue(sourceRecord?.weight_kg) - numberValue(sourceRecord?.damage_weight_kg));
  const quantity = requestedQuantity || sourceQty || 1;
  const totalWeight = requestedWeight || sourceWeight;
  const isFruitLevel = finalUnit === 'Pieces' && finalProduct.toLowerCase().includes('durian');
  const itemCount = isFruitLevel ? Math.max(1, Math.floor(quantity)) : 1;
  const codes = await nextItemCodes(auth.supabase, finalProduct, finalEstate, finalDate, itemCount);
  const perItemWeight = itemCount > 1 ? totalWeight / itemCount : totalWeight;

  const rows = codes.map((code) => ({
    source_record_id: sourceRecord?.id ?? null,
    item_code: code,
    received_date: finalDate,
    estate: finalEstate,
    product: finalProduct,
    unit: finalUnit,
    quantity: isFruitLevel ? 1 : quantity,
    weight_kg: Number(perItemWeight.toFixed(3)),
    condition_grade: conditionGrade || null,
    storage_location: storageLocation || null,
    photo_path: sourceRecord?.photo_path ?? null,
    photo_file_name: sourceRecord?.photo_file_name ?? null,
    photo_content_type: sourceRecord?.photo_content_type ?? null,
    status,
    notes: notes || null,
    created_by: auth.user.id,
    created_by_name: auth.user.name,
    updated_by: auth.user.id,
  }));

  const { data: inserted, error } = await auth.supabase
    .from('produce_store_items')
    .insert(rows)
    .select(itemSelect());

  if (error) return NextResponse.json({ error: estateProduceSetupError(error.message) }, { status: 500 });

  const movementRows = ((inserted ?? []) as unknown as StoreItemRow[]).map((item) => ({
    store_item_id: text(item.id),
    movement_type: 'Created',
    to_status: status,
    to_location: storageLocation || null,
    notes: sourceRecord ? `Created from estate produce record ${sourceRecord.id}` : 'Created manually',
    actor_id: auth.user.id,
    actor_name: auth.user.name,
  }));

  if (movementRows.length) {
    await auth.supabase.from('produce_store_movements').insert(movementRows);
  }

  return NextResponse.json({ items: ((inserted ?? []) as unknown as StoreItemRow[]).map(mapItem) }, { status: 201 });
}
