'use server';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export async function updatePassword(formData: FormData) {
  const password = formData.get('password') as string;
  const confirm  = formData.get('confirm')  as string;

  if (!password || password.length < 8) {
    redirect('/reset-password?error=too_short');
  }
  if (password !== confirm) {
    redirect('/reset-password?error=mismatch');
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });

  if (error) {
    redirect('/reset-password?error=update_failed');
  }

  // Clear the must_change_password flag if set.
  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    await supabase
      .from('profiles')
      .update({ must_change_password: false })
      .eq('id', user.id);
  }

  redirect('/rainfall');
}
