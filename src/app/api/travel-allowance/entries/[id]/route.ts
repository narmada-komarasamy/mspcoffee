import { NextResponse } from 'next/server';
import { adminClient } from '@/lib/supabase/admin';

type AppUserRow = {
  role: string;
  pin: string;
  active: boolean | null;
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const userId = request.headers.get('x-msp-user-id')?.trim();
  const userPin = request.headers.get('x-msp-user-pin')?.trim();

  if (!UUID_RE.test(id) || !userId || !userPin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = adminClient();
  const { data: user, error: userError } = await supabase
    .from('app_users')
    .select('role, pin, active')
    .eq('id', userId)
    .single<AppUserRow>();

  if (userError || !user || user.role !== 'admin' || user.pin !== userPin || user.active === false) {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  const { error } = await supabase
    .from('travel_allowance_entries')
    .delete()
    .eq('id', id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
