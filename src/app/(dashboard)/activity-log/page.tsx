'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import {
  Monitor,
  Smartphone,
  Tablet,
  Clock,
  Users,
  BarChart2,
  Activity,
  RefreshCw,
  Search,
  Filter,
  Globe,
} from 'lucide-react';

// ── Types ──────────────────────────────────────────────────────────────────

interface ActivityRow {
  id: number;
  user_id: string;
  user_name: string;
  user_role: string;
  page_path: string;
  page_label: string;
  entered_at: string;
  duration_secs: number | null;
  device_type: 'mobile' | 'tablet' | 'desktop';
  ip_address: string;
  user_agent: string;
  session_id: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────

function fmtDuration(secs: number | null): string {
  if (secs === null || secs === 0) return '—';
  if (secs < 60) return `${secs}s`;
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return s > 0 ? `${m}m ${s}s` : `${m}m`;
}

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function DeviceIcon({ type }: { type: string }) {
  const cls = 'h-4 w-4';
  if (type === 'mobile')  return <Smartphone className={cls} style={{ color: '#e8993a' }} />;
  if (type === 'tablet')  return <Tablet     className={cls} style={{ color: '#9b59d6' }} />;
  return                         <Monitor    className={cls} style={{ color: '#3b82f6' }} />;
}

function RolePill({ role }: { role: string }) {
  const map: Record<string, string> = {
    admin:      '#1b4a1b',
    supervisor: '#1a3a6e',
    worker:     '#6b3a1f',
    hr:         '#7a1f35',
    manager:    '#2a3540',
  };
  const bg = map[role.toLowerCase()] ?? '#6b7280';
  return (
    <span style={{
      background: bg, color: 'white',
      borderRadius: '999px', padding: '2px 8px',
      fontSize: '11px', fontWeight: 700, textTransform: 'capitalize',
      display: 'inline-block',
    }}>{role}</span>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────

export default function ActivityLogPage() {
  const router = useRouter();
  const [rows,         setRows]         = useState<ActivityRow[]>([]);
  const [allUsers,     setAllUsers]     = useState<string[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [search,       setSearch]       = useState('');
  const [filterUser,   setFilterUser]   = useState('all');
  const [filterDevice, setFilterDevice] = useState('all');
  const [filterDays,   setFilterDays]   = useState('7');
  const [page,         setPage]         = useState(0);
  const PAGE_SIZE = 50;

  // Guard: admin only
  useEffect(() => {
    const stored = localStorage.getItem('msp_user');
    if (!stored) { router.push('/login'); return; }
    const user = JSON.parse(stored);
    if (user.role !== 'admin') { router.push('/home'); }
  }, [router]);

  // Load all registered users for the filter dropdown
  useEffect(() => {
    supabase.from('app_users').select('name').order('name')
      .then(({ data }) => {
        if (data) setAllUsers(data.map((u: { name: string }) => u.name));
      });
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const since = new Date();
    since.setDate(since.getDate() - parseInt(filterDays, 10));

    const { data, error } = await supabase
      .from('user_activity')
      .select('*')
      .gte('entered_at', since.toISOString())
      .order('entered_at', { ascending: false })
      .limit(2000);

    if (!error && data) setRows(data as ActivityRow[]);
    setLoading(false);
  }, [filterDays]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ── Derived stats ────────────────────────────────────────────────────────

  const uniqueUsers = new Set(rows.map(r => r.user_name)).size;
  const totalSessions = new Set(rows.map(r => r.session_id)).size;
  const avgDuration = rows.length
    ? Math.round(rows.filter(r => r.duration_secs).reduce((a, r) => a + (r.duration_secs ?? 0), 0) / rows.filter(r => r.duration_secs).length)
    : 0;

  const pageVisits = rows.reduce<Record<string, number>>((acc, r) => {
    const k = r.page_label || r.page_path;
    acc[k] = (acc[k] || 0) + 1;
    return acc;
  }, {});
  const topPages = Object.entries(pageVisits).sort((a, b) => b[1] - a[1]).slice(0, 5);

  const deviceCounts = rows.reduce<Record<string, number>>((acc, r) => {
    acc[r.device_type] = (acc[r.device_type] || 0) + 1;
    return acc;
  }, {});

  // Merge registered users with any names that appear only in activity logs
  const userNames = Array.from(new Set([...allUsers, ...rows.map(r => r.user_name)])).sort();

  // ── Filtered rows ────────────────────────────────────────────────────────

  const filtered = rows.filter(r => {
    if (filterUser !== 'all' && r.user_name !== filterUser) return false;
    if (filterDevice !== 'all' && r.device_type !== filterDevice) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!r.user_name.toLowerCase().includes(q) &&
          !r.page_label?.toLowerCase().includes(q) &&
          !r.ip_address?.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const paged = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);

  // ── Styles ────────────────────────────────────────────────────────────────

  const card: React.CSSProperties = {
    background: '#ffffff',
    border: '1px solid #e5dfc8',
    borderRadius: '12px',
    padding: '1.25rem',
    boxShadow: '0 2px 8px rgba(27,74,27,0.07)',
  };

  const kpiCard: React.CSSProperties = {
    ...card,
    display: 'flex',
    alignItems: 'center',
    gap: '1rem',
  };

  const thStyle: React.CSSProperties = {
    padding: '10px 14px',
    textAlign: 'left',
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

  return (
    <div style={{ maxWidth: '1400px', margin: '0 auto' }}>

      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#1b4a1b', margin: 0 }}>Activity Log</h1>
          <p style={{ color: '#6b7280', fontSize: '0.875rem', margin: '0.25rem 0 0' }}>Track user sessions, page visits, and device usage</p>
        </div>
        <button onClick={fetchData} disabled={loading}
          style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', borderRadius: '8px',
            background: '#1b4a1b', color: 'white', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: '13px' }}>
          <RefreshCw className="h-4 w-4" style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
          Refresh
        </button>
      </div>

      {/* ── KPI Row ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        <div style={kpiCard}>
          <div style={{ background: 'rgba(27,74,27,0.10)', borderRadius: '10px', padding: '10px' }}>
            <Activity className="h-5 w-5" style={{ color: '#1b4a1b' }} />
          </div>
          <div>
            <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#1b4a1b', lineHeight: 1 }}>{rows.length}</div>
            <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '2px' }}>Total Page Views</div>
          </div>
        </div>

        <div style={kpiCard}>
          <div style={{ background: 'rgba(59,130,246,0.10)', borderRadius: '10px', padding: '10px' }}>
            <Users className="h-5 w-5" style={{ color: '#3b82f6' }} />
          </div>
          <div>
            <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#3b82f6', lineHeight: 1 }}>{uniqueUsers}</div>
            <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '2px' }}>Unique Users</div>
          </div>
        </div>

        <div style={kpiCard}>
          <div style={{ background: 'rgba(232,200,74,0.15)', borderRadius: '10px', padding: '10px' }}>
            <BarChart2 className="h-5 w-5" style={{ color: '#b8920a' }} />
          </div>
          <div>
            <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#b8920a', lineHeight: 1 }}>{totalSessions}</div>
            <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '2px' }}>Sessions</div>
          </div>
        </div>

        <div style={kpiCard}>
          <div style={{ background: 'rgba(155,89,214,0.10)', borderRadius: '10px', padding: '10px' }}>
            <Clock className="h-5 w-5" style={{ color: '#9b59d6' }} />
          </div>
          <div>
            <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#9b59d6', lineHeight: 1 }}>{fmtDuration(avgDuration)}</div>
            <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '2px' }}>Avg Time / Page</div>
          </div>
        </div>
      </div>

      {/* ── Top Pages + Device Breakdown ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>

        {/* Top Pages */}
        <div style={card}>
          <div style={{ fontWeight: 700, fontSize: '14px', color: '#1b4a1b', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <BarChart2 className="h-4 w-4" /> Most Visited Pages
          </div>
          {topPages.length === 0 ? (
            <div style={{ color: '#9ca3af', fontSize: '13px' }}>No data yet</div>
          ) : topPages.map(([label, count]) => {
            const max = topPages[0][1];
            const pct = Math.round((count / max) * 100);
            return (
              <div key={label} style={{ marginBottom: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '4px' }}>
                  <span style={{ color: '#1a1a1a', fontWeight: 500 }}>{label}</span>
                  <span style={{ color: '#6b7280', fontWeight: 600 }}>{count}</span>
                </div>
                <div style={{ background: '#f0ead4', borderRadius: '999px', height: '6px' }}>
                  <div style={{ background: '#2d6e2d', borderRadius: '999px', height: '6px', width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
        </div>

        {/* Device Breakdown */}
        <div style={card}>
          <div style={{ fontWeight: 700, fontSize: '14px', color: '#1b4a1b', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Monitor className="h-4 w-4" /> Device Breakdown
          </div>
          {(['desktop', 'mobile', 'tablet'] as const).map(dev => {
            const count = deviceCounts[dev] || 0;
            const pct   = rows.length ? Math.round((count / rows.length) * 100) : 0;
            const clr   = dev === 'desktop' ? '#3b82f6' : dev === 'mobile' ? '#e8993a' : '#9b59d6';
            return (
              <div key={dev} style={{ marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <DeviceIcon type={dev} />
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '4px' }}>
                    <span style={{ textTransform: 'capitalize', fontWeight: 500, color: '#1a1a1a' }}>{dev}</span>
                    <span style={{ color: '#6b7280' }}>{count} ({pct}%)</span>
                  </div>
                  <div style={{ background: '#f0ead4', borderRadius: '999px', height: '6px' }}>
                    <div style={{ background: clr, borderRadius: '999px', height: '6px', width: `${pct}%` }} />
                  </div>
                </div>
              </div>
            );
          })}

          {/* IP Summary */}
          <div style={{ borderTop: '1px solid #f0ead4', paddingTop: '12px', marginTop: '4px' }}>
            <div style={{ fontWeight: 700, fontSize: '13px', color: '#1b4a1b', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Globe className="h-3.5 w-3.5" /> Unique IPs
            </div>
            <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#1b4a1b' }}>
              {new Set(rows.map(r => r.ip_address).filter(Boolean)).size}
            </div>
          </div>
        </div>
      </div>

      {/* ── Filters ── */}
      <div style={{ ...card, marginBottom: '1rem', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '10px' }}>
        <Filter className="h-4 w-4" style={{ color: '#6b7280', flexShrink: 0 }} />

        {/* Search */}
        <div style={{ position: 'relative', flex: '1', minWidth: '160px' }}>
          <Search className="h-3.5 w-3.5" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} />
          <input
            type="text" value={search} onChange={e => { setSearch(e.target.value); setPage(0); }}
            placeholder="Search user, page, IP…"
            style={{ width: '100%', paddingLeft: '30px', paddingRight: '10px', height: '34px',
              border: '1px solid #e5dfc8', borderRadius: '8px', fontSize: '13px',
              background: '#fdf8ee', color: '#1a1a1a', outline: 'none', boxSizing: 'border-box' }} />
        </div>

        {/* User */}
        <select value={filterUser} onChange={e => { setFilterUser(e.target.value); setPage(0); }}
          style={{ height: '34px', padding: '0 10px', border: '1px solid #e5dfc8', borderRadius: '8px', fontSize: '13px', background: '#fdf8ee', color: '#1a1a1a', cursor: 'pointer' }}>
          <option value="all">All Users</option>
          {userNames.map(n => <option key={n} value={n}>{n}</option>)}
        </select>

        {/* Device */}
        <select value={filterDevice} onChange={e => { setFilterDevice(e.target.value); setPage(0); }}
          style={{ height: '34px', padding: '0 10px', border: '1px solid #e5dfc8', borderRadius: '8px', fontSize: '13px', background: '#fdf8ee', color: '#1a1a1a', cursor: 'pointer' }}>
          <option value="all">All Devices</option>
          <option value="desktop">Desktop</option>
          <option value="mobile">Mobile</option>
          <option value="tablet">Tablet</option>
        </select>

        {/* Days */}
        <select value={filterDays} onChange={e => { setFilterDays(e.target.value); setPage(0); }}
          style={{ height: '34px', padding: '0 10px', border: '1px solid #e5dfc8', borderRadius: '8px', fontSize: '13px', background: '#fdf8ee', color: '#1a1a1a', cursor: 'pointer' }}>
          <option value="1">Last 24 hours</option>
          <option value="7">Last 7 days</option>
          <option value="30">Last 30 days</option>
          <option value="90">Last 90 days</option>
        </select>

        <span style={{ fontSize: '12px', color: '#9ca3af', marginLeft: 'auto' }}>
          {filtered.length} record{filtered.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* ── Table ── */}
      <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: '#9ca3af' }}>
            <RefreshCw className="h-6 w-6" style={{ animation: 'spin 1s linear infinite', margin: '0 auto 8px', display: 'block' }} />
            Loading activity data…
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: '#9ca3af' }}>
            No activity records found. Make sure you&apos;ve run <code>create_activity_log.sql</code> in Supabase.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '800px' }}>
              <thead>
                <tr>
                  <th style={thStyle}>User</th>
                  <th style={thStyle}>Role</th>
                  <th style={thStyle}>Page</th>
                  <th style={thStyle}>Duration</th>
                  <th style={thStyle}>Device</th>
                  <th style={thStyle}>IP Address</th>
                  <th style={thStyle}>Time</th>
                </tr>
              </thead>
              <tbody>
                {paged.map((row, i) => (
                  <tr key={row.id} style={{ background: i % 2 === 0 ? '#ffffff' : '#fdf8ee' }}>
                    <td style={{ ...tdStyle, fontWeight: 600 }}>{row.user_name}</td>
                    <td style={tdStyle}><RolePill role={row.user_role} /></td>
                    <td style={tdStyle}>
                      <div style={{ fontWeight: 500 }}>{row.page_label || row.page_path}</div>
                      <div style={{ fontSize: '11px', color: '#9ca3af' }}>{row.page_path}</div>
                    </td>
                    <td style={{ ...tdStyle, fontWeight: row.duration_secs ? 600 : 400, color: row.duration_secs ? '#1b4a1b' : '#9ca3af' }}>
                      {fmtDuration(row.duration_secs)}
                    </td>
                    <td style={tdStyle}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <DeviceIcon type={row.device_type} />
                        <span style={{ textTransform: 'capitalize', fontSize: '12px' }}>{row.device_type}</span>
                      </div>
                    </td>
                    <td style={{ ...tdStyle, fontFamily: 'monospace', fontSize: '12px', color: '#4b5563' }}>{row.ip_address || '—'}</td>
                    <td style={{ ...tdStyle, fontSize: '12px', color: '#6b7280', whiteSpace: 'nowrap' }}>{fmtTime(row.entered_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderTop: '1px solid #f0ead4' }}>
            <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
              style={{ padding: '6px 14px', borderRadius: '8px', border: '1px solid #e5dfc8', background: page === 0 ? '#f9f6ed' : '#1b4a1b',
                color: page === 0 ? '#9ca3af' : 'white', cursor: page === 0 ? 'default' : 'pointer', fontWeight: 600, fontSize: '13px' }}>
              ← Prev
            </button>
            <span style={{ fontSize: '13px', color: '#6b7280' }}>
              Page {page + 1} of {totalPages}
            </span>
            <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page === totalPages - 1}
              style={{ padding: '6px 14px', borderRadius: '8px', border: '1px solid #e5dfc8',
                background: page === totalPages - 1 ? '#f9f6ed' : '#1b4a1b',
                color: page === totalPages - 1 ? '#9ca3af' : 'white',
                cursor: page === totalPages - 1 ? 'default' : 'pointer', fontWeight: 600, fontSize: '13px' }}>
              Next →
            </button>
          </div>
        )}
      </div>

      {/* Spin keyframe */}
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
