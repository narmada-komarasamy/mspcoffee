import { NextResponse } from 'next/server';
import { getEmailProviderConfig } from '@/lib/email/provider';
import { requireEmailUser } from '../_auth';

export async function GET(request: Request) {
  const auth = await requireEmailUser(request);
  if ('error' in auth) return auth.error;

  const config = getEmailProviderConfig();

  return NextResponse.json({
    provider: config.provider,
    from: config.from,
    configured: config.configured,
  });
}
