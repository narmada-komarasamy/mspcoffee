'use client';

import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Banknote,
  Calculator,
  CheckCircle2,
  Download,
  FileText,
  IndianRupee,
  PackageCheck,
  Plus,
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

const initialBatches: StockBatch[] = [
  {
    id: 'durian-me-2026-09-07',
    date: '2026-09-07',
    estate: 'ME',
    product: 'Durian Fruits',
    unit: 'Pieces',
    receivedPieces: 149,
    receivedWeightKg: 129.7,
    soldPieces: 2,
    soldWeightKg: 1.55,
  },
  {
    id: 'pepper-me-2026-09-07',
    date: '2026-09-07',
    estate: 'ME',
    product: 'Pepper',
    unit: 'Kg',
    receivedPieces: 0,
    receivedWeightKg: 98,
    soldPieces: 0,
    soldWeightKg: 0,
  },
  {
    id: 'cloves-se-2026-09-06',
    date: '2026-09-06',
    estate: 'SE',
    product: 'Cloves',
    unit: 'Kg',
    receivedPieces: 0,
    receivedWeightKg: 50,
    soldPieces: 0,
    soldWeightKg: 0,
  },
  {
    id: 'nutmeg-hfe-2026-09-06',
    date: '2026-09-06',
    estate: 'HFE',
    product: 'Nutmeg',
    unit: 'Kg',
    receivedPieces: 0,
    receivedWeightKg: 38.2,
    soldPieces: 0,
    soldWeightKg: 0,
  },
];

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

function blankDraft(batchId = initialBatches[0].id): DraftSale {
  return {
    date: '2026-09-08',
    buyerName: '',
    buyerPhone: '',
    buyerAddress: '',
    dispatchMethod: 'By Courier Service',
    batchId,
    piecesSold: '2',
    weightSoldKg: '1.550',
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

export default function ProduceSalesPage() {
  const [batches, setBatches] = useState(initialBatches);
  const [sales, setSales] = useState(initialSales);
  const [draft, setDraft] = useState<DraftSale>(blankDraft());
  const [selectedSaleId, setSelectedSaleId] = useState(initialSales[0].id);
  const [search, setSearch] = useState('');
  const [paymentFilter, setPaymentFilter] = useState<'All' | PaymentStatus>('All');

  const selectedBatch = batches.find((batch) => batch.id === draft.batchId) ?? batches[0];
  const selectedSale = sales.find((sale) => sale.id === selectedSaleId) ?? sales[0];
  const piecesAvailable = selectedBatch.receivedPieces - selectedBatch.soldPieces;
  const weightAvailable = selectedBatch.receivedWeightKg - selectedBatch.soldWeightKg;
  const piecesSold = num(draft.piecesSold);
  const weightSold = num(draft.weightSoldKg);
  const rate = num(draft.ratePerKg);
  const courier = num(draft.courierPacking);
  const produceAmount = weightSold * rate;
  const totalAmount = produceAmount + courier;
  const overStock = piecesSold > piecesAvailable || weightSold > weightAvailable;

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

  const updateDraft = (key: keyof DraftSale, value: string) => {
    setDraft((current) => ({ ...current, [key]: value }));
  };

  const saveSale = () => {
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

    setSales((current) => [sale, ...current]);
    setBatches((current) =>
      current.map((batch) =>
        batch.id === selectedBatch.id
          ? { ...batch, soldPieces: batch.soldPieces + piecesSold, soldWeightKg: batch.soldWeightKg + weightSold }
          : batch,
      ),
    );
    setSelectedSaleId(sale.id);
    setDraft(blankDraft(selectedBatch.id));
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
                <select value={draft.batchId} onChange={(event) => updateDraft('batchId', event.target.value)} className="w-full rounded-md border border-stone-200 px-3 py-2 text-sm">
                  {batches.map((batch) => (
                    <option key={batch.id} value={batch.id}>
                      {batch.product} / {batch.estate} / {dateLabel(batch.date)}
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
        </main>

        <aside className="space-y-4">
          <section className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm">
            <h2 className="flex items-center gap-2 font-bold text-emerald-950">
              <PackageCheck className="h-4 w-4" />
              Available Stock
            </h2>
            <div className="mt-4 divide-y divide-stone-100">
              {stockSummary.map((batch) => (
                <button
                  key={batch.id}
                  onClick={() => updateDraft('batchId', batch.id)}
                  className={`w-full py-3 text-left text-sm ${draft.batchId === batch.id ? 'text-emerald-900' : 'text-stone-700'}`}
                >
                  <div className="flex justify-between gap-3">
                    <span className="font-bold">{batch.product} / {batch.estate}</span>
                    <span>{dateLabel(batch.date)}</span>
                  </div>
                  <div className="mt-1 text-stone-500">
                    {batch.availablePieces} pcs / {kg(batch.availableWeightKg)} kg available
                  </div>
                </button>
              ))}
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
                <span>Invoice generation will use these fields in Stage 2.</span>
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
