"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { X, Trash2, Save, Loader2, Upload, FileText } from "lucide-react";

import { BILL_BUCKET, billFileError } from "@/lib/fleet/maintenance";
import { signedStorageUrl } from "@/lib/storage/urls";
import { startingKmFor } from "@/lib/fleet/odometer";

const ACCOUNTS = ["BVE", "HFE", "ME", "ORE", "RSE", "SE"];
const VEHICLE_TYPES = ["Estate", "Personal"];
const FUEL_TYPES = ["Diesel", "Petrol"];

export type FleetRecord = {
  id?: number;
  date: string;
  month?: number;
  year?: number;
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
  maintenance_vendor?: string;
  maintenance_bill_path?: string;
  maintenance_bill_name?: string;
  maintenance_bill_text?: string;
};

interface Props {
  record: FleetRecord | null; // null = new record
  rows: FleetRecord[];
  vehicles: string[];         // list of known vehicle IDs for datalist
  onClose: () => void;
  onSuccess: () => void;
}

const empty: FleetRecord = {
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
};

function derive(f: FleetRecord): FleetRecord {
  const km_run = Math.max(0, f.closing_km - f.starting_km);
  const total_cost = Number(f.fuel_cost || 0) + Number(f.maint_cost || 0);
  const avg_mileage = f.fuel_filled_l > 0 ? parseFloat((km_run / f.fuel_filled_l).toFixed(2)) : 0;
  const cost_per_km = km_run > 0 ? parseFloat((total_cost / km_run).toFixed(2)) : 0;
  return { ...f, km_run, total_cost, avg_mileage, cost_per_km };
}

