"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Download, Loader2, Mail, Plus, Printer, RefreshCw } from "lucide-react";
import css from "./phone-bills.module.css";

import { BILL_MONTHS, billKey, billPayee, cleanBillRow, parsePhoneCsv, totalBills, type PhoneBillRow } from "@/lib/phone-bills";
import MonthlyStatement from "./monthly-statement";

const DATA_URL = "/data/phone-bill-reimbursements.csv";
const PAGE_SIZE = 100;
const MONTH_ORDER = BILL_MONTHS;

function money(value: number) {
  return `Rs ${value.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}


function unique(values: string[]) {
  return Array.from(new Set(values.filter(Boolean))).sort((a, b) => a.localeCompare(b));
}

function monthIndex(month: string) {
  const idx = MONTH_ORDER.indexOf(month);
  return idx === -1 ? 99 : idx;
}

function csvEscape(value: string | number) {
  const text = String(value);
  return text.includes(",") || text.includes('"') || text.includes("\n")
    ? `"${text.replaceAll('"', '""')}"`
    : text;
}

function billTagClass(billType: string) {
  const key = billType.toLowerCase();
  if (key.includes("jio")) return css.tagJio;
  if (key.includes("ftth")) return css.tagFtth;
  return css.tagBsnl;
}

const blankEntry: PhoneBillRow = {
  month: "January",
  year: String(new Date().getFullYear()),
  billType: "BSNL Mobile",
  location: "",
  user: "",
  phone: "",
  accountNo: "",
  dueDate: "",
  amount: null,
  remarks: "",
  payee: "Mr. AM",
  manual: true,
};

