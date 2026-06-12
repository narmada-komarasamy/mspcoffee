import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

// Routes that don't require authentication
const PUBLIC_ROUTES = [
  '/login',
  '/forgot-password',
  '/reset-password',
  '/accept-invite',
  '/auth/callback',
];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public routes and static assets through without auth check
  const isPublic = PUBLIC_ROUTES.some(r => pathname.startsWith(r));
  const isStatic = pathname.startsWith('/_next') ||
                   pathname.startsWith('/api/auth') ||
                   pathname.includes('.');

  if (isPublic || isStatic) {
    return NextResponse.next();
  }

  // Build a response to potentially set refreshed session cookies on
  const response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value);
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  // getUser() validates the session with Supabase — never trust only the cookie
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    // Preserve the intended destination so we can redirect back after login
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirectTo', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return response;
}

export const config = {
  // Run on all routes except Next.js internals and static files
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
