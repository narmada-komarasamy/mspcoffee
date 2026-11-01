import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { NextResponse } from 'next/server';
import { userGuideAuth } from '@/lib/user-guide-auth';
import { USER_GUIDES } from '@/lib/user-guides';
export const runtime = 'nodejs';
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const guide = USER_GUIDES.find(guide => guide.id === id);
  if (!guide) return NextResponse.json({ error: 'Guide not found.' }, { status: 404 });
  const auth = await userGuideAuth(request,id);
  if ('error' in auth) return auth.error;
  const url = new URL(request.url), page = url.searchParams.get('page');
  if (page !== null && (!/^[1-9]\d*$/.test(page) || Number(page) > guide.pages)) return NextResponse.json({ error: 'Page not found.' }, { status: 404 });
  const file = page ? `${guide.pagePrefix}-${page}.png` : guide.pdfFile;
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
