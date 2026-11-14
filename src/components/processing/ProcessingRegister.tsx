'use client';
import { DateInput } from '@/components/ui/date-input';
import { formatDate as formatAppDate, formatDateTime as formatAppDateTime } from '@/lib/date-format';


import { useEffect, useRef, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { Download, History, Plus, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { emptyProcessingBatch, indiaToday, PROCESSING_ESTATES, PROCESSING_OPTIONS, PROCESSING_METHODS, PROCESSING_SEASON, PROCESSING_STAGES, processingNet, processingOutturn, processingWetOutturn, processingDryFromWet, processingYardDays, processingLotBase, processingQualities, isGowriOption, isNoFermentation, type ProcessingBatch, type ProcessingHistory, type ProcessingSeason } from '@/lib/processing';
import styles from './processing.module.css';
import ProcessingSelect from './ProcessingSelect';

const names: Record<string, string> = { harvest_date: 'Harvest date', processing_date: 'Processing date', lot_type: 'Lot type', quality_code: 'Quality code', lot_number: 'Register lot number', estate: 'Estate', product_type: 'Product type', method: 'Processing method', field_name: 'Field / block', variety: 'Variety', picking_round: 'Picking round', gross_kg: 'Ripe cherry (kg)', floats_kg: 'Floats (kg)', wet_kg: 'Wet parchment (kg)', net_kg: 'Net cherry weight (kg)', actual_dry_kg: 'Actual dry weight (kg)', brix: 'BRIX (°Bx)', ph: 'pH', moisture: 'Moisture (%)', fermentation_hours: 'Actual hours fermented', drying_started_on: 'Put out to dry date', recipe_notes: 'Recipe notes', remarks: 'Remarks', dried_on: 'Bagged and weighed date', drying_surface: 'Drying surface', godown_date: 'Godown transfer date', storage_location: 'Storage location', status: 'Status', stage: 'Batch stage', start_date: 'Season start date' };
const numberFields = ['gross_kg', 'floats_kg', 'wet_kg', 'actual_dry_kg', 'brix', 'ph', 'moisture'] as const;
function weight(value: number | null | undefined) { return value == null ? '—' : value.toLocaleString('en-IN', { maximumFractionDigits: 3 }); }
function date(value: string | null) { return value ? formatAppDate(new Date(`${value}T00:00:00Z`)) : '—'; }
function historyValue(key: string, value: unknown) { return /(?:_date|_on)$/.test(key) ? formatAppDate(value, 'Blank') : String(value ?? 'Blank'); }
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
  const wetOutturn = processingWetOutturn(form);
  const dryFromWet = processingDryFromWet(form);
  const yardDays = processingYardDays(form);
  const noFermentation = isNoFermentation(form.method);
  const lotBase = processingLotBase(form);
  const optionList = (base: readonly string[], key: keyof ProcessingBatch, estateOnly = false) => [...new Set([...base, ...batches.filter(b => !estateOnly || b.estate === form.estate).map(b => String(b[key] ?? '')).filter(Boolean)])].filter(v => !isGowriOption(v));
  const fieldOptions = optionList(PROCESSING_OPTIONS.fields[form.estate as keyof typeof PROCESSING_OPTIONS.fields] ?? [], 'field_name', true);
  const totalNet = visible.reduce((sum, b) => sum + (processingNet(b) ?? 0), 0);
  const dry = visible.filter(b => b.actual_dry_kg !== null);
  function update<K extends keyof ProcessingBatch>(key: K, value: ProcessingBatch[K]) {
    setForm(old => {
      const next = { ...old, [key]: value };
      if (key === 'estate') next.field_name = '';
      if (key === 'lot_type') next.quality_code = processingQualities(String(value))[0] || '';
      if (key === 'lot_type' || key === 'quality_code') {
        next.method = next.quality_code === '1' ? 'MSP 90 + Special Washed' : 'Naturals - No Fermentation';
        next.product_type = next.quality_code === '1' ? 'Parchment' : 'Dry cherry';
      }
      if (key === 'method') {
        if (/natural/i.test(String(value))) next.product_type = 'Dry cherry';
        else if (/washed|honey|psd/i.test(String(value))) next.product_type = 'Parchment';
      }
      if (key === 'processing_date' && isNoFermentation(next.method) && old.drying_started_on === old.processing_date) next.drying_started_on = String(value);
      if (key === 'method' || key === 'quality_code' || key === 'lot_type') {
        if (isNoFermentation(next.method)) {
          next.fermentation_hours = 0;
          if (!next.drying_started_on) next.drying_started_on = next.processing_date;
          if (next.stage === 'Received' || next.stage === 'Fermenting') next.stage = 'Drying';
        } else if (isNoFermentation(old.method)) {
          next.fermentation_hours = null;
          if (!old.revision && !old.dried_on) { next.drying_started_on = null; next.stage = 'Fermenting'; }
        }
      }
      return next;
    }); setDirty(true); setMessage('');
  }
  function openBatch(batch?: ProcessingBatch) {
    if (dirty && !window.confirm('Discard the unsaved changes in this form?')) return;
    setForm(batch ? { ...emptyProcessingBatch(batch.estate), ...batch } : emptyProcessingBatch(initialEstate || form.estate)); setDirty(false); setError(''); setMessage('');
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
      const rows = visible.map(b => ({ Season: PROCESSING_SEASON, Estate: estateName(b.estate), ...Object.fromEntries(Object.entries(names).filter(([key]) => key !== 'start_date' && key !== 'estate').map(([key, label]) => [label, key === 'net_kg' ? processingNet(b) ?? '' : ['harvest_date','processing_date','drying_started_on','dried_on','godown_date'].includes(key) ? formatAppDate(b[key as keyof ProcessingBatch], '') : b[key as keyof ProcessingBatch] ?? ''])), 'Ripe to wet outturn (%)': processingWetOutturn(b) ?? '', 'Wet to dry outturn (%)': processingDryFromWet(b) ?? '', 'Actual ripe to dry outturn (%)': processingOutturn(b) ?? '', 'Days on yard': processingYardDays(b) ?? '', Revision: b.revision }));
      const book = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(book, XLSX.utils.json_to_sheet(rows.length ? rows : [{ Season: PROCESSING_SEASON, Estate: initialEstate ? estateName(initialEstate) : 'All estates', Note: 'No batches recorded' }]), 'Processing batches');
      XLSX.utils.book_append_sheet(book, XLSX.utils.json_to_sheet([{ Season: PROCESSING_SEASON, 'Season start': formatAppDate(season?.start_date, ''), 'Exported at (India)': formatAppDateTime(new Date()) }]), 'Season');
      XLSX.writeFile(book, `MSP_Processing_${PROCESSING_SEASON}_${initialEstate || 'all-estates'}.xlsx`);
    } catch { setError('Unable to export the register. Please try again.'); }
  }

  return <div className={styles.page}>
    <div className={styles.heading}><div><Link href="/processing-dashboard">Processing Data</Link><h1>Processing register · 2026–2027</h1><p>{initialEstate ? estateName(initialEstate) : 'All five estates'} · Enter once and update the same batch as processing continues.</p></div><Button variant="secondary" onClick={exportExcel} disabled={loading || !season}><Download size={16} />Export Excel</Button></div>
    <nav className={styles.estates} aria-label="Processing estates"><Link aria-current={!initialEstate ? 'page' : undefined} href="/processing-dashboard/2026-2027">All estates</Link>{PROCESSING_ESTATES.map(e => <Link aria-current={initialEstate === e.slug ? 'page' : undefined} key={e.slug} href={`/processing-dashboard/2026-2027/${e.slug}`} onClick={event => { if (dirty && !window.confirm('Leave this page and discard unsaved batch changes?')) event.preventDefault(); }}>{e.name}</Link>)}</nav>
    {error && <div className={styles.error} role="alert">{error} <Button variant="secondary" disabled={busy} onClick={reload}>Reload register</Button></div>}
    {message && <div className={styles.notice} role="status">{message}</div>}
    {loading ? <p role="status">Loading processing register…</p> : !season ? <p>Register could not be loaded. Use Reload register to try again.</p> : <>
      <section className={styles.panel}><div className={styles.heading}><h2>Season setup</h2><Button variant="secondary" disabled={historyBusy} onClick={() => showHistory()}><History size={16} />Setup history</Button></div><form onSubmit={saveSeason} className={styles.seasonForm}><label>Season<input value="2026–2027" readOnly /></label><label>Season start date<DateInput type="date" required max={indiaToday()} value={start} disabled={!canWrite || busy} onChange={e => setStart(e.target.value)} /></label>{canWrite && <Button type="submit" disabled={busy || !start || start === season.start_date}><Save size={16} />Save start date</Button>}</form>{!season.start_date && <p className={styles.hint}>Choose the start date before entering the first batch.</p>}</section>
      <div className={styles.stats}><div><span>Batches</span><strong>{visible.length}</strong></div><div><span>Net cherry recorded</span><strong>{weight(totalNet)} kg</strong></div>{(['Dry cherry', 'Parchment'] as const).map(product => <div key={product}><span>Actual dry · {product.toLowerCase()}</span><strong>{weight(dry.filter(b => b.product_type === product).reduce((sum, b) => sum + (b.actual_dry_kg ?? 0), 0))} kg</strong></div>)}</div>
      <section ref={formRef} className={styles.panel}><div className={styles.heading}><h2>{form.revision ? `Update batch · ${form.lot_number}` : 'New batch'}</h2><span className={styles.badge}>{form.status}</span></div>
        {!canWrite ? <p>You have read access. An administrator enters and updates processing batches.</p> : <form onSubmit={saveBatch}>
          <fieldset key={form.id} disabled={busy || !season.start_date}><div className={styles.grid}>
            <label>Estate<select value={form.estate} onChange={e => update('estate', e.target.value)}>{PROCESSING_ESTATES.map(e => <option value={e.slug} key={e.slug}>{e.name}</option>)}</select></label>
            <label>Harvest date<DateInput type="date" required min={season.start_date || undefined} max={form.processing_date} value={form.harvest_date} onChange={e => update('harvest_date', e.target.value)} /></label>
            <label>Processing date<DateInput type="date" required min={form.harvest_date || season.start_date || undefined} max={indiaToday()} value={form.processing_date} onChange={e => update('processing_date', e.target.value)} /></label>
            <ProcessingSelect key={form.estate} label="Field / block" required allowNew value={form.field_name} options={fieldOptions} onChange={v => update('field_name', v)} />
            <ProcessingSelect label="Variety" required allowNew value={form.variety} options={optionList(PROCESSING_OPTIONS.varieties, 'variety')} onChange={v => update('variety', v)} />
            <ProcessingSelect label="Picking round" required value={form.picking_round} options={PROCESSING_OPTIONS.rounds} onChange={v => update('picking_round', v)} />
            <ProcessingSelect label="Lot type" required value={form.lot_type} options={PROCESSING_OPTIONS.lotTypes} onChange={v => update('lot_type', v)} />
            <label>Quality<select required value={form.quality_code} onChange={e => update('quality_code', e.target.value)}>{processingQualities(form.lot_type).map(q => <option key={q} value={q}>{q === '1' ? '1 · Special' : q === '2' ? '2 · Regular' : q}</option>)}</select></label>
            <label>Lot number · automatic<input readOnly value={form.revision ? form.lot_number : lotBase ? `${lotBase}-…` : ''} placeholder="Assigned when the batch is saved" /></label>
            <label>Product type<select value={form.product_type} onChange={e => update('product_type', e.target.value as ProcessingBatch['product_type'])}><option>Parchment</option><option>Dry cherry</option></select></label>
            <ProcessingSelect label="Processing method" required allowNew value={form.method} options={optionList(PROCESSING_METHODS, 'method')} onChange={v => update('method', v)} />
            <label>Actual hours fermented<input type="number" min={0} max={10000} step="0.001" disabled={noFermentation} value={noFermentation ? 0 : form.fermentation_hours ?? ''} placeholder="Enter the actual hours manually" onChange={e => update('fermentation_hours', e.target.value === '' ? null : Number(e.target.value))} /></label>
            <label>Put out to dry date<DateInput type="date" min={form.processing_date} max={form.dried_on || indiaToday()} value={form.drying_started_on || ''} onChange={e => update('drying_started_on', e.target.value || null)} /></label>
            <label>Batch stage<select value={form.stage} onChange={e => update('stage', e.target.value as ProcessingBatch['stage'])}>{PROCESSING_STAGES.filter(stage => !(noFermentation && stage === 'Fermenting')).map(stage => <option key={stage}>{stage}</option>)}</select></label>
            {numberFields.map(key => <label key={key}>{names[key]}<input type="number" min={0} max={key === 'ph' ? 14 : key === 'moisture' || key === 'brix' ? 100 : 10000000} step="0.001" value={form[key] ?? ''} placeholder="Leave blank until available" onChange={e => update(key, e.target.value === '' ? null : Number(e.target.value))} /></label>)}
            <label>Bagged and weighed date<DateInput type="date" min={form.drying_started_on || form.processing_date} max={indiaToday()} value={form.dried_on || ''} onChange={e => update('dried_on', e.target.value || null)} /></label>
            <ProcessingSelect label="Drying surface" allowNew value={form.drying_surface} options={optionList(PROCESSING_OPTIONS.dryingSurfaces, 'drying_surface')} onChange={v => update('drying_surface', v)} />
            <label>Godown transfer date<DateInput type="date" min={form.dried_on || form.processing_date} max={indiaToday()} value={form.godown_date || ''} onChange={e => update('godown_date', e.target.value || null)} /></label>
            <ProcessingSelect label="Storage location" allowNew value={form.storage_location} options={optionList(PROCESSING_OPTIONS.storageLocations, 'storage_location')} onChange={v => update('storage_location', v)} />
          </div><div className={styles.extraColumns}>
            <label>Recipe notes<textarea rows={3} maxLength={2000} value={form.recipe_notes} placeholder="Recipe and processing instructions" onChange={e => update('recipe_notes', e.target.value)} /></label>

            <label>Reserved for future use<input disabled value="" readOnly aria-label="Blank column reserved for future use" /></label>
          </div><div className={styles.calculations} aria-live="polite"><span>Net cherry: <strong>{weight(net)} kg</strong></span><span>Actual outturn: <strong>{outturn === null ? '—' : `${outturn.toFixed(2)}%`}</strong></span><span>Ripe → wet: <strong>{wetOutturn === null ? '—' : `${wetOutturn.toFixed(2)}%`}</strong></span><span>Wet → dry: <strong>{dryFromWet === null ? '—' : `${dryFromWet.toFixed(2)}%`}</strong></span><span>Days on yard: <strong>{yardDays ?? '—'}</strong></span></div><p className={styles.hint}>Net = ripe cherry − floats. Enter floats as 0 only when none were removed. Unfinished measurements stay blank. Yard days run from put out to dry to bagged and weighed. No-fermentation batches go straight to drying with 0 hours. The lot sequence is assigned on save; changing estate, harvest date, variety or quality assigns a new lot number.</p>
            <div className={styles.grid}><label className={styles.remarks}>Remarks<textarea rows={2} maxLength={2000} value={form.remarks} onChange={e => update('remarks', e.target.value)} /></label><label>Status<select value={form.status} onChange={e => update('status', e.target.value as ProcessingBatch['status'])}><option>In progress</option><option>Complete</option></select></label></div>
            {form.status === 'Complete' && <p className={styles.hint}>Completion requires stage Dried, ripe cherry and floats weights, actual dry weight, moisture, fermentation hours, put out to dry and bagged dates.</p>}
            <div className={styles.actions}><Button type="submit"><Save size={16} />{busy ? 'Saving…' : form.revision ? 'Save batch changes' : 'Save batch'}</Button><Button type="button" variant="secondary" onClick={() => openBatch()}><Plus size={16} />New batch</Button>{dirty && <span className={styles.hint}>Unsaved changes</span>}</div>
          </fieldset>
        </form>}
      </section>
      <section className={styles.panel}><div className={styles.heading}><h2>Batch register · {visible.length}</h2><Button variant="secondary" disabled={busy} onClick={reload}>Reload register</Button></div>{visible.length === 0 ? <p>No batches recorded yet. Save the season start date, then add your first batch above.</p> : <div className={styles.tableScroll}><table><thead><tr><th>Date</th><th>Estate / register lot</th><th>Product / method</th><th>Stage / status</th><th>Net kg</th><th>Actual dry kg</th><th>Actions</th></tr></thead><tbody>{visible.map(b => <tr key={b.id}><td>{date(b.processing_date)}</td><td>{estateName(b.estate)}<br /><strong>{b.lot_number}{b.split_reference ? ` / ${b.split_reference}` : ''}</strong></td><td>{b.product_type}<br />{b.method}</td><td>{b.stage}<br /><span className={styles.badge}>{b.status}</span></td><td>{weight(processingNet(b))}</td><td>{weight(b.actual_dry_kg)}</td><td><div className={styles.actions}>{canWrite && <Button variant="secondary" disabled={busy} onClick={() => openBatch(b)}>Open batch</Button>}<Button variant="secondary" disabled={historyBusy} onClick={() => showHistory(b)}><History size={15} />History</Button></div></td></tr>)}</tbody></table></div>}</section>
    </>}
    {historyBusy && <p role="status">Loading history…</p>}
    {history && <section className={styles.panel}><div className={styles.heading}><h2>Correction history · {historyTitle}</h2><Button variant="secondary" onClick={() => setHistory(null)}>Close history</Button></div>{history.length === 0 ? <p>No changes recorded.</p> : history.map(h => <div className={styles.historyItem} key={h.id}><strong>{h.before_data ? 'Updated' : 'Created'} by {h.actor_name}</strong><span className={styles.hint}> · {formatAppDateTime(new Date(h.changed_at))} IST</span><dl>{Object.entries(names).filter(([key]) => key in h.after_data && (!h.before_data ? h.after_data[key] !== null && h.after_data[key] !== '' : h.before_data[key] !== h.after_data[key])).map(([key, label]) => <div key={key}><dt>{label}</dt><dd>{h.before_data && <><del>{historyValue(key, h.before_data[key])}</del> → </>}{historyValue(key, h.after_data[key])}</dd></div>)}</dl></div>)}</section>}
  </div>;
}
