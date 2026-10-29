export type PaymentStatus = 'Paid' | 'Pending' | 'Partial';
export type PaymentMode = 'Cash' | 'UPI' | 'Bank' | 'Cheque' | 'Other';
export const SALE_TYPES = ['Charged Sale', 'Complementary', 'Replacement', 'MSP Coffee Processing', 'Bungalow Consumption'];
export type SaleType = 'Charged Sale' | 'Complementary' | 'Replacement' | 'MSP Coffee Processing' | 'Bungalow Consumption';
export function isInternalUse(saleType: string) {
  return saleType === 'MSP Coffee Processing' || saleType === 'Bungalow Consumption';
}

export type StockBatch = {
  id: string;
  date: string;
  estate: string;
  product: string;
  unit: string;
  receivedPieces: number;
  receivedWeightKg: number;
  soldPieces: number;
  soldWeightKg: number;
  itemCode?: string;
  status?: string;
  conditionGrade?: string;
  storageLocation?: string;
};

export type SaleRecord = {
  id: string;
  date: string;
  buyerName: string;
  buyerPhone: string;
  buyerEmail: string;
  buyerAddress: string;
  recipientName?: string;
  dispatchMethod: string;
  batchId: string;
  itemCode: string;
  isDraft?: boolean;
  estate: string;
  product: string;
  piecesSold: number;
  weightSoldKg: number;
  ratePerKg: number;
  produceAmount: number;
  courierPacking: number;
  totalAmount: number;
  saleType: SaleType;
  paymentStatus: PaymentStatus;
  paymentMode: PaymentMode;
  paymentNotes: string;
  notes: string;
  closedAt?: string;
};

export type DraftSale = {
  date: string;
  buyerName: string;
  buyerPhone: string;
  buyerEmail: string;
  buyerAddress: string;
  recipientName: string;
  dispatchMethod: string;
  batchId: string;
  piecesSold: string;
  weightSoldKg: string;
  ratePerKg: string;
  courierPacking: string;
  saleType: SaleType;
  paymentStatus: PaymentStatus;
  paymentMode: PaymentMode;
  paymentNotes: string;
  notes: string;
};

export type CustomerRecord = {
  id: string;
  phone: string;
  email: string;
  name: string;
  address: string;
  defaultDispatchMethod: string;
  defaultPaymentMode: PaymentMode | '';
  lastSaleAt: string;
};

export type EmailDraft = {
  saleId: string;
  to: string;
  subject: string;
  attachment: string;
  body: string;
};

export function validBuyerEmail(value: string) {
  const email = value.trim();
  return !email || (email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email));
}

export function applyCustomerPhone(draft: DraftSale, customers: CustomerRecord[], previousPhone: string): DraftSale {
  const phoneKey = (phone: string) => phone.replace(/[^\d+]/g, '');
  const match = customers.find(customer => phoneKey(customer.phone) === phoneKey(draft.buyerPhone));
  const previous = customers.find(customer => phoneKey(customer.phone) === phoneKey(previousPhone));
  if (!match) return { ...draft, buyerEmail: previous ? '' : draft.buyerEmail };
  return {
    ...draft,
    buyerName: match.name,
    buyerEmail: match.email || '',
    buyerAddress: match.address || '',
    dispatchMethod: match.defaultDispatchMethod || draft.dispatchMethod,
    paymentMode: match.defaultPaymentMode || draft.paymentMode,
  };
}

export function buildDraftSale(draft: DraftSale, batch: StockBatch | null): SaleRecord | null {
  if (!batch) return null;
  const weightSoldKg = num(draft.weightSoldKg);
  const ratePerKg = draft.saleType === 'Charged Sale' ? num(draft.ratePerKg) : 0;
  const produceAmount = weightSoldKg * ratePerKg;
  const internal = isInternalUse(draft.saleType);
  const courierPacking = internal ? 0 : num(draft.courierPacking);
  return {
    ...draft,
    id: `draft-${batch.id}`,
    isDraft: true,
    buyerEmail: draft.buyerEmail.trim(),
    ...(internal ? { buyerName: draft.recipientName, buyerEmail: '', buyerPhone: '', buyerAddress: '', dispatchMethod: 'Internal use' } : {}),
    itemCode: batch.itemCode || '',
    estate: batch.estate,
    product: batch.product,
    piecesSold: num(draft.piecesSold),
    weightSoldKg,
    ratePerKg,
    produceAmount,
    courierPacking,
    totalAmount: produceAmount + courierPacking,
    paymentStatus: draft.saleType === 'Charged Sale' ? draft.paymentStatus : 'Paid',
  };
}

