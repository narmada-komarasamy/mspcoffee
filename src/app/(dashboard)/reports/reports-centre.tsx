'use client';
import { DateInput } from '@/components/ui/date-input';
import { formatDate as formatAppDate } from '@/lib/date-format';


import { useEffect, useRef, useState } from 'react';
import { Archive, BarChart2, CalendarClock, Download, FileText, Loader2, Plus, Search } from 'lucide-react';
import { REPORT_TYPES, REPORT_LABELS, REPORT_MODULES, MODULE_LABELS, REPORT_TITLES, financialYearLabel, indiaToday, lastCompletedPeriod, periodLabel, reportPeriod, type ReportType, type ReportModule } from '@/lib/reports';
import css from './reports.module.css';

type SavedReport = { id:string; reference:string; title:string; report_type:ReportType; period_start:string; period_end:string; financial_year:number; modules:ReportModule[]; page_count:number; created_at:string };
export default function ReportsCentre() {
  const [tab,setTab]=useState<'archive'|'create'|'delivery'>('archive');
  const [type,setType]=useState<ReportType>('weekly');
  const [anchor,setAnchor]=useState(()=>lastCompletedPeriod('weekly').end);
  const [title,setTitle]=useState(REPORT_TITLES.weekly);
  const [modules,setModules]=useState<ReportModule[]>([...REPORT_MODULES]);
  const [detail,setDetail]=useState(false);
  const [filterType,setFilterType]=useState('');
  const [year,setYear]=useState('');
  const [search,setSearch]=useState('');
  const [submittedSearch,setSubmittedSearch]=useState('');
  const [page,setPage]=useState(0);
  const [reports,setReports]=useState<SavedReport[]>([]);
  const [total,setTotal]=useState(0);
  const [canCreate,setCanCreate]=useState(false);
  const [loading,setLoading]=useState(true);
  const [loadError,setLoadError]=useState('');
  const [message,setMessage]=useState('');
  const [error,setError]=useState('');
  const [busy,setBusy]=useState('');
  const [revision,setRevision]=useState(0);
  const [preview,setPreview]=useState<{url:string;name:string}|null>(null);
  const dialog=useRef<HTMLDialogElement>(null);
  const period=reportPeriod(type,anchor);
  const currentFY=reportPeriod('yearly',indiaToday()).financialYear;
  const years=Array.from({length:currentFY-2019},(_,i)=>currentFY-i);
  useEffect(()=>{
    const controller=new AbortController();
    const params=new URLSearchParams({type:filterType,year,q:submittedSearch,page:String(page)});
    fetch(`/api/reports?${params}`,{cache:'no-store',signal:controller.signal}).then(async response=>{
      const body=await response.json();
      if(!response.ok)throw new Error(body.error||'Unable to load reports.');
      setReports(body.reports);setTotal(body.total);setCanCreate(body.canCreate);setLoadError('');setLoading(false);
    }).catch(error=>{if(!controller.signal.aborted){setLoadError(error.message);setLoading(false);}});
    return ()=>controller.abort();
  },[filterType,year,submittedSearch,page,revision]);
  useEffect(()=>{
    if(preview)dialog.current?.showModal();else dialog.current?.close();
    return ()=>{if(preview?.url.startsWith('blob:'))URL.revokeObjectURL(preview.url);};
  },[preview]);
  function changeType(value:ReportType){setType(value);setAnchor(lastCompletedPeriod(value).end);setTitle(REPORT_TITLES[value]);setDetail(false);setError('');}
  async function generate(save:boolean){
    setBusy(save?'Saving PDF…':'Preparing preview…');setError('');setMessage('');
    try{
      const response=await fetch(save?'/api/reports':'/api/reports/preview',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({type,anchor,title,modules,detail})});
      if(!response.ok){const body=await response.json();throw new Error(body.error||'Unable to prepare the report.');}
      if(save){const body=await response.json();setMessage(`Archived ${body.report.reference}. The PDF is ready to view or print.`);setPage(0);setFilterType('');setYear('');setSubmittedSearch('');setSearch('');setRevision(r=>r+1);setTab('archive');}
      else setPreview({url:URL.createObjectURL(await response.blob()),name:`MSP_${type}_${period.end}.pdf`});
    }catch(error){setError(error instanceof Error?error.message:'Unable to prepare report.');}
    finally{setBusy('');}
  }
  return <div className={css.root}>
    <header className={css.header}><div><div className={css.eyebrow}>MSP Coffee · Report library</div><h1>Reports</h1><p>Activity highlights, branded PDFs and a permanent record of every issued version.</p></div><button className={css.primary} onClick={()=>setTab('create')}><Plus size={17}/>Create a report</button></header>
    <div className={css.standards}><span><FileText size={16}/>A4 PDFs · One page by default</span><span><Archive size={16}/>Old versions retained</span><span><CalendarClock size={16}/>April–March financial year</span></div>
    <nav className={css.tabs} aria-label="Report sections">{([['archive','Report archive',Archive],['create','Create a report',BarChart2],['delivery','Delivery settings',CalendarClock]] as const).map(([id,label,Icon])=><button key={id} aria-current={tab===id?'page':undefined} className={tab===id?css.activeTab:undefined} onClick={()=>setTab(id)}><Icon size={16}/>{label}</button>)}</nav>
    {message&&<p className={css.success} role="status">{message}</p>}{error&&<p className={css.error} role="alert">{error}</p>}
    {tab==='archive'&&<section className={css.panel} aria-labelledby="archive-title"><div className={css.panelHead}><div><h2 id="archive-title">Find a past report</h2><p>Filter by financial year and report frequency, or search the title or reference.</p></div><span className={css.badge}>{total} saved {total===1?'report':'reports'}</span></div>
      <form className={css.filters} onSubmit={e=>{e.preventDefault();setPage(0);setSubmittedSearch(search);}}>
        <label>Frequency<select value={filterType} onChange={e=>{setPage(0);setFilterType(e.target.value);}}><option value="">All frequencies</option>{REPORT_TYPES.map(t=><option key={t} value={t}>{REPORT_LABELS[t]}</option>)}</select></label>
        <label>Financial year<select value={year} onChange={e=>{setPage(0);setYear(e.target.value);}}><option value="">All years</option>{years.map(y=><option key={y} value={y}>{financialYearLabel(y)}</option>)}</select></label>
        <label className={css.search}>Search<input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Report name or reference" maxLength={80}/></label><button className={css.secondary}><Search size={16}/>Search</button>
      </form>
      {loading?<p className={css.empty} role="status">Loading the archive…</p>:loadError?<div className={css.error} role="alert">{loadError} <button className={css.secondary} onClick={()=>setRevision(r=>r+1)}>Retry</button></div>:!reports.length?<div className={css.empty}><Archive size={32}/><h3>{total?'No reports on this page':'No reports match these filters yet'}</h3><p>Preview a completed period, then save its PDF to start your archive.</p><button className={css.primary} onClick={()=>setTab('create')}>Create a report</button></div>:<div className={css.tableWrap}><table><thead><tr><th>Report</th><th>Reporting period</th><th>Frequency / year</th><th>Saved</th><th>PDF</th></tr></thead><tbody>{reports.map(report=><tr key={report.id}><td><b>{report.title}</b><small>{report.reference}</small></td><td>{periodLabel({start:report.period_start,end:report.period_end})}</td><td>{REPORT_LABELS[report.report_type]}<small>{financialYearLabel(report.financial_year)}</small></td><td>{formatAppDate(new Date(report.created_at))}<small>{report.page_count} {report.page_count===1?'page':'pages'}</small></td><td><a className={css.secondary} href={`/api/reports/pdf?id=${report.id}`} target="_blank" rel="noopener noreferrer">View / print</a><a className={css.download} href={`/api/reports/pdf?id=${report.id}&download=1`} aria-label={`Download ${report.title}`}><Download size={16}/></a></td></tr>)}</tbody></table></div>}
      {total>25&&<div className={css.pagination}><button className={css.secondary} disabled={!page} onClick={()=>setPage(p=>p-1)}>Previous</button><span>Page {page+1} of {Math.ceil(total/25)}</span><button className={css.secondary} disabled={(page+1)*25>=total} onClick={()=>setPage(p=>p+1)}>Next</button></div>}
      <p className={css.note}>Each saved PDF is retained exactly as generated. If figures are corrected later, create a new version; earlier reports stay available.</p>
    </section>}
    {tab==='create'&&<section className={css.panel} aria-labelledby="create-title"><h2 id="create-title">Create an activity report</h2><p className={css.muted}>Start with a completed period. Choose the app sections to include in your one-page overview.</p><div className={css.builder}>
      <label>Report frequency<select value={type} onChange={e=>changeType(e.target.value as ReportType)}>{REPORT_TYPES.map(t=><option key={t} value={t}>{REPORT_LABELS[t]}</option>)}</select></label>
      <label>Choose any date within the period<DateInput type="date" value={anchor} max={indiaToday()} required onChange={e=>{if(e.target.value)setAnchor(e.target.value);}}/></label>
      <label className={css.full}>Report title<input value={title} maxLength={120} onChange={e=>setTitle(e.target.value)}/></label>
    </div><div className={css.period}><CalendarClock size={21}/><div><b>{periodLabel(period)}</b><small>{financialYearLabel(period.financialYear)} · {detail?'Two-page extended report':'One-page A4 report'}</small></div></div>
      <fieldset className={css.modules}><legend>Report sections</legend>{REPORT_MODULES.map(module=><label key={module}><input type="checkbox" checked={modules.includes(module)} onChange={e=>setModules(current=>e.target.checked?[...current,module]:current.filter(m=>m!==module))}/>{MODULE_LABELS[module]}</label>)}</fieldset>
      {['quarterly','half_yearly'].includes(type)&&<label className={css.detail}><input type="checkbox" checked={detail} onChange={e=>setDetail(e.target.checked)}/>Add an exceptional second page with monthly figures and rainfall coverage</label>}
      {period.end>=indiaToday()&&<p className={css.warning}>This period is still open. You can preview it, but a final PDF can be archived after the period ends.</p>}
      <div className={css.actions}><button className={css.secondary} disabled={!!busy||!modules.length} onClick={()=>generate(false)}><FileText size={16}/>Preview PDF</button><button className={css.primary} disabled={!!busy||!modules.length||!canCreate||period.end>=indiaToday()} onClick={()=>generate(true)}>{busy?<Loader2 size={16} className={css.spin}/>:<Archive size={16}/>}Generate &amp; archive PDF</button>{busy&&<span role="status">{busy}</span>}</div>
      {!canCreate&&<p className={css.note}>Creating archived reports requires report write access. You can still preview a reporting period.</p>}
      <p className={css.note}>Includes all logged vehicles. Fuel filled, HO stock purchases and HO fuel issued are reported separately. Missing records are shown as missing entries.</p>
    </section>}
    {tab==='delivery'&&<section className={css.panel}><div className={css.panelHead}><div><h2>Delivery settings</h2><p>The archive is ready for future scheduled reports.</p></div><span className={css.badge}>Automatic emailing inactive</span></div><div className={css.schedule}><CalendarClock size={30}/><div><h3>MSP Last Week at a Glance</h3><p>Every Monday · 9:30 a.m. IST<br/>Covers the previous Monday–Sunday · All vehicles</p><b>Recipient list pending</b><p className={css.muted}>No automatic emails are being sent. Recipients and sending can be enabled after you provide the list.</p></div></div><h3>Suggested reporting calendar</h3><div className={css.calendar}>{REPORT_TYPES.map(t=><div key={t}><b>{REPORT_LABELS[t]}</b><span>{{daily:'Previous day',weekly:'Previous Monday–Sunday',monthly:'Previous calendar month',quarterly:'Apr–Jun · Jul–Sep · Oct–Dec · Jan–Mar',half_yearly:'Apr–Sep · Oct–Mar',yearly:'April–March'}[t]}</span></div>)}</div><p className={css.note}>Daily, monthly, quarterly, half-yearly and yearly delivery times remain to be agreed.</p></section>}
    <dialog ref={dialog} className={css.dialog} onCancel={()=>setPreview(null)} aria-labelledby="pdf-preview-title"><div className={css.dialogHead}><h2 id="pdf-preview-title">Report preview</h2><div>{preview&&<a className={css.secondary} href={preview.url} download={preview.name}>Download PDF</a>}<button className={css.secondary} onClick={()=>setPreview(null)}>Close</button></div></div>{preview&&<iframe title="MSP branded report PDF" src={preview.url}/>}</dialog>
  </div>;
}
