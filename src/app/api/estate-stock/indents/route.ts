import { NextResponse } from 'next/server';
import { estateStockAuth } from '../_auth';
import {
  includesValue,
  INDENT_STATUSES,
  nonNegative,
  requireEstate,
  text,
  validDate,
} from '@/lib/estate-stock';

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

export function cleanIndent(body: Record<string, unknown>, actor: string) {
  const date = text(body.date);
  if (!validDate(date)) throw new Error('Enter a valid indent date.');
  const fromEst = requireEstate(text(body.fromEstate));
  const toEst = requireEstate(text(body.toEstate));
  if (fromEst === toEst) throw new Error('An indent must move between two different estates.');
  const item = text(body.item);
  if (!item) throw new Error('Enter the item being transferred.');
  const status = text(body.status) || 'In Transit';
  if (!includesValue(INDENT_STATUSES, status)) throw new Error('Choose a valid status.');
  const no = text(body.no) || `IND-${Date.now().toString(36).toUpperCase()}`;
  return {
    indent_no: no,
    indent_date: date,
    from_estate: fromEst,
    to_estate: toEst,
    item,
    quantity: nonNegative(body.quantity),
    weight_kg: nonNegative(body.weight_kg),
    status,
    signed_by: actor,
    received_by: status === 'In Transit' ? null : text(body.receivedBy) || null,
    notes: text(body.notes, 2000) || null,
    created_by: actor,
  };
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