export function buildEmailDraft(sale: SaleRecord): EmailDraft | null {
  if (isInternalUse(sale.saleType)) return null;
  const no = invoiceNumber(sale);
  return {
    saleId: sale.id,
    to: sale.buyerEmail || '',
    subject: `${sale.isDraft ? 'Draft invoice' : `${no} Bill`} from MSP Coffee Private Limited`,
    attachment: sale.isDraft ? '' : `${no.toLowerCase()}-bill.html`,
    body: `Dear ${sale.buyerName || 'Customer'},\n\n${sale.isDraft ? 'Please review the draft bill details below.' : `Please find attached the bill for ${sale.product}.`}\n\nBill No: ${no}\nSale Date: ${dateLabel(sale.date)}\nProduce Token: ${sale.itemCode || 'Not recorded'}\nProduct: ${sale.product}\nEstate: ${sale.estate}\nPieces: ${sale.piecesSold}\nWeight: ${kg(sale.weightSoldKg)} kg\nRate per kg: ${sale.saleType === 'Charged Sale' ? money(sale.ratePerKg) : 'No charge'}\nProduce Amount: ${money(sale.produceAmount)}\nCourier/Packing: ${money(sale.courierPacking)}\nTotal: ${money(sale.totalAmount)}\nSale Type: ${sale.saleType}\nPayment Status: ${sale.paymentStatus}\n\nBuyer: ${sale.buyerName || 'Customer'}\nPhone: ${sale.buyerPhone || '-'}\nEmail: ${sale.buyerEmail || '-'}\nAddress: ${sale.buyerAddress || '-'}\nDispatch: ${sale.dispatchMethod}\n\nRegards,\nMSP Coffee Private Limited`,
  };
}


export function currentDateValue() {
  const now = new Date();
  return [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
  ].join('-');
}

export function blankDraft(batchId = ''): DraftSale {
  return {
    date: currentDateValue(),
    buyerName: '',
    buyerPhone: '',
    buyerEmail: '',
    buyerAddress: '',
    recipientName: '',
    dispatchMethod: 'By Courier Service',
    batchId,
    piecesSold: '1',
    weightSoldKg: '',
    ratePerKg: '1000',
    courierPacking: '250',
    saleType: 'Charged Sale',
    paymentStatus: 'Pending',
    paymentMode: 'Bank',
    paymentNotes: '',
    notes: '',
  };
}

export function num(value: string) {
  return Number(value.replace(/,/g, '')) || 0;
}

