'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CalendarClock, CheckCircle2, Eye, Mail, Plus, Save, Send, Trash2 } from 'lucide-react';
import { RECIPIENT_GROUPS, REPORT_BLOCKS, type RecipientReportConfig, type ReportBlockId } from '@/lib/email/report-builder';
import type { EmailPayload } from '@/lib/email/payload';

type PreviewItem = {
  recipient: RecipientReportConfig;
  payload: EmailPayload;
  subject: string;
  html: string;
  text: string;
};

type PreviewResponse = {
  from: string;
  previews: PreviewItem[];
  error?: string;
};

type ProviderStatus = {
  provider: string;
  from: string;
  configured: boolean;
};

function isProviderStatus(value: unknown): value is ProviderStatus {
  if (!value || typeof value !== 'object') return false;
  const row = value as Record<string, unknown>;
  return typeof row.provider === 'string'
    && typeof row.from === 'string'
    && typeof row.configured === 'boolean';
}

type RecipientDraft = {
  name: string;
  email: string;
  blocks: ReportBlockId[];
};

type SavedPreset = {
  id: string;
  name: string;
  template: {
    name: string;
    subject: string;
    estateName: string;
    date: string;
    customText: string;
    defaultBlocks: ReportBlockId[];
  };
  recipients: RecipientDraft[];
};

const defaultBlocks: ReportBlockId[] = ['estate_overview', 'harvest_crop_report', 'inventory_stock_levels'];

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

function todayInIndia() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

function localScheduleDefault() {
  const date = new Date();
  date.setHours(date.getHours() + 1, 0, 0, 0);
  return date.toISOString().slice(0, 16);
}

function authHeaders(): Record<string, string> {
  const stored = localStorage.getItem('msp_user');
  if (!stored) return {};
  let user: { id?: string; pin?: string; role?: string };
  try {
    user = JSON.parse(stored) as { id?: string; pin?: string; role?: string };
  } catch {
    return {};
  }

  return user.id && user.pin ? { 'x-msp-user-id': user.id, 'x-msp-user-pin': user.pin } : {};
}

function currentUserCredentials() {
  const stored = localStorage.getItem('msp_user');
  if (!stored) return null;
  try {
    const user = JSON.parse(stored) as { id?: string; pin?: string };
    return user.id && user.pin ? { userId: user.id, pin: user.pin } : null;
  } catch {
    return null;
  }
}

function hasEmailAuth() {
  return Boolean(authHeaders()['x-msp-user-pin']);
}

async function refreshPinSession() {
  const credentials = currentUserCredentials();
  if (!credentials) return false;

  const response = await fetch('/api/auth/pin-session', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify(credentials),
  });

  if (!response.ok) return false;

  const body = await response.json().catch(() => null) as { user?: unknown } | null;
  if (body?.user) {
    localStorage.setItem('msp_user', JSON.stringify(body.user));
    window.dispatchEvent(new Event('msp-user-updated'));
  }
  return true;
}

async function emailFetch(input: RequestInfo | URL, init: RequestInit = {}, retry = true): Promise<Response> {
  const response = await fetch(input, {
    ...init,
    credentials: 'same-origin',
    headers: {
      ...(init.headers ?? {}),
      ...authHeaders(),
    },
  });

  if (response.status === 401 && retry && await refreshPinSession()) {
    return emailFetch(input, init, false);
  }

  return response;
}

function friendlyEmailError(error: string | undefined, fallback: string) {
  if (error === 'Unauthorized') {
    return 'Email access could not verify your admin session. Sign out, sign back in as admin, then retry.';
  }
  return error ?? fallback;
}

function currentUserRole() {
  const stored = localStorage.getItem('msp_user');
  if (!stored) return '';
  try {
    return (JSON.parse(stored) as { role?: string }).role ?? '';
  } catch {
    return '';
  }
}

