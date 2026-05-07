import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

/**
 * Server Supabase client (Server Components, Server Actions, Route Handlers).
 * Uses Next.js 16 async cookies() API — must be awaited.
 * Do NOT import this in client components.
 */
export async function createClient() {
  // Next.js 16: cookies() is async
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            // setAll called from a Server Component — cookies can only be
            // set in Server Actions / Route Handlers. Safe to ignore here;
            // the middleware (proxy.ts) handles session refresh.
          }
        },
      },
    }
  );
}
