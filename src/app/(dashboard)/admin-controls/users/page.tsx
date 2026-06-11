'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import {
  UserCog, Plus, KeyRound, Edit2, CheckCircle2,
  XCircle, Search, Loader2, X, Save,
} from 'lucide-react';

type AppUser = {
  id: string;
  name: string;
  pin: string;
  role: string;
  estate: string | null;
  active?: boolean;
};

const ROLES = ['admin', 'supervisor', 'worker'];
const ESTATES = ['NM', 'BV', 'MG', 'OR', 'HF', 'ST'];

type Modal =
  | { type: 'edit'; user: AppUser }
  | { type: 'pin';  user: AppUser }
  | { type: 'add' }
  | null;

const roleColor: Record<string, string> = {
  admin:      'text-yellow-400',
  supervisor: 'text-sky-400',
  worker:     'text-green-400',
};

const blank: Omit<AppUser, 'id'> = { name: '', pin: '', role: 'worker', estate: null, active: true };

export default function UserManagementPage() {
  const [users, setUsers]       = useState<AppUser[]>([]);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState('');
  const [modal, setModal]       = useState<Modal>(null);
  const [form, setForm]         = useState<Omit<AppUser, 'id'>>(blank);
  const [newPin, setNewPin]     = useState('');
  const [saving, setSaving]     = useState(false);
  const [toast, setToast]       = useState('');

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  };

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from('app_users').select('*').order('name');
    setUsers(data ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const filtered = users.filter(u =>
    u.name.toLowerCase().includes(search.toLowerCase()) ||
    u.role.toLowerCase().includes(search.toLowerCase())
  );

  // ── Save edit ──────────────────────────────────────────────────────────
  const handleSaveEdit = async () => {
    if (modal?.type !== 'edit') return;
    setSaving(true);
    const { error } = await supabase.from('app_users')
      .update({ name: form.name, role: form.role, estate: form.estate || null })
      .eq('id', modal.user.id);
    setSaving(false);
    if (error) { showToast('Error saving: ' + error.message); return; }
    showToast('User updated');
    setModal(null);
    load();
  };

  // ── Reset PIN ──────────────────────────────────────────────────────────
  const handleResetPin = async () => {
    if (modal?.type !== 'pin') return;
    if (newPin.length !== 4 || !/^\d{4}$/.test(newPin)) {
      showToast('PIN must be exactly 4 digits'); return;
    }
    setSaving(true);
    const { error } = await supabase.from('app_users')
      .update({ pin: newPin })
      .eq('id', modal.user.id);
    setSaving(false);
    if (error) { showToast('Error: ' + error.message); return; }
    showToast('PIN reset for ' + modal.user.name);
    setNewPin('');
    setModal(null);
    load();
  };

  // ── Add user ───────────────────────────────────────────────────────────
  const handleAddUser = async () => {
    if (!form.name.trim()) { showToast('Name is required'); return; }
    if (form.pin.length !== 4 || !/^\d{4}$/.test(form.pin)) {
      showToast('PIN must be exactly 4 digits'); return;
    }
    setSaving(true);
    const { error } = await supabase.from('app_users')
      .insert([{ name: form.name.trim(), pin: form.pin, role: form.role, estate: form.estate || null }]);
    setSaving(false);
    if (error) { showToast('Error: ' + error.message); return; }
    showToast(form.name + ' added');
    setForm(blank);
    setModal(null);
    load();
  };

  // ── Toggle active ──────────────────────────────────────────────────────
  const handleToggleActive = async (u: AppUser) => {
    const next = !(u.active ?? true);
    const { error } = await supabase.from('app_users')
      .update({ active: next })
      .eq('id', u.id);
    if (error) { showToast('Error: ' + error.message); return; }
    showToast(u.name + (next ? ' activated' : ' deactivated'));
    load();
  };

  // ── Open modals ────────────────────────────────────────────────────────
  const openEdit = (u: AppUser) => {
    setForm({ name: u.name, pin: u.pin, role: u.role, estate: u.estate, active: u.active });
    setModal({ type: 'edit', user: u });
  };
  const openPin = (u: AppUser) => { setNewPin(''); setModal({ type: 'pin', user: u }); };
  const openAdd = () => { setForm(blank); setModal({ type: 'add' }); };

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <UserCog className="h-6 w-6" style={{ color: 'var(--msp-green)' }} />
            User Management
          </h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--msp-neutral)' }}>
            {users.length} users · {users.filter(u => u.active !== false).length} active
          </p>
        </div>
        <button onClick={openAdd}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition hover:opacity-90"
          style={{ background: 'var(--msp-green)', color: '#1a2e1a' }}>
          <Plus className="h-4 w-4" /> Add User
        </button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4"
          style={{ color: 'var(--msp-neutral)' }} />
        <input
          value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search by name or role…"
          className="w-full pl-9 pr-4 py-2.5 rounded-lg text-sm"
          style={{ background: 'var(--msp-navy-mid)', border: '1px solid var(--msp-navy-border)', color: 'white' }}
        />
      </div>

      {/* Table */}
      <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--msp-navy-border)' }}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ background: 'var(--msp-navy-mid)', borderBottom: '1px solid var(--msp-navy-border)' }}>
              {['Name', 'Role', 'Estate', 'Status', 'Actions'].map(h => (
                <th key={h} className="px-4 py-3 text-left font-semibold"
                  style={{ color: 'var(--msp-neutral)' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} className="px-4 py-8 text-center">
                <Loader2 className="h-5 w-5 animate-spin mx-auto" style={{ color: 'var(--msp-green)' }} />
              </td></tr>
            ) : filtered.map((u, idx) => {
              const active = u.active !== false;
              return (
                <tr key={u.id}
                  style={{
                    background: idx % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'transparent',
                    borderBottom: '1px solid var(--msp-navy-border)',
                    opacity: active ? 1 : 0.5,
                  }}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold shrink-0"
                        style={{ background: 'rgba(134,239,172,0.15)', color: 'var(--msp-green)' }}>
                        {u.name[0]?.toUpperCase()}
                      </div>
                      <span className="text-white font-medium">{u.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`capitalize text-xs font-semibold ${roleColor[u.role] ?? 'text-gray-400'}`}>
                      {u.role}
                    </span>
                  </td>
                  <td className="px-4 py-3" style={{ color: 'var(--msp-neutral)' }}>
                    {u.estate ?? '—'}
                  </td>
                  <td className="px-4 py-3">
                    {active
                      ? <span className="flex items-center gap-1 text-xs text-green-400"><CheckCircle2 className="h-3.5 w-3.5" />Active</span>
                      : <span className="flex items-center gap-1 text-xs text-red-400"><XCircle className="h-3.5 w-3.5" />Inactive</span>
                    }
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button onClick={() => openEdit(u)} title="Edit"
                        className="p-1.5 rounded-lg transition hover:opacity-80"
                        style={{ background: 'rgba(255,255,255,0.08)' }}>
                        <Edit2 className="h-3.5 w-3.5 text-white" />
                      </button>
                      <button onClick={() => openPin(u)} title="Reset PIN"
                        className="p-1.5 rounded-lg transition hover:opacity-80"
                        style={{ background: 'rgba(255,255,255,0.08)' }}>
                        <KeyRound className="h-3.5 w-3.5 text-yellow-400" />
                      </button>
                      <button onClick={() => handleToggleActive(u)}
                        title={active ? 'Deactivate' : 'Activate'}
                        className="p-1.5 rounded-lg transition hover:opacity-80"
                        style={{ background: 'rgba(255,255,255,0.08)' }}>
                        {active
                          ? <XCircle className="h-3.5 w-3.5 text-red-400" />
                          : <CheckCircle2 className="h-3.5 w-3.5 text-green-400" />
                        }
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-xl text-sm font-medium shadow-xl"
          style={{ background: 'var(--msp-green)', color: '#1a2e1a' }}>
          {toast}
        </div>
      )}

      {/* ── Modals ─────────────────────────────────────────────────────── */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4"
          onClick={e => { if (e.target === e.currentTarget) setModal(null); }}>
          <div className="w-full max-w-sm rounded-2xl p-6 space-y-4"
            style={{ background: 'var(--msp-navy-mid)', border: '1px solid var(--msp-navy-border)' }}>

            {/* Edit user */}
            {(modal.type === 'edit' || modal.type === 'add') && (
              <>
                <div className="flex items-center justify-between">
                  <h2 className="text-white font-semibold text-lg">
                    {modal.type === 'add' ? 'Add User' : 'Edit User'}
                  </h2>
                  <button onClick={() => setModal(null)}><X className="h-5 w-5 text-white/60" /></button>
                </div>
                <div className="space-y-3">
                  <div>
                    <label className="text-xs mb-1 block" style={{ color: 'var(--msp-neutral)' }}>Name</label>
                    <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                      className="w-full px-3 py-2 rounded-lg text-sm text-white"
                      style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid var(--msp-navy-border)' }}
                      placeholder="Full name" />
                  </div>
                  {modal.type === 'add' && (
                    <div>
                      <label className="text-xs mb-1 block" style={{ color: 'var(--msp-neutral)' }}>PIN (4 digits)</label>
                      <input value={form.pin} onChange={e => setForm(f => ({ ...f, pin: e.target.value }))}
                        maxLength={4} inputMode="numeric"
                        className="w-full px-3 py-2 rounded-lg text-sm text-white"
                        style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid var(--msp-navy-border)' }}
                        placeholder="e.g. 1234" />
                    </div>
                  )}
                  <div>
                    <label className="text-xs mb-1 block" style={{ color: 'var(--msp-neutral)' }}>Role</label>
                    <select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
                      className="w-full px-3 py-2 rounded-lg text-sm text-white"
                      style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid var(--msp-navy-border)' }}>
                      {ROLES.map(r => <option key={r} value={r} className="bg-[#1a2e1a]">{r}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs mb-1 block" style={{ color: 'var(--msp-neutral)' }}>Estate (optional)</label>
                    <select value={form.estate ?? ''} onChange={e => setForm(f => ({ ...f, estate: e.target.value || null }))}
                      className="w-full px-3 py-2 rounded-lg text-sm text-white"
                      style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid var(--msp-navy-border)' }}>
                      <option value="" className="bg-[#1a2e1a]">None</option>
                      {ESTATES.map(e => <option key={e} value={e} className="bg-[#1a2e1a]">{e}</option>)}
                    </select>
                  </div>
                </div>
                <button
                  onClick={modal.type === 'add' ? handleAddUser : handleSaveEdit}
                  disabled={saving}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg font-semibold text-sm transition hover:opacity-90 disabled:opacity-50"
                  style={{ background: 'var(--msp-green)', color: '#1a2e1a' }}>
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  {modal.type === 'add' ? 'Create User' : 'Save Changes'}
                </button>
              </>
            )}

            {/* Reset PIN */}
            {modal.type === 'pin' && (
              <>
                <div className="flex items-center justify-between">
                  <h2 className="text-white font-semibold text-lg">Reset PIN</h2>
                  <button onClick={() => setModal(null)}><X className="h-5 w-5 text-white/60" /></button>
                </div>
                <p className="text-sm" style={{ color: 'var(--msp-neutral)' }}>
                  Setting new PIN for <span className="text-white font-medium">{modal.user.name}</span>
                </p>
                <div>
                  <label className="text-xs mb-1 block" style={{ color: 'var(--msp-neutral)' }}>New PIN (4 digits)</label>
                  <input
                    value={newPin} onChange={e => setNewPin(e.target.value)}
                    maxLength={4} inputMode="numeric"
                    className="w-full px-3 py-2 rounded-lg text-sm text-white text-center text-2xl tracking-[0.5em]"
                    style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid var(--msp-navy-border)' }}
                    placeholder="••••" />
                </div>
                <button onClick={handleResetPin} disabled={saving || newPin.length !== 4}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg font-semibold text-sm transition hover:opacity-90 disabled:opacity-50"
                  style={{ background: 'var(--msp-green)', color: '#1a2e1a' }}>
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
                  Reset PIN
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