export function EmailReportsClient() {
  const router = useRouter();
  const [authorized] = useState(() => currentUserRole() === 'admin');
  const [name, setName] = useState(`Weekly Estate Report - ${todayInIndia()}`);
  const [subject, setSubject] = useState('MSP Coffee - Weekly Estate Report - {{date}}');
  const [estateName, setEstateName] = useState('MSP Coffee');
  const [date, setDate] = useState(todayInIndia);
  const [customText, setCustomText] = useState('<p>Dear {{recipient_name}},</p><p>Please find the selected MSP Coffee report sections below.</p>');
  const [selectedBlocks, setSelectedBlocks] = useState<ReportBlockId[]>(defaultBlocks);
  const [recipients, setRecipients] = useState<RecipientDraft[]>([
    { name: 'Internal Team', email: 'team@mspcoffee.com', blocks: defaultBlocks },
  ]);
  const [activeRecipient, setActiveRecipient] = useState(0);
  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [sending, setSending] = useState(false);
  const [scheduleAt, setScheduleAt] = useState(localScheduleDefault);
  const [message, setMessage] = useState('');
  const [providerStatus, setProviderStatus] = useState<ProviderStatus | null>(null);
  const [savedPresets, setSavedPresets] = useState<SavedPreset[]>(() => {
    if (typeof window === 'undefined') return [];
    const stored = localStorage.getItem('msp_email_report_presets');
    if (!stored) return [];
    try {
      return JSON.parse(stored) as SavedPreset[];
    } catch {
      return [];
    }
  });

  const activePreview = preview?.previews[activeRecipient] ?? preview?.previews[0] ?? null;
  const hasRecipients = recipients.some((recipient) => recipient.email.trim());

  const template = useMemo(() => ({
    name,
    subject,
    estateName,
    date,
    customText,
    defaultBlocks: selectedBlocks,
  }), [name, subject, estateName, date, customText, selectedBlocks]);

  useEffect(() => {
    if (!authorized) router.replace('/unauthorized');
  }, [authorized, router]);

  useEffect(() => {
    if (!authorized) return;

    let cancelled = false;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;

    const loadProviderStatus = async (attempt = 0) => {
      if (!hasEmailAuth() && attempt < 4) {
        retryTimer = setTimeout(() => void loadProviderStatus(attempt + 1), 350);
        return;
      }

      try {
        if (!hasEmailAuth()) {
          await refreshPinSession();
        }

        const response = await emailFetch('/api/email/status');
        const body = await response.json().catch(() => null) as unknown;
        if (cancelled) return;

        if (!response.ok || !isProviderStatus(body)) {
          const rawError = body && typeof body === 'object' && typeof (body as { error?: unknown }).error === 'string'
            ? (body as { error: string }).error
            : 'Email provider status unavailable';
          setMessage(friendlyEmailError(rawError, 'Email provider status unavailable'));
          return;
        }
        setProviderStatus(body);
        setMessage('');
      } catch {
        if (!cancelled) setMessage('Email provider status unavailable');
      }
    };

    const handleUserUpdated = () => {
      setMessage('');
      void loadProviderStatus();
    };

    window.addEventListener('msp-user-updated', handleUserUpdated);
    void loadProviderStatus();

    return () => {
      cancelled = true;
      if (retryTimer) clearTimeout(retryTimer);
      window.removeEventListener('msp-user-updated', handleUserUpdated);
    };
  }, [authorized]);

  if (!authorized) {
    return null;
  }

  function toggleBlock(block: ReportBlockId) {
    setSelectedBlocks((current) => current.includes(block)
      ? current.filter((item) => item !== block)
      : [...current, block]
    );
  }

  function toggleRecipientBlock(index: number, block: ReportBlockId) {
    setRecipients((current) => current.map((recipient, recipientIndex) => {
      if (recipientIndex !== index) return recipient;
      const blocks = recipient.blocks.includes(block)
        ? recipient.blocks.filter((item) => item !== block)
        : [...recipient.blocks, block];
      return { ...recipient, blocks };
    }));
  }

  function addRecipient() {
    setRecipients((current) => [...current, { name: '', email: '', blocks: selectedBlocks }]);
    setActiveRecipient(recipients.length);
  }

  function removeRecipient(index: number) {
    setRecipients((current) => current.filter((_recipient, recipientIndex) => recipientIndex !== index));
    setActiveRecipient(0);
  }

  function updateRecipient(index: number, field: 'name' | 'email', value: string) {
    setRecipients((current) => current.map((recipient, recipientIndex) => (
      recipientIndex === index ? { ...recipient, [field]: value } : recipient
    )));
  }

  function applyGroup(groupId: string) {
    const group = RECIPIENT_GROUPS.find((item) => item.id === groupId);
    if (!group) return;
    setRecipients((current) => [
      ...current,
      ...group.recipients.map((recipient) => ({
        name: recipient.name,
        email: recipient.email,
        blocks: recipient.blocks ?? selectedBlocks,
      })),
    ]);
  }

  function savePreset() {
    const preset: SavedPreset = {
      id: crypto.randomUUID(),
      name,
      template,
      recipients,
    };
    const next = [preset, ...savedPresets].slice(0, 12);
    setSavedPresets(next);
    localStorage.setItem('msp_email_report_presets', JSON.stringify(next));
    setMessage('Preset saved');
  }

  function loadPreset(id: string) {
    const preset = savedPresets.find((item) => item.id === id);
    if (!preset) return;
    setName(preset.template.name);
    setSubject(preset.template.subject);
    setEstateName(preset.template.estateName);
    setDate(preset.template.date);
    setCustomText(preset.template.customText);
    setSelectedBlocks(preset.template.defaultBlocks);
    setRecipients(preset.recipients);
    setPreview(null);
    setActiveRecipient(0);
    setMessage(`Loaded preset: ${preset.name}`);
  }

  async function buildPreview() {
    if (!hasEmailAuth()) {
      const refreshed = await refreshPinSession();
      if (!refreshed && !hasEmailAuth()) {
        setMessage('Email access could not verify your admin session. Sign out, sign back in as admin, then retry.');
        return null;
      }
    }

    setLoadingPreview(true);
    setMessage('');
    setPreview(null);

    let response: Response;
    try {
      response = await emailFetch('/api/email/reports/preview', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ template, recipients }),
      });
    } catch {
      setLoadingPreview(false);
      setMessage('Could not build preview');
      return null;
    }

    const body = await response.json().catch(() => null) as PreviewResponse | null;
    setLoadingPreview(false);

    if (!response.ok || !body) {
      setMessage(friendlyEmailError(body?.error, 'Could not build preview'));
      return null;
    }

    setPreview(body);
    setActiveRecipient(0);
    return body;
  }

  async function loadPreview() {
    await buildPreview();
  }

  async function submitBatch(action: 'send_now' | 'schedule') {
    if (!hasEmailAuth()) {
      const refreshed = await refreshPinSession();
      if (!refreshed && !hasEmailAuth()) {
        setMessage('Email access could not verify your admin session. Sign out, sign back in as admin, then retry.');
        return;
      }
    }

    if (!hasRecipients) {
      setMessage('Add at least one recipient email address');
      return;
    }
    const previewForSend = preview ?? await buildPreview();
    if (!previewForSend) return;

    if (action === 'send_now' && !window.confirm(`Send this report batch to ${recipients.length} recipient(s)?`)) return;
    const scheduleDate = action === 'schedule' ? new Date(scheduleAt) : null;
    if (action === 'schedule' && (!scheduleDate || Number.isNaN(scheduleDate.getTime()))) {
      setMessage('Choose a valid schedule time');
      return;
    }

    setSending(true);
    setMessage('');

    const response = await emailFetch('/api/email/reports/batches', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        action,
        template,
        recipients,
        scheduledFor: action === 'schedule' ? scheduleDate!.toISOString() : null,
      }),
    });
    const body = await response.json().catch(() => null) as {
      id?: string;
      status?: string;
      error?: string;
      recipients?: number;
      sent?: number;
      logged?: number;
      failed?: number;
    } | null;
    setSending(false);

    if (!response.ok) {
      setMessage(friendlyEmailError(body?.error, 'Could not submit email batch'));
      return;
    }

    if (action === 'schedule') {
      setMessage(`Batch scheduled for ${new Date(scheduleAt).toLocaleString('en-IN')}`);
      return;
    }

    if (body?.status === 'logged') {
      setMessage('Batch logged only. Add Resend credentials in Vercel to send live emails.');
      return;
    }

    if (body?.status === 'partial') {
      setMessage(`Batch partially completed: ${body.sent ?? 0} sent, ${body.logged ?? 0} logged, ${body.failed ?? 0} failed.`);
      return;
    }

    setMessage(`Batch submitted: ${body?.sent ?? recipients.length} sent.`);
  }

  return (
    <div style={{ maxWidth: 1360, margin: '0 auto', display: 'grid', gap: 18 }}>
      <div>
        <div style={{ color: 'var(--t-muted)', fontSize: 12, fontWeight: 800, textTransform: 'uppercase' }}>Estate Management / Email Reports</div>
        <h1 style={{ margin: '4px 0 0', color: 'var(--t-heading)', fontSize: '1.55rem', fontWeight: 850 }}>Email Reports</h1>
        <p style={{ margin: '0.25rem 0 0', color: 'var(--t-muted)', fontSize: 14 }}>Build personalised report batches, preview each recipient, then send now or schedule.</p>
      </div>

      {providerStatus && (
        <div style={{
          ...card,
          padding: '11px 14px',
          color: providerStatus.configured ? 'var(--t-heading)' : '#8a5b00',
          background: providerStatus.configured ? 'var(--t-subtle)' : '#fff8e1',
          fontSize: 13,
          fontWeight: 750,
        }}>
          {providerStatus.configured
            ? `Email delivery ready via ${providerStatus.provider}. From: ${providerStatus.from}`
            : `Email delivery is not configured. Attempts will be logged only. Provider: ${providerStatus.provider}, From: ${providerStatus.from}`}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(360px, 520px) minmax(0, 1fr)', gap: 18, alignItems: 'start' }}>
        <div style={{ display: 'grid', gap: 14 }}>
          <section style={{ ...card, padding: 16, display: 'grid', gap: 12 }}>
            <StepTitle step="1" title="Choose Content Pages" />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <label style={{ display: 'grid', gap: 5, fontSize: 12, fontWeight: 800 }}>
                Template Name
                <input value={name} onChange={(event) => setName(event.target.value)} style={input} />
              </label>
              <label style={{ display: 'grid', gap: 5, fontSize: 12, fontWeight: 800 }}>
                Date
                <input type="date" value={date} onChange={(event) => setDate(event.target.value)} style={input} />
              </label>
            </div>
            <label style={{ display: 'grid', gap: 5, fontSize: 12, fontWeight: 800 }}>
              Subject
              <input value={subject} onChange={(event) => setSubject(event.target.value)} style={input} />
            </label>
            <label style={{ display: 'grid', gap: 5, fontSize: 12, fontWeight: 800 }}>
              Estate / Company
              <input value={estateName} onChange={(event) => setEstateName(event.target.value)} style={input} />
            </label>

            <div style={{ display: 'grid', gap: 8 }}>
              {REPORT_BLOCKS.map((block) => (
                <label key={block.id} style={{ display: 'grid', gridTemplateColumns: '18px 1fr', gap: 10, padding: 10, borderRadius: 8, border: '1px solid var(--t-border)', background: selectedBlocks.includes(block.id) ? 'var(--t-subtle)' : 'transparent', cursor: 'pointer' }}>
                  <input type="checkbox" checked={selectedBlocks.includes(block.id)} onChange={() => toggleBlock(block.id)} style={{ marginTop: 3 }} />
                  <span>
                    <span style={{ display: 'block', color: 'var(--t-heading)', fontWeight: 850, fontSize: 13 }}>{block.label}</span>
                    <span style={{ display: 'block', color: 'var(--t-muted)', fontSize: 12, marginTop: 2 }}>{block.description}</span>
                  </span>
                </label>
              ))}
            </div>
          </section>

          <section style={{ ...card, padding: 16, display: 'grid', gap: 12 }}>
            <StepTitle step="2" title="Recipients & Personalisation" />
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button type="button" onClick={addRecipient} style={secondaryButton}><Plus size={14} /> Add recipient</button>
              <select defaultValue="" onChange={(event) => { applyGroup(event.target.value); event.currentTarget.value = ''; }} style={{ ...input, width: 'auto', minWidth: 210 }}>
                <option value="">Add preset group...</option>
                {RECIPIENT_GROUPS.map((group) => <option key={group.id} value={group.id}>{group.label}</option>)}
              </select>
              <select defaultValue="" onChange={(event) => { loadPreset(event.target.value); event.currentTarget.value = ''; }} style={{ ...input, width: 'auto', minWidth: 210 }}>
                <option value="">Load saved preset...</option>
                {savedPresets.map((preset) => <option key={preset.id} value={preset.id}>{preset.name}</option>)}
              </select>
            </div>

            {recipients.map((recipient, index) => (
              <div key={`${recipient.email}-${index}`} style={{ border: '1px solid var(--t-border)', borderRadius: 8, padding: 10, display: 'grid', gap: 9 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.3fr 34px', gap: 8 }}>
                  <input value={recipient.name} onChange={(event) => updateRecipient(index, 'name', event.target.value)} placeholder="Recipient name" style={input} />
                  <input value={recipient.email} onChange={(event) => updateRecipient(index, 'email', event.target.value)} placeholder="email@example.com" style={input} />
                  <button type="button" onClick={() => removeRecipient(index)} style={iconButton} title="Remove recipient"><Trash2 size={15} /></button>
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {REPORT_BLOCKS.map((block) => (
                    <button key={block.id} type="button" onClick={() => toggleRecipientBlock(index, block.id)} style={recipient.blocks.includes(block.id) ? pillActive : pill}>
                      {block.label}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </section>

          <section style={{ ...card, padding: 16, display: 'grid', gap: 12 }}>
            <StepTitle step="3" title="Rich Text & Variables" />
            <textarea value={customText} onChange={(event) => setCustomText(event.target.value)} rows={7} style={{ ...input, resize: 'vertical', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }} />
            <div style={{ color: 'var(--t-muted)', fontSize: 12 }}>Variables: {'{{estate_name}}'}, {'{{date}}'}, {'{{recipient_name}}'}, {'{{recipient_email}}'}</div>
          </section>

          <section style={{ ...card, padding: 16, display: 'grid', gap: 12 }}>
            <StepTitle step="4" title="Preview, Send, or Schedule" />
            {message && <div style={{ padding: 10, borderRadius: 8, border: '1px solid var(--t-border)', background: message.includes('Could not') ? '#fff1f1' : 'var(--t-subtle)', color: message.includes('Could not') ? '#9f1239' : 'var(--t-heading)', fontSize: 13 }}>{message}</div>}
            <label style={{ display: 'grid', gap: 5, fontSize: 12, fontWeight: 800 }}>
              Schedule Time
              <input type="datetime-local" value={scheduleAt} onChange={(event) => setScheduleAt(event.target.value)} style={input} />
            </label>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
              <button type="button" onClick={loadPreview} disabled={loadingPreview || !hasRecipients} style={buttonStyle(secondaryButton, loadingPreview || !hasRecipients)}><Eye size={14} /> {loadingPreview ? 'Previewing...' : 'Preview'}</button>
              <button type="button" onClick={() => submitBatch('schedule')} disabled={sending || loadingPreview || !hasRecipients} style={buttonStyle(secondaryButton, sending || loadingPreview || !hasRecipients)}><CalendarClock size={14} /> Schedule</button>
              <button type="button" onClick={savePreset} style={secondaryButton}><Save size={14} /> Save as Preset</button>
              <button type="button" onClick={() => submitBatch('send_now')} disabled={sending || loadingPreview || !hasRecipients} style={buttonStyle(primaryButton, sending || loadingPreview || !hasRecipients)}><Send size={14} /> {sending ? 'Sending...' : 'Send Now'}</button>
            </div>
          </section>
        </div>

        <section style={{ ...card, overflow: 'hidden', minHeight: 700 }}>
          <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--t-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
              <Mail size={17} style={{ color: 'var(--t-heading)' }} />
              <div>
                <div style={{ color: 'var(--t-heading)', fontWeight: 850 }}>Live Preview</div>
                <div style={{ color: 'var(--t-muted)', fontSize: 12 }}>{preview?.from ? `From: ${preview.from}` : 'Preview shows the selected recipient package.'}</div>
              </div>
            </div>
            {preview?.previews.length ? (
              <select value={activeRecipient} onChange={(event) => setActiveRecipient(Number(event.target.value))} style={{ ...input, width: 260 }}>
                {preview.previews.map((item, index) => <option key={item.recipient.email} value={index}>{item.recipient.name || item.recipient.email}</option>)}
              </select>
            ) : null}
          </div>

          {activePreview ? (
            <div>
              <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--t-border)', background: 'var(--t-subtle)' }}>
                <div style={{ color: 'var(--t-muted)', fontSize: 11, fontWeight: 850, textTransform: 'uppercase' }}>Subject</div>
                <div style={{ color: 'var(--t-heading)', fontWeight: 850, marginTop: 2 }}>{activePreview.subject}</div>
              </div>
              <iframe title="Email preview" srcDoc={activePreview.html} style={{ display: 'block', width: '100%', minHeight: 590, border: 'none', background: '#f7f1e4' }} />
            </div>
          ) : (
            <div style={{ padding: 42, textAlign: 'center', color: 'var(--t-muted)' }}>
              <CheckCircle2 size={26} style={{ margin: '0 auto 10px', color: 'var(--t-heading)' }} />
              Select content and recipients, then click Preview.
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function StepTitle({ step, title }: { step: string; title: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
      <span style={{ display: 'inline-flex', width: 24, height: 24, alignItems: 'center', justifyContent: 'center', borderRadius: 999, background: 'var(--t-heading)', color: '#fff', fontSize: 12, fontWeight: 850 }}>{step}</span>
      <h2 style={{ margin: 0, color: 'var(--t-heading)', fontSize: 15, fontWeight: 850 }}>{title}</h2>
    </div>
  );
}

const secondaryButton: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 7,
  border: '1px solid var(--t-border)',
  background: 'var(--t-card)',
  color: 'var(--t-heading)',
  borderRadius: 8,
  padding: '9px 12px',
  fontWeight: 850,
  cursor: 'pointer',
};

const primaryButton: React.CSSProperties = {
  ...secondaryButton,
  border: '1px solid var(--t-heading)',
  background: 'var(--t-heading)',
  color: '#fff',
};

function buttonStyle(style: React.CSSProperties, disabled: boolean): React.CSSProperties {
  return {
    ...style,
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.58 : 1,
  };
}

const iconButton: React.CSSProperties = {
  ...secondaryButton,
  width: 34,
  height: 38,
  padding: 0,
  justifyContent: 'center',
};

const pill: React.CSSProperties = {
  border: '1px solid var(--t-border)',
  background: 'var(--t-card)',
  color: 'var(--t-muted)',
  borderRadius: 999,
  padding: '4px 8px',
  fontSize: 11,
  fontWeight: 800,
  cursor: 'pointer',
};

const pillActive: React.CSSProperties = {
  ...pill,
  background: 'var(--t-heading)',
  color: '#fff',
  borderColor: 'var(--t-heading)',
};
