import { NextResponse } from 'next/server';
import { userGuideAuth } from '@/lib/user-guide-auth';
import { USER_GUIDES } from '@/lib/user-guides';
export async function GET(request: Request) {
  const checks = await Promise.all(USER_GUIDES.map(guide => userGuideAuth(request, guide.id)));
  for (const auth of checks) {
    if ('error' in auth && auth.error.status !== 403) return auth.error;
  }
  const guides = USER_GUIDES.filter((_guide,index) => !('error' in checks[index]));
  return NextResponse.json({ guides }, { headers: { 'Cache-Control': 'private, no-store' } });
}
