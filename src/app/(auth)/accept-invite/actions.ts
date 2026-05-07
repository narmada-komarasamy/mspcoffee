'use server';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export async function acceptInvite(formData: FormData) {
  const name     = (formData.get('name')     as string).trim();
  const password = formData.get('password')  as string;
  const confirm  = formData.get('confirm')   as string;

  if (!name) {
    redirect('/accept-invite?error=missing_name');
  }
  if (!password || password.length < 8) {
    redirect('/accept-invite?error=too_short');
  }
  if (password !== confirm) {
    redirect('/accept-invite?error=mismatch');
  }

  const supabase = await createClient();

  const { error: updateError } = await supabase.auth.updateUser({
    password,
    data: { name },
  });

  if (updateError) {
    redirect('/accept-invite?error=update_failed');
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    await supabase
      .from('profiles')
      .update({ name, must_change_password: false })
      .eq('id', user.id);
  }

  redirect('/rainfall');
}
