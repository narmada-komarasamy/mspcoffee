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
      if (type === 'invite') {
        return NextResponse.redirect(`${origin}/accept-invite`);
      }
      // recovery or any other type
      return NextResponse.redirect(`${origin}/reset-password`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=link_expired`);
}
