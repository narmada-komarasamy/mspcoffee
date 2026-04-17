"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  const [periodVehicle, setPeriodVehicle] = useState("ALL");
  const [periodAYear,   setPeriodAYear]   = useState(String(thisYear));
  const [periodAMonth,  setPeriodAMonth]  = useState("ALL");
  const [periodBYear,   setPeriodBYear]   = useState(String(thisYear - 1));
  const [periodBMonth,  setPeriodBMonth]  = useState("ALL");

  /* ── Log table ───────────────────────────────────────────────────────────────── */
  const [logPage,     setLogPage]     = useState(1);
  const [logVehicle,  setLogVehicle]  = useState("ALL");
  const [logYear,     setLogYear]     = useState("ALL");
  const [logMonth,    setLogMonth]    = useState("ALL");
  const [logDateFrom, setLogDateFrom] = useState("");
  const [logDateTo,   setLogDateTo]   = useState("");

  /* ── Trip calculator ─────────────────────────────────────────────────────────── */
  const [tripFrom,    setTripFrom]    = useState("moganad");
  const [tripTo,      setTripTo]      = useState("bangalore");
  const [tripVehicle, setTripVehicle] = useState("");
  const [fuelPrice,   setFuelPrice]   = useState(93);

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
    if (all.length > 0) setMaxDataDate(all[all.length - 1].date);
    setLastRefreshed(new Date().toLocaleTimeString("en-IN", { hour:"2-digit", minute:"2-digit", hour12:true }));
    setLoading(false);
  }, []);

  /* Initial vehicle selection — runs once after first data load */
  const initialised = useRef(false);
  useEffect(() => {
    if (!initialised.current && data.length > 0) {
      const vs = Array.from(new Set(data.map(r => r.vehicle_id))).sort();
      if (vs[0]) { setCmpV1(vs[0]); setSvVehicle(vs[0]); }
      if (vs[1]) setCmpV2(vs[1]);
      initialised.current = true;
    }
  }, [data]);

  /* Initial load */
  useEffect(() => { loadData(); }, [loadData]);

  /* Real-time subscription — auto-refresh on any INSERT / UPDATE / DELETE */
  useEffect(() => {
    const channel = supabase
      .channel("fleet_daily_changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "fleet_daily" }, () => {
        loadData();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [loadData]);

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
  const paRows = useMemo(() => data.filter(r => {
    const ry = String(r.year ?? new Date(r.date).getFullYear());
    const rm = r.month ?? new Date(r.date).getMonth() + 1;
    if (periodVehicle !== "ALL" && r.vehicle_id !== periodVehicle) return false;
    if (ry !== periodAYear) return false;
    if (periodAMonth !== "ALL" && MONTH_NAMES[rm - 1] !== periodAMonth) return false;
    return true;
  }), [data, periodVehicle, periodAYear, periodAMonth]);
  const pbRows = useMemo(() => data.filter(r => {
    const ry = String(r.year ?? new Date(r.date).getFullYear());
    const rm = r.month ?? new Date(r.date).getMonth() + 1;
    if (periodVehicle !== "ALL" && r.vehicle_id !== periodVehicle) return false;
    if (ry !== periodBYear) return false;
    if (periodBMonth !== "ALL" && MONTH_NAMES[rm - 1] !== periodBMonth) return false;
    return true;
  }), [data, periodVehicle, periodBYear, periodBMonth]);
  const paAgg  = useMemo(() => aggRows(paRows), [paRows]);
  const pbAgg  = useMemo(() => aggRows(pbRows), [pbRows]);
  const delta  = (a: number, b: number) => b === 0 ? 0 : ((a - b) / b) * 100;

  /* Log table */
  const logRows = useMemo(() => {
    return filterRows(data, logVehicle, logYear, logMonth)
      .filter(r => (!logDateFrom || r.date >= logDateFrom) && (!logDateTo || r.date <= logDateTo))
      .reverse();
  }, [data, logVehicle, logYear, logMonth, logDateFrom, logDateTo]);
  const logPages = Math.max(1, Math.ceil(logRows.length / LOG_PAGE_SIZE));
  const logSlice = logRows.slice((logPage - 1) * LOG_PAGE_SIZE, logPage * LOG_PAGE_SIZE);

  /* Vehicle Registry — one row per vehicle, all-time totals */
  const registry = useMemo(() => {
    const map = new Map<string, { vehicle_id:string; fuel_type:string; account:string; vehicle_type:string; totalKm:number; totalLitres:number; totalCost:number }>();
    data.forEach(r => {
      const ex = map.get(r.vehicle_id);
      if (ex) {
        ex.totalKm     += r.km_run;
        ex.totalLitres += r.fuel_filled_l;
        ex.totalCost   += r.total_cost;
        if (r.fuel_type)    ex.fuel_type    = r.fuel_type;
        if (r.account)      ex.account      = r.account;
        if (r.vehicle_type) ex.vehicle_type = r.vehicle_type;
      } else {
        map.set(r.vehicle_id, { vehicle_id:r.vehicle_id, fuel_type:r.fuel_type, account:r.account, vehicle_type:r.vehicle_type, totalKm:r.km_run, totalLitres:r.fuel_filled_l, totalCost:r.total_cost });
      }
    });
    return Array.from(map.values()).sort((a,b) => a.vehicle_id.localeCompare(b.vehicle_id));
  }, [data]);

  /* Trip cost calculator */
  const TRIP_DIST: Record<string, Record<string, number>> = {
    moganad:     { bangalore:340, pattiveranpatti:45,  greenways_s:55,  chennai:390, eng_club_cbe:165 },
    stanmore:    { bangalore:310, pattiveranpatti:30,  greenways_s:25,  chennai:360, eng_club_cbe:160 },
    greenways_s: { bangalore:320, pattiveranpatti:40,  greenways_s:0,   chennai:350, moganad:55, stanmore:25, eng_club_cbe:155 },
    eng_club_cbe:{ bangalore:365, pattiveranpatti:195, greenways_s:155, chennai:505, moganad:165, stanmore:160, eng_club_cbe:0 },
  };
  const LOC_LABELS: Record<string, string> = {
    moganad:'Moganad Estate, Managalam', stanmore:'Stanmore Estate, Nagalur',
    greenways_s:'7/95 Greenways Rd, Salem', eng_club_cbe:'English Club Race Course, CBE',
    bangalore:'MG Road, Bangalore', pattiveranpatti:'Pattiveranpatti', chennai:'Adyar, Chennai',
  };
  const START_KEYS = ['moganad','stanmore','greenways_s','eng_club_cbe'];
  const END_KEYS   = ['bangalore','pattiveranpatti','greenways_s','chennai','eng_club_cbe'];

  const tripCalc = useMemo(() => {
    const dist = TRIP_DIST[tripFrom]?.[tripTo] ?? null;
    const vRows = tripVehicle ? data.filter(r => r.vehicle_id === tripVehicle) : [];
    const latestYear = vRows.length > 0 ? Math.max(...vRows.map(r => r.year ?? new Date(r.date).getFullYear())) : null;
    const latestRows = latestYear ? vRows.filter(r => (r.year ?? new Date(r.date).getFullYear()) === latestYear) : [];
    const km = latestRows.reduce((a,r) => a+r.km_run,0);
    const lt = latestRows.reduce((a,r) => a+r.fuel_filled_l,0);
    const tc = latestRows.reduce((a,r) => a+r.total_cost,0);
    const mileage  = lt > 0 ? km / lt : null;
    const cpk      = km > 0 ? tc / km : null;
    if (!dist || dist === 0) return { dist, mileage, cpk, fuelNeeded:null, cost1:null, cost2:null, totalCost:null, latestYear };
    const fuelNeeded = mileage ? dist / mileage : null;
    const cost1      = fuelNeeded ? fuelNeeded * fuelPrice : null;
    const cost2      = cost1 ? cost1 * 2 : null;
    const totalCost  = (cost2 && cpk) ? cost2 + cpk * dist * 2 : cost2;
    return { dist, mileage, cpk, fuelNeeded, cost1, cost2, totalCost, latestYear };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, tripFrom, tripTo, tripVehicle, fuelPrice]);

  const vColor = (v: string) => VEHICLE_PALETTE[vehicles.indexOf(v) % VEHICLE_PALETTE.length];

  const downloadCSV = useCallback(() => {
    const headers = ["Date","Vehicle ID","Account","Starting KM","Closing KM","KM Run","Fuel Filled (L)","Fuel Cost (₹)","Maint Cost (₹)","Total Cost (₹)","Maintenance Performed","Remarks"];
    const csvRows = logRows.map(r => [
      r.date, r.vehicle_id, r.account,
      r.starting_km, r.closing_km, r.km_run,
      r.fuel_filled_l, r.fuel_cost, r.maint_cost, r.total_cost,
      r.maintenance_performed, r.remarks,
    ]);
    const csv = [headers, ...csvRows]
      .map(row => row.map(v => `"${String(v ?? "").replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href = url; a.download = "fleet_log.csv"; a.click();
    URL.revokeObjectURL(url);
  }, [logRows]);

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
            <div className={s.sectionHeader}><span className={s.diamond}>◆</span> PERIOD-ON-PERIOD COMPARISON</div>

            <div className={s.filterBar}>
              <div className={s.ctrlGroup}>
                <span className={s.ctrlLabel}>Vehicle</span>
                <select className={s.ctrlSelect} value={periodVehicle} onChange={e => setPeriodVehicle(e.target.value)}>
                  <option value="ALL">All Vehicles</option>
                  {vehicles.map(v => <option key={v} value={v}>{v}</option>)}
                </select>
              </div>
              <div className={s.ctrlGroup}>
                <span className={s.ctrlLabel}>Period A — Year</span>
                <select className={s.ctrlSelect} value={periodAYear} onChange={e => setPeriodAYear(e.target.value)}>
                  {years.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
              <div className={s.ctrlGroup}>
                <span className={s.ctrlLabel}>Period A — Month</span>
                <select className={s.ctrlSelect} value={periodAMonth} onChange={e => setPeriodAMonth(e.target.value)}>
                  <option value="ALL">All Months</option>
                  {MONTH_NAMES.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <div className={s.ctrlGroup}>
                <span className={s.ctrlLabel}>Period B — Year</span>
                <select className={s.ctrlSelect} value={periodBYear} onChange={e => setPeriodBYear(e.target.value)}>
                  {years.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
              <div className={s.ctrlGroup}>
                <span className={s.ctrlLabel}>Period B — Month</span>
                <select className={s.ctrlSelect} value={periodBMonth} onChange={e => setPeriodBMonth(e.target.value)}>
                  <option value="ALL">All Months</option>
                  {MONTH_NAMES.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
            </div>

            {/* Period table + Net Result card */}
            <div className={s.periodOuterLayout}>
              <div className={s.periodLayout}>
                <table className={s.periodTable}>
                  <thead>
                    <tr>
                      <th className={s.colMetric}>Metric</th>
                      <th className={s.colA}>Period A — {periodAYear}{periodAMonth !== "ALL" ? ` · ${periodAMonth.toUpperCase()}` : ""}</th>
                      <th className={s.colB}>Period B — {periodBYear}{periodBMonth !== "ALL" ? ` · ${periodBMonth.toUpperCase()}` : ""}</th>
                      <th className={s.colDiff}>Difference (A vs B)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { label:"Fuel Filled",  a:fmt(paAgg.totalLitres,1)+" L",    b:fmt(pbAgg.totalLitres,1)+" L",    pct:delta(paAgg.totalLitres,pbAgg.totalLitres),  abs:fmt(Math.abs(paAgg.totalLitres-pbAgg.totalLitres),1)+" L",    goodUp:true  },
                      { label:"KM Run",       a:fmt(paAgg.totalKm,0)+" km",        b:fmt(pbAgg.totalKm,0)+" km",        pct:delta(paAgg.totalKm,pbAgg.totalKm),          abs:fmt(Math.abs(paAgg.totalKm-pbAgg.totalKm),0)+" km",           goodUp:true  },
                      { label:"Avg Mileage",  a:fmt(paAgg.avgMileage,2)+" km/L",  b:fmt(pbAgg.avgMileage,2)+" km/L",  pct:delta(paAgg.avgMileage,pbAgg.avgMileage),    abs:fmt(Math.abs(paAgg.avgMileage-pbAgg.avgMileage),2)+" km/L",   goodUp:true  },
                      { label:"Fuel Cost",    a:fmtC(paAgg.fuelCost),              b:fmtC(pbAgg.fuelCost),              pct:delta(paAgg.fuelCost,pbAgg.fuelCost),         abs:"₹"+fmt(Math.abs(paAgg.fuelCost-pbAgg.fuelCost),0),           goodUp:false },
                      { label:"Fuel + Maint", a:fmtC(paAgg.totalCost),             b:fmtC(pbAgg.totalCost),             pct:delta(paAgg.totalCost,pbAgg.totalCost),        abs:"₹"+fmt(Math.abs(paAgg.totalCost-pbAgg.totalCost),0),          goodUp:false },
                      { label:"Cost / KM",    a:"₹"+fmt(paAgg.costPerKm,2)+"/km", b:"₹"+fmt(pbAgg.costPerKm,2)+"/km", pct:delta(paAgg.costPerKm,pbAgg.costPerKm),       abs:"₹"+fmt(Math.abs(paAgg.costPerKm-pbAgg.costPerKm),2)+"/km",   goodUp:false },
                    ].map(row => {
                      const isUp = row.pct > 0;
                      const good = isUp === row.goodUp;
                      const cls  = row.pct === 0 ? s.diffNeutral : good ? s.diffDown : s.diffUp;
                      return (
                        <tr key={row.label}>
                          <td className={s.colMetric}>{row.label}</td>
                          <td className={s.colVal} style={{ color:TEAL }}>{row.a}</td>
                          <td className={s.colVal} style={{ color:GOLD }}>{row.b}</td>
                          <td className={s.colDiff}>
                            <span className={`${s.diffBadge} ${cls}`}>
                              {row.pct > 0 ? "▲" : row.pct < 0 ? "▼" : "—"} {Math.abs(row.pct).toFixed(1)}% ({row.abs})
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Net Result card */}
              {(() => {
                const costDiff  = paAgg.totalCost - pbAgg.totalCost;
                const spentMore = costDiff > 0;
                const kmDiff    = paAgg.totalKm - pbAgg.totalKm;
                const litDiff   = paAgg.totalLitres - pbAgg.totalLitres;
                const cpkDiff   = paAgg.costPerKm - pbAgg.costPerKm;
                const cardBorder = spentMore ? RED : GREEN;
                return (
                  <div className={s.netResultCard} style={{ borderColor: cardBorder }}>
                    <div className={s.netResultTitle} style={{ color: spentMore ? GOLD : GREEN }}>
                      <span>{spentMore ? "⚠" : "✓"}</span>
                      <span>{spentMore ? "SPENT MORE" : "SAVED"}</span>
                    </div>
                    <div className={s.netResultAmount} style={{ color: spentMore ? RED : GREEN }}>
                      {costDiff > 0 ? "+" : "−"}₹{fmt(Math.abs(costDiff),0)}
                    </div>
                    <div className={s.netResultPct}>{Math.abs(delta(paAgg.totalCost,pbAgg.totalCost)).toFixed(1)}% vs Period B</div>
                    <div className={s.netResultDivider}/>
                    <div className={s.netResultRow}>
                      <span className={s.netResultKey}>KM RUN</span>
                      <span className={s.netResultVal} style={{ color:TEAL }}>{kmDiff >= 0 ? "+" : ""}{fmt(kmDiff,0)} km</span>
                    </div>
                    <div className={s.netResultRow}>
                      <span className={s.netResultKey}>FUEL USED</span>
                      <span className={s.netResultVal} style={{ color:TEAL }}>{litDiff >= 0 ? "+" : ""}{fmt(litDiff,1)} L</span>
                    </div>
                    <div className={s.netResultRow}>
                      <span className={s.netResultKey}>COST/KM</span>
                      <span className={s.netResultVal} style={{ color:TEAL }}>{cpkDiff >= 0 ? "+" : "−"}₹{fmt(Math.abs(cpkDiff),2)}</span>
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* ════════════════════════════════════════════════════════════════════
                ◆ VEHICLE REGISTRY
            ════════════════════════════════════════════════════════════════════ */}
            <div className={s.sectionHeader}><span className={s.diamond}>◆</span> VEHICLE REGISTRY</div>

            <div className={s.registryWrapper}>
              <table className={s.dailyTable}>
                <thead>
                  <tr>
                    <th>Vehicle ID</th>
                    <th>Fuel Type</th>
                    <th>Account</th>
                    <th>Vehicle Type</th>
                    <th style={{ textAlign:"right" }}>Total KM</th>
                    <th style={{ textAlign:"right" }}>Avg Mileage</th>
                    <th style={{ textAlign:"right" }}>Cost / KM</th>
                  </tr>
                </thead>
                <tbody>
                  {registry.map(v => {
                    const avgMileage = v.totalLitres > 0 ? v.totalKm / v.totalLitres : 0;
                    const costPerKm  = v.totalKm > 0 ? v.totalCost / v.totalKm : 0;
                    return (
                      <tr key={v.vehicle_id}>
                        <td className={s.colVehicle} style={{ color: vColor(v.vehicle_id) }}>{v.vehicle_id}</td>
                        <td><span className={`${s.tag} ${v.fuel_type === "Petrol" ? s.tagPetrol : s.tagDiesel}`}>{v.fuel_type}</span></td>
                        <td className={s.colAccount}>{v.account}</td>
                        <td><span className={`${s.tag} ${v.vehicle_type === "Personal" ? s.tagPersonal : s.tagEstate}`}>{v.vehicle_type}</span></td>
                        <td className={s.colNumber} style={{ color:TEAL }}>{fmt(v.totalKm,0)} km</td>
                        <td className={s.colNumber} style={{ color:GREEN }}>{fmt(avgMileage,2)} km/L</td>
                        <td className={s.colNumber} style={{ color:GOLD }}>₹{fmt(costPerKm,2)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* ════════════════════════════════════════════════════════════════════
                ◆ TRIP COST CALCULATOR
            ════════════════════════════════════════════════════════════════════ */}
            <div className={s.sectionHeader}><span className={s.diamond}>◆</span> TRIP COST CALCULATOR</div>

            <div className={s.filterBar} style={{ marginBottom:16 }}>
              <div className={s.ctrlGroup}>
                <span className={s.ctrlLabel}>From</span>
                <select className={s.ctrlSelect} value={tripFrom} onChange={e => setTripFrom(e.target.value)}>
                  {START_KEYS.map(k => <option key={k} value={k}>{LOC_LABELS[k]}</option>)}
                </select>
              </div>
              <div className={s.ctrlGroup}>
                <span className={s.ctrlLabel}>To</span>
                <select className={s.ctrlSelect} value={tripTo} onChange={e => setTripTo(e.target.value)}>
                  {END_KEYS.map(k => <option key={k} value={k}>{LOC_LABELS[k]}</option>)}
                </select>
              </div>
              <div className={s.ctrlGroup}>
                <span className={s.ctrlLabel}>Vehicle (for mileage)</span>
                <select className={s.ctrlSelect} value={tripVehicle} onChange={e => setTripVehicle(e.target.value)}>
                  <option value="">— Select Vehicle —</option>
                  {vehicles.map(v => <option key={v} value={v}>{v}</option>)}
                </select>
              </div>
              <div className={s.ctrlGroup}>
                <span className={s.ctrlLabel}>Fuel Price (₹/L)</span>
                <input type="number" className={s.dateInput} value={fuelPrice} min={50} max={200}
                  onChange={e => setFuelPrice(parseFloat(e.target.value) || 93)}
                  style={{ width:100 }}/>
              </div>
            </div>

            <div className={s.tripResultGrid}>
              {[
                { label:"DISTANCE",         value: tripCalc.dist ? `${tripCalc.dist} km` : "N/A",                            sub:"km (one way)",                                                                   accent:TEAL   },
                { label:"FUEL NEEDED",      value: tripCalc.fuelNeeded ? `${tripCalc.fuelNeeded.toFixed(1)} L` : "N/A",      sub:"litres (one way)",                                                               accent:GOLD   },
                { label:"ONE WAY COST",     value: tripCalc.cost1 ? `₹${fmt(tripCalc.cost1,0)}` : "N/A",                     sub:"₹ fuel cost",                                                                    accent:GREEN  },
                { label:"RETURN COST",      value: tripCalc.cost2 ? `₹${fmt(tripCalc.cost2,0)}` : "N/A",                     sub:"₹ fuel cost",                                                                    accent:RED    },
                { label:"TOTAL TRIP COST",  value: tripCalc.totalCost ? `₹${fmt(tripCalc.totalCost,0)}` : "N/A",             sub:"₹ fuel + ₹/km run",                                                             accent:PURPLE },
                { label:"VEHICLE MILEAGE",  value: tripCalc.mileage ? `${tripCalc.mileage.toFixed(1)} km/L` : "N/A",        sub: tripCalc.latestYear ? `km/L (${tripCalc.latestYear} avg)` : "km/L avg",         accent:BLUE   },
              ].map(c => (
                <div key={c.label} className={s.tripCard} style={{ ["--accent" as string]: c.accent }}>
                  <div className={s.tripLabel}>{c.label}</div>
                  <div className={s.tripValue}>{c.value}</div>
                  <div className={s.tripSub}>{c.sub}</div>
                </div>
              ))}
            </div>

            {/* Distance matrix */}
            <div className={s.dailyTableWrapper} style={{ marginBottom:24 }}>
              <table className={s.dailyTable}>
                <thead>
                  <tr>
                    <th>From \ To</th>
                    {END_KEYS.map(k => <th key={k} style={{ textAlign:"right" }}>{LOC_LABELS[k]}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {START_KEYS.map(from => (
                    <tr key={from}>
                      <td className={s.colVehicle} style={{ color:TEAL }}>{LOC_LABELS[from]}</td>
                      {END_KEYS.map(to => {
                        const d = TRIP_DIST[from]?.[to];
                        const active = tripFrom === from && tripTo === to;
                        return (
                          <td key={to} className={s.colNumber}
                            style={{ color: active ? GOLD : d ? "#e8edf4" : "#3a5070", fontWeight: active ? 700 : undefined }}>
                            {d ? `${d} km` : "—"}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* ════════════════════════════════════════════════════════════════════
                ◆ DAILY LOG
            ════════════════════════════════════════════════════════════════════ */}
            <div className={s.sectionHeader}><span className={s.diamond}>◆</span> DAILY VEHICLE LOG</div>

            <div className={s.filterBar} style={{ marginBottom:14 }}>
              <div className={s.ctrlGroup}>
                <span className={s.ctrlLabel}>Vehicle</span>
                <select className={s.ctrlSelect} value={logVehicle} onChange={e => { setLogVehicle(e.target.value); setLogPage(1); }}>
                  <option value="ALL">— All Vehicles —</option>
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
              <div className={s.ctrlGroup}>
                <span className={s.ctrlLabel}>From Date</span>
                <input type="date" className={s.dateInput} value={logDateFrom}
                  onChange={e => { setLogDateFrom(e.target.value); setLogPage(1); }}/>
              </div>
              <div className={s.ctrlGroup}>
                <span className={s.ctrlLabel}>To Date</span>
                <input type="date" className={s.dateInput} value={logDateTo}
                  onChange={e => { setLogDateTo(e.target.value); setLogPage(1); }}/>
              </div>
              <button className={s.csvBtn} onClick={downloadCSV}>⬇ Download CSV</button>
              <button className={s.resetBtn} onClick={() => { setLogVehicle("ALL"); setLogYear("ALL"); setLogMonth("ALL"); setLogDateFrom(""); setLogDateTo(""); setLogPage(1); }}>Reset Filters</button>
            </div>

            {(() => {
              const logReady = logVehicle !== "ALL" || logYear !== "ALL" || logMonth !== "ALL" || !!logDateFrom || !!logDateTo;
              if (!logReady) return (
                <div style={{ margin:"0 28px 40px", padding:"48px 0", textAlign:"center", color:"#3a5070", border:"1px dashed #2a3f5a", borderRadius:12, fontSize:13, letterSpacing:"0.5px" }}>
                  Select a vehicle or apply a filter above to view records
                </div>
              );
              return null;
            })()}

            {(logVehicle !== "ALL" || logYear !== "ALL" || logMonth !== "ALL" || !!logDateFrom || !!logDateTo) && (
              <>
            <div style={{ fontSize:11, color:"#7a90b0", marginBottom:10, marginLeft:28 }}>{logRows.length.toLocaleString()} records · newest first</div>

            <div className={s.dailyTableWrapper}>
              <table className={s.dailyTable}>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Vehicle</th>
                    <th>Account</th>
                    <th style={{ textAlign:"right" }}>Starting KM</th>
                    <th style={{ textAlign:"right" }}>Closing KM</th>
                    <th style={{ textAlign:"right" }}>KM Run</th>
                    <th style={{ textAlign:"right" }}>Fuel Filled L</th>
                    <th style={{ textAlign:"right" }}>Fuel Cost ₹</th>
                    <th style={{ textAlign:"right" }}>Maint Cost ₹</th>
                    <th style={{ textAlign:"right" }}>Total Cost ₹</th>
                    <th>Maintenance Description</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {logSlice.map(r => (
                    <tr key={r.id}>
                      <td className={s.colDate}>{r.date}</td>
                      <td className={s.colVehicle} style={{ color: vColor(r.vehicle_id) }}>{r.vehicle_id}</td>
                      <td className={s.colAccount}>{r.account}</td>
                      <td className={s.colNumber}>{fmt(r.starting_km,0)}</td>
                      <td className={s.colNumber}>{fmt(r.closing_km,0)}</td>
                      <td className={s.colNumber} style={{ color:TEAL }}>{fmt(r.km_run,0)}</td>
                      <td className={s.colNumber}>{fmt(r.fuel_filled_l,1)}</td>
                      <td className={s.colNumber} style={{ color:GOLD }}>{fmt(r.fuel_cost,0)}</td>
                      <td className={s.colNumber} style={{ color:RED }}>{fmt(r.maint_cost,0)}</td>
                      <td className={s.colNumber} style={{ color:GOLD, fontWeight:700 }}>{fmt(r.total_cost,0)}</td>
                      <td style={{ color:"#7a90b0", maxWidth:160, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }} title={r.maintenance_performed}>{r.maintenance_performed || "—"}</td>
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
                    <td colSpan={3} style={{ color:TEAL, fontWeight:700 }}>TOTAL ({logRows.length} records)</td>
                    <td colSpan={2}/>
                    <td className={s.colNumber} style={{ color:TEAL }}>{fmt(logRows.reduce((a,r)=>a+r.km_run,0),0)}</td>
                    <td className={s.colNumber} style={{ color:TEAL }}>{fmt(logRows.reduce((a,r)=>a+r.fuel_filled_l,0),1)}</td>
                    <td className={s.colNumber} style={{ color:GOLD }}>{fmt(logRows.reduce((a,r)=>a+r.fuel_cost,0),0)}</td>
                    <td className={s.colNumber} style={{ color:RED  }}>{fmt(logRows.reduce((a,r)=>a+r.maint_cost,0),0)}</td>
                    <td className={s.colNumber} style={{ color:GOLD, fontWeight:700 }}>{fmt(logRows.reduce((a,r)=>a+r.total_cost,0),0)}</td>
                    <td colSpan={2}/>
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
          </>
        )}
      </div>

      {showUpload && <UploadModal onClose={() => setShowUpload(false)} onSuccess={loadData}/>}
      {editRecord !== false && <RecordModal record={editRecord} vehicles={vehicles} onClose={() => setEditRecord(false)} onSuccess={loadData}/>}
    </div>
  );
}
