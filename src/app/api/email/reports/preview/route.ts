import { NextResponse } from 'next/server';
import { buildRecipientReportPayload, normalizeRecipients, normalizeTemplate } from '@/lib/email/report-builder';
import { renderEmail } from '@/lib/email/render';
import { getEmailProviderConfig } from '@/lib/email/provider';
import { requireEmailUser } from '../../_auth';
import { checkRateLimit, rateLimitKey } from '@/lib/auth/rate-limit';

export async function POST(request: Request) {
  const auth = await requireEmailUser(request);
  if ('error' in auth) return auth.error;

  const limited = checkRateLimit({
    key: rateLimitKey('email-report-preview', auth.user.id),
    limit: 60,
    windowMs: 60 * 60 * 1000,
  });
  if ('error' in limited) return limited.error;

  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const template = normalizeTemplate(body?.template);
  const recipients = normalizeRecipients(body?.recipients);

  if (recipients.length === 0) {
    return NextResponse.json({ error: 'Add at least one valid recipient' }, { status: 400 });
  }

  const previews = recipients.map((recipient) => {
    const payload = buildRecipientReportPayload(template, recipient);
    const rendered = renderEmail(payload);
    return {
      recipient,
      payload,
      subject: rendered.subject,
      text: rendered.text,
      html: rendered.html,
    };
  });

  return NextResponse.json({
    from: getEmailProviderConfig().from,
    template,
    previews,
  });
}
