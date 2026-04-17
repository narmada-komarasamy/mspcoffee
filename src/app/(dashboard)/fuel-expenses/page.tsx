"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  BarChart, Bar, LineChart, Line, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer,
} from "recharts";
import { Upload, Plus, RefreshCw, ChevronLeft, ChevronRight, Pencil } from "lucide-react";
import { UploadModal } from "@/components/fleet/UploadModal";
import { RecordModal, FleetRecord } from "@/components/fleet/RecordModal";
import s from "./fleet.module.css";

/* ─── Types ──────────────────────────────────────────────────────────────────── */
type Row = FleetRecord & { id: number };

/* ─── Constants ──────────────────────────────────────────────────────────────── */
const MONTH_NAMES = ["Jan","Feb","Mar","Apr","May","June","Jul","Aug","Sep","Oct","Nov","Dec"];
const LOG_PAGE_SIZE = 20;
const TEAL   = "#1fc8c8";
const GOLD   = "#f5a623";
const RED    = "#e8524a";
const GREEN  = "#2ecc71";
const PURPLE = "#9b59b6";
const BLUE   = "#3498db";

const VEHICLE_PALETTE = [
  TEAL, GOLD, RED, GREEN, PURPLE, BLUE,
  "#fb923c","#f472b6","#a3e635","#34d399","#818cf8","#fbbf24","#60a5fa","#e879f9",
];

/* ─── Helpers ────────────────────────────────────────────────────────────────── */
const fmt  = (n: number, dec = 0) => n.toLocaleString("en-IN", { maximumFractionDigits: dec, minimumFractionDigits: dec });
const fmtC = (n: number) => n >= 100000 ? "₹" + (n/100000).toFixed(2) + "L" : n >= 1000 ? "₹" + (n/1000).toFixed(1) + "k" : "₹" + fmt(n);

function aggRows(rows: Row[]) {
  const totalKm     = rows.reduce((a, r) => a + r.km_run, 0);
  const totalLitres = rows.reduce((a, r) => a + r.fuel_filled_l, 0);
  const fuelCost    = rows.reduce((a, r) => a + r.fuel_cost, 0);
  const maintCost   = rows.reduce((a, r) => a + r.maint_cost, 0);
  const totalCost   = fuelCost + maintCost;
  const startKm     = rows.length > 0 ? Math.min(...rows.map(r => r.starting_km).filter(v => v > 0)) : 0;
  const closeKm     = rows.length > 0 ? Math.max(...rows.map(r => r.closing_km)) : 0;
  return {
    totalKm, totalLitres, fuelCost, maintCost, totalCost,
    avgMileage: totalLitres > 0 ? totalKm / totalLitres : 0,
    costPerKm:  totalKm > 0 ? totalCost / totalKm : 0,
    startKm, closeKm,
  };
}

const ttStyle = { backgroundColor:"#16253a", border:"1px solid #2a3f5a", borderRadius:8, fontSize:11, color:"#e8edf4" };

function filterRows(rows: Row[], vehicle: string, year: string, month: string, type?: string) {
  return rows.filter(r => {
    const ry = r.year  ?? new Date(r.date).getFullYear();
    const rm = r.month ?? new Date(r.date).getMonth() + 1;
    if (vehicle && vehicle !== "ALL" && r.vehicle_id !== vehicle) return false;
    if (year    && year    !== "ALL" && String(ry) !== year) return false;
    if (month   && month   !== "ALL" && MONTH_NAMES[rm - 1] !== month) return false;
    if (type    && type    !== "ALL" && r.vehicle_type !== type) return false;
    return true;
  });
}

