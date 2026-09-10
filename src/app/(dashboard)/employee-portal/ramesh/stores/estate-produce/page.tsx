'use client';

import { ChangeEvent, ClipboardEvent, useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  BarChart3,
  CalendarDays,
  Camera,
  CheckCircle2,
  Download,
  Eye,
  FileSpreadsheet,
  Image as ImageIcon,
  Loader2,
  Plus,
  Search,
  Sparkles,
  Trash2,
  Upload,
  X,
} from 'lucide-react';

type AppUser = { id: string; name: string; role: string; estate: string | null };

type AiPhotoCount = {
  min: number | null;
  max: number | null;
  best: number | null;
  confidence: string;
  notes: string;
  accepted?: boolean;
};

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
  photoPath?: string;
  photoFileName?: string;
  photoContentType?: string;
  photoUrl?: string;
  aiPhotoCount?: AiPhotoCount;
  location?: string;
  notes: string;
  followUp?: string;
  enteredBy: string;
};

type UploadedPhoto = {
  path: string;
  url: string;
  fileName: string;
  contentType: string;
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

function storedAppUser(): AppUser | null {
  if (typeof window === 'undefined') return null;
  try {
    const stored = window.localStorage.getItem('msp_user');
    return stored ? JSON.parse(stored) as AppUser : null;
  } catch {
    return null;
  }
}

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

function readImageFile(file: File) {
  return new Promise<{ base64: string; mediaType: string; photoUrl: string }>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result ?? '');
      const [, base64 = ''] = dataUrl.split(',');
      resolve({ base64, mediaType: file.type, photoUrl: dataUrl });
    };
    reader.onerror = () => reject(new Error('Could not read the image file'));
    reader.readAsDataURL(file);
  });
}

