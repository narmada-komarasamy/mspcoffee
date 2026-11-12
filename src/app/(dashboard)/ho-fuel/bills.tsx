"use client";
import { useState } from 'react';
export type FuelBill = { id: string; file_name: string };
export async function fuelRequest(url: string, options?: RequestInit) {
  const response = await fetch(url, options);
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'The request failed. Please retry.');
  return result;
}
export function BillUpload({ files, onFiles, purchaseId, disabled = false, onBusy, onUploaded }: {
 files: FuelBill[]; onFiles: (files: FuelBill[]) => void; purchaseId?: number; disabled?: boolean; onBusy?: (busy: boolean) => void; onUploaded?: (files: FuelBill[]) => Promise<void>;
}) {
 const [busy, setBusy] = useState(false);
 const [message, setMessage] = useState('');
 return <div style={{ marginBottom:16 }}>
  <label style={{ display:'block',fontWeight:600 }}>Upload bill {purchaseId ? '' : '*'} (PDF or photos)</label>
  <p>Attach all pages of one purchase. Up to 10 files, 3 MB each.</p>
  <input aria-label="Upload purchase bills" type="file" accept="application/pdf,image/jpeg,image/png,image/webp" multiple disabled={busy || disabled}
    onChange={async event => {
      const chosen = Array.from(event.target.files || []);
      event.target.value = '';
      if (!chosen.length) return;
      if (files.length + chosen.length > 10) { setMessage('Attach no more than 10 files per purchase.'); return; }
      if (chosen.some(f => !f.size || f.size > 3*1024*1024 || !['application/pdf','image/jpeg','image/png','image/webp'].includes(f.type))) { setMessage('Choose PDF, JPG, PNG or WebP files up to 3 MB each.'); return; }
      setBusy(true); onBusy?.(true); setMessage('Uploading…');
      const next = [...files];
      try {
        for (const file of chosen) {
          const form = new FormData(); form.append('file',file);
          if (purchaseId) form.append('purchaseId',String(purchaseId));
          next.push(await fuelRequest('/api/ho-fuel/bills',{ method:'POST',body:form }));
          onFiles([...next]);
        }
        setMessage('Bill files uploaded.');
        await onUploaded?.(next);
      } catch (error) { setMessage(error instanceof Error ? error.message : 'Upload failed.'); }
      finally { setBusy(false); onBusy?.(false); }
    }} />
  {files.length > 0 && <ul>{files.map(file => <li key={file.id}>
    <a href={`/api/ho-fuel/bills?id=${file.id}`} target="_blank" rel="noreferrer">{file.file_name}</a>
    {!purchaseId && <button type="button" disabled={busy || disabled} onClick={() => onFiles(files.filter(f => f.id !== file.id))} aria-label={`Remove ${file.file_name}`}>Remove</button>}
  </li>)}</ul>}
  {message && <p role="status">{message}</p>}
 </div>;
}
export function PurchaseBills({ purchaseId }: { purchaseId: number }) {
 const [files,setFiles] = useState<FuelBill[]>([]);
 const [loaded,setLoaded] = useState(false);
 const [error,setError] = useState('');
 const [busy,setBusy] = useState(false);
 async function load() {
   setBusy(true); setError('');
   try { const result = await fuelRequest(`/api/ho-fuel/bills?purchaseId=${purchaseId}`); setFiles(result.files); setLoaded(true); }
   catch (e) { setError(e instanceof Error ? e.message : 'Unable to load bills.'); }
   finally { setBusy(false); }
 }
 return <details onToggle={event => { if (event.currentTarget.open && !loaded && !busy) void load(); }}>
   <summary>Bills / Upload bill</summary>
   {busy && <p>Loading…</p>}
   {error && <p role="alert">{error} <button onClick={load}>Retry</button></p>}
   {loaded && <BillUpload purchaseId={purchaseId} files={files} onFiles={setFiles} />}
 </details>;
}
