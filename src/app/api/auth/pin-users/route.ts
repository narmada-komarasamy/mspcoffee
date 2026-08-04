import { NextResponse } from 'next/server';
import { adminClient } from '@/lib/supabase/admin';

type AppUserListRow = {
  id: string;
  name: string;
  role: string;
  estate: string | null;
};

export async function GET() {
  try {
    const supabase = adminClient();
    const { data, error } = await supabase
      .from('app_users')
      .select('id, name, role, estate')
      .neq('active', false)
      .order('name');

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ users: (data ?? []) satisfies AppUserListRow[] });
  } catch {
    return NextResponse.json(
      { error: 'Server login is not configured. Check SUPABASE_SERVICE_ROLE_KEY in Vercel.' },
      { status: 500 }
    );
  }
}
