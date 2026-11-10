import { PDFDocument, StandardFonts, rgb, type PDFFont } from 'pdf-lib';
import { BILL_MONTHS, billPayee, historicallyPaid, payeeTotals, transferTotals, totalBills, type PhoneBillRow, type PhoneStatement } from './phone-bills';
import { phoneBillSource } from './phone-bill-sources';

const safe = (value: string) => value.replace(/₹/g, 'Rs ').replace(/[–—]/g, '-').replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[^\x20-\x7e\xa0-\xff]/g, ' ');
const money = (value: number) => `Rs ${value.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function wrap(value: string, width: number, font: PDFFont, size: number) {
  const lines: string[] = []; let line = '';
  for (const word of safe(value).split(/\s+/)) {
    if (font.widthOfTextAtSize(`${line} ${word}`.trim(), size) <= width) { line = `${line} ${word}`.trim(); continue; }
    if (line) lines.push(line);
    line = '';
    for (const char of word) {
      if (font.widthOfTextAtSize(line + char, size) > width) { lines.push(line); line = ''; }
      line += char;
    }
  }
  if (line) lines.push(line);
  return lines.length ? lines : [''];
}

export async function phoneStatementPdf(rows: PhoneBillRow[], period: string, logo: Uint8Array, statement?: PhoneStatement | null) {
  if (!rows.length || rows.some(r => r.amount === null)) throw new Error('Complete all bill amounts before preparing the PDF.');
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const page = doc.addPage([595.28, 841.89]);
  const green = rgb(.15, .34, .19), ink = rgb(.15, .20, .16), muted = rgb(.43, .43, .38), border = rgb(.85, .82, .74);
  const text = (value: string, x: number, y: number, size = 8, strong = false, color = ink) => page.drawText(safe(value), { x, y, size, font: strong ? bold : font, color });
  const line = (x: number, y: number, width: number) => page.drawLine({ start: { x, y }, end: { x: x + width, y }, thickness: .5, color: border });
  page.drawRectangle({ x: 0, y: 0, width: 595.28, height: 841.89, color: rgb(1, .992, .969) });
  page.drawRectangle({ x: 28, y: 810, width: 539, height: 5, color: green });
  const image = await doc.embedPng(logo);
  const dimensions = image.scaleToFit(48, 48);
  page.drawImage(image, { x: 30, y: 750, width: dimensions.width, height: dimensions.height });
  text('MSP COFFEE P LTD. | MOGANAD & STANMORE ESTATES', 90, 791, 8, true, muted);
  text('Phone & Internet Reimbursement', 90, 768, 19, true, green);
  const title = `${BILL_MONTHS[Number(period.slice(5)) - 1]} ${period.slice(0, 4)}`;
  text(`Bill month: ${title}`, 90, 750, 11, true);
  line(28, 739, 539);
  const reference = statement?.reference || `MSP-PH-${period.replace('-', '')}`;
  text(`Statement: ${reference}`, 30, 725, 8, true);
  text(statement ? 'Saved monthly statement' : 'DRAFT - review before saving', 390, 725, 8, false, muted);
  const source = phoneBillSource(period);
  text(source ? `${rows.length} accounts | INR | Worksheet: ${source.worksheet} | Prepared ${source.prepared}` : `Consolidated monthly reimbursement | ${rows.length} accounts | Amounts in INR`, 30, 709, 8, false, muted);

  const widths = [20, 65, 110, 65, 118, 68, 93];
  const ordered = [...rows].sort((a, b) => a.billType.localeCompare(b.billType) || a.location.localeCompare(b.location));
  const cells = ordered.map((r, i) => [String(i + 1), r.billType, r.location, r.user, [r.phone, r.accountNo].filter(Boolean).join(' / '), billPayee(r), money(r.amount!)]);
  const transfers = transferTotals(rows);
  const detailBudget = 440 - transfers.length * 17;
  let size = 7.3;
  let wrapped = cells.map(row => row.map((v, i) => wrap(v, widths[i] - 9, font, size)));
  const height = () => wrapped.reduce((sum, row) => sum + Math.max(16, Math.max(...row.map(c => c.length)) * (size + 1) + 5), 0);
  while (height() > detailBudget && size > 6.1) {
    size = Math.max(6.1, size - .2);
    wrapped = cells.map(row => row.map((v, i) => wrap(v, widths[i] - 9, font, size)));
  }
  if (height() > detailBudget) throw new Error('This month has too many details for a readable one-page statement.');
  let y = 695;
  page.drawRectangle({ x: 28, y: y - 22, width: 539, height: 22, color: rgb(.91, .93, .86) });
  let x = 28;
  ['No.', 'Service', 'Estate / location', 'User', 'Phone / account', 'Reimburse to', 'Amount'].forEach((heading, i) => { text(heading, x + 4, y - 14, 7, true, green); x += widths[i]; });
  y -= 22;
  wrapped.forEach((row, index) => {
    const rowHeight = Math.max(16, Math.max(...row.map(c => c.length)) * (size + 1) + 5);
    if (index % 2 === 0) page.drawRectangle({ x: 28, y: y - rowHeight, width: 539, height: rowHeight, color: rgb(.97, .96, .92) });
    let x = 28;
    row.forEach((cell, i) => {
      cell.forEach((value, j) => text(value, i === 6 ? x + widths[i] - 5 - font.widthOfTextAtSize(value, size) : x + 4, y - size - 3 - j * (size + 1), size));
      x += widths[i];
    });
    y -= rowHeight; line(28, y, 539);
  });
  const total = statement ? Number(statement.total) : totalBills(rows);
  page.drawRectangle({ x: 28, y: y - 25, width: 539, height: 25, color: rgb(.91, .93, .86) });
  text('TOTAL REIMBURSEMENT', 34, y - 17, 9, true, green);
  const totalText = money(total);
  text(totalText, 561 - bold.widthOfTextAtSize(totalText, 11), y - 17, 11, true, green);
  y -= 39;
  text('TO BE TRANSFERRED - PAYMENT BREAKUP', 33, y, 8, true, green);
  y -= 7;
  page.drawRectangle({ x: 28, y: y - 18, width: 539, height: 18, color: rgb(.91, .93, .86) });
  text('Paying account / estate', 34, y - 12, 7, true, green);
  text('Pay to', 300, y - 12, 7, true, green);
  text('Amount (INR)', 482, y - 12, 7, true, green);
  y -= 18;
  for (const transfer of transfers) {
    const names: Record<string, string> = { ME: 'Moganad Estate', SE: 'Stanmore Estate', MSPCC: 'MSP Coffee' };
    text(`${transfer.account} - ${names[transfer.account]}`, 34, y - 12, 8);
    text(transfer.payee, 300, y - 12, 8);
    const amount = money(transfer.total);
    text(amount, 561 - bold.widthOfTextAtSize(amount, 8), y - 12, 8, true, green);
    y -= 17; line(28, y, 539);
  }
  y -= 14;
  payeeTotals(rows).forEach((p, i) => { text(`Total to ${p.payee}: ${money(p.total)}`, 33 + i * 270, y, 8, true, green); });
  y -= 20;
  const payment = statement?.payment_date ? `Payment: ${statement.payment_date} | Reference: ${statement.payment_reference || ''}` : historicallyPaid(period) ? 'Paid - historical. Confirmed through February 2026; date and voucher not recorded.' : 'Payment date: ____________________     Reference / voucher: ____________________';
  const paymentLines = wrap(payment, 525, font, 8);
  paymentLines.forEach((value, i) => text(value, 33, y - i * 11, 8));
  y -= paymentLines.length * 11 + 36;
  if (y < 48) throw new Error('Statement details do not fit on one A4 page.');
  [['Ashok Rajes', 'Prepared by'], ['Ponraj', 'Checked by · Cashier'], ['Chandrashekaran', 'Approved by · Manager'], ['Ashok Rajes', 'Payment received by']].forEach(([name, role], i) => {
    const x = 33 + i * 136;
    line(x, y, 123); text(name, x, y - 13, 8, true); text(role, x, y - 26, 7.2, false, muted); text('Date: __________________', x, y - 39, 7, false, muted);
  });
  line(28, 27, 539);
  text(`${reference} | ${title} | Retain signed copy with this monthly statement`, 30, 15, 7, false, muted);
  text('1 / 1', 546, 15, 7, false, muted);
  doc.setTitle(`MSP Coffee - Phone & Internet Reimbursement - ${title}`);
  return Buffer.from(await doc.save());
}
