import { NextResponse } from 'next/server';
import { basePhoneRows, phoneBillAuth } from '@/lib/phone-bills-server';
import { billKey, billPeriod, historicallyPaid, paymentError, validPeriod } from '@/lib/phone-bills';
import { UUID_RE } from '@/lib/auth/api';

export async function GET(request: Request) {
  const auth = await phoneBillAuth(request);
  if ('error' in auth) return auth.error;
  const period = new URL(request.url).searchParams.get('period');
  if (!validPeriod(period)) return NextResponse.json({ error: 'Select a month and year.' }, { status: 400 });
  const { data, error } = await auth.supabase.from('phone_bill_statements').select('*').eq('period', period).maybeSingle();
  if (error) return NextResponse.json({ error: 'Statement saving is not ready. Apply the phone-bill database migration before going live.' }, { status: 503 });
  const files = data ? await auth.supabase.from('phone_bill_statement_files').select('id,file_name,created_at').eq('statement_id', data.id).order('created_at', { ascending: false }) : { data: [], error: null };
  if (files.error) return NextResponse.json({ error: 'Unable to load signed copies.' }, { status: 500 });
  return NextResponse.json({ statement: data, files: files.data }, { headers: { 'Cache-Control': 'no-store' } });
}
export async function POST(request: Request) {
  const auth = await phoneBillAuth(request, true);
  if ('error' in auth) return auth.error;
  const body = await request.json().catch(() => null);
  if (!validPeriod(body?.period)) return NextResponse.json({ error: 'Select a month and year.' }, { status: 400 });
  const base = (await basePhoneRows()).filter(r => billPeriod(r) === body.period).map(r => ({ ...r, entryKey: billKey(r) }));
  // The function takes a per-month lock and reads saved additions inside the same
  // transaction, so a simultaneous new entry cannot be omitted from the snapshot.
  const { data, error } = await auth.supabase.rpc('issue_phone_bill_statement', { bill_period: body.period, base_rows: base, actor: auth.user.id });
  if (error) return NextResponse.json({ error: error.code === '23505' ? 'This month already has an issued statement. Refresh to open it.' : error.code === 'P0001' ? 'No entries, missing amounts, or duplicate accounts: review this month before issuing.' : 'Unable to issue statement. Check the phone-bill migration is installed.' }, { status: error.code === '23505' || error.code === 'P0001' ? 409 : 503 });
  return NextResponse.json({ statement: data }, { status: 201 });
}
export async function PATCH(request: Request) {
  const auth = await phoneBillAuth(request, true);
  if ('error' in auth) return auth.error;
  const body = await request.json().catch(() => null);
  if (!UUID_RE.test(body?.id || '')) return NextResponse.json({ error: 'Invalid statement.' }, { status: 400 });
  const { data: statement, error: readError } = await auth.supabase.from('phone_bill_statements').select('total,payment_date,period').eq('id', body.id).maybeSingle();
  if (readError) return NextResponse.json({ error: 'Unable to load statement.' }, { status: 500 });
  if (!statement) return NextResponse.json({ error: 'Statement not found.' }, { status: 404 });
  if (historicallyPaid(statement.period)) return NextResponse.json({ error: 'This month is already paid under the confirmed historical balance through February 2026.' }, { status: 409 });
  if (statement.payment_date) return NextResponse.json({ error: 'Payment is already recorded for this statement.' }, { status: 409 });
  const validation = paymentError(body, Number(statement.total));
  if (validation) return NextResponse.json({ error: validation }, { status: 400 });
  const { data, error } = await auth.supabase.from('phone_bill_statements').update({ payment_date: body.date, payment_reference: body.reference.trim(), payment_amount: body.amount, paid_by: auth.user.id }).eq('id', body.id).is('payment_date', null).select().maybeSingle();
  if (error) return NextResponse.json({ error: 'Unable to record payment.' }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'Payment was already recorded. Refresh this month.' }, { status: 409 });
  return NextResponse.json({ statement: data });
}
