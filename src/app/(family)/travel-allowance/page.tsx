'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Mail, Plus, Trash2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';

type Tab = 'entry' | 'reports' | 'manage';
type ReportType = 'week' | 'month' | 'employee';
const EVENT_RATE = 250;

type Employee = { id: string; name: string };
type Location = { id: string; name: string };
type Entry = {
  id: string;
  entry_date: string;
  employee_id: string;
  location_id: string;
  times: number;
  employee?: Employee | null;
  location?: Location | null;
};

type RawEntry = Omit<Entry, 'employee' | 'location'> & {
  employee?: Employee | Employee[] | null;
  location?: Location | Location[] | null;
};

const todayKey = () => new Date().toISOString().slice(0, 10);
const monthKey = () => new Date().toISOString().slice(0, 7);

function weekStartKey() {
  const d = new Date();
  const day = d.getDay() || 7;
  d.setDate(d.getDate() - day + 1);
  return d.toISOString().slice(0, 10);
}

function getWeekRange(startStr: string) {
  const start = new Date(`${startStr}T00:00:00`);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  return { start, end };
}

function dateInRange(dateStr: string, start: Date, end: Date) {
  const date = new Date(`${dateStr}T00:00:00`);
  return date >= start && date <= end;
}

function safeName(name?: string | null) {
  return name?.trim() || 'Unknown';
}

