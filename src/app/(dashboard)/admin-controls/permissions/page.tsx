'use client';

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { Lock, RefreshCw, Save, CheckCircle2, AlertTriangle, Info } from 'lucide-react';

// ── All pages and their default role access ────────────────────────────────
const PAGES = [
  { href: '/rainfall',              label: 'Rain Gauge',            defaults: ['admin', 'supervisor', 'worker'] },
  { href: '/fuel-expenses',         label: 'Fleet Fuel Expenses',   defaults: ['admin', 'supervisor'] },
  { href: '/ho-fuel',               label: 'HO Fuel',               defaults: ['admin', 'supervisor'] },
  { href: '/processing-dashboard',  label: 'Processing Dashboard',  defaults: ['admin', 'supervisor'] },
  { href: '/labour-costs',          label: 'Labour Costs',          defaults: ['admin'] },
  { href: '/daily-report',          label: 'Daily Report',          defaults: ['admin', 'supervisor', 'worker'] },
  { href: '/muster-roll',           label: 'Muster Roll',           defaults: ['admin', 'supervisor', 'worker'] },
  { href: '/harvest-yield',         label: 'Harvest Yield',         defaults: ['admin', 'supervisor'] },
  { href: '/nursery',               label: 'Nursery',               defaults: ['admin', 'supervisor'] },
  { href: '/spraying-log',          label: 'Spraying Log',          defaults: ['admin', 'supervisor'] },
  { href: '/vehicle-log',           label: 'Vehicle Log',           defaults: ['admin', 'supervisor'] },
  { href: '/store-inventory',       label: 'Store Inventory',       defaults: ['admin', 'supervisor', 'worker'] },
  { href: '/shopify-orders',        label: 'Shopify Orders',        defaults: ['admin', 'supervisor', 'worker'] },
  { href: '/weather',               label: 'Weather',               defaults: ['admin', 'supervisor', 'worker'] },
  { href: '/ai-insights',           label: 'AI Insights',           defaults: ['admin', 'supervisor', 'worker'] },
];

const ROLES = ['supervisor', 'worker'] as const; // admin is always locked

type PermMap = Record<string, Record<string, boolean>>;

// ── Style tokens ───────────────────────────────────────────────────────────
const card: React.CSSProperties = {
  background: '#ffffff',
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
  color: '#6b7280',
  borderBottom: '1px solid #e5dfc8',
  background: '#f9f6ed',
  whiteSpace: 'nowrap',
};

const tdStyle: React.CSSProperties = {
  padding: '10px 14px',
  fontSize: '13px',
  color: '#1a1a1a',
  borderBottom: '1px solid #f0ead4',
  verticalAlign: 'middle',
};

