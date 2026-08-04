'use client';

import { useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Eye, Mail, Send } from 'lucide-react';
import type { DigestBlock } from '@/lib/email/daily-operations';
import type { EmailPayload } from '@/lib/email/payload';

type PreviewResponse = {
  payload: EmailPayload;
  subject: string;
  text: string;
  html: string;
  error?: string;
};

const BLOCKS: { key: DigestBlock; label: string; description: string }[] = [
  { key: 'rainfall', label: 'Rainfall', description: 'Estate rainfall entries for the selected date' },
  { key: 'labour_attendance', label: 'Labour Attendance', description: 'Placeholder until daily attendance is stored' },
  { key: 'fleet_fuel', label: 'Fleet Fuel', description: 'Fleet daily fuel, mileage, and cost entries' },
  { key: 'ho_fuel', label: 'HO Fuel', description: 'HO fuel purchases and issues' },
  { key: 'current_page', label: 'Current Page', description: 'Adds a reference to the page you came from' },
];

function todayInIndia() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

function authHeaders(): Record<string, string> {
  const stored = localStorage.getItem('msp_user');
  if (!stored) return {};
  let user: { id?: string; pin?: string };
  try {
    user = JSON.parse(stored) as { id?: string; pin?: string };
  } catch {
    return {};
  }

  return user.id && user.pin ? { 'x-msp-user-id': user.id, 'x-msp-user-pin': user.pin } : {};
}