export default function PhoneBillsRegister({ previewRows }: { previewRows?: PhoneBillRow[] }) {
  const [baseRows, setBaseRows] = useState<PhoneBillRow[]>(previewRows || []);
  const [saving, setSaving] = useState(false);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [phoneQuery, setPhoneQuery] = useState("");
  const [user, setUser] = useState("ALL");
  const [month, setMonth] = useState("September");
  const [year, setYear] = useState("2026");
  const [billType, setBillType] = useState("ALL");
  const [page, setPage] = useState(0);
  const [showAddForm, setShowAddForm] = useState(false);
  const [draft, setDraft] = useState<PhoneBillRow>(blankEntry);
  const [printMode, setPrintMode] = useState(false);

  const rows = baseRows;

  const loadRows = useCallback(async () => {
    if (previewRows) { setBaseRows(previewRows); setLoading(false); return; }
    setLoading(true);
    setMessage("");
    try {
      const response = await fetch('/api/phone-bills', { cache: 'no-store' });
      const body = await response.json();
      if (response.ok) setBaseRows(body.rows);
      else {
        const fallback = await fetch(DATA_URL, { cache: 'no-store' });
        if (!fallback.ok) throw new Error(body.error || 'Unable to load phone bills.');
        setBaseRows(parsePhoneCsv(await fallback.text()));
        setMessage(`${body.error || 'Saved entries could not be loaded.'} Showing the source register only.`);
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to load phone bill data.");
    } finally {
      setLoading(false);
    }
  }, [previewRows]);

  useEffect(() => {
    loadRows();
  }, [loadRows]);

  const users = useMemo(() => unique(rows.map((row) => row.user)), [rows]);
  const months = useMemo(() => {
    const present = unique(rows.map((row) => row.month));
    return MONTH_ORDER.filter((value) => present.includes(value));
  }, [rows]);
  const years = useMemo(() => unique(rows.map((row) => row.year)).sort((a, b) => Number(a) - Number(b)), [rows]);
  const billTypes = useMemo(() => unique(rows.map((row) => row.billType)), [rows]);

  const filtered = useMemo(() => {
    const q = phoneQuery.trim().toLowerCase();
    return rows
      .filter((row) => {
        if (month !== "ALL" && row.month !== month) return false;
        if (year !== "ALL" && row.year !== year) return false;
        if (billType !== "ALL" && row.billType !== billType) return false;
        if (user !== "ALL" && row.user !== user) return false;
        if (!q) return true;
        return `${row.phone} ${row.accountNo} ${row.user} ${row.location} ${row.remarks}`.toLowerCase().includes(q);
      })
      .sort((a, b) => {
        const yearDiff = Number(b.year) - Number(a.year);
        if (yearDiff) return yearDiff;
        return monthIndex(b.month) - monthIndex(a.month);
      });
  }, [billType, month, phoneQuery, rows, user, year]);

  useEffect(() => {
    setPage(0);
  }, [billType, month, phoneQuery, user, year]);

  const stats = useMemo(() => {
    const totalAmount = totalBills(filtered);
    const distinctUsers = new Set(filtered.map((row) => row.user).filter(Boolean)).size;
    const distinctPhones = new Set(filtered.map((row) => row.phone || row.accountNo).filter(Boolean)).size;
    return { totalAmount, distinctUsers, distinctPhones };
  }, [filtered]);

  const periodLabel = useMemo(() => {
    if (!rows.length) return "-";
    const sorted = [...rows].sort((a, b) => {
      const yearDiff = Number(a.year) - Number(b.year);
      if (yearDiff) return yearDiff;
      return monthIndex(a.month) - monthIndex(b.month);
    });
    const first = sorted[0];
    const last = sorted[sorted.length - 1];
    return `${first.month.slice(0, 3)} ${first.year} - ${last.month.slice(0, 3)} ${last.year}`;
  }, [rows]);

  const transferSummary = useMemo(() => {
    const buckets = new Map<string, number>();
    for (const row of filtered) {
      const estate = row.location.includes("Moganad") ? "ME" : row.location.includes("Stanmore") ? "SE" : "MSPCC";
      const key = `${estate} to ${billPayee(row)}`;
      buckets.set(key, (buckets.get(key) ?? 0) + Math.round((row.amount ?? 0) * 100));
    }
    return Array.from(buckets.entries()).map(([label, cents]) => [label, cents / 100] as [string, number]).sort((a, b) => a[0].localeCompare(b[0]));
  }, [filtered]);

  const activeNote = useMemo(() => {
    const filters = [
      phoneQuery ? `phone/account contains "${phoneQuery}"` : "",
      user !== "ALL" ? `user is ${user}` : "",
      billType !== "ALL" ? `bill type is ${billType}` : "",
      month !== "ALL" ? `month is ${month}` : "",
      year !== "ALL" ? `year is ${year}` : "",
    ].filter(Boolean);
    return filters.length ? filters.join("; ") : "No filters applied.";
  }, [billType, month, phoneQuery, user, year]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageRows = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const visibleRows = printMode ? filtered : pageRows;

  const exportCsv = (records = filtered) => {
    const header = ["Month", "Year", "Bill Type", "Estate/Location", "User", "Phone", "Account No", "Due Date", "Amount", "Remarks", "Reimburse To"];
    const body = records.map((row) => [
      row.month,
      row.year,
      row.billType,
      row.location,
      row.user,
      row.phone,
      row.accountNo,
      row.dueDate,
      row.amount ?? "",
      row.remarks,
      billPayee(row),
    ].map(csvEscape).join(","));
    const blob = new Blob([[header.join(","), ...body].join("\n")], { type: "text/csv" });
    const link = Object.assign(document.createElement("a"), {
      href: URL.createObjectURL(blob),
      download: `phone_bill_reimbursement_filtered_${Date.now()}.csv`,
    });
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const emailView = () => {
    exportCsv();
    const transferLines = transferSummary.map(([label, amount]) => `${label}: ${money(amount)}`);
    const subject = `Phone Bill Reimbursement Report - ${filtered.length} records`;
    const body = [
      "Phone & Internet Bill Reimbursement Report",
      `Records: ${filtered.length}`,
      `Total: ${money(stats.totalAmount)}`,
      `Filters: ${activeNote}`,
      "",
      "Transfer summary:",
      ...(transferLines.length ? transferLines : ["No transfer summary available."]),
      "",
      "A CSV of this filtered view has just been downloaded. Please attach it to the email.",
    ].join("\n");
    window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  };

  const printReport = () => {
    setPrintMode(true);
    window.setTimeout(() => {
      window.print();
    }, 100);
  };

  useEffect(() => {
    const finishPrint = () => setPrintMode(false);
    window.addEventListener("afterprint", finishPrint);
    return () => window.removeEventListener("afterprint", finishPrint);
  }, []);

  const clearFilters = () => {
    setPhoneQuery("");
    setUser("ALL");
    setBillType("ALL");
    setMonth("ALL");
    setYear("ALL");
  };

  const saveDraft = async () => {
    setSaving(true); setMessage('');
    try {
      const row = cleanBillRow(draft);
      const response = await fetch('/api/phone-bills', { method: editingKey ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(editingKey ? { key: editingKey, row } : row) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Unable to save entry.');
      await loadRows();
      setMonth(row.month); setYear(row.year);
      setDraft({ ...blankEntry, year: String(new Date().getFullYear()) });
      setShowAddForm(false); setEditingKey(null);
      setMessage('Entry saved permanently.');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Unable to save entry.'); }
    finally { setSaving(false); }
  };

  return (
    <div className={css.page}>
      <section className={css.masthead}>
        <span className={css.leaf}>+</span>
        <div className={css.eyebrow}>Estate Accounts / Internal Register</div>
        <h1>Phone & Internet Bill Reimbursement</h1>
        <div className={css.sub}>
          <span>Reimbursements: <b>Mr. AM &amp; Mrs. NA</b></span>
          <span>Group: <b>MSP Coffee P Ltd. / Moganad & Stanmore Estates</b></span>
          <span>Consolidated from <b>{rows.length}</b> line items / {periodLabel}</span>
        </div>
      </section>

      <section className={css.summary}>
        <div className={css.card}><div className={css.num}>{filtered.length}</div><div className={css.cardLabel}>Line items shown</div></div>
        <div className={css.card}><div className={css.num}>{money(stats.totalAmount)}</div><div className={css.cardLabel}>Total amount (Rs)</div></div>
        <div className={css.card}><div className={css.num}>{stats.distinctUsers}</div><div className={css.cardLabel}>Distinct users</div></div>
        <div className={css.card}><div className={css.num}>{stats.distinctPhones}</div><div className={css.cardLabel}>Distinct numbers</div></div>
      </section>

      <section className={css.filters}>
        <div className={css.filtersTitle}>Filter the register</div>
        <div className={css.filterGrid}>
          <div className={css.field}>
            <label className={css.label}>Phone / account no.</label>
            <input className={css.input} value={phoneQuery} onChange={(e) => setPhoneQuery(e.target.value)} placeholder="e.g. 94432 or 500133437" />
          </div>
          <div className={css.field}>
            <label className={css.label}>User</label>
            <select className={css.select} value={user} onChange={(e) => setUser(e.target.value)}>
              <option value="ALL">All users</option>
              {users.map((value) => <option key={value} value={value}>{value}</option>)}
            </select>
          </div>
          <div className={css.field}>
            <label className={css.label}>Bill type</label>
            <select className={css.select} value={billType} onChange={(e) => setBillType(e.target.value)}>
              <option value="ALL">All types</option>
              {billTypes.map((value) => <option key={value} value={value}>{value}</option>)}
            </select>
          </div>
          <div className={css.field}>
            <label className={css.label}>Month</label>
            <select className={css.select} value={month} onChange={(e) => setMonth(e.target.value)}>
              <option value="ALL">All months</option>
              {months.map((value) => <option key={value} value={value}>{value}</option>)}
            </select>
          </div>
          <div className={css.field}>
            <label className={css.label}>Year</label>
            <select className={css.select} value={year} onChange={(e) => setYear(e.target.value)}>
              <option value="ALL">All years</option>
              {years.map((value) => <option key={value} value={value}>{value}</option>)}
            </select>
          </div>
          <button className={css.clearBtn} onClick={clearFilters}>Clear filters</button>
        </div>
        <div className={css.activeNote}>Showing <b>{filtered.length}</b> line items. {activeNote}</div>
      </section>

      <MonthlyStatement rows={rows} month={month} year={year} preview={!!previewRows} />

      <section className={css.actionBar}>
        <button className={`${css.actionBtn} ${css.actionBtnPrimary}`} onClick={() => { setEditingKey(null); setDraft({ ...blankEntry, month: month === "ALL" ? "January" : month, year: year === "ALL" ? blankEntry.year : year }); setShowAddForm(value => !value); }}>
          <Plus size={14} /> Add entry for a new month
        </button>
        <button className={css.actionBtn} onClick={printReport} disabled={!filtered.length}>
          <Printer size={14} /> Print chosen report
        </button>
        <button className={css.actionBtn} onClick={emailView} disabled={!filtered.length}>
          <Mail size={14} /> Email chosen report
        </button>
        <button className={css.actionBtn} onClick={() => exportCsv()} disabled={!filtered.length}>
          <Download size={14} /> Download CSV
        </button>
        <button className={css.actionBtn} onClick={loadRows} disabled={loading}>
          {loading ? <Loader2 size={14} /> : <RefreshCw size={14} />} Refresh
        </button>
        {message && <span className={css.saveStatus}>{message}</span>}
      </section>

      {showAddForm && (
        <section className={css.addForm}>
          <div className={css.filtersTitle}>{editingKey ? "Edit reimbursement line item" : "New reimbursement line item"}</div>
          <div className={css.addGrid}>
            <div className={css.field}><label className={css.label}>Month</label><select className={css.select} value={draft.month} onChange={(e) => setDraft((row) => ({ ...row, month: e.target.value }))}>{MONTH_ORDER.map((value) => <option key={value} value={value}>{value}</option>)}</select></div>
            <div className={css.field}><label className={css.label}>Year</label><input className={css.input} value={draft.year} onChange={(e) => setDraft((row) => ({ ...row, year: e.target.value }))} /></div>
            <div className={css.field}><label className={css.label}>Bill type</label><select className={css.select} value={draft.billType} onChange={(e) => setDraft((row) => ({ ...row, billType: e.target.value }))}>{["BSNL Mobile", "Jio Mobile", "BSNL FTTH Internet"].map((value) => <option key={value} value={value}>{value}</option>)}</select></div>
            <div className={css.field}><label className={css.label}>Estate / location</label><input className={css.input} value={draft.location} onChange={(e) => setDraft((row) => ({ ...row, location: e.target.value }))} /></div>
            <div className={css.field}><label className={css.label}>User</label><input className={css.input} value={draft.user} onChange={(e) => setDraft((row) => ({ ...row, user: e.target.value }))} /></div>
            <div className={css.field}><label className={css.label}>Phone no.</label><input className={css.input} value={draft.phone} onChange={(e) => setDraft((row) => ({ ...row, phone: e.target.value }))} /></div>
            <div className={css.field}><label className={css.label}>Account no.</label><input className={css.input} value={draft.accountNo} onChange={(e) => setDraft((row) => ({ ...row, accountNo: e.target.value }))} /></div>
            <div className={css.field}><label className={css.label}>Due date</label><input className={css.input} value={draft.dueDate} onChange={(e) => setDraft((row) => ({ ...row, dueDate: e.target.value }))} /></div>
            <div className={css.field}><label className={css.label}>Amount</label><input className={css.input} type="number" min="0" step="0.01" value={draft.amount ?? ""} onChange={(e) => setDraft((row) => ({ ...row, amount: e.target.value === "" ? null : Number(e.target.value) }))} /></div>
            <div className={css.field}><label className={css.label}>Reimburse to</label><select aria-label="Reimburse to" className={css.select} value={draft.payee} onChange={e => setDraft(row => ({ ...row, payee: e.target.value as PhoneBillRow["payee"] }))}><option>Mr. AM</option><option>Mrs. NA</option></select></div>
            <div className={css.field}><label className={css.label}>Remarks</label><input className={css.input} value={draft.remarks} onChange={(e) => setDraft((row) => ({ ...row, remarks: e.target.value }))} /></div>
          </div>
          <div className={css.addActions}>
            <button className={`${css.actionBtn} ${css.actionBtnPrimary}`} onClick={saveDraft} disabled={saving || !!previewRows}>{saving ? "Saving…" : "Save entry"}</button>
            <button className={css.actionBtn} onClick={() => setShowAddForm(false)}>Cancel</button>
            <span className={css.addNote}>Entries are saved to the register. Leave an unknown amount blank until confirmed. Issued months are locked.</span>
          </div>
        </section>
      )}

      <section className={css.tableScroll}>
        <table className={css.table}>
          <thead>
            <tr>
              <th>Period</th>
              <th>Bill type</th>
              <th>Estate / location</th>
              <th>User</th>
              <th>Phone / no.</th>
              <th>Account no.</th>
              <th>Due date</th>
              <th className={css.numCell}>Amount (Rs)</th>
              <th>Remarks</th>
            </tr>
          </thead>
          <tbody>
            {!loading && visibleRows.length === 0 && (
              <tr className={css.emptyRow}><td colSpan={9}>No phone bills match the selected filters.</td></tr>
            )}
            {visibleRows.map((row, index) => (
              <tr key={`${row.month}-${row.year}-${row.billType}-${row.phone}-${row.accountNo}-${index}`}>
                <td className={css.mono}>{row.month} {row.year}</td>
                <td>
                  <span className={`${css.tag} ${billTagClass(row.billType)}`}>{row.billType || "-"}</span>
                  {row.manual && <span className={css.tagManual}>Manual</span>}
                </td>
                <td>{row.location || "-"}</td>
                <td>{row.user || "-"}</td>
                <td className={css.mono}>{row.phone || "-"}</td>
                <td className={css.mono}>{row.accountNo || "-"}</td>
                <td className={css.mono}>{row.dueDate || "-"}</td>
                <td className={`${css.numCell} ${(row.amount ?? 0) > 0 ? css.amountPos : css.amountZero}`}>{row.amount === null ? "Awaiting amount" : money(row.amount)}</td>
                <td>{row.remarks || "-"}<br/><b>Reimburse {billPayee(row)}</b><br/><button className={css.actionBtn} onClick={() => { setEditingKey(billKey(row)); setDraft({ ...row }); setShowAddForm(true); }} aria-label={`Edit ${row.phone || row.accountNo} ${row.month} ${row.year}`}>Edit entry</button></td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={7}>Total (filtered)</td>
              <td className={css.numCell}>{money(stats.totalAmount)}</td>
              <td />
            </tr>
          </tfoot>
        </table>
      </section>

      <div className={css.pager}>
        <span>
          Showing {pageRows.length ? page * PAGE_SIZE + 1 : 0} to {Math.min((page + 1) * PAGE_SIZE, filtered.length)} of {filtered.length}
        </span>
        <span className={css.pagerButtons}>
          <button onClick={() => setPage((value) => Math.max(0, value - 1))} disabled={page === 0}>Prev</button>
          <button onClick={() => setPage((value) => Math.min(totalPages - 1, value + 1))} disabled={page >= totalPages - 1}>Next</button>
        </span>
      </div>

      <div className={css.transfersTitle}>To be transferred summary</div>
      <section className={css.transfers}>
        {transferSummary.map(([label, amount]) => (
          <div className={css.transferCard} key={label}>
            <div className={css.transferTo}>{label}</div>
            <div className={css.transferAmount}>{money(amount)}</div>
          </div>
        ))}
      </section>
      <div className={css.transfersHint}>Estate allocation and reimbursement recipients for the currently filtered rows.</div>

      <footer className={css.pageFoot}>
        <span>Phone bill register / {rows.length} saved line items</span>
        <span>Consolidated view / all figures in INR</span>
      </footer>
    </div>
  );
}

