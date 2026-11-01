import { NextResponse } from 'next/server';
import { estateStockAuth, UUID_RE } from '../../_auth';
import { BUCKET } from '@/lib/estate-stock';
import { cleanInvoice } from '../route';

// GET /api/estate-stock/invoices/[id]?attachment=1
// Redirects to a short-lived signed URL for the scanned bill, or 404.
export async function GET(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await estateStockAuth(request);
  if ('error' in auth) return auth.error;
  const { id } = await ctx.params;
  if (!UUID_RE.test(id)) return NextResponse.json({ error: 'Invalid invoice.' }, { status: 400 });
  const wantAttachment = new URL(request.url).searchParams.get('attachment') === '1';
  const { data, error } = await auth.supabase
    .from('estate_stock_invoices')
    .select('attachment_path')
    .eq('id', id)
    .single();
  if (error || !data?.attachment_path) {
    return NextResponse.json({ error: 'No attachment on this invoice.' }, { status: 404 });
  }
  if (!wantAttachment) return NextResponse.json({ hasAttachment: true });
  const { data: link, error: linkError } = await auth.supabase.storage
    .from(BUCKET)
    .createSignedUrl(data.attachment_path, 300);
  if (linkError || !link) return NextResponse.json({ error: 'Attachment unavailable.' }, { status: 404 });
  return NextResponse.redirect(link.signedUrl, { headers: { 'Cache-Control': 'no-store' } });
}

export async function PATCH(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await estateStockAuth(request, true);
  if ('error' in auth) return auth.error;
  const { id } = await ctx.params;
  if (!UUID_RE.test(id)) return NextResponse.json({ error: 'Invalid invoice.' }, { status: 400 });
  const { data: existing, error: lookup } = await auth.supabase
    .from('estate_stock_invoices')
    .select('*')
    .eq('id', id)
    .single();
  if (lookup || !existing) return NextResponse.json({ error: 'Invoice not found.' }, { status: 404 });
  try {
    const body = await request.json();
    const merged = {
      no: existing.invoice_no,
      date: existing.invoice_date,
      supplier: existing.supplier,
      item: existing.item,
      estate: existing.estate,
      amount: existing.amount,
      notes: existing.notes,
      ...body,
    };
    const row = cleanInvoice(merged, auth.user.id);
    const { error } = await auth.supabase
      .from('estate_stock_invoices')
      .update({ ...row, created_by: undefined })
      .eq('id', id);
    if (error) throw new Error('Could not update the invoice.');
    return NextResponse.json({ id });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Invalid invoice.' },
      { status: 400 }
    );
  }
}

export async function DELETE(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await estateStockAuth(request, true);
  if ('error' in auth) return auth.error;
  const { id } = await ctx.params;
  if (!UUID_RE.test(id)) return NextResponse.json({ error: 'Invalid invoice.' }, { status: 400 });
  const { data: existing, error: lookup } = await auth.supabase
    .from('estate_stock_invoices')
    .select('attachment_path')
    .eq('id', id)
    .maybeSingle();
  if (lookup || !existing) return NextResponse.json({ error: 'Invoice not found.' }, { status: 404 });
  if (existing.attachment_path) {
    await auth.supabase.storage.from(BUCKET).remove([existing.attachment_path]);
  }
  const { error } = await auth.supabase.from('estate_stock_invoices').delete().eq('id', id);
  if (error) return NextResponse.json({ error: 'Could not delete the invoice.' }, { status: 500 });
  return NextResponse.json({ id });
}
