import { NextResponse } from 'next/server';
import { allPhoneRows, phoneBillAuth } from '@/lib/phone-bills-server';
import { billKey, billPeriod, cleanBillRow } from '@/lib/phone-bills';

export async function GET(request: Request) {
  const auth = await phoneBillAuth(request);
  if ('error' in auth) return auth.error;
  try {
    return NextResponse.json({ rows: await allPhoneRows(auth.supabase) }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to load bills.' }, { status: 503 });
  }
}
export async function POST(request: Request) {
  const auth = await phoneBillAuth(request, true);
  if ('error' in auth) return auth.error;
  let row;
  try { row = cleanBillRow(await request.json()); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : 'Invalid entry.' }, { status: 400 }); }
  try {
    if ((await allPhoneRows(auth.supabase)).some(r => billKey(r) === billKey(row))) return NextResponse.json({ error: 'This account already has an entry for that bill type and month.' }, { status: 409 });
    const { error } = await auth.supabase.from('phone_bill_entries').insert({ entry_key: billKey(row), period: billPeriod(row), row_data: row, created_by: auth.user.id });
    if (error) return NextResponse.json({ error: error.code === '23505' ? 'This monthly account entry already exists.' : error.code === 'P0001' ? 'This month already has an issued statement. Entries are locked to preserve the statement.' : 'Unable to save the entry.' }, { status: error.code === '23505' || error.code === 'P0001' ? 409 : 500 });
    return NextResponse.json({ row }, { status: 201 });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to save.' }, { status: 503 }); }
}

export async function PATCH(request: Request) {
  const auth = await phoneBillAuth(request, true);
  if ('error' in auth) return auth.error;
  const body = await request.json().catch(() => null);
  let row;
  try { row = cleanBillRow(body?.row); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : 'Invalid entry.' }, { status: 400 }); }
  if (body?.key !== billKey(row)) return NextResponse.json({ error: 'Keep the month, bill type and account unchanged when editing. Add a new entry for a different account.' }, { status: 400 });
  try {
    if (!(await allPhoneRows(auth.supabase)).some(r => billKey(r) === body.key)) return NextResponse.json({ error: 'Entry not found.' }, { status: 404 });
    const { error } = await auth.supabase.from('phone_bill_entries').upsert({ entry_key: billKey(row), period: billPeriod(row), row_data: row, created_by: auth.user.id }, { onConflict: 'entry_key' });
    if (error) return NextResponse.json({ error: error.code === 'P0001' ? 'This month already has an issued statement. Entries are locked to preserve it.' : 'Unable to update entry.' }, { status: error.code === 'P0001' ? 409 : 500 });
    return NextResponse.json({ row });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to save.' }, { status: 503 }); }
}
