import { NextResponse } from 'next/server';
import { buildRecipientReportPayload, normalizeRecipients, normalizeTemplate } from '@/lib/email/report-builder';
import { EmailDeliveryError, getEmailProviderConfig, sendEmail } from '@/lib/email/provider';
import { renderEmail } from '@/lib/email/render';
import { requireEmailUser } from '../../_auth';

type BatchAction = 'send_now' | 'schedule';

function actionValue(value: unknown): BatchAction {
  return value === 'schedule' ? 'schedule' : 'send_now';
}

function scheduleDate(value: unknown) {
  if (typeof value !== 'string' || !value.trim()) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export async function POST(request: Request) {
  const auth = await requireEmailUser(request);
  if ('error' in auth) return auth.error;

  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const action = actionValue(body?.action);
  const template = normalizeTemplate(body?.template);
  const recipients = normalizeRecipients(body?.recipients);
  const scheduledFor = scheduleDate(body?.scheduledFor);
  const config = getEmailProviderConfig();

  if (recipients.length === 0) {
    return NextResponse.json({ error: 'Add at least one valid recipient' }, { status: 400 });
  }
  if (recipients.length > 100) {
    return NextResponse.json({ error: 'Send to 100 recipients or fewer per batch' }, { status: 400 });
  }
  if (action === 'schedule' && (!scheduledFor || scheduledFor.getTime() <= Date.now())) {
    return NextResponse.json({ error: 'Choose a future schedule time' }, { status: 400 });
  }

  const { data: batch, error: batchError } = await auth.supabase
    .from('email_report_batches')
    .insert({
      name: template.name,
      subject: template.subject,
      from_address: config.from,
      status: action === 'schedule' ? 'scheduled' : 'sending',
      scheduled_for: action === 'schedule' ? scheduledFor!.toISOString() : null,
      default_blocks: template.defaultBlocks,
      template,
      created_by: auth.user.id,
    })
    .select('id')
    .single<{ id: string }>();

  if (batchError || !batch) {
    return NextResponse.json({ error: batchError?.message ?? 'Could not create email batch' }, { status: 500 });
  }

  if (action === 'schedule') {
    const rows = recipients.map((recipient) => {
      const payload = buildRecipientReportPayload(template, recipient);
      return {
        batch_id: batch.id,
        recipient_name: recipient.name,
        recipient_email: recipient.email,
        blocks: recipient.blocks?.length ? recipient.blocks : template.defaultBlocks,
        payload,
        status: 'scheduled',
      };
    });

    const { error } = await auth.supabase
      .from('email_report_batch_recipients')
      .insert(rows);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      id: batch.id,
      status: 'scheduled',
      scheduledFor: scheduledFor!.toISOString(),
      recipients: rows.length,
    }, { status: 201 });
  }

  const results = [];

  for (const recipient of recipients) {
    const payload = buildRecipientReportPayload(template, recipient);
    const rendered = renderEmail(payload);

    const { data: logRow, error: logError } = await auth.supabase
      .from('email_delivery_log')
      .insert({
        email_type: payload.type,
        source_path: payload.sourcePath,
        subject: rendered.subject,
        from_address: config.from,
        recipients: payload.recipients,
        cc: [],
        status: 'queued',
        note: payload.note || null,
        payload,
        requested_by: auth.user.id,
      })
      .select('id')
      .single<{ id: string }>();

    if (logError || !logRow) {
      results.push({ recipient, status: 'failed', error: logError?.message ?? 'Could not create email log' });
      continue;
    }

    try {
      const result = await sendEmail({ payload, ...rendered });
      await auth.supabase
        .from('email_delivery_log')
        .update({
          status: result.status,
          provider: result.provider,
          provider_message_id: result.providerMessageId,
          provider_response: result.response,
          sent_at: result.status === 'sent' ? new Date().toISOString() : null,
        })
        .eq('id', logRow.id);

      const { data: recipientRow } = await auth.supabase
        .from('email_report_batch_recipients')
        .insert({
          batch_id: batch.id,
          recipient_name: recipient.name,
          recipient_email: recipient.email,
          blocks: recipient.blocks?.length ? recipient.blocks : template.defaultBlocks,
          payload,
          status: result.status,
          email_delivery_log_id: logRow.id,
          sent_at: result.status === 'sent' ? new Date().toISOString() : null,
        })
        .select('id')
        .single<{ id: string }>();

      results.push({ recipient, recipientRowId: recipientRow?.id, status: result.status });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Email delivery failed';
      await auth.supabase
        .from('email_delivery_log')
        .update({
          status: 'failed',
          error_message: message,
          provider: error instanceof EmailDeliveryError ? error.provider : 'unknown',
          provider_response: error instanceof EmailDeliveryError ? error.response : null,
        })
        .eq('id', logRow.id);

      await auth.supabase
        .from('email_report_batch_recipients')
        .insert({
          batch_id: batch.id,
          recipient_name: recipient.name,
          recipient_email: recipient.email,
          blocks: recipient.blocks?.length ? recipient.blocks : template.defaultBlocks,
          payload,
          status: 'failed',
          email_delivery_log_id: logRow.id,
          error_message: message,
        });

      results.push({ recipient, status: 'failed', error: message });
    }
  }

  const sent = results.filter((result) => result.status === 'sent' || result.status === 'logged').length;
  const failed = results.length - sent;
  const batchStatus = failed === 0 ? 'sent' : sent === 0 ? 'failed' : 'partial';

  await auth.supabase
    .from('email_report_batches')
    .update({ status: batchStatus })
    .eq('id', batch.id);

  return NextResponse.json({
    id: batch.id,
    status: batchStatus,
    results,
  }, { status: failed === 0 ? 201 : 207 });
}