// ── Toggle switch ──────────────────────────────────────────────────────────
function Toggle({ checked, locked, onChange }: { checked: boolean; locked?: boolean; onChange?: (v: boolean) => void }) {
  return (
    <button
      onClick={() => !locked && onChange?.(!checked)}
      disabled={locked}
      style={{
        width: 36, height: 20, borderRadius: 10, border: 'none', cursor: locked ? 'not-allowed' : 'pointer',
        background: checked ? '#1b4a1b' : '#d1d5db',
        position: 'relative', transition: 'background 0.2s', flexShrink: 0,
        opacity: locked ? 0.5 : 1,
      }}
    >
      <span style={{
        position: 'absolute', top: 2, left: checked ? 18 : 2,
        width: 16, height: 16, borderRadius: '50%', background: 'white',
        transition: 'left 0.2s', display: 'block',
        boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
      }} />
    </button>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────
export default function PermissionsPage() {
  const [perms,    setPerms]    = useState<PermMap>({});
  const [loading,  setLoading]  = useState(true);
  const [saving,   setSaving]   = useState(false);
  const [saved,    setSaved]    = useState(false);
  const [dbReady,  setDbReady]  = useState(true);
  const [toast,    setToast]    = useState('');

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3000); };

  // ── Build default perms map ──────────────────────────────────────────────
  const buildDefaults = useCallback((): PermMap => {
    const map: PermMap = {};
    for (const p of PAGES) {
      map[p.href] = {};
      for (const r of ROLES) {
        map[p.href][r] = p.defaults.includes(r);
      }
    }
    return map;
  }, []);

  // ── Load from Supabase ───────────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true);
    const defaults = buildDefaults();

    const { data, error } = await supabase
      .from('role_permissions')
      .select('page_href, role, allowed');

    if (error) {
      // Table likely doesn't exist yet
      setDbReady(false);
      setPerms(defaults);
      setLoading(false);
      return;
    }

    setDbReady(true);
    const merged = buildDefaults();
    for (const row of data ?? []) {
      if (merged[row.page_href]) {
        merged[row.page_href][row.role] = row.allowed;
      }
    }
    setPerms(merged);
    setLoading(false);
  }, [buildDefaults]);

  useEffect(() => { load(); }, [load]);

  // ── Toggle a permission ──────────────────────────────────────────────────
  const toggle = (href: string, role: string, val: boolean) => {
    setPerms(prev => ({
      ...prev,
      [href]: { ...prev[href], [role]: val },
    }));
    setSaved(false);
  };

  // ── Save to Supabase ─────────────────────────────────────────────────────
  const save = async () => {
    setSaving(true);
    const rows = [];
    for (const [href, roleMap] of Object.entries(perms)) {
      for (const [role, allowed] of Object.entries(roleMap)) {
        rows.push({ page_href: href, role, allowed });
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

  const SQL = `-- Run this once in your Supabase SQL editor
CREATE TABLE IF NOT EXISTS role_permissions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  page_href   text NOT NULL,
  role        text NOT NULL,
  allowed     boolean NOT NULL DEFAULT true,
  updated_at  timestamptz DEFAULT now(),
  UNIQUE (page_href, role)
);
ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_all" ON role_permissions FOR ALL USING (true) WITH CHECK (true);`;

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#1b4a1b', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Lock size={22} style={{ color: '#1b4a1b' }} />
            Role & Permissions
          </h1>
          <p style={{ color: '#6b7280', fontSize: '0.875rem', margin: '0.25rem 0 0' }}>
            Control which roles can access each module. Admin always has full access.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={load} disabled={loading}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', borderRadius: '8px',
              background: '#f9f6ed', color: '#1b4a1b', border: '1px solid #e5dfc8', cursor: 'pointer', fontWeight: 600, fontSize: '13px' }}>
            <RefreshCw size={13} />
            Refresh
          </button>
          <button onClick={save} disabled={saving || !dbReady}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', borderRadius: '8px',
              background: saved ? '#16a34a' : '#1b4a1b', color: 'white', border: 'none', cursor: dbReady ? 'pointer' : 'not-allowed',
              fontWeight: 600, fontSize: '13px', opacity: !dbReady ? 0.5 : 1 }}>
            {saved ? <CheckCircle2 size={13} /> : <Save size={13} />}
            {saved ? 'Saved' : 'Save Changes'}
          </button>
        </div>
      </div>

      {/* DB setup banner */}
      {!dbReady && (
        <div style={{ ...card, padding: '1.25rem', marginBottom: '1.5rem', borderLeft: '4px solid #b8920a', background: '#fffbeb' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '0.75rem' }}>
            <AlertTriangle size={16} style={{ color: '#b8920a', flexShrink: 0 }} />
            <strong style={{ color: '#92400e', fontSize: '14px' }}>Database table required</strong>
          </div>
          <p style={{ color: '#92400e', fontSize: '13px', marginBottom: '0.75rem' }}>
            Run this SQL once in your Supabase SQL Editor to enable dynamic permissions:
          </p>
          <pre style={{ background: '#1a1a2e', color: '#86efac', borderRadius: '8px', padding: '12px',
            fontSize: '12px', overflowX: 'auto', margin: 0, lineHeight: 1.6 }}>
            {SQL}
          </pre>
        </div>
      )}

      {/* Info banner */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px', borderRadius: '8px',
        background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.15)', marginBottom: '1.25rem', fontSize: '13px', color: '#1e40af' }}>
        <Info size={14} style={{ flexShrink: 0 }} />
        Changes take effect on the user&apos;s next page load. Admin access cannot be removed.
      </div>

      {/* Permission grid */}
      <div style={{ ...card, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ ...thStyle, textAlign: 'left', width: '40%' }}>Module</th>
              {/* Admin — always locked */}
              <th style={{ ...thStyle }}>
                <span style={{ background: '#1b4a1b', color: 'white', borderRadius: '999px',
                  padding: '2px 10px', fontSize: '11px', fontWeight: 700 }}>Admin</span>
              </th>
              {ROLES.map(r => (
                <th key={r} style={{ ...thStyle }}>
                  <span style={{
                    background: r === 'supervisor' ? '#1a3a6e' : '#6b3a1f',
                    color: 'white', borderRadius: '999px', padding: '2px 10px', fontSize: '11px', fontWeight: 700, textTransform: 'capitalize',
                  }}>{r}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={4} style={{ ...tdStyle, textAlign: 'center', padding: '2.5rem', color: '#9ca3af' }}>
                Loading…
              </td></tr>
            ) : PAGES.map((page, idx) => (
              <tr key={page.href}
                style={{ background: idx % 2 === 0 ? 'white' : '#faf8f2' }}
                onMouseEnter={e => (e.currentTarget.style.background = '#f3f0e6')}
                onMouseLeave={e => (e.currentTarget.style.background = idx % 2 === 0 ? 'white' : '#faf8f2')}>
                <td style={tdStyle}>
                  <span style={{ fontWeight: 600, color: '#1a1a1a' }}>{page.label}</span>
                  <span style={{ fontSize: '11px', color: '#9ca3af', marginLeft: '6px' }}>{page.href}</span>
                </td>
                {/* Admin — always on, locked */}
                <td style={{ ...tdStyle, textAlign: 'center' }}>
                  <Toggle checked locked />
                </td>
                {ROLES.map(role => (
                  <td key={role} style={{ ...tdStyle, textAlign: 'center' }}>
                    <Toggle
                      checked={perms[page.href]?.[role] ?? false}
                      onChange={v => toggle(page.href, role, v)}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Toast */}
      {toast && (
        <div style={{ position: 'fixed', bottom: '1.5rem', left: '50%', transform: 'translateX(-50%)',
          background: '#1b4a1b', color: 'white', padding: '10px 20px', borderRadius: '10px',
          fontSize: '13px', fontWeight: 600, zIndex: 100, boxShadow: '0 4px 16px rgba(0,0,0,0.2)' }}>
          {toast}
        </div>
      )}
    </div>
  );
}
