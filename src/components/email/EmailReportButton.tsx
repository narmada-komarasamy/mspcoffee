'use client';

import { useState } from 'react';
import { Send, X } from 'lucide-react';
import type { EmailPayload } from '@/lib/email/payload';

type Props = {
  payload: Omit<EmailPayload, 'recipients' | 'cc' | 'note'> & {
    recipients?: string[];
    cc?: string[];
    note?: string;
  };
  label?: string;
};

function getAuthHeaders(): Record<string, string> {
  const stored = localStorage.getItem('msp_user');
  if (!stored) return {};
  let user: { id?: string; pin?: string };
  try {
    user = JSON.parse(stored) as { id?: string; pin?: string };
  } catch {
    return {};
  }

  return user.id && user.pin
    ? { 'x-msp-user-id': user.id, 'x-msp-user-pin': user.pin }
    : {};
}

function splitEmails(value: string) {
  return value
    .split(/[,\n;]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function EmailReportButton({ payload, label = 'Email Report' }: Props) {
  const [open, setOpen] = useState(false);
  const [recipients, setRecipients] = useState(payload.recipients?.join(', ') ?? '');
  const [cc, setCc] = useState(payload.cc?.join(', ') ?? '');
  const [note, setNote] = useState(payload.note ?? '');
  const [status, setStatus] = useState('');
  const [providerStatus, setProviderStatus] = useState('');
  const [sending, setSending] = useState(false);

  async function openDialog() {
    setOpen(true);
    setStatus('');
    setProviderStatus('');

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

    const provider = body?.provider === 'resend' ? 'Resend' : 'custom webhook';
    setProviderStatus(body?.configured
      ? `Ready to send through ${provider} from ${body.from}.`
      : `Not configured yet. This report will be logged until ${provider} credentials are added.`
    );
  }

  async function sendReport() {
    setSending(true);
    setStatus('');

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
      setStatus('Email could not be sent');
      return;
    }

    const body = await response.json().catch(() => null) as { status?: string; error?: string } | null;
    setSending(false);

    if (!response.ok) {
      setStatus(body?.error ?? 'Email could not be sent');
      return;
    }

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
          cursor: 'pointer',
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
                <textarea
                  value={recipients}
                  onChange={(event) => setRecipients(event.target.value)}
                  placeholder="manager@example.com, partner@example.com"
                  rows={2}
                  style={{ resize: 'vertical', border: '1px solid #d8cfb5', borderRadius: 8, padding: 10, fontSize: 13 }}
                />
              </label>
              <label style={{ display: 'grid', gap: 5, fontSize: 12, fontWeight: 700, color: '#374151' }}>
                CC
                <input
                  value={cc}
                  onChange={(event) => setCc(event.target.value)}
                  placeholder="Optional"
                  style={{ border: '1px solid #d8cfb5', borderRadius: 8, padding: 10, fontSize: 13 }}
                />
              </label>
              <label style={{ display: 'grid', gap: 5, fontSize: 12, fontWeight: 700, color: '#374151' }}>
                Note
                <textarea
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  placeholder="Optional context for the recipients"
                  rows={3}
                  style={{ resize: 'vertical', border: '1px solid #d8cfb5', borderRadius: 8, padding: 10, fontSize: 13 }}
                />
              </label>
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
                <div style={{
                  border: '1px solid #e5dfc8',
                  background: status.includes('could not') ? '#fff1f1' : '#f7fbef',
                  color: status.includes('could not') ? '#9f1239' : '#1b4a1b',
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