export function RecordModal({ record, rows, vehicles, onClose, onSuccess }: Props) {
  const isEdit = record?.id != null;
  const [form, setForm] = useState<FleetRecord>(() => derive(record ?? empty));
  const fileInput = useRef<HTMLInputElement>(null);
  const [bill, setBill] = useState<File | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [billNotice, setBillNotice] = useState("");
  const [billPreview, setBillPreview] = useState("");
  useEffect(() => {
    const url = bill ? URL.createObjectURL(bill) : "";
    setBillPreview(url);
    return () => { if (url) URL.revokeObjectURL(url); };
  }, [bill]);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState("");

  const set = <K extends keyof FleetRecord>(field: K, value: FleetRecord[K]) => {
    setForm((prev) => {
      const next = { ...prev, [field]: value };
      if (!isEdit && (field === "vehicle_id" || field === "date") && prev[field] !== value) {
        next.starting_km = startingKmFor(rows, next.vehicle_id, next.date);
      }
      return derive(next);
    });
  };

  const num = (field: keyof FleetRecord) => (e: React.ChangeEvent<HTMLInputElement>) =>
    set(field, (parseFloat(e.target.value) || 0) as FleetRecord[typeof field]);

  const handleSave = async () => {
    setError("");
    if (!form.date) { setError("Date is required"); return; }
    if (!form.vehicle_id.trim()) { setError("Vehicle ID is required"); return; }

    setSaving(true);
    try {
      const body = new FormData();
      body.set("record", JSON.stringify(form));
      if (bill) body.set("file", bill);
      const response = await fetch("/api/fleet/maintenance-bill", { method: "POST", body });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not save the fleet entry.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the fleet entry.");
      return;
    } finally {
      setSaving(false);
    }
    onSuccess();
    onClose();
  };

  const uploadBill = async (file: File) => {
    const validation = billFileError(file);
    if (validation) { setError(validation); return; }
    setError("");
    setBill(file);
    setBillNotice("");
    setExtracting(true);
    // A replacement bill must never keep the previous bill's searchable text.
    setForm(prev => ({ ...prev, maintenance_bill_text: "" }));
    try {
      const body = new FormData();
      body.set("file", file);
      const response = await fetch("/api/fleet/maintenance-bill/extract", { method: "POST", body });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not extract bill details.");
      setForm(prev => derive({ ...prev,
        ...(result.total !== null ? { maint_cost: result.total } : {}),
        ...(result.date ? { date: result.date } : {}),
        ...(!isEdit && result.date && result.date !== prev.date
          ? { starting_km: startingKmFor(rows, prev.vehicle_id, result.date) } : {}),
        maintenance_vendor: result.workshop || "",
        maintenance_performed: result.maintenance_items || "",
        maintenance_bill_text: result.bill_text || "",
      }));
      setBillNotice(`Bill read. Review the date, workshop, maintenance items and costs before saving.${result.total === null ? " Total could not be read; enter maintenance cost manually." : ""}${result.notes ? ` ${result.notes}` : ""}`);
    } catch (err) {
      setBillNotice(err instanceof Error ? err.message : "Could not read bill details. Enter them manually.");
    } finally {
      setExtracting(false);
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) { setConfirmDelete(true); return; }
    setDeleting(true);
    const { error } = await supabase.from("fleet_daily").delete().eq("id", record!.id!);
    setDeleting(false);
    if (error) { setError(error.message); return; }
    onSuccess();
    onClose();
  };

  const inputCls = "w-full bg-msp-bg border border-msp-navy-border rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-msp-teal/60 transition";
  const labelCls = "block text-[10px] text-white/40 uppercase tracking-widest mb-1.5";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-2xl rounded-2xl bg-msp-navy-mid border border-msp-navy-border shadow-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-msp-navy-border sticky top-0 bg-msp-navy-mid z-10">
          <h2 className="text-base font-semibold text-white">
            {isEdit ? "Edit Record" : "Add Fleet Record"}
          </h2>
          <button onClick={onClose} disabled={saving || extracting || deleting} aria-label="Close record" className="text-white/40 hover:text-white transition">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          <div className="rounded-xl border border-msp-navy-border bg-msp-bg p-4 space-y-3">
            <button type="button" onClick={() => fileInput.current?.click()} disabled={extracting || saving || deleting}
              className="flex items-center gap-2 text-sm text-msp-teal disabled:opacity-40">
              {extracting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              {extracting ? "Reading maintenance bill…" : "Upload Maintenance Bill"}
            </button>
            <input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp,application/pdf" className="hidden"
              onChange={e => { const file = e.target.files?.[0]; e.target.value = ""; if (file) void uploadBill(file); }} />
            <p className="text-xs text-white/50">Photo or PDF, up to 4 MB. Fills maintenance cost and updates total cost. Review before saving.</p>
            {bill && <p className="text-sm text-white/70"><a href={billPreview} target="_blank" rel="noopener noreferrer" className="text-msp-teal">View {bill.name}</a> · attached when you save</p>}
            {!bill && form.maintenance_bill_path && <a className="flex items-center gap-2 text-sm text-msp-teal" target="_blank" rel="noopener noreferrer"
              href={signedStorageUrl(BILL_BUCKET, form.maintenance_bill_path)}><FileText className="h-4 w-4" />View original bill{form.maintenance_bill_name ? ` · ${form.maintenance_bill_name}` : ""}</a>}
            {billNotice && <p role="status" className="text-sm text-msp-gold-light">{billNotice}</p>}
          </div>
          <fieldset disabled={extracting || saving || deleting} className="space-y-5 disabled:opacity-60">
          {/* Row 1: Date + Vehicle ID */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Date</label>
              <input type="date" value={form.date}
                onChange={(e) => set("date", e.target.value)}
                className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Vehicle ID</label>
              <input
                list="vehicle-list"
                value={form.vehicle_id}
                onChange={(e) => set("vehicle_id", e.target.value)}
                placeholder="e.g. TN-01-AB-1234"
                className={`${inputCls} text-msp-teal`}
              />
              <datalist id="vehicle-list">
                {vehicles.map((v) => <option key={v} value={v} />)}
              </datalist>
            </div>
          </div>

          {/* Row 2: Vehicle Type + Account + Fuel Type */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className={labelCls}>Vehicle Type</label>
              <select value={form.vehicle_type}
                onChange={(e) => set("vehicle_type", e.target.value)}
                className={`${inputCls} appearance-none`}>
                {VEHICLE_TYPES.map((t) => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Account</label>
              <select value={form.account}
                onChange={(e) => set("account", e.target.value)}
                className={`${inputCls} appearance-none`}>
                {ACCOUNTS.map((a) => <option key={a}>{a}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Fuel Type</label>
              <select value={form.fuel_type}
                onChange={(e) => set("fuel_type", e.target.value)}
                className={`${inputCls} appearance-none`}>
                {FUEL_TYPES.map((f) => <option key={f}>{f}</option>)}
              </select>
            </div>
          </div>

          {/* Row 3: KM readings */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label htmlFor="fleet-starting-km" className={labelCls}>Starting KM</label>
              <input id="fleet-starting-km" type="number" min="0" value={form.starting_km}
                onChange={num("starting_km")} className={inputCls} />
              {!isEdit && form.vehicle_id && <p className="mt-1 text-xs text-white/50">
                {startingKmFor(rows, form.vehicle_id, form.date) > 0
                  ? "Uses the previous closing KM. You can edit it."
                  : "No earlier closing KM found. Enter the starting KM."}
              </p>}
            </div>
            <div>
              <label className={labelCls}>Closing KM</label>
              <input type="number" min="0" value={form.closing_km}
                onChange={num("closing_km")} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>KM Run (auto)</label>
              <input type="number" readOnly value={form.km_run}
                className={`${inputCls} text-msp-teal opacity-70 cursor-not-allowed`} />
            </div>
          </div>

          {/* Row 4: Fuel filled + costs */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Fuel Filled (L)</label>
              <input type="number" min="0" step="0.1" value={form.fuel_filled_l}
                onChange={num("fuel_filled_l")} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Fuel Cost (₹)</label>
              <input type="number" min="0" value={form.fuel_cost}
                onChange={num("fuel_cost")} className={`${inputCls} text-msp-gold-light`} />
            </div>
          </div>

          {/* Row 5: Maintenance */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Maint Cost (₹)</label>
              <input type="number" min="0" step="0.01" value={form.maint_cost}
                onChange={num("maint_cost")} className={`${inputCls} text-msp-danger`} />
            </div>
            <div>
              <label className={labelCls}>Total Cost (auto)</label>
              <input type="number" readOnly value={form.total_cost}
                className={`${inputCls} text-msp-gold-light opacity-70 cursor-not-allowed`} />
            </div>
          </div>

          {/* Row 6: Derived metrics (read-only display) */}
          <div className="grid grid-cols-2 gap-4 bg-msp-bg rounded-lg p-3">
            <div>
              <p className={labelCls}>Avg Mileage (km/L)</p>
              <p className="text-msp-green text-lg font-semibold">{form.avg_mileage}</p>
            </div>
            <div>
              <p className={labelCls}>Cost per KM (₹)</p>
              <p className="text-msp-teal text-lg font-semibold">{form.cost_per_km}</p>
            </div>
          </div>

          <div>
            <label htmlFor="maintenance-vendor" className={labelCls}>Workshop / Vendor</label>
            <input id="maintenance-vendor" value={form.maintenance_vendor || ""}
              onChange={e => set("maintenance_vendor", e.target.value)} placeholder="Workshop name" className={inputCls} />
          </div>

          {/* Maintenance performed */}
          <div>
            <label className={labelCls}>Maintenance Performed</label>
            <input type="text" value={form.maintenance_performed}
              onChange={(e) => set("maintenance_performed", e.target.value)}
              placeholder="e.g. Oil change, tyre rotation…"
              className={inputCls} />
          </div>

          {/* Remarks */}
          <div>
            <label className={labelCls}>Remarks</label>
            <input type="text" value={form.remarks}
              onChange={(e) => set("remarks", e.target.value)}
              placeholder="Optional notes"
              className={inputCls} />
          </div>

          </fieldset>
          {error && <p className="text-msp-danger text-sm">{error}</p>}

          {/* Actions */}
          <div className="flex gap-3 pt-1">
            {isEdit && (
              <button
                onClick={handleDelete}
                disabled={deleting || saving || extracting}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition ${
                  confirmDelete
                    ? "bg-msp-danger text-white hover:opacity-90"
                    : "border border-msp-danger/30 text-msp-danger hover:bg-msp-danger/10"
                }`}
              >
                {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                {confirmDelete ? "Confirm delete" : "Delete"}
              </button>
            )}
            <button
              onClick={onClose}
              disabled={saving || extracting || deleting}
              className="flex-1 px-4 py-2.5 rounded-lg border border-msp-navy-border text-white/60 text-sm hover:bg-white/5 transition"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving || extracting || deleting}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-msp-teal text-msp-bg text-sm font-semibold hover:opacity-90 transition disabled:opacity-40"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {isEdit ? "Save changes" : "Add record"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
