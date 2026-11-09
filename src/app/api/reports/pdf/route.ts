import { NextResponse } from 'next/server';
import { UUID_RE } from '@/lib/auth/api';
import { reportsAuth, REPORT_BUCKET, pdfHash } from '@/lib/reports-server';

export async function GET(request: Request) {
  const auth=await reportsAuth(request);
  if('error' in auth)return auth.error;
  const params=new URL(request.url).searchParams,id=params.get('id')||'';
  if(!UUID_RE.test(id))return NextResponse.json({error:'Invalid report.'},{status:400});
  const record=await auth.supabase.from('report_snapshots').select('pdf_path,pdf_sha256,reference').eq('id',id).maybeSingle();
  if(record.error)return NextResponse.json({error:'Unable to open the report archive.'},{status:503});
  if(!record.data)return NextResponse.json({error:'Report not found.'},{status:404});
  const file=await auth.supabase.storage.from(REPORT_BUCKET).download(record.data.pdf_path);
  if(file.error||!file.data)return NextResponse.json({error:'The archived PDF could not be opened. Please try again.'},{status:503});
  const bytes=new Uint8Array(await file.data.arrayBuffer());
  if(pdfHash(bytes)!==record.data.pdf_sha256)return NextResponse.json({error:'The archived file could not be verified. Contact your administrator.'},{status:500});
  return new Response(bytes,{headers:{'Content-Type':'application/pdf','Content-Disposition':`${params.get('download')==='1'?'attachment':'inline'}; filename="${record.data.reference}.pdf"`,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
}
