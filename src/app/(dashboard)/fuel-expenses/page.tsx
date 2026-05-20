"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  BarChart, Bar, LineChart, Line, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer,
} from "recharts";
import { Upload, Plus, RefreshCw, ChevronLeft, ChevronRight, Pencil, Palette, Maximize2, Minimize2 } from "lucide-react";
import { UploadModal } from "@/components/fleet/UploadModal";
import { RecordModal, FleetRecord } from "@/components/fleet/RecordModal";
import s from "./fleet.module.css";

/* ─── Types ──────────────────────────────────────────────────────────────────── */
type Row = FleetRecord & { id: number };

/* ─── Constants ──────────────────────────────────────────────────────────────── */
const MONTH_NAMES   = ["Jan","Feb","Mar","Apr","May","June","Jul","Aug","Sep","Oct","Nov","Dec"];
const LOG_PAGE_SIZE = 20;

/* ─── Theme ──────────────────────────────────────────────────────────────────── */
type FleetThemeConfig = {
  bg: string; surface: string; card: string; border: string; text: string; muted: string;
  teal: string; gold: string; red: string; green: string; purple: string; blue: string;
  vehicles: string[];
};

const FLEET_THEME_DEFAULT: FleetThemeConfig = {
  bg:      "#fdf8ee",
  surface: "#f0ead4",
  card:    "#ffffff",
  border:  "#e5dfc8",
  text:    "#1a1a1a",
  muted:   "#6b7280",
  teal:    "#4a9e4a",
  gold:    "#e8c84a",
  red:     "#e8524a",
  green:   "#2d6e2d",
  purple:  "#9b59b6",
  blue:    "#3498db",
  vehicles: [
    "#1fc8c8","#f5a623","#e8524a","#2ecc71","#9b59b6","#3498db",
    "#fb923c","#f472b6","#a3e635","#34d399","#818cf8","#fbbf24","#60a5fa","#e879f9",
  ],
};

const FLEET_THEME_MAP: Record<string, Partial<FleetThemeConfig>> = {
  forest:   { bg: "#fdf8ee", surface: "#f0ead4", card: "#ffffff", border: "#e5dfc8", text: "#1a1a1a", muted: "#6b7280", teal: "#4a9e4a", green: "#2d6e2d" },
  coffee:   { bg: "#fdf6ee", surface: "#f0e8d8", card: "#ffffff", border: "#e0d0b8", text: "#1a1a1a", muted: "#7a6050", teal: "#c0874a", green: "#8b5e3c" },
  navy:     { bg: "#f0f4f8", surface: "#e8edf5", card: "#ffffff", border: "#d0dae8", text: "#1a2a4a", muted: "#6b7fa0", teal: "#1fc8c8", green: "#2ecc71" },
  burgundy: { bg: "#fdf0f2", surface: "#f0dfe2", card: "#ffffff", border: "#e0c8cc", text: "#1a1a1a", muted: "#7a5060", teal: "#c04a6a", green: "#4a9e4a" },
  slate:    { bg: "#f0f4f5", surface: "#e4ecef", card: "#ffffff", border: "#ccd8dd", text: "#1a2a30", muted: "#6a7f8a", teal: "#4ab0c0", green: "#4a9e4a" },
};

/* ─── Helpers ────────────────────────────────────────────────────────────────── */
const fmt  = (n: number, dec = 0) => n.toLocaleString("en-IN", { maximumFractionDigits: dec, minimumFractionDigits: dec });
const fmtC = (n: number) => n >= 100000 ? "₹" + (n/100000).toFixed(2) + "L" : n >= 1000 ? "₹" + (n/1000).toFixed(1) + "k" : "₹" + fmt(n);

// Supabase returns numeric PostgreSQL columns as strings — coerce everything to number
const n = (v: unknown) => Number(v) || 0;

function aggRows(rows: Row[]) {
  const totalKm     = rows.reduce((a, r) => a + n(r.km_run), 0);
  const totalLitres = rows.reduce((a, r) => a + n(r.fuel_filled_l), 0);
  const fuelCost    = rows.reduce((a, r) => a + n(r.fuel_cost), 0);
  const maintCost   = rows.reduce((a, r) => a + n(r.maint_cost), 0);
  const totalCost   = fuelCost + maintCost;
  const startKm     = rows.length > 0 ? Math.min(...rows.map(r => n(r.starting_km)).filter(v => v > 0)) : 0;
  const closeKm     = rows.length > 0 ? Math.max(...rows.map(r => n(r.closing_km))) : 0;
  return {
    totalKm, totalLitres, fuelCost, maintCost, totalCost,
    avgMileage: totalLitres > 0 ? totalKm / totalLitres : 0,
    costPerKm:  totalKm > 0 ? totalCost / totalKm : 0,
    startKm, closeKm,
  };
}

