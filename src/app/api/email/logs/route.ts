import { NextResponse } from 'next/server';
import { requireEmailUser } from '../_auth';

export async function GET(request: Request) {
  const auth = await requireEmailUser(request);
  if ('error' in auth) return auth.error;

  const { searchParams } = new URL(request.url);
  const limit = Math.min(Number(searchParams.get('limit')) || 100, 250);

  const { data, error } = await auth.supabase
    .from('email_delivery_log')
    .select('id, created_at, sent_at, email_type, source_path, subject, from_address, recipients, cc, status, provider, provider_message_id, error_message, note, requested_by')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ rows: data ?? [] });
}
