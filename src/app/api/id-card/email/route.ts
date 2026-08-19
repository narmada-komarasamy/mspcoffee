import { NextResponse } from 'next/server';
import { requireEmailUser } from '@/app/api/email/_auth';
import { EmailDeliveryError, sendEmail } from '@/lib/email/provider';
import type { EmailPayload } from '@/lib/email/payload';
import { checkRateLimit, rateLimitKey } from '@/lib/auth/rate-limit';

type CardCategory = 'estate-field' | 'pf-worker' | 'line-worker' | 'village-worker' | 'migrant-worker';

type CardForm = {
  fullName: string;
  category: CardCategory;
  designation: string;
  place: string;
  estateLine1: string;
  estateLine2: string;
  bloodGroup: string;
  mobile: string;
  address: string;
};

type CardTheme = {
  label: string;
};

const ID_CARD_EMAIL_ROLES = ['admin', 'hr'];
const emailAddressPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const categoryThemes: Record<CardCategory, CardTheme> = {
  'estate-field': {
    label: 'Staff & Field',
  },
  'pf-worker': {
    label: 'PF Workers',
  },
  'line-worker': {
    label: 'Line Workers',
  },
  'village-worker': {
    label: 'Village Workers',
  },
  'migrant-worker': {
    label: 'Migrant Workers',
  },
};

function cleanText(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function imageDataUrlToBuffer(value: unknown) {
  const source = cleanText(value);
  const match = /^data:image\/png;base64,([A-Za-z0-9+/=]+)$/.exec(source);
  if (!match) return null;
  return Buffer.from(match[1], 'base64');
}

function safeFileName(value: string) {
  return (value || 'employee')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 72) || 'employee';
}

function validateForm(value: unknown) {
  if (!value || typeof value !== 'object') return null;
  const row = value as Record<string, unknown>;
  const category = cleanText(row.category) as CardCategory;
  if (!categoryThemes[category]) return null;

  const form: CardForm = {
    fullName: cleanText(row.fullName),
    category,
    designation: cleanText(row.designation),
    place: cleanText(row.place),
    estateLine1: cleanText(row.estateLine1),
    estateLine2: cleanText(row.estateLine2),
    bloodGroup: cleanText(row.bloodGroup),
    mobile: cleanText(row.mobile),
    address: cleanText(row.address),
  };

  return form.fullName ? form : null;
}

function buildEmailText(form: CardForm, categoryLabel: string, note: string) {
  return [
    note || 'Please print the attached MSP Coffee ID card.',
    '',
    `Name: ${form.fullName || '-'}`,
    `Category: ${categoryLabel}`,
    `Designation: ${form.designation || '-'}`,
    `Place: ${form.place || '-'}`,
    `Estate: ${[form.estateLine1, form.estateLine2].filter(Boolean).join(' ') || '-'}`,
    `Blood Group: ${form.bloodGroup || '-'}`,
    `Mobile No.: ${form.mobile || '-'}`,
    `Address: ${form.address || '-'}`,
  ].join('\n');
}

export async function POST(request: Request) {
  const auth = await requireEmailUser(request, ID_CARD_EMAIL_ROLES);
  if ('error' in auth) return auth.error;

  const limited = checkRateLimit({
    key: rateLimitKey('id-card-email', auth.user.id),
    limit: 20,
    windowMs: 60 * 60 * 1000,
  });
  if ('error' in limited) return limited.error;

  const body = await request.json().catch(() => null);
  const bodyRow = body as Record<string, unknown> | null;
  const recipient = cleanText(bodyRow?.recipient).toLowerCase();
  if (!emailAddressPattern.test(recipient)) {
    return NextResponse.json({ error: 'Enter a valid printer email address.' }, { status: 400 });
  }

  const form = validateForm(bodyRow?.form);
  if (!form) return NextResponse.json({ error: 'Enter a valid ID card profile before emailing.' }, { status: 400 });

  const attachmentContent = imageDataUrlToBuffer(bodyRow?.imageDataUrl);
  if (!attachmentContent) {
    return NextResponse.json({ error: 'Could not create the ID card image attachment.' }, { status: 400 });
  }

  const note = cleanText(bodyRow?.note);
  const theme = categoryThemes[form.category];
  const attachmentName = `${safeFileName(form.fullName)}-msp-id-card.png`;
  const text = buildEmailText(form, theme.label, note);
  const subject = `ID Card Print - ${form.fullName}`;

  const payload: EmailPayload = {
    type: 'custom_report',
    recipients: [recipient],
    cc: [],
    subject,
    reportTitle: `MSP Coffee ID Card - ${form.fullName}`,
    sourcePath: '/estate-management/muster-roll/employee-center/id-center',
    attachmentName,
    data: {
      summary: [
        { label: 'Name', value: form.fullName },
        { label: 'Category', value: theme.label },
        { label: 'Estate', value: [form.estateLine1, form.estateLine2].filter(Boolean).join(' ') || '-' },
      ],
    },
  };

  try {
    const result = await sendEmail({
      payload,
      subject,
      text,
      html: `<p>Please print the attached MSP Coffee ID card.</p><pre>${escapeHtml(text)}</pre>`,
      attachmentContent,
      attachmentContentType: 'image/png',
    });

    return NextResponse.json({
      status: result.status,
      provider: result.provider,
      recipient,
      attachmentName,
    }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not send ID card email.';
    const provider = error instanceof EmailDeliveryError ? error.provider : 'unknown';
    return NextResponse.json({ error: message, provider }, { status: 502 });
  }
}