/* ══════════════════════════════════════════════════════════════════════════════ */
export default function FleetPage() {
  const [data,         setData]         = useState<Row[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [lastRefreshed,setLastRefreshed]= useState("");
  const [maxDataDate,  setMaxDataDate]  = useState("");
  const [clock,        setClock]        = useState("");

  /* ── Spotlight filters ───────────────────────────────────────────────────────── */
  const [svVehicle, setSvVehicle] = useState("");
  const [svYear,    setSvYear]    = useState("ALL");
  const [svMonth,   setSvMonth]   = useState("ALL");

  /* ── KPI filters ─────────────────────────────────────────────────────────────── */
  const [kpiVehicle, setKpiVehicle] = useState("ALL");
  const [kpiYear,    setKpiYear]    = useState("ALL");
  const [kpiMonth,   setKpiMonth]   = useState("ALL");
  const [kpiType,    setKpiType]    = useState("ALL");

  /* ── Comparison filters ──────────────────────────────────────────────────────── */
  const [cmpYear,  setCmpYear]  = useState("ALL");
  const [cmpMonth, setCmpMonth] = useState("ALL");
  const [cmpV1,    setCmpV1]    = useState("");
  const [cmpV2,    setCmpV2]    = useState("");

  /* ── Period comparison ───────────────────────────────────────────────────────── */
  const thisYear = new Date().getFullYear();
  const [periodA, setPeriodA] = useState({ from: `${thisYear}-01-01`, to: `${thisYear}-06-30` });
  const [periodB, setPeriodB] = useState({ from: `${thisYear-1}-01-01`, to: `${thisYear-1}-06-30` });

  /* ── Log table ───────────────────────────────────────────────────────────────── */
  const [logPage,    setLogPage]    = useState(1);
  const [logVehicle, setLogVehicle] = useState("ALL");
  const [logYear,    setLogYear]    = useState("ALL");
  const [logMonth,   setLogMonth]   = useState("ALL");

  /* ── Modals ──────────────────────────────────────────────────────────────────── */
  const [showUpload, setShowUpload] = useState(false);
  const [editRecord, setEditRecord] = useState<Row | null | false>(false);

  /* ─── Clock ──────────────────────────────────────────────────────────────────── */
  useEffect(() => {
    const tick = () => setClock(new Date().toLocaleString("en-IN", { weekday:"short", day:"numeric", month:"short", year:"numeric", hour:"2-digit", minute:"2-digit", second:"2-digit", hour12:false }));
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
        .from("fleet_daily").select("*")
        .order("date", { ascending: true })
        .range(from, from + BATCH - 1);
      if (error || !rows || rows.length === 0) break;
      all = [...all, ...rows];
      if (rows.length < BATCH) break;
      from += BATCH;
    }
    setData(all);
    if (all.length > 0) {
      setMaxDataDate(all[all.length - 1].date);
      if (!cmpV1 && !cmpV2) {
        const vs = Array.from(new Set(all.map(r => r.vehicle_id))).sort();
        if (vs[0]) setCmpV1(vs[0]);
        if (vs[1]) setCmpV2(vs[1]);
        if (vs[0]) setSvVehicle(vs[0]);
      }
    }
    setLastRefreshed(new Date().toLocaleTimeString("en-IN", { hour:"2-digit", minute:"2-digit", hour12:true }));
    setLoading(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  /* ─── Derived ─────────────────────────────────────────────────────────────────── */
  const vehicles = useMemo(() => Array.from(new Set(data.map(r => r.vehicle_id))).sort(), [data]);
  const years    = useMemo(() => Array.from(new Set(data.map(r => String(r.year ?? new Date(r.date).getFullYear())))).sort(), [data]);

  const svRows  = useMemo(() => filterRows(data, svVehicle, svYear, svMonth), [data, svVehicle, svYear, svMonth]);
  const svAgg   = useMemo(() => aggRows(svRows), [svRows]);

  const kpiRows = useMemo(() => filterRows(data, kpiVehicle, kpiYear, kpiMonth, kpiType), [data, kpiVehicle, kpiYear, kpiMonth, kpiType]);
  const kpiAgg  = useMemo(() => aggRows(kpiRows), [kpiRows]);

  const cmpRows1 = useMemo(() => filterRows(data, cmpV1, cmpYear, cmpMonth), [data, cmpV1, cmpYear, cmpMonth]);
  const cmpRows2 = useMemo(() => filterRows(data, cmpV2, cmpYear, cmpMonth), [data, cmpV2, cmpYear, cmpMonth]);
  const cmpAgg1  = useMemo(() => aggRows(cmpRows1), [cmpRows1]);
  const cmpAgg2  = useMemo(() => aggRows(cmpRows2), [cmpRows2]);

  /* Monthly trend (based on both comparison vehicles combined) */
  const monthlyTrend = useMemo(() => {
    const cmpAll = [...cmpRows1, ...cmpRows2];
    const map = new Map<string, { label:string; fuelCost:number; maintCost:number; kmRun:number; litres:number }>();
    cmpAll.forEach(r => {
      const yr = r.year  ?? new Date(r.date).getFullYear();
      const mo = r.month ?? new Date(r.date).getMonth() + 1;
      const key = `${yr}-${String(mo).padStart(2,"0")}`;
      const ex = map.get(key) ?? { label:`${MONTH_NAMES[mo-1]} ${yr}`, fuelCost:0, maintCost:0, kmRun:0, litres:0 };
      ex.fuelCost  += r.fuel_cost;
      ex.maintCost += r.maint_cost;
      ex.kmRun     += r.km_run;
      ex.litres    += r.fuel_filled_l;
      map.set(key, ex);
    });
    return Array.from(map.values())
      .sort((a,b) => a.label.localeCompare(b.label))
      .map(m => ({ ...m, avgMileage: m.litres > 0 ? parseFloat((m.kmRun/m.litres).toFixed(2)) : 0 }));
  }, [cmpRows1, cmpRows2]);

  /* Period comparison */
  const paRows = useMemo(() => data.filter(r => r.date >= periodA.from && r.date <= periodA.to), [data, periodA]);
  const pbRows = useMemo(() => data.filter(r => r.date >= periodB.from && r.date <= periodB.to), [data, periodB]);
  const paAgg  = useMemo(() => aggRows(paRows), [paRows]);
  const pbAgg  = useMemo(() => aggRows(pbRows), [pbRows]);
  const delta  = (a: number, b: number) => b === 0 ? 0 : ((a - b) / b) * 100;

  /* Log table */
  const logRows  = useMemo(() => filterRows(data, logVehicle, logYear, logMonth).reverse(), [data, logVehicle, logYear, logMonth]);
  const logPages = Math.max(1, Math.ceil(logRows.length / LOG_PAGE_SIZE));
  const logSlice = logRows.slice((logPage - 1) * LOG_PAGE_SIZE, logPage * LOG_PAGE_SIZE);

  const vColor = (v: string) => VEHICLE_PALETTE[vehicles.indexOf(v) % VEHICLE_PALETTE.length];

  const today = new Date().toLocaleDateString("en-IN", { weekday:"short", day:"numeric", month:"short", year:"numeric" });

  /* ══════════════════════════════════════════════════════════════════════════════ */
  return (
    <div className={s.page}>
      <div className={s.content}>

        {/* ── Top info bar ─────────────────────────────────────────────────────── */}
        <div className={s.topBar}>
          <div className={s.topBarLeft}>
            <span className={s.topBarLabel}>Date &amp; Time</span>
            <span className={s.topBarClock}>{clock}</span>
            <span className={s.topBarDivider} />
            <span className={s.topBarLabel}>Data Through</span>
            <span className={s.topBarDate}>{maxDataDate || "—"}</span>
            <span className={s.topBarDivider} />
            <span className={s.topBarLabel}>Refreshed</span>
            <span className={s.topBarDate}>{lastRefreshed || "—"}</span>
          </div>
          <div className={s.topBarRight}>
            <button className={s.uploadBtn} onClick={() => setShowUpload(true)}>
              <Upload className="h-3.5 w-3.5" /> Upload Excel
            </button>
            <button className={s.addBtn} onClick={() => setEditRecord(null)}>
              <Plus className="h-3.5 w-3.5" /> Add Record
            </button>
            <button className={s.refreshBtn} onClick={loadData} disabled={loading}>
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>

        {/* ── Header ───────────────────────────────────────────────────────────── */}
        <div className={s.header}>
          <div>
            <div className={s.eyebrow}>Fleet Operations · Est. 1920</div>
            <h1 className={s.title}>MSP <span className={s.titleAccent}>Vehicles</span> Fleet Management</h1>
          </div>
          <div className={s.headerBadge}>2020 – 2025 · {vehicles.length || 14} Vehicles</div>
        </div>

        {loading && (
          <div style={{ textAlign:"center", padding:"80px 0", color:TEAL, opacity:0.5, letterSpacing:"0.3em", fontSize:11 }}>
            LOADING DATA…
          </div>
        )}

        {!loading && (
          <>
            {/* ════════════════════════════════════════════════════════════════════
                ◆ SINGLE VEHICLE SPOTLIGHT
            ════════════════════════════════════════════════════════════════════ */}
            <div className={s.sectionHeader}><span className={s.diamond}>◆</span> SINGLE VEHICLE SPOTLIGHT</div>

            <div className={s.spotlightControls}>
              <div className={s.ctrlGroup}>
                <span className={s.ctrlLabel}>Select Vehicle</span>
                <select className={s.ctrlSelect} value={svVehicle} onChange={e => setSvVehicle(e.target.value)}>
                  <option value="">— None —</option>
                  {vehicles.map(v => <option key={v} value={v}>{v}</option>)}
                </select>
              </div>
              <div className={s.ctrlGroup}>
                <span className={s.ctrlLabel}>Year</span>
                <select className={s.ctrlSelect} value={svYear} onChange={e => setSvYear(e.target.value)}>
                  <option value="ALL">All Years</option>
                  {years.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
              <div className={s.ctrlGroup}>
                <span className={s.ctrlLabel}>Month</span>
                <select className={s.ctrlSelect} value={svMonth} onChange={e => setSvMonth(e.target.value)}>
                  <option value="ALL">All Months</option>
                  {MONTH_NAMES.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
            </div>

            <div className={s.kpiGrid2Col} style={{ marginBottom:28 }}>
              {[
                { emoji:"⛽", label:"Total Fuel Filled",        value:fmt(svAgg.totalLitres,0),         unit:"L",    sub:`${svRows.length} fill-ups recorded`,                  accent:TEAL   },
                { emoji:"🛣️", label:"Total KM Running",         value:fmt(svAgg.totalKm,0),              unit:"km",  sub:`Odometer: ${fmt(svAgg.startKm,0)} → ${fmt(svAgg.closeKm,0)}`, accent:GOLD   },
                { emoji:"🌿", label:"Vehicle Mileage",           value:fmt(svAgg.avgMileage,2),          unit:"km/L", sub:"Average fuel efficiency",                             accent:GREEN  },
                { emoji:"💰", label:"Vehicle Fuel Cost",         value:fmtC(svAgg.fuelCost),             unit:"",    sub:"Total fuel expenditure (₹)",                          accent:RED    },
                { emoji:"🔧", label:"Fuel + Maintenance Cost",   value:fmtC(svAgg.totalCost),            unit:"",    sub:"Combined operational cost (₹)",                       accent:PURPLE },
                { emoji:"📊", label:"Running Cost / KM",         value:fmt(svAgg.costPerKm,2),           unit:"₹/km",sub:"Total vehicle cost per kilometre",                    accent:BLUE   },
                { emoji:"🚀", label:"Starting KM",               value:fmt(svAgg.startKm,0),             unit:"",    sub:"First odometer reading",                              accent:"#1abc9c"},
                { emoji:"🏁", label:"Closing KM",                value:fmt(svAgg.closeKm,0),             unit:"",    sub:"Final odometer reading",                              accent:"#e74c3c"},
              ].map(k => (
                <div key={k.label} className={s.kpiCard} style={{ ["--accent" as string]: k.accent }}>
                  <div className={s.kpiIconBox}>{k.emoji}</div>
                  <div className={s.kpiInfo}>
                    <div className={s.kpiLabel}>{k.label}</div>
                    <div className={s.kpiValue}>{k.value}{k.unit && <span className={s.kpiUnit}>{k.unit}</span>}</div>
                    <div className={s.kpiSub}>{k.sub}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* ════════════════════════════════════════════════════════════════════
                ◆ KEY PERFORMANCE INDICATORS
            ════════════════════════════════════════════════════════════════════ */}
            <div className={s.sectionHeader}>
              <span className={s.diamond}>◆</span> KEY PERFORMANCE INDICATORS
              <span className={s.sectionSub}>· {kpiVehicle === "ALL" ? "All Vehicles Combined" : kpiVehicle}</span>
            </div>

            <div className={s.filterBar}>
              <div className={s.ctrlGroup}>
                <span className={s.ctrlLabel}>Vehicle</span>
                <select className={s.ctrlSelect} value={kpiVehicle} onChange={e => setKpiVehicle(e.target.value)}>
                  <option value="ALL">All Vehicles</option>
                  {vehicles.map(v => <option key={v} value={v}>{v}</option>)}
                </select>
              </div>
              <div className={s.ctrlGroup}>
                <span className={s.ctrlLabel}>Year</span>
                <select className={s.ctrlSelect} value={kpiYear} onChange={e => setKpiYear(e.target.value)}>
                  <option value="ALL">All Years</option>
                  {years.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
              <div className={s.ctrlGroup}>
                <span className={s.ctrlLabel}>Month</span>
                <select className={s.ctrlSelect} value={kpiMonth} onChange={e => setKpiMonth(e.target.value)}>
                  <option value="ALL">All Months</option>
                  {MONTH_NAMES.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <div className={s.ctrlGroup}>
                <span className={s.ctrlLabel}>Vehicle Type</span>
                <select className={s.ctrlSelect} value={kpiType} onChange={e => setKpiType(e.target.value)}>
                  <option value="ALL">All Types</option>
                  <option value="Estate">Estate</option>
                  <option value="Personal">Personal</option>
                </select>
              </div>
              <button className={s.resetBtn} onClick={() => { setKpiVehicle("ALL"); setKpiYear("ALL"); setKpiMonth("ALL"); setKpiType("ALL"); }}>Reset</button>
            </div>

            <div className={s.kpiGrid2Col}>
              {[
                { emoji:"⛽", label:"Total Fuel Filled",       value:fmt(kpiAgg.totalLitres,0),   unit:"L",    sub:"Litres of fuel consumed",                    accent:TEAL   },
                { emoji:"🛣️", label:"Total KM Running",        value:fmt(kpiAgg.totalKm,0),        unit:"km",  sub:"Distance covered",                           accent:GOLD   },
                { emoji:"🌿", label:"Vehicle Mileage",          value:fmt(kpiAgg.avgMileage,2),    unit:"km/L", sub:"Average fuel efficiency",                    accent:GREEN  },
                { emoji:"💰", label:"Vehicle Fuel Cost",        value:fmtC(kpiAgg.fuelCost),       unit:"",    sub:"Total fuel expenditure (₹)",                 accent:RED    },
                { emoji:"🔧", label:"Fuel + Maintenance Cost",  value:fmtC(kpiAgg.totalCost),      unit:"",    sub:"Combined operational cost (₹)",              accent:PURPLE },
                { emoji:"📊", label:"Running Cost / KM",        value:fmt(kpiAgg.costPerKm,2),     unit:"₹/km",sub:"Total vehicle cost per kilometre",           accent:BLUE   },
              ].map(k => (
                <div key={k.label} className={s.kpiCard} style={{ ["--accent" as string]: k.accent }}>
                  <div className={s.kpiIconBox}>{k.emoji}</div>
                  <div className={s.kpiInfo}>
                    <div className={s.kpiLabel}>{k.label}</div>
                    <div className={s.kpiValue}>{k.value}{k.unit && <span className={s.kpiUnit}>{k.unit}</span>}</div>
                    <div className={s.kpiSub}>{k.sub}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* ════════════════════════════════════════════════════════════════════
                ◆ VEHICLE COMPARISON + CHARTS
            ════════════════════════════════════════════════════════════════════ */}
            <div className={s.sectionHeader}><span className={s.diamond}>◆</span> VEHICLE COMPARISON</div>

            <div className={s.filterBar}>
              <div className={s.ctrlGroup}>
                <span className={s.ctrlLabel}>Year</span>
                <select className={s.ctrlSelect} value={cmpYear} onChange={e => setCmpYear(e.target.value)}>
                  <option value="ALL">All Years</option>
                  {years.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
              <div className={s.ctrlGroup}>
                <span className={s.ctrlLabel}>Month</span>
                <select className={s.ctrlSelect} value={cmpMonth} onChange={e => setCmpMonth(e.target.value)}>
                  <option value="ALL">All Months</option>
                  {MONTH_NAMES.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <div className={s.ctrlGroup}>
                <span className={s.ctrlLabel}>Compare Vehicles (up to 2)</span>
                <div className={s.vehiclePills}>
                  <div className={s.vehiclePill}>
                    <div className={s.vDot} style={{ background: TEAL }} />
                    <select className={s.ctrlSelect} value={cmpV1} onChange={e => setCmpV1(e.target.value)}>
                      <option value="">— None —</option>
                      {vehicles.map(v => <option key={v} value={v}>{v}</option>)}
                    </select>
                  </div>
                  <div className={s.vehiclePill}>
                    <div className={s.vDot} style={{ background: GOLD }} />
                    <select className={s.ctrlSelect} value={cmpV2} onChange={e => setCmpV2(e.target.value)}>
                      <option value="">— None —</option>
                      {vehicles.map(v => <option key={v} value={v}>{v}</option>)}
                    </select>
                  </div>
                </div>
              </div>
            </div>

            {/* Comparison cards + charts side by side */}
            <div className={s.compChartsRow}>
              {/* Left: comparison cards */}
              <div className={s.comparisonGrid}>
                {[
                  { id: cmpV1, agg: cmpAgg1, color: TEAL },
                  { id: cmpV2, agg: cmpAgg2, color: GOLD },
                ].filter(v => v.id).map(v => (
                  <div key={v.id} className={s.compCard}>
                    <div className={s.compCardHeader} style={{ background: `${v.color}18`, borderBottom: `2px solid ${v.color}` }}>
                      <div className={s.vDot} style={{ background: v.color }} />
                      <span style={{ color: v.color }}>{v.id}</span>
                    </div>
                    <div className={s.compCardBody}>
                      {[
                        { k:"Fuel Filled",    val:fmt(v.agg.totalLitres,0) + " L" },
                        { k:"KM Run",         val:fmt(v.agg.totalKm,0) + " km" },
                        { k:"Avg Mileage",    val:fmt(v.agg.avgMileage,2) + " km/L" },
                        { k:"Fuel Cost",      val:fmtC(v.agg.fuelCost) },
                        { k:"Maint Cost",     val:fmtC(v.agg.maintCost) },
                        { k:"Total Cost",     val:fmtC(v.agg.totalCost) },
                        { k:"Cost / KM",      val:"₹" + fmt(v.agg.costPerKm,2) },
                      ].map(r => (
                        <div key={r.k} className={s.compRow}>
                          <span className={s.compKey}>{r.k}</span>
                          <span className={s.compVal}>{r.val}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {/* Right: 2×2 charts */}
              <div className={s.chartsQuad}>
                <div className={s.chartCard}>
                  <div className={s.chartTitle}>Monthly Fuel Cost</div>
                  <ResponsiveContainer width="100%" height={160}>
                    <AreaChart data={monthlyTrend} margin={{ top:4, right:8, left:0, bottom:0 }}>
                      <defs>
                        <linearGradient id="fg" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%"  stopColor={GOLD} stopOpacity={0.3}/>
                          <stop offset="95%" stopColor={GOLD} stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1b2a3d" vertical={false}/>
                      <XAxis dataKey="label" tick={{ fill:"#7a90b0", fontSize:9 }} axisLine={false} tickLine={false} interval="preserveStartEnd"/>
                      <YAxis tick={{ fill:"#7a90b0", fontSize:9 }} axisLine={false} tickLine={false} tickFormatter={v => fmtC(v as number)} width={52}/>
                      <Tooltip contentStyle={ttStyle} formatter={(v: unknown) => [fmtC(v as number), "Fuel Cost"]}/>
                      <Area type="monotone" dataKey="fuelCost" stroke={GOLD} fill="url(#fg)" strokeWidth={2} dot={false}/>
                    </AreaChart>
                  </ResponsiveContainer>
                </div>

                <div className={s.chartCard}>
                  <div className={s.chartTitle}>Monthly KM Run</div>
                  <ResponsiveContainer width="100%" height={160}>
                    <BarChart data={monthlyTrend} margin={{ top:4, right:8, left:0, bottom:0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1b2a3d" vertical={false}/>
                      <XAxis dataKey="label" tick={{ fill:"#7a90b0", fontSize:9 }} axisLine={false} tickLine={false} interval="preserveStartEnd"/>
                      <YAxis tick={{ fill:"#7a90b0", fontSize:9 }} axisLine={false} tickLine={false} tickFormatter={v => fmt(v as number)} width={44}/>
                      <Tooltip contentStyle={ttStyle} formatter={(v: unknown) => [fmt(v as number) + " km", "KM Run"]}/>
                      <Bar dataKey="kmRun" fill={TEAL} fillOpacity={0.85} radius={[3,3,0,0]}/>
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                <div className={s.chartCard}>
                  <div className={s.chartTitle}>Avg Mileage (km/L)</div>
                  <ResponsiveContainer width="100%" height={160}>
                    <LineChart data={monthlyTrend} margin={{ top:4, right:8, left:0, bottom:0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1b2a3d" vertical={false}/>
                      <XAxis dataKey="label" tick={{ fill:"#7a90b0", fontSize:9 }} axisLine={false} tickLine={false} interval="preserveStartEnd"/>
                      <YAxis tick={{ fill:"#7a90b0", fontSize:9 }} axisLine={false} tickLine={false} tickFormatter={v => (v as number).toFixed(1)} width={36}/>
                      <Tooltip contentStyle={ttStyle} formatter={(v: unknown) => [(v as number).toFixed(2) + " km/L", "Mileage"]}/>
                      <Line type="monotone" dataKey="avgMileage" stroke={GREEN} strokeWidth={2} dot={{ r:3, fill:GREEN }}/>
                    </LineChart>
                  </ResponsiveContainer>
                </div>

                <div className={s.chartCard}>
                  <div className={s.chartTitle}>Fuel vs Maintenance</div>
                  <ResponsiveContainer width="100%" height={160}>
                    <BarChart data={monthlyTrend} margin={{ top:4, right:8, left:0, bottom:0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1b2a3d" vertical={false}/>
                      <XAxis dataKey="label" tick={{ fill:"#7a90b0", fontSize:9 }} axisLine={false} tickLine={false} interval="preserveStartEnd"/>
                      <YAxis tick={{ fill:"#7a90b0", fontSize:9 }} axisLine={false} tickLine={false} tickFormatter={v => fmtC(v as number)} width={52}/>
                      <Tooltip contentStyle={ttStyle} formatter={(v: unknown, n: unknown) => [fmtC(v as number), n === "fuelCost" ? "Fuel" : "Maintenance"]}/>
                      <Legend wrapperStyle={{ fontSize:10, color:"#7a90b0" }}/>
                      <Bar dataKey="fuelCost"  name="fuelCost"  stackId="a" fill={GOLD} fillOpacity={0.85}/>
                      <Bar dataKey="maintCost" name="maintCost" stackId="a" fill={RED}  fillOpacity={0.85} radius={[3,3,0,0]}/>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* ════════════════════════════════════════════════════════════════════
                ◆ PERIOD COMPARISON
            ════════════════════════════════════════════════════════════════════ */}
            <div className={s.sectionHeader}><span className={s.diamond}>◆</span> PERIOD COMPARISON</div>

            <div className={s.periodControls}>
              <div className={s.ctrlGroup}>
                <span className={s.ctrlLabel}>Period A — From</span>
                <input type="date" className={s.dateInput} value={periodA.from} onChange={e => setPeriodA(p => ({ ...p, from:e.target.value }))}/>
              </div>
              <div className={s.ctrlGroup}>
                <span className={s.ctrlLabel}>To</span>
                <input type="date" className={s.dateInput} value={periodA.to} onChange={e => setPeriodA(p => ({ ...p, to:e.target.value }))}/>
              </div>
              <div className={s.periodDivider}>vs</div>
              <div className={s.ctrlGroup}>
                <span className={s.ctrlLabel}>Period B — From</span>
                <input type="date" className={s.dateInput} value={periodB.from} onChange={e => setPeriodB(p => ({ ...p, from:e.target.value }))}/>
              </div>
              <div className={s.ctrlGroup}>
                <span className={s.ctrlLabel}>To</span>
                <input type="date" className={s.dateInput} value={periodB.to} onChange={e => setPeriodB(p => ({ ...p, to:e.target.value }))}/>
              </div>
            </div>

            {/* Period A vs B table */}
            <div className={s.periodLayout}>
              <table className={s.periodTable}>
                <thead>
                  <tr>
                    <th className={s.colMetric}>Metric</th>
                    <th className={s.colA}>Period A · {periodA.from} → {periodA.to}</th>
                    <th className={s.colB}>Period B · {periodB.from} → {periodB.to}</th>
                    <th className={s.colDiff}>Difference</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { label:"Fuel Filled",        a:fmt(paAgg.totalLitres,0)+"L",  b:fmt(pbAgg.totalLitres,0)+"L",  d:delta(paAgg.totalLitres, pbAgg.totalLitres),  isUp: (x:number) => x > 0 },
                    { label:"KM Run",             a:fmt(paAgg.totalKm,0)+" km",    b:fmt(pbAgg.totalKm,0)+" km",    d:delta(paAgg.totalKm, pbAgg.totalKm),           isUp: (x:number) => x > 0 },
                    { label:"Avg Mileage",        a:fmt(paAgg.avgMileage,2)+" km/L",b:fmt(pbAgg.avgMileage,2)+" km/L",d:delta(paAgg.avgMileage, pbAgg.avgMileage),  isUp: (x:number) => x > 0 },
                    { label:"Fuel Cost",          a:fmtC(paAgg.fuelCost),          b:fmtC(pbAgg.fuelCost),          d:delta(paAgg.fuelCost, pbAgg.fuelCost),         isUp: (x:number) => x < 0 },
                    { label:"Maintenance Cost",   a:fmtC(paAgg.maintCost),         b:fmtC(pbAgg.maintCost),         d:delta(paAgg.maintCost, pbAgg.maintCost),        isUp: (x:number) => x < 0 },
                    { label:"Total Cost",         a:fmtC(paAgg.totalCost),         b:fmtC(pbAgg.totalCost),         d:delta(paAgg.totalCost, pbAgg.totalCost),        isUp: (x:number) => x < 0 },
                    { label:"Cost / KM",          a:"₹"+fmt(paAgg.costPerKm,2),    b:"₹"+fmt(pbAgg.costPerKm,2),    d:delta(paAgg.costPerKm, pbAgg.costPerKm),        isUp: (x:number) => x < 0 },
                  ].map(row => {
                    const good = row.isUp(row.d);
                    const cls  = row.d === 0 ? s.diffNeutral : good ? s.diffDown : s.diffUp;
                    return (
                      <tr key={row.label}>
                        <td className={s.colMetric}>{row.label}</td>
                        <td className={s.colVal} style={{ color:TEAL }}>{row.a}</td>
                        <td className={s.colVal} style={{ color:GOLD }}>{row.b}</td>
                        <td className={s.colDiff}>
                          <span className={`${s.diffBadge} ${cls}`}>
                            {row.d > 0 ? "▲" : row.d < 0 ? "▼" : "—"} {Math.abs(row.d).toFixed(1)}%
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* ════════════════════════════════════════════════════════════════════
                ◆ DAILY LOG
            ════════════════════════════════════════════════════════════════════ */}
            <div className={s.sectionHeader}><span className={s.diamond}>◆</span> DAILY LOG</div>

            <div className={s.filterBar} style={{ marginBottom:14 }}>
              <div className={s.ctrlGroup}>
                <span className={s.ctrlLabel}>Vehicle</span>
                <select className={s.ctrlSelect} value={logVehicle} onChange={e => { setLogVehicle(e.target.value); setLogPage(1); }}>
                  <option value="ALL">All Vehicles</option>
                  {vehicles.map(v => <option key={v} value={v}>{v}</option>)}
                </select>
              </div>
              <div className={s.ctrlGroup}>
                <span className={s.ctrlLabel}>Year</span>
                <select className={s.ctrlSelect} value={logYear} onChange={e => { setLogYear(e.target.value); setLogPage(1); }}>
                  <option value="ALL">All Years</option>
                  {years.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
              <div className={s.ctrlGroup}>
                <span className={s.ctrlLabel}>Month</span>
                <select className={s.ctrlSelect} value={logMonth} onChange={e => { setLogMonth(e.target.value); setLogPage(1); }}>
                  <option value="ALL">All Months</option>
                  {MONTH_NAMES.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <button className={s.resetBtn} onClick={() => { setLogVehicle("ALL"); setLogYear("ALL"); setLogMonth("ALL"); setLogPage(1); }}>Reset</button>
            </div>

            <div style={{ fontSize:11, color:"#7a90b0", marginBottom:10 }}>{logRows.length.toLocaleString()} records · newest first</div>

            <div className={s.dailyTableWrapper}>
              <table className={s.dailyTable}>
                <thead>
                  <tr>
                    <th>Date</th><th>Vehicle</th><th>Type</th><th>Account</th><th>Fuel</th>
                    <th style={{ textAlign:"right" }}>Start KM</th>
                    <th style={{ textAlign:"right" }}>Close KM</th>
                    <th style={{ textAlign:"right" }}>KM Run</th>
                    <th style={{ textAlign:"right" }}>Litres</th>
                    <th style={{ textAlign:"right" }}>Fuel ₹</th>
                    <th style={{ textAlign:"right" }}>Maint ₹</th>
                    <th style={{ textAlign:"right" }}>Total ₹</th>
                    <th style={{ textAlign:"right" }}>km/L</th>
                    <th style={{ textAlign:"right" }}>₹/km</th>
                    <th>Maintenance</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {logSlice.map(r => (
                    <tr key={r.id}>
                      <td className={s.colDate}>{r.date}</td>
                      <td className={s.colVehicle} style={{ color: vColor(r.vehicle_id) }}>{r.vehicle_id}</td>
                      <td><span className={`${s.tag} ${r.vehicle_type === "Personal" ? s.tagPersonal : s.tagEstate}`}>{r.vehicle_type}</span></td>
                      <td className={s.colAccount}>{r.account}</td>
                      <td><span className={`${s.tag} ${r.fuel_type === "Petrol" ? s.tagPetrol : s.tagDiesel}`}>{r.fuel_type}</span></td>
                      <td className={s.colNumber}>{fmt(r.starting_km,0)}</td>
                      <td className={s.colNumber}>{fmt(r.closing_km,0)}</td>
                      <td className={s.colNumber} style={{ color:TEAL }}>{fmt(r.km_run,0)}</td>
                      <td className={s.colNumber}>{fmt(r.fuel_filled_l,1)}</td>
                      <td className={s.colNumber} style={{ color:GOLD }}>{fmt(r.fuel_cost,0)}</td>
                      <td className={s.colNumber} style={{ color:RED }}>{fmt(r.maint_cost,0)}</td>
                      <td className={s.colNumber} style={{ color:GOLD, fontWeight:700 }}>{fmt(r.total_cost,0)}</td>
                      <td className={s.colNumber} style={{ color:GREEN }}>{fmt(r.avg_mileage,2)}</td>
                      <td className={s.colNumber} style={{ color:PURPLE }}>{fmt(r.cost_per_km,2)}</td>
                      <td style={{ color:"#7a90b0", maxWidth:130, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }} title={r.maintenance_performed}>{r.maintenance_performed || "—"}</td>
                      <td>
                        <button onClick={() => setEditRecord(r)} style={{ background:"none", border:"none", color:"#3a5070", cursor:"pointer", padding:"2px 4px" }}>
                          <Pencil size={13}/>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                {/* Summary row */}
                <tfoot>
                  <tr className={s.summaryRow}>
                    <td colSpan={7} style={{ color:TEAL, fontWeight:700 }}>TOTAL ({logRows.length} records)</td>
                    <td className={s.colNumber} style={{ color:TEAL }}>{fmt(logRows.reduce((a,r)=>a+r.km_run,0),0)}</td>
                    <td className={s.colNumber} style={{ color:TEAL }}>{fmt(logRows.reduce((a,r)=>a+r.fuel_filled_l,0),1)}</td>
                    <td className={s.colNumber} style={{ color:GOLD }}>{fmt(logRows.reduce((a,r)=>a+r.fuel_cost,0),0)}</td>
                    <td className={s.colNumber} style={{ color:RED  }}>{fmt(logRows.reduce((a,r)=>a+r.maint_cost,0),0)}</td>
                    <td className={s.colNumber} style={{ color:GOLD, fontWeight:700 }}>{fmt(logRows.reduce((a,r)=>a+r.total_cost,0),0)}</td>
                    <td colSpan={4}/>
                  </tr>
                </tfoot>
              </table>
            </div>

            {logPages > 1 && (
              <div className={s.paginationRow}>
                <button onClick={() => setLogPage(p => Math.max(1,p-1))} disabled={logPage===1} className={s.pageBtn}><ChevronLeft size={14}/></button>
                <span style={{ fontSize:11, color:"#7a90b0" }}>Page {logPage} of {logPages}</span>
                <button onClick={() => setLogPage(p => Math.min(logPages,p+1))} disabled={logPage===logPages} className={s.pageBtn}><ChevronRight size={14}/></button>
              </div>
            )}
          </>
        )}
      </div>

      {showUpload && <UploadModal onClose={() => setShowUpload(false)} onSuccess={loadData}/>}
      {editRecord !== false && <RecordModal record={editRecord} vehicles={vehicles} onClose={() => setEditRecord(false)} onSuccess={loadData}/>}
    </div>
  );
}
