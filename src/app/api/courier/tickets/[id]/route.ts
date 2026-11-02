import { NextResponse } from 'next/server';
import { UUID_RE } from '@/lib/auth/api';
import { ticketFields, type CourierTicket } from '@/lib/courier-tickets';
import { courierAuth } from '../../_auth';

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await courierAuth(request, true); if ('error' in auth) return auth.error;
  try {
    const { id } = await context.params;
    if (!UUID_RE.test(id)) throw new Error('Invalid ticket identifier.');
    const body = await request.json();
    if (!Number.isSafeInteger(body.revision) || body.revision < 1) throw new Error('Reload the ticket before saving.');
    const fields = ticketFields(body);
    const { data, error } = await auth.supabase.from('courier_tickets').select('*').eq('id', id).maybeSingle();
    if (error) return NextResponse.json({ error: 'Unable to load this ticket.' }, { status: 503 });
    if (!data) return NextResponse.json({ error: 'Ticket not found.' }, { status: 404 });
    const previous = data as CourierTicket;
    if (previous.revision !== body.revision) return NextResponse.json({ error: 'This ticket changed in another session. Close and reopen it before saving.' }, { status: 409 });
    const at = new Date().toISOString();
    const { note, ...saved } = fields;
    const history = [...previous.history, { at, actor: auth.user.id, status: saved.status, owner: saved.owner, nextFollowup: saved.next_followup, problem: saved.problem, note }];
    const result = await auth.supabase.from('courier_tickets').update({ ...saved, history, revision: previous.revision + 1, updated_at: at }).eq('id', id).eq('revision', body.revision).select('*').maybeSingle();
    if (result.error) return NextResponse.json({ error: 'Unable to save the ticket. Your changes remain in the form.' }, { status: 503 });
    if (!result.data) return NextResponse.json({ error: 'This ticket changed in another session. Close and reopen it before saving.' }, { status: 409 });
    return NextResponse.json({ ticket: result.data });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Invalid ticket details.' }, { status: 400 });
  }
}
