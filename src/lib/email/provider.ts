import type { EmailPayload } from './payload';
import nodemailer from 'nodemailer';

export type SendEmailInput = {
  payload: EmailPayload;
  subject: string;
  text: string;
  html: string;
};

export type EmailProviderName = 'resend' | 'smtp' | 'webhook';

export class EmailDeliveryError extends Error {
  provider: string;
  response: Record<string, unknown> | null;

  constructor(message: string, provider: string, response: Record<string, unknown> | null = null) {
    super(message);
    this.name = 'EmailDeliveryError';
    this.provider = provider;
    this.response = response;
  }
}

export function getEmailProviderConfig() {
  const providerEnv = process.env.EMAIL_PROVIDER;
  const provider: EmailProviderName = providerEnv === 'resend' || providerEnv === 'smtp' || providerEnv === 'webhook'
    ? providerEnv
    : process.env.RESEND_API_KEY
      ? 'resend'
      : 'webhook';
  const from = process.env.EMAIL_FROM_ADDRESS || 'reports@mspcoffee.local';

  return {
    provider,
    from,
    configured: provider === 'resend'
      ? Boolean(process.env.RESEND_API_KEY)
      : provider === 'smtp'
        ? Boolean(process.env.SMTP_USER && process.env.SMTP_PASS)
        : Boolean(process.env.EMAIL_WEBHOOK_URL),
  };
}

export async function sendEmail(input: SendEmailInput) {
  const { provider, from } = getEmailProviderConfig();
  const webhookUrl = process.env.EMAIL_WEBHOOK_URL;
  const webhookKey = process.env.EMAIL_WEBHOOK_KEY;
  const attachments = input.payload.attachmentName
    ? [{
        filename: input.payload.attachmentName,
        content: Buffer.from(input.html, 'utf8').toString('base64'),
      }]
    : [];

  if (provider === 'resend') {
    const apiKey = process.env.RESEND_API_KEY;

    if (!apiKey) {
      return {
        status: 'logged' as const,
        provider: 'resend_not_configured',
        from,
        providerMessageId: null,
        response: { message: 'Set RESEND_API_KEY to enable live delivery.' },
      };
    }

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${apiKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: input.payload.recipients,
        cc: input.payload.cc,
        subject: input.subject,
        text: input.text,
        html: input.html,
        attachments,
        tags: [
          { name: 'type', value: input.payload.type },
          { name: 'app', value: 'msp-coffee' },
        ],
      }),
    });

    const responseBody = await response.json().catch(() => null) as Record<string, unknown> | null;

    if (!response.ok) {
      throw new EmailDeliveryError(
        typeof responseBody?.message === 'string'
          ? responseBody.message
          : `Resend returned ${response.status}`,
        'resend',
        responseBody
      );
    }

    return {
      status: 'sent' as const,
      provider: 'resend',
      from,
      providerMessageId: typeof responseBody?.id === 'string' ? responseBody.id : null,
      response: responseBody,
    };
  }

  if (provider === 'smtp') {
    const smtpUser = process.env.SMTP_USER;
    const smtpPass = process.env.SMTP_PASS;

    if (!smtpUser || !smtpPass) {
      return {
        status: 'logged' as const,
        provider: 'smtp_not_configured',
        from,
        providerMessageId: null,
        response: { message: 'Set SMTP_USER and SMTP_PASS to enable live delivery.' },
      };
    }

    const port = Number.parseInt(process.env.SMTP_PORT || '465', 10);
    const secure = process.env.SMTP_SECURE
      ? process.env.SMTP_SECURE === 'true'
      : port === 465;
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port,
      secure,
      auth: {
        user: smtpUser,
        pass: smtpPass,
      },
    });

    try {
      const info = await transporter.sendMail({
        from,
        to: input.payload.recipients,
        cc: input.payload.cc,
        subject: input.subject,
        text: input.text,
        html: input.html,
        attachments: input.payload.attachmentName
          ? [{
              filename: input.payload.attachmentName,
              content: Buffer.from(input.html, 'utf8'),
            }]
          : [],
      });

      return {
        status: 'sent' as const,
        provider: 'smtp',
        from,
        providerMessageId: info.messageId || null,
        response: {
          accepted: info.accepted,
          rejected: info.rejected,
          response: info.response,
        },
      };
    } catch (error) {
      throw new EmailDeliveryError(
        error instanceof Error ? error.message : 'SMTP email delivery failed',
        'smtp',
        null
      );
    }
  }

  if (!webhookUrl) {
    return {
      status: 'logged' as const,
      provider: 'not_configured',
      from,
      providerMessageId: null,
      response: { message: 'Set EMAIL_WEBHOOK_URL to enable live delivery.' },
    };
  }

  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(webhookKey ? { authorization: `Bearer ${webhookKey}` } : {}),
    },
    body: JSON.stringify({
      from,
      to: input.payload.recipients,
      cc: input.payload.cc,
      subject: input.subject,
      text: input.text,
      html: input.html,
      attachments,
      metadata: {
        type: input.payload.type,
        sourcePath: input.payload.sourcePath,
        attachmentName: input.payload.attachmentName,
      },
    }),
  });

  const responseBody = await response.json().catch(() => null) as Record<string, unknown> | null;

  if (!response.ok) {
    throw new EmailDeliveryError(
      typeof responseBody?.error === 'string'
        ? responseBody.error
        : `Email provider returned ${response.status}`,
      'webhook',
      responseBody
    );
  }

  return {
    status: 'sent' as const,
    provider: 'webhook',
    from,
    providerMessageId: typeof responseBody?.id === 'string' ? responseBody.id : null,
    response: responseBody,
  };
}
