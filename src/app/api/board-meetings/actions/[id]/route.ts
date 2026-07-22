import { NextResponse } from 'next/server';
import { requireBoardMeetingUser, stringValue } from '../../_auth';

type Ctx = { params: Promise<{ id: string }> };

const statusValues = ['open', 'in-progress', 'blocked', 'completed'];

export async function PATCH(request: Request, ctx: Ctx) {
  const auth = await requireBoardMeetingUser(request);
  if ('error' in auth) return auth.error;

  const { id } = await ctx.params;
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const status = stringValue(body?.status);
  const progress = Number(body?.progress);

  if (!statusValues.includes(status)) {
    return NextResponse.json({ error: 'Invalid action status' }, { status: 400 });
  }

  const { error } = await auth.supabase
    .from('board_meeting_actions')
    .update({ status, progress: Number.isFinite(progress) ? Math.max(0, Math.min(100, progress)) : undefined })
    .eq('id', id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
