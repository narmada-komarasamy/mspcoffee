import { NextResponse } from 'next/server';
import { requireApiUser } from '@/lib/auth/api';
import { BILL_BUCKET, billFileError } from '@/lib/fleet/maintenance';

async function saveRecord(request: Request) {
  const auth = await requireApiUser(request, ['admin', 'supervisor', 'ceo']);
  if ('error' in auth) return auth.error;
  const form = await request.formData();
  let row: Record<string, unknown>;
  try {
    row = JSON.parse(String(form.get('record')));
    if (!row || typeof row !== 'object' || Array.isArray(row)) throw new Error('Invalid record');
  } catch {
    return NextResponse.json({ error: 'Invalid fleet record.' }, { status: 400 });
  }
  const text = (key: string, max = 10000) => typeof row[key] === 'string' ? row[key].trim().slice(0, max) : '';
  const number = (key: string) => Number(row[key] ?? 0);
  const date = text('date');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(date)) || new Date(date).toISOString().slice(0, 10) !== date || !text('vehicle_id', 128)) {
    return NextResponse.json({ error: 'A valid date and vehicle ID are required.' }, { status: 400 });
  }
  if (!['Estate', 'Personal'].includes(text('vehicle_type')) || !['BVE', 'HFE', 'ME', 'ORE', 'RSE', 'SE'].includes(text('account')) || !['Diesel', 'Petrol'].includes(text('fuel_type'))) {
    return NextResponse.json({ error: 'Invalid vehicle type, account or fuel type.' }, { status: 400 });
  }
  for (const field of ['starting_km', 'closing_km', 'fuel_filled_l', 'fuel_cost', 'maint_cost']) {
    if (!Number.isFinite(number(field)) || number(field) < 0) return NextResponse.json({ error: 'Costs, fuel and KM readings must be valid non-negative numbers.' }, { status: 400 });
  }
  const id = row.id == null ? null : Number(row.id);
  if (id !== null && (!Number.isSafeInteger(id) || id <= 0)) return NextResponse.json({ error: 'Invalid record ID.' }, { status: 400 });
  let oldPath = '';
  if (id !== null) {
    const { data, error } = await auth.supabase.from('fleet_daily').select('maintenance_bill_path').eq('id', id).single();
    if (error || !data) return NextResponse.json({ error: 'Fleet record not found or bill migration is missing.' }, { status: 404 });
    oldPath = data.maintenance_bill_path;
  }
  const file = form.get('file');
  if (file instanceof File) {
    const error = billFileError(file);
    if (error) return NextResponse.json({ error }, { status: 400 });
  }
  const km = Math.max(0, number('closing_km') - number('starting_km'));
  const total = number('fuel_cost') + number('maint_cost');
  const payload: Record<string, unknown> = {
    date, month: Number(date.slice(5, 7)), year: Number(date.slice(0, 4)),
    vehicle_id: text('vehicle_id', 128), vehicle_type: text('vehicle_type'), account: text('account'), fuel_type: text('fuel_type'),
    starting_km: number('starting_km'), closing_km: number('closing_km'), fuel_filled_l: number('fuel_filled_l'),
    fuel_cost: number('fuel_cost'), maint_cost: number('maint_cost'), km_run: km, total_cost: total,
    avg_mileage: number('fuel_filled_l') > 0 ? Number((km / number('fuel_filled_l')).toFixed(2)) : 0,
    cost_per_km: km > 0 ? Number((total / km).toFixed(2)) : 0,
    maintenance_performed: text('maintenance_performed'), remarks: text('remarks'),
    maintenance_vendor: text('maintenance_vendor', 500),
    maintenance_bill_text: text('maintenance_bill_text', 50000),
  };
  let path = '';
  if (file instanceof File) {
    const extension = { 'application/pdf': 'pdf', 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }[file.type];
    path = `${crypto.randomUUID()}/bill.${extension}`;
    const { error } = await auth.supabase.storage.from(BILL_BUCKET).upload(path, file, { contentType: file.type, upsert: false });
    if (error) return NextResponse.json({ error: 'Could not upload the original bill. Check that the maintenance bill migration has been applied, then retry.' }, { status: 500 });
    payload.maintenance_bill_path = path;
    payload.maintenance_bill_name = file.name.slice(0, 255);
  }
  const { error } = id !== null
    ? await auth.supabase.from('fleet_daily').update(payload).eq('id', id)
    : await auth.supabase.from('fleet_daily').insert(payload);
  if (error) {
    if (path) await auth.supabase.storage.from(BILL_BUCKET).remove([path]);
    return NextResponse.json({ error: error.code === '23505' ? 'An entry already exists for this vehicle and date. Edit that entry to attach the maintenance bill.' : 'Could not save the entry. Check the maintenance bill migration and try again.' }, { status: 400 });
  }
  if (path && oldPath) await auth.supabase.storage.from(BILL_BUCKET).remove([oldPath]);
  return NextResponse.json({ ok: true });
}

export async function POST(request: Request) {
  try {
    return await saveRecord(request);
  } catch {
    return NextResponse.json({ error: 'Could not save the entry. Please try again.' }, { status: 500 });
  }
}
