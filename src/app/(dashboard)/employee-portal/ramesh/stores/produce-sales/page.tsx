'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Banknote,
  Calculator,
  CheckCircle2,
  Download,
  Eye,
  FileText,
  IndianRupee,
  Mail,
  PackageCheck,
  Plus,
  Printer,
  Search,
  ShoppingBag,
} from 'lucide-react';

type PaymentStatus = 'Paid' | 'Pending' | 'Partial';
type PaymentMode = 'Cash' | 'UPI' | 'Bank' | 'Cheque' | 'Other';

type StockBatch = {
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

type SaleRecord = {
  id: string;
  date: string;
  buyerName: string;
  buyerPhone: string;
  buyerAddress: string;
  dispatchMethod: string;
  batchId: string;
  estate: string;
  product: string;
  piecesSold: number;
  weightSoldKg: number;
  ratePerKg: number;
  produceAmount: number;
  courierPacking: number;
  totalAmount: number;
  paymentStatus: PaymentStatus;
  paymentMode: PaymentMode;
  paymentNotes: string;
  notes: string;
};

type DraftSale = {
  date: string;
  buyerName: string;
  buyerPhone: string;
  buyerAddress: string;
  dispatchMethod: string;
  batchId: string;
  piecesSold: string;
  weightSoldKg: string;
  ratePerKg: string;
  courierPacking: string;
  paymentStatus: PaymentStatus;
  paymentMode: PaymentMode;
  paymentNotes: string;
  notes: string;
};

type StoreItem = {
  id: string;
  itemCode: string;
  receivedDate: string;
  estate: string;
  product: string;
  unit: string;
  quantity: number;
  weightKg: number;
  conditionGrade: string;
  storageLocation: string;
  status: 'In Store' | 'Reserved' | 'Sold' | 'Internal Consumption' | 'Damaged' | 'Cold Storage';
};

const initialSales: SaleRecord[] = [
  {
    id: 'sale-durian-preeti-2026-09-01',
    date: '2026-09-01',
    buyerName: 'Mrs. Preeti Garg',
    buyerPhone: '+91-98410 10889',
    buyerAddress: 'Garg Nivas, Chennai',
    dispatchMethod: 'By Courier Service',
    batchId: 'durian-me-2026-09-07',
    estate: 'ME',
    product: 'Durian Fruits',
    piecesSold: 2,
    weightSoldKg: 1.55,
    ratePerKg: 1000,
    produceAmount: 1550,
    courierPacking: 250,
    totalAmount: 1800,
    paymentStatus: 'Pending',
    paymentMode: 'Bank',
    paymentNotes: 'Invoice-ready sale entry.',
    notes: 'Courier and packing charges included.',
  },
];

function currentDateValue() {
  const now = new Date();
  return [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
  ].join('-');
}

function blankDraft(batchId = ''): DraftSale {
  return {
    date: currentDateValue(),
    buyerName: '',
    buyerPhone: '',
    buyerAddress: '',
    dispatchMethod: 'By Courier Service',
    batchId,
    piecesSold: '1',
    weightSoldKg: '',
    ratePerKg: '1000',
    courierPacking: '250',
    paymentStatus: 'Pending',
    paymentMode: 'Bank',
    paymentNotes: '',
    notes: '',
  };
}

function num(value: string) {
  return Number(value.replace(/,/g, '')) || 0;
}

function money(value: number) {
  return `Rs.${value.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
}

function kg(value: number) {
  return value.toLocaleString('en-IN', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
}

function dateLabel(value: string) {
  return new Date(`${value}T00:00:00`).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function invoiceNumber(sale: SaleRecord) {
  const year = new Date(`${sale.date}T00:00:00`).getFullYear();
  const numberSeed = sale.id.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return `EP-${year}-${String((numberSeed % 9999) + 1).padStart(4, '0')}`;
}

function integerToWords(value: number): string {
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

function amountInWords(value: number) {
  return `Rupees ${integerToWords(Math.round(value))} only`;
}

function invoiceHtml(sale: SaleRecord) {
  const no = invoiceNumber(sale);
  const words = amountInWords(sale.totalAmount);

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>${no} Bill</title>
<style>
  body { font-family: Georgia, 'Times New Roman', serif; color: #111; margin: 0; background: #f6f1e8; }
  .sheet { width: 794px; min-height: 1123px; margin: 20px auto; padding: 54px 64px; background: white; box-shadow: 0 12px 40px rgba(0,0,0,.12); }
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
      <strong>${sale.buyerName}</strong><br/>
      ${sale.buyerAddress.replace(/\n/g, '<br/>') || 'Buyer address'}<br/>
      ${sale.buyerPhone ? `Cell : ${sale.buyerPhone}` : ''}
    </div>
    <div>
      <strong>Bill No:</strong> ${no}<br/><br/>
      <u>${sale.dispatchMethod}</u>
    </div>
  </div>
  <div class="bill">BILL</div>
  <table>
    <thead>
      <tr><th>Date</th><th>Particulars</th><th>Kgs</th><th>Rate</th><th></th><th>Amount</th></tr>
    </thead>
    <tbody>
      <tr>
        <td>${new Date(`${sale.date}T00:00:00`).toLocaleDateString('en-GB')}</td>
        <td>${sale.product} (${sale.piecesSold} Nos)</td>
        <td>${kg(sale.weightSoldKg)} Kgs</td>
        <td>Rs.${sale.ratePerKg}/-</td>
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

export default function ProduceSalesPage() {
  const [batches, setBatches] = useState<StockBatch[]>([]);
  const [loadingStock, setLoadingStock] = useState(true);
  const [stockStatus, setStockStatus] = useState('');
  const [sales, setSales] = useState(initialSales);
  const [draft, setDraft] = useState<DraftSale>(blankDraft());
  const [selectedSaleId, setSelectedSaleId] = useState(initialSales[0].id);
  const [search, setSearch] = useState('');
  const [paymentFilter, setPaymentFilter] = useState<'All' | PaymentStatus>('All');
  const [emailDraftOpen, setEmailDraftOpen] = useState(false);

  const loadStoreStock = useCallback(async () => {
    setLoadingStock(true);
    setStockStatus('');
    try {
      const response = await fetch('/api/estate-produce/store?status=In%20Store');
      const body = await response.json().catch(() => ({})) as { items?: StoreItem[]; error?: string };
      if (!response.ok) throw new Error(body.error || 'Could not load produce store stock');
      const coldResponse = await fetch('/api/estate-produce/store?status=Cold%20Storage');
      const coldBody = await coldResponse.json().catch(() => ({})) as { items?: StoreItem[]; error?: string };
      if (!coldResponse.ok) throw new Error(coldBody.error || 'Could not load cold storage stock');
      const storeItems = [...(body.items ?? []), ...(coldBody.items ?? [])];
      const nextBatches = storeItems.map((item) => ({
        id: item.id,
        date: item.receivedDate,
        estate: item.estate,
        product: item.product,
        unit: item.unit,
        receivedPieces: item.unit === 'Pieces' ? item.quantity : 0,
        receivedWeightKg: item.weightKg,
        soldPieces: 0,
        soldWeightKg: 0,
        itemCode: item.itemCode,
        status: item.status,
        conditionGrade: item.conditionGrade,
        storageLocation: item.storageLocation,
      }));
      setBatches(nextBatches);
      setDraft((current) => {
        const selectedStillAvailable = nextBatches.some((batch) => batch.id === current.batchId);
        const nextBatch = selectedStillAvailable ? current.batchId : nextBatches[0]?.id ?? '';
        const batch = nextBatches.find((entry) => entry.id === nextBatch);
        return {
          ...current,
          batchId: nextBatch,
          piecesSold: batch?.unit === 'Pieces' ? String(batch.receivedPieces || 1) : current.piecesSold,
          weightSoldKg: batch ? String(batch.receivedWeightKg.toFixed(3)) : current.weightSoldKg,
        };
      });
    } catch (error) {
      setStockStatus(error instanceof Error ? error.message : 'Could not load produce store stock');
    } finally {
      setLoadingStock(false);
    }
  }, []);

  useEffect(() => {
    loadStoreStock();
  }, [loadStoreStock]);

  const selectedBatch = batches.find((batch) => batch.id === draft.batchId) ?? batches[0] ?? null;
  const selectedSale = sales.find((sale) => sale.id === selectedSaleId) ?? sales[0];
  const piecesAvailable = selectedBatch ? selectedBatch.receivedPieces - selectedBatch.soldPieces : 0;
  const weightAvailable = selectedBatch ? selectedBatch.receivedWeightKg - selectedBatch.soldWeightKg : 0;
  const piecesSold = num(draft.piecesSold);
  const weightSold = num(draft.weightSoldKg);
  const rate = num(draft.ratePerKg);
  const courier = num(draft.courierPacking);
  const produceAmount = weightSold * rate;
  const totalAmount = produceAmount + courier;
  const overStock = !selectedBatch || piecesSold > piecesAvailable || weightSold > weightAvailable;

  const filteredSales = useMemo(() => {
    return sales.filter((sale) => {
      const text = `${sale.buyerName} ${sale.buyerPhone} ${sale.buyerAddress} ${sale.product} ${sale.estate} ${sale.paymentStatus}`.toLowerCase();
      const matchesSearch = search.trim() ? text.includes(search.trim().toLowerCase()) : true;
      const matchesPayment = paymentFilter === 'All' || sale.paymentStatus === paymentFilter;
      return matchesSearch && matchesPayment;
    });
  }, [sales, search, paymentFilter]);

  const totals = useMemo(() => {
    return sales.reduce(
      (acc, sale) => ({
        revenue: acc.revenue + sale.totalAmount,
        pending: acc.pending + (sale.paymentStatus === 'Pending' ? sale.totalAmount : 0),
        paid: acc.paid + (sale.paymentStatus === 'Paid' ? sale.totalAmount : 0),
        partial: acc.partial + (sale.paymentStatus === 'Partial' ? sale.totalAmount : 0),
      }),
      { revenue: 0, pending: 0, paid: 0, partial: 0 },
    );
  }, [sales]);

  const stockSummary = useMemo(() => {
    return batches.map((batch) => ({
      ...batch,
      availablePieces: batch.receivedPieces - batch.soldPieces,
      availableWeightKg: batch.receivedWeightKg - batch.soldWeightKg,
    }));
  }, [batches]);

  const emailDraft = useMemo(() => {
    if (!selectedSale) return null;
    const no = invoiceNumber(selectedSale);

    return {
      to: selectedSale.buyerPhone ? `${selectedSale.buyerName} <buyer email to add>` : 'buyer email to add',
      subject: `${no} Bill from MSP Coffee Private Limited`,
      attachment: `${no.toLowerCase()}-bill.pdf`,
      body: `Dear ${selectedSale.buyerName},\n\nPlease find attached the bill for ${selectedSale.product}.\n\nBill No: ${no}\nAmount: ${money(selectedSale.totalAmount)}\nPayment Status: ${selectedSale.paymentStatus}\n\nRegards,\nMSP Coffee Private Limited`,
    };
  }, [selectedSale]);

  const updateDraft = (key: keyof DraftSale, value: string) => {
    setDraft((current) => ({ ...current, [key]: value }));
  };

  const selectBatch = (batchId: string) => {
    const batch = batches.find((entry) => entry.id === batchId);
    setDraft((current) => ({
      ...current,
      batchId,
      piecesSold: batch?.unit === 'Pieces' ? String(batch.receivedPieces || 1) : current.piecesSold,
      weightSoldKg: batch ? String(batch.receivedWeightKg.toFixed(3)) : current.weightSoldKg,
    }));
  };

  const saveSale = async () => {
    if (!selectedBatch) return;
    if (overStock) return;

    const sale: SaleRecord = {
      id: `sale-${Date.now()}`,
      date: draft.date,
      buyerName: draft.buyerName || 'Walk-in Buyer',
      buyerPhone: draft.buyerPhone,
      buyerAddress: draft.buyerAddress,
      dispatchMethod: draft.dispatchMethod,
      batchId: selectedBatch.id,
      estate: selectedBatch.estate,
      product: selectedBatch.product,
      piecesSold,
      weightSoldKg: weightSold,
      ratePerKg: rate,
      produceAmount,
      courierPacking: courier,
      totalAmount,
      paymentStatus: draft.paymentStatus,
      paymentMode: draft.paymentMode,
      paymentNotes: draft.paymentNotes,
      notes: draft.notes,
    };

    const markSoldResponse = await fetch(`/api/estate-produce/store/${selectedBatch.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status: 'Sold',
        movementNotes: `Sold to ${sale.buyerName} on ${sale.date}.`,
        notes: [draft.notes, `Sale ${sale.id}: ${sale.piecesSold} pcs / ${kg(sale.weightSoldKg)} kg to ${sale.buyerName}`].filter(Boolean).join('\n'),
      }),
    });
    const body = await markSoldResponse.json().catch(() => ({})) as { error?: string };
    if (!markSoldResponse.ok) {
      alert(body.error || 'Sale was not saved because stock could not be marked sold.');
      return;
    }

    setSales((current) => [sale, ...current]);
    setBatches((current) =>
      current.map((batch) =>
        batch.id === selectedBatch.id
          ? { ...batch, soldPieces: batch.soldPieces + piecesSold, soldWeightKg: batch.soldWeightKg + weightSold }
          : batch,
      ),
    );
    setSelectedSaleId(sale.id);
    await loadStoreStock();
    setDraft(blankDraft(''));
  };

  const exportCsv = () => {
    const headers = ['Date', 'Buyer', 'Phone', 'Estate', 'Product', 'Pieces', 'Weight kg', 'Rate', 'Courier/Packing', 'Total', 'Payment status', 'Payment mode'];
    const rows = filteredSales.map((sale) => [
      sale.date,
      sale.buyerName,
      sale.buyerPhone,
      sale.estate,
      sale.product,
      sale.piecesSold,
      sale.weightSoldKg,
      sale.ratePerKg,
      sale.courierPacking,
      sale.totalAmount,
      sale.paymentStatus,
      sale.paymentMode,
    ]);
    const csv = [headers, ...rows].map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'produce-sales.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  const printInvoice = () => {
    if (!selectedSale) return;
    const printWindow = window.open('', '_blank', 'noopener,noreferrer,width=900,height=1100');
    if (!printWindow) return;
    printWindow.document.write(invoiceHtml(selectedSale));
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  };

  const downloadInvoiceHtml = () => {
    if (!selectedSale) return;
    const no = invoiceNumber(selectedSale);
    const url = URL.createObjectURL(new Blob([invoiceHtml(selectedSale)], { type: 'text/html;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `${no.toLowerCase()}-bill.html`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-5">
      <section className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-emerald-800">Employee Portal / Ramesh / Stores / Produce Sales</p>
          <h1 className="mt-2 text-3xl font-bold text-emerald-950">Produce Sales</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={saveSale} disabled={overStock} className="inline-flex items-center gap-2 rounded-md bg-emerald-800 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-900 disabled:cursor-not-allowed disabled:bg-stone-400">
            <Plus className="h-4 w-4" />
            Save Sale
          </button>
          <button onClick={exportCsv} className="inline-flex items-center gap-2 rounded-md border border-emerald-200 bg-white px-4 py-2 text-sm font-semibold text-emerald-900 shadow-sm transition hover:bg-emerald-50">
            <Download className="h-4 w-4" />
            Export
          </button>
          <button onClick={printInvoice} className="inline-flex items-center gap-2 rounded-md border border-emerald-200 bg-white px-4 py-2 text-sm font-semibold text-emerald-900 shadow-sm transition hover:bg-emerald-50">
            <Printer className="h-4 w-4" />
            Print Bill
          </button>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {[
          ['Total Revenue', money(totals.revenue), 'All sales'],
          ['Paid', money(totals.paid), 'Received'],
          ['Pending', money(totals.pending), 'To collect'],
          ['Partial', money(totals.partial), 'Follow up'],
          ['Sale Records', sales.length.toLocaleString('en-IN'), 'Entries'],
        ].map(([label, value, sub]) => (
          <div key={label} className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase text-stone-500">{label}</p>
            <p className="mt-2 text-2xl font-bold text-emerald-950">{value}</p>
            <p className="text-sm text-stone-500">{sub}</p>
          </div>
        ))}
      </section>

      <section className="grid gap-5 xl:grid-cols-[1fr_360px]">
        <main className="space-y-5">
          <section className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <h2 className="flex items-center gap-2 text-lg font-bold text-emerald-950">
                <ShoppingBag className="h-5 w-5" />
                New Sale
              </h2>
              <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-900">Invoice-ready fields</span>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <label className="space-y-1">
                <span className="text-xs font-semibold uppercase text-stone-500">Produce Batch</span>
                <select value={draft.batchId} onChange={(event) => selectBatch(event.target.value)} className="w-full rounded-md border border-stone-200 px-3 py-2 text-sm">
                  {!batches.length && <option value="">No sale-ready store stock</option>}
                  {batches.map((batch) => (
                    <option key={batch.id} value={batch.id}>
                      {batch.itemCode} / {batch.product} / {batch.estate}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-1">
                <span className="text-xs font-semibold uppercase text-stone-500">Sale Date</span>
                <input type="date" value={draft.date} onChange={(event) => updateDraft('date', event.target.value)} className="w-full rounded-md border border-stone-200 px-3 py-2 text-sm" />
              </label>
              <label className="space-y-1">
                <span className="text-xs font-semibold uppercase text-stone-500">Buyer Name</span>
                <input value={draft.buyerName} onChange={(event) => updateDraft('buyerName', event.target.value)} placeholder="Buyer name" className="w-full rounded-md border border-stone-200 px-3 py-2 text-sm" />
              </label>
              <label className="space-y-1">
                <span className="text-xs font-semibold uppercase text-stone-500">Buyer Phone</span>
                <input value={draft.buyerPhone} onChange={(event) => updateDraft('buyerPhone', event.target.value)} placeholder="Phone number" className="w-full rounded-md border border-stone-200 px-3 py-2 text-sm" />
              </label>
              <label className="space-y-1 md:col-span-2">
                <span className="text-xs font-semibold uppercase text-stone-500">Buyer Address</span>
                <textarea value={draft.buyerAddress} onChange={(event) => updateDraft('buyerAddress', event.target.value)} placeholder="Address for invoice or courier" className="min-h-20 w-full rounded-md border border-stone-200 px-3 py-2 text-sm" />
              </label>
              <label className="space-y-1">
                <span className="text-xs font-semibold uppercase text-stone-500">Dispatch Method</span>
                <input value={draft.dispatchMethod} onChange={(event) => updateDraft('dispatchMethod', event.target.value)} className="w-full rounded-md border border-stone-200 px-3 py-2 text-sm" />
              </label>
              <label className="space-y-1">
                <span className="text-xs font-semibold uppercase text-stone-500">Payment Status</span>
                <select value={draft.paymentStatus} onChange={(event) => updateDraft('paymentStatus', event.target.value)} className="w-full rounded-md border border-stone-200 px-3 py-2 text-sm">
                  {['Paid', 'Pending', 'Partial'].map((status) => <option key={status}>{status}</option>)}
                </select>
              </label>
            </div>

            <div className="mt-4 rounded-lg border border-emerald-100 bg-emerald-50/60 p-4">
              <div className="grid gap-3 md:grid-cols-4">
                <label className="space-y-1">
                  <span className="text-xs font-semibold uppercase text-stone-500">Pieces Sold</span>
                  <input value={draft.piecesSold} onChange={(event) => updateDraft('piecesSold', event.target.value)} className="w-full rounded-md border border-stone-200 px-3 py-2 text-sm" />
                </label>
                <label className="space-y-1">
                  <span className="text-xs font-semibold uppercase text-stone-500">Weight Sold Kg</span>
                  <input value={draft.weightSoldKg} onChange={(event) => updateDraft('weightSoldKg', event.target.value)} className="w-full rounded-md border border-stone-200 px-3 py-2 text-sm" />
                </label>
                <label className="space-y-1">
                  <span className="text-xs font-semibold uppercase text-stone-500">Rate Per Kg</span>
                  <input value={draft.ratePerKg} onChange={(event) => updateDraft('ratePerKg', event.target.value)} className="w-full rounded-md border border-stone-200 px-3 py-2 text-sm" />
                </label>
                <label className="space-y-1">
                  <span className="text-xs font-semibold uppercase text-stone-500">Courier/Packing</span>
                  <input value={draft.courierPacking} onChange={(event) => updateDraft('courierPacking', event.target.value)} className="w-full rounded-md border border-stone-200 px-3 py-2 text-sm" />
                </label>
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-3">
                <div className="rounded-md bg-white p-3">
                  <p className="text-xs font-semibold uppercase text-stone-500">Produce Amount</p>
                  <p className="mt-1 text-xl font-bold text-emerald-950">{money(produceAmount)}</p>
                </div>
                <div className="rounded-md bg-white p-3">
                  <p className="text-xs font-semibold uppercase text-stone-500">Final Total</p>
                  <p className="mt-1 text-xl font-bold text-emerald-950">{money(totalAmount)}</p>
                </div>
                <div className={`rounded-md p-3 ${overStock ? 'bg-red-50 text-red-700' : 'bg-white text-emerald-800'}`}>
                  <p className="text-xs font-semibold uppercase">Available After Sale</p>
                  <p className="mt-1 text-sm font-bold">
                    {Math.max(0, piecesAvailable - piecesSold)} pcs / {kg(Math.max(0, weightAvailable - weightSold))} kg
                  </p>
                </div>
              </div>
              {overStock && (
                <div className="mt-3 flex items-start gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  This sale is more than the available stock. Reduce the pieces or weight before saving.
                </div>
              )}
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <label className="space-y-1">
                <span className="text-xs font-semibold uppercase text-stone-500">Payment Mode</span>
                <select value={draft.paymentMode} onChange={(event) => updateDraft('paymentMode', event.target.value)} className="w-full rounded-md border border-stone-200 px-3 py-2 text-sm">
                  {['Cash', 'UPI', 'Bank', 'Cheque', 'Other'].map((mode) => <option key={mode}>{mode}</option>)}
                </select>
              </label>
              <label className="space-y-1">
                <span className="text-xs font-semibold uppercase text-stone-500">Payment Notes</span>
                <input value={draft.paymentNotes} onChange={(event) => updateDraft('paymentNotes', event.target.value)} placeholder="Reference, balance, reminder" className="w-full rounded-md border border-stone-200 px-3 py-2 text-sm" />
              </label>
              <label className="space-y-1 md:col-span-2">
                <span className="text-xs font-semibold uppercase text-stone-500">Sale Notes</span>
                <textarea value={draft.notes} onChange={(event) => updateDraft('notes', event.target.value)} placeholder="Courier note, delivery detail, invoice comment" className="min-h-20 w-full rounded-md border border-stone-200 px-3 py-2 text-sm" />
              </label>
            </div>
          </section>

          <section className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="flex items-center gap-2 text-lg font-bold text-emerald-950">
                <FileText className="h-5 w-5" />
                Sales Records
              </h2>
              <div className="flex flex-wrap gap-2">
                <label className="flex items-center gap-2 rounded-md border border-stone-200 px-3 py-2">
                  <Search className="h-4 w-4 text-stone-400" />
                  <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search sales" className="min-w-0 bg-transparent text-sm outline-none" />
                </label>
                <select value={paymentFilter} onChange={(event) => setPaymentFilter(event.target.value as typeof paymentFilter)} className="rounded-md border border-stone-200 px-3 py-2 text-sm">
                  {['All', 'Paid', 'Pending', 'Partial'].map((status) => <option key={status}>{status}</option>)}
                </select>
              </div>
            </div>
            <div className="mt-4 overflow-x-auto rounded-lg border border-stone-200">
              <table className="w-full min-w-[980px] text-left text-sm">
                <thead className="bg-stone-50 text-xs uppercase text-stone-500">
                  <tr>
                    {['Date', 'Buyer', 'Estate', 'Product', 'Sold', 'Rate', 'Courier', 'Total', 'Payment', 'Mode'].map((heading) => (
                      <th key={heading} className="px-3 py-3 font-bold">{heading}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {filteredSales.map((sale) => (
                    <tr key={sale.id} onClick={() => setSelectedSaleId(sale.id)} className="cursor-pointer bg-white hover:bg-emerald-50/60">
                      <td className="px-3 py-3">{dateLabel(sale.date)}</td>
                      <td className="px-3 py-3 font-semibold text-stone-900">{sale.buyerName}</td>
                      <td className="px-3 py-3 text-emerald-900">{sale.estate}</td>
                      <td className="px-3 py-3">{sale.product}</td>
                      <td className="px-3 py-3">{sale.piecesSold} pcs / {kg(sale.weightSoldKg)} kg</td>
                      <td className="px-3 py-3">{money(sale.ratePerKg)}</td>
                      <td className="px-3 py-3">{money(sale.courierPacking)}</td>
                      <td className="px-3 py-3 font-bold">{money(sale.totalAmount)}</td>
                      <td className="px-3 py-3">
                        <span className={`rounded-full px-2 py-1 text-xs font-bold ${
                          sale.paymentStatus === 'Paid' ? 'bg-emerald-50 text-emerald-800' : sale.paymentStatus === 'Partial' ? 'bg-amber-50 text-amber-800' : 'bg-red-50 text-red-700'
                        }`}>
                          {sale.paymentStatus}
                        </span>
                      </td>
                      <td className="px-3 py-3">{sale.paymentMode}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {selectedSale && (
            <section className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="flex items-center gap-2 text-lg font-bold text-emerald-950">
                  <Eye className="h-5 w-5" />
                  Invoice Preview
                </h2>
                <div className="flex flex-wrap gap-2">
                  <button onClick={printInvoice} className="inline-flex items-center gap-2 rounded-md bg-emerald-800 px-3 py-2 text-sm font-semibold text-white transition hover:bg-emerald-900">
                    <Printer className="h-4 w-4" />
                    Print
                  </button>
                  <button onClick={downloadInvoiceHtml} className="inline-flex items-center gap-2 rounded-md border border-emerald-200 px-3 py-2 text-sm font-semibold text-emerald-900 transition hover:bg-emerald-50">
                    <Download className="h-4 w-4" />
                    Download
                  </button>
                  <button onClick={() => setEmailDraftOpen((open) => !open)} className="inline-flex items-center gap-2 rounded-md border border-emerald-200 px-3 py-2 text-sm font-semibold text-emerald-900 transition hover:bg-emerald-50">
                    <Mail className="h-4 w-4" />
                    Email Draft
                  </button>
                </div>
              </div>

              <div className="mt-4 overflow-x-auto rounded-lg bg-stone-100 p-4">
                <div className="mx-auto min-h-[720px] w-[680px] bg-white p-8 text-sm text-stone-950 shadow-sm">
                  <div className="flex items-center gap-5 border-b border-stone-900 pb-3">
                    <div className="grid h-16 w-16 shrink-0 place-items-center bg-stone-900 text-center text-xs font-black leading-tight text-white">
                      MSP<br />COFFEE
                    </div>
                    <div className="flex-1 text-center">
                      <h3 className="text-2xl font-bold tracking-wide">MSP COFFEE PRIVATE LIMITED</h3>
                      <p className="mt-1 text-xs">370/2 Moganad Estate, Yercaud 636602, Tamil Nadu, India</p>
                    </div>
                  </div>

                  <div className="mt-8 grid grid-cols-2 gap-8">
                    <div className="leading-6">
                      <p>{dateLabel(selectedSale.date)}</p>
                      <p className="mt-5 font-bold">{selectedSale.buyerName}</p>
                      <p className="whitespace-pre-line">{selectedSale.buyerAddress || 'Buyer address'}</p>
                      <p>{selectedSale.buyerPhone ? `Cell : ${selectedSale.buyerPhone}` : ''}</p>
                    </div>
                    <div className="text-right leading-6">
                      <p><span className="font-bold">Bill No:</span> {invoiceNumber(selectedSale)}</p>
                      <p className="mt-5 underline">{selectedSale.dispatchMethod}</p>
                    </div>
                  </div>

                  <p className="mt-8 text-center font-bold underline">BILL</p>
                  <table className="mt-4 w-full border-collapse text-sm">
                    <thead>
                      <tr className="bg-stone-50">
                        {['Date', 'Particulars', 'Kgs', 'Rate', '', 'Amount'].map((head) => (
                          <th key={head} className="border border-stone-700 px-2 py-2 text-left">{head}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td className="border border-stone-700 px-2 py-2">{new Date(`${selectedSale.date}T00:00:00`).toLocaleDateString('en-GB')}</td>
                        <td className="border border-stone-700 px-2 py-2">{selectedSale.product} ({selectedSale.piecesSold} Nos)</td>
                        <td className="border border-stone-700 px-2 py-2">{kg(selectedSale.weightSoldKg)} Kgs</td>
                        <td className="border border-stone-700 px-2 py-2">Rs.{selectedSale.ratePerKg}/-</td>
                        <td className="border border-stone-700 px-2 py-2">=</td>
                        <td className="border border-stone-700 px-2 py-2 text-right">{selectedSale.produceAmount.toFixed(2)}</td>
                      </tr>
                      <tr>
                        <td className="border border-stone-700 px-2 py-2">{new Date(`${selectedSale.date}T00:00:00`).toLocaleDateString('en-GB')}</td>
                        <td className="border border-stone-700 px-2 py-2">Courier and Packing Charges</td>
                        <td className="border border-stone-700 px-2 py-2"></td>
                        <td className="border border-stone-700 px-2 py-2"></td>
                        <td className="border border-stone-700 px-2 py-2">=</td>
                        <td className="border border-stone-700 px-2 py-2 text-right">{selectedSale.courierPacking.toFixed(2)}</td>
                      </tr>
                      <tr>
                        <td className="border border-stone-700 px-2 py-2"></td>
                        <td className="border border-stone-700 px-2 py-2"></td>
                        <td className="border border-stone-700 px-2 py-2"></td>
                        <td className="border border-stone-700 px-2 py-2 font-bold">Total</td>
                        <td className="border border-stone-700 px-2 py-2"></td>
                        <td className="border border-stone-700 px-2 py-2 text-right font-bold">{selectedSale.totalAmount.toFixed(2)}</td>
                      </tr>
                    </tbody>
                  </table>
                  <p className="mt-5">({amountInWords(selectedSale.totalAmount)})</p>

                  <div className="mt-7 grid grid-cols-2 border border-stone-700">
                    <div className="border-r border-stone-700 p-3 leading-6">
                      <p className="font-bold underline">Payment Details:-</p>
                      <p>Cheque or Demand Draft</p>
                      <p>Infavour of <strong>&quot;M/s.Moganad Estate&quot;</strong>, Payable at Yercaud.</p>
                      <p className="mt-3"><u>Post to</u> The Manager, MSP Coffee (P) Ltd., Moganad Estate, Yercaud - 636 602.</p>
                    </div>
                    <div className="p-3 leading-6">
                      <p className="font-bold underline">Payment Details:-</p>
                      <p><u>Pay online</u></p>
                      <p>Account Name = Moganad Estate</p>
                      <p>Current A/c No = 1226 2010 00418</p>
                      <p>Bank Name = Canara Bank</p>
                      <p>Branch Name = Yercaud</p>
                      <p>Bank IFSC Code = CNRB0001226</p>
                      <p>GPay Number = To be added</p>
                    </div>
                  </div>

                  <div className="mt-8 leading-7">
                    <p>Thanking you,</p>
                    <p className="mt-4">Yours truly,</p>
                    <p className="font-bold">For MSP Coffee P Ltd.,</p>
                    <p className="mt-12">Manager.</p>
                  </div>
                </div>
              </div>

              {emailDraftOpen && emailDraft && (
                <div className="mt-4 rounded-lg border border-emerald-100 bg-emerald-50/70 p-4">
                  <h3 className="flex items-center gap-2 font-bold text-emerald-950">
                    <Mail className="h-4 w-4" />
                    Email Draft Preview
                  </h3>
                  <div className="mt-3 grid gap-3 text-sm">
                    <div className="rounded-md bg-white p-3"><span className="font-bold">To:</span> {emailDraft.to}</div>
                    <div className="rounded-md bg-white p-3"><span className="font-bold">Subject:</span> {emailDraft.subject}</div>
                    <div className="rounded-md bg-white p-3"><span className="font-bold">Attachment:</span> {emailDraft.attachment}</div>
                    <pre className="whitespace-pre-wrap rounded-md bg-white p-3 font-sans text-sm">{emailDraft.body}</pre>
                  </div>
                </div>
              )}
            </section>
          )}
        </main>

        <aside className="space-y-4">
          <section className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm">
            <h2 className="flex items-center gap-2 font-bold text-emerald-950">
              <PackageCheck className="h-4 w-4" />
              Available Stock
            </h2>
            {loadingStock && <p className="mt-4 text-sm text-stone-500">Loading live Produce Store stock...</p>}
            {stockStatus && <p className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{stockStatus}</p>}
            <div className="mt-4 divide-y divide-stone-100">
              {stockSummary.map((batch) => (
                <button
                  key={batch.id}
                  onClick={() => selectBatch(batch.id)}
                  className={`w-full py-3 text-left text-sm ${draft.batchId === batch.id ? 'text-emerald-900' : 'text-stone-700'}`}
                >
                  <div className="flex justify-between gap-3">
                    <span className="font-bold">{batch.itemCode ?? batch.product}</span>
                    <span>{dateLabel(batch.date)}</span>
                  </div>
                  <div className="mt-1 text-stone-500">
                    {batch.product} / {batch.estate} / {batch.status}
                  </div>
                  <div className="mt-1 text-stone-500">{batch.availablePieces} pcs / {kg(batch.availableWeightKg)} kg available</div>
                </button>
              ))}
              {!loadingStock && !stockSummary.length && !stockStatus && (
                <div className="py-4 text-sm text-stone-500">No sale-ready stock. Create Store items from Estate Produce first.</div>
              )}
            </div>
          </section>

          <section className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm">
            <h2 className="flex items-center gap-2 font-bold text-emerald-950">
              <Calculator className="h-4 w-4" />
              Current Calculation
            </h2>
            <div className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between"><span>Weight sold</span><span>{kg(weightSold)} kg</span></div>
              <div className="flex justify-between"><span>Rate per kg</span><span>{money(rate)}</span></div>
              <div className="flex justify-between"><span>Produce amount</span><span>{money(produceAmount)}</span></div>
              <div className="flex justify-between"><span>Courier/Packing</span><span>{money(courier)}</span></div>
              <div className="flex justify-between border-t border-stone-100 pt-2 text-base font-bold text-emerald-950"><span>Total</span><span>{money(totalAmount)}</span></div>
            </div>
          </section>

          <section className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm">
            <h2 className="flex items-center gap-2 font-bold text-emerald-950">
              <IndianRupee className="h-4 w-4" />
              Selected Sale
            </h2>
            {selectedSale ? (
              <div className="mt-4 space-y-2 text-sm text-stone-700">
                <p className="text-base font-bold text-stone-900">{selectedSale.buyerName}</p>
                <p>{selectedSale.product} / {selectedSale.estate}</p>
                <p>{selectedSale.piecesSold} pcs / {kg(selectedSale.weightSoldKg)} kg at {money(selectedSale.ratePerKg)}/kg</p>
                <p className="font-bold text-emerald-950">Total: {money(selectedSale.totalAmount)}</p>
                <p>Payment: {selectedSale.paymentStatus} by {selectedSale.paymentMode}</p>
                <p>Dispatch: {selectedSale.dispatchMethod}</p>
                <p>Phone: {selectedSale.buyerPhone || '-'}</p>
              </div>
            ) : (
              <p className="mt-4 text-sm text-stone-500">No sale selected.</p>
            )}
            <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              <div className="flex items-start gap-2">
                <Banknote className="mt-0.5 h-4 w-4 shrink-0" />
                <span>Bill preview, print, download, and email draft are ready for the selected sale.</span>
              </div>
            </div>
          </section>

          <section className="rounded-lg border border-emerald-100 bg-emerald-50 p-4 text-sm text-emerald-900">
            <div className="flex items-start gap-2">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
              <span>Saving a sale reduces available pieces and kg for the selected produce batch.</span>
            </div>
          </section>
        </aside>
      </section>
    </div>
  );
}
