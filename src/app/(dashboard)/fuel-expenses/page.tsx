"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  BarChart, Bar, LineChart, Line, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer,
} from "recharts";
import {
  Upload, Plus, RefreshCw, Fuel, Gauge, Route,
  TrendingUp, Wrench, IndianRupee, ChevronLeft, ChevronRight,
  Pencil,
} from "lucide-react";
import { UploadModal } from "@/components/fleet/UploadModal";
import { RecordModal, FleetRecord } from "@/components/fleet/RecordModal";
import s from "./fleet.module.css";

/* ─── Types ──────────────────────────────────────────────────────────────────── */
type Row = FleetRecord & { id: number };

/* ─── Constants ──────────────────────────────────────────────────────────────── */
const ACCOUNTS = ["All", "BVE", "HFE", "ME", "ORE", "RSE", "SE"];
const VEHICLE_TYPES = ["All", "Estate", "Personal"];
const FUEL_TYPES = ["All", "Diesel", "Petrol"];
const LOG_PAGE_SIZE = 20;

const TEAL = "#1fc8c8";
const GOLD = "#f5a623";
const RED = "#e8524a";
const GREEN = "#2ecc71";
const PURPLE = "#a78bfa";
const BLUE = "#38bdf8";

const VEHICLE_PALETTE = [
  TEAL, GOLD, RED, GREEN, PURPLE, BLUE,
  "#fb923c", "#f472b6", "#a3e635", "#34d399", "#818cf8", "#fbbf24",
  "#60a5fa", "#e879f9",
];

/* ─── Helpers ────────────────────────────────────────────────────────────────── */
const fmt = (n: number, dec = 0) =>
  n.toLocaleString("en-IN", { maximumFractionDigits: dec, minimumFractionDigits: dec });

const fmtCurr = (n: number) =>
  "₹" + (n >= 100000 ? (n / 100000).toFixed(2) + "L" : n >= 1000 ? (n / 1000).toFixed(1) + "k" : fmt(n));

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function aggRows(rows: Row[]) {
  const totalKm = rows.reduce((a, r) => a + r.km_run, 0);
  const totalLitres = rows.reduce((a, r) => a + r.fuel_filled_l, 0);
  const fuelCost = rows.reduce((a, r) => a + r.fuel_cost, 0);
  const maintCost = rows.reduce((a, r) => a + r.maint_cost, 0);
  const totalCost = fuelCost + maintCost;
  const avgMileage = totalLitres > 0 ? totalKm / totalLitres : 0;
  const costPerKm = totalKm > 0 ? totalCost / totalKm : 0;
  return { totalKm, totalLitres, fuelCost, maintCost, totalCost, avgMileage, costPerKm };
}

/* ─── Tooltip styles ─────────────────────────────────────────────────────────── */
const ttStyle = {
  backgroundColor: "#16253a",
  border: "1px solid #2a3f5a",
  borderRadius: 8,
  fontSize: 11,
  color: "#e8edf4",
};

