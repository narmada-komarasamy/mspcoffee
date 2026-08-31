import { NextResponse } from 'next/server';
import { requireApiUser } from '@/lib/auth/api';

const BUCKET_ROLES: Record<string, string[]> = {
  'board-meetings': ['admin', 'supervisor', 'ceo'],
  'estate-staff-meetings': ['admin', 'supervisor', 'ceo'],
  'employee-center': ['admin', 'hr', 'supervisor'],
  invoices: ['admin', 'supervisor', 'ceo'],
  'travel-allowance-receipts': ['admin'],
};

function cleanPath(value: string | null) {
  const path = value?.trim() ?? '';
  if (!path || path.startsWith('/') || path.includes('\0') || path.split('/').includes('..')) return '';
  return path;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const bucket = url.searchParams.get('bucket')?.trim() ?? '';
  const path = cleanPath(url.searchParams.get('path'));
  const roles = BUCKET_ROLES[bucket];

  if (!roles || !path) {
    return NextResponse.json({ error: 'Invalid storage file request' }, { status: 400 });
  }

  const auth = await requireApiUser(request, roles);
  if ('error' in auth) return auth.error;

  const { data, error } = await auth.supabase.storage
    .from(bucket)
    .createSignedUrl(path, 5 * 60);

  if (error || !data?.signedUrl) {
    return NextResponse.json({ error: 'Could not create signed file URL' }, { status: 404 });
  }

  return NextResponse.redirect(data.signedUrl, {
    status: 302,
    headers: {
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
