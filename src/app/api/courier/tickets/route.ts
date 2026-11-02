import { NextResponse } from 'next/server';
import { UUID_RE } from '@/lib/auth/api';
import { COURIER_START_DATE } from '@/lib/courier';
import { courierAuth } from '../_auth';

export async function GET(request: Request) {
  const auth = await courierAuth(request); if ('error' in auth) return auth.error;
  const tickets = [];
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await auth.supabase.from('courier_tickets').select('*').order('updated_at', { ascending: false }).order('id').range(offset, offset + 499);
    if (error) return NextResponse.json({ error: 'Unable to load follow-up tickets.' }, { status: 503 });
    tickets.push(...data); if (data.length < 500) break;
  }
  return NextResponse.json({ tickets }, { headers: { 'Cache-Control': 'private, no-store' } });
}

export async function POST(request: Request) {
  const auth = await courierAuth(request, true); if ('error' in auth) return auth.error;
  try {
    const body = await request.json();
    if (typeof body.shipmentId !== 'string' || !UUID_RE.test(body.shipmentId)) throw new Error('Choose a saved shipment.');
    const { data: shipment, error: shipmentError } = await auth.supabase.from('courier_shipments').select('id,data').eq('id', body.shipmentId).gte('data->>sent', COURIER_START_DATE).maybeSingle();
    if (shipmentError) return NextResponse.json({ error: 'Unable to verify the shipment.' }, { status: 503 });
    if (!shipment) return NextResponse.json({ error: 'Save the shipment before opening a ticket.' }, { status: 404 });
    // One persistent ticket per shipment makes double-clicks and retried requests safe.
    const { data, error } = await auth.supabase.from('courier_tickets').upsert({ shipment_id: shipment.id, created_by: auth.user.id }, { onConflict: 'shipment_id', ignoreDuplicates: true }).select('*').maybeSingle();
    if (error) return NextResponse.json({ error: 'Unable to open the ticket. Please retry.' }, { status: 503 });
    if (data) return NextResponse.json({ ticket: data });
    const existing = await auth.supabase.from('courier_tickets').select('*').eq('shipment_id', shipment.id).single();
    if (existing.error) return NextResponse.json({ error: 'Unable to load the existing ticket. Please retry.' }, { status: 503 });
    return NextResponse.json({ ticket: existing.data });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Invalid ticket request.' }, { status: 400 });
  }
}
