'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Archive,
  Boxes,
  CheckCircle2,
  Download,
  Eye,
  Image as ImageIcon,
  Loader2,
  MapPin,
  PackageCheck,
  Pencil,
  Printer,
  Search,
  Snowflake,
  Tag,
} from 'lucide-react';
import { EmailReportButton } from '@/components/email/EmailReportButton';

type StoreItem = {
  id: string;
  sourceRecordId?: string;
  itemCode: string;
  receivedDate: string;
  estate: string;
  product: string;
  unit: string;
  quantity: number;
  weightKg: number;
  conditionGrade: string;
  storageLocation: string;
  photoPath?: string;
  photoUrl?: string;
  status: StoreStatus;
  notes: string;
  createdBy: string;
};

type StoreStatus = 'In Store' | 'Reserved' | 'Sold' | 'Internal Consumption' | 'Damaged' | 'Cold Storage';

const ESTATES = ['All', 'ME', 'SE', 'HFE', 'ORD', 'BVE'];
const PRODUCTS = ['All', 'Durian', 'Pepper', 'Cloves', 'Nutmeg', 'Other Produce'];
const STATUSES: Array<'All' | StoreStatus> = ['All', 'In Store', 'Cold Storage', 'Reserved', 'Sold', 'Internal Consumption', 'Damaged'];

const STATUS_STYLES: Record<StoreStatus, string> = {
  'In Store': 'bg-emerald-50 text-emerald-800',
  Reserved: 'bg-sky-50 text-sky-800',
  Sold: 'bg-stone-100 text-stone-700',
  'Internal Consumption': 'bg-amber-50 text-amber-800',
  Damaged: 'bg-red-50 text-red-700',
  'Cold Storage': 'bg-cyan-50 text-cyan-800',
};

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

