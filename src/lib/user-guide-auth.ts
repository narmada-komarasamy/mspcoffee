import { NextResponse } from 'next/server';
import { courierAuth } from '@/app/api/courier/_auth';
import { fleetAuth } from '@/lib/fleet/auth';

export async function userGuideAuth(request: Request, id: string) {
  if (id === 'courier-tracking') return courierAuth(request);
  if (id === 'fleet-fuel') return fleetAuth(request, false);
  return {error:NextResponse.json({error:'Guide not found.'},{status:404})};
}
