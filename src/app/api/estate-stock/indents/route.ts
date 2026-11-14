import { NextResponse } from 'next/server';
import { estateStockAuth } from '../_auth';
import { text } from '@/lib/estate-stock';
import { cleanIndent } from '@/lib/estate-stock-validation';

export async function GET(request: Request) {
  const auth = await estateStockAuth(request);
  if ('error' in auth) return auth.error;
  const params = new URL(request.url).searchParams;
  const estate = text(params.get('estate'));
  const status = text(params.get('status'));
  let query = auth.supabase
    .from('estate_stock_indents')
    .select('*')
    .order('indent_date', { ascending: false })
    .order('created_at', { ascending: false });
  if (estate && estate !== 'All') {
    query = query.or(`from_estate.eq.${estate},to_estate.eq.${estate}`);
  }
  if (status && status !== 'All') query = query.eq('status', status);
  const { data, error } = await query;
  if (error) return NextResponse.json({ error: 'Unable to load indents.' }, { status: 500 });
  return NextResponse.json({ indents: data ?? [] }, { headers: { 'Cache-Control': 'private, no-store' } });
}

export async function POST(request: Request) {
  const auth = await estateStockAuth(request, true);
  if ('error' in auth) return auth.error;
  try {
    const row = cleanIndent(await request.json(), auth.user.id);
    const { data, error } = await auth.supabase
      .from('estate_stock_indents')
      .insert(row)
      .select('id')
      .single();
    if (error) {
      if (error.code === '23505') {
        throw new Error('That indent number is already in use. Leave it blank to auto-generate one.');
      }
      throw new Error('Could not save the indent.');
    }
    return NextResponse.json({ id: data.id });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Invalid indent.' },
      { status: 400 }
    );
  }
}
