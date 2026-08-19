'use client';

import { useCallback, useEffect, useMemo, useState, useTransition } from 'react';
import {
  CheckCircle2,
  Edit2,
  KeyRound,
  Loader2,
  Plus,
  RefreshCw,
  Save,
  Search,
  ShieldCheck,
  UserCog,
  X,
  XCircle,
} from 'lucide-react';
import {
  type Access,
  type AuthUserRow,
  inviteAuthUserAction,
  listAuthUsersAction,
  loadUserPermissionsAction,
  resetAppUserPinAction,
  saveUserPermissionsAction,
  setAuthUserActiveAction,
  updateAuthUserAction,
} from './actions';

type UserPerms = Record<string, Access>;

type UserForm = {
  pin: string;
  name: string;
  role: string;
  estate: string | null;
};

type Modal =
  | { type: 'edit'; user: AuthUserRow }
  | { type: 'pin'; user: AuthUserRow }
  | { type: 'perms'; user: AuthUserRow }
  | { type: 'invite' }
  | null;

const PAGES = [
  { href: '/rainfall', label: 'Rain Gauge' },
  { href: '/fuel-expenses', label: 'Fleet Fuel Expenses' },
  { href: '/ho-fuel', label: 'HO Fuel' },
  { href: '/processing-dashboard', label: 'Processing Dashboard' },
  { href: '/labour-costs', label: 'Labour Costs' },
  { href: '/labour-activities', label: 'Labour Activities' },
  { href: '/daily-report', label: 'Daily Report' },
  { href: '/estate-management/muster-roll', label: 'Muster Roll' },
  { href: '/harvest-yield', label: 'Harvest Yield' },
  { href: '/nursery', label: 'Nursery' },
  { href: '/spraying-log', label: 'Spraying Log' },
  { href: '/vehicle-log', label: 'Vehicle Log' },
  { href: '/store-inventory', label: 'Store Inventory' },
  { href: '/shopify-orders', label: 'Shopify Orders' },
  { href: '/weather', label: 'Weather' },
  { href: '/ai-insights', label: 'AI Insights' },
];

const ACCESS_OPTS: { value: Access; label: string; color: string; bg: string; border: string }[] = [
  { value: 'none', label: 'No Access', color: 'var(--t-muted)', bg: 'transparent', border: 'transparent' },
  { value: 'view', label: 'View Only', color: '#1a3a6e', bg: '#dbeafe', border: '#93c5fd' },
  { value: 'full', label: 'Edit', color: 'var(--t-heading)', bg: '#dcfce7', border: '#86efac' },
];

const ROLES = ['admin', 'supervisor', 'ceo', 'worker', 'hr'];
const ESTATES = ['', 'NM', 'BV', 'MG', 'OR', 'HF', 'ST'];

const blank: UserForm = { pin: '', name: '', role: 'worker', estate: null };

const roleColors: Record<string, { bg: string; color: string }> = {
  admin: { bg: 'var(--t-heading)', color: 'white' },
  supervisor: { bg: '#1a3a6e', color: 'white' },
  ceo: { bg: '#7c3aed', color: 'white' },
  worker: { bg: '#6b3a1f', color: 'white' },
  hr: { bg: '#0f766e', color: 'white' },
};

const card: React.CSSProperties = {
  background: 'var(--t-card)',
  border: '1px solid #e5dfc8',
  borderRadius: '12px',
  boxShadow: '0 2px 8px rgba(27,74,27,0.07)',
};

const thStyle: React.CSSProperties = {
  padding: '10px 14px',
  textAlign: 'left',
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

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '8px 12px',
  borderRadius: '8px',
  border: '1px solid #e5dfc8',
  fontSize: '13px',
  color: 'var(--t-text)',
  background: '#faf8f2',
  outline: 'none',
};

const labelStyle: React.CSSProperties = {
  fontSize: '12px',
  fontWeight: 600,
  color: 'var(--t-muted)',
  display: 'block',
  marginBottom: '4px',
};

