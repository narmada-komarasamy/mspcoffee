import { NextResponse } from 'next/server';
import { buildReportSnapshot, pdfHash, REPORT_BUCKET, reportsAuth } from '@/lib/reports-server';
import { renderReportPdf } from '@/lib/reports-pdf';
import { cleanReportConfig, indiaToday, reportPeriod, REPORT_TYPES } from '@/lib/reports';

const columns = 'id,reference,title,report_type,period_start,period_end,financial_year,modules,page_count,created_at';
export async function GET(request: Request) {
  const auth = await reportsAuth(request);
  if ('error' in auth) return auth.error;
  const params = new URL(request.url).searchParams;
  const page = Math.max(0, Math.min(10000, Number.parseInt(params.get('page') || '0',10) || 0));
  const type = params.get('type'), year = params.get('year');
  let query = auth.supabase.from('report_snapshots').select(columns,{count:'exact'});
  if(type && REPORT_TYPES.includes(type as typeof REPORT_TYPES[number]))query=query.eq('report_type',type);
  if(year && /^20\d{2}$/.test(year))query=query.eq('financial_year',Number(year));
  const search = (params.get('q')||'').replace(/[^a-zA-Z0-9 -]/g,'').trim().slice(0,80);
  if(search)query=query.or(`title.ilike.%${search}%,reference.ilike.%${search}%`);
  const result = await query.order('period_end',{ascending:false}).order('created_at',{ascending:false}).order('id').range(page*25,page*25+24);
  if(result.error)return NextResponse.json({error:'The report archive could not be loaded. Please try again.'},{status:503});
  return NextResponse.json({reports:result.data||[],total:result.count||0,canCreate:auth.canCreate},{headers:{'Cache-Control':'private, no-store'}});
}
export async function POST(request: Request) {
  const auth = await reportsAuth(request,true);
  if ('error' in auth) return auth.error;
  const input = await request.json().catch(()=>null);
  let config;
  try {
    config=cleanReportConfig(input);
    if(reportPeriod(config.type,config.anchor).end>=indiaToday())throw new Error('Archive completed periods only. You can preview an open period.');
  } catch(error){return NextResponse.json({error:error instanceof Error?error.message:'Invalid report settings.'},{status:400});}
  try {
    const snapshot=await buildReportSnapshot(auth.supabase,config), pdf=await renderReportPdf(snapshot);
    const id=crypto.randomUUID(), path=`${snapshot.period.financialYear}/${id}.pdf`;
    const upload=await auth.supabase.storage.from(REPORT_BUCKET).upload(path,pdf.bytes,{contentType:'application/pdf',upsert:false});
    if(upload.error)throw new Error('The PDF could not be saved. Please try again.');
    const saved=await auth.supabase.from('report_snapshots').insert({id,reference:snapshot.reference,title:config.title,report_type:config.type,period_start:snapshot.period.start,period_end:snapshot.period.end,financial_year:snapshot.period.financialYear,modules:config.modules,snapshot,pdf_path:path,pdf_sha256:pdfHash(pdf.bytes),page_count:pdf.pages,created_at:snapshot.generatedAt,created_by:auth.user.id}).select(columns).single();
    if(saved.error){await auth.supabase.storage.from(REPORT_BUCKET).remove([path]);throw new Error('The report could not be archived. Please try again.');}
    return NextResponse.json({report:saved.data},{status:201});
  }catch(error){return NextResponse.json({error:error instanceof Error?error.message:'Unable to save the report.'},{status:503});}
}
