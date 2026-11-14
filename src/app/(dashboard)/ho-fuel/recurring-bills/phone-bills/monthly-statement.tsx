'use client';
import { DateInput } from '@/components/ui/date-input';
import { formatDate as formatAppDate } from '@/lib/date-format';


import { useEffect, useRef, useState } from 'react';
import { billMoney, billPeriod, historicallyPaid, paymentStatus, payeeTotals, totalBills, validPeriod, type PhoneBillRow, type PhoneStatement, type StatementFile } from '@/lib/phone-bills';
import css from './phone-bills.module.css';
import PaymentHistory from './payment-history';
import { phoneBillSource } from '@/lib/phone-bill-sources';

export default function MonthlyStatement({ rows, month, year, preview = false, onSelect, refreshVersion = 0 }: { rows: PhoneBillRow[]; month: string; year: string; preview?: boolean; refreshVersion?: number; onSelect: (month: string, year: string) => void }) {
  const period = billPeriod({ month, year });
  const source = phoneBillSource(period);
  const historical = historicallyPaid(period);
  const [revision, setRevision] = useState(0);
  const ready = validPeriod(period) && month !== 'ALL';
  const [state, setState] = useState<{ period: string; statement: PhoneStatement | null; files: StatementFile[]; error: string; loaded: boolean }>({ period: '', statement: null, files: [], error: '', loaded: false });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [payment, setPayment] = useState({ date: '', reference: '' });
  const activePeriod = useRef(period);
  const uploadInput = useRef<HTMLInputElement>(null);
  const loaded = preview || (state.period === period && state.loaded);
  const statement = state.period === period ? state.statement : null;
  const files = state.period === period ? state.files : [];
  const monthRows = rows.filter(r => billPeriod(r) === period);
  const statementRows = statement?.rows || monthRows;
  const total = statement ? Number(statement.total) : totalBills(statementRows);
  const missing = statementRows.some(r => r.amount === null);
  const error = state.period === period ? state.error : '';

  useEffect(() => {
    activePeriod.current = period;
    if (!ready || preview) return;
    const controller = new AbortController();
    fetch(`/api/phone-bills/statements?period=${period}`, { cache: 'no-store', signal: controller.signal }).then(async response => {
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Unable to load statement.');
      setState({ period, statement: body.statement, files: body.files || [], error: '', loaded: true });
    }).catch(error => {
      if (!controller.signal.aborted) setState({ period, statement: null, files: [], error: error.message, loaded: true });
    });
    return () => controller.abort();
  }, [period, ready, preview, refreshVersion]);

  async function issue() {
    if (preview) return;
    const selectedPeriod = period;
    setBusy(true); setMessage('');
    try {
      const response = await fetch('/api/phone-bills/statements', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ period }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Unable to issue statement.');
      if (activePeriod.current === selectedPeriod) { setState({ period, statement: body.statement, files: [], error: '', loaded: true }); setRevision(r => r + 1); setMessage('Statement saved. Use Preview / print one-page PDF to print or download it.'); }
    } catch (error) { if (activePeriod.current === selectedPeriod) setMessage(error instanceof Error ? error.message : 'Unable to save.'); }
    finally { setBusy(false); }
  }
  async function recordPayment(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!statement || preview || historical) return;
    const selectedPeriod = period;
    setBusy(true); setMessage('');
    try {
      const response = await fetch('/api/phone-bills/statements', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: statement.id, ...payment, amount: total }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Unable to record payment.');
      if (activePeriod.current === selectedPeriod) { setState(s => ({ ...s, statement: body.statement })); setRevision(r => r + 1); setMessage('Payment recorded. Upload the paid / signed copy below.'); }
    } catch (error) { if (activePeriod.current === selectedPeriod) setMessage(error instanceof Error ? error.message : 'Unable to record payment.'); }
    finally { setBusy(false); }
  }
  async function upload(file: File | undefined) {
    if (!file || !statement || preview) return;
    const selectedPeriod = period;
    if (!['application/pdf', 'image/jpeg', 'image/png'].includes(file.type) || file.size > 3 * 1024 * 1024 || !file.size) { setMessage('Choose a PDF, JPG or PNG smaller than 3 MB.'); return; }
    setBusy(true); setMessage('');
    try {
      const form = new FormData(); form.set('file', file); form.set('statementId', statement.id);
      const response = await fetch('/api/phone-bills/files', { method: 'POST', body: form });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Unable to upload signed copy.');
      if (activePeriod.current === selectedPeriod) { setState(s => ({ ...s, files: [body.file, ...s.files] })); setRevision(r => r + 1); setMessage('Scan saved permanently with this month’s statement.'); }
    } catch (error) { if (activePeriod.current === selectedPeriod) setMessage(error instanceof Error ? error.message : 'Unable to upload.'); }
    finally { setBusy(false); if (uploadInput.current) uploadInput.current.value = ''; }
  }

  return <section className={css.monthly} aria-labelledby="monthly-title">
    <div className={css.monthlyHead}><div><div className={css.eyebrow}>Monthly reimbursement</div><h2 id="monthly-title">{ready ? `${month} ${year}` : 'Select a month and year'}</h2><p>One statement · Two reimbursement recipients · Signed copies kept by month</p></div><span className={css.status}>{!ready ? 'Choose period' : paymentStatus(period, statement?.payment_date || null, files.length)}</span></div>
    {ready && <>
      {source && <p className={css.notice}>Source worksheet: <b>{source.worksheet}</b> · Prepared {source.prepared} · Bill month: {month} {year}. The source sheet shows {billMoney(source.originalTotal)}; the accounts below are recalculated to {billMoney(total)}. This is the same monthly reimbursement, retained once.</p>}
      <div className={css.recipientGrid}>{payeeTotals(statementRows).map(p => <div key={p.payee}><span>Reimburse {p.payee}</span><b>{billMoney(p.total)}</b></div>)}<div className={css.monthlyTotal}><span>Total · {statementRows.length} accounts</span><b>{billMoney(total)}</b></div></div>
      <div className={css.workflow}>
        <div><h3>1. Prepare &amp; print</h3><p>Review all accounts, save the statement, then open its preview to print or save a PDF.</p><a className={css.actionBtn} href={`/api/phone-bills/pdf?period=${period}`} target="_blank" rel="noopener noreferrer">Preview / print one-page PDF</a>{!statement && <button className={`${css.actionBtn} ${css.actionBtnPrimary}`} disabled={preview || !loaded || !!error || !statementRows.length || missing || total <= 0 || busy} onClick={issue}>{busy ? 'Please wait…' : 'Save statement for printing'}</button>}{statement && <p className={css.reference}>{statement.reference}</p>}{missing && <p role="alert">Fill missing amounts before issuing.</p>}</div>
        <div><h3>2. Mark as paid</h3>{historical ? <><b>Paid — historical</b><p>Confirmed paid through February 2026. No payment date or reference has been inferred. You can save the statement and attach an old scan.</p></> : statement?.payment_date ? <><b>{billMoney(Number(statement.payment_amount))} paid</b><p>Date: {formatAppDate(statement.payment_date)}<br/>Reference: {statement.payment_reference}</p></> : <form onSubmit={recordPayment}>{!statement && <p>Save the statement first to enable payment recording.</p>}<label className={css.label}>Payment date<DateInput aria-label="Payment date" type="date" className={css.input} required disabled={!statement || busy} value={payment.date} onChange={e => setPayment(s => ({ ...s, date: e.target.value }))}/></label><label className={css.label}>Payment / voucher reference<input aria-label="Payment reference" className={css.input} required maxLength={200} disabled={!statement || busy} value={payment.reference} onChange={e => setPayment(s => ({ ...s, reference: e.target.value }))}/></label><button className={css.actionBtn} disabled={!statement || busy}>Mark as paid</button></form>}</div>
        <div><h3>3. Upload signed copy</h3><p>Upload a scanned PDF or a photograph of each signed page. All copies are retained for this month. Uploading does not change payment status.</p><button className={`${css.actionBtn} ${css.actionBtnPrimary}`} disabled={preview || !statement || busy} onClick={() => uploadInput.current?.click()}>Upload signed copy</button>{!statement && <p>Save the statement or email the monthly PDF first, then upload the signed scan here.</p>}<label className={css.uploadPicker}>Signed document<input ref={uploadInput} aria-label="Signed document" type="file" hidden accept="application/pdf,image/jpeg,image/png" disabled={preview || !statement || busy} onChange={e => upload(e.target.files?.[0])}/></label><small>PDF, JPG or PNG · Up to 3 MB per file · Find saved copies later in Payment history &amp; saved scans.</small><ul className={css.fileList}>{files.map(file => <li key={file.id}><a href={`/api/phone-bills/files?id=${file.id}`} target="_blank" rel="noopener noreferrer">{file.file_name}</a><small>{formatAppDate(new Date(file.created_at))}</small></li>)}</ul></div>
      </div>
      <p className={css.monthlyNote}>The monthly statement includes every account for {month} {year}, regardless of the other register filters. Prepared by Ashok · Checked by Ponraj · Payment received by Ashok.</p>
      {preview && <p className={css.notice}>Preview only — printing and filters work. Saving, payment and uploads will be enabled after approval and database setup.</p>}
      {error && <p role="alert" className={css.notice}>{error} You can still review the draft.</p>}
      {message && <p role="status" className={css.notice}>{message}</p>}
    </>}
    <PaymentHistory rows={rows} preview={preview} revision={revision + refreshVersion} onSelect={onSelect} />
  </section>;
}