function aiCountLabel(count?: AiPhotoCount) {
  if (!count) return '';
  if (count.min !== null && count.max !== null && count.min !== count.max) return `${count.min}-${count.max} pieces`;
  if (count.best !== null) return `${count.best} pieces`;
  if (count.min !== null) return `${count.min} pieces`;
  return 'Unable to count confidently';
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
    toDateWeight ? `Message to-date total weight: ${toDateWeight} kg` : '',
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
  const [records, setRecords] = useState<ProduceRecord[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [draft, setDraft] = useState<Draft>(blankDraft());
  const [entryMode, setEntryMode] = useState<'manual' | 'whatsapp'>('whatsapp');
  const [whatsAppMessage, setWhatsAppMessage] = useState('');
  const [pasteStatus, setPasteStatus] = useState('Paste a WhatsApp message to attach it to the next saved record.');
  const [photoPreview, setPhotoPreview] = useState<string>('');
  const [draftPhoto, setDraftPhoto] = useState<UploadedPhoto | undefined>();
  const [draftAiCount, setDraftAiCount] = useState<AiPhotoCount | undefined>();
  const [aiStatus, setAiStatus] = useState('');
  const [photoModalRecord, setPhotoModalRecord] = useState<ProduceRecord | null>(null);
  const [deleteConfirmRecord, setDeleteConfirmRecord] = useState<ProduceRecord | null>(null);
  const [currentUser, setCurrentUser] = useState<AppUser | null>(null);
  const [loadingRecords, setLoadingRecords] = useState(true);
  const [savingRecord, setSavingRecord] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [filters, setFilters] = useState({ year: '2026', estate: 'All', product: 'All', unit: 'All', search: '' });
  const isAdmin = currentUser?.role?.toLowerCase() === 'admin';

  useEffect(() => {
    const loadUser = () => setCurrentUser(storedAppUser());
    loadUser();
    window.addEventListener('msp-user-updated', loadUser);
    return () => window.removeEventListener('msp-user-updated', loadUser);
  }, []);

  const loadRecords = useCallback(async () => {
    setLoadingRecords(true);
    setStatusMessage('');
    try {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value && value !== 'All') params.set(key, value);
      });
      const response = await fetch(`/api/estate-produce/records?${params.toString()}`);
      const body = await response.json().catch(() => ({})) as { records?: ProduceRecord[]; error?: string };
      if (!response.ok) throw new Error(body.error || 'Could not load estate produce records');
      const nextRecords = body.records ?? [];
      setRecords(nextRecords);
      setSelectedId((current) => nextRecords.some((record) => record.id === current) ? current : nextRecords[0]?.id ?? '');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not load estate produce records';
      setStatusMessage(message);
    } finally {
      setLoadingRecords(false);
    }
  }, [filters]);

  useEffect(() => {
    loadRecords();
  }, [loadRecords]);

  const filteredRecords = records;

  const selected = records.find((record) => record.id === selectedId) ?? records[0] ?? null;
  const photoRecords = selected ? [selected, ...records.filter((record) => record.id !== selected.id)] : records;

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

  const runPhotoCount = async (base64: string, mediaType: string, product: string) => {
    const response = await fetch('/api/estate-produce/photo-count', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ base64, mediaType, product }),
    });

    if (!response.ok) {
      const body = await response.json().catch(() => ({})) as { error?: string };
      throw new Error(body.error || 'AI count failed');
    }

    return await response.json() as AiPhotoCount;
  };

  const uploadPhoto = async (file: File, recordId?: string) => {
    const formData = new FormData();
    formData.append('photo', file);
    if (recordId) formData.append('recordId', recordId);

    const response = await fetch('/api/estate-produce/photos', {
      method: 'POST',
      body: formData,
    });
    const body = await response.json().catch(() => ({})) as UploadedPhoto & { error?: string };
    if (!response.ok) throw new Error(body.error || 'Photo upload failed');
    return body;
  };

  const patchRecord = async (id: string, payload: Record<string, unknown>) => {
    const response = await fetch(`/api/estate-produce/records/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const body = await response.json().catch(() => ({})) as { record?: ProduceRecord; error?: string };
    if (!response.ok || !body.record) throw new Error(body.error || 'Record update failed');
    setRecords((current) => current.map((record) => (record.id === id ? body.record! : record)));
    return body.record;
  };

  const analyzeDraftPhoto = async (base64: string, mediaType: string) => {
    setDraftAiCount(undefined);
    setAiStatus('AI is checking the visible count...');
    try {
      const count = await runPhotoCount(base64, mediaType, draft.product);
      setDraftAiCount(count);
      setAiStatus(`AI counted approximately ${aiCountLabel(count)}. Admin can accept it after review.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'AI count failed';
      setAiStatus(`${message}. You can still save the photo and enter quantity manually.`);
    }
  };

  const analyzeRecordPhoto = async (recordId: string, base64: string, mediaType: string, product: string) => {
    setAiStatus('AI is checking the visible count...');
    try {
      const count = await runPhotoCount(base64, mediaType, product);
      await patchRecord(recordId, { aiPhotoCount: count });
      setAiStatus(`AI counted approximately ${aiCountLabel(count)}. Admin can accept it after review.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'AI count failed';
      setAiStatus(`${message}. Photo is still attached.`);
    }
  };

  const handleWhatsAppPaste = async (event: ClipboardEvent<HTMLTextAreaElement>) => {
    const pastedText = event.clipboardData.getData('text');
    const pastedImage = Array.from(event.clipboardData.files).find((file) => file.type.startsWith('image/'));

    if (pastedImage) {
      try {
        const image = await readImageFile(pastedImage);
        const uploaded = await uploadPhoto(pastedImage);
        setDraftPhoto(uploaded);
        setPhotoPreview(uploaded.url || image.photoUrl);
        setPasteStatus('Photo uploaded to Supabase. Paste the WhatsApp text also, then review before saving.');
        analyzeDraftPhoto(image.base64, image.mediaType);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Photo upload failed';
        setPasteStatus(message);
      }
    }

    if (pastedText.trim()) {
      const nextMessage = `${whatsAppMessage}${pastedText}`;
      setWhatsAppMessage(nextMessage);
      extractWhatsAppFields(nextMessage);
      event.preventDefault();
    }
  };

  const handlePhoto = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const image = await readImageFile(file);
      const uploaded = await uploadPhoto(file);
      setDraftPhoto(uploaded);
      setPhotoPreview(uploaded.url || image.photoUrl);
      setPasteStatus('Photo uploaded to Supabase. Review the AI count and fields before saving.');
      analyzeDraftPhoto(image.base64, image.mediaType);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Photo upload failed';
      setPasteStatus(message);
    }
  };

  const handleSelectedPhoto = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !selected) return;
    try {
      const image = await readImageFile(file);
      const uploaded = await uploadPhoto(file, selected.id);
      await patchRecord(selected.id, {
        photoPath: uploaded.path,
        photoFileName: uploaded.fileName,
        photoContentType: uploaded.contentType,
        aiPhotoCount: {},
      });
      analyzeRecordPhoto(selected.id, image.base64, image.mediaType, selected.product);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Photo upload failed';
      setAiStatus(message);
    }
  };

  const useDraftAiCount = () => {
    if (!isAdmin || !draftAiCount?.best) return;
    setDraft((current) => ({
      ...current,
      qty: String(draftAiCount.best),
      notes: [current.notes, `AI photo count accepted: ${aiCountLabel(draftAiCount)} (${draftAiCount.confidence || 'unknown'} confidence). ${draftAiCount.notes}`]
        .filter(Boolean)
        .join('\n'),
    }));
    setDraftAiCount((current) => current ? { ...current, accepted: true } : current);
  };

  const useSelectedAiCount = () => {
    if (!selected) return;
    if (!isAdmin || !selected.aiPhotoCount?.best) return;
    const accepted = { ...selected.aiPhotoCount, accepted: true };
    const note = `AI photo count accepted: ${aiCountLabel(accepted)} (${accepted.confidence || 'unknown'} confidence). ${accepted.notes}`;
    patchRecord(selected.id, {
      qty: accepted.best ?? selected.qty,
      aiPhotoCount: accepted,
      notes: [selected.notes, note].filter(Boolean).join('\n'),
    }).catch((error) => setAiStatus(error instanceof Error ? error.message : 'Could not save AI count'));
  };

  const deleteSelectedRecord = async () => {
    if (!isAdmin || !deleteConfirmRecord) return;
    try {
      const response = await fetch(`/api/estate-produce/records/${deleteConfirmRecord.id}`, { method: 'DELETE' });
      const body = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) throw new Error(body.error || 'Delete failed');
      setRecords((current) => {
        const next = current.filter((record) => record.id !== deleteConfirmRecord.id);
        setSelectedId(next[0]?.id ?? '');
        return next;
      });
      setDeleteConfirmRecord(null);
    } catch (error) {
      setAiStatus(error instanceof Error ? error.message : 'Delete failed');
    }
  };

  const addRecord = async () => {
    setSavingRecord(true);
    setStatusMessage('');
    const payload = {
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
      photoPath: draftPhoto?.path,
      photoFileName: draftPhoto?.fileName,
      photoContentType: draftPhoto?.contentType,
      aiPhotoCount: draftAiCount,
      location: draft.location,
      notes: draft.notes,
      followUp: draft.addFollowUp ? draft.followUp : undefined,
    };
    try {
      const response = await fetch('/api/estate-produce/records', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const body = await response.json().catch(() => ({})) as { record?: ProduceRecord; error?: string };
      if (!response.ok || !body.record) throw new Error(body.error || 'Could not save entry');
      setRecords((current) => [body.record!, ...current]);
      setSelectedId(body.record.id);
      setActiveTab('records');
      setWhatsAppMessage('');
      setPasteStatus('Entry saved to Supabase. Paste the next WhatsApp message when ready.');
      setPhotoPreview('');
      setDraftPhoto(undefined);
      setDraftAiCount(undefined);
      setAiStatus('');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not save entry';
      setStatusMessage(message);
    } finally {
      setSavingRecord(false);
    }
  };

  const exportCsv = () => {
    const headers = ['Date', 'Estate', 'Product', 'Qty', 'Unit', 'Total weight kg', 'Previous qty', 'Previous total weight kg', 'Damage qty', 'Damage weight kg', 'Follow-up', 'Notes'];
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
                ['Today Total Weight', formatKg(totals.weight), 'kg'],
                ['To Date Pieces', (totals.qty + totals.previousQty).toLocaleString('en-IN'), 'pcs'],
                ['To Date Total Weight', formatKg(totals.weight + totals.previousWeight), 'kg'],
                ['Damaged', totals.damageQty.toLocaleString('en-IN'), `pcs / ${formatKg(totals.damageWeight)} kg`],
              ].map(([label, value, unit]) => (
                <div key={label} className="rounded-lg border border-stone-200 bg-stone-50/60 p-4">
                  <p className="text-xs font-semibold uppercase text-stone-500">{label}</p>
                  <p className="mt-2 text-2xl font-bold text-emerald-950">{value}</p>
                  <p className="text-sm text-stone-500">{unit}</p>
                </div>
              ))}
            </div>

            {(loadingRecords || statusMessage) && (
              <div className={`rounded-md border px-3 py-2 text-sm ${
                statusMessage ? 'border-red-200 bg-red-50 text-red-800' : 'border-emerald-100 bg-emerald-50 text-emerald-900'
              }`}>
                {statusMessage || 'Loading estate produce records from Supabase...'}
              </div>
            )}

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
                            {['Date', 'Estate', 'Product', 'Qty', 'Total Weight', 'Previous', 'To Date', 'Damage', 'Photo', 'Follow-up', 'Notes'].map((heading) => (
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
                              <td className="px-3 py-3">
                                {record.photoUrl ? (
                                  <button
                                    type="button"
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      setPhotoModalRecord(record);
                                      setSelectedId(record.id);
                                    }}
                                    className="group relative h-10 w-12 overflow-hidden rounded"
                                    title="Open photo"
                                  >
                                    <img alt="" src={record.photoUrl} className="h-full w-full object-cover" />
                                    <span className="absolute inset-0 hidden items-center justify-center bg-black/35 text-white group-hover:flex">
                                      <Eye className="h-4 w-4" />
                                    </span>
                                  </button>
                                ) : (
                                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-stone-400">
                                    <Camera className="h-4 w-4" />
                                    No photo
                                  </span>
                                )}
                              </td>
                              <td className="px-3 py-3">{record.followUp ?? '-'}</td>
                              <td className="px-3 py-3 text-stone-600">{record.notes || record.damageNotes || '-'}</td>
                            </tr>
                          ))}
                          {!loadingRecords && filteredRecords.length === 0 && (
                            <tr>
                              <td colSpan={11} className="px-3 py-8 text-center text-sm text-stone-500">
                                No estate produce records yet. Add the first entry to save it in Supabase.
                              </td>
                            </tr>
                          )}
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
                    <input value={draft.weightKg} onChange={(event) => updateDraft('weightKg', event.target.value)} placeholder="Total weight kg" className="rounded-md border border-stone-200 px-3 py-2 text-sm" />
                    <input value={draft.previousQty} onChange={(event) => updateDraft('previousQty', event.target.value)} placeholder="Previous quantity" className="rounded-md border border-stone-200 px-3 py-2 text-sm" />
                    <input value={draft.previousWeightKg} onChange={(event) => updateDraft('previousWeightKg', event.target.value)} placeholder="Previous total weight kg" className="rounded-md border border-stone-200 px-3 py-2 text-sm" />
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
                      <button type="button" onClick={() => setPhotoModalRecord({
                        id: 'draft-photo-preview',
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
                        photoUrl: photoPreview,
                        aiPhotoCount: draftAiCount,
                        location: draft.location,
                        notes: draft.notes,
                        enteredBy: 'Admin',
                      })}>
                        <img alt="" src={photoPreview} className="h-14 w-16 rounded object-cover" />
                      </button>
                      <span>Photo attached to this entry. It will save with the record.</span>
                    </div>
                  )}
                  {(draftAiCount || aiStatus) && (
                    <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
                      <div className="flex items-start gap-2">
                        {aiStatus.includes('checking') ? <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin" /> : <Sparkles className="mt-0.5 h-4 w-4 shrink-0" />}
                        <div>
                          <p className="font-semibold">AI Photo Count</p>
                          <p>{draftAiCount ? `AI counted approximately ${aiCountLabel(draftAiCount)}.` : aiStatus}</p>
                          {draftAiCount?.notes && <p className="mt-1 text-xs">{draftAiCount.notes}</p>}
                          {isAdmin && draftAiCount?.best && (
                            <button onClick={useDraftAiCount} className="mt-2 rounded-md bg-emerald-800 px-3 py-1.5 text-xs font-semibold text-white">
                              Use AI Count
                            </button>
                          )}
                          {!isAdmin && draftAiCount && <p className="mt-2 text-xs font-semibold">Admin must confirm before this changes quantity.</p>}
                        </div>
                      </div>
                    </div>
                  )}
                  <div className="mt-4 rounded-md border border-stone-200 p-3 text-sm">
                    <p className="font-bold text-stone-900">Parsed Fields Preview</p>
                    {[
                      ['Product', draft.product],
                      ['Estate', draft.estate],
                      ['Qty', `${draft.qty} ${draft.unit}`],
                      ['Total Weight', `${draft.weightKg} kg`],
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
                  <button disabled={savingRecord} onClick={addRecord} className="mt-4 inline-flex items-center gap-2 rounded-md bg-emerald-800 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60">
                    {savingRecord ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                    {savingRecord ? 'Saving...' : 'Save Entry'}
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
                {photoRecords.slice(0, 6).map((record) => (
                  <div key={record.id} className="rounded-lg border border-stone-200 bg-white p-4">
                    <button
                      type="button"
                      onClick={() => record.photoUrl && setPhotoModalRecord(record)}
                      className="flex h-32 w-full items-center justify-center rounded-md bg-emerald-50 text-emerald-800"
                    >
                      {record.photoUrl ? <img alt="" src={record.photoUrl} className="h-full w-full rounded-md object-cover" /> : <ImageIcon className="h-8 w-8" />}
                    </button>
                    <h3 className="mt-3 font-bold text-stone-900">{record.product} / {record.estate}</h3>
                    <p className="mt-1 text-sm text-stone-500">{record.aiPhotoCount ? `AI count: ${aiCountLabel(record.aiPhotoCount)}` : 'No AI count yet.'}</p>
                  </div>
                ))}
                {!loadingRecords && photoRecords.length === 0 && (
                  <div className="rounded-lg border border-dashed border-stone-300 bg-white p-6 text-sm text-stone-500 sm:col-span-2 lg:col-span-3">
                    No photos yet. Add or select a record, then attach a photo.
                  </div>
                )}
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
              {!selected ? (
                <p className="mt-4 text-sm text-stone-500">Select a record after adding your first Supabase entry.</p>
              ) : (
                <>
                  <div className="mt-4 flex gap-3">
                    <button
                      type="button"
                      onClick={() => selected.photoUrl && setPhotoModalRecord(selected)}
                      className="flex h-24 w-24 shrink-0 items-center justify-center rounded-md bg-emerald-50 text-emerald-800"
                    >
                      {selected.photoUrl ? <img alt="" src={selected.photoUrl} className="h-full w-full rounded-md object-cover" /> : <ImageIcon className="h-8 w-8" />}
                    </button>
                    <div className="min-w-0 text-sm">
                      <p className="font-bold text-stone-900">{selected.product}</p>
                      <p className="text-stone-500">{selected.source}</p>
                      <p className="mt-2">{toDateLabel(selected.date)} {selected.time}</p>
                      <p>{selected.estate} / {selected.qty} {selected.unit.toLowerCase()}</p>
                      <p>{formatKg(selected.weightKg)} kg</p>
                    </div>
                  </div>
                  <label className="mt-3 inline-flex cursor-pointer items-center gap-2 rounded-md border border-emerald-200 px-3 py-2 text-sm font-semibold text-emerald-900 transition hover:bg-emerald-50">
                    <Camera className="h-4 w-4" />
                    {selected.photoUrl ? 'Replace Photo' : 'Attach Photo'}
                    <input type="file" accept="image/*" className="hidden" onChange={handleSelectedPhoto} />
                  </label>
                  {isAdmin && (
                    <button
                      onClick={() => setDeleteConfirmRecord(selected)}
                      className="ml-2 mt-3 inline-flex items-center gap-2 rounded-md border border-red-200 px-3 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-50"
                    >
                      <Trash2 className="h-4 w-4" />
                      Delete
                    </button>
                  )}
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
                      {aiStatus.includes('checking') ? <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin" /> : <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />}
                      <div>
                        <p className="font-semibold">AI Photo Count</p>
                        <p>{selected.aiPhotoCount ? `AI counted approximately ${aiCountLabel(selected.aiPhotoCount)}.` : 'Attach a photo to run an assisted visible count.'}</p>
                        {selected.aiPhotoCount?.notes && <p className="mt-1 text-xs">{selected.aiPhotoCount.notes}</p>}
                        {isAdmin && selected.aiPhotoCount?.best && !selected.aiPhotoCount.accepted && (
                          <button onClick={useSelectedAiCount} className="mt-2 rounded-md bg-emerald-800 px-3 py-1.5 text-xs font-semibold text-white">
                            Use AI Count
                          </button>
                        )}
                        {selected.aiPhotoCount?.accepted && <p className="mt-1 text-xs font-semibold text-emerald-800">Admin accepted this AI count.</p>}
                      </div>
                    </div>
                  </div>
                  {selected.followUp && (
                    <div className="mt-3 flex items-center gap-2 text-sm font-semibold text-emerald-900">
                      <CalendarDays className="h-4 w-4" />
                      Calendar follow-up ready
                    </div>
                  )}
                </>
              )}
            </section>
          </aside>
        </div>
      </section>

      {photoModalRecord?.photoUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4" role="dialog" aria-modal="true" aria-label="Produce photo preview">
          <div className="max-h-[92vh] w-full max-w-4xl overflow-hidden rounded-lg bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-stone-200 px-4 py-3">
              <div>
                <p className="font-bold text-emerald-950">{photoModalRecord.product} / {photoModalRecord.estate}</p>
                <p className="text-sm text-stone-500">{toDateLabel(photoModalRecord.date)} {photoModalRecord.time}</p>
              </div>
              <button onClick={() => setPhotoModalRecord(null)} className="rounded-md p-2 text-stone-500 hover:bg-stone-100" aria-label="Close photo preview">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="max-h-[76vh] overflow-auto bg-stone-950 p-3">
              <img alt="" src={photoModalRecord.photoUrl} className="mx-auto max-h-[72vh] max-w-full rounded object-contain" />
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-stone-200 px-4 py-3 text-sm">
              <span className="text-stone-600">
                {photoModalRecord.aiPhotoCount ? `AI count: ${aiCountLabel(photoModalRecord.aiPhotoCount)}` : 'No AI count attached yet.'}
              </span>
              {photoModalRecord.aiPhotoCount?.notes && <span className="text-stone-500">{photoModalRecord.aiPhotoCount.notes}</span>}
            </div>
          </div>
        </div>
      )}

      {deleteConfirmRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4" role="dialog" aria-modal="true" aria-label="Delete produce record">
          <div className="w-full max-w-md rounded-lg bg-white p-5 shadow-2xl">
            <div className="flex items-start gap-3">
              <div className="rounded-full bg-red-50 p-2 text-red-700">
                <Trash2 className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-stone-950">Delete this record?</h2>
                <p className="mt-2 text-sm text-stone-600">
                  This will remove {deleteConfirmRecord.product} from {deleteConfirmRecord.estate} dated {toDateLabel(deleteConfirmRecord.date)} from this tracker.
                </p>
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => setDeleteConfirmRecord(null)} className="rounded-md border border-stone-200 px-4 py-2 text-sm font-semibold text-stone-700">
                Cancel
              </button>
              <button onClick={deleteSelectedRecord} className="rounded-md bg-red-700 px-4 py-2 text-sm font-semibold text-white">
                Delete Record
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
