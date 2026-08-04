import { NextResponse } from 'next/server';
import { buildDailyOperationsDigest, normalizeDigestBlocks } from '@/lib/email/daily-operations';
import { renderEmail } from '@/lib/email/render';
import { requireEmailUser } from '../../_auth';

function todayInIndia() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

export async function POST(request: Request) {
  const auth = await requireEmailUser(request);
  if ('error' in auth) return auth.error;

  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const date = typeof body?.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.date)
    ? body.date
    : todayInIndia();
  const currentPage = typeof body?.currentPage === 'string' && body.currentPage.startsWith('/')
    ? body.currentPage
    : '/email-composer';
  const note = typeof body?.note === 'string' ? body.note.trim() : '';

  const payload = await buildDailyOperationsDigest({
    supabase: auth.supabase,
    date,
    blocks: normalizeDigestBlocks(body?.blocks),
    currentPage,
    note,
  });
  const rendered = renderEmail(payload);

  return NextResponse.json({
    payload,
    subject: rendered.subject,
    text: rendered.text,
    html: rendered.html,
  });
}