const ttStyle = { backgroundColor:"var(--msp-navy-mid)", border:"1px solid var(--msp-navy-border)", borderRadius:8, fontSize:11, color:"var(--msp-text)" };

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
  const [tripFromText, setTripFromText] = useState("Moganad Estate, Managalam");
  const [tripToText,   setTripToText]   = useState("MG Road, Bangalore");
  const [tripFromCoord, setTripFromCoord] = useState<{lat:number;lon:number}|null>({ lat:11.0961, lon:77.2664 });
  const [tripToCoord,   setTripToCoord]   = useState<{lat:number;lon:number}|null>({ lat:12.9747, lon:77.6095 });
  const [geocodingFrom, setGeocodingFrom] = useState(false);
  const [geocodingTo,   setGeocodingTo]   = useState(false);
  const [tripVehicle,       setTripVehicle]       = useState("");
  const [fuelPrice,         setFuelPrice]         = useState(93);
  const [fuelPriceAutoSrc,  setFuelPriceAutoSrc]  = useState<string>("");

  /* ── Modals ──────────────────────────────────────────────────────────────────── */
  const [showUpload, setShowUpload] = useState(false);
  const [editRecord, setEditRecord] = useState<Row | null | false>(false);

  /* ── MIS Report ──────────────────────────────────────────────────────────────── */
  const [showReport,       setShowReport]       = useState(false);
  const [reportFromMonth,  setReportFromMonth]  = useState("Jan");
  const [reportFromYear,   setReportFromYear]   = useState(String(new Date().getFullYear()));
  const [reportToMonth,    setReportToMonth]    = useState(MONTH_NAMES[new Date().getMonth()]);
  const [reportToYear,     setReportToYear]     = useState(String(new Date().getFullYear()));

  /* ── Fullscreen ──────────────────────────────────────────────────────────────── */
  const pageRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  useEffect(() => {
    const onChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      pageRef.current?.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  /* ── Theme ───────────────────────────────────────────────────────────────────── */
  const [theme, setTheme]                   = useState<FleetThemeConfig>({ ...FLEET_THEME_DEFAULT });
  const [showPalettePanel, setShowPalettePanel] = useState(false);

  useEffect(() => {
    const applyGlobalTheme = () => {
      const globalKey = localStorage.getItem("msp_theme");
      const preset = globalKey && FLEET_THEME_MAP[globalKey];
      if (preset) { setTheme(prev => ({ ...prev, ...preset })); return; }
      const saved = localStorage.getItem("mspc-fleet-theme");
      if (saved) try { setTheme(JSON.parse(saved)); } catch {}
    };
    applyGlobalTheme();
    const handler = (e: StorageEvent) => { if (e.key === "msp_theme") applyGlobalTheme(); };
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, []);

  const updateTheme = useCallback(<K extends keyof FleetThemeConfig>(key: K, val: FleetThemeConfig[K]) => {
    setTheme(prev => {
      const next = { ...prev, [key]: val };
      localStorage.setItem("mspc-fleet-theme", JSON.stringify(next));
      return next;
    });
  }, []);

  const updateVehicleColor = useCallback((idx: number, val: string) => {
    setTheme(prev => {
      const next = { ...prev, vehicles: prev.vehicles.map((c, i) => i === idx ? val : c) };
      localStorage.setItem("mspc-fleet-theme", JSON.stringify(next));
      return next;
    });
  }, []);

  const resetTheme = () => {
    setTheme({ ...FLEET_THEME_DEFAULT });
    localStorage.removeItem("mspc-fleet-theme");
  };

  /* ── Dynamic colour constants (used throughout JSX) ──────────────────────────── */
  const TEAL           = theme.teal;
  const GOLD           = theme.gold;
  const RED            = theme.red;
  const GREEN          = theme.green;
  const PURPLE         = theme.purple;
  const BLUE           = theme.blue;
  const VEHICLE_PALETTE = theme.vehicles;

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
      if (error) { console.error("[fleet] loadData error:", error); break; }
      if (!rows || rows.length === 0) break;
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
  const LOC_LABELS: Record<string, string> = {
    moganad:'Moganad Estate, Managalam', stanmore:'Stanmore Estate, Nagalur',
    greenways_s:'7/95 Greenways Rd, Salem', eng_club_cbe:'English Club Race Course, CBE',
    bangalore:'MG Road, Bangalore', pattiveranpatti:'Pattiveranpatti', chennai:'Adyar, Chennai',
  };
  const LOC_COORDS: Record<string, { lat: number; lon: number }> = {
    moganad:      { lat: 11.0961, lon: 77.2664 },
    stanmore:     { lat: 11.7753, lon: 78.2093 },
    greenways_s:  { lat: 11.6483, lon: 78.1462 },
    eng_club_cbe: { lat: 11.0168, lon: 76.9558 },
    bangalore:    { lat: 12.9747, lon: 77.6095 },
    pattiveranpatti: { lat: 11.4672, lon: 78.0630 },
    chennai:      { lat: 13.0012, lon: 80.2570 },
  };
  const START_KEYS = ['moganad','stanmore','greenways_s','eng_club_cbe'];
  const END_KEYS   = ['bangalore','pattiveranpatti','greenways_s','chennai','eng_club_cbe'];

  const [osrmDist,    setOsrmDist]    = useState<number | null>(null);
  const [osrmLoading, setOsrmLoading] = useState(false);

  /* Geocode a free-text address → coords (presets bypass Nominatim) */
  const geocodeAddress = useCallback(async (text: string): Promise<{lat:number;lon:number}|null> => {
    const key = Object.keys(LOC_LABELS).find(k => LOC_LABELS[k].toLowerCase() === text.trim().toLowerCase());
    if (key && LOC_COORDS[key]) return LOC_COORDS[key];
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(text)}&format=json&limit=1&countrycodes=in`,
        { headers: { "Accept-Language": "en" } }
      );
      const json = await res.json();
      if (json[0]) return { lat: parseFloat(json[0].lat), lon: parseFloat(json[0].lon) };
    } catch {}
    return null;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* Debounced geocoding for From field */
  useEffect(() => {
    if (!tripFromText.trim()) { setTripFromCoord(null); return; }
    const t = setTimeout(async () => {
      setGeocodingFrom(true);
      const coord = await geocodeAddress(tripFromText);
      setTripFromCoord(coord);
      setGeocodingFrom(false);
    }, 800);
    return () => clearTimeout(t);
  }, [tripFromText, geocodeAddress]);

  /* Debounced geocoding for To field */
  useEffect(() => {
    if (!tripToText.trim()) { setTripToCoord(null); return; }
    const t = setTimeout(async () => {
      setGeocodingTo(true);
      const coord = await geocodeAddress(tripToText);
      setTripToCoord(coord);
      setGeocodingTo(false);
    }, 800);
    return () => clearTimeout(t);
  }, [tripToText, geocodeAddress]);

  /* OSRM routing when both coords are ready */
  useEffect(() => {
    if (!tripFromCoord || !tripToCoord) { setOsrmDist(null); return; }
    setOsrmLoading(true);
    setOsrmDist(null);
    fetch(
      `https://router.project-osrm.org/route/v1/driving/${tripFromCoord.lon},${tripFromCoord.lat};${tripToCoord.lon},${tripToCoord.lat}?overview=false`
    )
      .then(r => r.json())
      .then(d => {
        const metres = d?.routes?.[0]?.distance;
        if (metres) setOsrmDist(Math.round(metres / 1000));
        else setOsrmDist(null);
      })
      .catch(() => setOsrmDist(null))
      .finally(() => setOsrmLoading(false));
  }, [tripFromCoord, tripToCoord]);

  /* Auto-fill fuel price from vehicle's most recent fill-up */
  useEffect(() => {
    if (!tripVehicle || data.length === 0) { setFuelPriceAutoSrc(""); return; }

    // Tier 1 — this vehicle, has both cost and litres
    const tier1 = data
      .filter(r => r.vehicle_id === tripVehicle && n(r.fuel_cost) > 0 && n(r.fuel_filled_l) > 0)
      .sort((a, b) => b.date.localeCompare(a.date));
    if (tier1.length > 0) {
      const last = tier1[0];
      const rate = Math.round((n(last.fuel_cost) / n(last.fuel_filled_l)) * 10) / 10;
      if (rate > 0 && isFinite(rate)) {
        setFuelPrice(rate);
        setFuelPriceAutoSrc(`last fill ${last.date}`);
        return;
      }
    }

    // Tier 2 — same fuel_type across all vehicles, has both cost and litres
    const vFuelType = data.find(r => r.vehicle_id === tripVehicle)?.fuel_type;
    if (vFuelType) {
      const tier2 = data
        .filter(r => r.fuel_type === vFuelType && n(r.fuel_cost) > 0 && n(r.fuel_filled_l) > 0)
        .sort((a, b) => b.date.localeCompare(a.date));
      if (tier2.length > 0) {
        const last = tier2[0];
        const rate = Math.round((n(last.fuel_cost) / n(last.fuel_filled_l)) * 10) / 10;
        if (rate > 0 && isFinite(rate)) {
          setFuelPrice(rate);
          setFuelPriceAutoSrc(`fleet avg · ${vFuelType} · ${last.date}`);
          return;
        }
      }
    }

    setFuelPriceAutoSrc("⚠ no fill data — enter manually");
  }, [tripVehicle, data]);

  const tripCalc = useMemo(() => {
    const dist = osrmDist;
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
  }, [data, osrmDist, tripVehicle, fuelPrice]);

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
    <div ref={pageRef} className={s.page} style={{
      "--t-bg":      theme.bg,
      "--t-surface": theme.surface,
      "--t-card":    theme.card,
      "--t-border":  theme.border,
      "--t-text":    theme.text,
      "--t-muted":   theme.muted,
      "--t-teal":    theme.teal,
    } as React.CSSProperties}>
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
            <button className={s.fullscreenBtn} onClick={toggleFullscreen} title={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}>
              {isFullscreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
            </button>
            <button
              className={`${s.paletteBtn} ${showPalettePanel ? s.paletteBtnActive : ""}`}
              onClick={() => setShowPalettePanel(v => !v)}
            >
              <Palette size={13} /> Colours
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
            <div className={s.sectionHeader} style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
              <span><span className={s.diamond}>◆</span> SINGLE VEHICLE SPOTLIGHT</span>
              <button
                onClick={() => setShowReport(true)}
                style={{
                  display:"flex", alignItems:"center", gap:"7px",
                  padding:"7px 16px", borderRadius:"8px",
                  background:"#1b4a1b", color:"white", border:"none",
                  fontWeight:700, fontSize:"12px", cursor:"pointer",
                  boxShadow:"0 2px 8px rgba(27,74,27,0.22)",
                  letterSpacing:"0.03em",
                }}>
                <span style={{ fontSize:"14px" }}>📊</span> MIS Report
              </button>
            </div>

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

            <div className={s.kpiGrid3Col} style={{ marginBottom:28 }}>
              {[
                { emoji:"⛽", label:"Total Fuel Filled",        value:fmt(svAgg.totalLitres,0),         unit:"L",    sub:`${svRows.length} fill-ups recorded`,                  accent:TEAL   },
                { emoji:"🛣️", label:"Total KM Running",         value:fmt(svAgg.totalKm,0),              unit:"km",  sub:`Odometer: ${fmt(svAgg.startKm,0)} → ${fmt(svAgg.closeKm,0)}`, accent:GOLD   },
                { emoji:"🌿", label:"Vehicle Mileage",           value:fmt(svAgg.avgMileage,2),          unit:"km/L", sub:"Average fuel efficiency",                             accent:GREEN  },
                { emoji:"💰", label:"Vehicle Fuel Cost",         value:fmtC(svAgg.fuelCost),             unit:"",    sub:"Total fuel expenditure (₹)",                          accent:RED    },
                { emoji:"🔧", label:"Maintenance Cost",          value:fmtC(svAgg.maintCost),            unit:"",    sub:"Total maintenance expenditure (₹)",                   accent:PURPLE },
                { emoji:"💸", label:"Fuel + Maintenance Cost",   value:fmtC(svAgg.totalCost),            unit:"",    sub:"Combined operational cost (₹)",                       accent:"#e67e22"},
                { emoji:"📊", label:"Running Cost / KM",         value:fmt(svAgg.costPerKm,2),           unit:"₹/km",sub:"Total vehicle cost per kilometre",                    accent:BLUE   },
                { emoji:"🚀", label:"Starting KM",               value:fmt(svAgg.startKm,0),             unit:"",    sub:"First odometer reading",                              accent:TEAL   },
                { emoji:"🏁", label:"Closing KM",                value:fmt(svAgg.closeKm,0),             unit:"",    sub:"Final odometer reading",                              accent:RED    },
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

            <div className={s.kpiGrid3Col}>
              {[
                { emoji:"⛽", label:"Total Fuel Filled",       value:fmt(kpiAgg.totalLitres,0),   unit:"L",    sub:"Litres of fuel consumed",                    accent:TEAL   },
                { emoji:"🛣️", label:"Total KM Running",        value:fmt(kpiAgg.totalKm,0),        unit:"km",  sub:"Distance covered",                           accent:GOLD   },
                { emoji:"🌿", label:"Vehicle Mileage",          value:fmt(kpiAgg.avgMileage,2),    unit:"km/L", sub:"Average fuel efficiency",                    accent:GREEN  },
                { emoji:"💰", label:"Vehicle Fuel Cost",        value:fmtC(kpiAgg.fuelCost),       unit:"",    sub:"Total fuel expenditure (₹)",                 accent:RED    },
                { emoji:"🔧", label:"Maintenance Cost",         value:fmtC(kpiAgg.maintCost),      unit:"",    sub:"Total maintenance expenditure (₹)",          accent:PURPLE },
                { emoji:"💸", label:"Fuel + Maintenance Cost",  value:fmtC(kpiAgg.totalCost),      unit:"",    sub:"Combined operational cost (₹)",              accent:"#e67e22"},
                { emoji:"📊", label:"Running Cost / KM",        value:fmt(kpiAgg.costPerKm,2),     unit:"₹/km",sub:"Total vehicle cost per kilometre",           accent:BLUE   },
                { emoji:"🚀", label:"Starting KM",              value:fmt(kpiAgg.startKm,0),       unit:"",    sub:"First odometer reading",                     accent:"#1abc9c"},
                { emoji:"🏁", label:"Closing KM",               value:fmt(kpiAgg.closeKm,0),       unit:"",    sub:"Final odometer reading",                     accent:"#e74c3c"},
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
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--msp-navy-mid)" vertical={false}/>
                      <XAxis dataKey="label" tick={{ fill:"var(--msp-neutral)", fontSize:9 }} axisLine={false} tickLine={false} interval="preserveStartEnd"/>
                      <YAxis tick={{ fill:"var(--msp-neutral)", fontSize:9 }} axisLine={false} tickLine={false} tickFormatter={v => fmtC(v as number)} width={52}/>
                      <Tooltip contentStyle={ttStyle} formatter={(v: unknown) => [fmtC(v as number), "Fuel Cost"]}/>
                      <Area type="monotone" dataKey="fuelCost" stroke={GOLD} fill="url(#fg)" strokeWidth={2} dot={false}/>
                    </AreaChart>
                  </ResponsiveContainer>
                </div>

                <div className={s.chartCard}>
                  <div className={s.chartTitle}>Monthly KM Run</div>
                  <ResponsiveContainer width="100%" height={160}>
                    <BarChart data={monthlyTrend} margin={{ top:4, right:8, left:0, bottom:0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--msp-navy-mid)" vertical={false}/>
                      <XAxis dataKey="label" tick={{ fill:"var(--msp-neutral)", fontSize:9 }} axisLine={false} tickLine={false} interval="preserveStartEnd"/>
                      <YAxis tick={{ fill:"var(--msp-neutral)", fontSize:9 }} axisLine={false} tickLine={false} tickFormatter={v => fmt(v as number)} width={44}/>
                      <Tooltip contentStyle={ttStyle} formatter={(v: unknown) => [fmt(v as number) + " km", "KM Run"]}/>
                      <Bar dataKey="kmRun" fill={TEAL} fillOpacity={0.85} radius={[3,3,0,0]}/>
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                <div className={s.chartCard}>
                  <div className={s.chartTitle}>Avg Mileage (km/L)</div>
                  <ResponsiveContainer width="100%" height={160}>
                    <LineChart data={monthlyTrend} margin={{ top:4, right:8, left:0, bottom:0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--msp-navy-mid)" vertical={false}/>
                      <XAxis dataKey="label" tick={{ fill:"var(--msp-neutral)", fontSize:9 }} axisLine={false} tickLine={false} interval="preserveStartEnd"/>
                      <YAxis tick={{ fill:"var(--msp-neutral)", fontSize:9 }} axisLine={false} tickLine={false} tickFormatter={v => (v as number).toFixed(1)} width={36}/>
                      <Tooltip contentStyle={ttStyle} formatter={(v: unknown) => [(v as number).toFixed(2) + " km/L", "Mileage"]}/>
                      <Line type="monotone" dataKey="avgMileage" stroke={GREEN} strokeWidth={2} dot={{ r:3, fill:GREEN }}/>
                    </LineChart>
                  </ResponsiveContainer>
                </div>

                <div className={s.chartCard}>
                  <div className={s.chartTitle}>Fuel vs Maintenance</div>
                  <ResponsiveContainer width="100%" height={160}>
                    <BarChart data={monthlyTrend} margin={{ top:4, right:8, left:0, bottom:0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--msp-navy-mid)" vertical={false}/>
                      <XAxis dataKey="label" tick={{ fill:"var(--msp-neutral)", fontSize:9 }} axisLine={false} tickLine={false} interval="preserveStartEnd"/>
                      <YAxis tick={{ fill:"var(--msp-neutral)", fontSize:9 }} axisLine={false} tickLine={false} tickFormatter={v => fmtC(v as number)} width={52}/>
                      <Tooltip contentStyle={ttStyle} formatter={(v: unknown, n: unknown) => [fmtC(v as number), n === "fuelCost" ? "Fuel" : "Maintenance"]}/>
                      <Legend wrapperStyle={{ fontSize:10, color:"var(--msp-neutral)" }}/>
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

            {/* Preset suggestions datalist */}
            <datalist id="trip-locations">
              {Object.values(LOC_LABELS).map(l => <option key={l} value={l} />)}
            </datalist>

            <div className={s.filterBar} style={{ marginBottom:16 }}>
              <div className={s.ctrlGroup} style={{ minWidth:220 }}>
                <span className={s.ctrlLabel}>
                  From {geocodingFrom && <span style={{ color: TEAL, fontSize:10 }}>locating…</span>}
                  {!geocodingFrom && tripFromCoord && <span style={{ color: GREEN, fontSize:10 }}>✓</span>}
                  {!geocodingFrom && tripFromText && !tripFromCoord && <span style={{ color: RED, fontSize:10 }}>not found</span>}
                </span>
                <input
                  list="trip-locations"
                  className={s.ctrlSelect}
                  value={tripFromText}
                  onChange={e => setTripFromText(e.target.value)}
                  placeholder="Type or select a location…"
                  style={{ minWidth:220 }}
                />
              </div>
              <div className={s.ctrlGroup} style={{ minWidth:220 }}>
                <span className={s.ctrlLabel}>
                  To {geocodingTo && <span style={{ color: TEAL, fontSize:10 }}>locating…</span>}
                  {!geocodingTo && tripToCoord && <span style={{ color: GREEN, fontSize:10 }}>✓</span>}
                  {!geocodingTo && tripToText && !tripToCoord && <span style={{ color: RED, fontSize:10 }}>not found</span>}
                </span>
                <input
                  list="trip-locations"
                  className={s.ctrlSelect}
                  value={tripToText}
                  onChange={e => setTripToText(e.target.value)}
                  placeholder="Type or select a location…"
                  style={{ minWidth:220 }}
                />
              </div>
              <div className={s.ctrlGroup}>
                <span className={s.ctrlLabel}>Vehicle (for mileage)</span>
                <select className={s.ctrlSelect} value={tripVehicle} onChange={e => setTripVehicle(e.target.value)}>
                  <option value="">— Select Vehicle —</option>
                  {vehicles.map(v => <option key={v} value={v}>{v}</option>)}
                </select>
              </div>
              <div className={s.ctrlGroup}>
                <span className={s.ctrlLabel}>
                  Fuel Price (₹/L)
                  {fuelPriceAutoSrc && (
                    <span style={{ color: fuelPriceAutoSrc.startsWith("⚠") ? GOLD : GREEN, fontSize:10, marginLeft:6 }}>
                      {fuelPriceAutoSrc.startsWith("⚠") ? fuelPriceAutoSrc : `auto · ${fuelPriceAutoSrc}`}
                    </span>
                  )}
                </span>
                <input type="number" className={s.dateInput} value={fuelPrice} min={50} max={200}
                  onChange={e => { setFuelPrice(parseFloat(e.target.value) || 93); setFuelPriceAutoSrc(""); }}
                  style={{ width:110 }}/>
              </div>
            </div>

            <div className={s.tripResultGrid}>
              {[
                { label:"DISTANCE",         value: osrmLoading ? "…" : tripCalc.dist ? `${tripCalc.dist} km` : "N/A",       sub: osrmLoading ? "fetching via OSRM" : "km (one way)",                              accent:TEAL   },
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
                <div style={{ margin:"0 28px 40px", padding:"48px 0", textAlign:"center", color:"var(--msp-charcoal)", border:"1px dashed var(--msp-navy-border)", borderRadius:12, fontSize:13, letterSpacing:"0.5px" }}>
                  Select a vehicle or apply a filter above to view records
                </div>
              );
              return null;
            })()}

            {(logVehicle !== "ALL" || logYear !== "ALL" || logMonth !== "ALL" || !!logDateFrom || !!logDateTo) && (
              <>
            <div style={{ fontSize:11, color:"var(--msp-neutral)", marginBottom:10, marginLeft:28 }}>{logRows.length.toLocaleString()} records · newest first</div>

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
                      <td style={{ color:"var(--msp-neutral)", maxWidth:160, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }} title={r.maintenance_performed}>{r.maintenance_performed || "—"}</td>
                      <td>
                        <button onClick={() => setEditRecord(r)} style={{ background:"none", border:"none", color:"var(--msp-charcoal)", cursor:"pointer", padding:"2px 4px" }}>
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
                <span style={{ fontSize:11, color:"var(--msp-neutral)" }}>Page {logPage} of {logPages}</span>
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

      {/* ════════════════════════════════════════════════════════════════════════
          ◆ MIS REPORT MODAL
      ════════════════════════════════════════════════════════════════════════ */}
      {showReport && (() => {
        // ── filter rows for the selected date range ──────────────────────────
        const fromMIdx = MONTH_NAMES.indexOf(reportFromMonth) + 1; // 1-12
        const toMIdx   = MONTH_NAMES.indexOf(reportToMonth)   + 1;
        const fromY    = parseInt(reportFromYear, 10);
        const toY      = parseInt(reportToYear,   10);

        const reportRows = data.filter(r => {
          const ry = r.year  ?? new Date(r.date).getFullYear();
          const rm = r.month ?? new Date(r.date).getMonth() + 1;
          const stamp = ry * 100 + rm;
          return stamp >= fromY * 100 + fromMIdx && stamp <= toY * 100 + toMIdx;
        });

        // ── aggregate per vehicle ─────────────────────────────────────────────
        const byVehicle: Record<string, { account:string; rows:Row[] }> = {};
        reportRows.forEach(r => {
          if (!byVehicle[r.vehicle_id]) byVehicle[r.vehicle_id] = { account: r.account, rows: [] };
          byVehicle[r.vehicle_id].rows.push(r);
        });

        type VehicleSummary = {
          vehicle_id: string; account: string; firstDate: string;
          startKm: number; closeKm: number; kmRun: number;
          fuelFilled: number; fuelCost: number; maintCost: number; totalCost: number;
        };

        const summaryRows: VehicleSummary[] = Object.entries(byVehicle)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([vid, { account, rows: vrows }]) => {
            const agg = aggRows(vrows);
            const firstDate = vrows.slice().sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())[0]?.date ?? "";
            return {
              vehicle_id: vid, account,
              firstDate: firstDate ? new Date(firstDate).toLocaleDateString("en-IN", { day:"2-digit", month:"short", year:"numeric" }) : "—",
              startKm: agg.startKm, closeKm: agg.closeKm, kmRun: agg.totalKm,
              fuelFilled: agg.totalLitres, fuelCost: agg.fuelCost,
              maintCost: agg.maintCost, totalCost: agg.totalCost,
            };
          });

        // ── grand totals ──────────────────────────────────────────────────────
        const grand = summaryRows.reduce((acc, r) => ({
          kmRun:      acc.kmRun      + r.kmRun,
          fuelFilled: acc.fuelFilled + r.fuelFilled,
          fuelCost:   acc.fuelCost   + r.fuelCost,
          maintCost:  acc.maintCost  + r.maintCost,
          totalCost:  acc.totalCost  + r.totalCost,
        }), { kmRun:0, fuelFilled:0, fuelCost:0, maintCost:0, totalCost:0 });

        const periodLabel = `${reportFromMonth} ${reportFromYear} to ${reportToMonth} ${reportToYear}`;

        // ── CSV download ──────────────────────────────────────────────────────
        const downloadCSV = () => {
          const hdr = ["Date","Vehicle ID","Account","Starting KM","Closing KM","KM Run","Fuel Filled (L)","Fuel Cost (Rs)","Maint Cost (Rs)","Total Cost (Rs)"].join(",");
          const body = summaryRows.map(r =>
            [r.firstDate, r.vehicle_id, r.account, r.startKm, r.closeKm, r.kmRun,
             r.fuelFilled.toFixed(2), r.fuelCost.toFixed(2), r.maintCost.toFixed(2), r.totalCost.toFixed(2)].join(",")
          );
          const totRow = ["TOTAL","","","","",grand.kmRun, grand.fuelFilled.toFixed(2),
            grand.fuelCost.toFixed(2), grand.maintCost.toFixed(2), grand.totalCost.toFixed(2)].join(",");
          const csv = ["MSP COFFEE P LTD", `${periodLabel} - ALL VEHICLES FUEL EXPENSE DETAILS (MIS REPORT)`, hdr, ...body, totRow].join("\n");
          const blob = new Blob([csv], { type:"text/csv" });
          const url  = URL.createObjectURL(blob);
          const a    = document.createElement("a");
          a.href = url; a.download = `MSP_Fleet_MIS_${periodLabel.replace(/ /g,"_")}.csv`; a.click();
          URL.revokeObjectURL(url);
        };

        // ── print ─────────────────────────────────────────────────────────────
        const printReport = () => {
          const printWin = window.open("", "_blank", "width=1100,height=800");
          if (!printWin) return;
          const rows_html = summaryRows.map(r => `
            <tr>
              <td>${r.firstDate}</td><td><b>${r.vehicle_id}</b></td><td>${r.account}</td>
              <td style="text-align:right">${fmt(r.startKm,0)}</td>
              <td style="text-align:right">${fmt(r.closeKm,0)}</td>
              <td style="text-align:right">${fmt(r.kmRun,0)}</td>
              <td style="text-align:right">${r.fuelFilled.toFixed(2)}</td>
              <td style="text-align:right">₹${fmt(r.fuelCost,0)}</td>
              <td style="text-align:right">₹${fmt(r.maintCost,0)}</td>
              <td style="text-align:right"><b>₹${fmt(r.totalCost,0)}</b></td>
            </tr>`).join("");
          printWin.document.write(`<!DOCTYPE html><html><head><title>MSP Fleet MIS Report</title>
            <style>
              body { font-family: Arial, sans-serif; font-size: 12px; padding: 24px; }
              h2 { color: #1b4a1b; margin:0; } h4 { margin:4px 0 16px; color:#555; }
              table { width:100%; border-collapse:collapse; margin-top:16px; }
              th { background:#1b4a1b; color:white; padding:7px 10px; text-align:left; font-size:11px; }
              th.num { text-align:right; }
              td { padding:6px 10px; border-bottom:1px solid #e5dfc8; }
              tr:nth-child(even) td { background:#fdf8ee; }
              .tot td { background:#1b4a1b!important; color:white; font-weight:bold; }
              .note { margin-top:20px; padding:12px; background:#f9f6ed; border-left:4px solid #1b4a1b; border-radius:4px; }
              .note-grid { display:grid; grid-template-columns:1fr 1fr 1fr; gap:10px; margin-top:8px; }
              .note-item { font-size:11px; } .note-item b { display:block; font-size:13px; color:#1b4a1b; }
              @media print { button { display:none; } }
            </style></head><body>
            <h2>MSP COFFEE P LTD</h2>
            <h4>${periodLabel} — ALL VEHICLES FUEL EXPENSE DETAILS (MIS REPORT)</h4>
            <table>
              <thead><tr>
                <th>Date</th><th>Vehicle ID</th><th>Account</th>
                <th class="num">Start KM</th><th class="num">Close KM</th><th class="num">KM Run</th>
                <th class="num">Fuel (L)</th><th class="num">Fuel Cost</th>
                <th class="num">Maint Cost</th><th class="num">Total Cost</th>
              </tr></thead>
              <tbody>${rows_html}</tbody>
              <tfoot><tr class="tot">
                <td colspan="5"><b>GRAND TOTAL</b></td>
                <td style="text-align:right">${fmt(grand.kmRun,0)}</td>
                <td style="text-align:right">${grand.fuelFilled.toFixed(2)}</td>
                <td style="text-align:right">₹${fmt(grand.fuelCost,0)}</td>
                <td style="text-align:right">₹${fmt(grand.maintCost,0)}</td>
                <td style="text-align:right">₹${fmt(grand.totalCost,0)}</td>
              </tr></tfoot>
            </table>
            <div class="note">
              <b style="color:#1b4a1b">Period Summary</b>
              <div class="note-grid">
                <div class="note-item">Fuel Purchase<b>₹${fmt(grand.fuelCost,0)}</b></div>
                <div class="note-item">Maintenance Cost<b>₹${fmt(grand.maintCost,0)}</b></div>
                <div class="note-item">Total Expense<b>₹${fmt(grand.totalCost,0)}</b></div>
                <div class="note-item">Total KM Run<b>${fmt(grand.kmRun,0)} km</b></div>
                <div class="note-item">Total Fuel Filled<b>${grand.fuelFilled.toFixed(0)} L</b></div>
                <div class="note-item">Vehicles Covered<b>${summaryRows.length}</b></div>
              </div>
            </div>
            <script>window.print();<\/script></body></html>`);
          printWin.document.close();
        };

        // ── styles ────────────────────────────────────────────────────────────
        const overlay: React.CSSProperties = {
          position:"fixed", inset:0, background:"rgba(0,0,0,0.55)", zIndex:1000,
          display:"flex", alignItems:"center", justifyContent:"center", padding:"16px",
        };
        const modal: React.CSSProperties = {
          background:"#fdf8ee", borderRadius:"16px", width:"100%", maxWidth:"1100px",
          maxHeight:"90vh", display:"flex", flexDirection:"column",
          boxShadow:"0 24px 80px rgba(0,0,0,0.35)", overflow:"hidden",
        };
        const th: React.CSSProperties = {
          padding:"9px 12px", background:"#1b4a1b", color:"white",
          fontSize:"11px", fontWeight:700, textTransform:"uppercase",
          letterSpacing:"0.05em", textAlign:"left", whiteSpace:"nowrap",
        };
        const thR: React.CSSProperties = { ...th, textAlign:"right" };
        const td: React.CSSProperties = {
          padding:"8px 12px", fontSize:"12px", color:"#1a1a1a",
          borderBottom:"1px solid #f0ead4", verticalAlign:"middle",
        };
        const tdR: React.CSSProperties = { ...td, textAlign:"right" };

        return (
          <div style={overlay} onClick={e => { if (e.target === e.currentTarget) setShowReport(false); }}>
            <div style={modal}>
              {/* Header */}
              <div style={{ padding:"16px 20px", borderBottom:"1px solid #e5dfc8", display:"flex", alignItems:"center", gap:"12px", background:"#1b4a1b" }}>
                <span style={{ fontSize:"20px" }}>📊</span>
                <div>
                  <div style={{ fontWeight:800, fontSize:"15px", color:"white", letterSpacing:"0.04em" }}>MIS REPORT — FLEET FUEL EXPENSES</div>
                  <div style={{ fontSize:"12px", color:"rgba(255,255,255,0.65)", marginTop:"2px" }}>MSP COFFEE P LTD · All Vehicles</div>
                </div>
                <button onClick={() => setShowReport(false)}
                  style={{ marginLeft:"auto", background:"rgba(255,255,255,0.15)", border:"none", borderRadius:"8px", color:"white", cursor:"pointer", padding:"6px 10px", fontSize:"14px" }}>✕</button>
              </div>

              {/* Date Range Controls */}
              <div style={{ padding:"14px 20px", background:"#f0ead4", borderBottom:"1px solid #e5dfc8", display:"flex", flexWrap:"wrap", alignItems:"center", gap:"14px" }}>
                <span style={{ fontWeight:700, fontSize:"12px", color:"#1b4a1b", letterSpacing:"0.05em" }}>PERIOD:</span>
                {/* From */}
                <div style={{ display:"flex", alignItems:"center", gap:"6px" }}>
                  <span style={{ fontSize:"12px", color:"#6b7280" }}>From</span>
                  <select value={reportFromMonth} onChange={e => setReportFromMonth(e.target.value)}
                    style={{ height:"32px", padding:"0 8px", border:"1px solid #e5dfc8", borderRadius:"7px", fontSize:"13px", background:"white", color:"#1a1a1a" }}>
                    {MONTH_NAMES.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                  <select value={reportFromYear} onChange={e => setReportFromYear(e.target.value)}
                    style={{ height:"32px", padding:"0 8px", border:"1px solid #e5dfc8", borderRadius:"7px", fontSize:"13px", background:"white", color:"#1a1a1a" }}>
                    {years.map(y => <option key={y} value={y}>{y}</option>)}
                  </select>
                </div>
                <span style={{ color:"#9ca3af" }}>→</span>
                {/* To */}
                <div style={{ display:"flex", alignItems:"center", gap:"6px" }}>
                  <span style={{ fontSize:"12px", color:"#6b7280" }}>To</span>
                  <select value={reportToMonth} onChange={e => setReportToMonth(e.target.value)}
                    style={{ height:"32px", padding:"0 8px", border:"1px solid #e5dfc8", borderRadius:"7px", fontSize:"13px", background:"white", color:"#1a1a1a" }}>
                    {MONTH_NAMES.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                  <select value={reportToYear} onChange={e => setReportToYear(e.target.value)}
                    style={{ height:"32px", padding:"0 8px", border:"1px solid #e5dfc8", borderRadius:"7px", fontSize:"13px", background:"white", color:"#1a1a1a" }}>
                    {years.map(y => <option key={y} value={y}>{y}</option>)}
                  </select>
                </div>

                <div style={{ marginLeft:"auto", display:"flex", gap:"8px" }}>
                  <button onClick={downloadCSV}
                    style={{ display:"flex", alignItems:"center", gap:"6px", padding:"7px 14px", borderRadius:"8px", background:"#2d6e2d", color:"white", border:"none", fontWeight:700, fontSize:"12px", cursor:"pointer" }}>
                    ⬇ Download CSV
                  </button>
                  <button onClick={printReport}
                    style={{ display:"flex", alignItems:"center", gap:"6px", padding:"7px 14px", borderRadius:"8px", background:"#3b82f6", color:"white", border:"none", fontWeight:700, fontSize:"12px", cursor:"pointer" }}>
                    🖨 Print
                  </button>
                </div>
              </div>

              {/* Report title strip */}
              <div style={{ padding:"10px 20px", background:"#e8f0e8", borderBottom:"1px solid #d0e0d0" }}>
                <span style={{ fontWeight:700, fontSize:"13px", color:"#1b4a1b" }}>
                  {periodLabel.toUpperCase()} — ALL VEHICLES FUEL EXPENSE DETAILS
                </span>
                <span style={{ marginLeft:"12px", fontSize:"12px", color:"#6b7280" }}>
                  {summaryRows.length} vehicle{summaryRows.length !== 1 ? "s" : ""} · {reportRows.length} entries
                </span>
              </div>

              {/* Table */}
              <div style={{ flex:1, overflowY:"auto", overflowX:"auto" }}>
                {summaryRows.length === 0 ? (
                  <div style={{ padding:"48px", textAlign:"center", color:"#9ca3af", fontSize:"14px" }}>
                    No data found for the selected period. Try adjusting the date range.
                  </div>
                ) : (
                  <table style={{ width:"100%", borderCollapse:"collapse", minWidth:"820px" }}>
                    <thead>
                      <tr>
                        <th style={th}>Date</th>
                        <th style={th}>Vehicle ID</th>
                        <th style={th}>Account</th>
                        <th style={thR}>Start KM</th>
                        <th style={thR}>Close KM</th>
                        <th style={thR}>KM Run</th>
                        <th style={thR}>Fuel (L)</th>
                        <th style={thR}>Fuel Cost</th>
                        <th style={thR}>Maint Cost</th>
                        <th style={thR}>Total Cost</th>
                      </tr>
                    </thead>
                    <tbody>
                      {summaryRows.map((r, i) => (
                        <tr key={r.vehicle_id} style={{ background: i % 2 === 0 ? "#ffffff" : "#fdf8ee" }}>
                          <td style={{ ...td, fontSize:"11px", color:"#6b7280" }}>{r.firstDate}</td>
                          <td style={{ ...td, fontWeight:700, color:"#1b4a1b" }}>{r.vehicle_id}</td>
                          <td style={td}><span style={{ background:"#e8f0e8", color:"#1b4a1b", borderRadius:"6px", padding:"2px 7px", fontSize:"11px", fontWeight:700 }}>{r.account}</span></td>
                          <td style={{ ...tdR, color:"#6b7280" }}>{fmt(r.startKm,0)}</td>
                          <td style={{ ...tdR, color:"#6b7280" }}>{fmt(r.closeKm,0)}</td>
                          <td style={{ ...tdR, fontWeight:600 }}>{fmt(r.kmRun,0)}</td>
                          <td style={{ ...tdR, color:"#2d6e2d", fontWeight:600 }}>{r.fuelFilled.toFixed(1)}</td>
                          <td style={{ ...tdR, color:"#e8524a" }}>₹{fmt(r.fuelCost,0)}</td>
                          <td style={{ ...tdR, color:"#9b59b6" }}>₹{fmt(r.maintCost,0)}</td>
                          <td style={{ ...tdR, fontWeight:800, color:"#1b4a1b", fontSize:"13px" }}>₹{fmt(r.totalCost,0)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr style={{ background:"#1b4a1b" }}>
                        <td colSpan={3} style={{ ...td, color:"white", fontWeight:800, fontSize:"13px", letterSpacing:"0.04em" }}>GRAND TOTAL</td>
                        <td style={{ ...tdR, color:"white" }}>—</td>
                        <td style={{ ...tdR, color:"white" }}>—</td>
                        <td style={{ ...tdR, color:"#e8c84a", fontWeight:800 }}>{fmt(grand.kmRun,0)}</td>
                        <td style={{ ...tdR, color:"#e8c84a", fontWeight:800 }}>{grand.fuelFilled.toFixed(1)}</td>
                        <td style={{ ...tdR, color:"#fca5a5", fontWeight:800 }}>₹{fmt(grand.fuelCost,0)}</td>
                        <td style={{ ...tdR, color:"#d8b4fe", fontWeight:800 }}>₹{fmt(grand.maintCost,0)}</td>
                        <td style={{ ...tdR, color:"#e8c84a", fontWeight:800, fontSize:"14px" }}>₹{fmt(grand.totalCost,0)}</td>
                      </tr>
                    </tfoot>
                  </table>
                )}
              </div>

              {/* Summary strip */}
              {summaryRows.length > 0 && (
                <div style={{ padding:"14px 20px", borderTop:"1px solid #e5dfc8", background:"#f0ead4", display:"flex", flexWrap:"wrap", gap:"24px" }}>
                  {[
                    { label:"Fuel Purchase",      value:"₹" + fmt(grand.fuelCost,0),   clr:"#e8524a" },
                    { label:"Maintenance Cost",   value:"₹" + fmt(grand.maintCost,0),  clr:"#9b59b6" },
                    { label:"Total Expense",      value:"₹" + fmt(grand.totalCost,0),  clr:"#1b4a1b" },
                    { label:"Total KM Run",       value:fmt(grand.kmRun,0) + " km",    clr:"#2d6e2d" },
                    { label:"Total Fuel Filled",  value:grand.fuelFilled.toFixed(0) + " L", clr:"#3498db" },
                  ].map(k => (
                    <div key={k.label} style={{ textAlign:"center" }}>
                      <div style={{ fontSize:"11px", color:"#6b7280", fontWeight:600, textTransform:"uppercase", letterSpacing:"0.05em" }}>{k.label}</div>
                      <div style={{ fontSize:"16px", fontWeight:800, color:k.clr, marginTop:"2px" }}>{k.value}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* ── Colour Customiser Panel ───────────────────────────────────────────── */}
      {showPalettePanel && (
        <div className={s.cpOverlay} onClick={() => setShowPalettePanel(false)} />
      )}
      <div className={`${s.cpPanel} ${showPalettePanel ? s.cpPanelOpen : ""}`}>
        <button className={s.cpTab} onClick={() => setShowPalettePanel(v => !v)} title="Colour Customiser">
          <Palette size={18} />
        </button>
        <div className={s.cpBody}>
          <div className={s.cpHeader}>
            <span>🎨</span>
            <span className={s.cpTitle}>Colour Customiser</span>
          </div>

          <div className={s.cpSectionTitle}>Theme</div>
          {([
            { key: "bg",      label: "Background"  },
            { key: "surface", label: "Surface / Inputs" },
            { key: "card",    label: "Cards"        },
            { key: "border",  label: "Borders"      },
            { key: "text",    label: "Body Text"    },
            { key: "muted",   label: "Muted Labels" },
          ] as { key: keyof FleetThemeConfig; label: string }[]).map(({ key, label }) => (
            <label key={key} className={s.cpRow}>
              <span className={s.cpLabel}>{label}</span>
              <span className={s.cpSwatch} style={{ backgroundColor: theme[key] as string }}>
                <input type="color" value={theme[key] as string}
                  onChange={e => updateTheme(key, e.target.value)}
                  className={s.cpColorInput} />
              </span>
            </label>
          ))}

          <div className={s.cpSectionTitle}>KPI Accents</div>
          {([
            { key: "teal",   label: "Teal / KM"       },
            { key: "gold",   label: "Gold / Cost"      },
            { key: "red",    label: "Red / Maint"      },
            { key: "green",  label: "Green / Mileage"  },
            { key: "purple", label: "Purple / Maint 2" },
            { key: "blue",   label: "Blue / Other"     },
          ] as { key: keyof FleetThemeConfig; label: string }[]).map(({ key, label }) => (
            <label key={key} className={s.cpRow}>
              <span className={s.cpLabel}>{label}</span>
              <span className={s.cpSwatch} style={{ backgroundColor: theme[key] as string }}>
                <input type="color" value={theme[key] as string}
                  onChange={e => updateTheme(key, e.target.value)}
                  className={s.cpColorInput} />
              </span>
            </label>
          ))}

          <div className={s.cpSectionTitle}>Vehicle Colours</div>
          {vehicles.map((v, i) => (
            <label key={v} className={s.cpRow}>
              <span className={s.cpLabel}>{v}</span>
              <span className={s.cpSwatch} style={{ backgroundColor: theme.vehicles[i] ?? "#888" }}>
                <input type="color" value={theme.vehicles[i] ?? "#888888"}
                  onChange={e => updateVehicleColor(i, e.target.value)}
                  className={s.cpColorInput} />
              </span>
            </label>
          ))}

          <button className={s.cpResetBtn} onClick={resetTheme}>↺ Reset to defaults</button>
        </div>
      </div>
    </div>
  );
}
