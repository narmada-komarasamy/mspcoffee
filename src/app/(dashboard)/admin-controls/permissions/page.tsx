'use client';

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { Lock, RefreshCw, Save, CheckCircle2, AlertTriangle, Info } from 'lucide-react';

// ── All pages and their default role access ────────────────────────────────
type Access = 'none' | 'view' | 'full';

const PAGES = [
  { href: '/rainfall',             label: 'Rain Gauge',           defaults: { supervisor: 'full' as Access, worker: 'full' as Access, hr: 'none' as Access } },
  { href: '/fuel-expenses',        label: 'Fleet Fuel Expenses',  defaults: { supervisor: 'full' as Access, worker: 'none' as Access, hr: 'none' as Access } },
  { href: '/ho-fuel',              label: 'HO Fuel',              defaults: { supervisor: 'full' as Access, worker: 'none' as Access, hr: 'none' as Access } },
  { href: '/operations-calendar',  label: 'Operations Calendar',  defaults: { supervisor: 'full' as Access, worker: 'full' as Access, hr: 'full' as Access } },
  { href: '/estate-management',    label: 'Estate Management',    defaults: { supervisor: 'full' as Access, worker: 'none' as Access, hr: 'none' as Access } },
  { href: '/processing-dashboard', label: 'Processing Dashboard', defaults: { supervisor: 'full' as Access, worker: 'none' as Access, hr: 'none' as Access } },
  { href: '/labour-costs',         label: 'Labour Costs',         defaults: { supervisor: 'none' as Access, worker: 'none' as Access, hr: 'none' as Access } },
  { href: '/labour-activities',    label: 'Labour Activities',    defaults: { supervisor: 'none' as Access, worker: 'none' as Access, hr: 'full' as Access } },
  { href: '/daily-report',         label: 'Daily Report',         defaults: { supervisor: 'full' as Access, worker: 'full' as Access, hr: 'none' as Access } },
  { href: '/muster-roll',          label: 'Muster Roll',          defaults: { supervisor: 'full' as Access, worker: 'full' as Access, hr: 'none' as Access } },
  { href: '/harvest-yield',        label: 'Harvest Yield',        defaults: { supervisor: 'full' as Access, worker: 'none' as Access, hr: 'none' as Access } },
  { href: '/nursery',              label: 'Nursery',              defaults: { supervisor: 'full' as Access, worker: 'none' as Access, hr: 'none' as Access } },
  { href: '/spraying-log',         label: 'Spraying Log',         defaults: { supervisor: 'full' as Access, worker: 'none' as Access, hr: 'none' as Access } },
  { href: '/vehicle-log',          label: 'Vehicle Log',          defaults: { supervisor: 'full' as Access, worker: 'none' as Access, hr: 'none' as Access } },
  { href: '/store-inventory',      label: 'Store Inventory',      defaults: { supervisor: 'full' as Access, worker: 'full' as Access, hr: 'none' as Access } },
  { href: '/coffee-trading',       label: 'Coffee Trading / Green Store', defaults: { supervisor: 'full' as Access, worker: 'none' as Access, hr: 'none' as Access } },
  { href: '/shopify-orders',       label: 'Shopify Orders',       defaults: { supervisor: 'full' as Access, worker: 'full' as Access, hr: 'none' as Access } },
  { href: '/weather',              label: 'Weather',              defaults: { supervisor: 'full' as Access, worker: 'full' as Access, hr: 'none' as Access } },
  { href: '/ai-insights',          label: 'AI Insights',          defaults: { supervisor: 'full' as Access, worker: 'full' as Access, hr: 'none' as Access } },
];

const ROLES = ['supervisor', 'worker', 'hr'] as const;

type PermMap = Record<string, Record<string, Access>>;

// ── Style tokens ───────────────────────────────────────────────────────────
const card: React.CSSProperties = {
  background: 'var(--t-card)',
  border: '1px solid #e5dfc8',
  borderRadius: '12px',
  boxShadow: '0 2px 8px rgba(27,74,27,0.07)',
};

const thStyle: React.CSSProperties = {
  padding: '10px 14px',
  textAlign: 'center',
  fontSize: '11px',
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  color: 'var(--t-muted)',
  borderBottom: '1px solid #e5dfc8',
  background: 'var(--t-subtle)',
  whiteSpace: 'nowrap',
};

const tdStyle: React.CSSProperties = {
  padding: '10px 14px',
  fontSize: '13px',
  color: 'var(--t-text)',
  borderBottom: '1px solid #f0ead4',
  verticalAlign: 'middle',
};

