import { NextResponse } from 'next/server';
import { estateStockAuth, UUID_RE } from '../../_auth';
import { cleanItem } from '@/lib/estate-stock-validation';

export async function PATCH(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await estateStockAuth(request, true);
  if ('error' in auth) return auth.error;
  const { id } = await ctx.params;
  if (!UUID_RE.test(id)) return NextResponse.json({ error: 'Invalid item.' }, { status: 400 });
  try {
    const row = cleanItem(await request.json(), auth.user.id);
    const { error } = await auth.supabase
      .from('estate_stock_items')
      .update({ ...row, created_by: undefined })
      .eq('id', id);
    if (error) throw new Error('Could not update the stock item.');
    return NextResponse.json({ id });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Invalid stock item.' },
      { status: 400 }
    );
  }
}

export async function DELETE(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await estateStockAuth(request, true);
  if ('error' in auth) return auth.error;
  const { id } = await ctx.params;
  if (!UUID_RE.test(id)) return NextResponse.json({ error: 'Invalid item.' }, { status: 400 });
  const { error } = await auth.supabase.from('estate_stock_items').delete().eq('id', id);
  if (error) return NextResponse.json({ error: 'Could not delete the stock item.' }, { status: 500 });
  return NextResponse.json({ id });
}
