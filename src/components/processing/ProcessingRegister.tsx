'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { Download, History, Plus, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { emptyProcessingBatch, indiaToday, PROCESSING_ESTATES, PROCESSING_METHODS, PROCESSING_SEASON, PROCESSING_STAGES, processingNet, processingOutturn, type ProcessingBatch, type ProcessingHistory, type ProcessingSeason } from '@/lib/processing';
import styles from './processing.module.css';

const names: Record<string, string> = { processing_date: 'Processing date', lot_number: 'Register lot number', split_reference: 'Split reference', estate: 'Estate', product_type: 'Product type', method: 'Processing method', field_name: 'Field / block', variety: 'Variety', picking_round: 'Picking round', gross_kg: 'Gross cherry weight (kg)', tare_kg: 'Tare weight (kg)', net_kg: 'Net cherry weight (kg)', actual_dry_kg: 'Actual dry weight (kg)', brix: 'BRIX (°Bx)', ph: 'pH', moisture: 'Moisture (%)', fermentation_hours: 'Actual hours fermented', recipe_notes: 'Recipe notes', remarks: 'Remarks', dried_on: 'Drying completion date', status: 'Status', stage: 'Batch stage', start_date: 'Season start date' };
const numberFields = ['picking_round', 'gross_kg', 'tare_kg', 'actual_dry_kg', 'brix', 'ph', 'moisture'] as const;
function weight(value: number | null | undefined) { return value == null ? '—' : value.toLocaleString('en-IN', { maximumFractionDigits: 3 }); }
function date(value: string | null) { return value ? new Date(`${value}T00:00:00Z`).toLocaleDateString('en-GB', { timeZone: 'UTC' }) : '—'; }
function estateName(slug: string) { return PROCESSING_ESTATES.find(e => e.slug === slug)?.name ?? slug; }
async function jsonRequest(path: string, method = 'GET', body?: unknown) {
  const response = await fetch(path, { method, cache: 'no-store', headers: body ? { 'Content-Type': 'application/json' } : undefined, body: body ? JSON.stringify(body) : undefined });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Unable to complete the request.');
  return data;
}

