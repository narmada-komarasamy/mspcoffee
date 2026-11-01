import { NextResponse } from 'next/server';
import { courierAuth } from '../courier/_auth';
import { USER_GUIDES } from '@/lib/user-guides';
export async function GET(request: Request) {
  const auth = await courierAuth(request);
  if ('error' in auth) {
    if (auth.error.status === 403) return NextResponse.json({ guides: [] }, { headers: { 'Cache-Control': 'private, no-store' } });
    return auth.error;
  }
  return NextResponse.json({ guides: USER_GUIDES }, { headers: { 'Cache-Control': 'private, no-store' } });
}