export default function TravelAllowancePage() {
  const [tab, setTab] = useState<Tab>('entry');
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState('');

  const [entryDate, setEntryDate] = useState(todayKey);
  const [employeeId, setEmployeeId] = useState('');
  const [locationId, setLocationId] = useState('');
  const [times, setTimes] = useState(1);

  const [newEmployee, setNewEmployee] = useState('');
  const [newLocation, setNewLocation] = useState('');

  const [reportType, setReportType] = useState<ReportType>('week');
  const [reportWeek, setReportWeek] = useState(weekStartKey);
  const [reportMonth, setReportMonth] = useState(monthKey);
  const [reportEmployee, setReportEmployee] = useState('');

  const showToast = useCallback((message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(''), 2200);
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    const [employeeRes, locationRes, entryRes] = await Promise.all([
      supabase.from('travel_allowance_employees').select('id, name').order('name'),
      supabase.from('travel_allowance_locations').select('id, name').order('name'),
      supabase
        .from('travel_allowance_entries')
        .select('id, entry_date, employee_id, location_id, times, employee:travel_allowance_employees(id, name), location:travel_allowance_locations(id, name)')
        .order('entry_date', { ascending: false }),
    ]);

    if (employeeRes.error || locationRes.error || entryRes.error) {
      showToast('Could not load Supabase data. Check that the Travel Allowance tables exist.');
    }

    const employeeRows = employeeRes.data ?? [];
    const locationRows = locationRes.data ?? [];
    setEmployees(employeeRows);
    setLocations(locationRows);
    setEntries(((entryRes.data ?? []) as RawEntry[]).map(entry => ({
      ...entry,
      employee: Array.isArray(entry.employee) ? entry.employee[0] ?? null : entry.employee ?? null,
      location: Array.isArray(entry.location) ? entry.location[0] ?? null : entry.location ?? null,
    })));
    setEmployeeId(current => current || employeeRows[0]?.id || '');
    setLocationId(current => current || locationRows[0]?.id || '');
    setReportEmployee(current => current || employeeRows[0]?.id || '');
    setLoading(false);
  }, [showToast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const addEntry = async () => {
    if (!entryDate || !employeeId || !locationId) {
      showToast('Fill in date, employee, and location');
      return;
    }
    const { error } = await supabase.from('travel_allowance_entries').insert({
      entry_date: entryDate,
      employee_id: employeeId,
      location_id: locationId,
      times: Math.max(1, times || 1),
    });
    if (error) {
      showToast(error.message);
      return;
    }
    setTimes(1);
    await loadData();
    showToast('Entry added');
  };

  const addEmployee = async () => {
    const name = newEmployee.trim();
    if (!name) return;
    if (employees.length >= 10) {
      showToast('Maximum 10 employees reached');
      return;
    }
    const { error } = await supabase.from('travel_allowance_employees').insert({ name });
    if (error) {
      showToast(error.message);
      return;
    }
    setNewEmployee('');
    await loadData();
    showToast('Employee added');
  };

  const addLocation = async () => {
    const name = newLocation.trim();
    if (!name) return;
    const { error } = await supabase.from('travel_allowance_locations').insert({ name });
    if (error) {
      showToast(error.message);
      return;
    }
    setNewLocation('');
    await loadData();
    showToast('Location added');
  };

  const deleteEntry = async (id: string) => {
    const { error } = await supabase.from('travel_allowance_entries').delete().eq('id', id);
    if (error) {
      showToast(error.message);
      return;
    }
    setEntries(prev => prev.filter(entry => entry.id !== id));
    showToast('Entry removed');
  };

  const removeEmployee = async (id: string) => {
    const { error } = await supabase.from('travel_allowance_employees').delete().eq('id', id);
    if (error) {
      showToast(error.message);
      return;
    }
    await loadData();
  };

  const removeLocation = async (id: string) => {
    const { error } = await supabase.from('travel_allowance_locations').delete().eq('id', id);
    if (error) {
      showToast(error.message);
      return;
    }
    await loadData();
  };

  const filteredReportEntries = useMemo(() => {
    if (reportType === 'week') {
      if (!reportWeek) return [];
      const { start, end } = getWeekRange(reportWeek);
      return entries.filter(entry => dateInRange(entry.entry_date, start, end));
    }
    if (reportType === 'month') {
      return entries.filter(entry => entry.entry_date.startsWith(reportMonth));
    }
    return entries.filter(entry => entry.employee_id === reportEmployee);
  }, [entries, reportEmployee, reportMonth, reportType, reportWeek]);

  const report = useMemo(() => {
    const byEmployee = new Map<string, number>();
    const byLocation = new Map<string, number>();
    filteredReportEntries.forEach(entry => {
      byEmployee.set(safeName(entry.employee?.name), (byEmployee.get(safeName(entry.employee?.name)) ?? 0) + entry.times);
      byLocation.set(safeName(entry.location?.name), (byLocation.get(safeName(entry.location?.name)) ?? 0) + entry.times);
    });
    return {
      totalTimes: filteredReportEntries.reduce((sum, entry) => sum + entry.times, 0),
      employeeRows: Array.from(byEmployee.entries()).sort((a, b) => b[1] - a[1]),
      locationRows: Array.from(byLocation.entries()).sort((a, b) => b[1] - a[1]),
    };
  }, [filteredReportEntries]);

  const emailMonthlyReport = () => {
    const monthlyEntries = entries.filter(entry => entry.entry_date.startsWith(reportMonth));
    const lines = monthlyEntries
      .sort((a, b) => a.entry_date.localeCompare(b.entry_date))
      .map(entry => `${entry.entry_date} | ${safeName(entry.employee?.name)} | ${safeName(entry.location?.name)} | Times: ${entry.times}`);
    const total = monthlyEntries.reduce((sum, entry) => sum + entry.times, 0);
    const subject = `Travel Allowance Report - ${reportMonth}`;
    const body = [
      `Travel Allowance Report - ${reportMonth}`,
      '',
      `Total entries: ${monthlyEntries.length}`,
    `Total events: ${total}`,
    `Amount payable: Rs. ${(total * EVENT_RATE).toLocaleString('en-IN')}`,
      '',
      ...lines,
    ].join('\n');

    window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  };

  return (
    <div className="max-w-7xl mx-auto space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em]" style={{ color: 'var(--t-muted)' }}>Family and Personal</p>
          <h1 className="text-3xl font-black tracking-tight" style={{ color: 'var(--t-text)' }}>Travel Allowance</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--t-muted)' }}>Log employee travel events at ₹250 per event and prepare weekly, monthly, or employee reports.</p>
        </div>
        <button onClick={emailMonthlyReport} className="inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-bold text-white transition active:scale-95" style={{ background: '#1b4a1b' }}>
          <Mail className="h-4 w-4" />
          Email monthly report
        </button>
      </div>

      <div className="flex flex-wrap gap-2 border-b" style={{ borderColor: 'var(--t-border)' }}>
        {[
          ['entry', 'Add entry'],
          ['reports', 'Reports'],
          ['manage', 'Manage employees / locations'],
        ].map(([key, label]) => (
          <button key={key} onClick={() => setTab(key as Tab)}
            className="px-4 py-3 text-sm font-semibold transition"
            style={{ color: tab === key ? 'var(--t-text)' : 'var(--t-muted)', borderBottom: tab === key ? '2px solid #1b4a1b' : '2px solid transparent' }}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'entry' && (
        <div className="space-y-4">
          <section className="rounded-xl border p-4" style={{ background: 'var(--t-card)', borderColor: 'var(--t-border)' }}>
            <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_1fr_120px_auto] gap-3 items-end">
              <Field label="Date"><input type="date" value={entryDate} onChange={e => setEntryDate(e.target.value)} className="ta-input" /></Field>
              <Field label="Employee">
                <select value={employeeId} onChange={e => setEmployeeId(e.target.value)} className="ta-input">
                  {employees.length ? employees.map(employee => <option key={employee.id} value={employee.id}>{employee.name}</option>) : <option>Add an employee first</option>}
                </select>
              </Field>
              <Field label="Location">
                <select value={locationId} onChange={e => setLocationId(e.target.value)} className="ta-input">
                  {locations.length ? locations.map(location => <option key={location.id} value={location.id}>{location.name}</option>) : <option>Add a location first</option>}
                </select>
              </Field>
              <Field label="Events"><input type="number" min={1} value={times} onChange={e => setTimes(Number(e.target.value))} className="ta-input" /></Field>
              <button onClick={addEntry} className="inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-bold text-white" style={{ background: '#1b4a1b' }}>
                <Plus className="h-4 w-4" />
                Add
              </button>
            </div>
          </section>

          <EntryTable entries={entries} loading={loading} onDelete={deleteEntry} />
        </div>
      )}

      {tab === 'reports' && (
        <section className="rounded-xl border p-4 space-y-4" style={{ background: 'var(--t-card)', borderColor: 'var(--t-border)' }}>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <Field label="Report type">
              <select value={reportType} onChange={e => setReportType(e.target.value as ReportType)} className="ta-input">
                <option value="week">Weekly</option>
                <option value="month">Monthly</option>
                <option value="employee">By employee</option>
              </select>
            </Field>
            {reportType === 'week' && <Field label="Week starting"><input type="date" value={reportWeek} onChange={e => setReportWeek(e.target.value)} className="ta-input" /></Field>}
            {reportType === 'month' && <Field label="Month"><input type="month" value={reportMonth} onChange={e => setReportMonth(e.target.value)} className="ta-input" /></Field>}
            {reportType === 'employee' && (
              <Field label="Employee">
                <select value={reportEmployee} onChange={e => setReportEmployee(e.target.value)} className="ta-input">
                  {employees.map(employee => <option key={employee.id} value={employee.id}>{employee.name}</option>)}
                </select>
              </Field>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <Stat label="Total events" value={report.totalTimes} />
            <Stat label="Amount payable" value={report.totalTimes * EVENT_RATE} money />
            <Stat label="Entries" value={filteredReportEntries.length} />
            <Stat label="Employees" value={report.employeeRows.length} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Breakdown title="By employee" rows={report.employeeRows} />
            <Breakdown title="By location" rows={report.locationRows} />
          </div>

          <EntryTable entries={filteredReportEntries} loading={loading} onDelete={deleteEntry} compact />
        </section>
      )}

      {tab === 'manage' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <ManagePanel title="Employees" value={newEmployee} onChange={setNewEmployee} onAdd={addEmployee} items={employees} onRemove={removeEmployee} placeholder="Add employee name" />
          <ManagePanel title="Locations" value={newLocation} onChange={setNewLocation} onAdd={addLocation} items={locations} onRemove={removeLocation} placeholder="Add location name" />
        </div>
      )}

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 rounded-lg px-5 py-3 text-sm font-semibold text-white" style={{ background: 'rgba(20,10,5,0.94)' }}>
          {toast}
        </div>
      )}

      <style jsx global>{`
        .ta-input {
          height: 40px;
          width: 100%;
          border: 1px solid var(--t-border);
          border-radius: 8px;
          background: var(--t-card);
          color: var(--t-text);
          padding: 0 10px;
          font-size: 14px;
        }
        .ta-input:focus {
          outline: none;
          border-color: #1b4a1b;
          box-shadow: 0 0 0 3px rgba(27, 74, 27, 0.14);
        }
      `}</style>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5 text-xs font-bold" style={{ color: 'var(--t-muted)' }}>
      {label}
      {children}
    </label>
  );
}

