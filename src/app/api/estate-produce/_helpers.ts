import { NextResponse } from 'next/server';
import { requireApiUser, UUID_RE } from '@/lib/auth/api';
import { signedStorageUrl } from '@/lib/storage/urls';

export { UUID_RE };

export const ESTATES = ['ME', 'SE', 'HFE', 'ORD', 'BVE'];
export const UNITS = ['Pieces', 'Kg', 'Boxes', 'Bunches', 'Bags', 'Other'];
export const SOURCES = ['Manual', 'WhatsApp Paste'];
export const ESTATE_PRODUCE_ROLES = ['admin', 'supervisor', 'worker', 'ceo', 'hr'];
export const BUCKET = 'estate-produce';
export const ESTATE_PRODUCE_RECORD_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
export const TIME_RE = /^\d{2}:\d{2}(:\d{2})?$/;

export type EstateProduceAuth = Awaited<ReturnType<typeof requireApiUser>>;
export type EstateProduceRow = Record<string, unknown>;
export type RecordPayloadResult =
  | { ok: true; payload: Record<string, unknown> }
  | { ok: false; error: string };

export async function requireEstateProduceUser(request: Request, allowedRoles = ESTATE_PRODUCE_ROLES) {
  return requireApiUser(request, allowedRoles);
}

export function text(value: unknown) {
  return typeof value === 'string' || typeof value === 'number' ? String(value).trim() : '';
}

export function nullableText(value: unknown) {
  const result = text(value);
  return result || null;
}

export function numberValue(value: unknown) {
  const parsed = typeof value === 'number' ? value : Number(text(value).replace(/,/g, ''));
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

export function jsonObject(value: unknown) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function nonEmptyJsonObject(value: unknown) {
  const object = jsonObject(value);
  return Object.keys(object).length ? object : undefined;
}

export function safeFileName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_');
}

export function recordSelect() {
  return [
    'id',
    'record_date',
    'record_time',
    'estate',
    'product',
    'unit',
    'qty',
    'weight_kg',
    'previous_qty',
    'previous_weight_kg',
    'damage_qty',
    'damage_weight_kg',
    'damage_notes',
    'source',
    'source_message',
    'photo_path',
    'photo_file_name',
    'photo_content_type',
    'ai_photo_count',
    'location',
    'notes',
    'follow_up',
    'entered_by',
    'entered_by_name',
    'created_at',
    'updated_at',
  ].join(', ');
}

export function mapRecord(row: EstateProduceRow | null | undefined) {
  const sourceRow = row ?? {};
  const photoPath = text(sourceRow.photo_path);
  return {
    id: text(sourceRow.id),
    date: text(sourceRow.record_date),
    time: text(sourceRow.record_time).slice(0, 5),
    estate: text(sourceRow.estate),
    product: text(sourceRow.product),
    unit: text(sourceRow.unit),
    qty: numberValue(sourceRow.qty),
    weightKg: numberValue(sourceRow.weight_kg),
    previousQty: numberValue(sourceRow.previous_qty),
    previousWeightKg: numberValue(sourceRow.previous_weight_kg),
    damageQty: numberValue(sourceRow.damage_qty),
    damageWeightKg: numberValue(sourceRow.damage_weight_kg),
    damageNotes: text(sourceRow.damage_notes),
    source: text(sourceRow.source) || 'Manual',
    sourceMessage: text(sourceRow.source_message) || undefined,
    photoPath: photoPath || undefined,
    photoUrl: photoPath ? signedStorageUrl(BUCKET, photoPath) : undefined,
    photoFileName: text(sourceRow.photo_file_name) || undefined,
    photoContentType: text(sourceRow.photo_content_type) || undefined,
    aiPhotoCount: nonEmptyJsonObject(sourceRow.ai_photo_count),
    location: text(sourceRow.location) || undefined,
    notes: text(sourceRow.notes),
    followUp: text(sourceRow.follow_up) || undefined,
    enteredBy: text(sourceRow.entered_by_name) || 'MSP User',
    createdAt: text(sourceRow.created_at),
    updatedAt: text(sourceRow.updated_at),
  };
}

export function buildRecordPayload(body: Record<string, unknown>, userId: string, userName: string, isUpdate = false): RecordPayloadResult {
  const date = text(body.date);
  const time = text(body.time);
  const estate = text(body.estate);
  const product = text(body.product);
  const unit = text(body.unit) || (isUpdate ? '' : 'Pieces');
  const source = text(body.source) || (isUpdate ? '' : 'Manual');

  if (!isUpdate || date) {
    if (!DATE_RE.test(date)) return { ok: false, error: 'Enter a valid date' };
  }
  if (time && !TIME_RE.test(time)) return { ok: false, error: 'Enter a valid time' };
  if ((!isUpdate || estate) && !ESTATES.includes(estate)) return { ok: false, error: 'Choose a valid estate' };
  if ((!isUpdate || product) && !product) return { ok: false, error: 'Product is required' };
  if ((!isUpdate || unit) && !UNITS.includes(unit)) return { ok: false, error: 'Choose a valid unit' };
  if ((!isUpdate || source) && !SOURCES.includes(source)) return { ok: false, error: 'Choose a valid source' };

  const payload: Record<string, unknown> = {
    updated_by: userId,
  };

  if (!isUpdate) {
    payload.entered_by = userId;
    payload.entered_by_name = userName;
  }

  if (date) payload.record_date = date;
  if (time || !isUpdate) payload.record_time = time || null;
  if (estate) payload.estate = estate;
  if (product) payload.product = product;
  if (unit) payload.unit = unit;
  if (Object.hasOwn(body, 'qty')) payload.qty = numberValue(body.qty);
  if (Object.hasOwn(body, 'weightKg')) payload.weight_kg = numberValue(body.weightKg);
  if (Object.hasOwn(body, 'previousQty')) payload.previous_qty = numberValue(body.previousQty);
  if (Object.hasOwn(body, 'previousWeightKg')) payload.previous_weight_kg = numberValue(body.previousWeightKg);
  if (Object.hasOwn(body, 'damageQty')) payload.damage_qty = numberValue(body.damageQty);
  if (Object.hasOwn(body, 'damageWeightKg')) payload.damage_weight_kg = numberValue(body.damageWeightKg);
  if (Object.hasOwn(body, 'damageNotes')) payload.damage_notes = nullableText(body.damageNotes);
  if (source) payload.source = source;
  if (Object.hasOwn(body, 'sourceMessage')) payload.source_message = nullableText(body.sourceMessage);
  if (Object.hasOwn(body, 'photoPath')) payload.photo_path = nullableText(body.photoPath);
  if (Object.hasOwn(body, 'photoFileName')) payload.photo_file_name = nullableText(body.photoFileName);
  if (Object.hasOwn(body, 'photoContentType')) payload.photo_content_type = nullableText(body.photoContentType);
  if (Object.hasOwn(body, 'aiPhotoCount')) payload.ai_photo_count = jsonObject(body.aiPhotoCount);
  if (Object.hasOwn(body, 'location')) payload.location = nullableText(body.location);
  if (Object.hasOwn(body, 'notes')) payload.notes = nullableText(body.notes);
  if (Object.hasOwn(body, 'followUp')) payload.follow_up = nullableText(body.followUp);

  return { ok: true, payload };
}

export function badRequest(error: string) {
  return NextResponse.json({ error }, { status: 400 });
}
