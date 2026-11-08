import { NextResponse } from 'next/server';
import { requireEmailUser } from '../_auth';
import { rememberedEmails } from '@/lib/email/contacts';

export async function GET(request: Request) {
  const auth = await requireEmailUser(request);
  if ('error' in auth) return auth.error;
  const { data, error } = await auth.supabase.from('email_delivery_log')
    .select('recipients,cc').eq('requested_by', auth.user.id)
    .in('status', ['sent', 'logged']).order('created_at', { ascending: false }).limit(500);
  if (error) return NextResponse.json({ error: 'Saved email addresses could not be loaded.' }, { status: 503 });
  return NextResponse.json({ addresses: rememberedEmails(data || []) }, { headers: { 'Cache-Control': 'private, no-store' } });
}
