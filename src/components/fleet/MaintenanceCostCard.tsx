"use client";

import { useEffect, useId, useRef, useState, type CSSProperties, type ReactNode } from "react";
import type { FleetRecord } from "./RecordModal";
import { BILL_BUCKET, maintenanceEntries, singleMaintenanceBillPath } from "@/lib/fleet/maintenance";
import { signedStorageUrl } from "@/lib/storage/urls";
import s from "./MaintenanceCostCard.module.css";

type Row = FleetRecord & { id: number };
type Props = {
  rows: Row[];
  selection: string;
  total: number;
  className: string;
  style: CSSProperties;
  children: ReactNode;
  onEdit: (record: Row) => void;
};

const money = (amount: number) => amount.toLocaleString("en-IN", {
  style: "currency", currency: "INR", minimumFractionDigits: 2, maximumFractionDigits: 2,
});

function BillsDialog({ rows, selection, total, onClose, onEdit }: Pick<Props, "rows" | "selection" | "total" | "onEdit"> & { onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const summaryId = useId();
  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => element?.close();
  }, []);
  const entries = maintenanceEntries(rows);
  const attached = entries.filter(row => row.maintenance_bill_path).length;

  return <dialog ref={dialog} className={s.dialog} aria-labelledby={titleId} aria-describedby={summaryId}
    onCancel={event => { event.preventDefault(); onClose(); }}
    onClick={event => { if (event.target === event.currentTarget) onClose(); }}>
    <div className={s.header}>
      <div><h2 id={titleId}>Maintenance bills</h2><p>{selection}</p></div>
      <button type="button" autoFocus onClick={onClose} className={s.close} aria-label="Close maintenance bills">×</button>
    </div>
    <div className={s.body}>
      <p id={summaryId} className={s.summary}>
        <strong>{money(total)}</strong> total · {entries.length} maintenance {entries.length === 1 ? "entry" : "entries"} · {attached} {attached === 1 ? "bill" : "bills"} attached
      </p>
      {entries.length === 0 ? <p className={s.empty}>No maintenance entries for this selection.</p> : <div className={s.tableWrap}>
        <table className={s.table}>
          <caption className={s.srOnly}>Maintenance entries and original bills for {selection}</caption>
          <thead><tr><th scope="col">Date</th><th scope="col">Vehicle</th><th scope="col">Workshop / Work</th><th scope="col">Amount</th><th scope="col">Original bill</th></tr></thead>
          <tbody>{entries.map(row => <tr key={row.id}>
            <td>{new Date(`${row.date}T00:00:00`).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}</td>
            <td>{row.vehicle_id}</td>
            <td><strong>{row.maintenance_vendor || "Workshop not recorded"}</strong>
              {row.maintenance_performed && <p className={s.description}>{row.maintenance_performed}</p>}</td>
            <td className={s.amount}>{money(Number(row.maint_cost) || 0)}</td>
            <td>{row.maintenance_bill_path ? <a className={s.link} href={signedStorageUrl(BILL_BUCKET, row.maintenance_bill_path)} target="_blank" rel="noopener noreferrer"
              aria-label={`View bill for ${row.vehicle_id} on ${row.date}`}>View bill<span className={s.fileName}>{row.maintenance_bill_name}</span></a>
              : <><span className={s.missing}>No bill uploaded</span><button type="button" className={s.addBill}
                onClick={() => { onClose(); onEdit(row); }}>Add bill</button></>}</td>
          </tr>)}</tbody>
          <tfoot><tr><th colSpan={3} scope="row">Total maintenance cost</th><td className={s.amount}>{money(total)}</td><td /></tr></tfoot>
        </table>
      </div>}
      <p className={s.note}>Entries without bills are included in the total. Add a bill through the entry form to keep the original with its record.</p>
    </div>
  </dialog>;
}

export function MaintenanceCostCard({ rows, selection, total, className, style, children, onEdit }: Props) {
  const [open, setOpen] = useState(false);
  const path = singleMaintenanceBillPath(rows);
  const cardClass = `${className} ${s.card}`;
  return <>
    {path ? <a className={cardClass} style={style} href={signedStorageUrl(BILL_BUCKET, path)} target="_blank" rel="noopener noreferrer"
      aria-label={`Open maintenance bill for ${selection}, ${money(total)} (opens in a new tab)`}>{children}</a>
      : <button type="button" className={cardClass} style={style} onClick={() => setOpen(true)} aria-haspopup="dialog"
        aria-label={`View maintenance entries and bills for ${selection}, ${money(total)}`}>{children}</button>}
    {open && <BillsDialog rows={rows} selection={selection} total={total} onEdit={onEdit} onClose={() => setOpen(false)} />}
  </>;
}
