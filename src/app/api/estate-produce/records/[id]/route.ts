import { NextResponse } from 'next/server';
import {
  UUID_RE,
  badRequest,
  buildRecordPayload,
  mapRecord,
  recordSelect,
  requireEstateProduceUser,
} from '../../_helpers';

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID_RE.test(id)) return badRequest('Invalid record id');

  const auth = await requireEstateProduceUser(request);
  if ('error' in auth) return auth.error;

  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body) return badRequest('Entry details are required');

  const built = buildRecordPayload(body, auth.user.id, auth.user.name, true);
  if ('error' in built) return badRequest(built.error);

  const { data, error } = await auth.supabase
    .from('estate_produce_records')
    .update(built.payload)
    .eq('id', id)
    .select(recordSelect())
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ record: mapRecord(data) });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID_RE.test(id)) return badRequest('Invalid record id');

  const auth = await requireEstateProduceUser(request, ['admin']);
  if ('error' in auth) return auth.error;

  const { data: record } = await auth.supabase
    .from('estate_produce_records')
    .select('photo_path')
    .eq('id', id)
    .single<{ photo_path: string | null }>();

  const { error } = await auth.supabase
    .from('estate_produce_records')
    .delete()
    .eq('id', id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (record?.photo_path) {
    await auth.supabase.storage.from('estate-produce').remove([record.photo_path]);
  }

  return NextResponse.json({ ok: true });
}
