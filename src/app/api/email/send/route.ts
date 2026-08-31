import { NextResponse } from 'next/server';
import { renderEmail } from '@/lib/email/render';
import { EmailDeliveryError, sendEmail } from '@/lib/email/provider';
import { validateEmailPayload } from '@/lib/email/payload';
import { requireEmailUser } from '../_auth';
import { checkRateLimit, rateLimitKey } from '@/lib/auth/rate-limit';

export async function POST(request: Request) {
  const auth = await requireEmailUser(request);
  if ('error' in auth) return auth.error;

  const limited = checkRateLimit({
    key: rateLimitKey('email-send', auth.user.id),
    limit: 30,
    windowMs: 60 * 60 * 1000,
  });
  if ('error' in limited) return limited.error;

  const body = await request.json().catch(() => null);
  const parsed = validateEmailPayload(body);
  if ('error' in parsed) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const payload = parsed.payload;
  const rendered = renderEmail(payload);
  const fromAddress = process.env.EMAIL_FROM_ADDRESS || 'reports@mspcoffee.local';

  const { data: logRow, error: logError } = await auth.supabase
    .from('email_delivery_log')
    .insert({
      email_type: payload.type,
      source_path: payload.sourcePath,
      subject: rendered.subject,
      from_address: fromAddress,
      recipients: payload.recipients,
      cc: payload.cc ?? [],
      status: 'queued',
      note: payload.note || null,
      payload,
      requested_by: auth.user.id,
    })
    .select('id')
    .single<{ id: string }>();

  if (logError || !logRow) {
    return NextResponse.json({ error: logError?.message ?? 'Could not create email log' }, { status: 500 });
  }

  try {
    const result = await sendEmail({ payload, ...rendered });
    const { error: updateError } = await auth.supabase
      .from('email_delivery_log')
      .update({
        status: result.status,
        provider: result.provider,
        provider_message_id: result.providerMessageId,
        provider_response: result.response,
        sent_at: result.status === 'sent' ? new Date().toISOString() : null,
      })
      .eq('id', logRow.id);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({
      id: logRow.id,
      status: result.status,
      provider: result.provider,
      from: result.from,
      subject: rendered.subject,
    }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Email delivery failed';
    const provider = error instanceof EmailDeliveryError ? error.provider : 'unknown';
    const providerResponse = error instanceof EmailDeliveryError ? error.response : null;
    await auth.supabase
      .from('email_delivery_log')
      .update({
        status: 'failed',
        error_message: message,
        provider,
        provider_response: providerResponse,
      })
      .eq('id', logRow.id);

    return NextResponse.json({ id: logRow.id, status: 'failed', error: message }, { status: 502 });
  }
}
