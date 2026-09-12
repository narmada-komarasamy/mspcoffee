import { NextResponse } from 'next/server';
import {
  ESTATE_PRODUCE_RECORD_ID_RE,
  PAYMENT_STATUSES,
  badRequest,
  estateProduceSetupError,
  nullableText,
  requireEstateProduceUser,
  text,
} from '../../_helpers';

type SaleRow = {
  id: string;
  payment_status: string;
  closed_at: string | null;
};

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!ESTATE_PRODUCE_RECORD_ID_RE.test(id)) return badRequest('Invalid sale id');

  const auth = await requireEstateProduceUser(request);
  if ('error' in auth) return auth.error;

  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body) return badRequest('Sale update details are required');

  const { data: before, error: beforeError } = await auth.supabase
    .from('produce_sales')
    .select('id, payment_status, closed_at')
    .eq('id', id)
    .single<SaleRow>();

  if (beforeError) return NextResponse.json({ error: estateProduceSetupError(beforeError.message) }, { status: 500 });
  if (!before) return NextResponse.json({ error: 'Sale was not found' }, { status: 404 });
  if (before.payment_status === 'Paid' && auth.user.role !== 'admin') {
    return NextResponse.json({ error: 'This paid invoice is closed. Only admin can change it.' }, { status: 403 });
  }

  const paymentStatus = text(body.paymentStatus);
  if (paymentStatus && !PAYMENT_STATUSES.includes(paymentStatus)) return badRequest('Choose a valid payment status');

  const payload: Record<string, unknown> = { updated_by: auth.user.id };
  if (paymentStatus) {
    payload.payment_status = paymentStatus;
    payload.closed_at = paymentStatus === 'Paid' ? (before.closed_at || new Date().toISOString()) : null;
  }
  if (Object.hasOwn(body, 'paymentNotes')) payload.payment_notes = nullableText(body.paymentNotes);

  const { data, error } = await auth.supabase
    .from('produce_sales')
    .update(payload)
    .eq('id', id)
    .select('id')
    .single<{ id: string }>();

  if (error) return NextResponse.json({ error: estateProduceSetupError(error.message) }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'Sale was not found' }, { status: 404 });

  return NextResponse.json({ ok: true });
}
