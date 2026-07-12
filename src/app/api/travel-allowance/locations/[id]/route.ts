import { NextResponse } from 'next/server';
import { UUID_RE, requireTravelAllowanceUser } from '../../_auth';

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: 'Invalid location id' }, { status: 400 });
  }

  const auth = await requireTravelAllowanceUser(request, ['admin']);
  if ('error' in auth) return auth.error;

  const { error } = await auth.supabase
    .from('travel_allowance_locations')
    .delete()
    .eq('id', id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
