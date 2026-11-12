import { NextResponse } from 'next/server';
import { UUID_RE } from '@/lib/auth/api';
import { HO_BILL_BUCKET, HO_FILE_TYPES, fuelBillMagic, hoFuelAuth } from '@/lib/ho-fuel-server';
export async function POST(request: Request) {
  const auth = await hoFuelAuth(request, true);
  if ('error' in auth) return auth.error;
  if (Number(request.headers.get('content-length') || 0) > 4 * 1024 * 1024) return NextResponse.json({ error: 'Each file must be 3 MB or smaller.' }, { status: 413 });
  const form = await request.formData().catch(() => null);
  const file = form?.get('file');
  const purchaseId = Number(form?.get('purchaseId') || 0);
  if (!(file instanceof File) || !HO_FILE_TYPES[file.type] || !file.size || file.size > 3 * 1024 * 1024 || !Number.isSafeInteger(purchaseId) || purchaseId < 0)
    return NextResponse.json({ error: 'Choose a PDF, JPG, PNG or WebP bill, up to 3 MB per file.' }, { status: 400 });
  if (purchaseId) {
    const row = await auth.supabase.from('ho_fuel_log').select('id').eq('id', purchaseId).eq('transaction_type', 'PURCHASE').maybeSingle();
    if (row.error || !row.data) return NextResponse.json({ error: 'Purchase not found.' }, { status: 404 });
  }
  const bytes = Buffer.from(await file.arrayBuffer());
  if (!fuelBillMagic(bytes, file.type)) return NextResponse.json({ error: 'The file contents do not match the selected format.' }, { status: 400 });
  const id = crypto.randomUUID();
  const path = `${auth.user.id}/${id}${HO_FILE_TYPES[file.type]}`;
  const upload = await auth.supabase.storage.from(HO_BILL_BUCKET).upload(path, bytes, { contentType: file.type, upsert: false });
  if (upload.error) return NextResponse.json({ error: 'Bill upload failed. Please try again.' }, { status: 500 });
  const saved = await auth.supabase.from('ho_fuel_bills').insert({ id, purchase_id: purchaseId || null, uploaded_by: auth.user.id, file_path: path, file_name: file.name.slice(0,200), content_type: file.type }).select('id,file_name').single();
  if (saved.error) {
    await auth.supabase.storage.from(HO_BILL_BUCKET).remove([path]);
    return NextResponse.json({ error: 'Unable to save the bill. Retry the upload.' }, { status: 500 });
  }
  return NextResponse.json(saved.data, { status: 201 });
}
export async function GET(request: Request) {
  const auth = await hoFuelAuth(request);
  if ('error' in auth) return auth.error;
  const query = new URL(request.url).searchParams;
  const id = query.get('id');
  if (id) {
    if (!UUID_RE.test(id)) return NextResponse.json({ error: 'Invalid bill.' }, { status: 400 });
    const bill = await auth.supabase.from('ho_fuel_bills').select('file_path,purchase_id,uploaded_by').eq('id', id).maybeSingle();
    if (bill.error || !bill.data || (!bill.data.purchase_id && bill.data.uploaded_by !== auth.user.id)) return NextResponse.json({ error: 'Bill not found.' }, { status: 404 });
    const signed = await auth.supabase.storage.from(HO_BILL_BUCKET).createSignedUrl(bill.data.file_path, 300);
    if (signed.error || !signed.data) return NextResponse.json({ error: 'Unable to open bill.' }, { status: 500 });
    return NextResponse.redirect(signed.data.signedUrl, { headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });
  }
  const purchaseId = Number(query.get('purchaseId'));
  if (!Number.isSafeInteger(purchaseId) || purchaseId <= 0) return NextResponse.json({ error: 'Invalid purchase.' }, { status: 400 });
  const bills = await auth.supabase.from('ho_fuel_bills').select('id,file_name').eq('purchase_id', purchaseId).order('created_at');
  if (bills.error) return NextResponse.json({ error: 'Unable to load bills.' }, { status: 500 });
  return NextResponse.json({ files: bills.data }, { headers: { 'Cache-Control': 'no-store' } });
}
