"use client";

import { BILL_BUCKET } from '@/lib/fleet/maintenance';
import { signedStorageUrl } from '@/lib/storage/urls';

export type MaintenanceMatch = {
  id: number;
  date: string;
  vehicle_id: string;
  maint_cost: number | string;
  maintenance_vendor?: string;
  maintenance_bill_path?: string;
  maintenance_bill_name?: string;
};

export function MaintenanceDuplicateReview({ matches, hasBill, checked, disabled, onConfirm, onSelect }: {
  matches: MaintenanceMatch[]; hasBill: boolean; checked: boolean; disabled: boolean;
  onConfirm: (checked: boolean) => void; onSelect: (id: number, attach: boolean) => void;
}) {
  if (!matches.length) return null;
  return <section aria-label="Possible duplicate maintenance entries" className="rounded-xl border border-amber-500/50 bg-amber-950/30 p-4 text-sm text-white/90 space-y-3">
    <h3 className="font-semibold text-amber-200">Possible duplicate expense</h3>
    <p>This vehicle already has maintenance entries for the same amount. Check these dates before adding another expense.</p>
    <ul className="space-y-3">{matches.map(row => <li key={row.id} className="border-t border-white/10 pt-3">
      <p className="font-medium">{row.vehicle_id} · {row.date} · ₹{Number(row.maint_cost).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
      {row.maintenance_vendor && <p className="text-white/60">{row.maintenance_vendor}</p>}
      <div className="flex flex-wrap gap-3 mt-1">
        {row.maintenance_bill_path && <a className="text-msp-teal underline" href={signedStorageUrl(BILL_BUCKET, row.maintenance_bill_path)} target="_blank" rel="noopener noreferrer">View existing bill</a>}
        <button type="button" disabled={disabled} className="text-msp-teal underline disabled:opacity-40" onClick={() => onSelect(row.id, hasBill && !row.maintenance_bill_path)}>
          {hasBill && !row.maintenance_bill_path ? 'Attach bill to this existing entry' : 'Open existing entry'}
        </button>
      </div>
    </li>)}</ul>
    <label className="flex items-start gap-2"><input type="checkbox" checked={checked} disabled={disabled} onChange={event => onConfirm(event.target.checked)} className="mt-1" />
      <span>I checked the matching entries. This is a genuinely separate expense.</span></label>
  </section>;
}
