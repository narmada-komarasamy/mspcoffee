import { NextResponse } from 'next/server';
import { phoneBillAuth, PHONE_BUCKET } from '@/lib/phone-bills-server';
import { UUID_RE } from '@/lib/auth/api';

const fileTypes: Record<string, string> = { 'application/pdf': '.pdf', 'image/jpeg': '.jpg', 'image/png': '.png' };
export async function POST(request: Request) {
  const auth = await phoneBillAuth(request, true);
  if ('error' in auth) return auth.error;
  const length = Number(request.headers.get('content-length') || 0);
  if (length > 4 * 1024 * 1024) return NextResponse.json({ error: 'Upload a PDF, JPG or PNG smaller than 3 MB per file.' }, { status: 413 });
  const form = await request.formData().catch(() => null);
  const id = String(form?.get('statementId') || '');
  const file = form?.get('file');
  if (!UUID_RE.test(id) || !(file instanceof File) || !fileTypes[file.type] || file.size === 0 || file.size > 3 * 1024 * 1024) return NextResponse.json({ error: 'Choose a statement and a PDF, JPG or PNG smaller than 3 MB.' }, { status: 400 });
  const bytes = Buffer.from(await file.arrayBuffer());
  const validMagic = file.type === 'application/pdf' ? bytes.subarray(0, 5).toString() === '%PDF-' : file.type === 'image/png' ? bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) : bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
  if (!validMagic) return NextResponse.json({ error: 'The file contents do not match its PDF or image format.' }, { status: 400 });
  const statement = await auth.supabase.from('phone_bill_statements').select('id').eq('id', id).maybeSingle();
  if (statement.error) return NextResponse.json({ error: 'Unable to verify statement.' }, { status: 500 });
  if (!statement.data) return NextResponse.json({ error: 'Statement not found.' }, { status: 404 });
  const path = `${id}/${crypto.randomUUID()}${fileTypes[file.type]}`;
  const { error: uploadError } = await auth.supabase.storage.from(PHONE_BUCKET).upload(path, bytes, { contentType: file.type, upsert: false });
  if (uploadError) return NextResponse.json({ error: 'Upload failed. Please try again.' }, { status: 500 });
  const { data, error } = await auth.supabase.from('phone_bill_statement_files').insert({ statement_id: id, file_name: file.name.slice(0, 200), file_path: path, uploaded_by: auth.user.id }).select('id,file_name,created_at').single();
  if (error) {
    await auth.supabase.storage.from(PHONE_BUCKET).remove([path]);
    return NextResponse.json({ error: 'Could not save the attachment record. Please upload again.' }, { status: 500 });
  }
  return NextResponse.json({ file: data }, { status: 201 });
}
export async function GET(request: Request) {
  const auth = await phoneBillAuth(request);
  if ('error' in auth) return auth.error;
  const id = new URL(request.url).searchParams.get('id') || '';
  if (!UUID_RE.test(id)) return NextResponse.json({ error: 'Invalid attachment.' }, { status: 400 });
  const { data, error } = await auth.supabase.from('phone_bill_statement_files').select('file_path').eq('id', id).maybeSingle();
  if (error || !data) return NextResponse.json({ error: 'Attachment not found.' }, { status: 404 });
  const signed = await auth.supabase.storage.from(PHONE_BUCKET).createSignedUrl(data.file_path, 300);
  if (signed.error || !signed.data?.signedUrl) return NextResponse.json({ error: 'Unable to open the signed copy.' }, { status: 500 });
  return NextResponse.redirect(signed.data.signedUrl, { headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });
}
