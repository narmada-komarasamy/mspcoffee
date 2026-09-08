'use client';

import { ChangeEvent, ClipboardEvent, useMemo, useState } from 'react';
import {
  AlertTriangle,
  BarChart3,
  CalendarDays,
  Camera,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Image as ImageIcon,
  Plus,
  Search,
  Upload,
} from 'lucide-react';

type ProduceRecord = {
  id: string;
  date: string;
  time: string;
  estate: string;
  product: string;
  unit: string;
  qty: number;
  weightKg: number;
  previousQty: number;
  previousWeightKg: number;
  damageQty: number;
  damageWeightKg: number;
  damageNotes: string;
  source: 'Manual' | 'WhatsApp Paste';
  sourceMessage?: string;
  photoUrl?: string;
  location?: string;
  notes: string;
  followUp?: string;
  enteredBy: string;
};

type Draft = {
  date: string;
  time: string;
  estate: string;
  product: string;
  unit: string;
  qty: string;
  weightKg: string;
  previousQty: string;
  previousWeightKg: string;
  damageQty: string;
  damageWeightKg: string;
  damageNotes: string;
  location: string;
  notes: string;
  addFollowUp: boolean;
  followUp: string;
};

const ESTATES = ['ME', 'SE', 'HFE', 'ORD', 'BVE'];
const PRODUCTS = ['Durian', 'Pepper', 'Cloves', 'Nutmeg', 'Other Produce'];
const UNITS = ['Pieces', 'Kg', 'Boxes', 'Bunches', 'Bags', 'Other'];
const FOLLOW_UPS = ['Pickup needed', 'Sale follow-up', 'Payment follow-up', 'Damage inspection', 'Estimate/quotation due'];

const sampleRecords: ProduceRecord[] = [
  {
    id: 'durian-me-2026-09-07',
    date: '2026-09-07',
    time: '07:57',
    estate: 'ME',
    product: 'Durian',
    unit: 'Pieces',
    qty: 20,
    weightKg: 17.5,
    previousQty: 129,
    previousWeightKg: 112.2,
    damageQty: 4,
    damageWeightKg: 0,
    damageNotes: 'Little damage',
    source: 'WhatsApp Paste',
    sourceMessage: `Dhanasingh ME
Good Morning Sir
Durian Fruits
Today 20 Pieces
Weight 17.500 kgs

Previous 129 Pieces
Weight 112.200 kgs

Todate 149 Pieces
Weight 129.700 kgs

Damage 4 Piece
(Little Damage)`,
    location: 'Solur, Tamil Nadu, India',
    notes: 'Incoming durian report from Dhanasingh ME.',
    followUp: 'Pickup needed',
    enteredBy: 'Admin',
  },
  {
    id: 'pepper-me-2026-09-07',
    date: '2026-09-07',
    time: '09:10',
    estate: 'ME',
    product: 'Pepper',
    unit: 'Kg',
    qty: 12,
    weightKg: 12,
    previousQty: 86,
    previousWeightKg: 86,
    damageQty: 1,
    damageWeightKg: 0.2,
    damageNotes: 'Moisture',
    source: 'Manual',
    notes: 'Moisture check needed before sale.',
    followUp: 'Damage inspection',
    enteredBy: 'Admin',
  },
  {
    id: 'cloves-se-2026-09-06',
    date: '2026-09-06',
    time: '11:20',
    estate: 'SE',
    product: 'Cloves',
    unit: 'Kg',
    qty: 8,
    weightKg: 8,
    previousQty: 42,
    previousWeightKg: 42,
    damageQty: 0,
    damageWeightKg: 0,
    damageNotes: '',
    source: 'Manual',
    notes: 'Good quality.',
    enteredBy: 'Admin',
  },
  {
    id: 'nutmeg-hfe-2026-09-06',
    date: '2026-09-06',
    time: '15:00',
    estate: 'HFE',
    product: 'Nutmeg',
    unit: 'Kg',
    qty: 6,
    weightKg: 6.2,
    previousQty: 32,
    previousWeightKg: 32,
    damageQty: 0,
    damageWeightKg: 0,
    damageNotes: '',
    source: 'Manual',
    notes: 'Dry and clean.',
    enteredBy: 'Admin',
  },
  {
    id: 'pepper-ord-2025-08-22',
    date: '2025-08-22',
    time: '10:45',
    estate: 'ORD',
    product: 'Pepper',
    unit: 'Kg',
    qty: 10,
    weightKg: 10.3,
    previousQty: 75,
    previousWeightKg: 75,
    damageQty: 0,
    damageWeightKg: 0,
    damageNotes: '',
    source: 'Manual',
    notes: 'Packed.',
    enteredBy: 'Admin',
  },
  {
    id: 'cloves-bve-2024-07-18',
    date: '2024-07-18',
    time: '08:30',
    estate: 'BVE',
    product: 'Cloves',
    unit: 'Kg',
    qty: 5,
    weightKg: 5.1,
    previousQty: 28,
    previousWeightKg: 28,
    damageQty: 0,
    damageWeightKg: 0,
    damageNotes: '',
    source: 'Manual',
    notes: 'Ready for sale.',
    enteredBy: 'Admin',
  },
];

