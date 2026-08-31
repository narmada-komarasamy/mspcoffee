/**
 * Next.js 16 Proxy (formerly middleware).
 * Redirects unauthenticated users to /login.
 * Auth is tracked via the msp_auth cookie set on PIN login.
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const PUBLIC_ROUTES = [
  '/login',
  '/forgot-password',
  '/reset-password',
  '/accept-invite',
  '/auth/callback',
  '/premiumshowcase',
];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isLocalFamilyDecisionPreview = process.env.NODE_ENV === 'development' && pathname === '/family-decisions';
  const isPublic = isLocalFamilyDecisionPreview || PUBLIC_ROUTES.some(r => pathname.startsWith(r));
  const isStatic = pathname.startsWith('/api/') ||
                   /\.(?:svg|png|jpg|jpeg|gif|webp|ico|mp4|m4a|woff2?)$/.test(pathname);

  if (isPublic || isStatic) {
    return NextResponse.next({ request });
  }

  // Check for PIN login session cookie
  const isLoggedIn = request.cookies.has('msp_auth');

  if (!isLoggedIn) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirectTo', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next({ request });
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
