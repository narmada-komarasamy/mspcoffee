/**
 * Next.js 16 Proxy (formerly middleware).
 * Responsibilities:
 *   1. Refresh the Supabase session cookie on every request.
 *   2. Redirect unauthenticated users away from protected routes → /login
 *   3. Redirect already-authenticated users away from auth pages → /rainfall
 *
 * Role checks are NOT done here — they live in page-level requireRole() calls,
 * which avoids the cost of an extra DB query on every request.
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

/** Route segments that require an authenticated session. */
const PROTECTED_SEGMENTS = [
  '/rainfall',
  '/fuel-expenses',
  '/ho-fuel',
  '/daily-report',
  '/muster-roll',
  '/harvest-yield',
  '/labour-costs',
  '/nursery',
  '/spraying-log',
  '/vehicle-log',
  '/store-inventory',
  '/shopify-orders',
  '/weather',
  '/ai-insights',
  '/admin',
  '/account',
];

/** Auth routes that logged-in users should not see. */
const AUTH_ROUTES = ['/login', '/forgot-password', '/accept-invite'];

function isProtected(pathname: string): boolean {
  return PROTECTED_SEGMENTS.some(
    (seg) => pathname === seg || pathname.startsWith(seg + '/')
  );
}

function isAuthRoute(pathname: string): boolean {
  // /reset-password with a recovery token in query is allowed even when logged in
  if (pathname.startsWith('/reset-password')) return false;
  return AUTH_ROUTES.some(
    (r) => pathname === r || pathname.startsWith(r + '/')
  );
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Build a mutable response so the Supabase cookie adapter can write
  // updated session tokens back to the browser.
  let response = NextResponse.next({
    request,
  });

  // Create a Supabase client that reads/writes cookies on the
  // request/response pair (the official @supabase/ssr proxy pattern).
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          // Write cookies to request (so downstream server code sees them)
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          // Rebuild response with updated request cookies
          response = NextResponse.next({ request });
          // Write cookies to response (so browser stores them)
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // IMPORTANT: call getUser() — not getSession() — to validate the JWT
  // server-side. This also refreshes the token cookie if needed.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Redirect unauthenticated users away from protected routes
  if (!user && isProtected(pathname)) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('next', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Redirect authenticated users away from auth pages
  if (user && isAuthRoute(pathname)) {
    return NextResponse.redirect(new URL('/rainfall', request.url));
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all paths except:
     * - _next/static  (static assets)
     * - _next/image   (image optimisation)
     * - favicon.ico
     * - public folder files (images, etc.)
     */
    '/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
