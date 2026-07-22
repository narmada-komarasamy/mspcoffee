import { NextResponse } from 'next/server';
import { requireEstateStaffMeetingUser } from '../_auth';

type Ctx = { params: Promise<{ id: string }> };

export async function DELETE(request: Request, ctx: Ctx) {
  const auth = await requireEstateStaffMeetingUser(request, ['admin']);
  if ('error' in auth) return auth.error;

  const { id } = await ctx.params;
  const { error } = await auth.supabase
    .from('estate_staff_meetings')
    .delete()
    .eq('id', id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
