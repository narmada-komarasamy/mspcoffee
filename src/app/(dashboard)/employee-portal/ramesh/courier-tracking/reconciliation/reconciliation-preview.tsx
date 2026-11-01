'use client';

import {useEffect,useMemo,useRef,useState} from 'react';
import Link from 'next/link';
import {ArrowLeft,ArrowRight,CheckCircle2,FileUp,Download,AlertCircle,ClipboardList,CalendarDays} from 'lucide-react';
import {dispatchReadiness,reconciliation,type CourierBill,type ReconciliationShipment,type MatchStatus} from '@/lib/courier-reconciliation';
import {practiceData} from '@/lib/courier-reconciliation-practice';
import styles from './reconciliation.module.css';

const money=(n:number|null|undefined)=>n==null?'Not read':new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR',maximumFractionDigits:2}).format(n);
const labels:Record<MatchStatus,string>={matched:'Matched',duplicate:'Repeated on bill',missing_tracking:'AWB missing',not_found:'Not in register',ambiguous:'Multiple records',date_difference:'Date to check',cost_difference:'Charge difference',destination_difference:'Destination to check',invalid_line:'Details to check',already_billed:'Already billed'};
const period=(month:string)=>{const m=/^\d{4}-\d{2}$/.test(month)?month:'2026-11';const [year,num]=m.split('-').map(Number);return {from:m+'-01',to:m+'-'+new Date(Date.UTC(year,num,0)).getUTCDate()};};
function csv(value:unknown){let text=String(value??'');if(/^\s*[=+@-]/.test(text))text="'"+text;return '"'+text.replace(/"/g,'""')+'"';}
async function readJson(response:Response){if(response.status===401||response.redirected)throw new Error('Sign in to MSP Coffee to load the real register.');const value=await response.json();if(!response.ok)throw new Error(value.error||'The request could not be completed.');return value;}

export default function ReconciliationPreview(){
  const initial=useMemo(()=>practiceData(false),[]);
  const [bill,setBill]=useState<CourierBill>(initial.bill);
  const [shipments,setShipments]=useState<ReconciliationShipment[]>(initial.shipments);
  const [liveShipments,setLiveShipments]=useState<ReconciliationShipment[]>([]);
  const [loaded,setLoaded]=useState(false);
  const [liveError,setLiveError]=useState('');
  const [error,setError]=useState('');
  const [mode,setMode]=useState('practice-issues');
  const [month,setMonth]=useState('2026-11');
  const [busy,setBusy]=useState(false);
  const [approved,setApproved]=useState(false);
  const [onlyIssues,setOnlyIssues]=useState(false);
  const [originalUrl,setOriginalUrl]=useState('');
  const fileInput=useRef<HTMLInputElement>(null);
  const matchingSection=useRef<HTMLElement>(null);
  const result=useMemo(()=>reconciliation(bill,shipments),[bill,shipments]);
  const dates=period(month);
  const readiness=useMemo(()=>dispatchReadiness(liveShipments,dates.from,dates.to),[liveShipments,dates.from,dates.to]);
  const practice=mode.startsWith('practice');
  useEffect(()=>{
    const controller=new AbortController();
    fetch('/api/courier/reconciliation/preview',{signal:controller.signal}).then(readJson).then(data=>{setLiveShipments(data.shipments);setLoaded(true);}).catch(error=>{if(error.name!=='AbortError')setLiveError(error.message);});
    return ()=>controller.abort();
  },[]);
  useEffect(()=>()=>{if(originalUrl)URL.revokeObjectURL(originalUrl);},[originalUrl]);
  function changeBill<K extends keyof CourierBill>(key:K,value:CourierBill[K]){setBill(previous=>({...previous,[key]:value}));setApproved(false);}
  async function chooseMode(next:string){
    setError('');setApproved(false);setOriginalUrl('');
    if(next.startsWith('practice')){const data=practiceData(next==='practice-clean');setBill(data.bill);setShipments(data.shipments);setMode(next);return;}
    setBusy(true);
    try{const data=await readJson(await fetch('/api/courier/reconciliation/preview?sample='+next));setBill(data.bill);setShipments(data.shipments);setLiveShipments(data.shipments);setLoaded(true);setMode(next);}
    catch(error){setError(error instanceof Error?error.message:'Unable to load this sample.');}
    finally{setBusy(false);}
  }
  async function upload(file:File){
    setError('');setApproved(false);
    if(file.size>4*1024*1024){setError('Choose a PDF or image no larger than 4 MB. Include all pages of one invoice.');return;}
    setBusy(true);
    try{
      const form=new FormData();form.set('file',file);
      const data=await readJson(await fetch('/api/courier/reconciliation/extract',{method:'POST',body:form}));
      const register=await readJson(await fetch('/api/courier/reconciliation/preview'));
      setLiveShipments(register.shipments);setLoaded(true);setBill({...data.bill,sourceLabel:file.name});setShipments(register.shipments);setMode('upload');setOriginalUrl(URL.createObjectURL(file));
    }catch(error){setError(error instanceof Error?error.message:'Unable to read the file.');}
    finally{setBusy(false);if(fileInput.current)fileInput.current.value='';}
  }
  function exportReport(){
    const rows:unknown[][]=[['MSP Coffee courier reconciliation preview — no live approval or payment'],['Source',bill.sourceLabel],['Invoice',bill.invoiceNumber],['Courier',bill.courier],['Billing period',bill.periodFrom,bill.periodTo],['Billed to',bill.billedTo],['Freight subtotal',bill.subtotal],['Fuel',bill.fuel],['CGST',bill.cgst],['SGST',bill.sgst],['IGST',bill.igst],['Other',bill.other],['Rounding',bill.rounding],['Gross invoice total',bill.total],['Approval preview',approved?'Simulated Ramesh approval':'Not approved'],[],['Consignment','Dispatch date','Destination','Bill freight','Register recipient','Match result','Reason'],...result.rows.map(r=>[r.line.tracking,r.line.sent,r.line.destination,r.line.amount,r.shipment?.recipientName??'',labels[r.status],r.reason]),[],['Recorded dispatches absent from bill'],...result.unbilled.map(s=>[s.tracking??'',s.sent,s.city??'',null,s.recipientName,'Not billed']),[],['Invoice checks'],...result.issues.map(s=>[s]),...bill.warnings.map(s=>[s])];
    const url=URL.createObjectURL(new Blob(['\uFEFF'+rows.map(r=>r.map(csv).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download='courier-reconciliation-preview-'+bill.periodFrom+'.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  const visibleRows=result.rows.filter(row=>!onlyIssues||row.status!=='matched');
  return <main className={styles.page}>
    <div className={styles.topline}><Link href="/employee-portal/ramesh/courier-tracking"><ArrowLeft size={15}/> Courier and tracking</Link><span className={styles.preview}>WORKING PREVIEW · CHANGES ARE NOT SAVED</span></div>
    <header className={styles.header}><div><div className={styles.eyebrow}>MSP COFFEE · MONTHLY ACCOUNTS</div><h1>Every parcel. Every bill. Checked.</h1><p>Ramesh records dispatches through the month, then checks each courier invoice before approving it.</p></div><div className={styles.avatar}>R<span>Ramesh<br/><small>Reconciliation approver</small></span></div></header>
    <div className={styles.timeline}><span><CalendarDays size={19}/><b>1 November 2026</b> Start recording every dispatch</span><ArrowRight size={18}/><span><ClipboardList size={19}/><b>5 December 2026</b> First November bill check</span><span className={styles.manual}>Approval and payment are separate</span></div>

    <section className={styles.readiness} aria-labelledby="readiness-title"><div className={styles.sectionHeading}><div><div className={styles.eyebrow}>01 · THROUGHOUT THE MONTH</div><h2 id="readiness-title">Give every parcel a matching reference</h2><p>Record the details below on the day it leaves. Leave the charge blank when it is unknown.</p></div><label>Check dispatch month<input type="month" min="2026-11" value={month} onChange={e=>setMonth(e.target.value)}/></label></div>
      <div className={styles.required}><div><b>Date sent + courier</b><span>Professional, DTDC or DHL</span></div><div><b>Consignment / AWB number</b><span>Copy exactly from the booking receipt</span></div><div><b>Recipient + destination</b><span>Name, full address and city</span></div><div><b>Estate / person requesting</b><span>Who this parcel was sent on behalf of</span></div></div>
      <div className={styles.liveStrip}><b>Real register readiness</b>{loaded?<><span>{readiness.total} courier dispatches in {month}</span><strong>{readiness.ready} ready for matching</strong><span>{readiness.missingTracking} without AWB</span><span>{readiness.missingRecipientDetails} with incomplete recipient details</span><span>{readiness.missingSender} without sender reference</span></>:<span>{liveError||'Loading the existing register…'}</span>}</div>
      <p className={styles.help}>Attach the booking slip where available. Recipient phone, parcel contents, pieces and weight are useful for investigating differences. Hand deliveries do not belong on a courier bill.</p>
    </section>

    <section className={styles.workspace}><div className={styles.sectionHeading}><div><div className={styles.eyebrow}>02 · WHEN THE MONTHLY BILL ARRIVES</div><h2>Upload, match, resolve</h2><p>Choose a practice example, check a supplied September bill, or upload a complete invoice.</p></div><button className={styles.secondary} onClick={exportReport}><Download size={16}/> Export review</button></div>
      <div className={styles.sources} aria-label="Choose preview data">
        {[['practice-issues','November practice · issues'],['practice-clean','November practice · all matched'],['professional','Professional · actual sample'],['dtdc','DTDC · actual sample']].map(([key,label])=><button key={key} disabled={busy} aria-pressed={mode===key} className={mode===key?styles.selected:''} onClick={()=>chooseMode(key)}>{label}</button>)}
      </div>
      <div className={styles.bodyGrid}><aside className={styles.billPanel}>
        <button className={styles.upload} onClick={()=>fileInput.current?.click()} disabled={busy}><FileUp size={27}/><b>{busy?'Reading and checking…':'Upload monthly bill'}</b><span>PDF, JPG, PNG or WebP · up to 4 MB<br/>All pages of one invoice</span></button><input ref={fileInput} type="file" accept="application/pdf,image/png,image/jpeg,image/webp" hidden onChange={e=>{const file=e.target.files?.[0];if(file)void upload(file);}}/>
        {error&&<p className={styles.error} role="alert">{error}</p>}
        <p className={styles.sourceNote}>{bill.sourceLabel}</p>
        <div className={styles.billFields}>
          <label>Courier<select value={bill.courier} onChange={e=>changeBill('courier',e.target.value)}><option>Professional Courier</option><option>DTDC</option><option>DHL</option></select></label>
          <label>Currency<input value={bill.currency} maxLength={3} onChange={e=>changeBill('currency',e.target.value.toUpperCase())}/></label>
          <label>Invoice number<input value={bill.invoiceNumber} onChange={e=>changeBill('invoiceNumber',e.target.value)}/></label>
          <label>Invoice date<input type="date" value={bill.invoiceDate} onChange={e=>changeBill('invoiceDate',e.target.value)}/></label>
          <div className={styles.twoFields}><label>Period from<input type="date" value={bill.periodFrom} onChange={e=>changeBill('periodFrom',e.target.value)}/></label><label>Period to<input type="date" value={bill.periodTo} onChange={e=>changeBill('periodTo',e.target.value)}/></label></div>
          <label>Billed company / account<input value={bill.billedTo} onChange={e=>changeBill('billedTo',e.target.value)}/></label>
        </div>
        <h3>Invoice totals</h3><p className={styles.help}>Amounts as printed. GST and fuel stay separate from parcel freight. Do not assume a blank amount is zero.</p>
        <div className={styles.amounts}>{([['subtotal','Freight subtotal'],['fuel','Fuel surcharge'],['cgst','CGST'],['sgst','SGST'],['igst','IGST'],['other','Other charges'],['rounding','Rounding'],['total','Gross bill total']] as const).map(([key,label])=><label key={key}>{label}<input aria-label={label} type="number" step="0.01" min={key==='rounding'?undefined:0} value={bill[key]??''} onChange={e=>changeBill(key,e.target.value===''?null:Number(e.target.value))}/></label>)}</div>
        {originalUrl&&<a className={styles.sourceLink} href={originalUrl} target="_blank" rel="noopener noreferrer">Open uploaded original ↗</a>}
      </aside>
      <section ref={matchingSection} className={styles.results} aria-labelledby="matching-title">
        <div className={practice?styles.practiceBanner:styles.actualBanner}>{practice?'ILLUSTRATIVE PRACTICE DATA · NOT REAL NOVEMBER DISPATCHES':'REAL SAMPLE BILL + EXISTING REGISTER · ORIGINAL SEPTEMBER DATES'}</div>
        <div className={styles.metrics} aria-live="polite"><div><span>Bill lines</span><b>{result.rows.length}</b></div><div><span>Matched</span><b className={styles.green}>{result.matched}</b></div><div><span>Need checking</span><b className={styles.orange}>{result.unresolved}</b></div><div><span>Not on this bill</span><b>{result.unbilled.length}</b></div></div>
        <div className={styles.resultsHeading}><div><h3 id="matching-title">Match on courier and consignment</h3><p>Recipient names alone never create an automatic match.</p></div><label className={styles.toggle}><input type="checkbox" checked={onlyIssues} onChange={e=>setOnlyIssues(e.target.checked)}/> Only issues</label></div>
        <div className={styles.tableWrap}><table><thead><tr><th>Consignment / AWB</th><th>Sent</th><th>Destination</th><th>Freight ₹</th><th>Register match</th><th>Check result</th><th><span className={styles.srOnly}>Remove preview line</span></th></tr></thead><tbody>{visibleRows.map(row=><tr key={row.line.id}>
          <td><input aria-label={'Consignment '+row.line.id} value={row.line.tracking} onChange={e=>changeBill('lines',bill.lines.map(l=>l.id===row.line.id?{...l,tracking:e.target.value}:l))}/></td>
          <td><input aria-label={'Dispatch date '+row.line.id} type="date" value={row.line.sent} onChange={e=>changeBill('lines',bill.lines.map(l=>l.id===row.line.id?{...l,sent:e.target.value}:l))}/></td>
          <td><input aria-label={'Destination '+row.line.id} value={row.line.destination} onChange={e=>changeBill('lines',bill.lines.map(l=>l.id===row.line.id?{...l,destination:e.target.value}:l))}/></td>
          <td><input aria-label={'Freight '+row.line.id} type="number" min="0" step="0.01" value={row.line.amount??''} onChange={e=>changeBill('lines',bill.lines.map(l=>l.id===row.line.id?{...l,amount:e.target.value===''?null:Number(e.target.value)}:l))}/></td>
          <td>{row.shipment?<><strong>{row.shipment.recipientName}</strong><small>{row.shipment.onBehalfOf||'Sender reference not recorded'}</small></>:<span className={styles.muted}>No confirmed match</span>}</td>
          <td><span className={row.status==='matched'?styles.match:styles.issue}>{labels[row.status]}</span><small>{row.reason}</small></td>
          <td><button className={styles.remove} aria-label={'Remove preview line '+row.line.id} onClick={()=>changeBill('lines',bill.lines.filter(l=>l.id!==row.line.id))}>×</button></td>
        </tr>)}</tbody></table>{!visibleRows.length&&<p className={styles.empty}>No lines in this view.</p>}</div>
        <button className={styles.addLine} onClick={()=>changeBill('lines',[...bill.lines,{id:crypto.randomUUID(),tracking:'',sent:bill.periodFrom,destination:'',amount:null}])}>+ Add a missing bill line</button>
        {result.unbilled.length>0&&<details className={styles.notBilled}><summary>{result.unbilled.length} recorded dispatches not found on this bill</summary><p>These may be missing line items or late billing. Check the receipt or contact the courier before closing the month.</p>{result.unbilled.map(s=><div key={s.id}><b>{s.recipientName}</b><span>{s.sent} · {s.tracking||'AWB not recorded'} · {s.onBehalfOf||'Sender not recorded'}</span></div>)}</details>}
        <div className={styles.totalCheck}><div><span>Extracted freight</span><b>{money(result.lineSum)}</b></div><div><span>Printed freight subtotal</span><b>{money(bill.subtotal)}</b></div><div><span>Final invoice total</span><b>{money(bill.total)}</b></div></div>
        {(result.issues.length>0||bill.warnings.length>0)&&<div className={styles.checks}><h3><AlertCircle size={17}/> Check against the original</h3><ul>{[...result.issues,...bill.warnings].map((text,i)=><li key={i}>{text}</li>)}</ul></div>}
        <div className={styles.approval}><div><h3>{approved?'Ramesh approval preview complete':result.canApprove?'Ready for Ramesh to review':'Resolve exceptions before approval'}</h3><p>{approved?'This demonstration has not saved an approval, changed a shipment, or recorded a payment.':result.canApprove?'All listed parcels match and invoice totals balance. Approval does not mean paid.':'Correct extracted details, complete missing pages and investigate unmatched dispatches.'}</p></div><button disabled={!result.canApprove||approved||busy} onClick={()=>setApproved(true)}><CheckCircle2 size={17}/>{approved?'Preview approved':'Preview Ramesh’s approval'}</button></div>
        <div className={styles.payment}><b>03 · Record payment after it happens</b><p>Keep payment date, amount, method and bank/transaction reference against the approved bill. The system will not mark a bill paid just because Ramesh approves it.</p><span>Payment recording and saved approvals are the next build stage.</span></div>
      </section></div>
    </section>
    <footer className={styles.footer}>Preview only · Bill edits and approval stay in this page until reload · No shipment, bill, payment or accounting record is changed</footer>
  </main>;
}
