import { NextResponse } from 'next/server';
import {
  DATE_RE,
  requireOperationsCalendarUser,
} from './_auth';
import { buildCalendarEventPayload, eventTypes } from './_payload';

export async function GET(request: Request) {
  const auth = await requireOperationsCalendarUser(request);
  if ('error' in auth) return auth.error;

  const { searchParams } = new URL(request.url);
  const start = searchParams.get('start');
  const end = searchParams.get('end');
  const eventType = searchParams.get('type');

  let query = auth.supabase
    .from('operations_calendar_events')
    .select('*')
    .order('event_date', { ascending: true })
    .order('start_time', { ascending: true, nullsFirst: false });

  if (start && DATE_RE.test(start)) query = query.gte('event_date', start);
  if (end && DATE_RE.test(end)) query = query.lte('event_date', end);
  if (eventType && eventTypes.includes(eventType)) query = query.eq('event_type', eventType);

  const { data, error } = await query.limit(500);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ events: data ?? [] });
}

export async function POST(request: Request) {
  const auth = await requireOperationsCalendarUser(request);
  if ('error' in auth) return auth.error;

  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Calendar event payload is required' }, { status: 400 });
  }

  const built = buildCalendarEventPayload(body, auth.user.id);
  if ('error' in built) return NextResponse.json({ error: built.error }, { status: 400 });

  const { data, error } = await auth.supabase
    .from('operations_calendar_events')
    .insert([built.payload])
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ event: data }, { status: 201 });
}