function blankDraft(): Draft {
  return {
    date: '2026-09-07',
    time: '07:57',
    estate: 'ME',
    product: 'Durian',
    unit: 'Pieces',
    qty: '20',
    weightKg: '17.500',
    previousQty: '129',
    previousWeightKg: '112.200',
    damageQty: '4',
    damageWeightKg: '',
    damageNotes: 'Little damage',
    location: 'Solur, Tamil Nadu, India',
    notes: '',
    addFollowUp: true,
    followUp: 'Pickup needed',
  };
}

function formatKg(value: number) {
  return value.toLocaleString('en-IN', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
}

function parseNumber(value: string) {
  return Number(value.replace(/,/g, '')) || 0;
}

function toDateLabel(value: string) {
  return new Date(`${value}T00:00:00`).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function parseWhatsAppMessage(message: string, current: Draft): Draft {
  if (!message.trim()) return current;

  const clean = message.replace(/\s+/g, ' ');
  const lower = clean.toLowerCase();
  const product = PRODUCTS.find((entry) => lower.includes(entry.toLowerCase())) ?? current.product;
  const estate = ESTATES.find((entry) => new RegExp(`\\b${entry}\\b`, 'i').test(clean)) ?? current.estate;
  const pieces = clean.match(/today\s+(\d+(?:\.\d+)?)/i)?.[1] ?? clean.match(/(\d+(?:\.\d+)?)\s*pieces?/i)?.[1];
  const weights = [...clean.matchAll(/weight\s+(\d+(?:\.\d+)?)/gi)].map((match) => match[1]);
  const previousQty = clean.match(/previous\s+(\d+(?:\.\d+)?)/i)?.[1];
  const toDateQty = clean.match(/todate\s+(\d+(?:\.\d+)?)/i)?.[1] ?? clean.match(/to date\s+(\d+(?:\.\d+)?)/i)?.[1];
  const toDateWeight = weights[2];
  const damageQty = clean.match(/damage\s+(\d+(?:\.\d+)?)/i)?.[1];
  const damageNotes = message.match(/\(([^)]+)\)/)?.[1] ?? current.damageNotes;
  const dateParts = clean.match(/\b(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})\b/);
  const timeParts = clean.match(/\b(\d{1,2}):(\d{2})\s*(AM|PM)?\b/i);
  const location = clean.match(/\b([A-Z][A-Za-z\s]+,\s*Tamil Nadu(?:,\s*India)?)\b/)?.[1];

  let date = current.date;
  if (dateParts) {
    const [, day, month, year] = dateParts;
    date = `${year.length === 2 ? `20${year}` : year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }

  let time = current.time;
  if (timeParts) {
    const [, hour, minute, meridian] = timeParts;
    let hourNumber = Number(hour);
    if (meridian?.toLowerCase() === 'pm' && hourNumber < 12) hourNumber += 12;
    if (meridian?.toLowerCase() === 'am' && hourNumber === 12) hourNumber = 0;
    time = `${String(hourNumber).padStart(2, '0')}:${minute}`;
  }

  const runningTotalNote = [
    toDateQty ? `Message to-date quantity: ${toDateQty}` : '',
    toDateWeight ? `Message to-date weight: ${toDateWeight} kg` : '',
  ].filter(Boolean).join(' / ');

  return {
    ...current,
    date,
    time,
    estate,
    product,
    unit: pieces ? 'Pieces' : current.unit,
    qty: pieces ?? current.qty,
    weightKg: weights[0] ?? current.weightKg,
    previousQty: previousQty ?? current.previousQty,
    previousWeightKg: weights[1] ?? current.previousWeightKg,
    damageQty: damageQty ?? current.damageQty,
    damageNotes,
    location: location ?? current.location,
    notes: runningTotalNote || current.notes,
  };
}

export default function EstateProduceTrackerPage() {
  const [activeTab, setActiveTab] = useState<'records' | 'add' | 'comparisons' | 'photos'>('records');
  const [records, setRecords] = useState<ProduceRecord[]>(sampleRecords);
  const [selectedId, setSelectedId] = useState(sampleRecords[0].id);
  const [draft, setDraft] = useState<Draft>(blankDraft());
  const [entryMode, setEntryMode] = useState<'manual' | 'whatsapp'>('whatsapp');
  const [whatsAppMessage, setWhatsAppMessage] = useState('');
  const [pasteStatus, setPasteStatus] = useState('Paste a WhatsApp message to attach it to the next saved record.');
  const [photoPreview, setPhotoPreview] = useState<string>('');
  const [filters, setFilters] = useState({ year: '2026', estate: 'All', product: 'All', unit: 'All', search: '' });

  const filteredRecords = useMemo(() => {
    return records.filter((record) => {
      const matchesYear = filters.year === 'All' || record.date.startsWith(filters.year);
      const matchesEstate = filters.estate === 'All' || record.estate === filters.estate;
      const matchesProduct = filters.product === 'All' || record.product === filters.product;
      const matchesUnit = filters.unit === 'All' || record.unit === filters.unit;
      const searchText = `${record.estate} ${record.product} ${record.notes} ${record.damageNotes} ${record.location ?? ''}`.toLowerCase();
      const matchesSearch = filters.search.trim() ? searchText.includes(filters.search.trim().toLowerCase()) : true;
      return matchesYear && matchesEstate && matchesProduct && matchesUnit && matchesSearch;
    });
  }, [records, filters]);

  const selected = records.find((record) => record.id === selectedId) ?? records[0];

  const totals = useMemo(() => {
    return filteredRecords.reduce(
      (acc, record) => ({
        qty: acc.qty + record.qty,
        weight: acc.weight + record.weightKg,
        previousQty: acc.previousQty + record.previousQty,
        previousWeight: acc.previousWeight + record.previousWeightKg,
        damageQty: acc.damageQty + record.damageQty,
        damageWeight: acc.damageWeight + record.damageWeightKg,
      }),
      { qty: 0, weight: 0, previousQty: 0, previousWeight: 0, damageQty: 0, damageWeight: 0 },
    );
  }, [filteredRecords]);

  const chartByYear = useMemo(() => {
    return ['2024', '2025', '2026'].map((year) => ({
      year,
      weight: records
        .filter((record) => record.date.startsWith(year) && record.product === 'Durian')
        .reduce((sum, record) => sum + record.weightKg + record.previousWeightKg, 0),
    }));
  }, [records]);

  const estateComparison = useMemo(() => {
    return ESTATES.map((estate) => ({
      estate,
      weight: records
        .filter((record) => record.estate === estate && record.date.startsWith(filters.year === 'All' ? '2026' : filters.year))
        .reduce((sum, record) => sum + record.weightKg + record.previousWeightKg, 0),
    }));
  }, [records, filters.year]);

  const maxYearWeight = Math.max(...chartByYear.map((entry) => entry.weight), 1);

  const updateDraft = (key: keyof Draft, value: string | boolean) => {
    setDraft((current) => ({ ...current, [key]: value }));
  };

  const extractWhatsAppFields = (message: string) => {
    const trimmedMessage = message.trim();
    if (!trimmedMessage) {
      setPasteStatus('Paste a WhatsApp message to attach it to the next saved record.');
      return;
    }
    setDraft((current) => parseWhatsAppMessage(trimmedMessage, current));
    setEntryMode('whatsapp');
    setActiveTab('add');
    setPasteStatus('WhatsApp message attached and fields extracted. Review the form before saving.');
  };

  const handleMessageParse = () => {
    extractWhatsAppFields(whatsAppMessage);
  };

  const handleWhatsAppChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    const nextMessage = event.target.value;
    setWhatsAppMessage(nextMessage);
    extractWhatsAppFields(nextMessage);
  };

  const handleWhatsAppPaste = (event: ClipboardEvent<HTMLTextAreaElement>) => {
    const pastedText = event.clipboardData.getData('text');
    const pastedImage = Array.from(event.clipboardData.files).find((file) => file.type.startsWith('image/'));

    if (pastedImage) {
      setPhotoPreview(URL.createObjectURL(pastedImage));
      setPasteStatus('Photo attached. Paste the WhatsApp text also, then review before saving.');
    }

    if (pastedText.trim()) {
      const nextMessage = `${whatsAppMessage}${pastedText}`;
      setWhatsAppMessage(nextMessage);
      extractWhatsAppFields(nextMessage);
      event.preventDefault();
    }
  };

  const handlePhoto = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setPhotoPreview(URL.createObjectURL(file));
  };

  const addRecord = () => {
    const next: ProduceRecord = {
      id: `${draft.product.toLowerCase()}-${draft.estate.toLowerCase()}-${Date.now()}`,
      date: draft.date,
      time: draft.time,
      estate: draft.estate,
      product: draft.product,
      unit: draft.unit,
      qty: parseNumber(draft.qty),
      weightKg: parseNumber(draft.weightKg),
      previousQty: parseNumber(draft.previousQty),
      previousWeightKg: parseNumber(draft.previousWeightKg),
      damageQty: parseNumber(draft.damageQty),
      damageWeightKg: parseNumber(draft.damageWeightKg),
      damageNotes: draft.damageNotes,
      source: entryMode === 'whatsapp' ? 'WhatsApp Paste' : 'Manual',
      sourceMessage: entryMode === 'whatsapp' ? whatsAppMessage.trim() || undefined : undefined,
      photoUrl: photoPreview || undefined,
      location: draft.location,
      notes: draft.notes,
      followUp: draft.addFollowUp ? draft.followUp : undefined,
      enteredBy: 'Admin',
    };
    setRecords((current) => [next, ...current]);
    setSelectedId(next.id);
    setActiveTab('records');
    setWhatsAppMessage('');
    setPasteStatus('Entry saved. Paste the next WhatsApp message when ready.');
    setPhotoPreview('');
  };

  const exportCsv = () => {
    const headers = ['Date', 'Estate', 'Product', 'Qty', 'Unit', 'Weight kg', 'Previous qty', 'Previous weight kg', 'Damage qty', 'Damage weight kg', 'Follow-up', 'Notes'];
    const rows = filteredRecords.map((record) => [
      record.date,
      record.estate,
      record.product,
      record.qty,
      record.unit,
      record.weightKg,
      record.previousQty,
      record.previousWeightKg,
      record.damageQty,
      record.damageWeightKg,
      record.followUp ?? '',
      record.notes,
    ]);
    const csv = [headers, ...rows].map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'estate-produce-records.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-5">
      <section className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-emerald-800">Employee Portal / Ramesh / Stores / Estate Produce</p>
          <h1 className="mt-2 text-3xl font-bold text-emerald-950">Estate Produce Tracker</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => setActiveTab('add')} className="inline-flex items-center gap-2 rounded-md bg-emerald-800 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-900">
            <Plus className="h-4 w-4" />
            Add Entry
          </button>
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-emerald-200 bg-white px-4 py-2 text-sm font-semibold text-emerald-900 shadow-sm transition hover:bg-emerald-50">
            <Upload className="h-4 w-4" />
            Upload Photo
            <input type="file" accept="image/*" className="hidden" onChange={handlePhoto} />
          </label>
          <button onClick={exportCsv} className="inline-flex items-center gap-2 rounded-md border border-emerald-200 bg-white px-4 py-2 text-sm font-semibold text-emerald-900 shadow-sm transition hover:bg-emerald-50">
            <Download className="h-4 w-4" />
            Export
          </button>
        </div>
      </section>

      <section className="rounded-lg border border-stone-200 bg-white shadow-sm">
        <div className="flex flex-wrap gap-2 border-b border-stone-100 px-4 pt-3">
          {[
            ['records', 'Records', FileSpreadsheet],
            ['add', 'Add Entry', Plus],
            ['comparisons', 'Comparisons', BarChart3],
            ['photos', 'Photos', ImageIcon],
          ].map(([key, label, Icon]) => (
            <button
              key={key as string}
              onClick={() => setActiveTab(key as typeof activeTab)}
              className={`inline-flex items-center gap-2 border-b-2 px-3 py-3 text-sm font-semibold transition ${
                activeTab === key ? 'border-emerald-800 text-emerald-900' : 'border-transparent text-stone-600 hover:text-emerald-800'
              }`}
            >
              <Icon className="h-4 w-4" />
              {label as string}
            </button>
          ))}
        </div>

        <div className="grid gap-5 p-4 xl:grid-cols-[1fr_340px]">
          <main className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
              {[
                ['Today Pieces', totals.qty.toLocaleString('en-IN'), 'pcs'],
                ['Today Weight', formatKg(totals.weight), 'kg'],
                ['To Date Pieces', (totals.qty + totals.previousQty).toLocaleString('en-IN'), 'pcs'],
                ['To Date Weight', formatKg(totals.weight + totals.previousWeight), 'kg'],
                ['Damaged', totals.damageQty.toLocaleString('en-IN'), `pcs / ${formatKg(totals.damageWeight)} kg`],
              ].map(([label, value, unit]) => (
                <div key={label} className="rounded-lg border border-stone-200 bg-stone-50/60 p-4">
                  <p className="text-xs font-semibold uppercase text-stone-500">{label}</p>
                  <p className="mt-2 text-2xl font-bold text-emerald-950">{value}</p>
                  <p className="text-sm text-stone-500">{unit}</p>
                </div>
              ))}
            </div>

            {(activeTab === 'records' || activeTab === 'comparisons' || activeTab === 'photos') && (
              <>
                <div className="grid gap-3 rounded-lg border border-stone-200 bg-white p-3 md:grid-cols-[120px_120px_150px_120px_1fr]">
                  <select value={filters.year} onChange={(event) => setFilters((current) => ({ ...current, year: event.target.value }))} className="rounded-md border border-stone-200 px-3 py-2 text-sm">
                    {['All', '2026', '2025', '2024'].map((year) => <option key={year}>{year}</option>)}
                  </select>
                  <select value={filters.estate} onChange={(event) => setFilters((current) => ({ ...current, estate: event.target.value }))} className="rounded-md border border-stone-200 px-3 py-2 text-sm">
                    {['All', ...ESTATES].map((estate) => <option key={estate}>{estate}</option>)}
                  </select>
                  <select value={filters.product} onChange={(event) => setFilters((current) => ({ ...current, product: event.target.value }))} className="rounded-md border border-stone-200 px-3 py-2 text-sm">
                    {['All', ...PRODUCTS].map((product) => <option key={product}>{product}</option>)}
                  </select>
                  <select value={filters.unit} onChange={(event) => setFilters((current) => ({ ...current, unit: event.target.value }))} className="rounded-md border border-stone-200 px-3 py-2 text-sm">
                    {['All', ...UNITS].map((unit) => <option key={unit}>{unit}</option>)}
                  </select>
                  <label className="flex items-center gap-2 rounded-md border border-stone-200 px-3 py-2">
                    <Search className="h-4 w-4 text-stone-400" />
                    <input
                      value={filters.search}
                      onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))}
                      placeholder="Search records"
                      className="min-w-0 flex-1 bg-transparent text-sm outline-none"
                    />
                  </label>
                </div>

                {activeTab === 'records' && (
                  <div className="overflow-hidden rounded-lg border border-stone-200">
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[980px] text-left text-sm">
                        <thead className="bg-stone-50 text-xs uppercase text-stone-500">
                          <tr>
                            {['Date', 'Estate', 'Product', 'Qty', 'Weight', 'Previous', 'To Date', 'Damage', 'Photo', 'Follow-up', 'Notes'].map((heading) => (
                              <th key={heading} className="px-3 py-3 font-bold">{heading}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-stone-100">
                          {filteredRecords.map((record) => (
                            <tr key={record.id} onClick={() => setSelectedId(record.id)} className="cursor-pointer bg-white hover:bg-emerald-50/60">
                              <td className="px-3 py-3">{toDateLabel(record.date)}</td>
                              <td className="px-3 py-3 font-semibold text-emerald-900">{record.estate}</td>
                              <td className="px-3 py-3">{record.product}</td>
                              <td className="px-3 py-3">{record.qty} {record.unit.toLowerCase()}</td>
                              <td className="px-3 py-3">{formatKg(record.weightKg)} kg</td>
                              <td className="px-3 py-3">{record.previousQty} / {formatKg(record.previousWeightKg)} kg</td>
                              <td className="px-3 py-3">{record.qty + record.previousQty} / {formatKg(record.weightKg + record.previousWeightKg)} kg</td>
                              <td className={`px-3 py-3 font-semibold ${record.damageQty ? 'text-red-600' : 'text-emerald-700'}`}>{record.damageQty} pcs</td>
                              <td className="px-3 py-3">{record.photoUrl ? <img alt="" src={record.photoUrl} className="h-10 w-12 rounded object-cover" /> : <Camera className="h-4 w-4 text-stone-400" />}</td>
                              <td className="px-3 py-3">{record.followUp ?? '-'}</td>
                              <td className="px-3 py-3 text-stone-600">{record.notes || record.damageNotes || '-'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </>
            )}

            {activeTab === 'add' && (
              <div className="grid gap-4 lg:grid-cols-[1fr_0.95fr]">
                <section className="rounded-lg border border-stone-200 bg-white p-4">
                  <div className="mb-4 flex gap-2">
                    <button onClick={() => setEntryMode('manual')} className={`rounded-md px-4 py-2 text-sm font-semibold ${entryMode === 'manual' ? 'bg-emerald-800 text-white' : 'border border-emerald-200 text-emerald-900'}`}>Manual</button>
                    <button onClick={() => setEntryMode('whatsapp')} className={`rounded-md px-4 py-2 text-sm font-semibold ${entryMode === 'whatsapp' ? 'bg-emerald-800 text-white' : 'border border-emerald-200 text-emerald-900'}`}>WhatsApp Paste</button>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <input type="date" value={draft.date} onChange={(event) => updateDraft('date', event.target.value)} className="rounded-md border border-stone-200 px-3 py-2 text-sm" />
                    <input type="time" value={draft.time} onChange={(event) => updateDraft('time', event.target.value)} className="rounded-md border border-stone-200 px-3 py-2 text-sm" />
                    <select value={draft.estate} onChange={(event) => updateDraft('estate', event.target.value)} className="rounded-md border border-stone-200 px-3 py-2 text-sm">{ESTATES.map((estate) => <option key={estate}>{estate}</option>)}</select>
                    <select value={draft.product} onChange={(event) => updateDraft('product', event.target.value)} className="rounded-md border border-stone-200 px-3 py-2 text-sm">{PRODUCTS.map((product) => <option key={product}>{product}</option>)}</select>
                    <select value={draft.unit} onChange={(event) => updateDraft('unit', event.target.value)} className="rounded-md border border-stone-200 px-3 py-2 text-sm">{UNITS.map((unit) => <option key={unit}>{unit}</option>)}</select>
                    <input value={draft.qty} onChange={(event) => updateDraft('qty', event.target.value)} placeholder="Quantity" className="rounded-md border border-stone-200 px-3 py-2 text-sm" />
                    <input value={draft.weightKg} onChange={(event) => updateDraft('weightKg', event.target.value)} placeholder="Weight kg" className="rounded-md border border-stone-200 px-3 py-2 text-sm" />
                    <input value={draft.previousQty} onChange={(event) => updateDraft('previousQty', event.target.value)} placeholder="Previous quantity" className="rounded-md border border-stone-200 px-3 py-2 text-sm" />
                    <input value={draft.previousWeightKg} onChange={(event) => updateDraft('previousWeightKg', event.target.value)} placeholder="Previous weight kg" className="rounded-md border border-stone-200 px-3 py-2 text-sm" />
                    <input value={draft.damageQty} onChange={(event) => updateDraft('damageQty', event.target.value)} placeholder="Damage quantity" className="rounded-md border border-stone-200 px-3 py-2 text-sm" />
                    <input value={draft.damageWeightKg} onChange={(event) => updateDraft('damageWeightKg', event.target.value)} placeholder="Damage weight kg" className="rounded-md border border-stone-200 px-3 py-2 text-sm" />
                    <input value={draft.location} onChange={(event) => updateDraft('location', event.target.value)} placeholder="Location" className="rounded-md border border-stone-200 px-3 py-2 text-sm" />
                    <textarea value={draft.damageNotes} onChange={(event) => updateDraft('damageNotes', event.target.value)} placeholder="Damage notes" className="min-h-20 rounded-md border border-stone-200 px-3 py-2 text-sm sm:col-span-2" />
                    <textarea value={draft.notes} onChange={(event) => updateDraft('notes', event.target.value)} placeholder="Notes" className="min-h-20 rounded-md border border-stone-200 px-3 py-2 text-sm sm:col-span-2" />
                  </div>
                </section>

                <section className="rounded-lg border border-stone-200 bg-white p-4">
                  <h2 className="font-bold text-stone-900">Paste WhatsApp Message</h2>
                  <textarea
                    value={whatsAppMessage}
                    onChange={handleWhatsAppChange}
                    onPaste={handleWhatsAppPaste}
                    placeholder="Paste the incoming report here..."
                    className="mt-3 min-h-36 w-full rounded-md border border-emerald-200 bg-emerald-50/40 px-3 py-2 text-sm outline-emerald-700"
                  />
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <button onClick={handleMessageParse} className="rounded-md bg-emerald-800 px-4 py-2 text-sm font-semibold text-white">Extract Fields</button>
                    <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-emerald-200 px-4 py-2 text-sm font-semibold text-emerald-900">
                      <Camera className="h-4 w-4" />
                      Attach Photo
                      <input type="file" accept="image/*" className="hidden" onChange={handlePhoto} />
                    </label>
                  </div>
                  <p className="mt-2 text-xs font-semibold text-emerald-800">{pasteStatus}</p>
                  {photoPreview && (
                    <div className="mt-3 flex items-center gap-3 rounded-md border border-emerald-100 bg-emerald-50 p-2 text-sm text-emerald-900">
                      <img alt="" src={photoPreview} className="h-14 w-16 rounded object-cover" />
                      <span>Photo attached to this entry. It will save with the record.</span>
                    </div>
                  )}
                  <div className="mt-4 rounded-md border border-stone-200 p-3 text-sm">
                    <p className="font-bold text-stone-900">Parsed Fields Preview</p>
                    {[
                      ['Product', draft.product],
                      ['Estate', draft.estate],
                      ['Qty', `${draft.qty} ${draft.unit}`],
                      ['Weight', `${draft.weightKg} kg`],
                      ['Damage', `${draft.damageQty || 0} pcs ${draft.damageNotes ? `(${draft.damageNotes})` : ''}`],
                    ].map(([label, value]) => (
                      <div key={label} className="mt-2 flex justify-between gap-4 border-b border-stone-100 pb-1">
                        <span className="text-stone-500">{label}</span>
                        <span className="font-medium text-stone-900">{value}</span>
                      </div>
                    ))}
                  </div>
                  <label className="mt-4 flex items-center gap-2 text-sm font-semibold text-emerald-900">
                    <input type="checkbox" checked={draft.addFollowUp} onChange={(event) => updateDraft('addFollowUp', event.target.checked)} />
                    Add follow-up to calendar
                  </label>
                  {draft.addFollowUp && (
                    <div className="mt-3 space-y-2">
                      {FOLLOW_UPS.map((item) => (
                        <label key={item} className="flex items-center gap-2 text-sm text-stone-700">
                          <input type="radio" checked={draft.followUp === item} onChange={() => updateDraft('followUp', item)} />
                          {item}
                        </label>
                      ))}
                    </div>
                  )}
                  <button onClick={addRecord} className="mt-4 inline-flex items-center gap-2 rounded-md bg-emerald-800 px-4 py-2 text-sm font-semibold text-white">
                    <CheckCircle2 className="h-4 w-4" />
                    Save Entry
                  </button>
                </section>
              </div>
            )}

            {activeTab === 'comparisons' && (
              <div className="grid gap-4 lg:grid-cols-2">
                <div className="rounded-lg border border-stone-200 bg-white p-4">
                  <h2 className="font-bold text-stone-900">Durian by Year</h2>
                  <div className="mt-4 space-y-3">
                    {chartByYear.map((entry) => (
                      <div key={entry.year}>
                        <div className="mb-1 flex justify-between text-sm"><span>{entry.year}</span><span>{formatKg(entry.weight)} kg</span></div>
                        <div className="h-3 overflow-hidden rounded-full bg-stone-100">
                          <div className="h-full rounded-full bg-emerald-700" style={{ width: `${Math.max(8, (entry.weight / maxYearWeight) * 100)}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="rounded-lg border border-stone-200 bg-white p-4">
                  <h2 className="font-bold text-stone-900">Estate Comparison</h2>
                  <div className="mt-4 divide-y divide-stone-100">
                    {estateComparison.map((entry) => (
                      <div key={entry.estate} className="flex justify-between py-2 text-sm">
                        <span className="font-semibold text-emerald-900">{entry.estate}</span>
                        <span>{formatKg(entry.weight)} kg</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'photos' && (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {[selected, ...records.filter((record) => record.id !== selected.id)].slice(0, 6).map((record) => (
                  <div key={record.id} className="rounded-lg border border-stone-200 bg-white p-4">
                    <div className="flex h-32 items-center justify-center rounded-md bg-emerald-50 text-emerald-800">
                      {record.photoUrl ? <img alt="" src={record.photoUrl} className="h-full w-full rounded-md object-cover" /> : <ImageIcon className="h-8 w-8" />}
                    </div>
                    <h3 className="mt-3 font-bold text-stone-900">{record.product} / {record.estate}</h3>
                    <p className="mt-1 text-sm text-stone-500">Photo AI count can be connected here as assisted verification.</p>
                  </div>
                ))}
              </div>
            )}
          </main>

          <aside className="space-y-4">
            <section className="rounded-lg border border-stone-200 bg-white p-4">
              <h2 className="flex items-center gap-2 font-bold text-emerald-950">
                <BarChart3 className="h-4 w-4" />
                Compare
              </h2>
              <div className="mt-4 space-y-3">
                {chartByYear.map((entry) => (
                  <div key={entry.year}>
                    <div className="mb-1 flex justify-between text-xs"><span>{entry.year}</span><span>{formatKg(entry.weight)} kg</span></div>
                    <div className="h-2 rounded-full bg-stone-100">
                      <div className="h-2 rounded-full bg-emerald-700" style={{ width: `${Math.max(8, (entry.weight / maxYearWeight) * 100)}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-lg border border-stone-200 bg-white p-4">
              <h2 className="font-bold text-emerald-950">Selected Record</h2>
              <div className="mt-4 flex gap-3">
                <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-md bg-emerald-50 text-emerald-800">
                  {selected.photoUrl ? <img alt="" src={selected.photoUrl} className="h-full w-full rounded-md object-cover" /> : <ImageIcon className="h-8 w-8" />}
                </div>
                <div className="min-w-0 text-sm">
                  <p className="font-bold text-stone-900">{selected.product}</p>
                  <p className="text-stone-500">{selected.source}</p>
                  <p className="mt-2">{toDateLabel(selected.date)} {selected.time}</p>
                  <p>{selected.estate} / {selected.qty} {selected.unit.toLowerCase()}</p>
                  <p>{formatKg(selected.weightKg)} kg</p>
                </div>
              </div>
              <div className="mt-4 space-y-2 text-sm text-stone-600">
                <p><span className="font-semibold text-stone-900">Damage:</span> {selected.damageQty} pcs {selected.damageNotes}</p>
                <p><span className="font-semibold text-stone-900">Location:</span> {selected.location ?? '-'}</p>
                <p><span className="font-semibold text-stone-900">Entered by:</span> {selected.enteredBy}</p>
                <p><span className="font-semibold text-stone-900">Follow-up:</span> {selected.followUp ?? 'None'}</p>
              </div>
              {selected.sourceMessage && (
                <div className="mt-4 rounded-md border border-emerald-100 bg-emerald-50/70 p-3 text-sm text-stone-700">
                  <p className="font-semibold text-emerald-950">Attached WhatsApp Message</p>
                  <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap font-sans text-xs leading-relaxed">{selected.sourceMessage}</pre>
                </div>
              )}
              <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>Photo AI count: estimate 18-22, verify before save.</span>
                </div>
              </div>
              {selected.followUp && (
                <div className="mt-3 flex items-center gap-2 text-sm font-semibold text-emerald-900">
                  <CalendarDays className="h-4 w-4" />
                  Calendar follow-up ready
                </div>
              )}
            </section>
          </aside>
        </div>
      </section>
    </div>
  );
}