export default function ProcessingRegister({ initialEstate = '' }: { initialEstate?: string }) {
  const [season, setSeason] = useState<ProcessingSeason | null>(null);
  const [start, setStart] = useState('');
  const [batches, setBatches] = useState<ProcessingBatch[]>([]);
  const [canWrite, setCanWrite] = useState(false);
  const [form, setForm] = useState<ProcessingBatch>(() => emptyProcessingBatch(initialEstate || undefined));
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [history, setHistory] = useState<ProcessingHistory[] | null>(null);
  const [historyTitle, setHistoryTitle] = useState('');
  const [historyBusy, setHistoryBusy] = useState(false);
  const operation = useRef(false);
  const formRef = useRef<HTMLElement>(null);

  useEffect(() => {
    let active = true;
    jsonRequest('/api/processing').then(data => {
      if (!active) return;
      setSeason(data.season); setStart(data.season.start_date || ''); setBatches(data.batches); setCanWrite(data.canWrite);
    }).catch(e => { if (active) setError(e.message); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);
  useEffect(() => {
    const guard = (e: BeforeUnloadEvent) => { if (dirty) e.preventDefault(); };
    window.addEventListener('beforeunload', guard);
    return () => window.removeEventListener('beforeunload', guard);
  }, [dirty]);

  const visible = initialEstate ? batches.filter(b => b.estate === initialEstate) : batches;
  const net = processingNet(form);
  const outturn = processingOutturn(form);
  const totalNet = visible.reduce((sum, b) => sum + (processingNet(b) ?? 0), 0);
  const dry = visible.filter(b => b.actual_dry_kg !== null);
  function update<K extends keyof ProcessingBatch>(key: K, value: ProcessingBatch[K]) { setForm(old => ({ ...old, [key]: value })); setDirty(true); setMessage(''); }
  function openBatch(batch?: ProcessingBatch) {
    if (dirty && !window.confirm('Discard the unsaved changes in this form?')) return;
    setForm(batch ? { ...batch } : emptyProcessingBatch(initialEstate || form.estate)); setDirty(false); setError(''); setMessage('');
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  async function saveSeason(e: FormEvent) {
    e.preventDefault(); if (operation.current || !season) return;
    operation.current = true; setBusy(true); setError(''); setMessage('');
    try { const data = await jsonRequest('/api/processing/season', 'PATCH', { start_date: start, revision: season.revision }); setSeason(data.season); setMessage('Season start date saved. You can now enter batches.'); }
    catch (e) { setError(e instanceof Error ? e.message : 'Unable to save season.'); }
    finally { operation.current = false; setBusy(false); }
  }
  async function saveBatch(e: FormEvent) {
    e.preventDefault(); if (operation.current) return;
    operation.current = true; setBusy(true); setError(''); setMessage('');
    try {
      const data = await jsonRequest('/api/processing', form.revision ? 'PATCH' : 'POST', form);
      setBatches(old => [data.batch, ...old.filter(b => b.id !== data.batch.id)].sort((a, b) => b.processing_date.localeCompare(a.processing_date) || a.id.localeCompare(b.id)));
      setForm(data.batch); setDirty(false); setHistory(null); setMessage('Batch saved. Open this same batch later to add measurements.');
    } catch (e) { setError(e instanceof Error ? e.message : 'Unable to save batch.'); }
    finally { operation.current = false; setBusy(false); }
  }
  async function showHistory(batch?: ProcessingBatch) {
    if (historyBusy) return;
    setHistoryBusy(true); setError(''); setHistory(null); setHistoryTitle(batch ? `${batch.lot_number}${batch.split_reference ? ` / ${batch.split_reference}` : ''}` : 'Season setup');
    try { const data = await jsonRequest(`/api/processing/history${batch ? `?batch=${batch.id}` : ''}`); setHistory(data.history); }
    catch (e) { setError(e instanceof Error ? e.message : 'Unable to load history.'); }
    finally { setHistoryBusy(false); }
  }
  async function reload() {
    if (operation.current || (dirty && !window.confirm('Reload and discard unsaved form changes?'))) return;
    operation.current = true; setBusy(true); setError('');
    try { const data = await jsonRequest('/api/processing'); setSeason(data.season); setStart(data.season.start_date || ''); setBatches(data.batches); setCanWrite(data.canWrite); setForm(emptyProcessingBatch(initialEstate || form.estate)); setDirty(false); setMessage('Register reloaded.'); }
    catch (e) { setError(e instanceof Error ? e.message : 'Unable to reload.'); }
    finally { operation.current = false; setBusy(false); }
  }
  async function exportExcel() {
    try {
      const XLSX = await import('xlsx');
      const rows = visible.map(b => ({ Season: PROCESSING_SEASON, Estate: estateName(b.estate), ...Object.fromEntries(Object.entries(names).filter(([key]) => key !== 'start_date' && key !== 'estate').map(([key, label]) => [label, key === 'net_kg' ? processingNet(b) ?? '' : b[key as keyof ProcessingBatch] ?? ''])), 'Actual outturn (%)': processingOutturn(b) ?? '', Revision: b.revision }));
      const book = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(book, XLSX.utils.json_to_sheet(rows.length ? rows : [{ Season: PROCESSING_SEASON, Estate: initialEstate ? estateName(initialEstate) : 'All estates', Note: 'No batches recorded' }]), 'Processing batches');
      XLSX.utils.book_append_sheet(book, XLSX.utils.json_to_sheet([{ Season: PROCESSING_SEASON, 'Season start': season?.start_date || '', 'Exported at (India)': new Date().toLocaleString('en-GB', { timeZone: 'Asia/Kolkata' }) }]), 'Season');
      XLSX.writeFile(book, `MSP_Processing_${PROCESSING_SEASON}_${initialEstate || 'all-estates'}.xlsx`);
    } catch { setError('Unable to export the register. Please try again.'); }
  }

  return <div className={styles.page}>
    <div className={styles.heading}><div><Link href="/processing-dashboard">Processing Data</Link><h1>Processing register · 2026–2027</h1><p>{initialEstate ? estateName(initialEstate) : 'All five estates'} · Enter once and update the same batch as processing continues.</p></div><Button variant="secondary" onClick={exportExcel} disabled={loading || !season}><Download size={16} />Export Excel</Button></div>
    <nav className={styles.estates} aria-label="Processing estates"><Link aria-current={!initialEstate ? 'page' : undefined} href="/processing-dashboard/2026-2027">All estates</Link>{PROCESSING_ESTATES.map(e => <Link aria-current={initialEstate === e.slug ? 'page' : undefined} key={e.slug} href={`/processing-dashboard/2026-2027/${e.slug}`} onClick={event => { if (dirty && !window.confirm('Leave this page and discard unsaved batch changes?')) event.preventDefault(); }}>{e.name}</Link>)}</nav>
    {error && <div className={styles.error} role="alert">{error} <Button variant="secondary" disabled={busy} onClick={reload}>Reload register</Button></div>}
    {message && <div className={styles.notice} role="status">{message}</div>}
    {loading ? <p role="status">Loading processing register…</p> : !season ? <p>Register could not be loaded. Use Reload register to try again.</p> : <>
      <section className={styles.panel}><div className={styles.heading}><h2>Season setup</h2><Button variant="secondary" disabled={historyBusy} onClick={() => showHistory()}><History size={16} />Setup history</Button></div><form onSubmit={saveSeason} className={styles.seasonForm}><label>Season<input value="2026–2027" readOnly /></label><label>Season start date<input type="date" required max={indiaToday()} value={start} disabled={!canWrite || busy} onChange={e => setStart(e.target.value)} /></label>{canWrite && <Button type="submit" disabled={busy || !start || start === season.start_date}><Save size={16} />Save start date</Button>}</form>{!season.start_date && <p className={styles.hint}>Choose the start date before entering the first batch.</p>}</section>
      <div className={styles.stats}><div><span>Batches</span><strong>{visible.length}</strong></div><div><span>Net cherry recorded</span><strong>{weight(totalNet)} kg</strong></div>{(['Dry cherry', 'Parchment'] as const).map(product => <div key={product}><span>Actual dry · {product.toLowerCase()}</span><strong>{weight(dry.filter(b => b.product_type === product).reduce((sum, b) => sum + (b.actual_dry_kg ?? 0), 0))} kg</strong></div>)}</div>
      <section ref={formRef} className={styles.panel}><div className={styles.heading}><h2>{form.revision ? `Update batch · ${form.lot_number}` : 'New batch'}</h2><span className={styles.badge}>{form.status}</span></div>
        {!canWrite ? <p>You have read access. An administrator enters and updates processing batches.</p> : <form onSubmit={saveBatch}>
          <fieldset disabled={busy || !season.start_date}><div className={styles.grid}>
            <label>Estate<select value={form.estate} onChange={e => update('estate', e.target.value)}>{PROCESSING_ESTATES.map(e => <option value={e.slug} key={e.slug}>{e.name}</option>)}</select></label>
            <label>Processing date<input type="date" required min={season.start_date || undefined} max={indiaToday()} value={form.processing_date} onChange={e => update('processing_date', e.target.value)} /></label>
            <label>Register lot number<input required maxLength={100} value={form.lot_number} placeholder="Use your existing register number" onChange={e => update('lot_number', e.target.value)} /></label>
            <label>Split reference (only for split lots)<input maxLength={100} value={form.split_reference} placeholder="Leave blank for a whole lot" onChange={e => update('split_reference', e.target.value)} /></label>
            <label>Field / block<input list="processing-fields" maxLength={100} value={form.field_name} placeholder="Choose or type a new field" onChange={e => update('field_name', e.target.value)} /></label>
            <label>Variety<input list="processing-varieties" maxLength={100} value={form.variety} placeholder="Choose or type a new variety" onChange={e => update('variety', e.target.value)} /></label>
            <label>Product type<select value={form.product_type} onChange={e => update('product_type', e.target.value as ProcessingBatch['product_type'])}><option>Parchment</option><option>Dry cherry</option></select></label>
            <label>Processing method<input required list="processing-methods" value={form.method} maxLength={100} onChange={e => update('method', e.target.value)} /></label>
            <label>Batch stage<select value={form.stage} onChange={e => update('stage', e.target.value as ProcessingBatch['stage'])}>{PROCESSING_STAGES.map(stage => <option key={stage}>{stage}</option>)}</select></label>
            {numberFields.map(key => <label key={key}>{names[key]}<input type="number" min={key === 'picking_round' ? 1 : 0} max={key === 'ph' ? 14 : key === 'moisture' || key === 'brix' ? 100 : key === 'picking_round' ? 1000 : 10000000} step={key === 'picking_round' ? 1 : '0.001'} value={form[key] ?? ''} placeholder="Leave blank until available" onChange={e => update(key, e.target.value === '' ? null : Number(e.target.value))} /></label>)}
            <label>Drying completion date<input type="date" min={form.processing_date} max={indiaToday()} value={form.dried_on || ''} onChange={e => update('dried_on', e.target.value || null)} /></label>
          </div><div className={styles.extraColumns}>
            <label>Recipe notes<textarea rows={3} maxLength={2000} value={form.recipe_notes} placeholder="Recipe and processing instructions" onChange={e => update('recipe_notes', e.target.value)} /></label>
            <label>Actual hours fermented<input type="number" min={0} max={10000} step="0.001" value={form.fermentation_hours ?? ''} placeholder="Enter when known" onChange={e => update('fermentation_hours', e.target.value === '' ? null : Number(e.target.value))} /></label>
            <label>Reserved for future use<input disabled value="" readOnly aria-label="Blank column reserved for future use" /></label>
          </div><div className={styles.calculations} aria-live="polite"><span>Net cherry: <strong>{weight(net)} kg</strong></span><span>Actual outturn: <strong>{outturn === null ? '—' : `${outturn.toFixed(2)}%`}</strong></span></div><p className={styles.hint}>Net = gross − tare. Actual outturn = actual dry ÷ net × 100. Enter tare as 0 if already excluded. Unfinished measurements stay blank; estimated dry weight will be added later.</p>
            <div className={styles.grid}><label className={styles.remarks}>Remarks<textarea rows={2} maxLength={2000} value={form.remarks} onChange={e => update('remarks', e.target.value)} /></label><label>Status<select value={form.status} onChange={e => update('status', e.target.value as ProcessingBatch['status'])}><option>In progress</option><option>Complete</option></select></label></div>
            {form.status === 'Complete' && <p className={styles.hint}>Completion requires stage Dried, gross and tare weights, actual dry weight, moisture and drying completion date.</p>}
            <div className={styles.actions}><Button type="submit"><Save size={16} />{busy ? 'Saving…' : form.revision ? 'Save batch changes' : 'Save batch'}</Button><Button type="button" variant="secondary" onClick={() => openBatch()}><Plus size={16} />New batch</Button>{dirty && <span className={styles.hint}>Unsaved changes</span>}</div>
          </fieldset>
        </form>}
        <datalist id="processing-fields">{[...new Set(batches.filter(b => b.estate === form.estate).map(b => b.field_name).filter(Boolean))].sort().map(x => <option key={x} value={x} />)}</datalist>
        <datalist id="processing-varieties">{[...new Set(batches.map(b => b.variety).filter(Boolean))].sort().map(x => <option key={x} value={x} />)}</datalist>
        <datalist id="processing-methods">{[...new Set([...PROCESSING_METHODS, ...batches.map(b => b.method)])].sort().map(x => <option key={x} value={x} />)}</datalist>
      </section>
      <section className={styles.panel}><div className={styles.heading}><h2>Batch register · {visible.length}</h2><Button variant="secondary" disabled={busy} onClick={reload}>Reload register</Button></div>{visible.length === 0 ? <p>No batches recorded yet. Save the season start date, then add your first batch above.</p> : <div className={styles.tableScroll}><table><thead><tr><th>Date</th><th>Estate / register lot</th><th>Product / method</th><th>Stage / status</th><th>Net kg</th><th>Actual dry kg</th><th>Actions</th></tr></thead><tbody>{visible.map(b => <tr key={b.id}><td>{date(b.processing_date)}</td><td>{estateName(b.estate)}<br /><strong>{b.lot_number}{b.split_reference ? ` / ${b.split_reference}` : ''}</strong></td><td>{b.product_type}<br />{b.method}</td><td>{b.stage}<br /><span className={styles.badge}>{b.status}</span></td><td>{weight(processingNet(b))}</td><td>{weight(b.actual_dry_kg)}</td><td><div className={styles.actions}>{canWrite && <Button variant="secondary" disabled={busy} onClick={() => openBatch(b)}>Open batch</Button>}<Button variant="secondary" disabled={historyBusy} onClick={() => showHistory(b)}><History size={15} />History</Button></div></td></tr>)}</tbody></table></div>}</section>
    </>}
    {historyBusy && <p role="status">Loading history…</p>}
    {history && <section className={styles.panel}><div className={styles.heading}><h2>Correction history · {historyTitle}</h2><Button variant="secondary" onClick={() => setHistory(null)}>Close history</Button></div>{history.length === 0 ? <p>No changes recorded.</p> : history.map(h => <div className={styles.historyItem} key={h.id}><strong>{h.before_data ? 'Updated' : 'Created'} by {h.actor_name}</strong><span className={styles.hint}> · {new Date(h.changed_at).toLocaleString('en-GB', { timeZone: 'Asia/Kolkata' })} IST</span><dl>{Object.entries(names).filter(([key]) => key in h.after_data && (!h.before_data ? h.after_data[key] !== null && h.after_data[key] !== '' : h.before_data[key] !== h.after_data[key])).map(([key, label]) => <div key={key}><dt>{label}</dt><dd>{h.before_data && <><del>{String(h.before_data[key] ?? 'Blank')}</del> → </>}{String(h.after_data[key] ?? 'Blank')}</dd></div>)}</dl></div>)}</section>}
  </div>;
}
