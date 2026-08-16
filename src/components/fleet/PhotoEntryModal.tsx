"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Camera, CheckCircle2, Loader2, Save, Sparkles, X } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { FleetRecord } from "./RecordModal";

type Row = FleetRecord & { id: number };

type Props = {
  rows: Row[];
  vehicles: string[];
  onClose: () => void;
  onSuccess: () => void;
};

type Draft = FleetRecord & {
  vendor: string;
  confidence: string;
  parser_notes: string;
};

type Validation = {
  tone: "ok" | "warn" | "error";
  text: string;
};

const ACCOUNTS = ["BVE", "HFE", "ME", "ORE", "RSE", "SE"];
const VEHICLE_TYPES = ["Estate", "Personal"];
const FUEL_TYPES = ["Diesel", "Petrol"];

const emptyDraft: Draft = {
  date: new Date().toISOString().slice(0, 10),
  vehicle_id: "",
  vehicle_type: "Estate",
  account: "BVE",
  fuel_type: "Diesel",
  starting_km: 0,
  closing_km: 0,
  km_run: 0,
  fuel_filled_l: 0,
  fuel_cost: 0,
  maint_cost: 0,
  total_cost: 0,
  avg_mileage: 0,
  cost_per_km: 0,
  maintenance_performed: "",
  remarks: "",
  vendor: "",
  confidence: "",
  parser_notes: "",
};

function toBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? "").split(",")[1] ?? "");
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function n(v: unknown) {
  return Number(v) || 0;
}

function derive(form: Draft): Draft {
  const km_run = Math.max(0, n(form.closing_km) - n(form.starting_km));
  const total_cost = n(form.fuel_cost) + n(form.maint_cost);
  const avg_mileage = n(form.fuel_filled_l) > 0 ? Number((km_run / n(form.fuel_filled_l)).toFixed(2)) : 0;
  const cost_per_km = km_run > 0 ? Number((total_cost / km_run).toFixed(2)) : 0;
  return { ...form, km_run, total_cost, avg_mileage, cost_per_km };
}

function nearestPriorRow(rows: Row[], draft: Draft) {
  const vehicleRows = rows
    .filter((row) => row.vehicle_id === draft.vehicle_id)
    .sort((a, b) => `${a.date}-${a.id}`.localeCompare(`${b.date}-${b.id}`));

  const beforeDate = vehicleRows.filter((row) => row.date <= draft.date);
  return beforeDate.at(-1) ?? vehicleRows.at(-1) ?? null;
}

function priorClosingKm(rows: Row[], draft: Draft, vehicle_id = draft.vehicle_id, date = draft.date) {
  if (!vehicle_id) return 0;
  const prior = nearestPriorRow(rows, { ...draft, vehicle_id, date });
  return prior ? n(prior.closing_km) : 0;
}

function buildValidation(rows: Row[], draft: Draft): Validation[] {
  const checks: Validation[] = [];
  const sameDate = rows.find((row) => row.vehicle_id === draft.vehicle_id && row.date === draft.date);
  const prior = nearestPriorRow(rows, draft);

  if (!draft.vehicle_id) checks.push({ tone: "error", text: "Vehicle is required before approval." });
  if (!draft.date) checks.push({ tone: "error", text: "Date is required before approval." });
  if (n(draft.closing_km) <= n(draft.starting_km)) checks.push({ tone: "error", text: "Closing KM must be greater than Starting KM." });
  if (n(draft.fuel_filled_l) <= 0) checks.push({ tone: "error", text: "Fuel filled must be greater than 0 L." });
  if (n(draft.fuel_cost) <= 0) checks.push({ tone: "warn", text: "Fuel cost is empty or zero. Check the bill before saving." });

  if (sameDate) {
    checks.push({ tone: "warn", text: `A row already exists for ${draft.vehicle_id} on ${draft.date}. Approval will update that date/vehicle row.` });
  }

  if (prior && n(prior.closing_km) > 0 && n(draft.starting_km) > 0) {
    const gap = n(draft.starting_km) - n(prior.closing_km);
    if (gap === 0) {
      checks.push({ tone: "ok", text: `Starting KM matches previous closing KM (${prior.closing_km}).` });
    } else {
      checks.push({ tone: "warn", text: `Starting KM differs from previous closing KM by ${gap.toLocaleString("en-IN")} km.` });
    }
  }

  if (draft.avg_mileage > 0) {
    if (draft.avg_mileage < 5 || draft.avg_mileage > 25) {
      checks.push({ tone: "warn", text: `Mileage is ${draft.avg_mileage} km/L, outside the normal review band.` });
    } else {
      checks.push({ tone: "ok", text: `Mileage looks plausible at ${draft.avg_mileage} km/L.` });
    }
  }

  const lastFuel = rows
    .filter((row) => row.vehicle_id === draft.vehicle_id && n(row.fuel_cost) > 0 && n(row.fuel_filled_l) > 0)
    .sort((a, b) => b.date.localeCompare(a.date))[0];

  if (lastFuel && n(draft.fuel_cost) > 0 && n(draft.fuel_filled_l) > 0) {
    const currentRate = n(draft.fuel_cost) / n(draft.fuel_filled_l);
    const lastRate = n(lastFuel.fuel_cost) / n(lastFuel.fuel_filled_l);
    const delta = lastRate > 0 ? Math.abs(currentRate - lastRate) / lastRate : 0;
    checks.push({
      tone: delta > 0.1 ? "warn" : "ok",
      text: `Fuel rate is ₹${currentRate.toFixed(2)}/L; last recorded rate was ₹${lastRate.toFixed(2)}/L.`,
    });
  }

  if (!checks.some((check) => check.tone === "error" || check.tone === "warn")) {
    checks.push({ tone: "ok", text: "No duplicate, sequence, or fuel-rate issues detected." });
  }

  return checks;
}