const ACCESS_OPTIONS: { value: Access; label: string; color: string; bg: string }[] = [
  { value: 'none', label: 'No Access', color: 'var(--t-muted)', bg: '#f3f4f6' },
  { value: 'view', label: 'View Only', color: '#1a3a6e', bg: '#dbeafe' },
  { value: 'full', label: 'Full',      color: 'var(--t-heading)', bg: '#dcfce7' },
];

// ── 3-state segmented control ──────────────────────────────────────────────
function AccessControl({ value, locked, onChange }: {
  value: Access;
  locked?: boolean;
  onChange?: (v: Access) => void;
}) {
  if (locked) {
    return (
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px',
        background: '#dcfce7', border: '1px solid #bbf7d0', borderRadius: '8px', padding: '3px 10px' }}>
        <Lock size={10} style={{ color: 'var(--t-heading)' }} />
        <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--t-heading)' }}>Full</span>
      </div>
    );
  }

  return (
    <div style={{ display: 'inline-flex', borderRadius: '8px', overflow: 'hidden',
      border: '1px solid #e5dfc8', background: 'var(--t-subtle)' }}>
      {ACCESS_OPTIONS.map((opt, i) => {
        const active = value === opt.value;
        return (
          <button
            key={opt.value}
            onClick={() => onChange?.(opt.value)}
            style={{
              padding: '5px 10px',
              fontSize: '11px',
              fontWeight: active ? 700 : 500,
              border: 'none',
              borderRight: i < ACCESS_OPTIONS.length - 1 ? '1px solid #e5dfc8' : 'none',
              cursor: 'pointer',
              background: active ? opt.bg : 'transparent',
              color: active ? opt.color : 'var(--t-muted)',
              transition: 'all 0.15s',
              whiteSpace: 'nowrap',
            }}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────
export default function PermissionsPage() {
  const [perms,   setPerms]   = useState<PermMap>({});
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(false);
  const [saved,   setSaved]   = useState(false);
  const [dbReady, setDbReady] = useState(true);
  const [toast,   setToast]   = useState('');

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3000); };

  const buildDefaults = useCallback((): PermMap => {
    const map: PermMap = {};
    for (const p of PAGES) {
      map[p.href] = { supervisor: p.defaults.supervisor, worker: p.defaults.worker, hr: p.defaults.hr };
    }
    return map;
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('role_permissions')
      .select('page_href, role, access');

    if (error) {
      setDbReady(false);
      setPerms(buildDefaults());
      setLoading(false);
      return;
    }

    setDbReady(true);
    const merged = buildDefaults();
    for (const row of data ?? []) {
      if (merged[row.page_href] && row.access) {
        merged[row.page_href][row.role] = row.access as Access;
      }
    }
    setPerms(merged);
    setLoading(false);
  }, [buildDefaults]);

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) void load();
    });
    return () => {
      cancelled = true;
    };
  }, [load]);

  const toggle = (href: string, role: string, val: Access) => {
    setPerms(prev => ({ ...prev, [href]: { ...prev[href], [role]: val } }));
    setSaved(false);
  };

  const save = async () => {
    setSaving(true);
    const rows = [];
    for (const [href, roleMap] of Object.entries(perms)) {
      for (const [role, access] of Object.entries(roleMap)) {
        rows.push({ page_href: href, role, access });
      }
    }

    const { error } = await supabase
      .from('role_permissions')
      .upsert(rows, { onConflict: 'page_href,role' });

    setSaving(false);
    if (error) { showToast('Error saving: ' + error.message); return; }
    setSaved(true);
    showToast('Permissions saved');
  };

  const SQL = `-- Run this in your Supabase SQL editor to upgrade the table
ALTER TABLE role_permissions
  ADD COLUMN IF NOT EXISTS access text NOT NULL DEFAULT 'full';

-- Migrate existing boolean data
UPDATE role_permissions SET access = CASE WHEN allowed THEN 'full' ELSE 'none' END;`;

  return (
    <div style={{ maxWidth: '960px', margin: '0 auto' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--t-heading)', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Lock size={22} style={{ color: 'var(--t-heading)' }} />
            Role & Permissions
          </h1>
          <p style={{ color: 'var(--t-muted)', fontSize: '0.875rem', margin: '0.25rem 0 0' }}>
            Control which roles can access each module. Admin always has full access.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={load} disabled={loading}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', borderRadius: '8px',
              background: 'var(--t-subtle)', color: 'var(--t-heading)', border: '1px solid #e5dfc8', cursor: 'pointer', fontWeight: 600, fontSize: '13px' }}>
            <RefreshCw size={13} />
            Refresh
          </button>
          <button onClick={save} disabled={saving || !dbReady}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', borderRadius: '8px',
              background: saved ? '#16a34a' : 'var(--t-heading)', color: 'white', border: 'none',
              cursor: dbReady ? 'pointer' : 'not-allowed', fontWeight: 600, fontSize: '13px', opacity: !dbReady ? 0.5 : 1 }}>
            {saved ? <CheckCircle2 size={13} /> : <Save size={13} />}
            {saved ? 'Saved' : 'Save Changes'}
          </button>
        </div>
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
        {ACCESS_OPTIONS.map(opt => (
          <div key={opt.value} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 3, background: opt.bg, border: `1px solid ${opt.color}33` }} />
            <span style={{ fontSize: '12px', color: 'var(--t-muted)', fontWeight: 600 }}>{opt.label}</span>
          </div>
        ))}
        <span style={{ fontSize: '12px', color: 'var(--t-muted)', marginLeft: '4px' }}>— View Only = can see the page, cannot edit</span>
      </div>

      {/* DB upgrade banner */}
      {!dbReady && (
        <div style={{ ...card, padding: '1.25rem', marginBottom: '1.5rem', borderLeft: '4px solid #b8920a', background: '#fffbeb' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '0.75rem' }}>
            <AlertTriangle size={16} style={{ color: '#b8920a', flexShrink: 0 }} />
            <strong style={{ color: '#92400e', fontSize: '14px' }}>Database migration required</strong>
          </div>
          <p style={{ color: '#92400e', fontSize: '13px', marginBottom: '0.75rem' }}>
            Run this SQL in your Supabase SQL Editor:
          </p>
          <pre style={{ background: '#1a1a2e', color: '#86efac', borderRadius: '8px', padding: '12px',
            fontSize: '12px', overflowX: 'auto', margin: 0, lineHeight: 1.6 }}>{SQL}</pre>
        </div>
      )}

      {/* Info */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px', borderRadius: '8px',
        background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.15)', marginBottom: '1.25rem', fontSize: '13px', color: '#1e40af' }}>
        <Info size={14} style={{ flexShrink: 0 }} />
        Changes take effect on the user&apos;s next page load. Admin access cannot be changed.
      </div>

      {/* Grid */}
      <div style={{ ...card, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ ...thStyle, textAlign: 'left', width: '35%' }}>Module</th>
              <th style={{ ...thStyle }}>
                <span style={{ background: 'var(--t-heading)', color: 'white', borderRadius: '999px', padding: '2px 10px', fontSize: '11px', fontWeight: 700 }}>Admin</span>
              </th>
              {ROLES.map(r => (
                <th key={r} style={{ ...thStyle }}>
                  <span style={{ background: r === 'supervisor' ? '#1a3a6e' : r === 'hr' ? '#7a1f35' : '#6b3a1f', color: 'white', borderRadius: '999px', padding: '2px 10px', fontSize: '11px', fontWeight: 700, textTransform: 'capitalize' }}>{r}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={2 + ROLES.length} style={{ ...tdStyle, textAlign: 'center', padding: '2.5rem', color: 'var(--t-muted)' }}>Loading…</td></tr>
            ) : PAGES.map((page, idx) => (
              <tr key={page.href}
                style={{ background: idx % 2 === 0 ? 'white' : 'var(--t-subtle)' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--t-surface)')}
                onMouseLeave={e => (e.currentTarget.style.background = idx % 2 === 0 ? 'white' : 'var(--t-subtle)')}>
                <td style={tdStyle}>
                  <span style={{ fontWeight: 600, color: 'var(--t-text)' }}>{page.label}</span>
                  <span style={{ fontSize: '11px', color: 'var(--t-muted)', marginLeft: '6px' }}>{page.href}</span>
                </td>
                <td style={{ ...tdStyle, textAlign: 'center' }}>
                  <AccessControl value="full" locked />
                </td>
                {ROLES.map(role => (
                  <td key={role} style={{ ...tdStyle, textAlign: 'center' }}>
                    <AccessControl
                      value={perms[page.href]?.[role] ?? 'none'}
                      onChange={v => toggle(page.href, role, v)}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {toast && (
        <div style={{ position: 'fixed', bottom: '1.5rem', left: '50%', transform: 'translateX(-50%)',
          background: 'var(--t-heading)', color: 'white', padding: '10px 20px', borderRadius: '10px',
          fontSize: '13px', fontWeight: 600, zIndex: 100, boxShadow: '0 4px 16px rgba(0,0,0,0.2)' }}>
          {toast}
        </div>
      )}
    </div>
  );
}
