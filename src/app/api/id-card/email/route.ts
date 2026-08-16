import { NextResponse } from 'next/server';
import { requireEmailUser } from '@/app/api/email/_auth';
import { EmailDeliveryError, sendEmail } from '@/lib/email/provider';
import type { EmailPayload } from '@/lib/email/payload';

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
  accent: string;
  accentSoft: string;
  accentDark: string;
  ribbon: string;
  ribbonDark: string;
  leaf: string;
};

const printerEmailAddress = process.env.ID_CARD_PRINTER_EMAIL || 'printer@mspcoffee.com';

const categoryThemes: Record<CardCategory, CardTheme> = {
  'estate-field': {
    label: 'Staff & Field',
    accent: '#ffd400',
    accentSoft: '#fff2a6',
    accentDark: '#b8860b',
    ribbon: '#ffd400',
    ribbonDark: '#8a6008',
    leaf: '#87ad77',
  },
  'pf-worker': {
    label: 'PF Workers',
    accent: '#2f7bff',
    accentSoft: '#c9dcff',
    accentDark: '#063c9e',
    ribbon: '#2f7bff',
    ribbonDark: '#06285f',
    leaf: '#78a9ff',
  },
  'line-worker': {
    label: 'Line Workers',
    accent: '#ff7a00',
    accentSoft: '#ffd7b0',
    accentDark: '#9f3a00',
    ribbon: '#ff7a00',
    ribbonDark: '#7a2b00',
    leaf: '#ffae75',
  },
  'village-worker': {
    label: 'Village Workers',
    accent: '#b83a32',
    accentSoft: '#ffd1ce',
    accentDark: '#6f1712',
    ribbon: '#b83a32',
    ribbonDark: '#54100d',
    leaf: '#e98282',
  },
  'migrant-worker': {
    label: 'Migrant Workers',
    accent: '#b994ff',
    accentSoft: '#eadfff',
    accentDark: '#5c2fb1',
    ribbon: '#b994ff',
    ribbonDark: '#3b1e78',
    leaf: '#c9b2ff',
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

function safeImageSource(value: unknown) {
  const source = cleanText(value);
  if (!source) return '';
  if (source.startsWith('data:image/') || source.startsWith('http://') || source.startsWith('https://')) return source;
  return '';
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

function renderPrintableIdCard(form: CardForm, photo: string, signature: string, logoUrl: string) {
  const theme = categoryThemes[form.category];
  const name = escapeHtml(form.fullName || 'Full Name');
  const designation = escapeHtml(form.designation || 'Designation');
  const place = escapeHtml(form.place || 'Place');
  const estateLine1 = escapeHtml(form.estateLine1 || 'Estate');
  const estateLine2 = escapeHtml(form.estateLine2 || 'Estate');
  const bloodGroup = escapeHtml(form.bloodGroup || '-');
  const mobile = escapeHtml(form.mobile || '-');
  const address = escapeHtml(form.address || '-');
  const safeLogo = escapeHtml(logoUrl);
  const safePhoto = escapeHtml(photo);
  const safeSignature = escapeHtml(signature);

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>MSP Coffee ID Card - ${name}</title>
  <style>
    @page { size: auto; margin: 0.25in; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      background: #e9e4d8;
      color: #fff;
      font-family: "Segoe UI", Arial, sans-serif;
    }
    .sheet {
      display: flex;
      flex-wrap: wrap;
      gap: 0.25in;
      padding: 0.25in;
    }
    .card {
      position: relative;
      width: 2.25in;
      height: 3.5in;
      overflow: hidden;
      border-radius: 0.16in;
      background: radial-gradient(circle at 55% 42%, ${theme.accentDark}77, transparent 46%),
        linear-gradient(150deg, #0a4531 0%, #05291f 55%, #031c14 100%);
    }
    .back {
      background: radial-gradient(circle at 50% 45%, #0b3a2b, #031c14 75%);
    }
    .ribbon-a, .ribbon-b, .ribbon-c {
      position: absolute;
      width: 0.38in;
      height: 4.2in;
      background: linear-gradient(135deg, ${theme.accentSoft}, ${theme.ribbon}, ${theme.ribbonDark});
      transform: rotate(-18deg);
      opacity: 0.92;
    }
    .ribbon-a { left: 0.03in; top: -0.32in; }
    .ribbon-b { left: -0.32in; top: -0.12in; opacity: 0.82; }
    .ribbon-c {
      width: 2.2in;
      height: 0.18in;
      left: 0.42in;
      top: 1.42in;
      transform: rotate(-25deg);
    }
    .content {
      position: relative;
      z-index: 2;
      height: 100%;
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 0.17in 0.15in 0.12in;
      text-align: center;
    }
    .logo {
      width: 0.74in;
      height: 0.86in;
      object-fit: contain;
    }
    .photo {
      display: flex;
      width: 0.96in;
      height: 0.96in;
      align-items: center;
      justify-content: center;
      margin: 0.07in 0 0.14in;
      border-radius: 50%;
      background: linear-gradient(135deg, ${theme.accent}, ${theme.accentDark} 58%, ${theme.accentSoft});
      padding: 0.07in;
    }
    .photo-inner {
      display: flex;
      width: 100%;
      height: 100%;
      align-items: center;
      justify-content: center;
      overflow: hidden;
      border-radius: 50%;
      background: #efe9db;
      color: #a89a76;
      font-size: 0.09in;
      font-weight: 900;
      letter-spacing: 0.05em;
    }
    .photo-inner img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    .name {
      max-width: 100%;
      margin-bottom: 0.06in;
      font-size: 0.24in;
      font-weight: 900;
      line-height: 1.05;
      text-transform: uppercase;
      overflow-wrap: anywhere;
    }
    .designation, .place {
      max-width: 100%;
      color: ${theme.accent};
      font-size: 0.18in;
      font-weight: 700;
      line-height: 1.05;
      text-transform: uppercase;
      overflow-wrap: anywhere;
    }
    .place {
      margin-bottom: 0.13in;
      font-size: 0.16in;
    }
    .estate {
      max-width: 100%;
      margin-top: auto;
      line-height: 1.15;
      text-transform: uppercase;
      overflow-wrap: anywhere;
    }
    .estate strong {
      display: block;
      font-size: 0.18in;
      font-weight: 900;
    }
    .estate span {
      display: block;
      font-size: 0.16in;
      font-weight: 500;
    }
    .sig {
      width: 100%;
      min-height: 0.31in;
      margin-top: 0.12in;
      padding-top: 0.07in;
      border-top: 1px solid ${theme.accent};
      color: ${theme.accent};
      font-size: 0.08in;
      font-weight: 900;
      letter-spacing: 0.05em;
      text-transform: uppercase;
      display: flex;
      align-items: flex-end;
      justify-content: space-between;
    }
    .sig img {
      max-width: 0.78in;
      max-height: 0.18in;
      object-fit: contain;
      display: block;
      margin-bottom: 0.02in;
    }
    .mini-logo {
      width: 0.45in;
      height: 0.43in;
      object-fit: contain;
    }
    .back .content {
      padding: 0.24in 0.18in 0.18in;
    }
    .back .logo {
      width: 0.58in;
      height: 0.74in;
      margin-bottom: 0.06in;
    }
    .back-title {
      margin-bottom: 0.18in;
      color: ${theme.accent};
      font-size: 0.23in;
      font-weight: 900;
    }
    .back-subtitle {
      margin-bottom: 0.4in;
      color: ${theme.accentSoft};
      font-size: 0.21in;
      font-weight: 900;
    }
    .grid {
      display: grid;
      width: 100%;
      grid-template-columns: 1fr 1fr;
      gap: 0.06in;
      margin-bottom: 0.23in;
    }
    .label {
      margin-bottom: 0.07in;
      color: ${theme.accentSoft};
      font-size: 0.13in;
      font-weight: 900;
      text-transform: uppercase;
    }
    .value {
      color: ${theme.accentSoft};
      font-size: 0.13in;
      line-height: 1.25;
      overflow-wrap: anywhere;
    }
    .address {
      max-width: 1.76in;
      margin-bottom: auto;
    }
    .holder {
      max-width: 1.38in;
      margin-top: 0.18in;
      padding-top: 0.08in;
      border-top: 1px solid ${theme.accent};
      color: ${theme.accentSoft};
      font-size: 0.12in;
      font-weight: 900;
      text-transform: uppercase;
    }
  </style>
</head>
<body>
  <div class="sheet">
    <section class="card">
      <div class="ribbon-a"></div>
      <div class="ribbon-b"></div>
      <div class="ribbon-c"></div>
      <div class="content">
        <img class="logo" src="${safeLogo}" alt="MSP Coffee logo" />
        <div class="photo"><div class="photo-inner">${safePhoto ? `<img src="${safePhoto}" alt="${name}" />` : 'PHOTO'}</div></div>
        <div class="name">${name}</div>
        <div class="designation">${designation}</div>
        <div class="place">${place}</div>
        <div class="estate"><strong>${estateLine1}</strong><span>${estateLine2}</span></div>
        <div class="sig"><span>${safeSignature ? `<img src="${safeSignature}" alt="" />` : ''}Authority Signature</span><img class="mini-logo" src="${safeLogo}" alt="" /></div>
      </div>
    </section>
    <section class="card back">
      <div class="content">
        <img class="logo" src="${safeLogo}" alt="MSP Coffee logo" />
        <div class="back-title">MSP COFFEE</div>
        <div class="back-subtitle">I D&nbsp; C A R D</div>
        <div class="grid">
          <div><div class="label">Blood Group</div><div class="value">${bloodGroup}</div></div>
          <div><div class="label">Mobile No.</div><div class="value">${mobile}</div></div>
        </div>
        <div class="address"><div class="label">Address</div><div class="value">${address}</div></div>
        <div class="holder">${safeSignature ? `<img src="${safeSignature}" alt="" />` : ''}<span>Holder Signature</span></div>
      </div>
    </section>
  </div>
</body>
</html>`;
}

function buildEmailText(form: CardForm, categoryLabel: string) {
  return [
    'Please print the attached MSP Coffee ID card.',
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
  const auth = await requireEmailUser(request);
  if ('error' in auth) return auth.error;

  const body = await request.json().catch(() => null);
  const form = validateForm((body as Record<string, unknown> | null)?.form);
  if (!form) return NextResponse.json({ error: 'Enter a valid ID card profile before emailing.' }, { status: 400 });

  const photo = safeImageSource((body as Record<string, unknown>).photo);
  const signature = safeImageSource((body as Record<string, unknown>).signature);
  const theme = categoryThemes[form.category];
  const origin = new URL(request.url).origin;
  const attachmentName = `${safeFileName(form.fullName)}-msp-id-card.html`;
  const html = renderPrintableIdCard(form, photo, signature, `${origin}/msp-id-logo.png`);
  const text = buildEmailText(form, theme.label);
  const subject = `ID Card Print - ${form.fullName}`;

  const payload: EmailPayload = {
    type: 'custom_report',
    recipients: [printerEmailAddress],
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
      attachmentHtml: html,
    });

    return NextResponse.json({
      status: result.status,
      provider: result.provider,
      recipient: printerEmailAddress,
      attachmentName,
    }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not send ID card email.';
    const provider = error instanceof EmailDeliveryError ? error.provider : 'unknown';
    return NextResponse.json({ error: message, provider }, { status: 502 });
  }
}
