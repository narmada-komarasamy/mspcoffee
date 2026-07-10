"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Download, Loader2, Phone, RefreshCw } from "lucide-react";
import css from "./phone-bills.module.css";

type PhoneBillRow = {
  month: string;
  year: string;
  billType: string;
  location: string;
  user: string;
  phone: string;
  accountNo: string;
  dueDate: string;
  amount: number;
  remarks: string;
};

const DATA_URL = "/data/phone-bill-reimbursements.csv";
const PAGE_SIZE = 100;

function parseCsvLine(line: string) {
  const cells: string[] = [];
  let value = "";
  let quoted = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    const next = line[i + 1];
    if (char === '"' && quoted && next === '"') {
      value += '"';
      i += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      cells.push(value);
      value = "";
    } else {
      value += char;
    }
  }

  cells.push(value);
  return cells.map((cell) => cell.trim());
}

function parseRows(csv: string): PhoneBillRow[] {
  return csv
    .split(/\r?\n/)
    .filter(Boolean)
    .slice(1)
    .map(parseCsvLine)
    .map((cells) => ({
      month: cells[0] ?? "",
      year: cells[1] ?? "",
      billType: cells[2] ?? "",
      location: cells[3] ?? "",
      user: cells[4] ?? "",
      phone: cells[5] ?? "",
      accountNo: cells[6] ?? "",
      dueDate: cells[7] ?? "",
      amount: Number(cells[8] || 0),
      remarks: cells[9] ?? "",
    }));
}

function money(value: number) {
  return `Rs ${value.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

function unique(values: string[]) {
  return Array.from(new Set(values.filter(Boolean))).sort((a, b) => a.localeCompare(b));
}

function csvEscape(value: string | number) {
  const text = String(value);
  return text.includes(",") || text.includes('"') || text.includes("\n")
    ? `"${text.replaceAll('"', '""')}"`
    : text;
}

