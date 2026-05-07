"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { X, Trash2, Save, Loader2 } from "lucide-react";

const ESTATES = ["Gowri", "Hidden Falls", "Moganad", "Orchardale", "Stanmore", "Vyapurikuttai"];

export type RainfallRecord = {
  id?: number;
  date: string;
  estate: string;
  rainfall_mm: number;
  inches: number;
};

interface Props {
  record: RainfallRecord | null; // null = new record
  onClose: () => void;
  onSuccess: () => void;
}

export function RecordModal({ record, onClose, onSuccess }: Props) {
  const isEdit = record?.id != null;
  const [form, setForm] = useState<RainfallRecord>(
    record ?? { date: new Date().toISOString().slice(0, 10), estate: "Gowri", rainfall_mm: 0, inches: 0 }
  );
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState("");

  const set = (field: keyof RainfallRecord, value: string | number) => {
    setForm((prev) => {
      const next = { ...prev, [field]: value };
      if (field === "rainfall_mm") {
        next.inches = parseFloat((Number(value) * 0.0394).toFixed(3));
      }
      if (field === "inches") {
        next.rainfall_mm = parseFloat((Number(value) / 0.0394).toFixed(1));
      }
      return next;
    });
  };

  const handleSave = async () => {
    setError("");
    if (!form.date || !form.estate) { setError("Date and estate are required"); return; }
    setSaving(true);
    const payload = { date: form.date, estate: form.estate, rainfall_mm: form.rainfall_mm, inches: form.inches };
    const { error: err } = isEdit
      ? await supabase.from("rainfall").update(payload).eq("id", record!.id!)
      : await supabase.from("rainfall").insert(payload);
    setSaving(false);
    if (err) { setError(err.message); return; }
    onSuccess();
    onClose();
  };

  const handleDelete = async () => {
    if (!confirmDelete) { setConfirmDelete(true); return; }
    setDeleting(true);
    await supabase.from("rainfall").delete().eq("id", record!.id!);
    setDeleting(false);
    onSuccess();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-md rounded-2xl bg-msp-card border border-white/10 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <h2 className="text-base font-semibold text-white">
            {isEdit ? "Edit Record" : "Add Rainfall Record"}
          </h2>
          <button onClick={onClose} className="text-white/40 hover:text-white transition">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {/* Date */}
          <div>
            <label className="block text-xs text-white/50 uppercase tracking-widest mb-2">Date</label>
            <input
              type="date"
              value={form.date}
              onChange={(e) => set("date", e.target.value)}
              className="w-full bg-msp-surface border border-white/10 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-msp-teal-light/50"
            />
          </div>

          {/* Estate */}
          <div>
            <label className="block text-xs text-white/50 uppercase tracking-widest mb-2">Estate</label>
            <select
              value={form.estate}
              onChange={(e) => set("estate", e.target.value)}
              className="w-full bg-msp-surface border border-white/10 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-msp-teal-light/50 appearance-none"
            >
              {ESTATES.map((e) => <option key={e} value={e}>{e}</option>)}
            </select>
          </div>

          {/* mm + inches */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-white/50 uppercase tracking-widest mb-2">Rainfall (mm)</label>
              <input
                type="number"
                min="0"
                step="0.1"
                value={form.rainfall_mm}
                onChange={(e) => set("rainfall_mm", parseFloat(e.target.value) || 0)}
                className="w-full bg-msp-surface border border-white/10 rounded-lg px-3 py-2.5 text-msp-teal-light text-sm focus:outline-none focus:border-msp-teal-light/50"
              />
            </div>
            <div>
              <label className="block text-xs text-white/50 uppercase tracking-widest mb-2">Inches</label>
              <input
                type="number"
                min="0"
                step="0.001"
                value={form.inches}
                onChange={(e) => set("inches", parseFloat(e.target.value) || 0)}
                className="w-full bg-msp-surface border border-white/10 rounded-lg px-3 py-2.5 text-white/70 text-sm focus:outline-none focus:border-msp-teal-light/50"
              />
            </div>
          </div>

          {error && <p className="text-msp-danger text-sm">{error}</p>}

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            {isEdit && (
              <button
                onClick={handleDelete}
                disabled={deleting}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition ${
                  confirmDelete
                    ? "bg-msp-danger text-white hover:opacity-90"
                    : "border border-msp-danger/30 text-msp-danger hover:bg-msp-danger/10"
                }`}
              >
                {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                {confirmDelete ? "Confirm delete" : "Delete"}
              </button>
            )}
            <button onClick={onClose} className="flex-1 px-4 py-2.5 rounded-xl border border-white/10 text-white/60 text-sm hover:bg-white/5 transition">
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-msp-teal-light text-msp-bg text-sm font-semibold hover:opacity-90 transition disabled:opacity-40"
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
