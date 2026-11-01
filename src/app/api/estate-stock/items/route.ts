import { NextResponse } from 'next/server';
import { estateStockAuth } from '../_auth';
import { includesValue, nonNegative, requireEstate, text, STOCK_STATUSES, STOCK_UNITS } from '@/lib/estate-stock';

export async function GET(request: Request) {
  const auth = await estateStockAuth(request);
  if ('error' in auth) return auth.error;
  const estate = text(new URL(request.url).searchParams.get('estate'));
  let query = auth.supabase
    .from('estate_stock_items')
    .select('*')
    .order('estate', { ascending: true })
    .order('item', { ascending: true });
  if (estate && estate !== 'All') query = query.eq('estate', estate);
  const { data, error } = await query;
  if (error) return NextResponse.json({ error: 'Unable to load stock items.' }, { status: 500 });
  return NextResponse.json({ items: data ?? [] }, { headers: { 'Cache-Control': 'private, no-store' } });
}

export function cleanItem(body: Record<string, unknown>, actor: string) {
  const item = text(body.item);
  if (!item) throw new Error('Enter the item name.');
  const estate = requireEstate(text(body.estate));
  const status = text(body.status) || 'In Stock';
  if (!includesValue(STOCK_STATUSES, status)) throw new Error('Choose a valid status.');
  const unit = text(body.unit) || 'Nos';
  if (!includesValue(STOCK_UNITS, unit)) throw new Error('Choose a valid unit.');
  return {
    item,
    estate,
    unit,
    status,
    quantity: nonNegative(body.quantity),
    weight_kg: nonNegative(body.weight_kg),
    storage_location: text(body.storage_location, 200) || null,
    notes: text(body.notes, 2000) || null,
    created_by: actor,
  };
}

export async function POST(request: Request) {
  const auth = await estateStockAuth(request, true);
  if ('error' in auth) return auth.error;
  try {
    const row = cleanItem(await request.json(), auth.user.id);
    const { data, error } = await auth.supabase.from('estate_stock_items').insert(row).select('id').single();
    if (error) throw new Error('Could not save the stock item.');
    return NextResponse.json({ id: data.id });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Invalid stock item.' },
      { status: 400 }
    );
  }
}