/* ─── Page ───────────────────────────────────────────────────────────────────── */
export default function FleetPage() {
  const [data, setData] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastRefreshed, setLastRefreshed] = useState("");
  const [maxDataDate, setMaxDataDate] = useState("");
  const [clock, setClock] = useState("");

  // Filters
  const [filterYear, setFilterYear] = useState("All");
  const [filterMonth, setFilterMonth] = useState("All");
  const [filterAccount, setFilterAccount] = useState("All");
  const [filterVehicleType, setFilterVehicleType] = useState("All");
  const [filterFuelType, setFilterFuelType] = useState("All");

  // Vehicle comparison
  const [selectedVehicles, setSelectedVehicles] = useState<string[]>([]);

  // Spotlight
  const [spotlightVehicle, setSpotlightVehicle] = useState("");

  // Period comparison
  const thisYear = new Date().getFullYear();
  const [periodA, setPeriodA] = useState({ from: `${thisYear}-01-01`, to: `${thisYear}-06-30` });
  const [periodB, setPeriodB] = useState({ from: `${thisYear - 1}-01-01`, to: `${thisYear - 1}-06-30` });

  // Modals
  const [showUpload, setShowUpload] = useState(false);
  const [editRecord, setEditRecord] = useState<Row | null | false>(false);

  // Log pagination
  const [logPage, setLogPage] = useState(1);

  /* ─── Clock ─────────────────────────────────────────────────────────────────── */
  useEffect(() => {
    const tick = () => setClock(new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }));
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, []);

  /* ─── Load data ──────────────────────────────────────────────────────────────── */
  const loadData = useCallback(async () => {
    setLoading(true);
    let all: Row[] = [];
    let from = 0;
    const BATCH = 1000;
    while (true) {
      const { data: rows, error } = await supabase
        .from("fleet_daily")
        .select("*")
        .order("date", { ascending: true })
        .range(from, from + BATCH - 1);
      if (error || !rows || rows.length === 0) break;
      all = [...all, ...rows];
      if (rows.length < BATCH) break;
      from += BATCH;
    }
    setData(all);
    if (all.length > 0) setMaxDataDate(all[all.length - 1].date);
    setLastRefreshed(new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true }));
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  /* ─── Derived: distinct lists ─────────────────────────────────────────────── */
  const years = useMemo(() => {
    const s = new Set(data.map((r) => String(r.year)));
    return ["All", ...Array.from(s).sort()];
  }, [data]);

  const vehicles = useMemo(() => {
    const s = new Set(data.map((r) => r.vehicle_id));
    return Array.from(s).sort();
  }, [data]);

  useEffect(() => {
    if (vehicles.length > 0 && !spotlightVehicle) setSpotlightVehicle(vehicles[0]);
  }, [vehicles, spotlightVehicle]);

  /* ─── Filtered data ──────────────────────────────────────────────────────────── */
  const filtered = useMemo(() => data.filter((r) => {
    const ry = r.year ?? new Date(r.date).getFullYear();
    const rm = r.month ?? new Date(r.date).getMonth() + 1;
    if (filterYear !== "All" && String(ry) !== filterYear) return false;
    if (filterMonth !== "All" && String(rm) !== filterMonth) return false;
    if (filterAccount !== "All" && r.account !== filterAccount) return false;
    if (filterVehicleType !== "All" && r.vehicle_type !== filterVehicleType) return false;
    if (filterFuelType !== "All" && r.fuel_type !== filterFuelType) return false;
    return true;
  }), [data, filterYear, filterMonth, filterAccount, filterVehicleType, filterFuelType]);

  /* ─── KPIs ───────────────────────────────────────────────────────────────────── */
  const kpis = useMemo(() => aggRows(filtered), [filtered]);

  /* ─── Monthly trend (for charts) ─────────────────────────────────────────────── */
  const monthlyTrend = useMemo(() => {
    const map = new Map<string, { key: string; label: string; fuelCost: number; maintCost: number; kmRun: number; litres: number; avgMileage?: number }>();
    filtered.forEach((r) => {
      const yr = r.year ?? new Date(r.date).getFullYear();
      const mo = r.month ?? new Date(r.date).getMonth() + 1;
      const key = `${yr}-${String(mo).padStart(2, "0")}`;
      const label = `${MONTH_NAMES[mo - 1]} ${yr}`;
      const ex = map.get(key) ?? { key, label, fuelCost: 0, maintCost: 0, kmRun: 0, litres: 0 };
      ex.fuelCost += r.fuel_cost;
      ex.maintCost += r.maint_cost;
      ex.kmRun += r.km_run;
      ex.litres += r.fuel_filled_l;
      map.set(key, ex);
    });
    return Array.from(map.values())
      .sort((a, b) => a.key.localeCompare(b.key))
      .map((m) => ({ ...m, avgMileage: m.litres > 0 ? parseFloat((m.kmRun / m.litres).toFixed(2)) : 0 }));
  }, [filtered]);

  /* ─── Annual trend ────────────────────────────────────────────────────────────── */
  const annualTrend = useMemo(() => {
    const map = new Map<number, { year: number; fuelCost: number; maintCost: number; kmRun: number }>();
    data.forEach((r) => {
      const ry = r.year ?? new Date(r.date).getFullYear();
      const ex = map.get(ry) ?? { year: ry, fuelCost: 0, maintCost: 0, kmRun: 0 };
      ex.fuelCost += r.fuel_cost;
      ex.maintCost += r.maint_cost;
      ex.kmRun += r.km_run;
      map.set(ry, ex);
    });
    return Array.from(map.values()).sort((a, b) => a.year - b.year);
  }, [data]);

  /* ─── Per-vehicle aggregates (filtered) ──────────────────────────────────────── */
  const vehicleAgg = useMemo(() => {
    const map = new Map<string, ReturnType<typeof aggRows> & { id: string }>();
    filtered.forEach((r) => {
      const ex = map.get(r.vehicle_id);
      if (ex) {
        ex.totalKm += r.km_run;
        ex.totalLitres += r.fuel_filled_l;
        ex.fuelCost += r.fuel_cost;
        ex.maintCost += r.maint_cost;
        ex.totalCost = ex.fuelCost + ex.maintCost;
        ex.avgMileage = ex.totalLitres > 0 ? ex.totalKm / ex.totalLitres : 0;
        ex.costPerKm = ex.totalKm > 0 ? ex.totalCost / ex.totalKm : 0;
      } else {
        map.set(r.vehicle_id, { id: r.vehicle_id, ...aggRows([r]) });
      }
    });
    return map;
  }, [filtered]);

  /* ─── Spotlight ──────────────────────────────────────────────────────────────── */
  const spotlightMonthly = useMemo(() => {
    const spotRows = filtered.filter((r) => r.vehicle_id === spotlightVehicle);
    const map = new Map<string, { label: string; fuelCost: number; maintCost: number; kmRun: number; litres: number; avgMileage: number }>();
    spotRows.forEach((r) => {
      const yr = r.year ?? new Date(r.date).getFullYear();
      const mo = r.month ?? new Date(r.date).getMonth() + 1;
      const key = `${yr}-${String(mo).padStart(2, "0")}`;
      const ex = map.get(key) ?? { label: `${MONTH_NAMES[mo - 1]} ${yr}`, fuelCost: 0, maintCost: 0, kmRun: 0, litres: 0, avgMileage: 0 };
      ex.fuelCost += r.fuel_cost;
      ex.maintCost += r.maint_cost;
      ex.kmRun += r.km_run;
      ex.litres += r.fuel_filled_l;
      map.set(key, ex);
    });
    return Array.from(map.values()).map((m) => ({
      ...m,
      avgMileage: m.litres > 0 ? parseFloat((m.kmRun / m.litres).toFixed(2)) : 0,
    }));
  }, [filtered, spotlightVehicle]);

  const spotlightAgg = useMemo(() => vehicleAgg.get(spotlightVehicle), [vehicleAgg, spotlightVehicle]);

  /* ─── Period comparison ───────────────────────────────────────────────────────── */
  const inPeriod = (r: Row, p: { from: string; to: string }) =>
    r.date >= p.from && r.date <= p.to;

  const periodAData = useMemo(() => aggRows(data.filter((r) => inPeriod(r, periodA))), [data, periodA]);
  const periodBData = useMemo(() => aggRows(data.filter((r) => inPeriod(r, periodB))), [data, periodB]);

  const delta = (a: number, b: number) => (b === 0 ? 0 : ((a - b) / b) * 100);

  /* ─── Log table ──────────────────────────────────────────────────────────────── */
  const logSorted = useMemo(() => [...filtered].reverse(), [filtered]);
  const logPages = Math.max(1, Math.ceil(logSorted.length / LOG_PAGE_SIZE));
  const logSlice = logSorted.slice((logPage - 1) * LOG_PAGE_SIZE, logPage * LOG_PAGE_SIZE);

  /* ─── Vehicle toggle ─────────────────────────────────────────────────────────── */
  const toggleVehicle = (v: string) =>
    setSelectedVehicles((prev) =>
      prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v]
    );

  const vehicleColor = (v: string) =>
    VEHICLE_PALETTE[vehicles.indexOf(v) % VEHICLE_PALETTE.length];

  /* ─── Today string ───────────────────────────────────────────────────────────── */
  const today = new Date().toLocaleDateString("en-IN", {
    weekday: "short", day: "numeric", month: "short", year: "numeric",
  });

  /* ─── Reset filters ──────────────────────────────────────────────────────────── */
  const resetFilters = () => {
    setFilterYear("All"); setFilterMonth("All");
    setFilterAccount("All"); setFilterVehicleType("All"); setFilterFuelType("All");
    setLogPage(1);
  };

  /* ══════════════════════════════════════════════════════════════════════════════ */
  return (
    <div className={s.page}>
      <div className={s.content}>

        {/* ── Header ─────────────────────────────────────────────────────────────── */}
        <div className={s.header}>
          <div>
            <div className={s.eyebrow}>Fleet Operations</div>
            <h1 className={s.title}>
              Fleet <span className={s.titleStrong}>Fuel</span> Expenses
            </h1>
          </div>
          <div style={{ textAlign: "right" }}>
            <div className={s.clockDisplay}>{clock}</div>
            <div className={s.dateDisplay}>{today.toUpperCase()}</div>
            {maxDataDate && (
              <div className={s.lastUpdated}>
                data through <span>{maxDataDate}</span> · refreshed {lastRefreshed}
              </div>
            )}
          </div>
        </div>

        {/* ── Controls ───────────────────────────────────────────────────────────── */}
        <div className={s.controlsPanel}>
          <div className={s.ctrlGroup}>
            <span className={s.ctrlLabel}>Year</span>
            <select className={s.ctrlSelect} value={filterYear}
              onChange={(e) => { setFilterYear(e.target.value); setLogPage(1); }}>
              {years.map((y) => <option key={y}>{y}</option>)}
            </select>
          </div>
          <div className={s.ctrlGroup}>
            <span className={s.ctrlLabel}>Month</span>
            <select className={s.ctrlSelect} value={filterMonth}
              onChange={(e) => { setFilterMonth(e.target.value); setLogPage(1); }}>
              <option value="All">All</option>
              {MONTH_NAMES.map((m, i) => <option key={i + 1} value={String(i + 1)}>{m}</option>)}
            </select>
          </div>
          <div className={s.ctrlGroup}>
            <span className={s.ctrlLabel}>Account</span>
            <select className={s.ctrlSelect} value={filterAccount}
              onChange={(e) => { setFilterAccount(e.target.value); setLogPage(1); }}>
              {ACCOUNTS.map((a) => <option key={a}>{a}</option>)}
            </select>
          </div>
          <div className={s.ctrlGroup}>
            <span className={s.ctrlLabel}>Vehicle Type</span>
            <select className={s.ctrlSelect} value={filterVehicleType}
              onChange={(e) => { setFilterVehicleType(e.target.value); setLogPage(1); }}>
              {VEHICLE_TYPES.map((t) => <option key={t}>{t}</option>)}
            </select>
          </div>
          <div className={s.ctrlGroup}>
            <span className={s.ctrlLabel}>Fuel</span>
            <select className={s.ctrlSelect} value={filterFuelType}
              onChange={(e) => { setFilterFuelType(e.target.value); setLogPage(1); }}>
              {FUEL_TYPES.map((f) => <option key={f}>{f}</option>)}
            </select>
          </div>
          <button className={s.resetBtn} onClick={resetFilters}>Reset</button>
          <button className={s.actionBtn} onClick={loadData} disabled={loading}>
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
          <button className={s.actionBtn} onClick={() => setEditRecord(null)}>
            <Plus className="h-3.5 w-3.5" />
            Add Record
          </button>
          <button className={s.uploadBtn} onClick={() => setShowUpload(true)}>
            <Upload className="h-3.5 w-3.5" />
            Upload Excel
          </button>
        </div>

        {loading && (
          <div style={{ textAlign: "center", padding: "60px 0", color: TEAL, opacity: 0.6, letterSpacing: "0.2em", fontSize: 11 }}>
            LOADING DATA…
          </div>
        )}

        {!loading && (
          <>
            {/* ── KPI Grid ─────────────────────────────────────────────────────────── */}
            <div className={s.sectionLabel}><span className={s.sectionLabelTeal}>Key Metrics</span></div>
            <div className={s.kpiGrid}>
              {[
                { icon: <IndianRupee size={16} />, label: "Total Fuel Cost", value: fmtCurr(kpis.fuelCost), sub: `${fmt(filtered.filter(r=>r.fuel_type==="Diesel").length)} diesel · ${fmt(filtered.filter(r=>r.fuel_type==="Petrol").length)} petrol records`, accent: GOLD },
                { icon: <Route size={16} />, label: "Total KM Run", value: fmt(kpis.totalKm), sub: `across ${new Set(filtered.map(r=>r.vehicle_id)).size} vehicles`, accent: TEAL },
                { icon: <Gauge size={16} />, label: "Fleet Avg Mileage", value: fmt(kpis.avgMileage, 2), sub: "km / litre · fleet average", accent: GREEN },
                { icon: <Fuel size={16} />, label: "Fuel Filled", value: fmt(kpis.totalLitres, 0), sub: "litres total", accent: BLUE },
                { icon: <TrendingUp size={16} />, label: "Avg Cost / KM", value: `₹${fmt(kpis.costPerKm, 2)}`, sub: "total cost ÷ km", accent: PURPLE },
                { icon: <Wrench size={16} />, label: "Maintenance", value: fmtCurr(kpis.maintCost), sub: `${fmt(kpis.maintCost > 0 ? (kpis.maintCost / kpis.totalCost) * 100 : 0, 1)}% of total spend`, accent: RED },
              ].map((k) => (
                <div key={k.label} className={s.kpiCard} style={{ ["--accent" as string]: k.accent }}>
                  <div className={s.kpiIcon}>{k.icon}</div>
                  <div className={s.kpiLabel}>{k.label}</div>
                  <div className={s.kpiValue}>{k.value}</div>
                  <div className={s.kpiSub}>{k.sub}</div>
                </div>
              ))}
            </div>

            {/* ── Vehicle Compare Selector ──────────────────────────────────────────── */}
            <div className={s.sectionLabel}><span>Vehicle Comparison</span></div>
            <div className={s.vehicleSelector}>
              <div style={{ fontSize: 9, letterSpacing: "0.2em", color: "#7a90b0", marginBottom: 10, textTransform: "uppercase" }}>
                Select vehicles to compare · {selectedVehicles.length} selected
              </div>
              <div className={s.pillsRow}>
                {vehicles.map((v) => {
                  const active = selectedVehicles.includes(v);
                  const color = vehicleColor(v);
                  return (
                    <button
                      key={v}
                      onClick={() => toggleVehicle(v)}
                      className={active ? s.pill : s.pillInactive}
                      style={active ? { borderColor: color, color, backgroundColor: `${color}18` } : {}}
                    >
                      <span style={{ width: 7, height: 7, borderRadius: "50%", background: active ? color : "#3a5070", flexShrink: 0, display: "inline-block" }} />
                      {v}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* ── Compare Cards ─────────────────────────────────────────────────────── */}
            {selectedVehicles.length > 0 && (
              <div className={s.compareGrid}>
                {selectedVehicles.map((v) => {
                  const agg = vehicleAgg.get(v);
                  const color = vehicleColor(v);
                  if (!agg) return null;
                  return (
                    <div key={v} className={s.vehicleCard} style={{ borderTopColor: color }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                        <span style={{ fontSize: 8, letterSpacing: "0.15em", color, textTransform: "uppercase" }}>Vehicle</span>
                        <span style={{ fontSize: 14, fontWeight: 700, color: "#fff" }}>{v}</span>
                        <span className={`${s.tag} ${filtered.find(r=>r.vehicle_id===v)?.vehicle_type === "Personal" ? s.tagPersonal : s.tagEstate}`}
                          style={{ marginLeft: "auto" }}>
                          {filtered.find(r=>r.vehicle_id===v)?.vehicle_type ?? "Estate"}
                        </span>
                      </div>
                      <div className={s.vehicleMetrics}>
                        {[
                          { label: "Total Cost", val: fmtCurr(agg.totalCost), color: GOLD },
                          { label: "KM Run", val: fmt(agg.totalKm), color },
                          { label: "Mileage", val: `${fmt(agg.avgMileage, 2)} km/L`, color: GREEN },
                          { label: "Litres", val: fmt(agg.totalLitres, 0), color: BLUE },
                          { label: "Cost/KM", val: `₹${fmt(agg.costPerKm, 2)}`, color: PURPLE },
                          { label: "Maintenance", val: fmtCurr(agg.maintCost), color: RED },
                        ].map((m) => (
                          <div key={m.label} className={s.metricItem}>
                            <div style={{ fontSize: 8, letterSpacing: "0.15em", color: "#7a90b0", textTransform: "uppercase", marginBottom: 2 }}>{m.label}</div>
                            <div style={{ fontSize: 16, fontWeight: 700, color: m.color }}>{m.val}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* ── Charts 2×2 ───────────────────────────────────────────────────────── */}
            <div className={s.sectionLabel}><span className={s.sectionLabelTeal}>Trends &amp; Analysis</span></div>
            <div className={s.chartsQuad}>
              {/* Monthly Fuel Cost */}
              <div className={s.quadCard}>
                <div className={s.quadTitle}>Monthly Fuel Cost</div>
                <ResponsiveContainer width="100%" height={200}>
                  <AreaChart data={monthlyTrend} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="fuelGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={GOLD} stopOpacity={0.3} />
                        <stop offset="95%" stopColor={GOLD} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1b2a3d" vertical={false} />
                    <XAxis dataKey="label" tick={{ fill: "#7a90b0", fontSize: 9 }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                    <YAxis tick={{ fill: "#7a90b0", fontSize: 9 }} axisLine={false} tickLine={false} tickFormatter={(v) => fmtCurr(v)} width={54} />
                    <Tooltip contentStyle={ttStyle} formatter={(v: unknown) => [fmtCurr(v as number), "Fuel Cost"]} />
                    <Area type="monotone" dataKey="fuelCost" stroke={GOLD} fill="url(#fuelGrad)" strokeWidth={2} dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              {/* Monthly KM Run */}
              <div className={s.quadCard}>
                <div className={s.quadTitle}>Monthly KM Run</div>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={monthlyTrend} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1b2a3d" vertical={false} />
                    <XAxis dataKey="label" tick={{ fill: "#7a90b0", fontSize: 9 }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                    <YAxis tick={{ fill: "#7a90b0", fontSize: 9 }} axisLine={false} tickLine={false} tickFormatter={(v) => fmt(v)} width={48} />
                    <Tooltip contentStyle={ttStyle} formatter={(v: unknown) => [fmt(v as number) + " km", "KM Run"]} />
                    <Bar dataKey="kmRun" fill={TEAL} fillOpacity={0.8} radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Avg Mileage Trend */}
              <div className={s.quadCard}>
                <div className={s.quadTitle}>Fleet Avg Mileage (km/L)</div>
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={monthlyTrend} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1b2a3d" vertical={false} />
                    <XAxis dataKey="label" tick={{ fill: "#7a90b0", fontSize: 9 }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                    <YAxis tick={{ fill: "#7a90b0", fontSize: 9 }} axisLine={false} tickLine={false} tickFormatter={(v) => v.toFixed(1)} width={36} />
                    <Tooltip contentStyle={ttStyle} formatter={(v: unknown) => [(v as number).toFixed(2) + " km/L", "Avg Mileage"]} />
                    <Line type="monotone" dataKey="avgMileage" stroke={GREEN} strokeWidth={2} dot={{ r: 3, fill: GREEN }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              {/* Fuel vs Maintenance */}
              <div className={s.quadCard}>
                <div className={s.quadTitle}>Fuel vs Maintenance Cost</div>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={monthlyTrend} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1b2a3d" vertical={false} />
                    <XAxis dataKey="label" tick={{ fill: "#7a90b0", fontSize: 9 }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                    <YAxis tick={{ fill: "#7a90b0", fontSize: 9 }} axisLine={false} tickLine={false} tickFormatter={(v) => fmtCurr(v)} width={54} />
                    <Tooltip contentStyle={ttStyle} formatter={(v: unknown, n: unknown) => [fmtCurr(v as number), n === "fuelCost" ? "Fuel" : "Maintenance"]} />
                    <Legend wrapperStyle={{ fontSize: 10, color: "#7a90b0" }} />
                    <Bar dataKey="fuelCost" name="fuelCost" stackId="a" fill={GOLD} fillOpacity={0.85} />
                    <Bar dataKey="maintCost" name="maintCost" stackId="a" fill={RED} fillOpacity={0.85} radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* ── Annual Trend ──────────────────────────────────────────────────────── */}
            <div className={s.chartSection}>
              <div className={s.sectionLabel}><span className={s.sectionLabelTeal}>Annual Cost Trend</span></div>
              <div className={s.quadCard} style={{ marginBottom: 0 }}>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={annualTrend} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1b2a3d" vertical={false} />
                    <XAxis dataKey="year" tick={{ fill: "#7a90b0", fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: "#7a90b0", fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v) => fmtCurr(v)} width={60} />
                    <Tooltip contentStyle={ttStyle} formatter={(v: unknown, n: unknown) => [fmtCurr(v as number), n === "fuelCost" ? "Fuel" : "Maintenance"]} />
                    <Legend wrapperStyle={{ fontSize: 10, color: "#7a90b0" }} />
                    <Bar dataKey="fuelCost" name="fuelCost" stackId="a" fill={GOLD} fillOpacity={0.85} />
                    <Bar dataKey="maintCost" name="maintCost" stackId="a" fill={RED} fillOpacity={0.85} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* ── Vehicle Spotlight ─────────────────────────────────────────────────── */}
            <div className={s.spotlightSection}>
              <div className={s.sectionLabel}><span className={s.sectionLabelTeal}>Vehicle Spotlight</span></div>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
                <select className={s.ctrlSelect} value={spotlightVehicle}
                  onChange={(e) => setSpotlightVehicle(e.target.value)}>
                  {vehicles.map((v) => <option key={v}>{v}</option>)}
                </select>
                {spotlightAgg && (
                  <div className={s.spotKpis}>
                    {[
                      { l: "Total Cost", v: fmtCurr(spotlightAgg.totalCost), c: GOLD },
                      { l: "KM Run", v: fmt(spotlightAgg.totalKm), c: TEAL },
                      { l: "Avg Mileage", v: `${fmt(spotlightAgg.avgMileage, 2)} km/L`, c: GREEN },
                      { l: "Cost/KM", v: `₹${fmt(spotlightAgg.costPerKm, 2)}`, c: PURPLE },
                    ].map((k) => (
                      <div key={k.l} style={{ textAlign: "center" }}>
                        <div style={{ fontSize: 8, letterSpacing: "0.15em", color: "#7a90b0", textTransform: "uppercase" }}>{k.l}</div>
                        <div style={{ fontSize: 18, fontWeight: 700, color: k.c }}>{k.v}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className={s.quadCard} style={{ marginBottom: 0 }}>
                <div className={s.quadTitle}>Monthly cost breakdown — {spotlightVehicle}</div>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={spotlightMonthly} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1b2a3d" vertical={false} />
                    <XAxis dataKey="label" tick={{ fill: "#7a90b0", fontSize: 9 }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                    <YAxis tick={{ fill: "#7a90b0", fontSize: 9 }} axisLine={false} tickLine={false} tickFormatter={(v) => fmtCurr(v)} width={54} />
                    <Tooltip contentStyle={ttStyle} formatter={(v: unknown, n: unknown) => [fmtCurr(v as number), n === "fuelCost" ? "Fuel" : "Maintenance"]} />
                    <Legend wrapperStyle={{ fontSize: 10, color: "#7a90b0" }} />
                    <Bar dataKey="fuelCost" name="fuelCost" stackId="a" fill={vehicleColor(spotlightVehicle)} fillOpacity={0.85} />
                    <Bar dataKey="maintCost" name="maintCost" stackId="a" fill={RED} fillOpacity={0.85} radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* ── Period Comparison ─────────────────────────────────────────────────── */}
            <div className={s.periodSection}>
              <div className={s.sectionLabel}><span className={s.sectionLabelTeal}>Period Comparison</span></div>
              <div className={s.periodGrid}>
                {/* Period A */}
                <div className={s.periodCol}>
                  <div style={{ fontSize: 9, letterSpacing: "0.2em", color: TEAL, textTransform: "uppercase", marginBottom: 8 }}>Period A</div>
                  <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                    <input type="date" value={periodA.from}
                      onChange={(e) => setPeriodA((p) => ({ ...p, from: e.target.value }))}
                      className={s.ctrlSelect} style={{ flex: 1 }} />
                    <input type="date" value={periodA.to}
                      onChange={(e) => setPeriodA((p) => ({ ...p, to: e.target.value }))}
                      className={s.ctrlSelect} style={{ flex: 1 }} />
                  </div>
                  {[
                    { l: "Total Cost", v: fmtCurr(periodAData.totalCost), c: GOLD },
                    { l: "KM Run", v: fmt(periodAData.totalKm), c: TEAL },
                    { l: "Avg Mileage", v: `${fmt(periodAData.avgMileage, 2)} km/L`, c: GREEN },
                    { l: "Cost/KM", v: `₹${fmt(periodAData.costPerKm, 2)}`, c: PURPLE },
                  ].map((k) => (
                    <div key={k.l} style={{ marginBottom: 8 }}>
                      <div style={{ fontSize: 8, letterSpacing: "0.15em", color: "#7a90b0", textTransform: "uppercase" }}>{k.l}</div>
                      <div style={{ fontSize: 22, fontWeight: 700, color: k.c }}>{k.v}</div>
                    </div>
                  ))}
                </div>

                {/* Delta cards */}
                <div style={{ display: "flex", flexDirection: "column", gap: 8, justifyContent: "center" }}>
                  {[
                    { l: "Total Cost Δ", d: delta(periodAData.totalCost, periodBData.totalCost) },
                    { l: "KM Run Δ", d: delta(periodAData.totalKm, periodBData.totalKm) },
                    { l: "Mileage Δ", d: delta(periodAData.avgMileage, periodBData.avgMileage) },
                    { l: "Cost/KM Δ", d: delta(periodAData.costPerKm, periodBData.costPerKm) },
                  ].map((k) => {
                    const up = k.d >= 0;
                    return (
                      <div key={k.l} className={s.deltaCard}>
                        <div style={{ fontSize: 8, letterSpacing: "0.15em", color: "#7a90b0", textTransform: "uppercase" }}>{k.l}</div>
                        <div style={{ fontSize: 18, fontWeight: 700, color: up ? GREEN : RED }}>
                          {up ? "▲" : "▼"} {Math.abs(k.d).toFixed(1)}%
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Period B */}
                <div className={s.periodCol}>
                  <div style={{ fontSize: 9, letterSpacing: "0.2em", color: "#7a90b0", textTransform: "uppercase", marginBottom: 8 }}>Period B</div>
                  <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                    <input type="date" value={periodB.from}
                      onChange={(e) => setPeriodB((p) => ({ ...p, from: e.target.value }))}
                      className={s.ctrlSelect} style={{ flex: 1 }} />
                    <input type="date" value={periodB.to}
                      onChange={(e) => setPeriodB((p) => ({ ...p, to: e.target.value }))}
                      className={s.ctrlSelect} style={{ flex: 1 }} />
                  </div>
                  {[
                    { l: "Total Cost", v: fmtCurr(periodBData.totalCost), c: GOLD },
                    { l: "KM Run", v: fmt(periodBData.totalKm), c: TEAL },
                    { l: "Avg Mileage", v: `${fmt(periodBData.avgMileage, 2)} km/L`, c: GREEN },
                    { l: "Cost/KM", v: `₹${fmt(periodBData.costPerKm, 2)}`, c: PURPLE },
                  ].map((k) => (
                    <div key={k.l} style={{ marginBottom: 8 }}>
                      <div style={{ fontSize: 8, letterSpacing: "0.15em", color: "#7a90b0", textTransform: "uppercase" }}>{k.l}</div>
                      <div style={{ fontSize: 22, fontWeight: 700, color: k.c }}>{k.v}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* ── Daily Log Table ───────────────────────────────────────────────────── */}
            <div className={s.recordsSection}>
              <div className={s.sectionLabel}><span className={s.sectionLabelTeal}>Daily Log</span></div>
              <div style={{ fontSize: 10, color: "#7a90b0", marginBottom: 10 }}>
                {filtered.length.toLocaleString()} records · showing newest first
              </div>
              <div className={s.tableSection}>
                <table className={s.tableEl}>
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Vehicle</th>
                      <th>Type</th>
                      <th>Account</th>
                      <th>Fuel</th>
                      <th className="text-right">KM Run</th>
                      <th className="text-right">Litres</th>
                      <th className="text-right">Fuel ₹</th>
                      <th className="text-right">Maint ₹</th>
                      <th className="text-right">Total ₹</th>
                      <th className="text-right">km/L</th>
                      <th className="text-right">₹/km</th>
                      <th>Maintenance</th>
                      <th>Remarks</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {logSlice.map((r) => (
                      <tr key={r.id}>
                        <td style={{ whiteSpace: "nowrap" }}>{r.date}</td>
                        <td style={{ color: vehicleColor(r.vehicle_id), fontWeight: 600 }}>{r.vehicle_id}</td>
                        <td>
                          <span className={`${s.tag} ${r.vehicle_type === "Personal" ? s.tagPersonal : s.tagEstate}`}>
                            {r.vehicle_type}
                          </span>
                        </td>
                        <td>{r.account}</td>
                        <td>
                          <span className={`${s.tag} ${r.fuel_type === "Petrol" ? s.tagPetrol : s.tagDiesel}`}>
                            {r.fuel_type}
                          </span>
                        </td>
                        <td style={{ textAlign: "right" }}>{fmt(r.km_run)}</td>
                        <td style={{ textAlign: "right" }}>{fmt(r.fuel_filled_l, 1)}</td>
                        <td style={{ textAlign: "right", color: GOLD }}>{fmt(r.fuel_cost)}</td>
                        <td style={{ textAlign: "right", color: RED }}>{fmt(r.maint_cost)}</td>
                        <td style={{ textAlign: "right", color: GOLD, fontWeight: 600 }}>{fmt(r.total_cost)}</td>
                        <td style={{ textAlign: "right", color: GREEN }}>{fmt(r.avg_mileage, 2)}</td>
                        <td style={{ textAlign: "right", color: PURPLE }}>{fmt(r.cost_per_km, 2)}</td>
                        <td style={{ color: "#7a90b0", maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={r.maintenance_performed}>{r.maintenance_performed || "—"}</td>
                        <td style={{ color: "#7a90b0", maxWidth: 100, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={r.remarks}>{r.remarks || "—"}</td>
                        <td>
                          <button
                            onClick={() => setEditRecord(r)}
                            style={{ background: "none", border: "none", color: "#3a5070", cursor: "pointer", padding: "2px 4px" }}
                            className="hover:text-[#1fc8c8]"
                          >
                            <Pencil size={13} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {logPages > 1 && (
                <div className={s.paginationRow}>
                  <button
                    onClick={() => setLogPage((p) => Math.max(1, p - 1))}
                    disabled={logPage === 1}
                    className={s.pageBtn}
                  >
                    <ChevronLeft size={14} />
                  </button>
                  <span style={{ fontSize: 11, color: "#7a90b0" }}>
                    Page {logPage} of {logPages}
                  </span>
                  <button
                    onClick={() => setLogPage((p) => Math.min(logPages, p + 1))}
                    disabled={logPage === logPages}
                    className={s.pageBtn}
                  >
                    <ChevronRight size={14} />
                  </button>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* ── Modals ─────────────────────────────────────────────────────────────────── */}
      {showUpload && (
        <UploadModal onClose={() => setShowUpload(false)} onSuccess={loadData} />
      )}
      {editRecord !== false && (
        <RecordModal
          record={editRecord}
          vehicles={vehicles}
          onClose={() => setEditRecord(false)}
          onSuccess={loadData}
        />
      )}
    </div>
  );
}
