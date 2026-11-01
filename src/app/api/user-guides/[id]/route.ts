import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { NextResponse } from 'next/server';
import { courierAuth } from '../../courier/_auth';
import { USER_GUIDES } from '@/lib/user-guides';
export const runtime = 'nodejs';
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await courierAuth(request);
  if ('error' in auth) return auth.error;
  const { id } = await context.params;
  if (!USER_GUIDES.some(guide => guide.id === id)) return NextResponse.json({ error: 'Guide not found.' }, { status: 404 });
  const url = new URL(request.url), page = url.searchParams.get('page');
  if (page !== null && page !== '1' && page !== '2') return NextResponse.json({ error: 'Page not found.' }, { status: 404 });
  const file = page ? `courier-guide-page-${page}.png` : 'MSP_Coffee_Approved_Cream_Guide.pdf';
  try {
    const bytes = await readFile(path.join(process.cwd(), 'docs/instruction-guides', file));
    return new NextResponse(bytes, { headers: {
      'Content-Type': page ? 'image/png' : 'application/pdf',
      'Content-Disposition': `${url.searchParams.get('download') === '1' ? 'attachment' : 'inline'}; filename="${file}"`,
      'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff',
    } });
  } catch {
    return NextResponse.json({ error: 'The guide is temporarily unavailable. Please try again.' }, { status: 503 });
  }
}