function Stat({ label, value, money = false }: { label: string; value: number; money?: boolean }) {
  return (
    <div className="rounded-lg px-4 py-3" style={{ background: 'var(--t-bg)' }}>
      <div className="text-2xl font-black" style={{ color: 'var(--t-text)' }}>{money ? `₹${value.toLocaleString('en-IN')}` : value}</div>
      <div className="text-xs font-semibold" style={{ color: 'var(--t-muted)' }}>{label}</div>
    </div>
  );
}

function Breakdown({ title, rows }: { title: string; rows: [string, number][] }) {
  return (
    <div>
      <h3 className="mb-2 text-sm font-bold" style={{ color: 'var(--t-text)' }}>{title}</h3>
      <div className="overflow-hidden rounded-lg border" style={{ borderColor: 'var(--t-border)' }}>
        <table className="w-full text-sm">
          <thead style={{ background: 'var(--t-bg)', color: 'var(--t-muted)' }}>
            <tr><th className="px-3 py-2 text-left">Name</th><th className="px-3 py-2 text-left">Events</th><th className="px-3 py-2 text-left">Amount</th></tr>
          </thead>
          <tbody>
            {rows.length ? rows.map(([name, total]) => (
              <tr key={name} className="border-t" style={{ borderColor: 'var(--t-border)' }}>
                <td className="px-3 py-2">{name}</td>
                <td className="px-3 py-2">{total}</td>
                <td className="px-3 py-2">₹{(total * EVENT_RATE).toLocaleString('en-IN')}</td>
              </tr>
            )) : (
              <tr><td className="px-3 py-8 text-center" colSpan={3} style={{ color: 'var(--t-muted)' }}>No report data yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function EntryTable({ entries, loading, onDelete, compact = false }: { entries: Entry[]; loading: boolean; onDelete: (id: string) => void; compact?: boolean }) {
  return (
    <section className="rounded-xl border overflow-hidden" style={{ background: 'var(--t-card)', borderColor: 'var(--t-border)' }}>
      {!compact && <div className="px-4 py-3 text-sm font-bold" style={{ color: 'var(--t-text)' }}>All entries <span style={{ color: 'var(--t-muted)' }}>({entries.length} total)</span></div>}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead style={{ background: 'var(--t-bg)', color: 'var(--t-muted)' }}>
            <tr><th className="px-4 py-2 text-left">Date</th><th className="px-4 py-2 text-left">Employee</th><th className="px-4 py-2 text-left">Location</th><th className="px-4 py-2 text-left">Events</th><th className="px-4 py-2 text-left">Amount</th><th className="px-4 py-2 text-left"></th></tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td className="px-4 py-8 text-center" colSpan={6} style={{ color: 'var(--t-muted)' }}>Loading travel allowance data...</td></tr>
            ) : entries.length ? entries.map(entry => (
              <tr key={entry.id} className="border-t" style={{ borderColor: 'var(--t-border)' }}>
                <td className="px-4 py-2">{entry.entry_date}</td>
                <td className="px-4 py-2">{safeName(entry.employee?.name)}</td>
                <td className="px-4 py-2">{safeName(entry.location?.name)}</td>
                <td className="px-4 py-2">{entry.times}</td>
                <td className="px-4 py-2">₹{(entry.times * EVENT_RATE).toLocaleString('en-IN')}</td>
                <td className="px-4 py-2 text-right">
                  <button onClick={() => onDelete(entry.id)} className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-semibold" style={{ borderColor: '#f0997b', color: '#993c1d' }}>
                    <Trash2 className="h-3 w-3" />
                    Remove
                  </button>
                </td>
              </tr>
            )) : (
              <tr><td className="px-4 py-8 text-center" colSpan={6} style={{ color: 'var(--t-muted)' }}>No entries yet. Add your first one above.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function ManagePanel({ title, value, onChange, onAdd, items, onRemove, placeholder }: {
  title: string;
  value: string;
  onChange: (value: string) => void;
  onAdd: () => void;
  items: Employee[] | Location[];
  onRemove: (id: string) => void;
  placeholder: string;
}) {
  return (
    <section className="rounded-xl border p-4 space-y-3" style={{ background: 'var(--t-card)', borderColor: 'var(--t-border)' }}>
      <h3 className="text-sm font-bold" style={{ color: 'var(--t-text)' }}>{title}</h3>
      <div className="flex gap-2">
        <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} className="ta-input" />
        <button onClick={onAdd} className="rounded-lg px-4 py-2 text-sm font-bold text-white" style={{ background: '#1b4a1b' }}>Add</button>
      </div>
      <div className="flex flex-wrap gap-2">
        {items.length ? items.map(item => (
          <span key={item.id} className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm" style={{ background: 'var(--t-bg)', color: 'var(--t-text)' }}>
            {item.name}
            <button onClick={() => onRemove(item.id)} className="rounded-full text-xs font-bold" style={{ color: '#993c1d' }}>x</button>
          </span>
        )) : <span className="text-sm" style={{ color: 'var(--t-muted)' }}>No {title.toLowerCase()} added yet.</span>}
      </div>
    </section>
  );
}
