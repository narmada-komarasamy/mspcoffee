import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// Handles Supabase email callbacks (password reset, invite).
// Supabase sends users here with ?code=XXX after they click an email link.
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const type = searchParams.get('type'); // 'recovery' | 'invite' | undefined

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      const redirectPath = type === 'invite' ? '/accept-invite' : '/reset-password';
      const response = NextResponse.redirect(`${origin}${redirectPath}`);
      response.cookies.set('msp_auth', '1', {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        path: '/',
        maxAge: 60 * 60 * 24 * 7,
      });
      if (type === 'invite') {
        return response;
      }
      return response;
    }
  }

  return NextResponse.redirect(`${origin}/login?error=link_expired`);
}
