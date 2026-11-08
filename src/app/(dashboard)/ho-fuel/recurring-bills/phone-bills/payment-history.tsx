'use client';

import { useEffect, useState } from 'react';
import { BILL_MONTHS, billMoney, buildPaymentHistory, type PaymentHistoryRow, type PhoneBillRow } from '@/lib/phone-bills';
import css from './phone-bills.module.css';

export default function PaymentHistory({ rows, preview, revision, onSelect }: {
  rows: PhoneBillRow[]; preview: boolean; revision: number; onSelect: (month: string, year: string) => void;
}) {
  const [history, setHistory] = useState<PaymentHistoryRow[]>([]);
  const [loading, setLoading] = useState(!preview);
  const [error, setError] = useState('');
  const [year, setYear] = useState('ALL');
  const [status, setStatus] = useState('ALL');
  useEffect(() => {
    if (preview) return;
    const controller = new AbortController();
    fetch('/api/phone-bills/history', { cache: 'no-store', signal: controller.signal }).then(async response => {
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Unable to load payment history.');
      setHistory(body.history); setError(''); setLoading(false);
    }).catch(error => {
      if (!controller.signal.aborted) { setError(error.message); setLoading(false); }
    });
    return () => controller.abort();
  }, [preview, revision, rows]);
  const records = preview ? buildPaymentHistory(rows, [], []) : history;
  const years = [...new Set(records.map(r => r.period.slice(0, 4)))].sort().reverse();
  const filtered = records.filter(r => (year === 'ALL' || r.period.startsWith(`${year}-`)) && (status === 'ALL' || (status === 'PAID' ? r.paid : !r.paid)));
  return <section className={css.history} aria-labelledby="payment-history-title">
    <h2 id="payment-history-title">Payment history &amp; saved scans</h2>
    <p>Paid through February 2026, as confirmed. Historical dates and voucher references are unknown unless recorded. March 2026 onward stays unpaid until payment is recorded. Uploading a scan does not mark a month paid.</p>
    <div className={css.historyFilters}>
      <label className={css.label}>History year<select aria-label="History year" className={css.select} value={year} onChange={e => setYear(e.target.value)}><option value="ALL">All years</option>{years.map(y => <option key={y}>{y}</option>)}</select></label>
      <label className={css.label}>Payment status<select aria-label="Payment status" className={css.select} value={status} onChange={e => setStatus(e.target.value)}><option value="ALL">All payments</option><option value="UNPAID">Unpaid only</option><option value="PAID">Paid only</option></select></label>
    </div>
    {loading ? <p role="status">Loading payment history…</p> : error ? <p role="alert" className={css.notice}>{error} Reload the page to try again.</p> : <div className={css.tableScroll}><table className={css.table}>
      <thead><tr><th>Month</th><th>Amount</th><th>Status</th><th>Payment date / reference</th><th>Saved copies</th><th>Statement</th></tr></thead>
      <tbody>{filtered.map(r => <tr key={r.period}>
        <td>{BILL_MONTHS[Number(r.period.slice(5)) - 1]} {r.period.slice(0, 4)}</td>
        <td>{billMoney(r.total)}{r.missingAmounts && <small> · Incomplete amounts</small>}</td>
        <td>{r.status}</td>
        <td>{r.paymentDate || (r.historical ? 'Historical — date not recorded' : '—')}{r.reference && <div>{r.reference}</div>}</td>
        <td>{r.files.length ? <ul className={css.fileList}>{r.files.map(f => <li key={f.id}><a href={`/api/phone-bills/files?id=${f.id}`} target="_blank" rel="noopener noreferrer">View saved copy · {f.file_name}</a></li>)}</ul> : 'No scan saved'}</td>
        <td><button className={css.actionBtn} onClick={() => { onSelect(BILL_MONTHS[Number(r.period.slice(5)) - 1], r.period.slice(0, 4)); document.getElementById('monthly-title')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }}>Open month</button></td>
      </tr>)}</tbody>
    </table>{!filtered.length && <p>No months match these filters.</p>}</div>}
  </section>;
}
