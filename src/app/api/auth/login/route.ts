import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  const { email, password } = await request.json();

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
  }

  // Supabase server client writes the session via Set-Cookie headers on this
  // response — the browser stores them as proper HTTP cookies and sends them
  // on every subsequent request, including the next navigation to /rainfall.
  return NextResponse.json({ ok: true });
}
