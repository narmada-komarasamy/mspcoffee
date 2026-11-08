import { BILL_MONTHS, billMoney, billPayee, payeeTotals, totalBills, type PhoneBillRow } from './phone-bills';
import type { EmailPayload } from './email/payload';

export function phoneBillEmail(rows: PhoneBillRow[], month: string, year: string, filters: string): EmailPayload {
  if (!BILL_MONTHS.includes(month) || !/^20\d{2}$/.test(year) || !rows.length || rows.some(r => r.month !== month || r.year !== year)) {
    throw new Error('Select one month and year with matching bill entries before emailing.');
  }
  return {
    type: 'email_report', recipients: [],
    subject: `MSP Coffee · Phone & Internet Reimbursement · ${month} ${year}`,
    reportTitle: `Phone & Internet Reimbursement — ${month} ${year}`,
    sourcePath: '/ho-fuel/recurring-bills/phone-bills',
    attachmentName: `MSP_Phone_Bills_${year}_${String(BILL_MONTHS.indexOf(month) + 1).padStart(2, '0')}.html`,
    data: {
      summary: [
        { label: 'Bill month', value: `${month} ${year}` },
        { label: 'Accounts included', value: String(rows.length) },
        { label: 'Total reimbursement', value: billMoney(totalBills(rows)), detail: rows.some(r => r.amount === null) ? 'Incomplete: some bill amounts are awaiting confirmation.' : undefined },
        ...payeeTotals(rows).map(p => ({ label: `Reimburse ${p.payee}`, value: billMoney(p.total) })),
        { label: 'Register filters', value: filters || 'All accounts for the selected month' },
      ],
      sections: [{
        title: 'Included bill entries',
        rows: rows.map(r => ({
          label: `${r.user} · ${r.phone || r.accountNo}`,
          value: r.amount === null ? 'Awaiting amount' : billMoney(r.amount),
          detail: `${r.billType} · ${r.location} · Account: ${r.accountNo || '—'} · Reimburse ${billPayee(r)}${r.dueDate ? ` · Due: ${r.dueDate}` : ''}${r.remarks ? ` · ${r.remarks}` : ''}`,
        })),
      }],
    },
  };
}
