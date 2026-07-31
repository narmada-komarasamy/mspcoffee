import { NextResponse } from 'next/server';
import { requireOperationsCalendarUser, UUID_RE } from '../_auth';
import { buildCalendarEventPayload } from '../_payload';

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, ctx: Ctx) {
  const auth = await requireOperationsCalendarUser(request);
  if ('error' in auth) return auth.error;

  const { id } = await ctx.params;
  if (!UUID_RE.test(id)) return NextResponse.json({ error: 'Invalid event id' }, { status: 400 });

  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Calendar event payload is required' }, { status: 400 });
  }

  const built = buildCalendarEventPayload(body, auth.user.id, true);
  if ('error' in built) return NextResponse.json({ error: built.error }, { status: 400 });

  const { data, error } = await auth.supabase
    .from('operations_calendar_events')
    .update(built.payload)
    .eq('id', id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ event: data });
}

export async function DELETE(request: Request, ctx: Ctx) {
  const auth = await requireOperationsCalendarUser(request, ['admin', 'supervisor', 'ceo']);
  if ('error' in auth) return auth.error;

  const { id } = await ctx.params;
  if (!UUID_RE.test(id)) return NextResponse.json({ error: 'Invalid event id' }, { status: 400 });

  const { error } = await auth.supabase
    .from('operations_calendar_events')
    .delete()
    .eq('id', id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