function csvEscape(value: unknown) {
  return `"${String(value ?? '').replaceAll('"', '""')}"`;
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function itemCatalogueHtml(item: StoreItem) {
  const product = escapeHtml(item.product);
  const itemCode = escapeHtml(item.itemCode);
  const status = escapeHtml(item.status);
  const estate = escapeHtml(item.estate);
  const grade = escapeHtml(item.conditionGrade || 'Premium');
  const storage = escapeHtml(item.storageLocation || 'Estate store');
  const weight = `${kg(item.weightKg)} kg`;
  const quantity = `${item.quantity} ${item.unit}`;
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const logoSrc = `${origin}/msp-logo-new.png`;
  const fallbackDurianPhotoSrc = `${origin}/produce/durian-card-fruit.png`;
  const headerCloseSrc = `${origin}/produce/durian-header-close.png`;
  const headerTreeSrc = `${origin}/produce/durian-header-tree.png`;
  const photoSrc = item.photoUrl || (item.product.toLowerCase().includes('durian') ? fallbackDurianPhotoSrc : '');
  const photo = photoSrc
    ? `<img class="fruit-photo" src="${escapeHtml(photoSrc)}" alt="${itemCode}" />`
    : '<div class="photo-empty"><span>MSP</span><strong>ESTATE<br/>PRODUCE</strong></div>';
  const logo = `<img class="msp-logo" src="${logoSrc}" alt="MSP Coffee" />`;
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>${item.itemCode} Catalogue Card</title>
<style>
  body { margin:0; background:#f5efd9; color:#12372a; font-family:Arial,'Tamil Sangam MN','Tamil MN',sans-serif; }
  .sheet { max-width:1120px; margin:22px auto; padding:0 18px 24px; }
  .poster-grid { display:grid; grid-template-columns:1fr 1fr; gap:18px; align-items:start; }
  .poster { overflow:hidden; border-radius:16px; background:#fffbea; border:1px solid #d9c36a; box-shadow:0 18px 48px rgba(19,60,37,.18); }
  .poster-header { position:relative; overflow:hidden; min-height:190px; padding:24px 26px 18px; color:#fff; background:
    linear-gradient(95deg, rgba(5,69,30,.98) 0%, rgba(5,69,30,.95) 48%, rgba(5,69,30,.7) 74%, rgba(5,69,30,.35) 100%),
    url('${headerCloseSrc}') right center / auto 100% no-repeat,
    linear-gradient(135deg,#05451e 0%,#0b6b2f 62%,#f59e0b 160%); }
  .poster-header:before { content:''; position:absolute; z-index:0; inset:0; background:url('${headerTreeSrc}') right bottom / 58% auto no-repeat; opacity:.18; mix-blend-mode:screen; }
  .poster-header:after { content:''; position:absolute; z-index:0; inset:auto -60px -70px 48%; height:150px; border-radius:999px; background:rgba(255,246,169,.14); }
  .poster-header > * { position:relative; z-index:1; }
  .brand { font-size:13px; font-weight:900; letter-spacing:.12em; text-transform:uppercase; }
  h1 { margin:10px 0 0; max-width:72%; font-size:56px; line-height:.92; letter-spacing:0; text-shadow:0 3px 0 rgba(0,0,0,.14); }
  .tamil h1 { font-size:46px; line-height:1.04; }
  .subtitle { margin:12px 0 0; max-width:70%; color:#fff7a8; font-size:19px; font-weight:900; }
  .msp-logo { position:absolute; right:24px; top:22px; width:88px; height:118px; object-fit:contain; border-radius:8px; border:2px solid rgba(255,255,255,.7); background:#050505; padding:4px; box-shadow:0 12px 28px rgba(0,0,0,.22); }
  .body { padding:22px 24px 20px; display:grid; gap:18px; }
  .hero { display:grid; grid-template-columns:1.1fr .9fr; gap:18px; align-items:stretch; }
  .fruit-photo, .photo-empty { width:100%; aspect-ratio:1/1; object-fit:cover; border-radius:14px; background:linear-gradient(135deg,#e7f8d8,#fff3a6); display:grid; place-items:center; text-align:center; color:#047857; font-weight:900; border:1px solid #d6e8a8; }
  .photo-empty span { display:block; font-size:18px; letter-spacing:.18em; }
  .photo-empty strong { font-size:24px; line-height:1; }
  .quick { display:grid; gap:8px; }
  .quick-row { border-radius:12px; background:#fff; border:1px solid #efe3aa; padding:10px 12px; }
  .quick-row span { display:block; color:#7b6b3a; font-size:11px; font-weight:900; text-transform:uppercase; }
  .quick-row strong { display:block; margin-top:3px; color:#0f5132; font-size:17px; line-height:1.14; overflow-wrap:anywhere; }
  .badges { display:grid; grid-template-columns:1fr 1fr; gap:10px; }
  .badge { display:flex; gap:10px; align-items:center; border-radius:999px; background:#0b6b2f; color:#fff; padding:10px 12px; font-size:13px; font-weight:900; }
  .badge b { display:grid; place-items:center; width:30px; height:30px; border-radius:999px; background:#ffd54f; color:#06451f; flex:0 0 auto; }
  .writeup { border-radius:14px; background:#fff7d6; border:1px solid #ead58a; padding:14px 16px; color:#23412f; font-size:15px; line-height:1.45; font-weight:700; }
  .how { border-radius:14px; background:#ffffff; border:1px solid #eadfbd; padding:14px 16px; }
  .how h2 { margin:0 0 10px; color:#07552c; font-size:16px; }
  .steps { display:grid; gap:8px; }
  .step { display:grid; grid-template-columns:26px 1fr; gap:8px; color:#36503f; font-size:13px; line-height:1.35; }
  .step span { display:grid; place-items:center; height:26px; width:26px; border-radius:999px; background:#0b6b2f; color:white; font-weight:900; }
  .strip { padding:12px 24px; background:#07552c; color:#ffe66d; text-align:center; font-weight:900; letter-spacing:.06em; }
  .footer { display:flex; justify-content:space-between; gap:12px; padding:14px 24px 20px; color:#5e4d23; font-size:12px; font-weight:800; }
  @media print { body { background:white; } .sheet { margin:0; max-width:none; padding:0; } .poster { break-inside:avoid; box-shadow:none; } }
  @media (max-width:900px) { .poster-grid { grid-template-columns:1fr; } }
</style>
</head>
<body>
  <div class="sheet">
    <div class="poster-grid">
      <section class="poster english">
        <div class="poster-header">
          <div class="brand">MSP Coffee Estate Produce</div>
          <h1>Fresh Premium ${product}</h1>
          <p class="subtitle">Direct from estate stock - rich aroma, creamy texture, limited availability.</p>
          ${logo}
        </div>
        <div class="body">
          <div class="hero">
            ${photo}
            <div class="quick">
              <div class="quick-row"><span>Fruit / Lot No.</span><strong>${itemCode}</strong></div>
              <div class="quick-row"><span>Estate</span><strong>${estate}</strong></div>
              <div class="quick-row"><span>Weight</span><strong>${weight}</strong></div>
              <div class="quick-row"><span>Quantity</span><strong>${quantity}</strong></div>
              <div class="quick-row"><span>Grade</span><strong>${grade}</strong></div>
            </div>
          </div>
          <div class="badges">
            <div class="badge"><b>1</b>Fresh stock available</div>
            <div class="badge"><b>2</b>Retail orders welcome</div>
            <div class="badge"><b>3</b>Safe packing possible</div>
            <div class="badge"><b>4</b>${status}</div>
          </div>
          <div class="writeup">Selected from MSP estate produce and catalogued with a fruit number for easy reference. Share this card with the fruit number when confirming an order.</div>
          <div class="how">
            <h2>How to use</h2>
            <div class="steps">
              <div class="step"><span>1</span>Open only when ready to consume.</div>
              <div class="step"><span>2</span>Serve chilled or at room temperature based on ripeness.</div>
              <div class="step"><span>3</span>Use the pulp fresh, in smoothies, desserts, ice cream, or cakes.</div>
            </div>
          </div>
        </div>
        <div class="strip">LIMITED STOCK - BOOK WITH FRUIT NUMBER</div>
        <div class="footer"><span>Received: ${dateLabel(item.receivedDate)}</span><span>Storage: ${storage}</span></div>
      </section>

      <section class="poster tamil">
        <div class="poster-header">
          <div class="brand">MSP Coffee Estate Produce</div>
          <h1>பிரீமியம் டூரியன் பழம்</h1>
          <p class="subtitle">எஸ்டேட்டிலிருந்து நேரடி பழம் - மணமும் சுவையும் நிறைந்தது.</p>
          ${logo}
        </div>
        <div class="body">
          <div class="hero">
            ${photo}
            <div class="quick">
              <div class="quick-row"><span>பழ எண்</span><strong>${itemCode}</strong></div>
              <div class="quick-row"><span>எஸ்டேட்</span><strong>${estate}</strong></div>
              <div class="quick-row"><span>எடை</span><strong>${weight}</strong></div>
              <div class="quick-row"><span>அளவு</span><strong>${quantity}</strong></div>
              <div class="quick-row"><span>தரம்</span><strong>${grade}</strong></div>
            </div>
          </div>
          <div class="badges">
            <div class="badge"><b>1</b>புதிய பழம் கிடைக்கும்</div>
            <div class="badge"><b>2</b>சில்லறை ஆர்டர்கள் வரவேற்கப்படும்</div>
            <div class="badge"><b>3</b>பாதுகாப்பான பேக்கிங்</div>
            <div class="badge"><b>4</b>${status}</div>
          </div>
          <div class="writeup">MSP எஸ்டேட் உற்பத்தியில் இருந்து தேர்வு செய்யப்பட்ட பழம். ஆர்டர் உறுதி செய்யும்போது இந்த பழ எண்ணை குறிப்பிடவும்.</div>
          <div class="how">
            <h2>பயன்படுத்தும் வழி</h2>
            <div class="steps">
              <div class="step"><span>1</span>சாப்பிட தயாராக இருக்கும் போது மட்டும் திறக்கவும்.</div>
              <div class="step"><span>2</span>பழுத்த நிலைக்கு ஏற்ப குளிர்ச்சியாக அல்லது சாதாரண வெப்பத்தில் பரிமாறலாம்.</div>
              <div class="step"><span>3</span>பழச்சாறு, இனிப்பு, ஐஸ்கிரீம் அல்லது கேக் தயாரிக்க பயன்படுத்தலாம்.</div>
            </div>
          </div>
        </div>
        <div class="strip">குறைந்த ஸ்டாக் - பழ எண்ணுடன் முன்பதிவு செய்யவும்</div>
        <div class="footer"><span>வரவு தேதி: ${dateLabel(item.receivedDate)}</span><span>சேமிப்பு: ${storage}</span></div>
      </section>
    </div>
  </div>
</body>
</html>`;
}

function catalogueEmailPayload(item: StoreItem) {
  return {
    type: 'custom_report' as const,
    reportTitle: `${item.product} Catalogue - ${item.itemCode}`,
    subject: `${item.product} available from MSP Coffee - ${item.itemCode}`,
    sourcePath: '/employee-portal/ramesh/stores/produce-store',
    attachmentName: `${item.itemCode.toLowerCase()}-catalogue.html`,
    data: {
      summary: [
        { label: 'Fruit / Lot No.', value: item.itemCode },
        { label: 'Product', value: item.product, detail: item.status },
        { label: 'Estate', value: item.estate },
        { label: 'Weight', value: `${kg(item.weightKg)} kg`, detail: `${item.quantity} ${item.unit.toLowerCase()}` },
        { label: 'Grade', value: item.conditionGrade || 'Good' },
        { label: 'Storage', value: item.storageLocation || 'Store' },
      ],
      sections: [
        {
          title: 'Catalogue Note',
          rows: [
            { label: 'Availability', value: item.status === 'Sold' ? 'Sold' : 'Available from current estate stock' },
            { label: 'Reference', value: item.itemCode, detail: 'Use this number for confirmation and dispatch.' },
            { label: 'English Write-up', value: 'Fresh premium durian direct from estate stock with rich aroma and creamy texture.' },
            { label: 'Tamil Write-up', value: 'எஸ்டேட்டிலிருந்து நேரடி பிரீமியம் டூரியன் பழம் - மணமும் சுவையும் நிறைந்தது.' },
          ],
        },
      ],
    },
  };
}

export default function ProduceStorePage() {
  const [items, setItems] = useState<StoreItem[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [loading, setLoading] = useState(true);
  const [statusMessage, setStatusMessage] = useState('');
  const [filters, setFilters] = useState({ estate: 'All', product: 'All', status: 'All', search: '' });
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState({ status: 'In Store' as StoreStatus, storageLocation: '', conditionGrade: '', notes: '', movementNotes: '' });

  const loadItems = useCallback(async () => {
    setLoading(true);
    setStatusMessage('');
    try {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value && value !== 'All') params.set(key, value);
      });
      const response = await fetch(`/api/estate-produce/store?${params.toString()}`);
      const body = await response.json().catch(() => ({})) as { items?: StoreItem[]; error?: string };
      if (!response.ok) throw new Error(body.error || 'Could not load produce store');
      const nextItems = body.items ?? [];
      setItems(nextItems);
      setSelectedId((current) => nextItems.some((item) => item.id === current) ? current : nextItems[0]?.id ?? '');
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : 'Could not load produce store');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  const selected = items.find((item) => item.id === selectedId) ?? items[0] ?? null;

  useEffect(() => {
    if (!selected) return;
    setDraft({
      status: selected.status,
      storageLocation: selected.storageLocation || '',
      conditionGrade: selected.conditionGrade || '',
      notes: selected.notes || '',
      movementNotes: '',
    });
    setEditing(false);
  }, [selected]);

  const totals = useMemo(() => {
    return items.reduce(
      (acc, item) => {
        acc.count += 1;
        acc.weight += item.weightKg;
        if (item.status === 'In Store' || item.status === 'Cold Storage') acc.available += item.weightKg;
        if (item.status === 'Cold Storage') acc.cold += item.weightKg;
        if (item.status === 'Reserved') acc.reserved += item.weightKg;
        return acc;
      },
      { count: 0, weight: 0, available: 0, cold: 0, reserved: 0 },
    );
  }, [items]);

  const exportCsv = () => {
    const headers = ['Item code', 'Received date', 'Estate', 'Product', 'Status', 'Quantity', 'Unit', 'Weight kg', 'Condition/grade', 'Storage location', 'Notes'];
    const rows = items.map((item) => [
      item.itemCode,
      item.receivedDate,
      item.estate,
      item.product,
      item.status,
      item.quantity,
      item.unit,
      item.weightKg,
      item.conditionGrade,
      item.storageLocation,
      item.notes,
    ]);
    const csv = [headers, ...rows].map((row) => row.map(csvEscape).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'produce-store.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  const saveSelected = async () => {
    if (!selected) return;
    setSaving(true);
    setStatusMessage('');
    try {
      const response = await fetch(`/api/estate-produce/store/${selected.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(draft),
      });
      const body = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) throw new Error(body.error || 'Could not update store item');
      await loadItems();
      setEditing(false);
      setStatusMessage('Store item updated.');
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : 'Could not update store item');
    } finally {
      setSaving(false);
    }
  };

  const printCatalogue = () => {
    if (!selected) return;
    const printWindow = window.open('', '_blank', 'noopener,noreferrer,width=860,height=940');
    if (!printWindow) return;
    printWindow.document.write(itemCatalogueHtml(selected));
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  };

  const downloadCatalogue = () => {
    if (!selected) return;
    const url = URL.createObjectURL(new Blob([itemCatalogueHtml(selected)], { type: 'text/html;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `${selected.itemCode.toLowerCase()}-catalogue.html`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-5">
      <section className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-emerald-800">Employee Portal / Ramesh / Stores / Produce Store</p>
          <h1 className="mt-2 text-3xl font-bold text-emerald-950">Produce Store</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/employee-portal/ramesh/stores/estate-produce" className="inline-flex items-center gap-2 rounded-md border border-emerald-200 bg-white px-4 py-2 text-sm font-semibold text-emerald-900 shadow-sm transition hover:bg-emerald-50">
            <Archive className="h-4 w-4" />
            Estate Produce
          </Link>
          <button onClick={exportCsv} className="inline-flex items-center gap-2 rounded-md border border-emerald-200 bg-white px-4 py-2 text-sm font-semibold text-emerald-900 shadow-sm transition hover:bg-emerald-50">
            <Download className="h-4 w-4" />
            Export
          </button>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {[
          ['Store Items', totals.count.toLocaleString('en-IN'), 'fruit numbers and bulk lots', Boxes],
          ['Total Weight', `${kg(totals.weight)} kg`, 'all statuses', PackageCheck],
          ['Available', `${kg(totals.available)} kg`, 'store + cold storage', CheckCircle2],
          ['Cold Storage', `${kg(totals.cold)} kg`, 'chilled stock', Snowflake],
          ['Reserved', `${kg(totals.reserved)} kg`, 'held for sale', Tag],
        ].map(([label, value, sub, Icon]) => (
          <div key={label as string} className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs font-semibold uppercase text-stone-500">{label as string}</p>
              <Icon className="h-4 w-4 text-emerald-700" />
            </div>
            <p className="mt-2 text-2xl font-bold text-emerald-950">{value as string}</p>
            <p className="text-sm text-stone-500">{sub as string}</p>
          </div>
        ))}
      </section>

      {(loading || statusMessage) && (
        <div className={`rounded-md border px-3 py-2 text-sm ${
          statusMessage && !statusMessage.includes('updated') ? 'border-red-200 bg-red-50 text-red-800' : 'border-emerald-100 bg-emerald-50 text-emerald-900'
        }`}>
          {loading ? 'Loading produce store...' : statusMessage}
        </div>
      )}

      <section className="grid gap-5 xl:grid-cols-[1fr_360px]">
        <main className="space-y-4">
          <div className="grid gap-3 rounded-lg border border-stone-200 bg-white p-3 md:grid-cols-[120px_150px_170px_1fr]">
            <select value={filters.estate} onChange={(event) => setFilters((current) => ({ ...current, estate: event.target.value }))} className="rounded-md border border-stone-200 px-3 py-2 text-sm">
              {ESTATES.map((estate) => <option key={estate}>{estate}</option>)}
            </select>
            <select value={filters.product} onChange={(event) => setFilters((current) => ({ ...current, product: event.target.value }))} className="rounded-md border border-stone-200 px-3 py-2 text-sm">
              {PRODUCTS.map((product) => <option key={product}>{product}</option>)}
            </select>
            <select value={filters.status} onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))} className="rounded-md border border-stone-200 px-3 py-2 text-sm">
              {STATUSES.map((status) => <option key={status}>{status}</option>)}
            </select>
            <label className="flex items-center gap-2 rounded-md border border-stone-200 px-3 py-2">
              <Search className="h-4 w-4 text-stone-400" />
              <input value={filters.search} onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))} placeholder="Search code, grade, location" className="min-w-0 flex-1 bg-transparent text-sm outline-none" />
            </label>
          </div>

          <div className="overflow-hidden rounded-lg border border-stone-200 bg-white">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[960px] text-left text-sm">
                <thead className="bg-stone-50 text-xs uppercase text-stone-500">
                  <tr>
                    {['Fruit / Lot No.', 'Received', 'Estate', 'Product', 'Status', 'Qty', 'Weight', 'Grade', 'Location', 'Photo'].map((heading) => (
                      <th key={heading} className="px-3 py-3 font-bold">{heading}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {items.map((item) => (
                    <tr key={item.id} onClick={() => setSelectedId(item.id)} className="cursor-pointer bg-white hover:bg-emerald-50/60">
                      <td className="px-3 py-3 font-bold text-emerald-950">{item.itemCode}</td>
                      <td className="px-3 py-3">{dateLabel(item.receivedDate)}</td>
                      <td className="px-3 py-3 font-semibold text-emerald-900">{item.estate}</td>
                      <td className="px-3 py-3">{item.product}</td>
                      <td className="px-3 py-3"><span className={`rounded-full px-2 py-1 text-xs font-bold ${STATUS_STYLES[item.status]}`}>{item.status}</span></td>
                      <td className="px-3 py-3">{item.quantity} {item.unit.toLowerCase()}</td>
                      <td className="px-3 py-3">{kg(item.weightKg)} kg</td>
                      <td className="px-3 py-3">{item.conditionGrade || '-'}</td>
                      <td className="px-3 py-3">{item.storageLocation || '-'}</td>
                      <td className="px-3 py-3">
                        {item.photoUrl ? (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-800"><Eye className="h-4 w-4" />Photo</span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-stone-400"><ImageIcon className="h-4 w-4" />No photo</span>
                        )}
                      </td>
                    </tr>
                  ))}
                  {!loading && items.length === 0 && (
                    <tr>
                      <td colSpan={10} className="px-3 py-8 text-center text-sm text-stone-500">
                        No store items yet. Open Estate Produce and create store items from a saved intake record.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </main>

        <aside className="space-y-4">
          <section className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <h2 className="font-bold text-emerald-950">Selected Store Item</h2>
              {selected && (
                <button onClick={() => setEditing((open) => !open)} className="inline-flex items-center gap-1 rounded-md border border-emerald-200 px-2 py-1 text-xs font-semibold text-emerald-900">
                  <Pencil className="h-3.5 w-3.5" />
                  Edit
                </button>
              )}
            </div>

            {!selected ? (
              <p className="mt-4 text-sm text-stone-500">Select a fruit number or bulk lot.</p>
            ) : (
              <>
                <div className="mt-4 flex gap-3">
                  <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-md bg-emerald-50 text-emerald-800">
                    {selected.photoUrl ? <img alt="" src={selected.photoUrl} className="h-full w-full rounded-md object-cover" /> : <ImageIcon className="h-8 w-8" />}
                  </div>
                  <div className="min-w-0 text-sm">
                    <p className="font-bold text-stone-900">{selected.itemCode}</p>
                    <p className="text-stone-500">{selected.product} / {selected.estate}</p>
                    <p className="mt-2">{dateLabel(selected.receivedDate)}</p>
                    <p>{selected.quantity} {selected.unit.toLowerCase()} / {kg(selected.weightKg)} kg</p>
                  </div>
                </div>

                <div className="mt-4 space-y-2 text-sm text-stone-600">
                  <p><span className="font-semibold text-stone-900">Status:</span> <span className={`rounded-full px-2 py-1 text-xs font-bold ${STATUS_STYLES[selected.status]}`}>{selected.status}</span></p>
                  <p><span className="font-semibold text-stone-900">Condition/Grade:</span> {selected.conditionGrade || '-'}</p>
                  <p><span className="font-semibold text-stone-900">Storage:</span> {selected.storageLocation || '-'}</p>
                  <p><span className="font-semibold text-stone-900">Created by:</span> {selected.createdBy}</p>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <button onClick={printCatalogue} className="inline-flex items-center gap-2 rounded-md border border-emerald-200 px-3 py-2 text-sm font-semibold text-emerald-900 transition hover:bg-emerald-50">
                    <Printer className="h-4 w-4" />
                    Print Card
                  </button>
                  <button onClick={downloadCatalogue} className="inline-flex items-center gap-2 rounded-md border border-emerald-200 px-3 py-2 text-sm font-semibold text-emerald-900 transition hover:bg-emerald-50">
                    <Download className="h-4 w-4" />
                    Download
                  </button>
                  <EmailReportButton payload={catalogueEmailPayload(selected)} label="Email Catalogue" />
                </div>

                {editing && (
                  <div className="mt-4 space-y-3 rounded-lg border border-emerald-100 bg-emerald-50/60 p-3">
                    <label className="space-y-1">
                      <span className="text-xs font-semibold uppercase text-stone-500">Status</span>
                      <select value={draft.status} onChange={(event) => setDraft((current) => ({ ...current, status: event.target.value as StoreStatus }))} className="w-full rounded-md border border-stone-200 px-3 py-2 text-sm">
                        {STATUSES.filter((status): status is StoreStatus => status !== 'All').map((status) => <option key={status}>{status}</option>)}
                      </select>
                    </label>
                    <label className="space-y-1">
                      <span className="text-xs font-semibold uppercase text-stone-500">Storage Location</span>
                      <input value={draft.storageLocation} onChange={(event) => setDraft((current) => ({ ...current, storageLocation: event.target.value }))} className="w-full rounded-md border border-stone-200 px-3 py-2 text-sm" placeholder="Cold room, store rack, box number" />
                    </label>
                    <label className="space-y-1">
                      <span className="text-xs font-semibold uppercase text-stone-500">Condition / Grade</span>
                      <input value={draft.conditionGrade} onChange={(event) => setDraft((current) => ({ ...current, conditionGrade: event.target.value }))} className="w-full rounded-md border border-stone-200 px-3 py-2 text-sm" placeholder="Premium, good, ripe, damaged" />
                    </label>
                    <label className="space-y-1">
                      <span className="text-xs font-semibold uppercase text-stone-500">Movement Note</span>
                      <input value={draft.movementNotes} onChange={(event) => setDraft((current) => ({ ...current, movementNotes: event.target.value }))} className="w-full rounded-md border border-stone-200 px-3 py-2 text-sm" placeholder="Moved to cold storage" />
                    </label>
                    <button disabled={saving} onClick={saveSelected} className="inline-flex items-center gap-2 rounded-md bg-emerald-800 px-3 py-2 text-sm font-semibold text-white disabled:opacity-60">
                      {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                      Save
                    </button>
                  </div>
                )}
              </>
            )}
          </section>

          <section className="rounded-lg border border-emerald-100 bg-emerald-50 p-4 text-sm text-emerald-900">
            <div className="flex items-start gap-2">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0" />
              <span>Durian is tracked fruit-by-fruit. Bulk produce remains as one lot with available quantity and weight.</span>
            </div>
          </section>
        </aside>
      </section>
    </div>
  );
}
