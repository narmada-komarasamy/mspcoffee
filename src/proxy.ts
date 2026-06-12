/**
 * Next.js 16 Proxy (formerly middleware).
 * Responsibilities:
 * 1. Refresh the Supabase session cookie on every request.
 * 2. Redirect unauthenticated users to /login.
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

const PUBLIC_ROUTES = [
  '/login',
  '/forgot-password',
  '/reset-password',
  '/accept-invite',
  '/auth/callback',
];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Let public routes and static assets through immediately
  const isPublic = PUBLIC_ROUTES.some(r => pathname.startsWith(r));
  const isStatic = pathname.startsWith('/api/auth') ||
                   /\.(?:svg|png|jpg|jpeg|gif|webp|ico|mp4|m4a|woff2?)$/.test(pathname);

  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Always refresh the session cookie
  const { data: { user } } = await supabase.auth.getUser();

  // Redirect unauthenticated users to login (except public/static routes)
  if (!user && !isPublic && !isStatic) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirectTo', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
