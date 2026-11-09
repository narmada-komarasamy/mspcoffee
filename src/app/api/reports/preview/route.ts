import { NextResponse } from 'next/server';
import { reportsAuth, buildReportSnapshot } from '@/lib/reports-server';
import { renderReportPdf } from '@/lib/reports-pdf';

export async function POST(request: Request) {
  const auth = await reportsAuth(request);
  if('error' in auth)return auth.error;
  try {
    const snapshot=await buildReportSnapshot(auth.supabase,await request.json());
    const pdf=await renderReportPdf(snapshot);
    return new Response(new Uint8Array(pdf.bytes),{headers:{'Content-Type':'application/pdf','Content-Disposition':`inline; filename="${snapshot.reference}.pdf"`,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
  }catch(error){return NextResponse.json({error:error instanceof Error?error.message:'Unable to preview report.'},{status:400});}
}