function splitEmails(value: string) {
  return value
    .split(/[,\n;]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

const card: React.CSSProperties = {
  background: 'var(--t-card)',
  border: '1px solid var(--t-border)',
  borderRadius: 8,
  boxShadow: '0 2px 8px rgba(27,74,27,0.07)',
};

const input: React.CSSProperties = {
  width: '100%',
  border: '1px solid var(--t-border)',
  borderRadius: 8,
  padding: '10px 12px',
  background: 'var(--t-card)',
  color: 'var(--t-text)',
  fontSize: 14,
};

export function EmailComposerClient() {
  const searchParams = useSearchParams();
  const sourcePath = useMemo(() => {
    const value = searchParams.get('source');
    return value?.startsWith('/') ? value : '/email-composer';
  }, [searchParams]);
  const [date, setDate] = useState(todayInIndia);
  const [recipients, setRecipients] = useState('');
  const [cc, setCc] = useState('');
  const [note, setNote] = useState('');
  const [selectedBlocks, setSelectedBlocks] = useState<DigestBlock[]>(['rainfall', 'labour_attendance', 'fleet_fuel', 'ho_fuel', 'current_page']);
  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState('');

  const recipientList = splitEmails(recipients);

  function toggleBlock(block: DigestBlock) {
    setSelectedBlocks((current) => current.includes(block)
      ? current.filter((item) => item !== block)
      : [...current, block]
    );
  }

  async function loadPreview() {
    setLoading(true);
    setMessage('');
    setPreview(null);

    let response: Response;
    try {
      response = await fetch('/api/email/reports/daily-operations', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...authHeaders(),
        },
        body: JSON.stringify({
          date,
          blocks: selectedBlocks,
          currentPage: sourcePath,
          note,
        }),
      });
    } catch {
      setLoading(false);
      setMessage('Could not build preview');
      return;
    }

    const body = await response.json().catch(() => null) as PreviewResponse | null;
    setLoading(false);

    if (!response.ok || !body) {
      setMessage(body?.error ?? 'Could not build preview');
      return;
    }

    setPreview(body);
  }

  async function sendDigest() {
    if (!preview) {
      setMessage('Preview the digest before sending');
      return;
    }

    setSending(true);
    setMessage('');

    const response = await fetch('/api/email/send', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...authHeaders(),
      },
      body: JSON.stringify({
        ...preview.payload,
        recipients: recipientList,
        cc: splitEmails(cc),
        note,
      }),
    });
    const body = await response.json().catch(() => null) as { status?: string; error?: string } | null;
    setSending(false);

    if (!response.ok) {
      setMessage(body?.error ?? 'Digest could not be sent');
      return;
    }

    setMessage(body?.status === 'sent'
      ? 'Digest sent and logged'
      : 'Digest logged only. Add Resend credentials in Vercel to enable live delivery.'
    );
  }

  return (
    <div style={{ maxWidth: 1240, margin: '0 auto', display: 'grid', gap: 18 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ margin: 0, color: 'var(--t-heading)', fontSize: '1.55rem', fontWeight: 850 }}>Email Composer</h1>
          <p style={{ margin: '0.25rem 0 0', color: 'var(--t-muted)', fontSize: 14 }}>Build a daily operations digest from system data, preview it, then send it.</p>
        </div>
        <div style={{ color: 'var(--t-muted)', fontSize: 13 }}>Source: {sourcePath}</div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(320px, 420px) minmax(0, 1fr)', gap: 18, alignItems: 'start' }}>
        <div style={{ ...card, padding: 18, display: 'grid', gap: 14 }}>
          <label style={{ display: 'grid', gap: 6, color: 'var(--t-text)', fontWeight: 800, fontSize: 13 }}>
            Digest Date
            <input type="date" value={date} onChange={(event) => setDate(event.target.value)} style={input} />
          </label>

          <div style={{ display: 'grid', gap: 8 }}>
            <div style={{ color: 'var(--t-text)', fontWeight: 800, fontSize: 13 }}>Report Blocks</div>
            {BLOCKS.map((block) => (
              <label key={block.key} style={{
                display: 'grid',
                gridTemplateColumns: '18px 1fr',
                gap: 10,
                alignItems: 'start',
                border: '1px solid var(--t-border)',
                borderRadius: 8,
                padding: 11,
                cursor: 'pointer',
                background: selectedBlocks.includes(block.key) ? 'var(--t-subtle)' : 'transparent',
              }}>
                <input
                  type="checkbox"
                  checked={selectedBlocks.includes(block.key)}
                  onChange={() => toggleBlock(block.key)}
                  style={{ marginTop: 3 }}
                />
                <span>
                  <span style={{ display: 'block', fontWeight: 800, color: 'var(--t-heading)', fontSize: 13 }}>{block.label}</span>
                  <span style={{ display: 'block', color: 'var(--t-muted)', fontSize: 12, marginTop: 2 }}>{block.description}</span>
                </span>
              </label>
            ))}
          </div>

          <label style={{ display: 'grid', gap: 6, color: 'var(--t-text)', fontWeight: 800, fontSize: 13 }}>
            Recipients
            <textarea value={recipients} onChange={(event) => setRecipients(event.target.value)} rows={2} placeholder="manager@example.com, family@example.com" style={{ ...input, resize: 'vertical' }} />
          </label>

          <label style={{ display: 'grid', gap: 6, color: 'var(--t-text)', fontWeight: 800, fontSize: 13 }}>
            CC
            <input value={cc} onChange={(event) => setCc(event.target.value)} placeholder="Optional" style={input} />
          </label>

          <label style={{ display: 'grid', gap: 6, color: 'var(--t-text)', fontWeight: 800, fontSize: 13 }}>
            Note
            <textarea value={note} onChange={(event) => setNote(event.target.value)} rows={4} placeholder="Optional introduction or newsletter note" style={{ ...input, resize: 'vertical' }} />
          </label>

          {message && (
            <div style={{
              border: '1px solid var(--t-border)',
              borderRadius: 8,
              padding: 10,
              color: message.includes('could not') ? '#9f1239' : 'var(--t-heading)',
              background: message.includes('could not') ? '#fff1f1' : 'var(--t-subtle)',
              fontSize: 13,
            }}>{message}</div>
          )}

          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={loadPreview}
              disabled={loading || selectedBlocks.length === 0}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 7, border: '1px solid var(--t-border)', background: 'var(--t-card)', color: 'var(--t-heading)', borderRadius: 8, padding: '9px 13px', fontWeight: 800, cursor: loading ? 'wait' : 'pointer' }}
            >
              <Eye size={15} /> {loading ? 'Previewing...' : 'Preview'}
            </button>
            <button
              type="button"
              onClick={sendDigest}
              disabled={sending || !preview || recipientList.length === 0}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 7, border: '1px solid var(--t-heading)', background: 'var(--t-heading)', color: '#fff', borderRadius: 8, padding: '9px 13px', fontWeight: 800, cursor: sending ? 'wait' : preview && recipientList.length ? 'pointer' : 'not-allowed', opacity: preview && recipientList.length ? 1 : 0.62 }}
            >
              <Send size={15} /> {sending ? 'Sending...' : 'Send Digest'}
            </button>
          </div>
        </div>

        <div style={{ ...card, overflow: 'hidden' }}>
          <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--t-border)', display: 'flex', alignItems: 'center', gap: 9 }}>
            <Mail size={17} style={{ color: 'var(--t-heading)' }} />
            <div>
              <div style={{ color: 'var(--t-heading)', fontWeight: 850 }}>Preview</div>
              <div style={{ color: 'var(--t-muted)', fontSize: 12 }}>{preview?.subject ?? 'Generate a preview to review the digest.'}</div>
            </div>
          </div>
          {preview ? (
            <div style={{ display: 'grid', gap: 14, padding: 16 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 10 }}>
                {preview.payload.data.summary.map((item) => (
                  <div key={`${item.label}-${item.value}`} style={{ border: '1px solid var(--t-border)', borderRadius: 8, padding: 12, background: 'var(--t-subtle)' }}>
                    <div style={{ color: 'var(--t-muted)', fontSize: 11, fontWeight: 850, textTransform: 'uppercase' }}>{item.label}</div>
                    <div style={{ color: 'var(--t-heading)', fontSize: 18, fontWeight: 850, marginTop: 3 }}>{item.value}</div>
                    {item.detail && <div style={{ color: 'var(--t-muted)', fontSize: 12, marginTop: 2 }}>{item.detail}</div>}
                  </div>
                ))}
              </div>

              {preview.payload.data.sections?.map((section) => (
                <div key={section.title} style={{ borderTop: '1px solid var(--t-border)', paddingTop: 12 }}>
                  <h2 style={{ color: 'var(--t-heading)', fontSize: 14, textTransform: 'uppercase', letterSpacing: 0, margin: '0 0 8px', fontWeight: 850 }}>{section.title}</h2>
                  <div style={{ display: 'grid', gap: 6 }}>
                    {section.rows.map((row) => (
                      <div key={`${section.title}-${row.label}-${row.value}`} style={{ display: 'grid', gridTemplateColumns: 'minmax(130px, 35%) 1fr', gap: 10, padding: '8px 0', borderBottom: '1px solid color-mix(in srgb, var(--t-border), transparent 45%)' }}>
                        <div style={{ color: 'var(--t-muted)', fontSize: 12, fontWeight: 750 }}>{row.label}</div>
                        <div style={{ color: 'var(--t-text)', fontSize: 13 }}>
                          <strong>{row.value}</strong>
                          {row.detail && <span style={{ color: 'var(--t-muted)' }}> - {row.detail}</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ padding: 36, color: 'var(--t-muted)', textAlign: 'center' }}>
              Choose report blocks and click Preview.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
