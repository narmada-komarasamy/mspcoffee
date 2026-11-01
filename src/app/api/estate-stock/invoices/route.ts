import { NextResponse } from 'next/server';
import { estateStockAuth } from '../_auth';
import {
  BUCKET,
  indentFileError,
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
  let query = auth.supabase
    .from('estate_stock_invoices')
    .select('*')
    .order('invoice_date', { ascending: false })
    .order('created_at', { ascending: false });
  if (estate && estate !== 'All') query = query.eq('estate', estate);
  const { data, error } = await query;
  if (error) return NextResponse.json({ error: 'Unable to load invoices.' }, { status: 500 });
  return NextResponse.json({ invoices: data ?? [] }, { headers: { 'Cache-Control': 'private, no-store' } });
}

export function cleanInvoice(body: Record<string, unknown>, actor: string) {
  const no = text(body.no);
  if (!no) throw new Error('Enter the invoice number.');
  const date = text(body.date);
  if (!validDate(date)) throw new Error('Enter a valid invoice date.');
  const supplier = text(body.supplier);
  if (!supplier) throw new Error('Enter the supplier.');
  const item = text(body.item);
  if (!item) throw new Error('Enter the item purchased.');
  const estate = requireEstate(text(body.estate));
  return {
    invoice_no: no,
    invoice_date: date,
    supplier,
    item,
    estate,
    amount: nonNegative(body.amount),
    notes: text(body.notes, 2000) || null,
    created_by: actor,
  };
}

export async function POST(request: Request) {
  const auth = await estateStockAuth(request, true);
  if ('error' in auth) return auth.error;
  const form = await request.formData();
  const file = form.get('file');
  if (file instanceof File) {
    const invalid = indentFileError(file);
    if (invalid) return NextResponse.json({ error: invalid }, { status: 400 });
  }
  try {
    const row = cleanInvoice(
      {
        no: form.get('no'),
        date: form.get('date'),
        supplier: form.get('supplier'),
        item: form.get('item'),
        estate: form.get('estate'),
        amount: form.get('amount'),
        notes: form.get('notes'),
      },
      auth.user.id
    );
    const { data, error } = await auth.supabase
      .from('estate_stock_invoices')
      .insert(row)
      .select('id')
      .single();
    if (error) throw new Error('Could not save the invoice.');

    if (file instanceof File) {
      const ext: Record<string, string> = {
        'application/pdf': 'pdf',
        'image/png': 'png',
        'image/jpeg': 'jpg',
        'image/webp': 'webp',
      };
      const path = `${data.id}/${crypto.randomUUID()}.${ext[file.type] || 'bin'}`;
      const { error: upload } = await auth.supabase.storage
        .from(BUCKET)
        .upload(path, await file.arrayBuffer(), { contentType: file.type, upsert: false });
      if (upload) throw new Error('Invoice saved, but the attachment upload failed. Retry the upload.');
      await auth.supabase.from('estate_stock_invoices')
        .update({
          attachment_path: path,
          attachment_name: file.name,
          attachment_content_type: file.type,
          updated_at: new Date().toISOString(),
        })
        .eq('id', data.id);
    }
    return NextResponse.json({ id: data.id, attached: file instanceof File });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Invalid invoice.' },
      { status: 400 }
    );
  }
}
