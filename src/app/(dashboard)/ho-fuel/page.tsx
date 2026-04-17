"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import {
  LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { AlertTriangle, Download } from "lucide-react";
import { createClient } from "@supabase/supabase-js";
import css from "./ho-fuel.module.css";

const supabase = createClient(
  "https://aeawxovvyvpcjkhyxgcq.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFlYXd4b3Z2eXZwY2praHl4Z2NxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ5NDY1MTgsImV4cCI6MjA5MDUyMjUxOH0.V8Bu91H6lidK1A4qqyPAotp7KFRaF9dm2iEFZvWxWPg"
);

const LOW_STOCK_THRESHOLD = 50_000;
const PAGE_SIZE = 50;

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

type TxRow = {
  id: number;
  date: string;
  month: number;
  year: number;
  transaction_type: "PURCHASE" | "ISSUE";
  fuel_type: "DIESEL" | "PETROL";
  source: string;
  vehicle_number: string;
  estate: string;
  vehicle_name: string;
  qty_l: number;
  amount: number;
  mode_of_payment: string;
  receiver_name: string;
  remarks: string;
};

function fmt(n: number) {
  return n.toLocaleString("en-IN", { maximumFractionDigits: 1 });
}

function fmtCur(n: number) {
  return "₹" + n.toLocaleString("en-IN", { maximumFractionDigits: 0 });
}

