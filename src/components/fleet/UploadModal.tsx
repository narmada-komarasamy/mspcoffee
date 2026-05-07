"use client";

import { useRef, useState } from "react";
import * as XLSX from "xlsx";
import { supabase } from "@/lib/supabase";
import { CloudUpload, X, CheckCircle, AlertCircle, Loader2, FileSpreadsheet } from "lucide-react";

export type FleetRow = {
  date: string;
  month: number;
  year: number;
  vehicle_id: string;
  vehicle_type: string;
  account: string;
  fuel_type: string;
  starting_km: number;
  closing_km: number;
  km_run: number;
  fuel_filled_l: number;
  fuel_cost: number;
  maint_cost: number;
  total_cost: number;
  avg_mileage: number;
  cost_per_km: number;
  maintenance_performed: string;
  remarks: string;
};

const VALID_ACCOUNTS = ["BVE", "HFE", "ME", "ORE", "RSE", "SE"];
const VALID_VEHICLE_TYPES = ["Estate", "Personal"];
const VALID_FUEL_TYPES = ["Diesel", "Petrol"];

interface Props {
  onClose: () => void;
  onSuccess: () => void;
}

function parseDate(raw: string): string | null {
  if (!raw) return null;
  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(raw)) {
    const [m, d, y] = raw.split("/");
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
  const d = new Date(raw);
  if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  return null;
}

function n(v: unknown): number {
  const x = parseFloat(String(v ?? "0").replace(/,/g, ""));
  return isNaN(x) ? 0 : x;
}

function s(v: unknown): string {
  return String(v ?? "").trim();
}

