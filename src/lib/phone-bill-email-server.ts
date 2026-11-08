import 'server-only';
import { readFile } from 'node:fs/promises';
import type { SupabaseClient } from '@supabase/supabase-js';
import { allPhoneRows, basePhoneRows } from './phone-bills-server';
import { billKey, billPeriod, validPeriod, type PhoneStatement } from './phone-bills';
import { phoneBillEmail } from './phone-bill-email';
import { phoneStatementPdf } from './phone-statement-pdf';
import type { EmailPayload } from './email/payload';

export async function monthlyPhoneDocument(supabase: SupabaseClient, period: string, actor?: string) {
  if (!validPeriod(period)) throw new Error('Select a valid month and year.');
  const read = () => supabase.from('phone_bill_statements').select('*').eq('period', period).maybeSingle();
  const existing = await read();
  if (existing.error) throw new Error('Unable to load the saved monthly statement.');
  let statement = existing.data as PhoneStatement | null;
  if (!statement && actor) {
    const base = (await basePhoneRows()).filter(r => billPeriod(r) === period).map(r => ({ ...r, entryKey: billKey(r) }));
    const issued = await supabase.rpc('issue_phone_bill_statement', { bill_period: period, base_rows: base, actor });
    if (issued.error?.code === '23505') {
      const concurrent = await read();
      if (concurrent.error || !concurrent.data) throw new Error('Unable to open the saved statement. Please refresh.');
      statement = concurrent.data as PhoneStatement;
    } else if (issued.error) {
      throw new Error('Complete all amounts and review duplicate accounts before emailing the statement.');
    } else statement = issued.data as PhoneStatement;
  }
  const rows = statement?.rows || (await allPhoneRows(supabase)).filter(r => billPeriod(r) === period);
  const logo = await readFile(`${process.cwd()}/public/msp-logo.png`);
  return { statement, rows, pdf: await phoneStatementPdf(rows, period, logo, statement) };
}

export async function preparePhoneBillEmail(supabase: SupabaseClient, input: EmailPayload, actor: string) {
  const period = input.phoneBillPeriod || '';
  const document = await monthlyPhoneDocument(supabase, period, actor);
  const first = document.rows[0];
  const canonical = phoneBillEmail(document.rows, first.month, first.year, 'Complete saved monthly statement; all accounts included.');
  const payload: EmailPayload = { ...canonical, recipients: input.recipients, cc: input.cc, note: input.note, data: { summary: canonical.data.summary } };
  return { payload, attachmentContent: document.pdf, attachmentContentType: 'application/pdf' };
}