export default function HoFuelPage() {
  const [tab, setTab] = useState<"overview" | "consumers" | "log">("overview");
  const [rows, setRows] = useState<TxRow[]>([]);
  const [loading, setLoading] = useState(true);
  const realtimeRef = useRef(false);

  // ── Load all data ─────────────────────────────────────────────────────────
  const loadData = useCallback(async () => {
    setLoading(true);
    const all: TxRow[] = [];
    let from = 0;
    const size = 1000;
    while (true) {
      const { data, error } = await supabase
        .from("ho_fuel_log")
        .select("*")
        .order("date", { ascending: true })
        .range(from, from + size - 1);
      if (error || !data || data.length === 0) break;
      all.push(...(data as TxRow[]));
      if (data.length < size) break;
      from += size;
    }
    setRows(all);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // ── Realtime subscription ─────────────────────────────────────────────────
  useEffect(() => {
    if (realtimeRef.current) return;
    realtimeRef.current = true;
    const channel = supabase
      .channel("ho_fuel_log_changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "ho_fuel_log" }, () => {
        loadData();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [loadData]);

  // ── Derived stock numbers ─────────────────────────────────────────────────
  const { dieselStock, petrolStock, totalPurchased, totalIssued, totalAmount } = useMemo(() => {
    let dPurchase = 0, dIssue = 0, pPurchase = 0, pIssue = 0, amt = 0;
    for (const r of rows) {
      if (r.fuel_type === "DIESEL") {
        if (r.transaction_type === "PURCHASE") { dPurchase += r.qty_l; amt += r.amount; }
        else dIssue += r.qty_l;
      } else {
        if (r.transaction_type === "PURCHASE") { pPurchase += r.qty_l; amt += r.amount; }
        else pIssue += r.qty_l;
      }
    }
    return {
      dieselStock: dPurchase - dIssue,
      petrolStock: pPurchase - pIssue,
      totalPurchased: dPurchase + pPurchase,
      totalIssued: dIssue + pIssue,
      totalAmount: amt,
    };
  }, [rows]);

  if (loading) return <div className={css.loading}>Loading HO Fuel data…</div>;

  return (
    <div>
      {/* Tabs */}
      <div className={css.tabs}>
        <button className={`${css.tab} ${tab === "overview" ? css.tabActive : ""}`} onClick={() => setTab("overview")}>Overview</button>
        <button className={`${css.tab} ${tab === "consumers" ? css.tabActive : ""}`} onClick={() => setTab("consumers")}>Consumers</button>
        <button className={`${css.tab} ${tab === "log" ? css.tabActive : ""}`} onClick={() => setTab("log")}>Transaction Log</button>
      </div>

      {tab === "overview" && (
        <OverviewTab
          rows={rows}
          dieselStock={dieselStock}
          petrolStock={petrolStock}
          totalPurchased={totalPurchased}
          totalIssued={totalIssued}
          totalAmount={totalAmount}
        />
      )}
      {tab === "consumers" && <ConsumersTab rows={rows} />}
      {tab === "log" && <LogTab rows={rows} />}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// OVERVIEW TAB
// ─────────────────────────────────────────────────────────────────────────────
function OverviewTab({
  rows, dieselStock, petrolStock, totalPurchased, totalIssued, totalAmount,
}: {
  rows: TxRow[];
  dieselStock: number; petrolStock: number;
  totalPurchased: number; totalIssued: number; totalAmount: number;
}) {
  const lowStock = dieselStock < LOW_STOCK_THRESHOLD || petrolStock < LOW_STOCK_THRESHOLD;

  // Timeline: monthly purchase / issue / running stock (diesel + petrol combined)
  const timelineData = useMemo(() => {
    const map = new Map<string, { purchase: number; issued: number }>();
    for (const r of rows) {
      const key = `${r.year}-${String(r.month).padStart(2, "0")}`;
      const cur = map.get(key) ?? { purchase: 0, issued: 0 };
      if (r.transaction_type === "PURCHASE") cur.purchase += r.qty_l;
      else cur.issued += r.qty_l;
      map.set(key, cur);
    }
    let running = 0;
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, v]) => {
        running += v.purchase - v.issued;
        const [y, m] = key.split("-");
        return {
          label: MONTHS[parseInt(m) - 1] + " " + y.slice(2),
          purchase: Math.round(v.purchase * 10) / 10,
          issued: Math.round(v.issued * 10) / 10,
          stock: Math.round(running * 10) / 10,
        };
      });
  }, [rows]);

  // Estate breakdown (issues)
  const estateData = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of rows) {
      if (r.transaction_type === "ISSUE" && r.estate) {
        map.set(r.estate, (map.get(r.estate) ?? 0) + r.qty_l);
      }
    }
    return Array.from(map.entries())
      .sort(([, a], [, b]) => b - a)
      .slice(0, 8)
      .map(([estate, qty]) => ({ estate, qty: Math.round(qty * 10) / 10 }));
  }, [rows]);

  const maxEstate = estateData[0]?.qty ?? 1;

  // Monthly summary table
  const monthlySummary = useMemo(() => {
    const map = new Map<string, { dPurchase: number; pPurchase: number; dIssue: number; pIssue: number; amount: number }>();
    for (const r of rows) {
      const key = `${r.year}-${String(r.month).padStart(2, "0")}`;
      const cur = map.get(key) ?? { dPurchase: 0, pPurchase: 0, dIssue: 0, pIssue: 0, amount: 0 };
      if (r.fuel_type === "DIESEL") {
        if (r.transaction_type === "PURCHASE") cur.dPurchase += r.qty_l;
        else cur.dIssue += r.qty_l;
      } else {
        if (r.transaction_type === "PURCHASE") cur.pPurchase += r.qty_l;
        else cur.pIssue += r.qty_l;
      }
      cur.amount += r.amount;
      map.set(key, cur);
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([key, v]) => {
        const [y, m] = key.split("-");
        return {
          label: MONTHS[parseInt(m) - 1] + " " + y,
          dPurchase: v.dPurchase,
          pPurchase: v.pPurchase,
          dIssue: v.dIssue,
          pIssue: v.pIssue,
          amount: v.amount,
        };
      });
  }, [rows]);

  const maxPurchase = Math.max(totalPurchased, 1);
  const maxIssued = Math.max(totalIssued, 1);

  return (
    <div>
      {/* Low stock alert */}
      {lowStock && (
        <div className={css.alertBanner}>
          <AlertTriangle className={css.alertIcon} size={18} />
          <span>
            <span className={css.alertTitle}>Low Stock Warning:</span>
            {dieselStock < LOW_STOCK_THRESHOLD && `Diesel stock at ${fmt(dieselStock)} L. `}
            {petrolStock < LOW_STOCK_THRESHOLD && `Petrol stock at ${fmt(petrolStock)} L.`}
          </span>
        </div>
      )}

      {/* KPI cards */}
      <div className={css.kpiGrid}>
        <div className={css.kpiCard}>
          <div className={css.kpiLabel}>Diesel in Store</div>
          <div className={css.kpiValue}>{fmt(dieselStock)} L</div>
          <div className={css.kpiSub}>Running stock</div>
          <div className={css.kpiBar}>
            <div
              className={`${css.kpiBarFill} ${css.kpiBarDiesel}`}
              style={{ width: `${Math.min(100, (dieselStock / LOW_STOCK_THRESHOLD) * 100)}%` }}
            />
          </div>
        </div>
        <div className={css.kpiCard}>
          <div className={css.kpiLabel}>Petrol in Store</div>
          <div className={css.kpiValue}>{fmt(petrolStock)} L</div>
          <div className={css.kpiSub}>Running stock</div>
          <div className={css.kpiBar}>
            <div
              className={`${css.kpiBarFill} ${css.kpiBarPetrol}`}
              style={{ width: `${Math.min(100, (petrolStock / LOW_STOCK_THRESHOLD) * 100)}%` }}
            />
          </div>
        </div>
        <div className={css.kpiCard}>
          <div className={css.kpiLabel}>Total Purchased</div>
          <div className={css.kpiValue}>{fmt(totalPurchased)} L</div>
          <div className={css.kpiSub}>{fmtCur(totalAmount)} spent</div>
          <div className={css.kpiBar}>
            <div
              className={`${css.kpiBarFill} ${css.kpiBarPurchase}`}
              style={{ width: `${Math.min(100, (totalPurchased / maxPurchase) * 100)}%` }}
            />
          </div>
        </div>
        <div className={css.kpiCard}>
          <div className={css.kpiLabel}>Total Issued</div>
          <div className={css.kpiValue}>{fmt(totalIssued)} L</div>
          <div className={css.kpiSub}>To estates & vehicles</div>
          <div className={css.kpiBar}>
            <div
              className={`${css.kpiBarFill} ${css.kpiBarIssue}`}
              style={{ width: `${Math.min(100, (totalIssued / maxIssued) * 100)}%` }}
            />
          </div>
        </div>
      </div>

      {/* Charts row */}
      <div className={css.chartsRow}>
        {/* Timeline chart */}
        <div className={css.chartCard}>
          <div className={css.chartTitle}>Stock Timeline (Combined)</div>
          <div className={css.legendRow}>
            <span className={css.legendDot}><span className={css.dot} style={{ background: "#86efac" }} />Purchased</span>
            <span className={css.legendDot}><span className={css.dot} style={{ background: "#a78bfa" }} />Issued</span>
            <span className={css.legendDot}><span className={css.dot} style={{ background: "#60a5fa" }} />Stock</span>
          </div>
          {timelineData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={timelineData} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis dataKey="label" tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 10 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip
                  contentStyle={{ background: "#1a2e3e", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, fontSize: 12 }}
                  labelStyle={{ color: "#fff", fontWeight: 600 }}
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  formatter={(v: any, name: any) => [`${fmt(Number(v))} L`, name]}
                />
                <Line type="monotone" dataKey="purchase" stroke="#86efac" strokeWidth={2} dot={false} name="Purchased" />
                <Line type="monotone" dataKey="issued" stroke="#a78bfa" strokeWidth={2} dot={false} name="Issued" />
                <Line type="monotone" dataKey="stock" stroke="#60a5fa" strokeWidth={2} dot={false} name="Stock" />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className={css.empty}>No data</div>
          )}
        </div>

        {/* Estate breakdown */}
        <div className={css.chartCard}>
          <div className={css.chartTitle}>Issues by Estate</div>
          {estateData.length > 0 ? (
            <div className={css.estateList}>
              {estateData.map((e) => (
                <div key={e.estate} className={css.estateRow}>
                  <div className={css.estateRowTop}>
                    <span className={css.estateName}>{e.estate || "Unknown"}</span>
                    <span className={css.estateQty}>{fmt(e.qty)} L</span>
                  </div>
                  <div className={css.estateBarBg}>
                    <div className={css.estateBarFill} style={{ width: `${(e.qty / maxEstate) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className={css.empty}>No issue data</div>
          )}
        </div>
      </div>

      {/* Monthly summary table */}
      <div className={css.tableCard}>
        <div className={css.chartTitle}>Monthly Summary</div>
        {monthlySummary.length > 0 ? (
          <table className={css.table}>
            <thead>
              <tr>
                <th>Month</th>
                <th className={css.tdRight}>D Purchased</th>
                <th className={css.tdRight}>P Purchased</th>
                <th className={css.tdRight}>D Issued</th>
                <th className={css.tdRight}>P Issued</th>
                <th className={css.tdRight}>Amount</th>
              </tr>
            </thead>
            <tbody>
              {monthlySummary.map((m) => (
                <tr key={m.label}>
                  <td>{m.label}</td>
                  <td className={css.tdNum}>{fmt(m.dPurchase)} L</td>
                  <td className={css.tdNum}>{fmt(m.pPurchase)} L</td>
                  <td className={css.tdNum}>{fmt(m.dIssue)} L</td>
                  <td className={css.tdNum}>{fmt(m.pIssue)} L</td>
                  <td className={css.tdNum}>{fmtCur(m.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className={css.empty}>No data</div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CONSUMERS TAB
// ─────────────────────────────────────────────────────────────────────────────
function ConsumersTab({ rows }: { rows: TxRow[] }) {
  const thisYear = new Date().getFullYear();
  const [filterMonth, setFilterMonth] = useState("ALL");
  const [filterFuel, setFilterFuel] = useState("ALL");
  const [filterEstate, setFilterEstate] = useState("ALL");

  const estates = useMemo(() => {
    const s = new Set<string>();
    rows.forEach((r) => { if (r.estate) s.add(r.estate); });
    return Array.from(s).sort();
  }, [rows]);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (r.transaction_type !== "ISSUE") return false;
      if (filterMonth !== "ALL" && r.month !== parseInt(filterMonth)) return false;
      if (filterFuel !== "ALL" && r.fuel_type !== filterFuel) return false;
      if (filterEstate !== "ALL" && r.estate !== filterEstate) return false;
      return true;
    });
  }, [rows, filterMonth, filterFuel, filterEstate]);

  // Top consumers by estate
  const estateBreakdown = useMemo(() => {
    const map = new Map<string, { diesel: number; petrol: number }>();
    for (const r of filtered) {
      const key = r.estate || "Unknown";
      const cur = map.get(key) ?? { diesel: 0, petrol: 0 };
      if (r.fuel_type === "DIESEL") cur.diesel += r.qty_l;
      else cur.petrol += r.qty_l;
      map.set(key, cur);
    }
    return Array.from(map.entries())
      .sort(([, a], [, b]) => (b.diesel + b.petrol) - (a.diesel + a.petrol))
      .map(([estate, v]) => ({
        estate,
        diesel: Math.round(v.diesel * 10) / 10,
        petrol: Math.round(v.petrol * 10) / 10,
        total: Math.round((v.diesel + v.petrol) * 10) / 10,
      }));
  }, [filtered]);

  // Top consumers by vehicle
  const vehicleBreakdown = useMemo(() => {
    const map = new Map<string, { diesel: number; petrol: number; estate: string }>();
    for (const r of filtered) {
      const key = r.vehicle_number || r.vehicle_name || "Unknown";
      const cur = map.get(key) ?? { diesel: 0, petrol: 0, estate: r.estate };
      if (r.fuel_type === "DIESEL") cur.diesel += r.qty_l;
      else cur.petrol += r.qty_l;
      map.set(key, cur);
    }
    return Array.from(map.entries())
      .sort(([, a], [, b]) => (b.diesel + b.petrol) - (a.diesel + a.petrol))
      .slice(0, 15)
      .map(([vehicle, v]) => ({
        vehicle,
        estate: v.estate,
        diesel: Math.round(v.diesel * 10) / 10,
        petrol: Math.round(v.petrol * 10) / 10,
        total: Math.round((v.diesel + v.petrol) * 10) / 10,
      }));
  }, [filtered]);

  return (
    <div>
      {/* Filters */}
      <div className={css.filterBar}>
        <label>Month</label>
        <select className={css.sel} value={filterMonth} onChange={(e) => setFilterMonth(e.target.value)}>
          <option value="ALL">All Months</option>
          {MONTHS.map((m, i) => <option key={m} value={String(i + 1)}>{m}</option>)}
        </select>
        <label>Fuel</label>
        <select className={css.sel} value={filterFuel} onChange={(e) => setFilterFuel(e.target.value)}>
          <option value="ALL">All Fuels</option>
          <option value="DIESEL">Diesel</option>
          <option value="PETROL">Petrol</option>
        </select>
        <label>Estate</label>
        <select className={css.sel} value={filterEstate} onChange={(e) => setFilterEstate(e.target.value)}>
          <option value="ALL">All Estates</option>
          {estates.map((e) => <option key={e} value={e}>{e}</option>)}
        </select>
      </div>

      <div className={css.consumerGrid}>
        {/* Bar chart — estate */}
        <div className={css.chartCard}>
          <div className={css.chartTitle}>Issues by Estate</div>
          {estateBreakdown.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={estateBreakdown} layout="vertical" margin={{ top: 4, right: 16, bottom: 4, left: 80 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" horizontal={false} />
                <XAxis type="number" tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={(v) => `${v}L`} />
                <YAxis type="category" dataKey="estate" tick={{ fill: "rgba(255,255,255,0.6)", fontSize: 10 }} tickLine={false} axisLine={false} width={78} />
                <Tooltip
                  contentStyle={{ background: "#1a2e3e", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, fontSize: 12 }}
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  formatter={(v: any, name: any) => [`${fmt(Number(v))} L`, name]}
                />
                <Legend wrapperStyle={{ fontSize: 11, color: "rgba(255,255,255,0.5)" }} />
                <Bar dataKey="diesel" name="Diesel" fill="#60a5fa" radius={[0, 3, 3, 0]} />
                <Bar dataKey="petrol" name="Petrol" fill="#fb923c" radius={[0, 3, 3, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className={css.empty}>No data for selected filters</div>
          )}
        </div>

        {/* Estate summary table */}
        <div className={css.tableCard} style={{ marginBottom: 0 }}>
          <div className={css.chartTitle}>Estate Totals</div>
          {estateBreakdown.length > 0 ? (
            <table className={css.table}>
              <thead>
                <tr>
                  <th>Estate</th>
                  <th className={css.tdRight}>Diesel</th>
                  <th className={css.tdRight}>Petrol</th>
                  <th className={css.tdRight}>Total</th>
                </tr>
              </thead>
              <tbody>
                {estateBreakdown.map((e) => (
                  <tr key={e.estate}>
                    <td>{e.estate}</td>
                    <td className={css.tdNum}>{fmt(e.diesel)} L</td>
                    <td className={css.tdNum}>{fmt(e.petrol)} L</td>
                    <td className={css.tdNum}>{fmt(e.total)} L</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className={css.empty}>No data</div>
          )}
        </div>
      </div>

      {/* Vehicle breakdown table */}
      <div className={css.tableCard} style={{ marginTop: "1rem" }}>
        <div className={css.chartTitle}>Top Vehicle Consumers</div>
        {vehicleBreakdown.length > 0 ? (
          <table className={css.table}>
            <thead>
              <tr>
                <th>Vehicle</th>
                <th>Estate</th>
                <th className={css.tdRight}>Diesel</th>
                <th className={css.tdRight}>Petrol</th>
                <th className={css.tdRight}>Total</th>
              </tr>
            </thead>
            <tbody>
              {vehicleBreakdown.map((v, i) => (
                <tr key={i}>
                  <td>{v.vehicle}</td>
                  <td>{v.estate}</td>
                  <td className={css.tdNum}>{fmt(v.diesel)} L</td>
                  <td className={css.tdNum}>{fmt(v.petrol)} L</td>
                  <td className={css.tdNum}>{fmt(v.total)} L</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className={css.empty}>No data</div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TRANSACTION LOG TAB
// ─────────────────────────────────────────────────────────────────────────────
function LogTab({ rows }: { rows: TxRow[] }) {
  const [filterType, setFilterType] = useState("ALL");
  const [filterFuel, setFilterFuel] = useState("ALL");
  const [filterMonth, setFilterMonth] = useState("ALL");
  const [filterEstate, setFilterEstate] = useState("ALL");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);

  const estates = useMemo(() => {
    const s = new Set<string>();
    rows.forEach((r) => { if (r.estate) s.add(r.estate); });
    return Array.from(s).sort();
  }, [rows]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return rows
      .filter((r) => {
        if (filterType !== "ALL" && r.transaction_type !== filterType) return false;
        if (filterFuel !== "ALL" && r.fuel_type !== filterFuel) return false;
        if (filterMonth !== "ALL" && r.month !== parseInt(filterMonth)) return false;
        if (filterEstate !== "ALL" && r.estate !== filterEstate) return false;
        if (q) {
          const hay = `${r.vehicle_number} ${r.vehicle_name} ${r.estate} ${r.source} ${r.receiver_name} ${r.remarks}`.toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [rows, filterType, filterFuel, filterMonth, filterEstate, search]);

  // Reset page when filters change
  const prevFilter = useRef("");
  const filterKey = `${filterType}|${filterFuel}|${filterMonth}|${filterEstate}|${search}`;
  if (prevFilter.current !== filterKey) {
    prevFilter.current = filterKey;
    if (page !== 0) setPage(0);
  }

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageRows = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const downloadCSV = useCallback(() => {
    const headers = ["Date", "Type", "Fuel", "Source", "Vehicle #", "Vehicle Name", "Estate", "Qty (L)", "Amount (₹)", "Mode of Payment", "Receiver", "Remarks"];
    const csvRows = [
      headers.join(","),
      ...filtered.map((r) =>
        [
          r.date, r.transaction_type, r.fuel_type,
          `"${r.source}"`, `"${r.vehicle_number}"`, `"${r.vehicle_name}"`, `"${r.estate}"`,
          r.qty_l, r.amount,
          `"${r.mode_of_payment}"`, `"${r.receiver_name}"`, `"${r.remarks}"`,
        ].join(",")
      ),
    ];
    const blob = new Blob([csvRows.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ho_fuel_log_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [filtered]);

  return (
    <div>
      <div className={css.filterBar}>
        <select className={css.sel} value={filterType} onChange={(e) => setFilterType(e.target.value)}>
          <option value="ALL">All Types</option>
          <option value="PURCHASE">Purchase</option>
          <option value="ISSUE">Issue</option>
        </select>
        <select className={css.sel} value={filterFuel} onChange={(e) => setFilterFuel(e.target.value)}>
          <option value="ALL">All Fuels</option>
          <option value="DIESEL">Diesel</option>
          <option value="PETROL">Petrol</option>
        </select>
        <select className={css.sel} value={filterMonth} onChange={(e) => setFilterMonth(e.target.value)}>
          <option value="ALL">All Months</option>
          {MONTHS.map((m, i) => <option key={m} value={String(i + 1)}>{m}</option>)}
        </select>
        <select className={css.sel} value={filterEstate} onChange={(e) => setFilterEstate(e.target.value)}>
          <option value="ALL">All Estates</option>
          {estates.map((e) => <option key={e} value={e}>{e}</option>)}
        </select>
        <input
          className={css.searchInput}
          placeholder="Search vehicle, estate, source…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <button className={css.exportBtn} onClick={downloadCSV}>
          <Download size={14} /> Export CSV
        </button>
      </div>

      <div className={css.tableCard} style={{ marginBottom: "1rem" }}>
        <table className={css.table}>
          <thead>
            <tr>
              <th>Date</th>
              <th>Type</th>
              <th>Fuel</th>
              <th>Source / Store</th>
              <th>Vehicle #</th>
              <th>Estate</th>
              <th className={css.tdRight}>Qty (L)</th>
              <th className={css.tdRight}>Amount</th>
              <th>Receiver</th>
              <th>Remarks</th>
            </tr>
          </thead>
          <tbody>
            {pageRows.length === 0 ? (
              <tr>
                <td colSpan={10} style={{ textAlign: "center", color: "rgba(255,255,255,0.3)", padding: "2rem" }}>
                  No transactions match the selected filters
                </td>
              </tr>
            ) : (
              pageRows.map((r) => (
                <tr key={r.id}>
                  <td style={{ whiteSpace: "nowrap" }}>{r.date}</td>
                  <td>
                    <span className={r.transaction_type === "PURCHASE" ? css.badgePurchase : css.badgeIssue}>
                      {r.transaction_type}
                    </span>
                  </td>
                  <td>
                    <span className={r.fuel_type === "DIESEL" ? css.badgeDiesel : css.badgePetrol}>
                      {r.fuel_type}
                    </span>
                  </td>
                  <td>{r.source}</td>
                  <td>{r.vehicle_number}</td>
                  <td>{r.estate}</td>
                  <td className={css.tdNum}>{fmt(r.qty_l)}</td>
                  <td className={css.tdNum}>{r.amount > 0 ? fmtCur(r.amount) : "—"}</td>
                  <td>{r.receiver_name}</td>
                  <td style={{ color: "rgba(255,255,255,0.5)", fontSize: "0.75rem" }}>{r.remarks}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className={css.pagination}>
        <span>{filtered.length} rows</span>
        <button className={css.pageBtn} disabled={page === 0} onClick={() => setPage(0)}>«</button>
        <button className={css.pageBtn} disabled={page === 0} onClick={() => setPage((p) => p - 1)}>‹</button>
        <span>Page {page + 1} / {totalPages}</span>
        <button className={css.pageBtn} disabled={page >= totalPages - 1} onClick={() => setPage((p) => p + 1)}>›</button>
        <button className={css.pageBtn} disabled={page >= totalPages - 1} onClick={() => setPage(totalPages - 1)}>»</button>
      </div>
    </div>
  );
}
