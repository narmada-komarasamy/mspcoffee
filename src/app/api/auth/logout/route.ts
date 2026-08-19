import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

function expireSessionCookies(response: NextResponse) {
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
}

export async function POST() {
  const supabase = await createClient();
  await supabase.auth.signOut();

  const response = NextResponse.json({ ok: true });
  expireSessionCookies(response);
  return response;
}

export async function GET() {
  const response = NextResponse.redirect('/login');
  expireSessionCookies(response);
  return response;
}

