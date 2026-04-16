"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { Upload, Plus, Pencil, Cloud, CloudRain, Sun, CloudSun, Wind, Droplets } from "lucide-react";
import { UploadModal } from "@/components/rainfall/UploadModal";
import { RecordModal, type RainfallRecord } from "@/components/rainfall/RecordModal";
import s from "./rainfall.module.css";

// ─── Constants ────────────────────────────────────────────────────────────────
const ESTATES = ["Gowri", "Hidden Falls", "Moganad", "Orchardale", "Stanmore", "Vyapurikuttai"];

const ESTATE_COLORS_DEFAULT: Record<string, string> = {
  "Gowri":         "#38bdf8",
  "Hidden Falls":  "#f87171",
  "Moganad":       "#4ade80",
  "Orchardale":    "#f59e0b",
  "Stanmore":      "#a78bfa",
  "Vyapurikuttai": "#fb923c",
};

// ─── Full theme config ────────────────────────────────────────────────────────
type ThemeConfig = {
  bg: string; surface: string; card: string;
  border: string; subtle: string; heading: string;
  text: string; muted: string;
  accent: string; gold: string; coral: string; green: string; purple: string;
  estates: Record<string, string>;
};

const THEME_DEFAULT: ThemeConfig = {
  bg:      "#020508",  surface: "#07111a",  card:    "#0a1824",
  border:  "#162d44",  subtle:  "#0f2437",  heading: "#f0f9ff",
  text:    "#d1e8f5",  muted:   "#3a6080",
  accent:  "#38bdf8",  gold:    "#e4b84a",  coral:   "#f87171",
  green:   "#4ade80",  purple:  "#a78bfa",
  estates: { ...ESTATE_COLORS_DEFAULT },
};

const MONTHS = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];
const MONTH_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const MEDALS = ["🥇","🥈","🥉"];

// ─── Weather ──────────────────────────────────────────────────────────────────
const WEATHER_LOCATIONS = [
  { name: "Nagalur",      lat: 11.775258, lon: 78.2092506 },
  { name: "Mangalam",     lat: 11.096053, lon: 77.266380  },
  { name: "Yercaud Town", lat: 11.789393, lon: 78.216629  },
] as const;

type WeatherData = { temp: number; humidity: number; precip: number; wind: number; code: number; desc: string; icon: string; };

const wmoIcon = (code: number): string => {
  if (code === 0) return "sun";
  if (code <= 2)  return "cloud-sun";
  if (code <= 48) return "cloud";
  return "cloud-rain";
};

const wmoDesc = (code: number): string => {
  if (code === 0)  return "Clear Sky";
  if (code === 1)  return "Mainly Clear";
  if (code === 2)  return "Partly Cloudy";
  if (code === 3)  return "Overcast";
  if (code <= 48)  return "Foggy";
  if (code <= 55)  return "Drizzle";
  if (code <= 65)  return "Rain";
  if (code <= 77)  return "Snow";
  if (code <= 82)  return "Showers";
  return "Thunderstorm";
};

// ─── Weather icon component ───────────────────────────────────────────────────
function WIcon({ icon, size = 32 }: { icon: string; size?: number }) {
  const cls = "opacity-80";
  if (icon === "sun")        return <Sun       size={size} className={cls} style={{ color: "#fde68a" }} />;
  if (icon === "cloud-sun")  return <CloudSun  size={size} className={cls} style={{ color: "#93c5fd" }} />;
  if (icon === "cloud-rain") return <CloudRain size={size} className={cls} style={{ color: "#38bdf8" }} />;
  return                            <Cloud     size={size} className={cls} style={{ color: "#93c5fd" }} />;
}

// ─── Types ────────────────────────────────────────────────────────────────────
type Row = { id: number; date: string; estate: string; rainfall_mm: number; inches: number; year: number; month: number; };
type Grouping = "daily" | "monthly" | "yearly";
type Unit = "mm" | "in";

// ─── Helpers ──────────────────────────────────────────────────────────────────
const r1 = (n: number) => Math.round(n * 10) / 10;
const daysBetween = (a: string, b: string) =>
  Math.floor((new Date(b).getTime() - new Date(a).getTime()) / 86400000);