function AccessControl({ value, onChange }: { value: Access; onChange: (v: Access) => void }) {
  return (
    <div style={{ display: 'inline-flex', borderRadius: '8px', overflow: 'hidden', border: '1px solid #e5dfc8', background: 'var(--t-subtle)' }}>
      {ACCESS_OPTS.map((opt, i) => {
        const active = value === opt.value;
        return (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            style={{
              padding: '5px 11px',
              fontSize: '11px',
              fontWeight: active ? 700 : 500,
              border: 'none',
              borderRight: i < ACCESS_OPTS.length - 1 ? '1px solid #e5dfc8' : 'none',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              transition: 'all 0.15s',
              background: active ? opt.bg : 'transparent',
              color: active ? opt.color : 'var(--t-muted)',
            }}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

export default function UserManagementPage() {
  const [users, setUsers] = useState<AuthUserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState<Modal>(null);
  const [form, setForm] = useState<UserForm>(blank);
  const [newPin, setNewPin] = useState('');
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState('');
  const [perms, setPerms] = useState<UserPerms>({});
  const [permsLoading, setPermsLoading] = useState(false);
  const [permsSaved, setPermsSaved] = useState(false);
  const [isPending, startTransition] = useTransition();

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  };

  const load = useCallback(() => {
    setLoading(true);
    startTransition(async () => {
      const result = await listAuthUsersAction();
      if (result.ok) setUsers(result.data);
      else showToast(result.error);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    let cancelled = false;
    startTransition(async () => {
      const result = await listAuthUsersAction();
      if (cancelled) return;
      if (result.ok) setUsers(result.data);
      else showToast(result.error);
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    const term = search.toLowerCase();
    return users.filter((u) =>
      [u.name, u.role, u.estate ?? ''].some((value) => value.toLowerCase().includes(term))
    );
  }, [search, users]);

  const activeCount = users.filter((u) => u.active).length;

  const loadPerms = useCallback(async (userId: string) => {
    setPermsLoading(true);
    setPermsSaved(false);

    const defaults: UserPerms = {};
    PAGES.forEach((p) => {
      defaults[p.href] = 'full';
    });

    const result = await loadUserPermissionsAction(userId);
    if (result.ok) setPerms({ ...defaults, ...result.data });
    else showToast(result.error);
    setPermsLoading(false);
  }, []);

  const savePerms = async (userId: string) => {
    setSaving(true);
    const result = await saveUserPermissionsAction(userId, perms);
    setSaving(false);
    if (!result.ok) {
      showToast(result.error);
      return;
    }
    setPermsSaved(true);
    showToast('Permissions saved');
  };

  const handleInviteUser = async () => {
    setSaving(true);
    const result = await inviteAuthUserAction(form);
    setSaving(false);
    if (!result.ok) {
      showToast(result.error);
      return;
    }
    showToast(form.name + ' added');
    setForm(blank);
    setModal(null);
    load();
  };

  const handleSaveEdit = async () => {
    if (modal?.type !== 'edit') return;
    setSaving(true);
    const result = await updateAuthUserAction(modal.user.id, form);
    setSaving(false);
    if (!result.ok) {
      showToast(result.error);
      return;
    }
    showToast('User updated');
    setModal(null);
    load();
  };

  const handleToggleActive = async (u: AuthUserRow) => {
    const next = !u.active;
    const result = await setAuthUserActiveAction(u.id, next);
    if (!result.ok) {
      showToast(result.error);
      return;
    }
    showToast(u.name + (next ? ' activated' : ' deactivated'));
    load();
  };

  const handleResetPin = async () => {
    if (modal?.type !== 'pin') return;
    setSaving(true);
    const result = await resetAppUserPinAction(modal.user.id, newPin);
    setSaving(false);
    if (!result.ok) {
      showToast(result.error);
      return;
    }
    showToast('PIN reset for ' + modal.user.name);
    setNewPin('');
    setModal(null);
    load();
  };

  return (
    <div style={{ maxWidth: '1180px', margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--t-heading)', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <UserCog size={24} style={{ color: 'var(--t-heading)' }} />
            User Management
          </h1>
          <p style={{ color: 'var(--t-muted)', fontSize: '0.875rem', margin: '0.25rem 0 0' }}>
            {users.length} users · {activeCount} active
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={load}
            disabled={loading || isPending}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', borderRadius: '8px', background: 'var(--t-subtle)', color: 'var(--t-heading)', border: '1px solid #e5dfc8', cursor: 'pointer', fontWeight: 600, fontSize: '13px' }}
          >
            <RefreshCw size={14} /> Refresh
          </button>
          <button
            onClick={() => {
              setForm(blank);
              setModal({ type: 'invite' });
            }}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', borderRadius: '8px', background: 'var(--t-heading)', color: 'white', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: '13px' }}
          >
            <Plus size={14} /> Add User
          </button>
        </div>
      </div>

      <div style={{ ...card, padding: '12px 14px', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <Search size={15} style={{ color: 'var(--t-muted)', flexShrink: 0 }} />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, role, or estate..."
          style={{ border: 'none', outline: 'none', fontSize: '13px', color: 'var(--t-text)', background: 'transparent', width: '100%' }}
        />
        {search && (
          <button onClick={() => setSearch('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--t-muted)' }}>
            <X size={14} />
          </button>
        )}
      </div>

      <div style={{ ...card, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {['Name', 'Role', 'Estate', 'Status', 'Actions'].map((h) => (
                <th key={h} style={thStyle}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} style={{ ...tdStyle, textAlign: 'center', padding: '2.5rem' }}>
                  <Loader2 size={20} style={{ color: 'var(--t-heading)', animation: 'spin 1s linear infinite', margin: '0 auto' }} />
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ ...tdStyle, textAlign: 'center', color: 'var(--t-muted)', padding: '2rem' }}>No users found</td>
              </tr>
            ) : filtered.map((u) => {
              const rc = roleColors[u.role] ?? { bg: 'var(--t-muted)', color: 'white' };
              return (
                <tr
                  key={u.id}
                  style={{ opacity: u.active ? 1 : 0.55, background: 'white' }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = '#faf8f2')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'white')}
                >
                  <td style={tdStyle}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'rgba(27,74,27,0.10)', color: 'var(--t-heading)', fontWeight: 700, fontSize: '13px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        {u.name[0]?.toUpperCase()}
                      </div>
                      <span style={{ fontWeight: 600 }}>{u.name}</span>
                    </div>
                  </td>
                  <td style={tdStyle}>
                    <span style={{ background: rc.bg, color: rc.color, borderRadius: '999px', padding: '2px 10px', fontSize: '11px', fontWeight: 700, textTransform: 'capitalize' }}>
                      {u.role}
                    </span>
                  </td>
                  <td style={{ ...tdStyle, color: 'var(--t-muted)' }}>{u.estate ?? '-'}</td>
                  <td style={tdStyle}>
                    {u.active
                      ? <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: '#16a34a', fontWeight: 600 }}><CheckCircle2 size={13} /> Active</span>
                      : <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: '#dc2626', fontWeight: 600 }}><XCircle size={13} /> Inactive</span>}
                  </td>
                  <td style={tdStyle}>
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                      <button
                        onClick={() => {
                          setForm({ pin: u.pin, name: u.name, role: u.role, estate: u.estate });
                          setModal({ type: 'edit', user: u });
                        }}
                        style={{ padding: '5px 8px', borderRadius: '6px', border: '1px solid #e5dfc8', background: 'var(--t-subtle)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', fontWeight: 600, color: 'var(--t-heading)' }}
                      >
                        <Edit2 size={12} /> Edit
                      </button>
                      {u.role !== 'admin' && (
                        <button
                          onClick={() => {
                            setModal({ type: 'perms', user: u });
                            loadPerms(u.id);
                          }}
                          style={{ padding: '5px 8px', borderRadius: '6px', border: '1px solid #c7d2fe', background: '#eef2ff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', fontWeight: 600, color: '#4338ca' }}
                        >
                          <ShieldCheck size={12} /> Permissions
                        </button>
                      )}
                      <button
                        onClick={() => {
                          setNewPin('');
                          setModal({ type: 'pin', user: u });
                        }}
                        style={{ padding: '5px 8px', borderRadius: '6px', border: '1px solid #e5dfc8', background: 'var(--t-subtle)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', fontWeight: 600, color: '#b8920a' }}
                      >
                        <KeyRound size={12} /> PIN
                      </button>
                      <button
                        onClick={() => handleToggleActive(u)}
                        style={{ padding: '5px 8px', borderRadius: '6px', border: '1px solid #e5dfc8', background: 'var(--t-subtle)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', fontWeight: 600, color: u.active ? '#dc2626' : '#16a34a' }}
                      >
                        {u.active ? <><XCircle size={12} /> Deactivate</> : <><CheckCircle2 size={12} /> Activate</>}
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {toast && (
        <div style={{ position: 'fixed', bottom: '1.5rem', left: '50%', transform: 'translateX(-50%)', background: 'var(--t-heading)', color: 'white', padding: '10px 20px', borderRadius: '10px', fontSize: '13px', fontWeight: 600, zIndex: 100, boxShadow: '0 4px 16px rgba(0,0,0,0.2)' }}>
          {toast}
        </div>
      )}

      {modal && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setModal(null);
          }}
        >
          {modal.type === 'perms' && (
            <div style={{ ...card, width: '100%', maxWidth: '600px', maxHeight: '85vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid #e5dfc8', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
                <div>
                  <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--t-heading)', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <ShieldCheck size={18} style={{ color: '#4338ca' }} />
                    Permissions - {modal.user.name}
                  </h2>
                  <p style={{ fontSize: '12px', color: 'var(--t-muted)', margin: '2px 0 0' }}>Set page-level access for this user</p>
                </div>
                <button onClick={() => setModal(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--t-muted)' }}>
                  <X size={18} />
                </button>
              </div>

              <div style={{ padding: '10px 1.5rem', background: '#faf8f2', borderBottom: '1px solid #e5dfc8', display: 'flex', gap: '16px', flexShrink: 0, flexWrap: 'wrap' }}>
                {ACCESS_OPTS.map((o) => (
                  <span key={o.value} style={{ fontSize: '11px', fontWeight: 600, color: o.value === 'none' ? 'var(--t-muted)' : o.color, background: o.bg || '#f3f4f6', border: `1px solid ${o.border || 'var(--t-border)'}`, borderRadius: '6px', padding: '2px 8px' }}>
                    {o.label}
                  </span>
                ))}
              </div>

              <div style={{ flex: 1, overflowY: 'auto', padding: '0.5rem 0' }}>
                {permsLoading ? (
                  <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--t-muted)' }}>Loading...</div>
                ) : PAGES.map((page, idx) => (
                  <div key={page.href} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 1.5rem', background: idx % 2 === 0 ? 'white' : '#faf8f2', borderBottom: '1px solid #f0ead4' }}>
                    <div>
                      <span style={{ fontWeight: 600, fontSize: '13px', color: 'var(--t-text)' }}>{page.label}</span>
                      <span style={{ fontSize: '11px', color: 'var(--t-muted)', marginLeft: '6px' }}>{page.href}</span>
                    </div>
                    <AccessControl
                      value={perms[page.href] ?? 'full'}
                      onChange={(v) => {
                        setPerms((p) => ({ ...p, [page.href]: v }));
                        setPermsSaved(false);
                      }}
                    />
                  </div>
                ))}
              </div>

              <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid #e5dfc8', flexShrink: 0, display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                <button onClick={() => setModal(null)} style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid #e5dfc8', background: 'var(--t-subtle)', color: 'var(--t-muted)', cursor: 'pointer', fontWeight: 600, fontSize: '13px' }}>
                  Cancel
                </button>
                <button onClick={() => savePerms(modal.user.id)} disabled={saving} style={{ padding: '8px 18px', borderRadius: '8px', border: 'none', background: permsSaved ? '#16a34a' : 'var(--t-heading)', color: 'white', cursor: 'pointer', fontWeight: 700, fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px', opacity: saving ? 0.6 : 1 }}>
                  {saving ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : permsSaved ? <CheckCircle2 size={13} /> : <Save size={13} />}
                  {permsSaved ? 'Saved' : 'Save Permissions'}
                </button>
              </div>
            </div>
          )}

          {(modal.type === 'edit' || modal.type === 'invite') && (
            <div style={{ ...card, width: '100%', maxWidth: '420px', padding: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                <h2 style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--t-heading)', margin: 0 }}>
                  {modal.type === 'invite' ? 'Add User' : 'Edit User'}
                </h2>
                <button onClick={() => setModal(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--t-muted)' }}>
                  <X size={18} />
                </button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div>
                  <label style={labelStyle}>Full Name</label>
                  <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} style={inputStyle} placeholder="e.g. John Smith" />
                </div>
                {modal.type === 'invite' && (
                  <div>
                    <label style={labelStyle}>PIN (4 digits)</label>
                    <input
                      value={form.pin}
                      onChange={(e) => setForm((f) => ({ ...f, pin: e.target.value }))}
                      maxLength={4}
                      inputMode="numeric"
                      style={inputStyle}
                      placeholder="e.g. 1234"
                    />
                  </div>
                )}
                <div>
                  <label style={labelStyle}>Role</label>
                  <select value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))} style={inputStyle}>
                    {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Estate</label>
                  <select value={form.estate ?? ''} onChange={(e) => setForm((f) => ({ ...f, estate: e.target.value || null }))} style={inputStyle}>
                    {ESTATES.map((e) => <option key={e} value={e}>{e || 'None'}</option>)}
                  </select>
                </div>
              </div>
              <button
                onClick={modal.type === 'invite' ? handleInviteUser : handleSaveEdit}
                disabled={saving}
                style={{ marginTop: '1.25rem', width: '100%', padding: '10px', borderRadius: '8px', background: 'var(--t-heading)', color: 'white', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: '13px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', opacity: saving ? 0.6 : 1 }}
              >
                {saving ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Save size={14} />}
                {modal.type === 'invite' ? 'Create User' : 'Save Changes'}
              </button>
            </div>
          )}

          {modal.type === 'pin' && (
            <div style={{ ...card, width: '100%', maxWidth: '420px', padding: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                <h2 style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--t-heading)', margin: 0 }}>Reset PIN</h2>
                <button onClick={() => setModal(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--t-muted)' }}>
                  <X size={18} />
                </button>
              </div>
              <p style={{ fontSize: '13px', color: 'var(--t-muted)', marginBottom: '1rem' }}>
                Setting new PIN for <strong style={{ color: 'var(--t-text)' }}>{modal.user.name}</strong>
              </p>
              <div>
                <label style={labelStyle}>New 4-digit PIN</label>
                <input
                  value={newPin}
                  onChange={(e) => setNewPin(e.target.value)}
                  maxLength={4}
                  inputMode="numeric"
                  style={{ ...inputStyle, textAlign: 'center', fontSize: '1.5rem', letterSpacing: '0.5em' }}
                  placeholder="1234"
                />
              </div>
              <button
                onClick={handleResetPin}
                disabled={saving || newPin.length !== 4}
                style={{ marginTop: '1.25rem', width: '100%', padding: '10px', borderRadius: '8px', background: '#b8920a', color: 'white', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: '13px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', opacity: saving || newPin.length !== 4 ? 0.6 : 1 }}
              >
                {saving ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <KeyRound size={14} />}
                Reset PIN
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
