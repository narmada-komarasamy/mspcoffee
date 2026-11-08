import { NextResponse } from 'next/server';
import { allPhoneRows, phoneBillAuth } from '@/lib/phone-bills-server';
import { buildPaymentHistory, type HistoryFile, type HistoryStatement } from '@/lib/phone-bills';

export async function GET(request: Request) {
  const auth = await phoneBillAuth(request);
  if ('error' in auth) return auth.error;
  try {
    const statements: HistoryStatement[] = [];
    const files: HistoryFile[] = [];
    const [rows] = await Promise.all([
      allPhoneRows(auth.supabase),
      (async () => {
        for (let offset = 0; ; offset += 1000) {
          const result = await auth.supabase.from('phone_bill_statements').select('id,period,total,payment_date,payment_reference').order('period').range(offset, offset + 999);
          if (result.error) throw new Error('Unable to load saved payments.');
          statements.push(...(result.data || []));
          if ((result.data?.length || 0) < 1000) break;
        }
      })(),
      (async () => {
        for (let offset = 0; ; offset += 1000) {
          const result = await auth.supabase.from('phone_bill_statement_files').select('id,statement_id,file_name,created_at').order('created_at', { ascending: false }).order('id').range(offset, offset + 999);
          if (result.error) throw new Error('Unable to load saved scans.');
          files.push(...(result.data || []));
          if ((result.data?.length || 0) < 1000) break;
        }
      })(),
    ]);
    return NextResponse.json({ history: buildPaymentHistory(rows, statements, files) }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to load payment history.' }, { status: 503 });
  }
}
