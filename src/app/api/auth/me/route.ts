import { NextResponse } from 'next/server';
import { requireApiUser } from '@/lib/auth/api';

export async function GET(request: Request) {
  const auth = await requireApiUser(request);
  if ('error' in auth) return auth.error;
  const response = NextResponse.json({ user: auth.user });
  response.cookies.set('msp_auth', '1', {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
  });
  return response;
}