const fmtDate = (d: string) =>
  new Date(d + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function RainfallPage() {
  const [data, setData]     = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [clock, setClock]   = useState("");
  const [dateStr, setDateStr] = useState("");

  // Filters
  const [year, setYear]             = useState<string>("all");
  const [month, setMonth]           = useState<string>("all");
  const [estateFilter, setEstateFilter] = useState<string>("all");
  const [unit, setUnit]             = useState<Unit>("mm");

  // Compare pills (0–3; all deselectable)
  const [compareEstates, setCompareEstates] = useState<string[]>([]);

  // Chart grouping
  const [grouping, setGrouping] = useState<Grouping>("monthly");

  // Modals
  const [showUpload, setShowUpload]   = useState(false);
  const [editRecord, setEditRecord]   = useState<RainfallRecord | null | undefined>(undefined);

  // Records table
  const [showRecords, setShowRecords] = useState(false);
  const [recordPage, setRecordPage]   = useState(0);
  const PER_PAGE = 20;

  // Weather
  const [weather, setWeather] = useState<(WeatherData | null)[]>([null, null, null]);

  // Theme (CSS vars — fixed defaults)
  const theme = THEME_DEFAULT;

  // Last updated
  const [maxDataDate, setMaxDataDate]   = useState<string>("");
  const [lastRefreshed, setLastRefreshed] = useState<string>("");


  // ─── Clock ────────────────────────────────────────────────────────────────
  useEffect(() => {
    const tick = () => {
      const now = new Date();
      setClock(now.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }));
      setDateStr(now.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" }));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  // ─── Weather fetch ────────────────────────────────────────────────────────
  const fetchWeather = useCallback(async () => {
    const results = await Promise.all(
      WEATHER_LOCATIONS.map(async ({ lat, lon }) => {
        try {
          const res = await fetch(
            `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
            `&current=temperature_2m,relative_humidity_2m,precipitation,weather_code,wind_speed_10m` +
            `&wind_speed_unit=kmh&timezone=Asia%2FKolkata`
          );
          const j = await res.json();
          const c = j.current;
          return {
            temp:     Math.round(c.temperature_2m * 10) / 10,
            humidity: c.relative_humidity_2m,
            precip:   c.precipitation,
            wind:     Math.round(c.wind_speed_10m * 10) / 10,
            code:     c.weather_code,
            desc:     wmoDesc(c.weather_code),
            icon:     wmoIcon(c.weather_code),
          };
        } catch { return null; }
      })
    );
    setWeather(results);
  }, []);

  useEffect(() => {
    fetchWeather();
    const id = setInterval(fetchWeather, 10 * 60 * 1000); // refresh every 10 min
    return () => clearInterval(id);
  }, [fetchWeather]);

  // ─── Load data (paginated — Supabase caps at 1000 rows by default) ──────────
  const loadData = useCallback(async () => {
    setLoading(true);
    let allRows: Row[] = [];
    let from = 0;
    const BATCH = 1000;

    while (true) {
      const { data: rows, error } = await supabase
        .from("rainfall")
        .select("*")
        .order("date", { ascending: true })
        .range(from, from + BATCH - 1);

      if (error || !rows || rows.length === 0) break;

      const normalised: Row[] = rows.map((r) => {
        const [y, m] = r.date.split("-").map(Number);
        return { ...r, year: y, month: m };
      });

      allRows = [...allRows, ...normalised];
      if (rows.length < BATCH) break;
      from += BATCH;
    }

    setData(allRows);
    if (allRows.length > 0) setMaxDataDate(allRows[allRows.length - 1].date);
    setLastRefreshed(new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }));
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // ─── Computed ──────────────────────────────────────────────────────────────
  const val = (r: Row) => unit === "mm" ? r.rainfall_mm : r.inches;
  const unitStr = unit === "mm" ? "mm" : "in";

  const years = useMemo(
    () => [...new Set(data.map((r) => r.year))].sort((a, b) => b - a),
    [data]
  );

  const filtered = useMemo(() => data.filter((r) => {
    if (year !== "all" && r.year !== Number(year)) return false;
    if (month !== "all" && r.month !== Number(month)) return false;
    if (estateFilter !== "all" && r.estate !== estateFilter) return false;
    return true;
  }), [data, year, month, estateFilter]);

  const filteredNoEstate = useMemo(() => data.filter((r) => {
    if (year !== "all" && r.year !== Number(year)) return false;
    if (month !== "all" && r.month !== Number(month)) return false;
    return true;
  }), [data, year, month]);

  // ─── KPIs ──────────────────────────────────────────────────────────────────
  const kpis = useMemo(() => {
    const withRain = filtered.filter((r) => r.rainfall_mm > 0);
    const total    = r1(withRain.reduce((s, r) => s + val(r), 0));
    const maxRow   = withRain.reduce<Row | null>((a, b) => (!a || val(b) > val(a) ? b : a), null);
    const curYear  = new Date().getFullYear();
    const rtd      = r1(data.filter((r) => r.year === curYear && r.rainfall_mm > 0).reduce((s, r) => s + val(r), 0));
    const rainyDates = new Set(withRain.map((r) => r.date));
    const allRainy = [...new Set(data.filter((r) => r.rainfall_mm > 0).map((r) => r.date))].sort();
    const lastRain = allRainy[allRainy.length - 1];
    const dslr     = lastRain ? daysBetween(lastRain, new Date().toISOString().slice(0, 10)) : null;
    return { total, maxRow, rtd, curYear, rainyDays: rainyDates.size, dslr, lastRain };
  }, [filtered, data, unit]);

  // ─── Chart ─────────────────────────────────────────────────────────────────
  const activeEstates = compareEstates.length > 0 ? compareEstates : ESTATES;

  const chartData = useMemo(() => {
    const src = filteredNoEstate.filter((r) => activeEstates.includes(r.estate));
    if (grouping === "daily") {
      const map: Record<string, Record<string, number>> = {};
      src.forEach((r) => {
        if (!map[r.date]) map[r.date] = {};
        map[r.date][r.estate] = (map[r.date][r.estate] ?? 0) + val(r);
      });
      return Object.entries(map).sort((a, b) => a[0].localeCompare(b[0])).slice(-90)
        .map(([d, v]) => ({ name: d.slice(5), ...v }));
    }
    if (grouping === "monthly") {
      const map: Record<string, Record<string, number>> = {};
      src.forEach((r) => {
        const k = `${r.year}-${String(r.month).padStart(2, "0")}`;
        if (!map[k]) map[k] = {};
        map[k][r.estate] = (map[k][r.estate] ?? 0) + val(r);
      });
      return Object.entries(map).sort((a, b) => a[0].localeCompare(b[0]))
        .map(([k, v]) => ({ name: MONTH_SHORT[Number(k.split("-")[1]) - 1], ...v }));
    }
    // yearly
    const map: Record<number, Record<string, number>> = {};
    data.filter((r) => activeEstates.includes(r.estate)).forEach((r) => {
      if (!map[r.year]) map[r.year] = {};
      map[r.year][r.estate] = (map[r.year][r.estate] ?? 0) + val(r);
    });
    return Object.entries(map).sort((a, b) => Number(a[0]) - Number(b[0]))
      .map(([yr, v]) => ({ name: yr, ...v }));
  }, [filteredNoEstate, data, compareEstates, grouping, unit]);

  // ─── Top 10 events ─────────────────────────────────────────────────────────
  const topEvents = useMemo(() =>
    [...filtered].filter((r) => r.rainfall_mm > 0).sort((a, b) => b.rainfall_mm - a.rainfall_mm).slice(0, 10),
    [filtered]
  );
  const maxMm = topEvents[0]?.rainfall_mm ?? 1;

  // ─── Compare cards ─────────────────────────────────────────────────────────
  const compareCards = useMemo(() => {
    const curYear = new Date().getFullYear();
    const allTotals = ESTATES.map((e) => ({
      estate: e,
      total: filteredNoEstate.filter((r) => r.estate === e && r.rainfall_mm > 0).reduce((s, r) => s + val(r), 0),
    })).sort((a, b) => b.total - a.total);

    return compareEstates.map((estate) => {
      const eData    = filteredNoEstate.filter((r) => r.estate === estate);
      const rainyE   = eData.filter((r) => r.rainfall_mm > 0);
      const total    = r1(rainyE.reduce((s, r) => s + val(r), 0));
      const maxEvent = rainyE.reduce<Row | null>((a, b) => (!a || val(b) > val(a) ? b : a), null);
      const rainyDays = new Set(rainyE.map((r) => r.date)).size;
      const avg      = rainyDays > 0 ? r1(total / rainyDays) : 0;
      const allRainy = [...new Set(data.filter((r) => r.estate === estate && r.rainfall_mm > 0).map((r) => r.date))].sort();
      const lastRain = allRainy[allRainy.length - 1];
      const dslr     = lastRain ? daysBetween(lastRain, new Date().toISOString().slice(0, 10)) : null;
      const rtdE     = r1(data.filter((r) => r.estate === estate && r.year === curYear && r.rainfall_mm > 0).reduce((s, r) => s + val(r), 0));
      const rank     = allTotals.findIndex((x) => x.estate === estate) + 1;
      return { estate, total, maxEvent, rainyDays, avg, dslr, lastRain, rtdE, rank };
    });
  }, [compareEstates, filteredNoEstate, data, unit]);

  // ─── Toggle compare ────────────────────────────────────────────────────────
  const toggleCompare = (estate: string) => {
    setCompareEstates((prev) => {
      if (prev.includes(estate)) return prev.filter((e) => e !== estate); // allow deselect to 0
      if (prev.length < 3) return [...prev, estate];
      return [...prev.slice(1), estate]; // slide window when already at 3
    });
  };

  // ─── Records ───────────────────────────────────────────────────────────────
  const sortedRecords = useMemo(() => [...filtered].sort((a, b) => b.date.localeCompare(a.date)), [filtered]);
  const pagedRecords  = sortedRecords.slice(recordPage * PER_PAGE, (recordPage + 1) * PER_PAGE);

  // ─── Dynamic KPI accents from theme ──────────────────────────────────────
  const kpiAccents = useMemo(
    () => [theme.accent, theme.gold, theme.coral, theme.green, theme.purple],
    [theme]
  );

  // ─── Tooltip style ─────────────────────────────────────────────────────────
  const ttStyle = { backgroundColor: "#0a1824", border: "1px solid #162d44", borderRadius: 4, color: "#d1e8f5", fontSize: 11, fontFamily: "var(--font-jetbrains), monospace" };

  if (loading) return (
    <div className={s.page}>
      <div className={s.content} style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "60vh" }}>
        <span style={{ color: "#38bdf8", fontSize: 13, fontFamily: "var(--font-jetbrains), monospace", letterSpacing: "0.2em" }}>LOADING…</span>
      </div>
    </div>
  );

  return (
    <>
      <div className={s.page} style={{
        "--t-bg":      theme.bg,
        "--t-surface": theme.surface,
        "--t-card":    theme.card,
        "--t-border":  theme.border,
        "--t-subtle":  theme.subtle,
        "--t-heading": theme.heading,
        "--t-text":    theme.text,
        "--t-muted":   theme.muted,
        "--t-accent":  theme.accent,
        "--t-gold":    theme.gold,
        "--t-green":   theme.green,
      } as React.CSSProperties}>
        <div className={s.content}>

          {/* ─── Header ─────────────────────────────────────────────────── */}
          <header className={s.header}>
            <div>
              <div className={s.eyebrow}>Meteorological Station Portal</div>
              <h1 className={s.title}>MSP <strong className={s.titleStrong}>Rain Gauge</strong></h1>
            </div>
            <div>
              <div className={s.clockDisplay}>{clock}</div>
              <div className={s.dateDisplay}>{dateStr}</div>
              <div className={s.lastUpdated}>
                Data last updated: <span>{maxDataDate ? fmtDate(maxDataDate) : "—"}</span>
                {lastRefreshed && <span style={{ color: "#2a4a62", marginLeft: 8 }}>· refreshed {lastRefreshed}</span>}
              </div>
            </div>
          </header>

          {/* ─── Weather Strip ──────────────────────────────────────────── */}
          <div className={s.weatherStrip}>
            {WEATHER_LOCATIONS.map(({ name }, i) => {
              const w = weather[i];
              return (
                <div key={name} className={s.weatherCard}>
                  <div className={s.weatherLoc}>{name}</div>
                  {w ? (
                    <div className={s.weatherBody}>
                      <div className={s.weatherLeft}>
                        <WIcon icon={w.icon} size={30} />
                        <div>
                          <div className={s.weatherTemp}>{w.temp}°C</div>
                          <div className={s.weatherDesc}>{w.desc}</div>
                        </div>
                      </div>
                      <div className={s.weatherRight}>
                        <span className={s.weatherStat}><Droplets size={11} />{w.humidity}%</span>
                        <span className={s.weatherStat}><Cloud    size={11} />{w.precip} mm</span>
                        <span className={s.weatherStat}><Wind     size={11} />{w.wind} km/h</span>
                      </div>
                    </div>
                  ) : (
                    <div style={{ color: "#3a6080", fontSize: 11, marginTop: 8 }}>Loading…</div>
                  )}
                </div>
              );
            })}
          </div>

          {/* ─── Controls ───────────────────────────────────────────────── */}
          <div className={s.controlsPanel}>
            <div className={s.ctrlGroup}>
              <label className={s.ctrlLabel}>Year</label>
              <select className={s.ctrlSelect} value={year} onChange={(e) => setYear(e.target.value)}>
                <option value="all">All Years</option>
                {years.map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
            <div className={s.ctrlGroup}>
              <label className={s.ctrlLabel}>Month</label>
              <select className={s.ctrlSelect} value={month} onChange={(e) => setMonth(e.target.value)}>
                <option value="all">All Months</option>
                {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
              </select>
            </div>
            <div className={s.ctrlGroup}>
              <label className={s.ctrlLabel}>Estate</label>
              <select className={s.ctrlSelect} value={estateFilter} onChange={(e) => setEstateFilter(e.target.value)}>
                <option value="all">All Estates</option>
                {ESTATES.map((e) => <option key={e} value={e}>{e}</option>)}
              </select>
            </div>
            <div className={s.ctrlGroup}>
              <label className={s.ctrlLabel}>Unit</label>
              <div className={s.unitToggle}>
                <button className={`${s.unitBtn} ${unit === "mm" ? s.unitBtnActive : ""}`} onClick={() => setUnit("mm")}>mm</button>
                <button className={`${s.unitBtn} ${unit === "in" ? s.unitBtnActive : ""}`} onClick={() => setUnit("in")}>inches</button>
              </div>
            </div>
            <div className={s.ctrlGroup}>
              <label className={s.ctrlLabel}>&nbsp;</label>
              <button className={s.resetBtn} onClick={() => { setYear("all"); setMonth("all"); setEstateFilter("all"); setUnit("mm"); }}>
                ↺ Reset
              </button>
            </div>
            <div style={{ flex: 1 }} />
            <div className={s.ctrlGroup}>
              <label className={s.ctrlLabel}>&nbsp;</label>
              <button className={s.actionBtn} onClick={() => setEditRecord(null)}>
                <Plus size={13} /> Add Record
              </button>
            </div>
            <div className={s.ctrlGroup}>
              <label className={s.ctrlLabel}>&nbsp;</label>
              <button className={s.uploadBtn} onClick={() => setShowUpload(true)}>
                <Upload size={13} /> Upload Excel
              </button>
            </div>
          </div>

          {/* ─── Estate Compare Selector ─────────────────────────────────── */}
          <div className={s.estateSelector}>
            <span className={s.selectorLabel}>Compare Estates — Select up to 3 to highlight in comparison view</span>
            <div className={s.pillsRow}>
              {ESTATES.map((estate) => {
                const active = compareEstates.includes(estate);
                const color  = theme.estates[estate];
                return (
                  <button
                    key={estate}
                    onClick={() => toggleCompare(estate)}
                    className={`${s.pill} ${active ? s.pillActive : s.pillInactive}`}
                    style={{ borderColor: active ? color : "transparent", color: active ? color : "#d1e8f5" }}
                  >
                    <span className={s.pip} style={{ backgroundColor: color }} />
                    {estate}
                  </button>
                );
              })}
            </div>
            <p className={s.compareHint}>Select 1–3 estates · click again to deselect · chart shows all estates when none selected</p>
          </div>

          {/* ─── KPI Cards ──────────────────────────────────────────────── */}
          <div className={s.sectionLabel}>Key Performance Indicators</div>
          <div className={s.kpiGrid}>
            {[
              { icon: "🌧", label: "Total Rainfall",        value: kpis.total,               unit: unitStr,  sub: `${filtered.filter(r=>r.rainfall_mm>0).length} events`,                                    accent: kpiAccents[0] },
              { icon: "🏆", label: "Highest Single Event",  value: kpis.maxRow ? r1(val(kpis.maxRow)) : "—", unit: unitStr, sub: kpis.maxRow ? `${kpis.maxRow.estate} · ${fmtDate(kpis.maxRow.date)}` : "—", accent: kpiAccents[1] },
              { icon: "📅", label: "Rain to Date",          value: kpis.rtd,                 unit: unitStr,  sub: `YTD ${kpis.curYear}`,                                                                    accent: kpiAccents[2] },
              { icon: "☔", label: "Rainy Days",             value: kpis.rainyDays,           unit: "days",   sub: "in selected period",                                                                    accent: kpiAccents[3] },
              { icon: "🕐", label: "Days Since Last Rain",  value: kpis.dslr ?? "—",         unit: kpis.dslr !== null ? "days" : "",  sub: kpis.lastRain ? `last rain ${fmtDate(kpis.lastRain)}` : "—",     accent: kpiAccents[4] },
            ].map(({ icon, label, value, unit: u, sub, accent }) => (
              <div key={label} className={s.kpiCard} style={{ "--accent": accent } as React.CSSProperties}>
                <div className={s.kpiIcon}>{icon}</div>
                <div className={s.kpiLabel}>{label}</div>
                <div className={s.kpiValue}>{value}<span className={s.kpiUnit}>{u}</span></div>
                <div className={s.kpiSub}>{sub}</div>
              </div>
            ))}
          </div>

          {/* ─── Estate Comparison Cards ─────────────────────────────────── */}
          {compareCards.length > 0 && (
            <>
              <div className={s.sectionLabel}>Estate Comparison</div>
              <div className={s.compareGrid}>
                {compareCards.map(({ estate, total, maxEvent, rainyDays, avg, dslr, lastRain, rtdE, rank }) => {
                  const color = theme.estates[estate];
                  return (
                    <div key={estate} className={s.estateCard} style={{ borderColor: `${color}33` }}>
                      <div className={s.estateCardHeader}>
                        <span className={s.estateDot} style={{ backgroundColor: color }} />
                        <span className={s.estateCardName} style={{ color }}>{estate}</span>
                        <span className={s.estateRank}>{MEDALS[rank - 1] ?? `#${rank}`}</span>
                      </div>
                      <div className={s.estateMetrics}>
                        <div className={s.metricItem}>
                          <div className={s.metricLabel}>Total Rainfall</div>
                          <div className={s.metricValue} style={{ color }}>{total}<span className={s.metricUnit}>{unitStr}</span></div>
                          <div className={s.metricSub}>selected period</div>
                        </div>
                        <div className={s.metricItem}>
                          <div className={s.metricLabel}>Highest Event</div>
                          <div className={s.metricValue}>{maxEvent ? r1(val(maxEvent)) : "—"}<span className={s.metricUnit}>{unitStr}</span></div>
                          <div className={s.metricSub}>{maxEvent ? fmtDate(maxEvent.date) : "—"}</div>
                        </div>
                        <div className={s.metricItem}>
                          <div className={s.metricLabel}>Rainy Days</div>
                          <div className={s.metricValue}>{rainyDays}<span className={s.metricUnit}>days</span></div>
                          <div className={s.metricSub}>avg {avg} {unitStr}/day</div>
                        </div>
                        <div className={s.metricItem}>
                          <div className={s.metricLabel}>Rain to Date</div>
                          <div className={s.metricValue}>{rtdE}<span className={s.metricUnit}>{unitStr}</span></div>
                          <div className={s.metricSub}>YTD {new Date().getFullYear()}</div>
                        </div>
                        <div className={s.metricItem} style={{ gridColumn: "1/-1" }}>
                          <div className={s.metricLabel}>Days Since Last Rainfall</div>
                          <div className={s.metricValue} style={{ color }}>{dslr ?? "—"}<span className={s.metricUnit}>days</span></div>
                          <div className={s.metricSub}>{lastRain ? `last rain ${fmtDate(lastRain)}` : "—"}</div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {/* ─── Chart ──────────────────────────────────────────────────── */}
          <div className={s.chartSection}>
            <div className={s.chartHeader}>
              <div>
                <div className={s.chartTitle}>Rainfall Trend</div>
                <div className={s.chartSub}>{grouping.charAt(0).toUpperCase() + grouping.slice(1)} totals · {activeEstates.join(", ")}</div>
              </div>
              <div className={s.chartTabs}>
                {(["daily","monthly","yearly"] as Grouping[]).map((g) => (
                  <button key={g} className={`${s.chartTab} ${grouping === g ? s.chartTabActive : ""}`} onClick={() => setGrouping(g)}>{g}</button>
                ))}
              </div>
            </div>
            {data.length === 0 ? (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 260, color: "#3a6080", fontSize: 12, letterSpacing: "0.1em" }}>
                NO DATA — UPLOAD YOUR EXCEL TO BEGIN
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={340}>
                {grouping === "monthly" ? (
                  <LineChart data={chartData} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(56,189,248,0.06)" />
                    <XAxis dataKey="name" stroke="#3a6080" fontSize={10} fontFamily="var(--font-jetbrains), monospace" />
                    <YAxis stroke="#3a6080" fontSize={10} fontFamily="var(--font-jetbrains), monospace" />
                    <Tooltip contentStyle={ttStyle} />
                    <Legend wrapperStyle={{ fontSize: 10, fontFamily: "var(--font-jetbrains), monospace" }} />
                    {activeEstates.map((e) => (
                      <Line key={e} type="monotone" dataKey={e} stroke={theme.estates[e]} strokeWidth={2} dot={{ r: 2 }} activeDot={{ r: 4 }} connectNulls />
                    ))}
                  </LineChart>
                ) : (
                  <BarChart data={chartData} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(56,189,248,0.06)" />
                    <XAxis dataKey="name" stroke="#3a6080" fontSize={10} fontFamily="var(--font-jetbrains), monospace" />
                    <YAxis stroke="#3a6080" fontSize={10} fontFamily="var(--font-jetbrains), monospace" />
                    <Tooltip contentStyle={ttStyle} />
                    <Legend wrapperStyle={{ fontSize: 10, fontFamily: "var(--font-jetbrains), monospace" }} />
                    {activeEstates.map((e) => (
                      <Bar key={e} dataKey={e} fill={theme.estates[e]} radius={[3, 3, 0, 0]} />
                    ))}
                  </BarChart>
                )}
              </ResponsiveContainer>
            )}
          </div>

          {/* ─── Top 10 Events ──────────────────────────────────────────── */}
          <div className={s.tableSection}>
            <div className={s.sectionLabel} style={{ marginBottom: 20 }}>Top 10 Highest Rainfall Events</div>
            <table className={s.tableEl}>
              <thead>
                <tr>
                  <th style={{ width: 32 }}>#</th>
                  <th>Date</th>
                  <th>Estate</th>
                  <th style={{ textAlign: "right" }}>Rainfall</th>
                  <th style={{ textAlign: "right" }}>Edit</th>
                </tr>
              </thead>
              <tbody>
                {topEvents.length === 0 ? (
                  <tr><td colSpan={5} style={{ textAlign: "center", color: "#3a6080", padding: "32px 0" }}>No data for selected filters</td></tr>
                ) : topEvents.map((r, i) => (
                  <tr key={r.id}>
                    <td>
                      <span className={`${s.rankBadge} ${i < 3 ? s.rankBadgeTop : ""}`}>
                        {i < 3 ? MEDALS[i] : i + 1}
                      </span>
                    </td>
                    <td style={{ color: "#7a9bb8" }}>{fmtDate(r.date)}</td>
                    <td>
                      <span className={s.estateTag}>
                        <span className={s.tagDot} style={{ backgroundColor: theme.estates[r.estate] }} />
                        <span style={{ color: theme.estates[r.estate] }}>{r.estate}</span>
                      </span>
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <span className={s.rainfallBar}>
                        <span className={s.barFill} style={{ width: `${(r.rainfall_mm / maxMm) * 80}px` }} />
                        <span style={{ color: "#38bdf8" }}>{unit === "mm" ? r.rainfall_mm : r.inches.toFixed(3)}</span>
                        <span style={{ color: "#3a6080", fontSize: 10 }}>{unitStr}</span>
                      </span>
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <button
                        onClick={() => setEditRecord({ id: r.id, date: r.date, estate: r.estate, rainfall_mm: r.rainfall_mm, inches: r.inches })}
                        style={{ background: "none", border: "none", color: "#3a6080", cursor: "pointer", padding: "2px 4px" }}
                        onMouseOver={(e) => (e.currentTarget.style.color = "#38bdf8")}
                        onMouseOut={(e) => (e.currentTarget.style.color = "#3a6080")}
                      >
                        <Pencil size={13} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* ─── Annual Totals ───────────────────────────────────────────── */}
          <div className={s.sectionLabel}>Annual Totals</div>
          <div className={s.yearlyGrid}>
            {years.map((y) => {
              const yTotal = r1(data.filter((r) => r.year === y && r.rainfall_mm > 0 && (estateFilter === "all" || r.estate === estateFilter)).reduce((s, r) => s + val(r), 0));
              const isSelected = String(y) === year;
              return (
                <button key={y} className={`${s.yearCard} ${isSelected ? s.yearCardSelected : ""}`}
                  onClick={() => { setYear(isSelected ? "all" : String(y)); setGrouping("monthly"); }}>
                  <div className={s.yearNum}>{y}</div>
                  <div className={s.yearTotal}>{yTotal} {unitStr}</div>
                </button>
              );
            })}
          </div>

          {/* ─── All Records ─────────────────────────────────────────────── */}
          <div className={s.recordsSection}>
            <button className={s.recordsToggle} onClick={() => setShowRecords((v) => !v)}>
              <div style={{ textAlign: "left" }}>
                <div style={{ fontSize: 13, fontWeight: 500 }}>All Records</div>
                <div style={{ fontSize: 10, color: "#3a6080", marginTop: 2 }}>{filtered.length.toLocaleString()} records · click to {showRecords ? "hide" : "expand"}</div>
              </div>
              <span style={{ color: "#3a6080", fontSize: 11 }}>{showRecords ? "▲" : "▼"}</span>
            </button>
            {showRecords && (
              <>
                <div style={{ overflowX: "auto" }}>
                  <table className={s.tableEl} style={{ padding: "0 24px" }}>
                    <thead>
                      <tr>
                        <th style={{ paddingLeft: 24 }}>Date</th>
                        <th>Estate</th>
                        <th style={{ textAlign: "right" }}>mm</th>
                        <th style={{ textAlign: "right" }}>Inches</th>
                        <th style={{ textAlign: "right", paddingRight: 24 }}>Edit</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pagedRecords.map((r) => (
                        <tr key={r.id}>
                          <td style={{ paddingLeft: 24, color: "#7a9bb8" }}>{fmtDate(r.date)}</td>
                          <td>
                            <span className={s.estateTag}>
                              <span className={s.tagDot} style={{ backgroundColor: theme.estates[r.estate] }} />
                              <span style={{ color: theme.estates[r.estate] }}>{r.estate}</span>
                            </span>
                          </td>
                          <td style={{ textAlign: "right", color: "#38bdf8" }}>{r.rainfall_mm}</td>
                          <td style={{ textAlign: "right", color: "#3a6080" }}>{r.inches.toFixed(3)}</td>
                          <td style={{ textAlign: "right", paddingRight: 24 }}>
                            <button
                              onClick={() => setEditRecord({ id: r.id, date: r.date, estate: r.estate, rainfall_mm: r.rainfall_mm, inches: r.inches })}
                              style={{ background: "none", border: "none", color: "#3a6080", cursor: "pointer" }}
                              onMouseOver={(e) => (e.currentTarget.style.color = "#38bdf8")}
                              onMouseOut={(e) => (e.currentTarget.style.color = "#3a6080")}
                            >
                              <Pencil size={13} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className={s.paginationRow}>
                  <span>{recordPage * PER_PAGE + 1}–{Math.min((recordPage + 1) * PER_PAGE, sortedRecords.length)} of {sortedRecords.length.toLocaleString()}</span>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button className={s.pageBtn} disabled={recordPage === 0} onClick={() => setRecordPage((p) => p - 1)}>← Prev</button>
                    <button className={s.pageBtn} disabled={(recordPage + 1) * PER_PAGE >= sortedRecords.length} onClick={() => setRecordPage((p) => p + 1)}>Next →</button>
                  </div>
                </div>
              </>
            )}
          </div>

        </div>
      </div>

      {/* ─── Modals ──────────────────────────────────────────────────────── */}
      {showUpload && <UploadModal onClose={() => setShowUpload(false)} onSuccess={loadData} />}
      {editRecord !== undefined && <RecordModal record={editRecord} onClose={() => setEditRecord(undefined)} onSuccess={loadData} />}

    </>
  );
}