export function UploadModal({ onClose, onSuccess }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<FleetRow[]>([]);
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
      const ws = wb.Sheets["Fleet Data"] ?? wb.Sheets["Fuel Expenses"] ?? wb.Sheets[wb.SheetNames[0]];
      const raw: Record<string, unknown>[] = XLSX.utils.sheet_to_json(ws, { raw: false, defval: "" });

      const parsed: FleetRow[] = [];
      const errs: string[] = [];

      raw.forEach((r, i) => {
        const rowNum = i + 2;

        const dateRaw = s(r["Date"] ?? r["date"]);
        const date = parseDate(dateRaw);
        if (!date) { errs.push(`Row ${rowNum}: missing or invalid Date "${dateRaw}"`); return; }

        const vehicle_id = s(r["Vehicle ID"] ?? r["Vehicle"] ?? r["vehicle_id"]);
        if (!vehicle_id) { errs.push(`Row ${rowNum}: missing Vehicle ID`); return; }

        const vehicle_type = s(r["Vehicle Type"] ?? r["vehicle_type"] ?? "Estate");
        const account = s(r["Account"] ?? r["account"] ?? "");
        const fuel_type = s(r["Fuel Type"] ?? r["fuel_type"] ?? "Diesel");

        const starting_km = n(r["Starting KM"] ?? r["starting_km"] ?? r["Start KM"]);
        const closing_km = n(r["Closing KM"] ?? r["closing_km"] ?? r["Close KM"]);
        const km_run_raw = n(r["KM Run"] ?? r["km_run"] ?? r["KM"]);
        const km_run = km_run_raw || Math.max(0, closing_km - starting_km);

        const fuel_filled_l = n(r["Fuel Filled (L)"] ?? r["Fuel Filled"] ?? r["fuel_filled_l"] ?? r["Litres"] ?? r["Liters"]);
        const fuel_cost = n(r["Fuel Cost"] ?? r["fuel_cost"] ?? r["Fuel Expense"]);
        const maint_cost = n(r["Maint Cost"] ?? r["maint_cost"] ?? r["Maintenance Cost"] ?? r["Maintenance"]);
        const total_cost_raw = n(r["Total Cost"] ?? r["total_cost"]);
        const total_cost = total_cost_raw || fuel_cost + maint_cost;

        const avg_mileage_raw = n(r["Avg Mileage"] ?? r["avg_mileage"] ?? r["Mileage"]);
        const avg_mileage = avg_mileage_raw || (fuel_filled_l > 0 ? parseFloat((km_run / fuel_filled_l).toFixed(2)) : 0);

        const cost_per_km_raw = n(r["Cost Per KM"] ?? r["cost_per_km"] ?? r["Cost/KM"]);
        const cost_per_km = cost_per_km_raw || (km_run > 0 ? parseFloat((total_cost / km_run).toFixed(2)) : 0);

        const maintenance_performed = s(r["Maintenance Performed"] ?? r["maintenance_performed"] ?? "");
        const remarks = s(r["Remarks"] ?? r["remarks"] ?? r["Notes"] ?? "");

        const d = new Date(date);
        const month = d.getMonth() + 1;
        const year = d.getFullYear();

        parsed.push({
          date, month, year, vehicle_id, vehicle_type, account, fuel_type,
          starting_km, closing_km, km_run, fuel_filled_l, fuel_cost, maint_cost,
          total_cost, avg_mileage, cost_per_km, maintenance_performed, remarks,
        });
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
    setStep("uploading");
    const BATCH = 500;
    let count = 0;
    for (let i = 0; i < rows.length; i += BATCH) {
      const batch = rows.slice(i, i + BATCH);
      await supabase.from("fleet_daily").upsert(batch, { onConflict: "date,vehicle_id" });
      count += batch.length;
      setUploadedCount(count);
    }
    setStep("done");
    setTimeout(() => { onSuccess(); onClose(); }, 1200);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-2xl rounded-2xl bg-msp-navy-mid border border-msp-navy-border shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-msp-navy-border">
          <div className="flex items-center gap-3">
            <FileSpreadsheet className="h-5 w-5 text-msp-teal" />
            <h2 className="text-base font-semibold text-white">Upload Fleet Data</h2>
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
              className="flex flex-col items-center justify-center gap-4 border-2 border-dashed border-msp-navy-border rounded-xl py-14 cursor-pointer hover:border-msp-teal/50 hover:bg-msp-teal/5 transition"
            >
              <CloudUpload className="h-12 w-12 text-msp-teal/50" />
              <div className="text-center">
                <p className="text-white font-medium mb-1">Drop your Excel file here</p>
                <p className="text-white/40 text-sm">or click to browse · .xlsx or .xls</p>
              </div>
              <p className="text-xs text-white/30 text-center">
                Expected columns: Date, Vehicle ID, Vehicle Type, Account, Fuel Type,<br />
                Starting KM, Closing KM, Fuel Filled (L), Fuel Cost, Maint Cost, Remarks
              </p>
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
                <button
                  onClick={() => { setStep("idle"); setRows([]); setErrors([]); }}
                  className="text-xs text-white/40 hover:text-white transition"
                >
                  Change file
                </button>
              </div>

              {errors.length > 0 && (
                <div className="rounded-lg bg-yellow-500/10 border border-yellow-500/20 p-3 max-h-24 overflow-y-auto">
                  <div className="flex items-center gap-2 mb-1.5">
                    <AlertCircle className="h-3.5 w-3.5 text-yellow-400 shrink-0" />
                    <span className="text-yellow-400 text-xs font-medium">Rows skipped</span>
                  </div>
                  {errors.map((e, i) => <p key={i} className="text-yellow-300/70 text-xs">{e}</p>)}
                </div>
              )}

              <div className="rounded-lg border border-msp-navy-border overflow-hidden">
                <div className="overflow-x-auto max-h-52">
                  <table className="w-full text-xs" style={{ fontFamily: "monospace" }}>
                    <thead>
                      <tr className="bg-msp-bg text-white/50 uppercase tracking-wide">
                        <th className="px-3 py-2 text-left whitespace-nowrap">Date</th>
                        <th className="px-3 py-2 text-left whitespace-nowrap">Vehicle</th>
                        <th className="px-3 py-2 text-left whitespace-nowrap">Account</th>
                        <th className="px-3 py-2 text-left whitespace-nowrap">Fuel</th>
                        <th className="px-3 py-2 text-right whitespace-nowrap">KM Run</th>
                        <th className="px-3 py-2 text-right whitespace-nowrap">Litres</th>
                        <th className="px-3 py-2 text-right whitespace-nowrap">Fuel ₹</th>
                        <th className="px-3 py-2 text-right whitespace-nowrap">Maint ₹</th>
                        <th className="px-3 py-2 text-right whitespace-nowrap">Total ₹</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.slice(0, 50).map((r, i) => (
                        <tr key={i} className="border-t border-msp-navy-light text-white/80">
                          <td className="px-3 py-1.5 whitespace-nowrap">{r.date}</td>
                          <td className="px-3 py-1.5 whitespace-nowrap text-msp-teal">{r.vehicle_id}</td>
                          <td className="px-3 py-1.5 whitespace-nowrap">{r.account}</td>
                          <td className="px-3 py-1.5 whitespace-nowrap">{r.fuel_type}</td>
                          <td className="px-3 py-1.5 text-right">{r.km_run.toLocaleString()}</td>
                          <td className="px-3 py-1.5 text-right">{r.fuel_filled_l.toLocaleString()}</td>
                          <td className="px-3 py-1.5 text-right">{r.fuel_cost.toLocaleString()}</td>
                          <td className="px-3 py-1.5 text-right">{r.maint_cost.toLocaleString()}</td>
                          <td className="px-3 py-1.5 text-right text-msp-gold-light">{r.total_cost.toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {rows.length > 50 && (
                  <div className="px-3 py-2 text-center text-xs text-white/30 border-t border-msp-navy-light">
                    +{(rows.length - 50).toLocaleString()} more rows
                  </div>
                )}
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={onClose}
                  className="flex-1 px-4 py-2.5 rounded-lg border border-msp-navy-border text-white/60 text-sm hover:bg-white/5 transition"
                >
                  Cancel
                </button>
                <button
                  onClick={handleUpload}
                  disabled={rows.length === 0}
                  className="flex-1 px-4 py-2.5 rounded-lg bg-msp-teal text-msp-bg text-sm font-semibold hover:opacity-90 transition disabled:opacity-40"
                >
                  Upload {rows.length.toLocaleString()} rows
                </button>
              </div>
            </div>
          )}

          {step === "uploading" && (
            <div className="flex flex-col items-center justify-center gap-4 py-16">
              <Loader2 className="h-10 w-10 text-msp-teal animate-spin" />
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