export function money(value: number) {
  return `Rs.${value.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
}

export function kg(value: number) {
  return value.toLocaleString('en-IN', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
}

export function dateLabel(value: string) {
  if (!value) return 'Choose sale date';
  return new Date(`${value}T00:00:00`).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function invoiceNumber(sale: SaleRecord) {
  if (sale.isDraft) return 'DRAFT';
  const year = new Date(`${sale.date}T00:00:00`).getFullYear();
  const numberSeed = sale.id.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return `${isInternalUse(sale.saleType) ? 'IU' : 'EP'}-${year}-${String((numberSeed % 9999) + 1).padStart(4, '0')}`;
}

export function integerToWords(value: number): string {
  const ones = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'];
  const teens = ['ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
  const tens = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];

  if (value === 0) return 'zero';
  if (value < 10) return ones[value];
  if (value < 20) return teens[value - 10];
  if (value < 100) return `${tens[Math.floor(value / 10)]}${value % 10 ? ` ${ones[value % 10]}` : ''}`;
  if (value < 1000) return `${ones[Math.floor(value / 100)]} hundred${value % 100 ? ` and ${integerToWords(value % 100)}` : ''}`;
  if (value < 100000) return `${integerToWords(Math.floor(value / 1000))} thousand${value % 1000 ? ` ${integerToWords(value % 1000)}` : ''}`;
  if (value < 10000000) return `${integerToWords(Math.floor(value / 100000))} lakh${value % 100000 ? ` ${integerToWords(value % 100000)}` : ''}`;
  return `${integerToWords(Math.floor(value / 10000000))} crore${value % 10000000 ? ` ${integerToWords(value % 10000000)}` : ''}`;
}

export function amountInWords(value: number) {
  return `Rupees ${integerToWords(Math.round(value))} only`;
}

export function invoiceHtml(sale: SaleRecord) {
  const no = invoiceNumber(sale);
  const safe = (value: string) => value.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]!));
  const words = amountInWords(sale.totalAmount);
  const isPaid = sale.paymentStatus === 'Paid';
  const isNoChargeProduce = sale.saleType !== 'Charged Sale';

  if (isInternalUse(sale.saleType)) return `<!doctype html><html><head><meta charset="utf-8"><title>${no} Internal Use</title>
    <style>body{font-family:Arial,sans-serif;max-width:760px;margin:40px auto;color:#143c2c;padding:24px}h1{font-size:24px}td,th{border:1px solid #ccc;padding:12px;text-align:left}table{border-collapse:collapse;width:100%}p{white-space:pre-wrap}</style></head><body>
    <h1>MSP Coffee — Internal-use Record</h1><p>${sale.isDraft ? 'DRAFT — not saved' : safe(no)}</p>
    <table><tr><th>Date</th><td>${dateLabel(sale.date)}</td></tr><tr><th>Use</th><td>${safe(sale.saleType)}</td></tr>
    <tr><th>Produce token</th><td>${safe(sale.itemCode)}</td></tr><tr><th>Product / Estate</th><td>${safe(sale.product)} / ${safe(sale.estate)}</td></tr>
    <tr><th>Recipient</th><td>${safe(sale.recipientName || sale.buyerName)}</td></tr><tr><th>Quantity / Weight</th><td>${sale.piecesSold} / ${kg(sale.weightSoldKg)} kg</td></tr>
    <tr><th>Total charges</th><td>Rs.0 — internal use</td></tr></table><p>Notes: ${safe(sale.notes || '-')}</p></body></html>`;

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>${no} Bill</title>
<style>
  body { font-family: Georgia, 'Times New Roman', serif; color: #111; margin: 0; background: #f6f1e8; }
  .sheet { position: relative; width: 794px; min-height: 1123px; margin: 20px auto; padding: 54px 64px; background: white; box-shadow: 0 12px 40px rgba(0,0,0,.12); overflow: hidden; }
  .paid-stamp { position: absolute; top: 450px; left: 120px; right: 120px; transform: rotate(-18deg); color: rgba(185,28,28,.82); font-family: Arial, sans-serif; font-size: 124px; font-weight: 900; letter-spacing: 10px; text-align: center; z-index: 3; pointer-events: none; }
  .header { display: flex; align-items: center; gap: 22px; border-bottom: 1px solid #222; padding-bottom: 12px; }
  .mark { width: 72px; height: 72px; display: grid; place-items: center; background: #222; color: white; font-weight: 900; font-family: Arial, sans-serif; }
  h1 { margin: 0; font-size: 31px; letter-spacing: 1px; }
  .address { text-align: center; font-size: 14px; margin-top: 4px; }
  .meta { display: flex; justify-content: space-between; margin-top: 40px; font-size: 15px; line-height: 1.45; }
  .bill { text-align: center; margin: 30px 0 16px; text-decoration: underline; font-weight: 700; }
  table { width: 100%; border-collapse: collapse; font-size: 14px; }
  th, td { border: 1px solid #333; padding: 7px 8px; vertical-align: top; }
  th { text-align: left; background: #f7f7f7; }
  .num { text-align: right; }
  .words { margin: 22px 0 28px; font-size: 15px; }
  .payment { display: grid; grid-template-columns: 1.1fr .9fr; gap: 0; border: 1px solid #333; }
  .payment > div { padding: 12px; min-height: 118px; }
  .payment > div + div { border-left: 1px solid #333; }
  .section-title { text-decoration: underline; font-weight: 700; margin-bottom: 8px; }
  .thanks { margin-top: 34px; line-height: 1.8; }
  .footer { margin-top: 90px; border-top: 1px solid #333; padding-top: 10px; display: grid; grid-template-columns: 1.1fr 1fr 1fr; gap: 16px; font-size: 12px; line-height: 1.35; }
  @media print { body { background: white; } .sheet { margin: 0; box-shadow: none; width: auto; min-height: auto; } }
</style>
</head>
<body>
<div class="sheet">
  <div class="header">
    <div class="mark">MSP<br/>COFFEE</div>
    <div style="flex:1">
      <h1>MSP COFFEE PRIVATE LIMITED</h1>
      <div class="address">370/2 Moganad Estate, Yercaud 636602, Tamil Nadu, India</div>
    </div>
  </div>
  <div class="meta">
    <div>
      <div>${dateLabel(sale.date)}</div>
      <br/>
      <strong>${safe(sale.buyerName)}</strong><br/>
      ${safe(sale.buyerAddress).replace(/\n/g, '<br/>') || 'Buyer address'}<br/>
      ${sale.buyerPhone ? `Cell : ${safe(sale.buyerPhone)}` : ''}<br/>
      ${sale.buyerEmail ? `Email : ${safe(sale.buyerEmail)}` : ''}
    </div>
    <div>
      <strong>Bill No:</strong> ${no}<br/><br/>
      <u>${safe(sale.dispatchMethod)}</u>
    </div>
  </div>
  <div class="bill">BILL</div>
  ${isPaid ? '<div class="paid-stamp">PAID</div>' : ''}
  <table>
    <thead>
      <tr><th>Date</th><th>Particulars</th><th>Kgs</th><th>Rate</th><th></th><th>Amount</th></tr>
    </thead>
    <tbody>
      <tr>
        <td>${new Date(`${sale.date}T00:00:00`).toLocaleDateString('en-GB')}</td>
        <td>${safe(sale.product)} (${sale.piecesSold} Nos)<br/>Token: ${safe(sale.itemCode || 'Not recorded')}<br/>Estate: ${safe(sale.estate)}${isNoChargeProduce ? `<br/><strong>${safe(sale.saleType)} - produce not charged</strong>` : ''}</td>
        <td>${kg(sale.weightSoldKg)} Kgs</td>
        <td>${isNoChargeProduce ? 'No charge' : `Rs.${sale.ratePerKg}/-`}</td>
        <td>=</td>
        <td class="num">${sale.produceAmount.toFixed(2)}</td>
      </tr>
      <tr>
        <td>${new Date(`${sale.date}T00:00:00`).toLocaleDateString('en-GB')}</td>
        <td>Courier and Packing Charges</td>
        <td></td><td></td><td>=</td>
        <td class="num">${sale.courierPacking.toFixed(2)}</td>
      </tr>
      <tr>
        <td></td><td></td><td></td><td><strong>Total</strong></td><td></td>
        <td class="num"><strong>${sale.totalAmount.toFixed(2)}</strong></td>
      </tr>
    </tbody>
  </table>
  <div class="words">(${words})</div>
  <div style="margin: -8px 0 18px; font-size: 14px;"><strong>Payment Status:</strong> ${safe(sale.paymentStatus)}${sale.saleType !== 'Charged Sale' ? ` &nbsp; | &nbsp; <strong>Sale Type:</strong> ${safe(sale.saleType)}` : ''}</div>
  <div class="payment">
    <div>
      <div class="section-title">Payment Details:-</div>
      Cheque or Demand Draft<br/>
      Infavour of <strong>"M/s.Moganad Estate"</strong>, Payable at Yercaud.<br/><br/>
      <u>Post to</u> &nbsp; The Manager,<br/>
      MSP Coffee (P) Ltd.,<br/>
      Moganad Estate, Semmanatham Post,<br/>
      Yercaud - 636 602, Salem District.<br/>
      Tamil Nadu.<br/>
      Tel: +91-4281-290640.
    </div>
    <div>
      <div class="section-title">Payment Details:-</div>
      <u>Pay online</u><br/><br/>
      Account Name = Moganad Estate<br/>
      Current A/c No = 1226 2010 00418<br/>
      Bank Name = Canara Bank<br/>
      Branch Name = Yercaud<br/>
      Bank IFSC Code = CNRB0001226<br/><br/>
      GPay Number = To be added
    </div>
  </div>
  <div class="thanks">
    Thanking you,<br/><br/>
    Yours truly,<br/>
    For MSP Coffee P Ltd.,<br/><br/><br/>
    Manager.
  </div>
  <div class="footer">
    <div>
      GSTIN : 33AABCM4455B1ZZ<br/>
      PAN NO : AABCM4455B<br/>
      CIN : U15492TZ1996PTC007450
    </div>
    <div>
      PHONE : +91 4281 290640<br/>
      EMAIL : mail@mspcoffee.com<br/>
      WEB : www.mspcoffee.com<br/>
      Instagram : msp.coffee
    </div>
    <div>
      Registered Office:<br/>
      370/2 Moganad Estate,<br/>
      Semmanatham post,<br/>
      Yercaud 636002,<br/>
      Salem District, Tamil Nadu
    </div>
  </div>
</div>
</body>
</html>`;
}

