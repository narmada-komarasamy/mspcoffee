import { phoneBillAuth } from '@/lib/phone-bills-server';
import { monthlyPhoneDocument } from '@/lib/phone-bill-email-server';
import { validPeriod } from '@/lib/phone-bills';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const auth = await phoneBillAuth(request);
  if ('error' in auth) return auth.error;
  const period = new URL(request.url).searchParams.get('period');
  if (!validPeriod(period)) return NextResponse.json({ error: 'Select a month and year.' }, { status: 400 });
  try {
    const { pdf } = await monthlyPhoneDocument(auth.supabase, period);
    return new Response(new Uint8Array(pdf), { headers: {
      'Content-Type': 'application/pdf', 'Content-Disposition': `inline; filename="MSP_Phone_Bills_${period.replace('-', '_')}.pdf"`,
      'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff',
    } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to prepare the PDF.' }, { status: 409 });
  }
}
