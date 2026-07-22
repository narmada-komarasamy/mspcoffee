import { NextResponse } from 'next/server';
import { nullableDateOrTime, requireBoardMeetingUser, stringValue } from '../_auth';

const priorityValues = ['low', 'medium', 'high', 'critical'];

export async function POST(request: Request) {
  const auth = await requireBoardMeetingUser(request);
  if ('error' in auth) return auth.error;

  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const meetingId = stringValue(body?.meetingId);
  const actionText = stringValue(body?.action_text);
  const assignedTo = stringValue(body?.assigned_to);
  const priority = stringValue(body?.priority) || 'medium';

  if (!meetingId || !actionText || !assignedTo) {
    return NextResponse.json({ error: 'Meeting, action and assigned owner are required' }, { status: 400 });
  }

  const { error } = await auth.supabase.from('board_meeting_actions').insert([{
    meeting_id: meetingId,
    action_text: actionText,
    assigned_to: assignedTo,
    due_date: nullableDateOrTime(body?.due_date),
    priority: priorityValues.includes(priority) ? priority : 'medium',
    status: 'open',
    progress: 0,
  }]);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true }, { status: 201 });
}
