import { NextResponse } from 'next/server';
import { requireTravelAllowanceUser } from '../../_auth';

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: rawId } = await params;
  const id = decodeURIComponent(rawId).trim();
  if (!id) {
    return NextResponse.json({ error: 'Invalid employee id' }, { status: 400 });
  }

  const auth = await requireTravelAllowanceUser(request, ['admin']);
  if ('error' in auth) return auth.error;

  const { data, error } = await auth.supabase
    .from('travel_allowance_employees')
    .delete()
    .eq('id', id)
    .select('id')
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
