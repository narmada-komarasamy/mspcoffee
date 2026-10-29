'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Banknote,
  Calculator,
  CheckCircle2,
  Copy,
  Download,
  Eye,
  FileText,
  IndianRupee,
  Lock,
  Mail,
  PackageCheck,
  Plus,
  Printer,
  RotateCcw,
  Search,
  ShoppingBag,
  Sparkles,
} from 'lucide-react';
import {
  type PaymentStatus, type StockBatch, type SaleRecord, type DraftSale, type CustomerRecord, type EmailDraft,
  blankDraft, num, money, kg, dateLabel, invoiceNumber, amountInWords, invoiceHtml,
  buildDraftSale, buildEmailDraft, validBuyerEmail, applyCustomerPhone, SALE_TYPES, isInternalUse,
} from '@/lib/produce-sales';

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

const initialSales: SaleRecord[] = [];

export default function ProduceSalesPage() {
  const [batches, setBatches] = useState<StockBatch[]>([]);
  const [loadingStock, setLoadingStock] = useState(true);
  const [stockStatus, setStockStatus] = useState('');
  const [sales, setSales] = useState(initialSales);
  const [customers, setCustomers] = useState<CustomerRecord[]>([]);
  const [salesStatus, setSalesStatus] = useState('');
  const [userRole, setUserRole] = useState('');
  const [draft, setDraft] = useState<DraftSale>(blankDraft());
  const [selectedSaleId, setSelectedSaleId] = useState('');
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('All');
  const [paymentFilter, setPaymentFilter] = useState<'All' | PaymentStatus>('All');
  const [emailDraftOpen, setEmailDraftOpen] = useState(true);
  const [previewMode, setPreviewMode] = useState<'new' | 'saved'>('new');
  const [emailEdits, setEmailEdits] = useState<{ source: string; fields: Partial<EmailDraft> } | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  const loadStoreStock = useCallback(async () => {
    setLoadingStock(true);
    setStockStatus('');
    try {
      const response = await fetch('/api/estate-produce/store?status=Sale%20Stock');
      const body = await response.json().catch(() => ({})) as { items?: StoreItem[]; error?: string };
      if (!response.ok) throw new Error(body.error || 'Could not load produce store stock');
      const storeItems = body.items ?? [];
      const nextBatches = storeItems.map((item) => ({
        id: item.id,
        date: item.receivedDate,
        estate: item.estate,
        product: item.product,
        unit: item.unit,
        receivedPieces: item.quantity,
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
          piecesSold: batch ? String(batch.receivedPieces) : current.piecesSold,
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

  const loadSales = useCallback(async () => {
    setSalesStatus('');
    try {
      const response = await fetch('/api/estate-produce/sales');
      const body = await response.json().catch(() => ({})) as { sales?: SaleRecord[]; customers?: CustomerRecord[]; error?: string };
      if (!response.ok) throw new Error(body.error || 'Could not load saved produce sales');
      setSales(body.sales ?? []);
      setCustomers(body.customers ?? []);
      setSelectedSaleId((current) => (body.sales ?? []).some((sale) => sale.id === current) ? current : body.sales?.[0]?.id ?? '');
    } catch (error) {
      setSalesStatus(error instanceof Error ? error.message : 'Could not load saved produce sales');
    }
  }, []);

  useEffect(() => {
    loadSales();
  }, [loadSales]);

  useEffect(() => {
    let active = true;
    fetch('/api/auth/me')
      .then((response) => response.json())
      .then((body: { user?: { role?: string } }) => {
        if (active) setUserRole(body.user?.role ?? '');
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  const selectedBatch = batches.find((batch) => batch.id === draft.batchId) ?? batches[0] ?? null;
  const selectedSale = sales.find((sale) => sale.id === selectedSaleId) ?? sales[0];
  const previewSale = previewMode === 'new' ? buildDraftSale(draft, selectedBatch) : selectedSale;
  const previewIsDraft = Boolean(previewSale?.isDraft);
  const internalDraft = isInternalUse(draft.saleType);
  const previewIsInternal = Boolean(previewSale && isInternalUse(previewSale.saleType));
  const buyerEmailValid = internalDraft || validBuyerEmail(draft.buyerEmail);
  const piecesAvailable = selectedBatch ? selectedBatch.receivedPieces - selectedBatch.soldPieces : 0;
  const weightAvailable = selectedBatch ? selectedBatch.receivedWeightKg - selectedBatch.soldWeightKg : 0;
  const piecesSold = num(draft.piecesSold);
  const weightSold = num(draft.weightSoldKg);
  const rate = num(draft.ratePerKg);
  const courier = internalDraft ? 0 : num(draft.courierPacking);
  const produceAmount = draft.saleType === 'Charged Sale' ? weightSold * rate : 0;
  const totalAmount = produceAmount + courier;
  const overStock = !selectedBatch || piecesSold > piecesAvailable || weightSold > weightAvailable;

  const filteredSales = useMemo(() => {
    return sales.filter((sale) => {
      const text = `${sale.itemCode} ${sale.buyerName} ${sale.buyerPhone} ${sale.buyerEmail} ${sale.buyerAddress} ${sale.product} ${sale.estate} ${sale.saleType} ${sale.paymentStatus}`.toLowerCase();
      const matchesSearch = search.trim() ? text.includes(search.trim().toLowerCase()) : true;
      const matchesPayment = paymentFilter === 'All' || sale.paymentStatus === paymentFilter;
      return matchesSearch && matchesPayment && (typeFilter === 'All' || sale.saleType === typeFilter);
    });
  }, [sales, search, paymentFilter, typeFilter]);

  const totals = useMemo(() => {
    return sales.reduce(
      (acc, sale) => ({
        revenue: acc.revenue + sale.totalAmount,
        pending: acc.pending + (sale.paymentStatus === 'Pending' ? sale.totalAmount : 0),
        paid: acc.paid + (sale.paymentStatus === 'Paid' ? sale.totalAmount : 0),
        partial: acc.partial + (sale.paymentStatus === 'Partial' ? sale.totalAmount : 0),
        fruitsSold: acc.fruitsSold + (sale.saleType === 'Charged Sale' ? sale.piecesSold : 0),
        kgSold: acc.kgSold + (sale.saleType === 'Charged Sale' ? sale.weightSoldKg : 0),
        complementary: acc.complementary + (sale.saleType === 'Complementary' ? sale.piecesSold : 0),
        replacement: acc.replacement + (sale.saleType === 'Replacement' ? sale.piecesSold : 0),
        processing: acc.processing + (sale.saleType === 'MSP Coffee Processing' ? sale.piecesSold : 0),
        processingKg: acc.processingKg + (sale.saleType === 'MSP Coffee Processing' ? sale.weightSoldKg : 0),
        bungalow: acc.bungalow + (sale.saleType === 'Bungalow Consumption' ? sale.piecesSold : 0),
        bungalowKg: acc.bungalowKg + (sale.saleType === 'Bungalow Consumption' ? sale.weightSoldKg : 0),
      }),
      { revenue: 0, pending: 0, paid: 0, partial: 0, fruitsSold: 0, kgSold: 0, complementary: 0, replacement: 0, processing: 0, processingKg: 0, bungalow: 0, bungalowKg: 0 },
    );
  }, [sales]);

  const stockSummary = useMemo(() => {
    return batches.map((batch) => ({
      ...batch,
      availablePieces: batch.receivedPieces - batch.soldPieces,
      availableWeightKg: batch.receivedWeightKg - batch.soldWeightKg,
    }));
  }, [batches]);

  const emailDraftTemplate = previewSale ? buildEmailDraft(previewSale) : null;
  const emailSource = JSON.stringify(previewSale);
  const editableEmailDraft = emailDraftTemplate
    ? { ...emailDraftTemplate, ...(emailEdits?.source === emailSource ? emailEdits.fields : {}) }
    : null;

  const updateEmailDraft = (key: keyof Omit<EmailDraft, 'saleId'>, value: string) => {
    setEmailEdits(current => ({
      source: emailSource,
      fields: { ...(current?.source === emailSource ? current.fields : {}), [key]: value },
    }));
  };

  const copyEmailDraft = async () => {
    if (!editableEmailDraft) return;
    const text = [
      `To: ${editableEmailDraft.to}`,
      `Subject: ${editableEmailDraft.subject}`,
      `Attachment: ${editableEmailDraft.attachment}`,
      '',
      editableEmailDraft.body,
    ].join('\n');
    await navigator.clipboard?.writeText(text).catch(() => undefined);
  };

  const updateDraft = (key: keyof DraftSale, value: string) => {
    setPreviewMode('new');
    setSaveError('');
    setDraft((current) => {
      const next = { ...current, [key]: value };
      if (key === 'buyerPhone') return applyCustomerPhone(next, customers, current.buyerPhone);
      if (key === 'saleType' && isInternalUse(value)) { next.courierPacking = '0'; }
      if (key === 'saleType' && !isInternalUse(value) && isInternalUse(current.saleType)) { next.courierPacking = '250'; }
      if (key === 'saleType' && value !== 'Charged Sale') {
        next.ratePerKg = '0';
        next.paymentStatus = 'Paid';
      }
      if (key === 'saleType' && value === 'Charged Sale' && current.saleType !== 'Charged Sale') {
        next.ratePerKg = '1000';
        next.paymentStatus = 'Pending';
      }
      return next;
    });
  };

  const selectBatch = (batchId: string) => {
    setPreviewMode('new');
    setSaveError('');
    const batch = batches.find((entry) => entry.id === batchId);
    setDraft((current) => ({
      ...current,
      batchId,
      piecesSold: batch ? String(batch.receivedPieces) : current.piecesSold,
      weightSoldKg: batch ? String(batch.receivedWeightKg.toFixed(3)) : current.weightSoldKg,
    }));
  };

  const saveSale = async () => {
    if (!selectedBatch || overStock || saving) return;
    if (internalDraft && !draft.recipientName.trim()) { setSaveError('Enter the person receiving the fruit.'); return; }
    if (!buyerEmailValid) { setSaveError('Enter a valid buyer email address, or leave it blank.'); return; }
    setSaving(true);
    setSaveError('');
    try {
      const response = await fetch('/api/estate-produce/sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...draft,
          batchId: selectedBatch.id,
          piecesSold,
          weightSoldKg: weightSold,
          ratePerKg: rate,
          courierPacking: courier,
        }),
      });
      const body = await response.json().catch(() => ({})) as { sale?: SaleRecord; error?: string };
      if (!response.ok || !body.sale) {
        setSaveError(body.error || 'Sale was not saved because stock could not be marked sold.');
        return;
      }

      setSales((current) => [body.sale as SaleRecord, ...current.filter((sale) => sale.id !== body.sale?.id)]);
      setSelectedSaleId(body.sale.id);
      setPreviewMode('saved');
      setEmailEdits(null);
      setDraft(blankDraft(''));
      await loadStoreStock();
      await loadSales();
    } catch {
      setSaveError('Could not save the sale. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const markSelectedPaid = async () => {
    if (!selectedSale || isInternalUse(selectedSale.saleType)) return;
    const response = await fetch(`/api/estate-produce/sales/${selectedSale.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paymentStatus: 'Paid', paymentNotes: selectedSale.paymentNotes }),
    });
    const body = await response.json().catch(() => ({})) as { error?: string };
    if (!response.ok) {
      alert(body.error || 'Invoice could not be marked paid.');
      return;
    }
    await loadSales();
  };

  const exportCsv = () => {
    const headers = ['Date', 'Produce Token', 'Buyer / Recipient', 'Phone', 'Estate', 'Product', 'Sale / Use type', 'Pieces', 'Weight kg', 'Rate', 'Courier/Packing', 'Total', 'Payment status', 'Payment mode', 'Notes'];
    const rows = filteredSales.map((sale) => [
      sale.date,
      sale.itemCode,
      sale.recipientName || sale.buyerName,
      sale.buyerPhone,
      sale.estate,
      sale.product,
      sale.saleType,
      sale.piecesSold,
      sale.weightSoldKg,
      sale.ratePerKg,
      sale.courierPacking,
      sale.totalAmount,
      isInternalUse(sale.saleType) ? 'No charge' : sale.paymentStatus,
      isInternalUse(sale.saleType) ? 'Internal use' : sale.paymentMode,
      sale.notes,
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
    if (!previewSale || previewIsDraft) return;
    const printWindow = window.open('', '_blank', 'width=900,height=1100');
    if (!printWindow) return;
    printWindow.opener = null;
    printWindow.document.write(invoiceHtml(previewSale));
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  };

  const downloadInvoiceHtml = () => {
    if (!previewSale || previewIsDraft) return;
    const no = invoiceNumber(previewSale);
    const url = URL.createObjectURL(new Blob([invoiceHtml(previewSale)], { type: 'text/html;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `${no.toLowerCase()}-${previewIsInternal ? 'internal-use' : 'bill'}.html`;
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
          <button onClick={saveSale} disabled={overStock || saving || !buyerEmailValid || (internalDraft && !draft.recipientName.trim()) || (piecesSold <= 0 && weightSold <= 0)} className="inline-flex items-center gap-2 rounded-md bg-emerald-800 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-900 disabled:cursor-not-allowed disabled:bg-stone-400">
            <Plus className="h-4 w-4" />
            {saving ? 'Saving…' : internalDraft ? 'Save Use' : 'Save Sale'}
          </button>
          <button onClick={markSelectedPaid} disabled={previewIsDraft || previewIsInternal || !selectedSale || selectedSale.paymentStatus === 'Paid'} className="inline-flex items-center gap-2 rounded-md border border-red-200 bg-white px-4 py-2 text-sm font-semibold text-red-700 shadow-sm transition hover:bg-red-50 disabled:cursor-not-allowed disabled:border-stone-200 disabled:text-stone-400">
            <Lock className="h-4 w-4" />
            Mark Paid
          </button>
          <button onClick={exportCsv} className="inline-flex items-center gap-2 rounded-md border border-emerald-200 bg-white px-4 py-2 text-sm font-semibold text-emerald-900 shadow-sm transition hover:bg-emerald-50">
            <Download className="h-4 w-4" />
            Export
          </button>
          <button onClick={printInvoice} disabled={!previewSale || previewIsDraft} className="inline-flex items-center gap-2 rounded-md border border-emerald-200 bg-white px-4 py-2 text-sm font-semibold text-emerald-900 shadow-sm transition hover:bg-emerald-50">
            <Printer className="h-4 w-4" />
            {previewIsInternal ? 'Print Record' : 'Print Bill'}
          </button>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ['Fruits Sold', `${totals.fruitsSold.toLocaleString('en-IN')} pcs`, `${kg(totals.kgSold)} kg`],
          ['Complementary Fruits', `${totals.complementary.toLocaleString('en-IN')} pcs`, 'No produce charge'],
          ['Replacement Fruits', `${totals.replacement.toLocaleString('en-IN')} pcs`, 'No produce charge'],
          ['MSP Coffee Processing', `${totals.processing.toLocaleString('en-IN')} pcs`, `${kg(totals.processingKg)} kg · No charge`],
          ['Bungalow Consumption', `${totals.bungalow.toLocaleString('en-IN')} pcs`, `${kg(totals.bungalowKg)} kg · No charge`],
          ['Revenue Collected', money(totals.paid), 'Paid invoices'],
          ['Pending Amount', money(totals.pending + totals.partial), 'To collect'],
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
          <fieldset disabled={saving} className="min-w-0 rounded-lg border border-stone-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <h2 className="flex items-center gap-2 text-lg font-bold text-emerald-950">
                <ShoppingBag className="h-5 w-5" />
                {internalDraft ? 'New Internal Use' : 'New Sale'}
              </h2>
              <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-900">{internalDraft ? 'Internal-use record' : 'Invoice-ready fields'}</span>
            </div>

            {saveError && <p role="alert" className="mt-3 text-sm text-red-700">{saveError}</p>}
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <label className="space-y-1">
                <span className="text-xs font-semibold uppercase text-stone-500">Produce Token No.</span>
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
                <span className="text-xs font-semibold uppercase text-stone-500">Sale Type</span>
                <select value={draft.saleType} onChange={(event) => updateDraft('saleType', event.target.value)} className="w-full rounded-md border border-stone-200 px-3 py-2 text-sm">
                  {SALE_TYPES.map((type) => <option key={type}>{type}</option>)}
                </select>
              </label>
              {internalDraft ? <label className="space-y-1 md:col-span-2">
                <span className="text-xs font-semibold uppercase text-stone-500">Recipient Name</span>
                <input value={draft.recipientName} onChange={event => updateDraft('recipientName', event.target.value)} placeholder="Person receiving the fruit" required className="w-full rounded-md border border-stone-200 px-3 py-2 text-sm" />
              </label> : <>
              <label className="space-y-1">
                <span className="text-xs font-semibold uppercase text-stone-500">Buyer Name</span>
                <input value={draft.buyerName} onChange={(event) => updateDraft('buyerName', event.target.value)} placeholder="Buyer name" className="w-full rounded-md border border-stone-200 px-3 py-2 text-sm" />
              </label>
              <label className="space-y-1">
                <span className="text-xs font-semibold uppercase text-stone-500">Buyer Phone</span>
                <input value={draft.buyerPhone} onChange={(event) => updateDraft('buyerPhone', event.target.value)} placeholder="Phone number" className="w-full rounded-md border border-stone-200 px-3 py-2 text-sm" />
              </label>
              <label className="space-y-1">
                <span className="text-xs font-semibold uppercase text-stone-500">Buyer Email</span>
                <input type="email" value={draft.buyerEmail} onChange={(event) => updateDraft('buyerEmail', event.target.value)} placeholder="buyer@example.com" aria-invalid={!buyerEmailValid} className="w-full rounded-md border border-stone-200 px-3 py-2 text-sm" />
                <span className="block text-xs text-stone-500">Remembered after saving when a buyer phone number is provided.</span>
                {!buyerEmailValid && <span role="alert" className="block text-xs text-red-700">Enter a valid email address.</span>}
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
                <select value={draft.paymentStatus} onChange={(event) => updateDraft('paymentStatus', event.target.value)} disabled={draft.saleType !== 'Charged Sale'} className="w-full rounded-md border border-stone-200 px-3 py-2 text-sm disabled:bg-stone-100 disabled:text-stone-500">
                  {['Paid', 'Pending', 'Partial'].map((status) => <option key={status}>{status}</option>)}
                </select>
              </label>              </>}

            </div>

            <div className="mt-4 rounded-lg border border-emerald-100 bg-emerald-50/60 p-4">
              <div className="grid gap-3 md:grid-cols-4">
                <label className="space-y-1">
                  <span className="text-xs font-semibold uppercase text-stone-500">{internalDraft ? 'Pieces / Quantity Used' : 'Pieces Sold'}</span>
                  <input value={draft.piecesSold} onChange={(event) => updateDraft('piecesSold', event.target.value)} className="w-full rounded-md border border-stone-200 px-3 py-2 text-sm" />
                </label>
                <label className="space-y-1">
                  <span className="text-xs font-semibold uppercase text-stone-500">{internalDraft ? 'Weight Used Kg' : 'Weight Sold Kg'}</span>
                  <input value={draft.weightSoldKg} onChange={(event) => updateDraft('weightSoldKg', event.target.value)} className="w-full rounded-md border border-stone-200 px-3 py-2 text-sm" />
                </label>
                <label className="space-y-1">
                  <span className="text-xs font-semibold uppercase text-stone-500">Rate Per Kg</span>
                  <input value={draft.ratePerKg} onChange={(event) => updateDraft('ratePerKg', event.target.value)} disabled={draft.saleType !== 'Charged Sale'} className="w-full rounded-md border border-stone-200 px-3 py-2 text-sm disabled:bg-stone-100 disabled:text-stone-500" />
                </label>
                <label className="space-y-1">
                  <span className="text-xs font-semibold uppercase text-stone-500">Courier/Packing</span>
                  <input disabled={internalDraft} value={internalDraft ? '0' : draft.courierPacking} onChange={(event) => updateDraft('courierPacking', event.target.value)} className="w-full rounded-md border border-stone-200 px-3 py-2 text-sm" />
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
              {internalDraft && <p className="mt-3 rounded-md bg-emerald-50 p-3 text-sm text-emerald-900">Internal use has zero charges. Enter the quantity and weight used; the balance remains available in stock. An internal-use record is created without a customer invoice or email.</p>}
              {!internalDraft && draft.saleType !== 'Charged Sale' && (
                <div className="mt-3 flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                  {draft.saleType === 'Complementary' ? <Sparkles className="mt-0.5 h-4 w-4 shrink-0" /> : <RotateCcw className="mt-0.5 h-4 w-4 shrink-0" />}
                  Produce value is set to zero for {draft.saleType.toLowerCase()}. Only courier/packing will be billed, and the invoice will be marked paid.
                </div>
              )}
              {overStock && (
                <div className="mt-3 flex items-start gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  This sale is more than the available stock. Reduce the pieces or weight before saving.
                </div>
              )}
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {!internalDraft && <>
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
              </>}
              <label className="space-y-1 md:col-span-2">
                <span className="text-xs font-semibold uppercase text-stone-500">Sale Notes</span>
                <textarea value={draft.notes} onChange={(event) => updateDraft('notes', event.target.value)} placeholder={internalDraft ? 'Purpose or details of use' : 'Courier note, delivery detail, invoice comment'} className="min-h-20 w-full rounded-md border border-stone-200 px-3 py-2 text-sm" />
              </label>
            </div>
          </fieldset>

          <section className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="flex items-center gap-2 text-lg font-bold text-emerald-950">
                <FileText className="h-5 w-5" />
                Sales and Usage Records
              </h2>
              <div className="flex flex-wrap gap-2">
                <label className="flex items-center gap-2 rounded-md border border-stone-200 px-3 py-2">
                  <Search className="h-4 w-4 text-stone-400" />
                  <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search sales" className="min-w-0 bg-transparent text-sm outline-none" />
                </label>
                <select aria-label="Filter by sale or use type" value={typeFilter} onChange={event => setTypeFilter(event.target.value)} className="rounded-md border border-stone-200 px-3 py-2 text-sm">
                  {['All', ...SALE_TYPES].map(type => <option key={type}>{type}</option>)}
                </select>
                <select value={paymentFilter} onChange={(event) => setPaymentFilter(event.target.value as typeof paymentFilter)} className="rounded-md border border-stone-200 px-3 py-2 text-sm">
                  {['All', 'Paid', 'Pending', 'Partial'].map((status) => <option key={status}>{status}</option>)}
                </select>
              </div>
            </div>
            {salesStatus && <p className="mt-3 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{salesStatus}</p>}
            <div className="mt-4 overflow-x-auto rounded-lg border border-stone-200">
              <table className="w-full min-w-[980px] text-left text-sm">
                <thead className="bg-stone-50 text-xs uppercase text-stone-500">
                  <tr>
                    {['Date', 'Buyer / Recipient', 'Type', 'Estate', 'Product', 'Sold', 'Rate', 'Courier', 'Total', 'Payment', 'Mode'].map((heading) => (
                      <th key={heading} className="px-3 py-3 font-bold">{heading}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {filteredSales.map((sale) => (
                    <tr key={sale.id} onClick={() => { setSelectedSaleId(sale.id); setPreviewMode('saved'); }} className="cursor-pointer bg-white hover:bg-emerald-50/60">
                      <td className="px-3 py-3">{dateLabel(sale.date)}</td>
                      <td className="px-3 py-3 font-semibold text-stone-900">{sale.recipientName || sale.buyerName}</td>
                      <td className="px-3 py-3">
                        <span className={`rounded-full px-2 py-1 text-xs font-bold ${
                          sale.saleType === 'Charged Sale' ? 'bg-stone-100 text-stone-700' : sale.saleType === 'Complementary' ? 'bg-blue-50 text-blue-800' : 'bg-purple-50 text-purple-800'
                        }`}>
                          {sale.saleType}
                        </span>
                      </td>
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
                          {isInternalUse(sale.saleType) ? 'No charge' : sale.paymentStatus}
                        </span>
                      </td>
                      <td className="px-3 py-3">{isInternalUse(sale.saleType) ? 'Internal use' : sale.paymentMode}</td>
                    </tr>
                  ))}
                  {!filteredSales.length && (
                    <tr>
                      <td colSpan={11} className="px-3 py-8 text-center text-sm text-stone-500">
                  No matching sales or usage records. Choose an available store item above to record a sale or use.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          {previewSale && (
            <section className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="flex items-center gap-2 text-lg font-bold text-emerald-950">
                  <Eye className="h-5 w-5" />
                  {previewIsInternal ? (previewIsDraft ? 'Draft Internal-use Record' : 'Internal-use Record') : (previewIsDraft ? 'Draft Invoice Preview' : 'Saved Invoice')}
                </h2>
                <div className="flex flex-wrap gap-2">
                  <button onClick={printInvoice} disabled={!previewSale || previewIsDraft} className="inline-flex items-center gap-2 rounded-md bg-emerald-800 px-3 py-2 text-sm font-semibold text-white transition hover:bg-emerald-900">
                    <Printer className="h-4 w-4" />
                    Print
                  </button>
                  <button onClick={markSelectedPaid} disabled={previewIsDraft || previewIsInternal || previewSale.paymentStatus === 'Paid'} className="inline-flex items-center gap-2 rounded-md border border-red-200 px-3 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:border-stone-200 disabled:text-stone-400">
                    <Lock className="h-4 w-4" />
                    Mark Paid
                  </button>
                  <button onClick={downloadInvoiceHtml} disabled={previewIsDraft} className="inline-flex items-center gap-2 rounded-md border border-emerald-200 px-3 py-2 text-sm font-semibold text-emerald-900 transition hover:bg-emerald-50">
                    <Download className="h-4 w-4" />
                    Download
                  </button>
                  {!previewIsInternal && <button onClick={() => setEmailDraftOpen((open) => !open)} className="inline-flex items-center gap-2 rounded-md border border-emerald-200 px-3 py-2 text-sm font-semibold text-emerald-900 transition hover:bg-emerald-50">
                    <Mail className="h-4 w-4" />
                    {emailDraftOpen ? 'Hide Email Draft' : 'Email Draft'}
                  </button>}
                </div>
              </div>

              {previewIsDraft && <p className="mt-3 rounded-md bg-amber-50 p-3 text-sm text-amber-900">{previewIsInternal ? 'Draft only — use Save Use to record this stock movement and enable printing or download.' : 'Draft only — updates as you complete New Sale. Save Sale to create the final invoice and enable printing or download.'}</p>}
              {!previewIsDraft && <button type="button" onClick={() => setPreviewMode('new')} className="mt-3 text-sm font-semibold text-emerald-800 underline">Preview new sale</button>}

              {emailDraftOpen && editableEmailDraft && (
                <div className="mt-4 rounded-lg border border-emerald-100 bg-emerald-50/70 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <h3 className="flex items-center gap-2 font-bold text-emerald-950">
                      <Mail className="h-4 w-4" />
                      Email Draft
                    </h3>
                    <button onClick={copyEmailDraft} className="inline-flex items-center gap-2 rounded-md border border-emerald-200 bg-white px-3 py-2 text-sm font-semibold text-emerald-900 transition hover:bg-emerald-50">
                      <Copy className="h-4 w-4" />
                      Copy Email
                    </button>
                  </div>
                  <div className="mt-3 grid gap-3 text-sm">
                    <label className="space-y-1">
                      <span className="text-xs font-semibold uppercase text-stone-500">To</span>
                      <input value={editableEmailDraft.to} onChange={(event) => updateEmailDraft('to', event.target.value)} className="w-full rounded-md border border-stone-200 bg-white px-3 py-2 text-sm" />
                    </label>
                    <label className="space-y-1">
                      <span className="text-xs font-semibold uppercase text-stone-500">Subject</span>
                      <input value={editableEmailDraft.subject} onChange={(event) => updateEmailDraft('subject', event.target.value)} className="w-full rounded-md border border-stone-200 bg-white px-3 py-2 text-sm" />
                    </label>
                    <label className="space-y-1">
                      <span className="text-xs font-semibold uppercase text-stone-500">{previewIsDraft ? 'Attachment (available after saving)' : 'Attachment Name'}</span>
                      <input value={editableEmailDraft.attachment} onChange={(event) => updateEmailDraft('attachment', event.target.value)} className="w-full rounded-md border border-stone-200 bg-white px-3 py-2 text-sm" />
                    </label>
                    <label className="space-y-1">
                      <span className="text-xs font-semibold uppercase text-stone-500">Message</span>
                      <textarea value={editableEmailDraft.body} onChange={(event) => updateEmailDraft('body', event.target.value)} className="min-h-44 w-full rounded-md border border-stone-200 bg-white px-3 py-2 text-sm" />
                    </label>
                  </div>
                </div>
              )}

              {!previewIsInternal && <p className="mt-3 text-xs text-stone-500">This prepares an email draft. Download the saved bill to attach it, or use Print to save a PDF.</p>}
              {previewIsInternal ? <div className="mt-4 rounded-lg border border-emerald-100 p-5 text-sm text-stone-700">
                <h3 className="font-bold text-emerald-950">MSP Coffee — Internal-use Record</h3>
                <dl className="mt-4 grid grid-cols-2 gap-3">
                  <dt>Record</dt><dd>{invoiceNumber(previewSale)}</dd>
                  <dt>Date</dt><dd>{dateLabel(previewSale.date)}</dd>
                  <dt>Use</dt><dd>{previewSale.saleType}</dd>
                  <dt>Produce Token</dt><dd>{previewSale.itemCode}</dd>
                  <dt>Product / Estate</dt><dd>{previewSale.product} / {previewSale.estate}</dd>
                  <dt>Recipient</dt><dd>{previewSale.recipientName || 'Enter recipient name'}</dd>
                  <dt>Quantity / Weight</dt><dd>{previewSale.piecesSold} / {kg(previewSale.weightSoldKg)} kg</dd>
                  <dt>Total charges</dt><dd>Rs.0 — internal use</dd>
                  <dt>Notes</dt><dd className="whitespace-pre-wrap">{previewSale.notes || '-'}</dd>
                </dl>
              </div> : <>
              <div className="mt-4 overflow-x-auto rounded-lg bg-stone-100 p-4">
                <div className="relative mx-auto min-h-[720px] w-[680px] overflow-hidden bg-white p-8 text-sm text-stone-950 shadow-sm">
                  {!previewIsDraft && previewSale.paymentStatus === 'Paid' && (
                    <div className="pointer-events-none absolute left-20 right-20 top-72 z-10 rotate-[-18deg] text-center text-8xl font-black tracking-[0.18em] text-red-700/80">
                      PAID
                    </div>
                  )}
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
                      <p>{dateLabel(previewSale.date)}</p>
                      <p className="mt-5 font-bold">{previewSale.buyerName}</p>
                      <p className="whitespace-pre-line">{previewSale.buyerAddress || 'Buyer address'}</p>
                      <p>{previewSale.buyerPhone ? `Cell : ${previewSale.buyerPhone}` : ''}</p>
                      {previewSale.buyerEmail && <p>Email: {previewSale.buyerEmail}</p>}
                    </div>
                    <div className="text-right leading-6">
                      <p><span className="font-bold">Bill No:</span> {invoiceNumber(previewSale)}</p>
                      <p className="mt-5 underline">{previewSale.dispatchMethod}</p>
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
                        <td className="border border-stone-700 px-2 py-2">{new Date(`${previewSale.date}T00:00:00`).toLocaleDateString('en-GB')}</td>
                        <td className="border border-stone-700 px-2 py-2">
                          {previewSale.product} ({previewSale.piecesSold} Nos)
                          <div className="text-xs">Token: {previewSale.itemCode || 'Not recorded'}</div>
                          <div className="text-xs">Estate: {previewSale.estate}</div>
                          {previewSale.saleType !== 'Charged Sale' && <div className="font-bold">{previewSale.saleType} - produce not charged</div>}
                        </td>
                        <td className="border border-stone-700 px-2 py-2">{kg(previewSale.weightSoldKg)} Kgs</td>
                        <td className="border border-stone-700 px-2 py-2">{previewSale.saleType === 'Charged Sale' ? `Rs.${previewSale.ratePerKg}/-` : 'No charge'}</td>
                        <td className="border border-stone-700 px-2 py-2">=</td>
                        <td className="border border-stone-700 px-2 py-2 text-right">{previewSale.produceAmount.toFixed(2)}</td>
                      </tr>
                      <tr>
                        <td className="border border-stone-700 px-2 py-2">{new Date(`${previewSale.date}T00:00:00`).toLocaleDateString('en-GB')}</td>
                        <td className="border border-stone-700 px-2 py-2">Courier and Packing Charges</td>
                        <td className="border border-stone-700 px-2 py-2"></td>
                        <td className="border border-stone-700 px-2 py-2"></td>
                        <td className="border border-stone-700 px-2 py-2">=</td>
                        <td className="border border-stone-700 px-2 py-2 text-right">{previewSale.courierPacking.toFixed(2)}</td>
                      </tr>
                      <tr>
                        <td className="border border-stone-700 px-2 py-2"></td>
                        <td className="border border-stone-700 px-2 py-2"></td>
                        <td className="border border-stone-700 px-2 py-2"></td>
                        <td className="border border-stone-700 px-2 py-2 font-bold">Total</td>
                        <td className="border border-stone-700 px-2 py-2"></td>
                        <td className="border border-stone-700 px-2 py-2 text-right font-bold">{previewSale.totalAmount.toFixed(2)}</td>
                      </tr>
                    </tbody>
                  </table>
                  <p className="mt-5">({amountInWords(previewSale.totalAmount)})</p>
                  <p className="mt-2 text-sm"><strong>Payment Status:</strong> {previewSale.paymentStatus}{previewSale.saleType !== 'Charged Sale' ? ` | ${previewSale.saleType}` : ''}</p>

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
              </>}

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
              Selected Record
            </h2>
            {selectedSale ? (
              <div className="mt-4 space-y-2 text-sm text-stone-700">
                <p className="text-base font-bold text-stone-900">{selectedSale.buyerName}</p>
                <p>{selectedSale.product} / {selectedSale.estate}</p>
                <p>{selectedSale.piecesSold} pcs / {kg(selectedSale.weightSoldKg)} kg at {money(selectedSale.ratePerKg)}/kg</p>
                <p className="font-bold text-emerald-950">Total: {money(selectedSale.totalAmount)}</p>
                <p>Type: {selectedSale.saleType}</p>
                <p>{isInternalUse(selectedSale.saleType) ? 'No charge — internal use' : `Payment: ${selectedSale.paymentStatus} by ${selectedSale.paymentMode}`}</p>
                <p>Dispatch: {selectedSale.dispatchMethod}</p>
                <p>Phone: {selectedSale.buyerPhone || '-'}</p>
                {!isInternalUse(selectedSale.saleType) && selectedSale.paymentStatus === 'Paid' && (
                  <p className="rounded-md border border-red-200 bg-red-50 p-2 font-semibold text-red-700">
                    Closed invoice. {userRole === 'admin' ? 'Admin can revise if needed.' : 'Only admin can revise it.'}
                  </p>
                )}
              </div>
            ) : (
              <p className="mt-4 text-sm text-stone-500">No sale selected.</p>
            )}
            <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              <div className="flex items-start gap-2">
                <Banknote className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{selectedSale && isInternalUse(selectedSale.saleType) ? 'Internal-use record available to view, print or download. No customer invoice or email is created.' : 'Bill preview, print, download, and email draft are ready for the selected sale.'}</span>
              </div>
            </div>
          </section>

          <section className="rounded-lg border border-emerald-100 bg-emerald-50 p-4 text-sm text-emerald-900">
            <div className="flex items-start gap-2">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
              <span>Saving a sale or internal use deducts only the recorded quantity and weight. The remaining balance stays available.</span>
            </div>
          </section>
        </aside>
      </section>
    </div>
  );
}
