import { NextResponse } from 'next/server';
import { estateStockAuth } from '../_auth';
import { text } from '@/lib/estate-stock';
import { cleanItem } from '@/lib/estate-stock-validation';

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
