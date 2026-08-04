import { NextResponse } from 'next/server';
import { adminClient } from '@/lib/supabase/admin';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{12}$/i;

type AppUserRow = {
  id: string;
  name: string;
  pin: string;
  role: string;
  estate: string | null;
  active: boolean | null;
};

function sessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
  };
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as { userId?: unknown; pin?: unknown } | null;
  const userId = typeof body?.userId === 'string' ? body.userId.trim() : '';
  const pin = typeof body?.pin === 'string' ? body.pin.trim() : '';

  if (!userId || !pin || !UUID_RE.test(userId)) {
    return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
  }

  const supabase = adminClient();
  const { data: user, error } = await supabase
    .from('app_users')
    .select('id, name, pin, role, estate, active')
    .eq('id', userId)
    .single<AppUserRow>();

  if (error || !user || user.pin !== pin || user.active === false) {
    return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
  }

  const response = NextResponse.json({
    user: {
      id: user.id,
      name: user.name,
      pin: user.pin,
      role: user.role,
      estate: user.estate,
    },
  });

  const options = sessionCookieOptions();
  response.cookies.set('msp_auth', '1', options);
  response.cookies.set('msp_user_id', user.id, options);
  response.cookies.set('msp_user_pin', user.pin, options);

  return response;
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  const expired = {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    expires: new Date(0),
  };

  response.cookies.set('msp_auth', '', expired);
  response.cookies.set('msp_user_id', '', expired);
  response.cookies.set('msp_user_pin', '', expired);

  return response;
}
