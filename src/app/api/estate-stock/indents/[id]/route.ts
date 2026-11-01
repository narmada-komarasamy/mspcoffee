import { NextResponse } from 'next/server';
import { estateStockAuth, UUID_RE } from '../../_auth';
import { cleanIndent } from '../route';

// PATCH /api/estate-stock/indents/[id]
// Body: { no, date, fromEstate, toEstate, item, quantity, weightKg, status, receivedBy, notes }
// When status advances to 'Settled', the matching stock item at the receiving
// estate is flipped from 'In Transit' back to 'In Stock' — the balance offset.
export async function PATCH(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await estateStockAuth(request, true);
  if ('error' in auth) return auth.error;
  const { id } = await ctx.params;
  if (!UUID_RE.test(id)) return NextResponse.json({ error: 'Invalid indent.' }, { status: 400 });

  const { data: existing, error: lookup } = await auth.supabase
    .from('estate_stock_indents')
    .select('*')
    .eq('id', id)
    .single();
  if (lookup || !existing) return NextResponse.json({ error: 'Indent not found.' }, { status: 404 });

  try {
    const body = await request.json();
    const merged = {
      ...existing,
      no: existing.indent_no,
      date: existing.indent_date,
      fromEstate: existing.from_estate,
      toEstate: existing.to_estate,
      item: existing.item,
      quantity: existing.quantity,
      weightKg: existing.weight_kg,
      receivedBy: existing.received_by,
      notes: existing.notes,
      ...body,
    };
    const row = cleanIndent(merged, auth.user.id);
    const settled = row.status === 'Settled';
    const { error } = await auth.supabase.from('estate_stock_indents').update(row).eq('id', id);
    if (error) throw new Error('Could not update the indent.');

    let offset: string[] = [];
    if (settled) {
      const { data: matches, error: mErr } = await auth.supabase
        .from('estate_stock_items')
        .select('id, item, estate')
        .eq('estate', row.to_estate)
        .ilike('item', row.item)
        .eq('status', 'In Transit');
      if (mErr) throw new Error('Could not update the matching stock item.');
      if (matches?.length) {
        const ids = matches.map((m) => m.id);
        await auth.supabase.from('estate_stock_items').update({ status: 'In Stock' }).in('id', ids);
        offset = matches.map((m) => `${m.item} at ${m.estate}`);
      }
    }
    return NextResponse.json({ id, settled, offset });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Invalid indent.' },
      { status: 400 }
    );
  }
}

export async function DELETE(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await estateStockAuth(request, true);
  if ('error' in auth) return auth.error;
  const { id } = await ctx.params;
  if (!UUID_RE.test(id)) return NextResponse.json({ error: 'Invalid indent.' }, { status: 400 });
  const { error } = await auth.supabase.from('estate_stock_indents').delete().eq('id', id);
  if (error) return NextResponse.json({ error: 'Could not delete the indent.' }, { status: 500 });
  return NextResponse.json({ id });
}