export default function PhoneBillsPage() {
  const [rows, setRows] = useState<PhoneBillRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");
  const [month, setMonth] = useState("ALL");
  const [year, setYear] = useState("ALL");
  const [billType, setBillType] = useState("ALL");
  const [location, setLocation] = useState("ALL");
  const [page, setPage] = useState(0);

  const loadRows = useCallback(async () => {
    setLoading(true);
    setMessage("");
    try {
      const response = await fetch(DATA_URL, { cache: "no-store" });
      if (!response.ok) throw new Error(`Unable to load CSV (${response.status})`);
      const csv = await response.text();
      setRows(parseRows(csv));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to load phone bill data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRows();
  }, [loadRows]);

  const months = useMemo(() => unique(rows.map((row) => row.month)), [rows]);
  const years = useMemo(() => unique(rows.map((row) => row.year)).reverse(), [rows]);
  const billTypes = useMemo(() => unique(rows.map((row) => row.billType)), [rows]);
  const locations = useMemo(() => unique(rows.map((row) => row.location)), [rows]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((row) => {
      if (month !== "ALL" && row.month !== month) return false;
      if (year !== "ALL" && row.year !== year) return false;
      if (billType !== "ALL" && row.billType !== billType) return false;
      if (location !== "ALL" && row.location !== location) return false;
      if (!q) return true;
      return [
        row.month,
        row.year,
        row.billType,
        row.location,
        row.user,
        row.phone,
        row.accountNo,
        row.dueDate,
        row.amount,
        row.remarks,
      ].join(" ").toLowerCase().includes(q);
    });
  }, [billType, location, month, rows, search, year]);

  useEffect(() => {
    setPage(0);
  }, [billType, location, month, search, year]);

  const stats = useMemo(() => {
    const totalAmount = filtered.reduce((sum, row) => sum + row.amount, 0);
    const accounts = new Set(filtered.map((row) => row.accountNo || row.phone).filter(Boolean)).size;
    const billTypeCount = new Set(filtered.map((row) => row.billType).filter(Boolean)).size;
    return { totalAmount, accounts, billTypeCount };
  }, [filtered]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageRows = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const exportCsv = () => {
    const header = ["Month", "Year", "Bill Type", "Estate/Location", "User", "Phone", "Account No", "Due Date", "Amount", "Remarks"];
    const body = filtered.map((row) => [
      row.month,
      row.year,
      row.billType,
      row.location,
      row.user,
      row.phone,
      row.accountNo,
      row.dueDate,
      row.amount,
      row.remarks,
    ].map(csvEscape).join(","));
    const blob = new Blob([[header.join(","), ...body].join("\n")], { type: "text/csv" });
    const link = Object.assign(document.createElement("a"), {
      href: URL.createObjectURL(blob),
      download: `phone_bills_${new Date().toISOString().slice(0, 10)}.csv`,
    });
    link.click();
    URL.revokeObjectURL(link.href);
  };

  return (
    <div className={css.page}>
      <section className={css.hero}>
        <div>
          <div className={css.eyebrow}>HO Fuel / Recurring Bills</div>
          <h1 className={css.title}>Phone Bills</h1>
          <p className={css.copy}>
            Track recurring BSNL, Jio and FTTH phone or internet reimbursements by month, location,
            user, phone number, account number, due date and amount.
          </p>
        </div>
        <div className={css.actions}>
          <button className={css.btn} onClick={loadRows} disabled={loading}>
            {loading ? <Loader2 size={15} /> : <RefreshCw size={15} />} Refresh
          </button>
          <button className={css.btn} onClick={exportCsv} disabled={!filtered.length}>
            <Download size={15} /> Export CSV
          </button>
        </div>
      </section>

      <section className={css.stats}>
        <div className={css.stat}>
          <div className={css.statLabel}>Records</div>
          <div className={css.statValue}>{filtered.length}</div>
          <div className={css.statSub}>Filtered recurring bills</div>
        </div>
        <div className={css.stat}>
          <div className={css.statLabel}>Total Amount</div>
          <div className={css.statValue}>{money(stats.totalAmount)}</div>
          <div className={css.statSub}>Across selected records</div>
        </div>
        <div className={css.stat}>
          <div className={css.statLabel}>Accounts</div>
          <div className={css.statValue}>{stats.accounts}</div>
          <div className={css.statSub}>Phone or account numbers</div>
        </div>
        <div className={css.stat}>
          <div className={css.statLabel}>Bill Types</div>
          <div className={css.statValue}>{stats.billTypeCount}</div>
          <div className={css.statSub}>Service categories</div>
        </div>
      </section>

      <section className={css.panel}>
        <div className={css.panelHead}>
          <div>
            <div className={css.panelTitle}>Phone Bill Register</div>
            <div className={css.panelSub}>Loaded from the filtered reimbursement CSV</div>
          </div>
          {loading && <Loader2 size={18} />}
        </div>

        <div className={css.filters}>
          <div className={css.field}>
            <label className={css.label}>Search</label>
            <input className={css.input} value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search user, phone, account, remarks" />
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
          <div className={css.field}>
            <label className={css.label}>Bill Type</label>
            <select className={css.select} value={billType} onChange={(e) => setBillType(e.target.value)}>
              <option value="ALL">All bill types</option>
              {billTypes.map((value) => <option key={value} value={value}>{value}</option>)}
            </select>
          </div>
          <div className={css.field}>
            <label className={css.label}>Location</label>
            <select className={css.select} value={location} onChange={(e) => setLocation(e.target.value)}>
              <option value="ALL">All locations</option>
              {locations.map((value) => <option key={value} value={value}>{value}</option>)}
            </select>
          </div>
        </div>

        {message && <div className={css.empty}>{message}</div>}

        <div className={css.tableWrap}>
          <table className={css.table}>
            <thead>
              <tr>
                <th>Month</th>
                <th>Bill Type</th>
                <th>Estate / Location</th>
                <th>User</th>
                <th>Phone</th>
                <th>Account No</th>
                <th>Due Date</th>
                <th className={css.amount}>Amount</th>
                <th>Remarks</th>
              </tr>
            </thead>
            <tbody>
              {!loading && pageRows.length === 0 && (
                <tr><td colSpan={9}><div className={css.empty}>No phone bills match the selected filters.</div></td></tr>
              )}
              {pageRows.map((row, index) => (
                <tr key={`${row.month}-${row.year}-${row.billType}-${row.phone}-${row.accountNo}-${index}`}>
                  <td>
                    <strong>{row.month}</strong>
                    <div className={css.muted}>{row.year}</div>
                  </td>
                  <td><span className={css.badge}>{row.billType || "-"}</span></td>
                  <td>{row.location || "-"}</td>
                  <td>{row.user || "-"}</td>
                  <td>{row.phone || "-"}</td>
                  <td>{row.accountNo || "-"}</td>
                  <td>{row.dueDate || "-"}</td>
                  <td className={css.amount}>{row.amount ? money(row.amount) : "-"}</td>
                  <td>{row.remarks || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className={css.panelHead}>
          <div className={css.panelSub}>
            Showing {pageRows.length ? page * PAGE_SIZE + 1 : 0} to {Math.min((page + 1) * PAGE_SIZE, filtered.length)} of {filtered.length}
          </div>
          <div className={css.actions}>
            <button className={css.btn} onClick={() => setPage((value) => Math.max(0, value - 1))} disabled={page === 0}>Previous</button>
            <button className={css.btn} onClick={() => setPage((value) => Math.min(totalPages - 1, value + 1))} disabled={page >= totalPages - 1}>Next</button>
          </div>
        </div>
      </section>
    </div>
  );
}
