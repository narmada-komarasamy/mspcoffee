"use client";

import { useRef, useState } from "react";
import * as XLSX from "xlsx";
import { CloudUpload, X, CheckCircle, AlertCircle, Loader2, FileSpreadsheet } from "lucide-react";

type ParsedRow = {
  date: string;
  estate: string;
  rainfall_mm: number;
  inches: number;
};

const VALID_ESTATES = ["Gowri", "Hidden Falls", "Moganad", "Orchardale", "Stanmore", "Vyapurikuttai"];

interface Props {
  authHeaders: Record<string, string> | null;
  onClose: () => void;
  onSuccess: () => void;
}

async function readApiError(response: Response, fallback: string) {
  const result = await response.json().catch(() => null) as { error?: string } | null;
  return result?.error ?? fallback;
}

export function UploadModal({ authHeaders, onClose, onSuccess }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [fileName, setFileName] = useState("");
  const [step, setStep] = useState<"idle" | "preview" | "uploading" | "done">("idle");
  const [uploadedCount, setUploadedCount] = useState(0);

  const parseFile = (file: File) => {
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      const data = new Uint8Array(e.target?.result as ArrayBuffer);
      const wb = XLSX.read(data, { type: "array", cellDates: true });
      const ws = wb.Sheets["Rainfall Data"] ?? wb.Sheets[wb.SheetNames[0]];
      const raw: Record<string, unknown>[] = XLSX.utils.sheet_to_json(ws, { raw: false });

      const parsed: ParsedRow[] = [];
      const errs: string[] = [];

      raw.forEach((r, i) => {
        const rowNum = i + 2;
        const dateRaw = String(r["Date"] ?? "").trim();
        const estate = String(r["Estate"] ?? "").trim();
        const mmRaw = r["mm"] ?? r["Rainfall_mm"] ?? r["rainfall_mm"];
        const inRaw = r["Inches"] ?? r["inches"];

        if (!dateRaw) { errs.push(`Row ${rowNum}: missing Date`); return; }
        if (!VALID_ESTATES.includes(estate)) { errs.push(`Row ${rowNum}: unknown estate "${estate}"`); return; }

        // Normalise date to YYYY-MM-DD
        let date = dateRaw;
        if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(dateRaw)) {
          const [m, d, y] = dateRaw.split("/");
          date = `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
        } else if (/^\d{4}-\d{2}-\d{2}/.test(dateRaw)) {
          date = dateRaw.slice(0, 10);
        } else {
          // Try parsing as JS Date
          const d = new Date(dateRaw);
          if (isNaN(d.getTime())) { errs.push(`Row ${rowNum}: unrecognised date "${dateRaw}"`); return; }
          date = d.toISOString().slice(0, 10);
        }

        const mm = parseFloat(String(mmRaw ?? "0")) || 0;
        const inches = inRaw != null ? parseFloat(String(inRaw)) : parseFloat((mm * 0.0394).toFixed(3));

        parsed.push({ date, estate, rainfall_mm: mm, inches });
      });

      setRows(parsed);
      setErrors(errs);
      setStep("preview");
    };
    reader.readAsArrayBuffer(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) parseFile(file);
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) parseFile(file);
  };

  const handleUpload = async () => {
    if (!authHeaders) {
      setErrors((prev) => [...prev, "Sign in again before uploading rainfall data"]);
      return;
    }

    setStep("uploading");
    const BATCH = 500;
    let count = 0;
    for (let i = 0; i < rows.length; i += BATCH) {
      const batch = rows.slice(i, i + BATCH);
      const response = await fetch("/api/rainfall/bulk", {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({
          rows: batch.map((r) => ({
            date: r.date,
            estate: r.estate,
            rainfall_mm: r.rainfall_mm,
            inches: r.inches,
          })),
        }),
      });

      if (!response.ok) {
        const message = await readApiError(response, "Could not upload rainfall data");
        setErrors((prev) => [...prev, message]);
        setStep("preview");
        return;
      }

      count += batch.length;
      setUploadedCount(count);
    }
    setStep("done");
    setTimeout(() => { onSuccess(); onClose(); }, 1200);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-2xl rounded-2xl bg-msp-card border border-white/10 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <FileSpreadsheet className="h-5 w-5 text-msp-teal-light" />
            <h2 className="text-base font-semibold text-white">Upload Rainfall Data</h2>
          </div>
          <button onClick={onClose} className="text-white/40 hover:text-white transition">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6">
          {step === "idle" && (
            <div
              onDrop={handleDrop}
              onDragOver={(e) => e.preventDefault()}
              onClick={() => inputRef.current?.click()}
              className="flex flex-col items-center justify-center gap-4 border-2 border-dashed border-white/20 rounded-xl py-16 cursor-pointer hover:border-msp-teal-light/50 hover:bg-msp-teal-light/5 transition"
            >
              <CloudUpload className="h-12 w-12 text-msp-teal-light/60" />
              <div className="text-center">
                <p className="text-white font-medium mb-1">Drop your Excel file here</p>
                <p className="text-white/40 text-sm">or click to browse · .xlsx or .xls</p>
              </div>
              <p className="text-xs text-white/30">Expects columns: Date, Estate, mm, Inches</p>
              <input ref={inputRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleFile} />
            </div>
          )}

          {step === "preview" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-white font-medium text-sm">{fileName}</p>
                  <p className="text-white/50 text-xs mt-0.5">
                    {rows.length.toLocaleString()} rows parsed
                    {errors.length > 0 && ` · ${errors.length} warnings`}
                  </p>
                </div>
                <button onClick={() => { setStep("idle"); setRows([]); setErrors([]); }} className="text-xs text-white/40 hover:text-white transition">
                  Change file
                </button>
              </div>

              {errors.length > 0 && (
                <div className="rounded-lg bg-yellow-500/10 border border-yellow-500/20 p-3 max-h-28 overflow-y-auto">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertCircle className="h-3.5 w-3.5 text-yellow-400 shrink-0" />
                    <span className="text-yellow-400 text-xs font-medium">Rows skipped</span>
                  </div>
                  {errors.map((e, i) => <p key={i} className="text-yellow-300/70 text-xs">{e}</p>)}
                </div>
              )}

              {/* Preview table */}
              <div className="rounded-lg border border-white/10 overflow-hidden">
                <div className="overflow-x-auto max-h-60">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-white/5 text-white/50 uppercase tracking-wide">
                        <th className="px-3 py-2 text-left">Date</th>
                        <th className="px-3 py-2 text-left">Estate</th>
                        <th className="px-3 py-2 text-right">mm</th>
                        <th className="px-3 py-2 text-right">Inches</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.slice(0, 50).map((r, i) => (
                        <tr key={i} className="border-t border-white/5 text-white/80">
                          <td className="px-3 py-1.5">{r.date}</td>
                          <td className="px-3 py-1.5">{r.estate}</td>
                          <td className="px-3 py-1.5 text-right text-msp-teal-light">{r.rainfall_mm}</td>
                          <td className="px-3 py-1.5 text-right text-white/50">{r.inches.toFixed(3)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {rows.length > 50 && (
                  <div className="px-3 py-2 text-center text-xs text-white/30 border-t border-white/10">
                    +{(rows.length - 50).toLocaleString()} more rows
                  </div>
                )}
              </div>

              <div className="flex gap-3 pt-2">
                <button onClick={onClose} className="flex-1 px-4 py-2.5 rounded-xl border border-white/10 text-white/60 text-sm hover:bg-white/5 transition">
                  Cancel
                </button>
                <button
                  onClick={handleUpload}
                  disabled={rows.length === 0}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-msp-teal-light text-msp-bg text-sm font-semibold hover:opacity-90 transition disabled:opacity-40"
                >
                  Upload {rows.length.toLocaleString()} rows
                </button>
              </div>
            </div>
          )}

          {step === "uploading" && (
            <div className="flex flex-col items-center justify-center gap-4 py-16">
              <Loader2 className="h-10 w-10 text-msp-teal-light animate-spin" />
              <p className="text-white font-medium">Uploading…</p>
              <p className="text-white/50 text-sm">{uploadedCount.toLocaleString()} / {rows.length.toLocaleString()} rows</p>
            </div>
          )}

          {step === "done" && (
            <div className="flex flex-col items-center justify-center gap-3 py-16">
              <CheckCircle className="h-10 w-10 text-msp-green" />
              <p className="text-white font-medium">Upload complete</p>
              <p className="text-white/50 text-sm">{uploadedCount.toLocaleString()} rows saved to Supabase</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
