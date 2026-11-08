// Verified against Oct2026(1).png. The worksheet/preparation month differs
// from its explicit bill-month heading. Keep the saved reimbursement unique.
export function phoneBillSource(period: string) {
  return period === '2026-09' ? {
    worksheet: 'October 2026', prepared: '15 October 2026',
    originalTotal: 12908.34, billMonth: 'September', year: '2026',
  } : null;
}