export function PhotoEntryModal({ rows, vehicles, onClose, onSuccess }: Props) {
  const [odometerFile, setOdometerFile] = useState<File | null>(null);
  const [billFile, setBillFile] = useState<File | null>(null);
  const [odometerPreview, setOdometerPreview] = useState("");
  const [billPreview, setBillPreview] = useState("");
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [extracting, setExtracting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const odoUrl = odometerFile ? URL.createObjectURL(odometerFile) : "";
    const billUrl = billFile ? URL.createObjectURL(billFile) : "";
    setOdometerPreview(odoUrl);
    setBillPreview(billUrl);
    return () => {
      if (odoUrl) URL.revokeObjectURL(odoUrl);
      if (billUrl) URL.revokeObjectURL(billUrl);
    };
  }, [odometerFile, billFile]);

  const validation = useMemo(() => buildValidation(rows, draft), [rows, draft]);
  const hasBlockingError = validation.some((check) => check.tone === "error");

  const set = <K extends keyof Draft>(field: K, value: Draft[K]) => {
    setDraft((prev) => derive({ ...prev, [field]: value }));
  };

  const num = (field: keyof Draft) => (e: React.ChangeEvent<HTMLInputElement>) => {
    set(field, (parseFloat(e.target.value) || 0) as Draft[typeof field]);
  };

  const setDate = (date: string) => {
    setDraft((prev) => {
      const starting_km = n(prev.starting_km) > 0 ? prev.starting_km : priorClosingKm(rows, prev, prev.vehicle_id, date);
      return derive({ ...prev, date, starting_km });
    });
  };

  const setVehicle = (vehicle_id: string) => {
    setDraft((prev) => {
      const starting_km = n(prev.starting_km) > 0 ? prev.starting_km : priorClosingKm(rows, prev, vehicle_id, prev.date);
      return derive({ ...prev, vehicle_id, starting_km });
    });
  };

  const handleExtract = async () => {
    setError("");
    if (!odometerFile && !billFile) {
      setError("Upload at least one odometer or fuel bill photo.");
      return;
    }

    setExtracting(true);
    try {
      const [odometerBase64, billBase64] = await Promise.all([
        odometerFile ? toBase64(odometerFile) : Promise.resolve(""),
        billFile ? toBase64(billFile) : Promise.resolve(""),
      ]);

      const response = await fetch("/api/parse-fleet-entry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          odometerBase64,
          odometerMediaType: odometerFile?.type,
          billBase64,
          billMediaType: billFile?.type,
          vehicleHints: vehicles,
        }),
      });

      const parsed = await response.json();
      if (!response.ok) throw new Error(parsed.error || "Could not extract details from photos.");

      const nextDate = parsed.date || draft.date;
      const nextVehicle = parsed.vehicle_id || draft.vehicle_id;
      const parsedStartingKm = Number(parsed.starting_km) || 0;
      const fallbackStartingKm = priorClosingKm(rows, draft, nextVehicle, nextDate);
      const next = derive({
        ...draft,
        date: nextDate,
        vehicle_id: nextVehicle,
        fuel_type: FUEL_TYPES.includes(parsed.fuel_type) ? parsed.fuel_type : draft.fuel_type,
        starting_km: parsedStartingKm || fallbackStartingKm || draft.starting_km,
        closing_km: Number(parsed.closing_km) || draft.closing_km,
        fuel_filled_l: Number(parsed.fuel_filled_l) || draft.fuel_filled_l,
        fuel_cost: Number(parsed.fuel_cost) || draft.fuel_cost,
        vendor: parsed.vendor || "",
        confidence: parsed.confidence || "low",
        parser_notes: parsed.notes || "",
      });

      setDraft(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not extract details from photos.");
    } finally {
      setExtracting(false);
    }
  };

  const handleApprove = async () => {
    setError("");
    if (hasBlockingError) {
      setError("Fix the blocking validation errors before approval.");
      return;
    }

    setSaving(true);
    const d = new Date(draft.date);
    const remarks = [
      draft.remarks,
      draft.vendor ? `Fuel bill: ${draft.vendor}` : "",
      draft.confidence ? `Photo extraction confidence: ${draft.confidence}` : "",
      draft.parser_notes ? `Parser notes: ${draft.parser_notes}` : "",
    ].filter(Boolean).join(" | ");

    const payload: FleetRecord = {
      date: draft.date,
      month: d.getMonth() + 1,
      year: d.getFullYear(),
      vehicle_id: draft.vehicle_id.trim(),
      vehicle_type: draft.vehicle_type,
      account: draft.account,
      fuel_type: draft.fuel_type,
      starting_km: n(draft.starting_km),
      closing_km: n(draft.closing_km),
      km_run: n(draft.km_run),
      fuel_filled_l: n(draft.fuel_filled_l),
      fuel_cost: n(draft.fuel_cost),
      maint_cost: n(draft.maint_cost),
      total_cost: n(draft.total_cost),
      avg_mileage: n(draft.avg_mileage),
      cost_per_km: n(draft.cost_per_km),
      maintenance_performed: draft.maintenance_performed,
      remarks,
    };

    const { error: saveError } = await supabase
      .from("fleet_daily")
      .upsert(payload, { onConflict: "date,vehicle_id" });

    setSaving(false);
    if (saveError) {
      setError(saveError.message);
      return;
    }

    onSuccess();
    onClose();
  };

  const inputCls = "w-full bg-msp-bg border border-msp-navy-border rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-msp-teal/60 transition";
  const labelCls = "block text-[10px] text-white/40 uppercase tracking-widest mb-1.5";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-5xl rounded-2xl bg-msp-navy-mid border border-msp-navy-border shadow-2xl max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-msp-navy-border sticky top-0 bg-msp-navy-mid z-10">
          <div className="flex items-center gap-3">
            <Camera className="h-5 w-5 text-msp-teal" />
            <div>
              <h2 className="text-base font-semibold text-white">Add Fleet Entry from Photos</h2>
              <p className="text-xs text-white/40 mt-0.5">Extract, review, then approve before database update</p>
            </div>
          </div>
          <button onClick={onClose} className="text-white/40 hover:text-white transition">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[0.9fr_1.1fr] gap-5 p-6">
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[
                { title: "Odometer Photo", file: odometerFile, preview: odometerPreview, onChange: setOdometerFile },
                { title: "Fuel Bill Photo", file: billFile, preview: billPreview, onChange: setBillFile },
              ].map((item) => (
                <label key={item.title} className="rounded-xl border border-dashed border-msp-navy-border bg-msp-bg/60 p-4 cursor-pointer hover:border-msp-teal/60 transition">
                  <span className={labelCls}>{item.title}</span>
                  <div className="h-40 rounded-lg border border-msp-navy-border bg-black/20 overflow-hidden flex items-center justify-center">
                    {item.preview ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={item.preview} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <div className="text-center text-white/35 text-sm px-4">
                        <Camera className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        Click to upload
                      </div>
                    )}
                  </div>
                  <p className="mt-2 text-xs text-white/35 truncate">{item.file?.name || "JPEG, PNG, WebP up to 10 MB"}</p>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/gif,image/webp"
                    className="hidden"
                    onChange={(e) => item.onChange(e.target.files?.[0] ?? null)}
                  />
                </label>
              ))}
            </div>

            <button
              onClick={handleExtract}
              disabled={extracting || (!odometerFile && !billFile)}
              className="w-full flex items-center justify-center gap-2 rounded-lg bg-msp-teal text-msp-bg px-4 py-2.5 text-sm font-semibold hover:opacity-90 transition disabled:opacity-40"
            >
              {extracting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              Extract details
            </button>

            <div className="rounded-xl border border-msp-navy-border bg-msp-bg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className={labelCls}>Review Checks</span>
                <span className="text-xs text-white/40">{draft.confidence ? `AI confidence: ${draft.confidence}` : "Awaiting extraction"}</span>
              </div>
              {validation.map((check, index) => (
                <div key={`${check.text}-${index}`} className="grid grid-cols-[18px_1fr] gap-2 text-sm">
                  {check.tone === "ok" ? (
                    <CheckCircle2 className="h-4 w-4 text-msp-green mt-0.5" />
                  ) : (
                    <AlertTriangle className={`h-4 w-4 mt-0.5 ${check.tone === "error" ? "text-msp-danger" : "text-msp-gold-light"}`} />
                  )}
                  <span className={check.tone === "error" ? "text-msp-danger" : "text-white/70"}>{check.text}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Date</label>
                <input type="date" value={draft.date} onChange={(e) => setDate(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Vehicle ID</label>
                <input list="photo-vehicle-list" value={draft.vehicle_id} onChange={(e) => setVehicle(e.target.value)} className={`${inputCls} text-msp-teal`} />
                <datalist id="photo-vehicle-list">
                  {vehicles.map((vehicle) => <option key={vehicle} value={vehicle} />)}
                </datalist>
              </div>
              <div>
                <label className={labelCls}>Vehicle Type</label>
                <select value={draft.vehicle_type} onChange={(e) => set("vehicle_type", e.target.value)} className={`${inputCls} appearance-none`}>
                  {VEHICLE_TYPES.map((type) => <option key={type}>{type}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>Account</label>
                <select value={draft.account} onChange={(e) => set("account", e.target.value)} className={`${inputCls} appearance-none`}>
                  {ACCOUNTS.map((account) => <option key={account}>{account}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>Fuel Type</label>
                <select value={draft.fuel_type} onChange={(e) => set("fuel_type", e.target.value)} className={`${inputCls} appearance-none`}>
                  {FUEL_TYPES.map((fuelType) => <option key={fuelType}>{fuelType}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>Vendor</label>
                <input value={draft.vendor} onChange={(e) => set("vendor", e.target.value)} className={inputCls} />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className={labelCls}>Starting KM</label>
                <input type="number" min="0" value={draft.starting_km} onChange={num("starting_km")} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Closing KM</label>
                <input type="number" min="0" value={draft.closing_km} onChange={num("closing_km")} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>KM Run</label>
                <input type="number" readOnly value={draft.km_run} className={`${inputCls} text-msp-teal opacity-70 cursor-not-allowed`} />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className={labelCls}>Fuel Filled (L)</label>
                <input type="number" min="0" step="0.01" value={draft.fuel_filled_l} onChange={num("fuel_filled_l")} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Fuel Cost (₹)</label>
                <input type="number" min="0" step="0.01" value={draft.fuel_cost} onChange={num("fuel_cost")} className={`${inputCls} text-msp-gold-light`} />
              </div>
              <div>
                <label className={labelCls}>Total Cost</label>
                <input type="number" readOnly value={draft.total_cost} className={`${inputCls} text-msp-gold-light opacity-70 cursor-not-allowed`} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 bg-msp-bg rounded-lg p-3">
              <div>
                <p className={labelCls}>Avg Mileage (km/L)</p>
                <p className="text-msp-green text-lg font-semibold">{draft.avg_mileage}</p>
              </div>
              <div>
                <p className={labelCls}>Cost per KM (₹)</p>
                <p className="text-msp-teal text-lg font-semibold">{draft.cost_per_km}</p>
              </div>
            </div>

            <div>
              <label className={labelCls}>Remarks</label>
              <input value={draft.remarks} onChange={(e) => set("remarks", e.target.value)} placeholder="Optional review note" className={inputCls} />
            </div>

            {draft.parser_notes && (
              <div className="rounded-lg bg-msp-bg border border-msp-navy-border p-3 text-sm text-white/55">
                <span className={labelCls}>Parser Notes</span>
                {draft.parser_notes}
              </div>
            )}

            {error && <p className="text-msp-danger text-sm">{error}</p>}

            <div className="flex gap-3 pt-1">
              <button onClick={onClose} className="flex-1 px-4 py-2.5 rounded-lg border border-msp-navy-border text-white/60 text-sm hover:bg-white/5 transition">
                Cancel
              </button>
              <button
                onClick={handleApprove}
                disabled={saving || hasBlockingError}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-msp-teal text-msp-bg text-sm font-semibold hover:opacity-90 transition disabled:opacity-40"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Approve & update database
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
