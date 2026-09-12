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
  Search,
  Snowflake,
  Tag,
} from 'lucide-react';

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
