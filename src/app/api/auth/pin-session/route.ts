import { NextResponse } from 'next/server';

function expiredCookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    expires: new Date(0),
  };
}

export async function POST() {
  return NextResponse.json(
    { error: 'PIN login has moved to Supabase Auth. Sign in with email and password.' },
    { status: 410 }
  );
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  const expired = expiredCookieOptions();
  response.cookies.set('msp_auth', '', expired);
  response.cookies.set('msp_user_id', '', expired);
  response.cookies.set('msp_user_pin', '', expired);
  return response;
}

