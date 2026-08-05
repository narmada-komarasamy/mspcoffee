import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const response = NextResponse.redirect(new URL('/login', request.url));
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
