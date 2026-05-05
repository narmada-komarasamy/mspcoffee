'use server';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export async function signIn(formData: FormData) {
  const email    = (formData.get('email')    as string).trim();
  const password = formData.get('password')  as string;
  const next     = (formData.get('next')     as string) || '/rainfall';

  if (!email || !password) {
    redirect(`/login?error=missing_fields&next=${encodeURIComponent(next)}`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    redirect(`/login?error=invalid_credentials&next=${encodeURIComponent(next)}`);
  }

  redirect(next);
}
