import { NextResponse } from 'next/server';
import { estateStockAuth } from '../_auth';

export async function GET(request: Request) {
  const auth = await estateStockAuth(request);
  if ('error' in auth) return auth.error;
  const { data, error } = await auth.supabase
    .from('estate_stock_estates')
    .select('*')
    .order('sort_order', { ascending: true })
    .order('code');
  if (error) return NextResponse.json({ error: 'Unable to load estates.' }, { status: 500 });
  return NextResponse.json({ estates: data ?? [] }, { headers: { 'Cache-Control': 'private, no-store' } });
}
