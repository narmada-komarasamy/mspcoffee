import { NextResponse } from 'next/server';
import { hoFuelAuth } from '@/lib/ho-fuel-server';
import { hoFuelToday, parseFuelDate, formatFuelDate } from '@/lib/ho-fuel';
import { UUID_RE } from '@/lib/auth/api';
export async function POST(request: Request) {
  const auth = await hoFuelAuth(request, true);
  if ('error' in auth) return auth.error;
  const body = await request.json().catch(() => null);
  if (!body || body.reviewed !== true || !Array.isArray(body.bill_ids) || body.bill_ids.length < 1 || body.bill_ids.length > 10 || body.bill_ids.some((id: unknown) => typeof id !== 'string' || !UUID_RE.test(id)) || new Set(body.bill_ids).size !== body.bill_ids.length)
    return NextResponse.json({ error: 'Attach at least one bill and confirm the purchase details before saving.' }, { status: 400 });
  if (typeof body.date !== 'string' || !parseFuelDate(formatFuelDate(body.date)) || body.date > hoFuelToday() || !['DIESEL','PETROL'].includes(body.fuel_type) || typeof body.source !== 'string' || !body.source.trim() || !Number.isFinite(body.qty_l) || body.qty_l <= 0 || !Number.isFinite(body.amount) || body.amount <= 0)
    return NextResponse.json({ error: 'Enter a valid date, supplier, fuel type, positive quantity and total cost.' }, { status: 400 });
  const result = await auth.supabase.rpc('save_ho_fuel_purchase', { p_user: auth.user.id, p_bill_ids: body.bill_ids, p_entry: { date: body.date, source: body.source.trim().slice(0,500), fuel_type: body.fuel_type, qty_l: body.qty_l, amount: body.amount, mode_of_payment: String(body.mode_of_payment || '').slice(0,200), remarks: String(body.remarks || '').slice(0,2000) } });
  if (result.error) return NextResponse.json({ error: 'Purchase was not saved. Check that its bills have not already been used, then retry.' }, { status: 409 });
  return NextResponse.json({ id: result.data }, { status: 201 });
}
