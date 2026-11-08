'use client';

import { useState } from 'react';
import { Send, X } from 'lucide-react';
import type { EmailPayload } from '@/lib/email/payload';
import { rememberedEmails } from '@/lib/email/contacts';
import { EmailAddressInput } from './EmailAddressInput';

type Props = {
  payload: Omit<EmailPayload, 'recipients' | 'cc' | 'note'> & {
    recipients?: string[];
    cc?: string[];
    note?: string;
  };
  label?: string;
  disabled?: boolean;
  pdfPreviewUrl?: string;
  onSent?: () => void;
};

function getAuthHeaders(): Record<string, string> {
  return {};
}

function splitEmails(value: string) {
  return value
    .split(/[,\n;]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function providerLabel(provider?: string) {
  if (provider === 'resend') return 'Resend';
  if (provider === 'smtp') return 'SMTP';
  if (provider === 'webhook') return 'custom webhook';
  return 'email provider';
}

export function EmailReportButton({ payload, label = 'Email Report', disabled = false, pdfPreviewUrl, onSent }: Props) {
  const [open, setOpen] = useState(false);
  const [recipients, setRecipients] = useState(payload.recipients?.join(', ') ?? '');
  const [cc, setCc] = useState(payload.cc?.join(', ') ?? '');
  const [note, setNote] = useState(payload.note ?? '');
  const [status, setStatus] = useState('');
  const [statusError, setStatusError] = useState(false);
  const [providerStatus, setProviderStatus] = useState('');
  const [sending, setSending] = useState(false);
  const [addresses, setAddresses] = useState<string[]>([]);
  const [addressError, setAddressError] = useState(false);

  async function openDialog() {
    setOpen(true);
    setStatus('');
    setStatusError(false);
    setProviderStatus('');
    setAddressError(false);
    fetch('/api/email/contacts', { cache: 'no-store', headers: getAuthHeaders() }).then(async response => {
      const body = await response.json();
      if (!response.ok || !Array.isArray(body.addresses)) throw new Error('Unable to load saved addresses');
      setAddresses(body.addresses);
    }).catch(() => { setAddresses([]); setAddressError(true); });

    let response: Response;
    try {
      response = await fetch('/api/email/status', { headers: getAuthHeaders() });
    } catch {
      setProviderStatus('Email status unavailable');
      return;
    }

    const body = await response.json().catch(() => null) as {
        provider?: string;
        from?: string;
        configured?: boolean;
        error?: string;
      } | null;

    if (!response.ok) {
      setProviderStatus(body?.error ?? 'Email status unavailable');
      return;
    }

    const provider = providerLabel(body?.provider);
    setProviderStatus(body?.configured
      ? `Ready to send through ${provider} from ${body.from}.`
      : `Not configured yet. This report will be logged until ${provider} credentials are added.`
    );
  }

  async function sendReport() {
    setSending(true);
    setStatus('');
    setStatusError(false);

    let response: Response;
    try {
      response = await fetch('/api/email/send', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          ...payload,
          recipients: splitEmails(recipients),
          cc: splitEmails(cc),
          note,
        }),
      });
    } catch {
      setSending(false);
      setStatusError(true);
      setStatus('Email could not be sent');
      return;
    }

    const body = await response.json().catch(() => null) as { status?: string; error?: string } | null;
    setSending(false);

    if (!response.ok) {
      setStatusError(true);
      setStatus(body?.error ?? 'Email could not be sent');
      return;
    }

    setAddresses(previous => rememberedEmails([{ recipients: splitEmails(recipients), cc: splitEmails(cc) }, { recipients: previous }]));
    onSent?.();
    setStatus(body?.status === 'sent'
      ? 'Sent and logged'
      : 'Logged only. Add the email provider credentials in Vercel to enable live delivery.'
    );
  }

  const hasRecipients = splitEmails(recipients).length > 0;

  return (
    <>
      <button
        type="button"
        disabled={disabled}
        onClick={openDialog}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          border: '1px solid #2d6e2d',
          background: '#1b4a1b',
          color: 'white',
          borderRadius: 8,
          padding: '9px 14px',
          fontSize: 13,
          fontWeight: 700,
          cursor: disabled ? 'not-allowed' : 'pointer',
          opacity: disabled ? 0.5 : 1,
        }}
      >
        <Send size={15} />
        {label}
      </button>

      {open && (
        <div style={{
          position: 'fixed',
          inset: 0,
          zIndex: 60,
          background: 'rgba(0,0,0,.45)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 20,
        }}>
          <div style={{
            width: 'min(560px, 100%)',
            background: '#fff',
            border: '1px solid #e5dfc8',
            borderRadius: 10,
            boxShadow: '0 18px 50px rgba(0,0,0,.25)',
          }}>
            <div style={{ padding: '16px 18px', borderBottom: '1px solid #f0ead4', display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 800, color: '#1b4a1b' }}>{payload.reportTitle}</div>
                <div style={{ fontSize: 12, color: '#6b7280' }}>{payload.subject || 'MSP Coffee report email'}</div>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#6b7280' }}
              >
                <X size={18} />
              </button>
            </div>
            <div style={{ padding: 18, display: 'grid', gap: 12 }}>
              <label style={{ display: 'grid', gap: 5, fontSize: 12, fontWeight: 700, color: '#374151' }}>
                Recipients
                <EmailAddressInput label="Recipients" value={recipients} onChange={setRecipients} addresses={addresses} placeholder="Start typing an email address" />
                <small style={{ fontWeight: 400, color: '#6b7280' }}>{addressError ? 'Saved suggestions are unavailable. You can still type an address.' : 'Addresses used in your reports are remembered. Separate multiple addresses with commas.'}</small>
              </label>
              <label style={{ display: 'grid', gap: 5, fontSize: 12, fontWeight: 700, color: '#374151' }}>
                CC
                <EmailAddressInput label="CC" value={cc} onChange={setCc} addresses={addresses} placeholder="Optional — start typing to find a saved address" />
              </label>
              <label style={{ display: 'grid', gap: 5, fontSize: 12, fontWeight: 700, color: '#374151' }}>
                Note (optional message; does not change the report month)
                <textarea
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  placeholder="Optional context for the recipients"
                  rows={3}
                  style={{ resize: 'vertical', border: '1px solid #d8cfb5', borderRadius: 8, padding: 10, fontSize: 13 }}
                />
              </label>
              <div style={{
                border: '1px solid #e5dfc8',
                background: '#fffdf7',
                borderRadius: 8,
                overflow: 'hidden',
              }}>
                <div style={{ padding: '10px 12px', borderBottom: '1px solid #f0ead4', display: 'grid', gap: 3 }}>
                  <div style={{ fontSize: 11, fontWeight: 800, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '.08em' }}>Preview</div>
                  <div style={{ fontSize: 13, fontWeight: 800, color: '#1b4a1b' }}>Subject: {payload.subject || payload.reportTitle}</div>
                  {pdfPreviewUrl && <><a href={pdfPreviewUrl} target="_blank" rel="noopener noreferrer" style={{ color: '#1b4a1b', fontWeight: 700 }}>Preview one-page PDF statement</a><div style={{ fontSize: 12, color: '#6b7280' }}>Sending saves the complete month’s statement. Return to Upload signed copy after signing.</div></>}
                  {payload.attachmentName && <div style={{ fontSize: 12, color: '#6b7280' }}>Attachment: {payload.attachmentName}</div>}
                </div>
                <div style={{ padding: 12, display: 'grid', gap: 12, maxHeight: 270, overflow: 'auto' }}>
                  {note && <div style={{ background: '#fff8e1', border: '1px solid #ead58a', borderRadius: 7, padding: 10, color: '#374151', fontSize: 13 }}>{note}</div>}
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 800, color: '#6b7280', marginBottom: 6 }}>Summary</div>
                    <div style={{ display: 'grid', gap: 6 }}>
                      {payload.data.summary.map((item) => (
                        <div key={item.label} style={{ display: 'grid', gridTemplateColumns: 'minmax(110px, 1fr) minmax(130px, 1.3fr)', gap: 10, padding: '8px 10px', border: '1px solid #f0ead4', borderRadius: 7 }}>
                          <span style={{ color: '#6b7280', fontSize: 12, fontWeight: 700 }}>{item.label}</span>
                          <span style={{ color: '#111827', fontSize: 13, fontWeight: 800 }}>{item.value}{item.detail ? <small style={{ display: 'block', color: '#6b7280', fontWeight: 600 }}>{item.detail}</small> : null}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  {payload.data.sections?.map((section) => (
                    <div key={section.title}>
                      <div style={{ fontSize: 12, fontWeight: 800, color: '#6b7280', marginBottom: 6 }}>{section.title}</div>
                      <div style={{ display: 'grid', gap: 6 }}>
                        {section.rows.map((item) => (
                          <div key={`${section.title}-${item.label}`} style={{ display: 'grid', gridTemplateColumns: 'minmax(110px, 1fr) minmax(130px, 1.3fr)', gap: 10, padding: '8px 10px', border: '1px solid #f0ead4', borderRadius: 7 }}>
                            <span style={{ color: '#6b7280', fontSize: 12, fontWeight: 700 }}>{item.label}</span>
                            <span style={{ color: '#111827', fontSize: 13, fontWeight: 800 }}>{item.value}{item.detail ? <small style={{ display: 'block', color: '#6b7280', fontWeight: 600 }}>{item.detail}</small> : null}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              {providerStatus && (
                <div style={{
                  border: '1px solid #e5dfc8',
                  background: providerStatus.startsWith('Ready') ? '#f7fbef' : '#fff8e1',
                  color: providerStatus.startsWith('Ready') ? '#1b4a1b' : '#8a5b00',
                  borderRadius: 8,
                  padding: '9px 10px',
                  fontSize: 13,
                }}>{providerStatus}</div>
              )}
              {status && (
                <div role={statusError ? 'alert' : 'status'} style={{
                  border: '1px solid #e5dfc8',
                  background: statusError ? '#fff1f1' : '#f7fbef',
                  color: statusError ? '#9f1239' : '#1b4a1b',
                  borderRadius: 8,
                  padding: '9px 10px',
                  fontSize: 13,
                }}>{status}</div>
              )}
            </div>
            <div style={{ padding: '14px 18px', borderTop: '1px solid #f0ead4', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button
                type="button"
                onClick={() => setOpen(false)}
                style={{ border: '1px solid #d8cfb5', background: '#fff', borderRadius: 8, padding: '9px 13px', fontWeight: 700, cursor: 'pointer' }}
              >
                Close
              </button>
              <button
                type="button"
                onClick={sendReport}
                disabled={sending || !hasRecipients}
                style={{ border: '1px solid #2d6e2d', background: '#1b4a1b', color: 'white', borderRadius: 8, padding: '9px 13px', fontWeight: 700, cursor: sending ? 'wait' : hasRecipients ? 'pointer' : 'not-allowed', opacity: hasRecipients ? 1 : 0.6 }}
              >
                {sending ? 'Sending...' : 'Send'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
