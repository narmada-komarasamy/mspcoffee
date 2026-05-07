'use server';

import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';

export async function sendResetEmail(formData: FormData) {
  const email = (formData.get('email') as string).trim();

  if (!email) {
    redirect('/forgot-password?error=missing_email');
  }

  const headerStore = await headers();
  const origin = headerStore.get('origin') ?? '';

  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/auth/callback?type=recovery`,
  });

  // Always redirect to sent — never confirm whether an email exists.
  redirect('/forgot-password?sent=true');
}
