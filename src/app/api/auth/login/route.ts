import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';

export async function POST(request: Request) {
  const { email, password } = await request.json();

  // Collect cookies that Supabase wants to set, then stamp them directly onto
  // the NextResponse we return. This is more reliable than going via
  // next/headers cookieStore.set() which doesn't automatically attach to the
  // response object in Next.js 16 Route Handlers.
  const pending: Array<{ name: string; value: string; options: Record<string, unknown> }> = [];

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY!,
    {
      cookies: {
        getAll() { return []; },
        setAll(cookiesToSet) {
          cookiesToSet.forEach((c) => pending.push(c));
        },
      },
    }
  );

  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });

  // Stamp every session cookie onto the response so the browser stores them
  // as proper HTTP cookies and sends them on the next navigation request.
  pending.forEach(({ name, value, options }) => {
    response.cookies.set(name, value, options as Parameters<typeof response.cookies.set>[2]);
  });

  return response;
}
