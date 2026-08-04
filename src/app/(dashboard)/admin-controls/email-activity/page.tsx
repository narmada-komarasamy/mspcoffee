'use client';

import { useCallback, useEffect, useState } from 'react';
import { RefreshCw, Send, AlertCircle, CheckCircle2, Clock3 } from 'lucide-react';

type EmailLogRow = {
  id: string;
  created_at: string;
  sent_at: string | null;
  email_type: string;
  source_path: string;
  subject: string;
  from_address: string;
  recipients: string[];
  cc: string[];
  status: 'queued' | 'sent' | 'failed' | 'logged';
  provider: string | null;
  provider_message_id: string | null;
  error_message: string | null;
  note: string | null;
};

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

function fmtTime(iso: string | null) {
  if (!iso) return '-';
  return new Date(iso).toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function statusStyle(status: EmailLogRow['status']): React.CSSProperties {
  const colors: Record<EmailLogRow['status'], { bg: string; fg: string }> = {
    sent: { bg: '#e8f5e9', fg: '#1b5e20' },
    logged: { bg: '#fff8e1', fg: '#8a5b00' },
    queued: { bg: '#e3f2fd', fg: '#0b4f79' },
    failed: { bg: '#fff1f1', fg: '#9f1239' },
  };
  return {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 5,
    borderRadius: 999,
    padding: '3px 9px',
    background: colors[status].bg,
    color: colors[status].fg,
    fontSize: 12,
    fontWeight: 800,
    textTransform: 'capitalize',
  };
}

function StatusIcon({ status }: { status: EmailLogRow['status'] }) {
  if (status === 'sent') return <CheckCircle2 size={14} />;
  if (status === 'failed') return <AlertCircle size={14} />;
  return <Clock3 size={14} />;
}

export default function EmailActivityPage() {
  const [rows, setRows] = useState<EmailLogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    const response = await fetch('/api/email/logs?limit=150', { headers: authHeaders() });
    const body = await response.json().catch(() => null) as { rows?: EmailLogRow[]; error?: string } | null;
    setLoading(false);

    if (!response.ok) {
      setError(body?.error ?? 'Could not load email activity');
      return;
    }

    setRows(body?.rows ?? []);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const total = rows.length;
  const sent = rows.filter((row) => row.status === 'sent').length;
  const logged = rows.filter((row) => row.status === 'logged').length;
  const failed = rows.filter((row) => row.status === 'failed').length;

  const card: React.CSSProperties = {
    background: 'var(--t-card)',
    border: '1px solid #e5dfc8',
    borderRadius: 10,
    padding: '1rem',
    boxShadow: '0 2px 8px rgba(27,74,27,0.07)',
  };

  return (
    <div style={{ maxWidth: 1280, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, marginBottom: 20, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ margin: 0, color: 'var(--t-heading)', fontSize: '1.5rem', fontWeight: 800 }}>Email Activity</h1>
          <p style={{ margin: '0.25rem 0 0', color: 'var(--t-muted)', fontSize: '.875rem' }}>Delivery history for report emails and operational notices</p>
        </div>
        <button
          type="button"
          onClick={load}
          disabled={loading}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 7, border: 'none', background: 'var(--t-heading)', color: '#fff', borderRadius: 8, padding: '9px 14px', fontWeight: 700, cursor: loading ? 'wait' : 'pointer' }}
        >
          <RefreshCw size={15} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
          Refresh
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 12, marginBottom: 18 }}>
        {[
          { label: 'Total Attempts', value: total, color: '#1b4a1b' },
          { label: 'Sent', value: sent, color: '#2d6e2d' },
          { label: 'Logged Only', value: logged, color: '#8a5b00' },
          { label: 'Failed', value: failed, color: '#9f1239' },
        ].map((item) => (
          <div key={item.label} style={card}>
            <div style={{ color: '#6b7280', fontSize: 11, fontWeight: 800, textTransform: 'uppercase' }}>{item.label}</div>
            <div style={{ color: item.color, fontSize: '1.7rem', lineHeight: 1.1, fontWeight: 800, marginTop: 4 }}>{item.value}</div>
          </div>
        ))}
      </div>

      {error && (
        <div style={{ ...card, color: '#9f1239', background: '#fff1f1', marginBottom: 14 }}>{error}</div>
      )}

      <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: 'var(--t-subtle)' }}>
              {['Time', 'Status', 'Subject', 'Recipients', 'Source', 'Provider'].map((head) => (
                <th key={head} style={{ padding: '11px 14px', textAlign: 'left', fontSize: 11, fontWeight: 800, color: 'var(--t-muted)', textTransform: 'uppercase', borderBottom: '1px solid #e5dfc8' }}>{head}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td style={{ padding: '12px 14px', borderBottom: '1px solid #f0ead4', fontSize: 13, whiteSpace: 'nowrap' }}>{fmtTime(row.created_at)}</td>
                <td style={{ padding: '12px 14px', borderBottom: '1px solid #f0ead4', whiteSpace: 'nowrap' }}>
                  <span style={statusStyle(row.status)}><StatusIcon status={row.status} />{row.status}</span>
                </td>
                <td style={{ padding: '12px 14px', borderBottom: '1px solid #f0ead4', fontSize: 13 }}>
                  <div style={{ fontWeight: 700, color: '#1f2933' }}>{row.subject}</div>
                  {row.error_message && <div style={{ color: '#9f1239', fontSize: 12, marginTop: 2 }}>{row.error_message}</div>}
                </td>
                <td style={{ padding: '12px 14px', borderBottom: '1px solid #f0ead4', fontSize: 12, color: '#4b5563' }}>{row.recipients.join(', ')}</td>
                <td style={{ padding: '12px 14px', borderBottom: '1px solid #f0ead4', fontSize: 12, color: '#4b5563' }}>{row.source_path}</td>
                <td style={{ padding: '12px 14px', borderBottom: '1px solid #f0ead4', fontSize: 12, color: '#4b5563' }}>{row.provider ?? '-'}</td>
              </tr>
            ))}
            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={6} style={{ padding: 34, textAlign: 'center', color: '#6b7280' }}>
                  <Send size={22} style={{ margin: '0 auto 8px' }} />
                  No email activity yet
                </td>
              </tr>
            )}
            {loading && (
              <tr>
                <td colSpan={6} style={{ padding: 34, textAlign: 'center', color: '#6b7280' }}>Loading email activity...</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
