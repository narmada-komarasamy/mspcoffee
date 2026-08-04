import { NextResponse } from 'next/server';
import { adminClient } from '@/lib/supabase/admin';

const APP_USER_ID_RE = /^[A-Za-z0-9_-]{1,128}$/;

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

  if (!userId || !pin || !APP_USER_ID_RE.test(userId)) {
    return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
  }

  let user: AppUserRow | null = null;
  let error: { message?: string } | null = null;

  try {
    const supabase = adminClient();
    const result = await supabase
      .from('app_users')
      .select('id, name, pin, role, estate, active')
      .eq('id', userId)
      .single<AppUserRow>();
    user = result.data;
    error = result.error;
  } catch {
    return NextResponse.json(
      { error: 'Server login is not configured. Check SUPABASE_SERVICE_ROLE_KEY in Vercel.' },
      { status: 500 }
    );
  }

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
