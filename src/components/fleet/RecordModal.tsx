"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { X, Trash2, Save, Loader2 } from "lucide-react";

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
};

interface Props {
  record: FleetRecord | null; // null = new record
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
  const total_cost = f.fuel_cost + f.maint_cost;
  const avg_mileage = f.fuel_filled_l > 0 ? parseFloat((km_run / f.fuel_filled_l).toFixed(2)) : 0;
  const cost_per_km = km_run > 0 ? parseFloat((total_cost / km_run).toFixed(2)) : 0;
  return { ...f, km_run, total_cost, avg_mileage, cost_per_km };
}

export function RecordModal({ record, vehicles, onClose, onSuccess }: Props) {
  const isEdit = record?.id != null;
  const [form, setForm] = useState<FleetRecord>(record ?? empty);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState("");

  const set = <K extends keyof FleetRecord>(field: K, value: FleetRecord[K]) => {
    setForm((prev) => derive({ ...prev, [field]: value }));
  };

  const num = (field: keyof FleetRecord) => (e: React.ChangeEvent<HTMLInputElement>) =>
    set(field, (parseFloat(e.target.value) || 0) as FleetRecord[typeof field]);

  const handleSave = async () => {
    setError("");
    if (!form.date) { setError("Date is required"); return; }
    if (!form.vehicle_id.trim()) { setError("Vehicle ID is required"); return; }

    setSaving(true);
    const d = new Date(form.date);
    const payload = {
      ...form,
      month: d.getMonth() + 1,
      year: d.getFullYear(),
    };
    delete (payload as Partial<FleetRecord>).id;

    const { error: err } = isEdit
      ? await supabase.from("fleet_daily").update(payload).eq("id", record!.id!)
      : await supabase.from("fleet_daily").insert(payload);

    setSaving(false);
    if (err) { setError(err.message); return; }
    onSuccess();
    onClose();
  };

  const handleDelete = async () => {
    if (!confirmDelete) { setConfirmDelete(true); return; }
    setDeleting(true);
    await supabase.from("fleet_daily").delete().eq("id", record!.id!);
    setDeleting(false);
    onSuccess();
    onClose();
  };

  const inputCls = "w-full bg-[#0d1b2a] border border-[#2a3f5a] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#1fc8c8]/60 transition";
  const labelCls = "block text-[10px] text-white/40 uppercase tracking-widest mb-1.5";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-2xl rounded-2xl bg-[#16253a] border border-[#2a3f5a] shadow-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#2a3f5a] sticky top-0 bg-[#16253a] z-10">
          <h2 className="text-base font-semibold text-white">
            {isEdit ? "Edit Record" : "Add Fleet Record"}
          </h2>
          <button onClick={onClose} className="text-white/40 hover:text-white transition">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6 space-y-5">
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
                className={`${inputCls} text-[#1fc8c8]`}
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
              <label className={labelCls}>Starting KM</label>
              <input type="number" min="0" value={form.starting_km}
                onChange={num("starting_km")} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Closing KM</label>
              <input type="number" min="0" value={form.closing_km}
                onChange={num("closing_km")} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>KM Run (auto)</label>
              <input type="number" readOnly value={form.km_run}
                className={`${inputCls} text-[#1fc8c8] opacity-70 cursor-not-allowed`} />
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
                onChange={num("fuel_cost")} className={`${inputCls} text-[#f5a623]`} />
            </div>
          </div>

          {/* Row 5: Maintenance */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Maint Cost (₹)</label>
              <input type="number" min="0" value={form.maint_cost}
                onChange={num("maint_cost")} className={`${inputCls} text-[#e8524a]`} />
            </div>
            <div>
              <label className={labelCls}>Total Cost (auto)</label>
              <input type="number" readOnly value={form.total_cost}
                className={`${inputCls} text-[#f5a623] opacity-70 cursor-not-allowed`} />
            </div>
          </div>

          {/* Row 6: Derived metrics (read-only display) */}
          <div className="grid grid-cols-2 gap-4 bg-[#0d1b2a] rounded-lg p-3">
            <div>
              <p className={labelCls}>Avg Mileage (km/L)</p>
              <p className="text-[#2ecc71] text-lg font-semibold">{form.avg_mileage}</p>
            </div>
            <div>
              <p className={labelCls}>Cost per KM (₹)</p>
              <p className="text-[#1fc8c8] text-lg font-semibold">{form.cost_per_km}</p>
            </div>
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

          {error && <p className="text-red-400 text-sm">{error}</p>}

          {/* Actions */}
          <div className="flex gap-3 pt-1">
            {isEdit && (
              <button
                onClick={handleDelete}
                disabled={deleting}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition ${
                  confirmDelete
                    ? "bg-red-500 text-white hover:bg-red-600"
                    : "border border-red-500/30 text-red-400 hover:bg-red-500/10"
                }`}
              >
                {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                {confirmDelete ? "Confirm delete" : "Delete"}
              </button>
            )}
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2.5 rounded-lg border border-[#2a3f5a] text-white/60 text-sm hover:bg-white/5 transition"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-[#1fc8c8] text-[#0d1b2a] text-sm font-semibold hover:bg-[#17a8a8] transition disabled:opacity-40"
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
