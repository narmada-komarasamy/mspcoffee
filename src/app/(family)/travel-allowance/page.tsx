'use client';

import { type ChangeEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, ExternalLink, Plus, Printer, Search, Trash2, Upload } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { EmailReportButton } from '@/components/email/EmailReportButton';

type Tab = 'entry' | 'reports' | 'payments' | 'manage';
type ReportType = 'week' | 'month' | 'employee';
const EVENT_RATE = 250;

type Employee = { id: string; name: string };
type Location = { id: string; name: string };
type AppUser = { id: string; name: string; pin: string; role: string; estate: string | null };
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
type PaymentRecord = {
  id: string;
  employee_id: string;
  period_start: string;
  period_end: string;
  report_type: string;
  events: number;
  amount: number;
  status: 'paid' | 'unpaid' | 'void';
  paid_at: string | null;
  receipt_file_name: string | null;
  receipt_file_path: string | null;
  receipt_signed_url: string | null;
  notes: string | null;
};
type PaymentRow = {
  key: string;
  employeeId: string;
  employeeName: string;
  periodStart: string;
  periodEnd: string;
  month: string;
  events: number;
  entries: number;
  amount: number;
  payment: PaymentRecord | null;
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

function monthStartEnd(month: string) {
  const [year, monthIndex] = month.split('-').map(Number);
  const end = new Date(year, monthIndex, 0).toISOString().slice(0, 10);
  return { start: `${month}-01`, end };
}

function storedAppUser() {
  const stored = localStorage.getItem('msp_user');
  if (!stored) return null;

  try {
    return JSON.parse(stored) as AppUser;
  } catch {
    return null;
  }
}

function travelAuthHeaders(user: AppUser | null) {
  if (!user?.id || !user?.pin) return null;
  return {
    'Content-Type': 'application/json',
    'x-msp-user-id': user.id,
    'x-msp-user-pin': user.pin,
  };
}

async function readApiError(response: Response, fallback: string) {
  const result = await response.json().catch(() => null) as { error?: string } | null;
  return result?.error ?? fallback;
}

export default function TravelAllowancePage() {
  const [tab, setTab] = useState<Tab>('entry');
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [currentUser, setCurrentUser] = useState<AppUser | null>(null);
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
  const [reportStartDate, setReportStartDate] = useState('');
  const [reportEndDate, setReportEndDate] = useState('');
  const [paymentSearch, setPaymentSearch] = useState('');
  const [paymentStatus, setPaymentStatus] = useState<'all' | 'paid' | 'unpaid'>('all');
  const [paymentMonth, setPaymentMonth] = useState('');
  const [paymentFiles, setPaymentFiles] = useState<Record<string, File | null>>({});
  const [paymentNotes, setPaymentNotes] = useState<Record<string, string>>({});
  const [updatingPayment, setUpdatingPayment] = useState('');
  const isAdmin = currentUser?.role === 'admin';

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
    const paymentHeaders = travelAuthHeaders(currentUser ?? storedAppUser());
    if (paymentHeaders) {
      const response = await fetch('/api/travel-allowance/payments', { headers: paymentHeaders });
      const body = await response.json().catch(() => null) as { payments?: PaymentRecord[]; error?: string } | null;
      if (response.ok) {
        setPayments(body?.payments ?? []);
      } else {
        setPayments([]);
        showToast(body?.error ?? 'Could not load travel allowance payment records.');
      }
    } else {
      setPayments([]);
    }
    setEmployeeId(current => current || employeeRows[0]?.id || '');
    setLocationId(current => current || locationRows[0]?.id || '');
    setReportEmployee(current => current || employeeRows[0]?.id || '');
    setLoading(false);
  }, [currentUser, showToast]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadData();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadData]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const stored = localStorage.getItem('msp_user');
      if (!stored) return;

      try {
        const cached = JSON.parse(stored) as AppUser;
        setCurrentUser(cached);
        supabase
          .from('app_users')
          .select('id, name, role, estate')
          .eq('id', cached.id)
          .single()
          .then(({ data }) => {
            if (!data) return;
            const verified = { ...cached, role: data.role, name: data.name, estate: data.estate };
            setCurrentUser(verified);
            localStorage.setItem('msp_user', JSON.stringify(verified));
          });
      } catch {
        setCurrentUser(null);
      }
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  const addEntry = async () => {
    if (!entryDate || !employeeId || !locationId) {
      showToast('Fill in date, employee, and location');
      return;
    }

    const headers = travelAuthHeaders(currentUser);
    if (!headers) {
      showToast('Sign in again before adding entries');
      return;
    }

    const response = await fetch('/api/travel-allowance/entries', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        entry_date: entryDate,
        employee_id: employeeId,
        location_id: locationId,
        times: Math.max(1, times || 1),
      }),
    });

    if (!response.ok) {
      showToast(await readApiError(response, 'Could not add entry'));
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
    if (!isAdmin) {
      showToast('Only admins can manage employees');
      return;
    }

    const headers = travelAuthHeaders(currentUser);
    if (!headers) {
      showToast('Sign in again before adding employees');
      return;
    }

    const response = await fetch('/api/travel-allowance/employees', {
      method: 'POST',
      headers,
      body: JSON.stringify({ name }),
    });

    if (!response.ok) {
      showToast(await readApiError(response, 'Could not add employee'));
      return;
    }

    setNewEmployee('');
    await loadData();
    showToast('Employee added');
  };

  const addLocation = async () => {
    const name = newLocation.trim();
    if (!name) return;
    if (!isAdmin) {
      showToast('Only admins can manage locations');
      return;
    }

    const headers = travelAuthHeaders(currentUser);
    if (!headers) {
      showToast('Sign in again before adding locations');
      return;
    }

    const response = await fetch('/api/travel-allowance/locations', {
      method: 'POST',
      headers,
      body: JSON.stringify({ name }),
    });

    if (!response.ok) {
      showToast(await readApiError(response, 'Could not add location'));
      return;
    }

    setNewLocation('');
    await loadData();
    showToast('Location added');
  };

  const deleteEntry = async (id: string) => {
    if (currentUser?.role !== 'admin') {
      showToast('Only admins can delete entries');
      return;
    }

    const headers = travelAuthHeaders(currentUser);
    if (!headers) {
      showToast('Sign in again before removing entries');
      return;
    }

    const response = await fetch(`/api/travel-allowance/entries/${id}`, {
      method: 'DELETE',
      headers,
    });

    if (!response.ok) {
      showToast(await readApiError(response, 'Could not remove entry'));
      return;
    }

    setEntries(prev => prev.filter(entry => entry.id !== id));
    showToast('Entry removed');
  };

  const removeEmployee = async (id: string) => {
    if (!isAdmin) {
      showToast('Only admins can manage employees');
      return;
    }

    const headers = travelAuthHeaders(currentUser);
    if (!headers) {
      showToast('Sign in again before removing employees');
      return;
    }

    const response = await fetch(`/api/travel-allowance/employees/${id}`, {
      method: 'DELETE',
      headers,
    });

    if (!response.ok) {
      showToast(await readApiError(response, 'Could not remove employee'));
      return;
    }

    await loadData();
  };

  const removeLocation = async (id: string) => {
    if (!isAdmin) {
      showToast('Only admins can manage locations');
      return;
    }

    const headers = travelAuthHeaders(currentUser);
    if (!headers) {
      showToast('Sign in again before removing locations');
      return;
    }

    const response = await fetch(`/api/travel-allowance/locations/${id}`, {
      method: 'DELETE',
      headers,
    });

    if (!response.ok) {
      showToast(await readApiError(response, 'Could not remove location'));
      return;
    }

    await loadData();
  };

  const filteredReportEntries = useMemo(() => {
    let reportEntries: Entry[];
    if (reportType === 'week') {
      if (!reportWeek) reportEntries = [];
      else {
        const { start, end } = getWeekRange(reportWeek);
        reportEntries = entries.filter(entry => dateInRange(entry.entry_date, start, end));
      }
    } else if (reportType === 'month') {
      reportEntries = entries.filter(entry => entry.entry_date.startsWith(reportMonth));
    } else {
      reportEntries = entries.filter(entry => entry.employee_id === reportEmployee);
    }

    if (reportStartDate) {
      reportEntries = reportEntries.filter(entry => entry.entry_date >= reportStartDate);
    }
    if (reportEndDate) {
      reportEntries = reportEntries.filter(entry => entry.entry_date <= reportEndDate);
    }

    return reportEntries;
  }, [entries, reportEmployee, reportEndDate, reportMonth, reportStartDate, reportType, reportWeek]);

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

  const reportTitle = useMemo(() => {
    if (reportType === 'week') return `Weekly report - ${reportWeek || 'No week selected'}`;
    if (reportType === 'month') return `Monthly report - ${reportMonth || 'No month selected'}`;
    const employee = employees.find(item => item.id === reportEmployee);
    return `Employee report - ${safeName(employee?.name)}`;
  }, [employees, reportEmployee, reportMonth, reportType, reportWeek]);

  const reportDateLabel = useMemo(() => {
    if (reportStartDate && reportEndDate) return `${reportStartDate} to ${reportEndDate}`;
    if (reportStartDate) return `From ${reportStartDate}`;
    if (reportEndDate) return `Until ${reportEndDate}`;
    return 'All dates in selected report';
  }, [reportEndDate, reportStartDate]);

  const emailPayload = useMemo(() => {
    const sortedEntries = [...filteredReportEntries].sort((a, b) => a.entry_date.localeCompare(b.entry_date));
    const amountPayable = report.totalTimes * EVENT_RATE;

    return {
      type: 'custom_report' as const,
      subject: `MSP Coffee - ${reportTitle}`,
      reportTitle: `Travel Allowance - ${reportTitle}`,
      sourcePath: '/travel-allowance',
      attachmentName: `travel-allowance-${reportType}.html`,
      recipients: [],
      note: `Prepared from the Travel Allowance report view. Date filter: ${reportDateLabel}.`,
      data: {
        summary: [
          { label: 'Date filter', value: reportDateLabel },
          { label: 'Total events', value: String(report.totalTimes) },
          { label: 'Amount payable', value: `Rs. ${amountPayable.toLocaleString('en-IN')}`, detail: `Rs. ${EVENT_RATE} per event` },
          { label: 'Entries', value: String(filteredReportEntries.length) },
          { label: 'Employees', value: String(report.employeeRows.length) },
        ],
        sections: [
          {
            title: 'By employee',
            rows: report.employeeRows.length
              ? report.employeeRows.map(([name, total]) => ({
                  label: name,
                  value: `${total} event${total === 1 ? '' : 's'}`,
                  detail: `Rs. ${(total * EVENT_RATE).toLocaleString('en-IN')}`,
                }))
              : [{ label: 'No employees', value: 'No report data' }],
          },
          {
            title: 'By location',
            rows: report.locationRows.length
              ? report.locationRows.map(([name, total]) => ({
                  label: name,
                  value: `${total} event${total === 1 ? '' : 's'}`,
                  detail: `Rs. ${(total * EVENT_RATE).toLocaleString('en-IN')}`,
                }))
              : [{ label: 'No locations', value: 'No report data' }],
          },
          {
            title: 'Entries',
            rows: sortedEntries.length
              ? sortedEntries.map((entry) => ({
                  label: entry.entry_date,
                  value: `${safeName(entry.employee?.name)} - ${entry.times} event${entry.times === 1 ? '' : 's'}`,
                  detail: `${safeName(entry.location?.name)} - Rs. ${(entry.times * EVENT_RATE).toLocaleString('en-IN')}`,
                }))
              : [{ label: 'No entries', value: 'No report data' }],
          },
        ],
      },
    };
  }, [filteredReportEntries, report, reportDateLabel, reportTitle, reportType]);

  const paymentRows = useMemo<PaymentRow[]>(() => {
    const buckets = new Map<string, PaymentRow>();
    const paymentByPeriod = new Map(payments.map(payment => [
      `${payment.employee_id}|${payment.period_start}|${payment.period_end}`,
      payment,
    ]));

    entries.forEach(entry => {
      const month = entry.entry_date.slice(0, 7);
      const { start, end } = monthStartEnd(month);
      const employeeName = safeName(entry.employee?.name);
      const key = `${entry.employee_id}|${start}|${end}`;
      const current = buckets.get(key) ?? {
        key,
        employeeId: entry.employee_id,
        employeeName,
        periodStart: start,
        periodEnd: end,
        month,
        events: 0,
        entries: 0,
        amount: 0,
        payment: paymentByPeriod.get(key) ?? null,
      };

      current.events += entry.times;
      current.entries += 1;
      current.amount = current.events * EVENT_RATE;
      buckets.set(key, current);
    });

    payments.forEach(payment => {
      const key = `${payment.employee_id}|${payment.period_start}|${payment.period_end}`;
      if (buckets.has(key)) return;
      const employeeName = safeName(employees.find(employee => employee.id === payment.employee_id)?.name);
      buckets.set(key, {
        key,
        employeeId: payment.employee_id,
        employeeName,
        periodStart: payment.period_start,
        periodEnd: payment.period_end,
        month: payment.period_start.slice(0, 7),
        events: payment.events,
        entries: 0,
        amount: Number(payment.amount),
        payment,
      });
    });

    return Array.from(buckets.values()).sort((a, b) => {
      const period = b.periodStart.localeCompare(a.periodStart);
      return period || a.employeeName.localeCompare(b.employeeName);
    });
  }, [employees, entries, payments]);

  const filteredPaymentRows = useMemo(() => {
    const query = paymentSearch.trim().toLowerCase();

    return paymentRows.filter(row => {
      const paid = row.payment?.status === 'paid';
      if (paymentStatus === 'paid' && !paid) return false;
      if (paymentStatus === 'unpaid' && paid) return false;
      if (paymentMonth && row.month !== paymentMonth) return false;
      if (!query) return true;

      return [
        row.employeeName,
        row.periodStart,
        row.periodEnd,
        row.month,
        row.payment?.receipt_file_name ?? '',
        row.payment?.notes ?? '',
      ].some(value => value.toLowerCase().includes(query));
    });
  }, [paymentMonth, paymentRows, paymentSearch, paymentStatus]);

  const paymentMonthOptions = useMemo(() => {
    return Array.from(new Set(paymentRows.map(row => row.month))).sort((a, b) => b.localeCompare(a));
  }, [paymentRows]);

  const paymentStats = useMemo(() => {
    const paidRows = filteredPaymentRows.filter(row => row.payment?.status === 'paid');
    const unpaidRows = filteredPaymentRows.filter(row => row.payment?.status !== 'paid');

    return {
      paid: paidRows.reduce((sum, row) => sum + row.amount, 0),
      unpaid: unpaidRows.reduce((sum, row) => sum + row.amount, 0),
      paidCount: paidRows.length,
      unpaidCount: unpaidRows.length,
    };
  }, [filteredPaymentRows]);

  const markPayment = async (row: PaymentRow, status: 'paid' | 'unpaid') => {
    if (!isAdmin) {
      showToast('Only admins can update payments');
      return;
    }

    const headers = travelAuthHeaders(currentUser);
    if (!headers) {
      showToast('Sign in again before updating payments');
      return;
    }

    setUpdatingPayment(row.key);

    const receiptFileName = '';
    const receiptFilePath = '';

    if (status === 'paid') {
      const file = paymentFiles[row.key];
      if (!file && !row.payment?.receipt_file_path) {
        setUpdatingPayment('');
        showToast('Attach receipt before marking paid');
        return;
      }
    }

    const formData = new FormData();
    formData.set('employee_id', row.employeeId);
    formData.set('period_start', row.periodStart);
    formData.set('period_end', row.periodEnd);
    formData.set('report_type', 'month');
    formData.set('events', String(row.events));
    formData.set('amount', String(row.amount));
    formData.set('status', status);
    formData.set('existing_receipt_file_name', receiptFileName || row.payment?.receipt_file_name || '');
    formData.set('existing_receipt_file_path', receiptFilePath || row.payment?.receipt_file_path || '');
    formData.set('notes', paymentNotes[row.key] ?? row.payment?.notes ?? '');
    if (status === 'paid' && paymentFiles[row.key]) {
      formData.set('receipt', paymentFiles[row.key]!);
    }

    const authHeaders = {
      'x-msp-user-id': headers['x-msp-user-id'],
      'x-msp-user-pin': headers['x-msp-user-pin'],
    };
    const response = await fetch('/api/travel-allowance/payments', {
      method: 'POST',
      headers: authHeaders,
      body: formData,
    });

    setUpdatingPayment('');

    if (!response.ok) {
      showToast(await readApiError(response, 'Could not update payment'));
      return;
    }

    setPaymentFiles(current => ({ ...current, [row.key]: null }));
    await loadData();
    showToast(status === 'paid' ? 'Payment marked paid' : 'Payment marked unpaid');
  };

  const printReport = () => {
    window.print();
  };

  return (
    <div className="max-w-7xl mx-auto space-y-4">
      <div className="ta-no-print flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em]" style={{ color: 'var(--t-muted)' }}>Family and Personal</p>
          <h1 className="text-3xl font-black tracking-tight" style={{ color: 'var(--t-text)' }}>Travel Allowance</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--t-muted)' }}>Log employee travel events at ₹250 per event and prepare weekly, monthly, or employee reports.</p>
        </div>
        <EmailReportButton payload={emailPayload} label="Email report" />
      </div>

      <div className="ta-no-print flex flex-wrap gap-2 border-b" style={{ borderColor: 'var(--t-border)' }}>
        {[
          ['entry', 'Add entry'],
          ['reports', 'Reports'],
          ['payments', 'Payments'],
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

          <EntryTable entries={entries} loading={loading} onDelete={deleteEntry} canDelete={isAdmin} />
        </div>
      )}

      {tab === 'reports' && (
        <section className="ta-print-area rounded-xl border p-4 space-y-4" style={{ background: 'var(--t-card)', borderColor: 'var(--t-border)' }}>
          <div className="ta-print-only">
            <h1 className="text-2xl font-black" style={{ color: 'var(--t-text)' }}>Travel Allowance</h1>
            <p className="text-sm font-semibold" style={{ color: 'var(--t-muted)' }}>{reportTitle}</p>
            <p className="text-sm" style={{ color: 'var(--t-muted)' }}>Date filter: {reportDateLabel}</p>
          </div>
          <div className="ta-no-print flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
            <div className="grid flex-1 grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3">
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
              <Field label="From date"><input type="date" value={reportStartDate} onChange={e => setReportStartDate(e.target.value)} className="ta-input" /></Field>
              <Field label="To date"><input type="date" value={reportEndDate} onChange={e => setReportEndDate(e.target.value)} className="ta-input" /></Field>
            </div>
            <button onClick={printReport} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border px-4 text-sm font-bold transition active:scale-95" style={{ borderColor: 'var(--t-border)', color: 'var(--t-text)', background: 'var(--t-card)' }}>
              <Printer className="h-4 w-4" />
              Print
            </button>
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

          <EntryTable entries={filteredReportEntries} loading={loading} onDelete={deleteEntry} canDelete={isAdmin} compact />
        </section>
      )}

      {tab === 'payments' && (
        <section className="rounded-xl border p-4 space-y-4" style={{ background: 'var(--t-card)', borderColor: 'var(--t-border)' }}>
          <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h2 className="text-lg font-black" style={{ color: 'var(--t-text)' }}>Payment Register</h2>
              <p className="text-sm" style={{ color: 'var(--t-muted)' }}>Track what has been paid, what is pending, and keep receipt copies against each employee period.</p>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:min-w-[620px]">
              <Stat label="Paid" value={paymentStats.paid} money />
              <Stat label="Unpaid" value={paymentStats.unpaid} money />
              <Stat label="Paid periods" value={paymentStats.paidCount} />
              <Stat label="Pending periods" value={paymentStats.unpaidCount} />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-[1.4fr_180px_180px] gap-3">
            <Field label="Search">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" style={{ color: 'var(--t-muted)' }} />
                <input
                  value={paymentSearch}
                  onChange={event => setPaymentSearch(event.target.value)}
                  placeholder="Search employee, receipt, note, period..."
                  className="ta-input pl-9"
                />
              </div>
            </Field>
            <Field label="Status">
              <select value={paymentStatus} onChange={event => setPaymentStatus(event.target.value as 'all' | 'paid' | 'unpaid')} className="ta-input">
                <option value="all">All payments</option>
                <option value="paid">Paid only</option>
                <option value="unpaid">Unpaid only</option>
              </select>
            </Field>
            <Field label="Month">
              <select value={paymentMonth} onChange={event => setPaymentMonth(event.target.value)} className="ta-input">
                <option value="">All months</option>
                {paymentMonthOptions.map(month => <option key={month} value={month}>{month}</option>)}
              </select>
            </Field>
          </div>

          <PaymentRegisterTable
            rows={filteredPaymentRows}
            loading={loading}
            isAdmin={isAdmin}
            updatingKey={updatingPayment}
            files={paymentFiles}
            notes={paymentNotes}
            onFile={(key, event) => setPaymentFiles(current => ({ ...current, [key]: event.target.files?.[0] ?? null }))}
            onNote={(key, value) => setPaymentNotes(current => ({ ...current, [key]: value }))}
            onMark={markPayment}
          />
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
        .ta-print-only {
          display: none;
        }
        @media print {
          body * {
            visibility: hidden;
          }
          .ta-print-area,
          .ta-print-area * {
            visibility: visible;
          }
          .ta-print-area {
            position: absolute;
            inset: 0 auto auto 0;
            width: 100%;
            border: 0 !important;
            border-radius: 0 !important;
            background: white !important;
            color: #111 !important;
            box-shadow: none !important;
          }
          .ta-no-print {
            display: none !important;
          }
          .ta-print-only {
            display: block !important;
          }
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

function EntryTable({ entries, loading, onDelete, canDelete, compact = false }: { entries: Entry[]; loading: boolean; onDelete: (id: string) => void; canDelete: boolean; compact?: boolean }) {
  const colSpan = canDelete ? 6 : 5;

  return (
    <section className="rounded-xl border overflow-hidden" style={{ background: 'var(--t-card)', borderColor: 'var(--t-border)' }}>
      {!compact && <div className="px-4 py-3 text-sm font-bold" style={{ color: 'var(--t-text)' }}>All entries <span style={{ color: 'var(--t-muted)' }}>({entries.length} total)</span></div>}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead style={{ background: 'var(--t-bg)', color: 'var(--t-muted)' }}>
            <tr><th className="px-4 py-2 text-left">Date</th><th className="px-4 py-2 text-left">Employee</th><th className="px-4 py-2 text-left">Location</th><th className="px-4 py-2 text-left">Events</th><th className="px-4 py-2 text-left">Amount</th>{canDelete && <th className="ta-no-print px-4 py-2 text-left"></th>}</tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td className="px-4 py-8 text-center" colSpan={colSpan} style={{ color: 'var(--t-muted)' }}>Loading travel allowance data...</td></tr>
            ) : entries.length ? entries.map(entry => (
              <tr key={entry.id} className="border-t" style={{ borderColor: 'var(--t-border)' }}>
                <td className="px-4 py-2">{entry.entry_date}</td>
                <td className="px-4 py-2">{safeName(entry.employee?.name)}</td>
                <td className="px-4 py-2">{safeName(entry.location?.name)}</td>
                <td className="px-4 py-2">{entry.times}</td>
                <td className="px-4 py-2">₹{(entry.times * EVENT_RATE).toLocaleString('en-IN')}</td>
                {canDelete && (
                  <td className="ta-no-print px-4 py-2 text-right">
                    <button onClick={() => onDelete(entry.id)} className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-semibold" style={{ borderColor: '#f0997b', color: '#993c1d' }}>
                      <Trash2 className="h-3 w-3" />
                      Remove
                    </button>
                  </td>
                )}
              </tr>
            )) : (
              <tr><td className="px-4 py-8 text-center" colSpan={colSpan} style={{ color: 'var(--t-muted)' }}>No entries yet. Add your first one above.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function PaymentRegisterTable({
  rows,
  loading,
  isAdmin,
  updatingKey,
  files,
  notes,
  onFile,
  onNote,
  onMark,
}: {
  rows: PaymentRow[];
  loading: boolean;
  isAdmin: boolean;
  updatingKey: string;
  files: Record<string, File | null>;
  notes: Record<string, string>;
  onFile: (key: string, event: ChangeEvent<HTMLInputElement>) => void;
  onNote: (key: string, value: string) => void;
  onMark: (row: PaymentRow, status: 'paid' | 'unpaid') => void;
}) {
  return (
    <div className="overflow-hidden rounded-xl border" style={{ borderColor: 'var(--t-border)' }}>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead style={{ background: 'var(--t-bg)', color: 'var(--t-muted)' }}>
            <tr>
              <th className="px-4 py-3 text-left">Period</th>
              <th className="px-4 py-3 text-left">Employee</th>
              <th className="px-4 py-3 text-left">Events</th>
              <th className="px-4 py-3 text-left">Amount</th>
              <th className="px-4 py-3 text-left">Status</th>
              <th className="px-4 py-3 text-left">Receipt / Notes</th>
              <th className="px-4 py-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td className="px-4 py-8 text-center" colSpan={7} style={{ color: 'var(--t-muted)' }}>Loading payment register...</td></tr>
            ) : rows.length ? rows.map(row => {
              const paid = row.payment?.status === 'paid';
              const busy = updatingKey === row.key;
              const noteValue = notes[row.key] ?? row.payment?.notes ?? '';

              return (
                <tr key={row.key} className="border-t align-top" style={{ borderColor: 'var(--t-border)' }}>
                  <td className="px-4 py-3">
                    <div className="font-bold" style={{ color: 'var(--t-text)' }}>{row.month}</div>
                    <div className="text-xs" style={{ color: 'var(--t-muted)' }}>{row.periodStart} to {row.periodEnd}</div>
                  </td>
                  <td className="px-4 py-3 font-bold" style={{ color: 'var(--t-text)' }}>{row.employeeName}</td>
                  <td className="px-4 py-3">
                    <div>{row.events}</div>
                    <div className="text-xs" style={{ color: 'var(--t-muted)' }}>{row.entries} entries</div>
                  </td>
                  <td className="px-4 py-3 font-bold">₹{row.amount.toLocaleString('en-IN')}</td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-black" style={{
                      background: paid ? '#e9f7df' : '#fff4e5',
                      color: paid ? '#1b4a1b' : '#9a5b00',
                    }}>
                      {paid && <CheckCircle2 className="h-3.5 w-3.5" />}
                      {paid ? 'Paid' : 'Unpaid'}
                    </span>
                    {row.payment?.paid_at && <div className="mt-1 text-xs" style={{ color: 'var(--t-muted)' }}>{new Date(row.payment.paid_at).toLocaleString('en-IN')}</div>}
                  </td>
                  <td className="px-4 py-3 min-w-[260px]">
                    {row.payment?.receipt_signed_url ? (
                      <a href={row.payment.receipt_signed_url} target="_blank" rel="noreferrer" className="mb-2 inline-flex items-center gap-1 text-xs font-bold" style={{ color: '#1b4a1b' }}>
                        <ExternalLink className="h-3.5 w-3.5" />
                        {row.payment.receipt_file_name || 'View receipt'}
                      </a>
                    ) : row.payment?.receipt_file_name ? (
                      <div className="mb-2 text-xs font-bold" style={{ color: 'var(--t-muted)' }}>{row.payment.receipt_file_name}</div>
                    ) : (
                      <div className="mb-2 text-xs" style={{ color: 'var(--t-muted)' }}>No receipt attached</div>
                    )}
                    {isAdmin && (
                      <div className="grid gap-2">
                        <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-xs font-bold" style={{ borderColor: 'var(--t-border)', color: 'var(--t-text)' }}>
                          <Upload className="h-3.5 w-3.5" />
                          {files[row.key]?.name || 'Attach receipt'}
                          <input type="file" accept="image/*,.pdf" className="hidden" onChange={event => onFile(row.key, event)} />
                        </label>
                        <input
                          value={noteValue}
                          onChange={event => onNote(row.key, event.target.value)}
                          placeholder="Payment note"
                          className="ta-input"
                        />
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {isAdmin ? (
                      <div className="flex flex-col items-end gap-2">
                        <button
                          onClick={() => onMark(row, 'paid')}
                          disabled={busy}
                          className="inline-flex items-center justify-center rounded-lg px-3 py-2 text-xs font-black text-white disabled:opacity-60"
                          style={{ background: '#1b4a1b' }}
                        >
                          {busy ? 'Saving...' : paid ? 'Update receipt' : 'Mark paid'}
                        </button>
                        {paid && (
                          <button
                            onClick={() => onMark(row, 'unpaid')}
                            disabled={busy}
                            className="rounded-lg border px-3 py-2 text-xs font-black disabled:opacity-60"
                            style={{ borderColor: '#f0997b', color: '#993c1d' }}
                          >
                            Mark unpaid
                          </button>
                        )}
                      </div>
                    ) : (
                      <span className="text-xs" style={{ color: 'var(--t-muted)' }}>Admin only</span>
                    )}
                  </td>
                </tr>
              );
            }) : (
              <tr><td className="px-4 py-8 text-center" colSpan={7} style={{ color: 'var(--t-muted)' }}>No payment periods found.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
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
