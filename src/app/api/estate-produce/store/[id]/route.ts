import { NextResponse } from 'next/server';
import {
  ESTATE_PRODUCE_RECORD_ID_RE,
  STORE_STATUSES,
  badRequest,
  estateProduceSetupError,
  nullableText,
  requireEstateProduceUser,
  text,
} from '../../_helpers';

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!ESTATE_PRODUCE_RECORD_ID_RE.test(id)) return badRequest('Invalid store item id');

  const auth = await requireEstateProduceUser(request);
  if ('error' in auth) return auth.error;

  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body) return badRequest('Store item details are required');

  const { data: before, error: beforeError } = await auth.supabase
    .from('produce_store_items')
    .select('id, status, storage_location')
    .eq('id', id)
    .single<{ id: string; status: string | null; storage_location: string | null }>();

  if (beforeError) return NextResponse.json({ error: estateProduceSetupError(beforeError.message) }, { status: 500 });
  if (!before) return NextResponse.json({ error: 'Store item was not found' }, { status: 404 });

  const status = text(body.status);
  if (status && !STORE_STATUSES.includes(status)) return badRequest('Choose a valid store status');

  const payload: Record<string, unknown> = { updated_by: auth.user.id };
  if (status) payload.status = status;
  if (Object.hasOwn(body, 'storageLocation')) payload.storage_location = nullableText(body.storageLocation);
  if (Object.hasOwn(body, 'conditionGrade')) payload.condition_grade = nullableText(body.conditionGrade);
  if (Object.hasOwn(body, 'notes')) payload.notes = nullableText(body.notes);

  const { data, error } = await auth.supabase
    .from('produce_store_items')
    .update(payload)
    .eq('id', id)
    .select('id')
    .single<{ id: string }>();

  if (error) return NextResponse.json({ error: estateProduceSetupError(error.message) }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'Store item was not found' }, { status: 404 });

  const nextLocation = Object.hasOwn(body, 'storageLocation') ? nullableText(body.storageLocation) : before.storage_location;
  const movementType = status && status !== before.status ? 'Status Change' : 'Location Change';

  await auth.supabase.from('produce_store_movements').insert([{
    store_item_id: id,
    movement_type: movementType,
    from_status: before.status,
    to_status: status || before.status,
    from_location: before.storage_location,
    to_location: nextLocation,
    notes: nullableText(body.movementNotes) || null,
    actor_id: auth.user.id,
    actor_name: auth.user.name,
  }]);

  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!ESTATE_PRODUCE_RECORD_ID_RE.test(id)) return badRequest('Invalid store item id');

  const auth = await requireEstateProduceUser(request);
  if ('error' in auth) return auth.error;

  const { data, error } = await auth.supabase
    .from('produce_store_items')
    .delete()
    .eq('id', id)
    .select('id')
    .single<{ id: string }>();

  if (error) return NextResponse.json({ error: estateProduceSetupError(error.message) }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'Store item was not found. Refresh and try again.' }, { status: 404 });

  return NextResponse.json({ ok: true });
}
