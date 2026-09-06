"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
const supabase = createClient();
import {
 LineChart, Line, BarChart, Bar, XAxis, YAxis,
 CartesianGrid, Tooltip, ResponsiveContainer, Legend,
 Cell, ScatterChart, Scatter, ZAxis,
} from "recharts";
import s from "./infographic.module.css";

// ── constants ────────────────────────────────────────────────────────────────
const ESTATES = ["Gowri", "Hidden Falls", "Moganad", "Orchardale", "Stanmore", "Vyapurikuttai"] as const;

const ESTATE_COLORS: Record<string, string> = {
 Gowri: "#2563eb",
 "Hidden Falls": "#dc2626",
 Moganad: "#059669",
 Orchardale: "#d97706",
 Stanmore: "#7c3aed",
 Vyapurikuttai: "#ea580c",
};

const MONTH_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];

// ── types ────────────────────────────────────────────────────────────────────
type Row = { id: number; date: string; estate: string; rainfall_mm: number; inches: number };
const yr = (d: string) => new Date(d).getFullYear();
const mo = (d: string) => new Date(d).getMonth() + 1;

// ── helpers ──────────────────────────────────────────────────────────────────
const r1 = (n: number) => Math.round(n * 10) / 10;
const rnd = (n: number, d = 1) => Math.round(n * 10**d) / 10**d;

function daysBetween(a: string, b: string) {
 const da = new Date(a), db = new Date(b);
 return Math.round((db.getTime() - da.getTime()) / 864e5);
}

// chart theme
const TT_STYLE = {
 background: "rgba(255,255,255,0.98)",
 border: "1px solid #e5dfc8",
 borderRadius: 8,
 fontSize: 12,
 fontFamily: "var(--t-font, 'Exo 2', system-ui, sans-serif)",
 color: "#1a1a1a",
};
const GRID_COLOR = "#e5dfc8";
const AXIS_TICK_LIGHT = "#6b7280";

// ══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ══════════════════════════════════════════════════════════════════════════════
export default function RainfallInfographic() {
 const [data, setData] = useState<Row[]>([]);
 const [loading, setLoading] = useState(true);
 const [selectedEstate, setSelectedEstate] = useState<string>("all");
 const [selectedYear, setSelectedYear] = useState<string>("all");
 const [selectedMonth, setSelectedMonth] = useState<string>("all");
 const [unit, setUnit] = useState<"mm" | "in">("mm");
 const [tlYear, setTlYear] = useState<number>(new Date().getFullYear());
 const [tlPeriod, setTlPeriod] = useState<"month" | "quarter" | "half" | "year">("month");
 const [tlMonth, setTlMonth] = useState<number>(new Date().getMonth());
 const IN_FACTOR = 25.4;
 const toDisplay = (mm: number) => unit === "mm" ? mm : mm / IN_FACTOR;

 // ── live fetch ─────────────────────────────────────────────────────────────
 useEffect(() => {
 let cancelled = false;
 setLoading(true);
 (async () => {
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
 allRows = [...allRows, ...rows];
 if (rows.length < BATCH) break;
 from += BATCH;
 }
 if (!cancelled) { setData(allRows); setLoading(false); }
 })();
 return () => { cancelled = true; };
 }, []);

 // ── year / month lists ─────────────────────────────────────────────────────
 const yearsList = useMemo(() => {
 const raw = [...new Set(data.map(r => yr(r.date)))].sort((a, b) => b - a);
 console.log("[rainfall] data rows:", data.length, "yearsList:", raw, "sample date:", data[0]?.date);
 return raw;
 }, [data]);

 // When year changes, reset month and rebuild months list from that year
 // Always show all 12 months
 const monthsList = useMemo(() => [1,2,3,4,5,6,7,8,9,10,11,12], []);

 // ── triple-filtered dataset (the source of truth for all charts) ───────────
 const filteredData = useMemo(() => {
 let result = data;
 if (selectedEstate !== "all") result = result.filter(r => r.estate === selectedEstate);
 if (selectedYear !== "all") result = result.filter(r => yr(r.date) === Number(selectedYear));
 if (selectedMonth !== "all") result = result.filter(r => mo(r.date) === Number(selectedMonth));
 return result;
 }, [data, selectedEstate, selectedYear, selectedMonth]);

 // ── display-ready data (unit conversion) ────────────────────────────────────
 const displayData = useMemo(() => filteredData.map(r => ({ ...r, rainfall_mm: toDisplay(r.rainfall_mm) })), [filteredData, unit]);

 // ── seasonal profile data ───────────────────────────────────────────────────
 const seasonalData = useMemo(() => {
 const SEASONS = [
 { key: "sw", label: "SW Monsoon", months: [6,7,8,9], emoji: "🌧️", color: "#2563eb", defaultNote: "Peak Jul–Aug · Primary crop cycle" },
 { key: "ne", label: "NE Monsoon", months: [10,11,12], emoji: "🌦️", color: "#0891b2", defaultNote: "Oct–Nov peak · Post-harvest" },
 { key: "winter", label: "Winter", months: [1,2], emoji: "☀️", color: "#d97706", defaultNote: "Minimal rain · Dormant season" },
 { key: "summer", label: "Summer", months: [3,4,5], emoji: "🔥", color: "#dc2626", defaultNote: "Dry spells · Pre-monsoon prep" },
 ];
 return SEASONS.map(s => {
 const monthlyTotals: Record<number, number> = {};
 s.months.forEach(m => { monthlyTotals[m] = 0; });
 filteredData.forEach(r => {
 const m = mo(r.date);
 if (s.months.includes(m)) monthlyTotals[m] = (monthlyTotals[m] ?? 0) + r.rainfall_mm;
 });
 const total = Object.values(monthlyTotals).reduce((a, b) => a + b, 0);
 const wetMonths = s.months.filter(m => monthlyTotals[m] > 0);
 const monthLabels: Record<number, string> = {1:"Jan",2:"Feb",3:"Mar",4:"Apr",5:"May",6:"Jun",7:"Jul",8:"Aug",9:"Sep",10:"Oct",11:"Nov",12:"Dec"};
 const monthsStr = wetMonths.length
 ? wetMonths.map(m => `${monthLabels[m]} (${Math.round(monthlyTotals[m])}${unit})`).join(" · ")
 : "No rain";
 return {
 ...s,
 total: Math.round(total),
 monthsStr,
 note: wetMonths.length > 0 && monthsStr !== "No rain"
 ? `${wetMonths.length} wet month${wetMonths.length > 1 ? "s" : ""}`
 : s.defaultNote,
 };
 });
}, [filteredData, unit]);

 // ── estate stats (always computed from full data, estate-only filter) ───────
 const estateStats = useMemo(() => {
 const now = new Date();
 const curYear = now.getFullYear();
 const source = filteredData;

 return ESTATES.map(estate => {
 const eData = filteredData.filter(r => r.estate === estate && r.rainfall_mm > 0);
 const total = eData.reduce((s, r) => s + r.rainfall_mm, 0);
 const rainyDays = new Set(eData.map(r => r.date)).size;

 const monthly: Record<number, number> = {};
 eData.forEach(r => { monthly[mo(r.date)] = (monthly[mo(r.date)] ?? 0) + r.rainfall_mm; });

 let peakMonth = 0, peakMm = 0;
 Object.entries(monthly).forEach(([m, v]) => { if (v > peakMm) { peakMm = v; peakMonth = Number(m); } });

 const seasonal: Record<number, number> = {};
 eData.forEach(r => {
 const sKey =  mo(r.date) >= 6 ? 0 :  mo(r.date) >= 3 ? 1 :  mo(r.date) >= 10 ? 2 : 3;
 seasonal[sKey] = (seasonal[sKey] ?? 0) + r.rainfall_mm;
 });

 const dates = eData.map(r => r.date).sort();
 let maxDry = 0, totalDryDays = 0;
 for (let i = 1; i < dates.length; i++) {
 const gap = daysBetween(dates[i-1], dates[i]);
 if (gap > 1) { totalDryDays += gap - 1; maxDry = Math.max(maxDry, gap - 1); }
 }

 const curTotal = eData.filter(r =>  yr(r.date) === curYear).reduce((s, r) => s + r.rainfall_mm, 0);
 const priorTotal = eData.filter(r =>  yr(r.date) === curYear - 1 && r.estate === estate).reduce((s, r) => s + r.rainfall_mm, 0);
 const yoyDelta = priorTotal > 0 ? rnd(((curTotal - priorTotal) / priorTotal) * 100) : null;

 const vals = Object.values(monthly).filter(v => v > 0);
 const mean = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
 const stdDev = vals.length ? Math.sqrt(vals.reduce((s, v) => s + (v - mean)**2, 0) / vals.length) : 0;
 const variationCoeff = mean > 0 ? rnd(stdDev / mean, 2) : 0;

 return { estate, total: r1(total), rainyDays, peakMonth, peakMm: rnd(peakMm), seasonal, maxDry, yoyDelta, variationCoeff, mean: rnd(mean) };
 }).sort((a, b) => b.total - a.total);
 }, [data, selectedEstate, selectedYear, selectedMonth]);

 // ── scatter data ────────────────────────────────────────────────────────────
 const scatterData = useMemo(() => estateStats.map(s => ({
 x: s.total, y: s.variationCoeff, z: s.rainyDays, estate: s.estate,
 })), [estateStats]);

 // ── dry streaks ────────────────────────────────────────────────────────────
 const dryStreakData = useMemo(() => {
 return ESTATES.map(estate => {
 const dates = filteredData.filter(r => r.estate === estate && r.rainfall_mm > 0).map(r => r.date).sort();
 const streaks: number[] = [];
 for (let i = 1; i < dates.length; i++) {
 const gap = daysBetween(dates[i - 1], dates[i]) - 1;
 if (gap > 0) streaks.push(gap);
 }
 return {
 estate,
 maxStreak: streaks.length ? Math.max(...streaks) : 0,
 avgStreak: streaks.length ? rnd(streaks.reduce((a, b) => a + b, 0) / streaks.length) : 0,
 count: streaks.length,
 dist: {},
 };
 });
 }, [filteredData]);

 // ── heatmap ────────────────────────────────────────────────────────────────
 const heatmapData = useMemo(() => {
 const map: Record<string, Record<string, number>> = {};
 filteredData.forEach(r => {
 if (!map[r.estate]) map[r.estate] = {};
 const key = `${MONTH_SHORT[ mo(r.date) - 1]}-${ yr(r.date)}`;
 map[r.estate][key] = (map[r.estate][key] ?? 0) + r.rainfall_mm;
 });
 return map;
 }, [filteredData]);

 // ── monthly matrix ─────────────────────────────────────────────────────────
 const monthlyMatrix = useMemo(() => {
 const years = [...new Set(filteredData.map(r =>  yr(r.date)))].sort((a, b) => b - a);
 return ESTATES.map(estate => {
 const row: Record<string, number | string> = { estate };
 years.forEach(y => {
 const total = filteredData.filter(r => r.estate === estate &&  yr(r.date) === y).reduce((s, r) => s + r.rainfall_mm, 0);
 row[String(y)] = rnd(total);
 });
 const last3 = years.slice(0, 3);
 const avg = last3.length ? rnd(last3.reduce((s, y) => s + (row[String(y)] as number), 0) / last3.length) : 0;
 row.avg = avg;
 return row;
 });
 }, [filteredData]);

 // ══════════════════════════════════════════════════════════════════════════
 // LOAD STATE
 // ══════════════════════════════════════════════════════════════════════════
 if (loading) {
 return (
 <div className={s.loadingWrap}>
 <div className={s.spinner} />
 <p>Loading rainfall data…</p>
 </div>
 );
 }

 if (!data.length) {
 return (
 <div className={s.loadingWrap}>
 <p>No rainfall data found.</p>
 </div>
 );
 }

 // active filter label helper
 const filterLabel = () => {
 const parts: string[] = [];
 if (selectedEstate !== "all") parts.push(selectedEstate);
 if (selectedYear !== "all") parts.push(selectedYear.toString());
 if (selectedMonth !== "all") parts.push(MONTH_SHORT[Number(selectedMonth) - 1]);
 return parts.length ? `· Filtered: ${parts.join(" · ")}` : "";
 };

 return (
 <div className={s.root}>

 {/* ── Header ─────────────────────────────────────────────────────────── */}
 <div className={s.header}>
 <div>
 <h1 className={s.title}>MSP Coffee</h1>
 <p className={s.subtitle}>Rainfall Infographic · All Estates · Live Data {filterLabel()} · {unit === "mm" ? "mm" : "inches"}</p>
 </div>
 <div className={s.headerKpis}>
 <div className={s.hKpi}>
 <span className={s.hKpiVal}>{r1(displayData.filter(r=>r.rainfall_mm>0).reduce((s,r)=>s+r.rainfall_mm,0)/1000).toFixed(1)}k</span>
 <span className={s.hKpiLbl}>Total {unit} logged</span>
 </div>
 <div className={s.hKpi}>
 <span className={s.hKpiVal}>{new Set(filteredData.map(r=>r.date)).size}</span>
 <span className={s.hKpiLbl}>Rainy days</span>
 </div>
 <div className={s.hKpi}>
 <span className={s.hKpiVal}>{yearsList.length ? `${yearsList[yearsList.length-1]}–${yearsList[0]}` : "—"}</span>
 <span className={s.hKpiLbl}>Data range</span>
 </div>
 </div>
 </div>

 {/* ── Year / Month filter bar ────────────────────────────────────────── */}
 <div className={s.ymFilterBar}>
 <div className={s.ymSelectWrap}>
 <label className={s.ymLabel} htmlFor="year-select">Year</label>
 <select
 id="year-select"
 className={s.ymSelect}
 value={selectedYear}
 onChange={e => { setSelectedYear(e.target.value); setSelectedMonth("all"); }}
 >
 <option value="all">All Years</option>
 {yearsList.map(y => <option key={y} value={String(y)}>{y}</option>)}
 </select>
 </div>
 <div className={s.ymSelectWrap}>
 <label className={s.ymLabel} htmlFor="month-select">Month</label>
 <select
 id="month-select"
 className={s.ymSelect}
 value={selectedMonth}
 onChange={e => setSelectedMonth(e.target.value)}
 disabled={selectedYear === "all"}
 >
 <option value="all">All Months</option>
 {monthsList.map(m => <option key={m} value={String(m)}>{MONTH_NAMES[m - 1]}</option>)}
 </select>
 </div>
 <div className={s.ymSelectWrap}>
 <label className={s.ymLabel}>Unit</label>
 <div className={s.unitToggle}>
 <button className={`${s.unitBtn} ${unit === "mm" ? s.unitBtnActive : ""}`}
 onClick={() => setUnit("mm")}>mm</button>
 <button className={`${s.unitBtn} ${unit === "in" ? s.unitBtnActive : ""}`}
 onClick={() => setUnit("in")}>in</button>
 </div>
 </div>
 {(selectedYear !== "all" || selectedMonth !== "all") && (
 <button className={s.clearFilterBtn} onClick={() => { setSelectedYear("all"); setSelectedMonth("all"); }}>
 Clear year/month filter
 </button>
 )}
 </div>

 {/* ── Estate selector ────────────────────────────────────────────────── */}
 <div className={s.estateFilter}>
 <button className={`${s.filterBtn} ${selectedEstate === "all" ? s.filterBtnActive : ""}`}
 style={selectedEstate === "all" ? { background: "#6b7280", color: "#fff", borderColor: "#6b7280" } : {}}
 onClick={() => setSelectedEstate("all")}>All Estates</button>
 {ESTATES.map(e => (
 <button key={e} className={`${s.filterBtn} ${selectedEstate === e ? s.filterBtnActive : ""}`}
 style={selectedEstate === e ? { background: ESTATE_COLORS[e], color: "#000", borderColor: ESTATE_COLORS[e] } : {}}
 onClick={() => setSelectedEstate(e)}>
 <span className={s.filterDot} style={{ background: ESTATE_COLORS[e] }} />{e}
 </button>
 ))}
 </div>

 {/* ══════════════════════════════════════════════════════════════════════ */}
 {/* ROW 1 — KPI cards + Seasonal Profile */}
 {/* ══════════════════════════════════════════════════════════════════════ */}
 <div className={s.row2}>
 <div className={s.card}>
 <div className={s.cardLabel}>Estate Summary</div>
 <div className={s.kpiGrid}>
 {estateStats.map((est, i) => (
 <div key={est.estate} className={s.kpiItem} style={{ borderLeftColor: ESTATE_COLORS[est.estate] }}>
 <div className={s.kpiTop}>
 <span className={s.kpiRank}>{i + 1}</span>
 <span className={s.kpiEstate} style={{ color: ESTATE_COLORS[est.estate] }}>{est.estate}</span>
 </div>
 <div className={s.kpiMid}>
 <span className={s.kpiTotal}>{est.total}<small>{unit}</small></span>
 {est.yoyDelta !== null && (
 <span className={`${s.kpiYoy} ${est.yoyDelta >= 0 ? s.kpiUp : s.kpiDown}`}>
 {est.yoyDelta >= 0 ? "▲" : "▼"} {Math.abs(est.yoyDelta)}%
 </span>
 )}
 </div>
 <div className={s.kpiBot}>
 <span>{est.rainyDays} rainy days</span>
 <span>Peak: {est.peakMonth ? MONTH_SHORT[est.peakMonth - 1] : "—"} ({est.peakMm}{unit})</span>
 </div>
 </div>
 ))}
 </div>
 </div>

 <div className={s.card}>
 <div className={s.cardLabel}>Seasonal Profile</div>
 <div className={s.seasonGrid}>
 {seasonalData.map(season => (
 <div key={season.key} className={s.seasonCard} style={{ borderTopColor: season.color }}>
 <div className={s.seasonEmoji}>{season.emoji}</div>
 <div className={s.seasonName}>{season.label}</div>
 <div className={s.seasonMonths} style={{ color: season.color }}>{season.total > 0 ? `${season.total}${unit}` : "—"}</div>
 <div className={s.seasonTotal}>Season total</div>
 <div className={s.seasonNote}>{season.monthsStr}</div>
 </div>
 ))}
 </div>
 </div>
 </div>

 {/* ══════════════════════════════════════════════════════════════════════ */}
 {/* ROW 2 — Estate Timeline Cards */}
 {/* ══════════════════════════════════════════════════════════════════════ */}
 <div className={s.timelineSection}>
 <div className={s.cardLabel} style={{ marginBottom: 10 }}>Estate Rainfall — Period Comparison</div>
 <div className={s.ymFilterBar}>
 <div className={s.ymSelectWrap}>
 <label className={s.ymLabel} htmlFor="tl-year">Year</label>
 <select id="tl-year" className={s.ymSelect} value={tlYear} onChange={e => setTlYear(+e.target.value)}>
 {yearsList.map(y => <option key={y} value={y}>{y}</option>)}
 </select>
 </div>
 <div className={s.ymSelectWrap}>
 <label className={s.ymLabel} htmlFor="tl-period">Period</label>
 <select id="tl-period" className={s.ymSelect} value={tlPeriod} onChange={e => setTlPeriod(e.target.value as "month" | "quarter" | "half" | "year")}>
 <option value="month">Month</option>
 <option value="quarter">Quarter</option>
 <option value="half">Half year</option>
 <option value="year">Full year</option>
 </select>
 </div>
 {tlPeriod !== "year" && (
 <div className={s.ymSelectWrap}>
 <label className={s.ymLabel} htmlFor="tl-month">Month</label>
 <select id="tl-month" className={s.ymSelect} value={tlMonth} onChange={e => setTlMonth(+e.target.value)}>
 {MONTH_NAMES.map((n, i) => <option key={i} value={i}>{n}</option>)}
 </select>
 </div>
 )}
 <div className={s.ymSelectWrap}>
 <label className={s.ymLabel}>Unit</label>
 <div className={s.unitToggle}>
 <button className={`${s.unitBtn} ${unit === "mm" ? s.unitBtnActive : ""}`} onClick={() => setUnit("mm")}>mm</button>
 <button className={`${s.unitBtn} ${unit === "in" ? s.unitBtnActive : ""}`} onClick={() => setUnit("in")}>in</button>
 </div>
 </div>
 </div>
 <EstateTimelineRow data={data} year={tlYear} period={tlPeriod} month={tlMonth} unit={unit} estates={ESTATES} estateColors={ESTATE_COLORS} />
 </div>

 {/* ══════════════════════════════════════════════════════════════════════ */}
 {/* ROW 3 — Monthly line chart + Annual bar chart */}
 {/* ══════════════════════════════════════════════════════════════════════ */}
 <div className={s.row2}>
 <div className={`${s.card} ${s.cardWide}`}>
 <div className={s.cardLabel}>Monthly Rainfall by Estate</div>
 <MonthlyLine data={displayData} selected={selectedEstate} unit={unit} />
 </div>
 <div className={s.card}>
 <div className={s.cardLabel}>Annual Totals — Year by Year</div>
 <AnnualBarChart data={displayData} selected={selectedEstate} unit={unit} />
 </div>
 </div>

 {/* ══════════════════════════════════════════════════════════════════════ */}
 {/* ROW 3 — Heatmap + Scatter */}
 {/* ══════════════════════════════════════════════════════════════════════ */}
 <div className={s.row2}>
 <div className={`${s.card} ${s.cardWide}`}>
 <div className={s.cardLabel}>Rainfall Heatmap — Estate × Month ({unit})</div>
 <RainfallHeatmap data={displayData} selected={selectedEstate} unit={unit} />
 </div>
 <div className={s.card}>
 <div className={s.cardLabel}>Estate Rainfall Pattern</div>
 <p className={s.cardHint}>Each dot is an estate. X = total rainfall, Y = seasonal variation. Bigger circle = more rainy days.</p>
 <PatternScatter data={estateStats} scatterData={scatterData} unit={unit} />
 </div>
 </div>

 {/* ══════════════════════════════════════════════════════════════════════ */}
 {/* ROW 4 — Dry streak + Seasonal stacked */}
 {/* ══════════════════════════════════════════════════════════════════════ */}
 <div className={s.row2}>
 <div className={s.card}>
 <div className={s.cardLabel}>Dry Streak Analysis</div>
 <p className={s.cardHint}>Longest consecutive dry days per estate. Higher = longer dry spells.</p>
 <DryStreakChart data={dryStreakData} />
 </div>
 <div className={`${s.card} ${s.cardWide}`}>
 <div className={s.cardLabel}>Seasonal Rainfall Breakdown by Estate</div>
 <SeasonalStacked data={displayData} unit={unit} />
 </div>
 </div>

 {/* ══════════════════════════════════════════════════════════════════════ */}
 {/* ROW 5 — Matrix table + YoY delta */}
 {/* ══════════════════════════════════════════════════════════════════════ */}
 <div className={s.row2}>
 <div className={`${s.card} ${s.cardWide}`}>
 <div className={s.cardLabel}>Estate Comparison Matrix</div>
 <div className={s.tableWrap}>
 <table className={s.cmpTable}>
 <thead>
 <tr>
 <th>Rank</th><th>Estate</th><th>Total ({unit})</th><th>Rainy Days</th>
 <th>Peak Month</th><th>Peak ({unit})</th><th>YoY Δ</th><th>Variation</th>
 </tr>
 </thead>
 <tbody>
 {estateStats.map((est, i) => (
 <tr key={est.estate}>
 <td><span className={s.rankBadge}>{i + 1}</span></td>
 <td><span className={s.cmpDot} style={{ background: ESTATE_COLORS[est.estate] }} />{est.estate}</td>
 <td className={s.numCell}>{est.total}</td>
 <td className={s.numCell}>{est.rainyDays}</td>
 <td>{est.peakMonth ? MONTH_SHORT[est.peakMonth - 1] : "—"}</td>
 <td className={s.numCell}>{est.peakMm}</td>
 <td className={s.numCell}>
 {est.yoyDelta !== null
 ? <span className={s.yoyVal + " " + (est.yoyDelta >= 0 ? s.kpiUp : s.kpiDown)}>
 {est.yoyDelta >= 0 ? "▲" : "▼"} {Math.abs(est.yoyDelta)}%
 </span>
 : "—"}
 </td>
 <td className={s.numCell}>{est.variationCoeff}</td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>
 <div className={s.sourceNote}>Data sourced live from Supabase `rainfall` table. YoY Δ compares current year to prior year.</div>
 </div>
 <div className={s.card}>
 <div className={s.cardLabel}>Year-over-Year Change</div>
 <YoYDeltaChart estateStats={estateStats} />
 </div>
 </div>

 {/* footer */}
 <div className={s.footer}>
 MSP Coffee Rainfall Infographic · Generated {new Date().toLocaleDateString("en-IN")}
 </div>
 </div>
 );
}

// ══════════════════════════════════════════════════════════════════════════════
// SUB-COMPONENTS
// ══════════════════════════════════════════════════════════════════════════════

function MonthlyLine({ data, selected, unit }: { data: Row[]; selected: string; unit: string }) {
 const chartData = useMemo(() => {
 const estates: readonly string[] = selected === "all" ? ESTATES : [selected];
 const map: Record<string, Record<string, number>> = {};
 data.forEach(r => {
 if (!estates.includes(r.estate)) return;
 const k = `${ yr(r.date)}-${String( mo(r.date)).padStart(2, "0")}`;
 if (!map[k]) map[k] = {};
 map[k][r.estate] = (map[k][r.estate] ?? 0) + r.rainfall_mm;
 });
 return Object.entries(map)
 .sort(([a], [b]) => a.localeCompare(b))
 .map(([k, v]) => {
 const [, mo] = k.split("-");
 return { name: `${MONTH_SHORT[Number(mo) - 1]}`, ...v };
 });
 }, [data, selected]);

 const activeEstates: readonly string[] = selected === "all" ? ESTATES : [selected];

 return (
 <ResponsiveContainer width="100%" height={280}>
 <LineChart data={chartData}>
 <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} />
 <XAxis dataKey="name" tick={{ fontSize: 11, fill: AXIS_TICK_LIGHT }} />
 <YAxis tick={{ fontSize: 11, fill: AXIS_TICK_LIGHT }} unit={unit} />
 <Tooltip contentStyle={TT_STYLE} labelStyle={{ color: "#1b4a1b", fontWeight: 700 }} />
 <Legend wrapperStyle={{ fontSize: 11 }} />
 {activeEstates.map(e => (
 <Line key={e} type="monotone" dataKey={e} stroke={ESTATE_COLORS[e]} strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
 ))}
 </LineChart>
 </ResponsiveContainer>
 );
}

function AnnualBarChart({ data, selected, unit }: { data: Row[]; selected: string; unit: string }) {
 const chartData = useMemo(() => {
 const years = [...new Set(data.map(r =>  yr(r.date)))].sort((a, b) => b - a);
 const src = selected === "all" ? data : data.filter(r => r.estate === selected);
 return years.map(y => {
 const row: Record<string, number | string> = { year: String(y) };
 ESTATES.forEach(e => {
 row[e] = rnd(src.filter(r =>  yr(r.date) === y && r.estate === e).reduce((s, r) => s + r.rainfall_mm, 0));
 });
 return row;
 });
 }, [data, selected]);

 return (
 <ResponsiveContainer width="100%" height={280}>
 <BarChart data={chartData}>
 <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} />
 <XAxis dataKey="year" tick={{ fontSize: 11, fill: AXIS_TICK_LIGHT }} />
 <YAxis tick={{ fontSize: 11, fill: AXIS_TICK_LIGHT }} unit={unit} />
 <Tooltip contentStyle={TT_STYLE} labelStyle={{ color: "#1b4a1b", fontWeight: 700 }} />
 <Legend wrapperStyle={{ fontSize: 10 }} />
 {ESTATES.map(e => (
 <Bar key={e} dataKey={e} fill={ESTATE_COLORS[e]} radius={[2, 2, 0, 0]} stackId="a" />
 ))}
 </BarChart>
 </ResponsiveContainer>
 );
}

function RainfallHeatmap({ data, selected, unit }: { data: Row[]; selected: string; unit: string }) {
 const estates: readonly string[] = selected === "all" ? ESTATES : [selected];
 const years = useMemo(() => [...new Set(data.map(r =>  yr(r.date)))].sort((a, b) => b - a).slice(0, 5), [data]);

 const matrix = useMemo(() => {
 const m: Record<string, number> = {};
 data.forEach(r => {
 if (!estates.includes(r.estate)) return;
 const key = `${r.estate}|${ yr(r.date)}-${String( mo(r.date)).padStart(2, "0")}`;
 m[key] = (m[key] ?? 0) + r.rainfall_mm;
 });
 return m;
 }, [data, estates]);

 const allVals = Object.values(matrix);
 const maxVal = allVals.length ? Math.max(...allVals) : 1;

 const cellColor = (v: number) => {
 if (v === 0) return "#f5eedc";
 const t = v / maxVal;
 const r = Math.round(45 + t * (27 - 45));
 const g = Math.round(158 + t * (74 - 158));
 const b = Math.round(74 + t * (31 - 74));
 return `rgb(${r},${g},${b})`;
 };

 const monthRow = (estate: string, year: number) =>
 Array.from({ length: 12 }, (_, i) => {
 const key = `${estate}|${year}-${String(i + 1).padStart(2, "0")}`;
 const v = matrix[key] ?? 0;
 return { month: MONTH_SHORT[i], value: v, color: cellColor(v) };
 });

 return (
 <div className={s.heatWrap}>
 <div className={s.heatHeader}>
 <div className={s.heatCorner}>Estate / Month</div>
 <div className={s.heatMonths}>{MONTH_SHORT.map(m => <div key={m} className={s.heatMonthCell}>{m}</div>)}</div>
 </div>
 {years.map(year => (
 <div key={year} className={s.heatRow}>
 <div className={s.heatYear}>{year}</div>
 {estates.map(estate => (<div key={estate} className={s.heatEstateLabel}>{estate.split(" ")[0]}</div>))}
 <div className={s.heatCells}>
 {estates.map(estate =>
 monthRow(estate, year).map((c, i) => (
 <div key={i} className={s.heatCell} style={{ background: c.color }} title={`${estate} · ${MONTH_SHORT[i]} ${year}: ${c.value}${unit}`}>
 {c.value > 0 && <span className={s.heatVal}>{rnd(c.value)}</span>}
 </div>
 ))
 )}
 </div>
 </div>
 ))}
 <div className={s.heatLegend}>
 <span>Less</span>
 {[0, 0.25, 0.5, 0.75, 1].map(t => (<div key={t} className={s.heatSwatch} style={{ background: cellColor(maxVal * t) }} />))}
 <span>More</span>
 </div>
 </div>
 );
}

function PatternScatter({ data, scatterData, unit }: { data: Array<{ estate: string }>; scatterData: Array<{ x: number; y: number; z: number; estate: string }>; unit: string }) {
 return (
 <ResponsiveContainer width="100%" height={260}>
 <ScatterChart>
 <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} />
 <XAxis dataKey="x" name={`Total ${unit}`} tick={{ fontSize: 10, fill: AXIS_TICK_LIGHT }} unit={unit} />
 <YAxis dataKey="y" name="Variation" tick={{ fontSize: 10, fill: AXIS_TICK_LIGHT }} />
 <ZAxis dataKey="z" range={[80, 400]} />
 <Tooltip cursor={{ strokeDasharray: "3 3" }} contentStyle={TT_STYLE}
 formatter={(v: any, name: any) => {
 if (name === "x") return [`${v} ${unit}`, "Total"];
 if (name === "y") return [`${v}`, "Variation"];
 if (name === "z") return [`${v} days`, "Rainy Days"];
 return [v, name];
 }}
 />
 <Scatter data={scatterData}>
 {data.map((entry) => (
 <Cell key={entry.estate} fill={ESTATE_COLORS[entry.estate]} stroke="#ffffff" strokeWidth={2} />
 ))}
 </Scatter>
 </ScatterChart>
 </ResponsiveContainer>
 );
}

function DryStreakChart({ data }: { data: Array<{ estate: string; maxStreak: number; avgStreak: number; count: number; dist: Record<number, number> }> }) {
 return (
 <ResponsiveContainer width="100%" height={240}>
 <BarChart data={data} layout="vertical">
 <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} />
 <XAxis type="number" tick={{ fontSize: 10, fill: AXIS_TICK_LIGHT }} unit=" days" />
 <YAxis dataKey="estate" type="category" tick={{ fontSize: 10, fill: "#1b4a1b" }} width={90} />
 <Tooltip contentStyle={TT_STYLE}
 formatter={(v: any, name: any) => {
 if (name === "maxStreak") return [`${v} days`, "Max streak"];
 if (name === "avgStreak") return [`${v} days`, "Avg streak"];
 return [v, name];
 }}
 />
 <Legend wrapperStyle={{ fontSize: 10 }} />
 <Bar dataKey="maxStreak" fill="#dc2626" name="Max streak" radius={[0, 3, 3, 0]} barSize={14} />
 <Bar dataKey="avgStreak" fill="#d97706" name="Avg streak" radius={[0, 3, 3, 0]} barSize={14} />
 </BarChart>
 </ResponsiveContainer>
 );
}

function SeasonalStacked({ data, unit }: { data: Row[]; unit: string }) {
 const chartData = useMemo(() => {
 const out: Record<string, Record<string, number>> = {};
 data.forEach(r => {
 if (!out[r.estate]) out[r.estate] = {};
 const sk =  mo(r.date) >= 6 ? "SW Monsoon" :  mo(r.date) >= 10 ? "NE Monsoon" :  mo(r.date) <= 2 ? "Winter" : "Summer";
 out[r.estate][sk] = (out[r.estate][sk] ?? 0) + r.rainfall_mm;
 });
 return ESTATES.map(e => ({ estate: e, ...out[e] }));
 }, [data]);

 return (
 <ResponsiveContainer width="100%" height={260}>
 <BarChart data={chartData}>
 <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} />
 <XAxis dataKey="estate" tick={{ fontSize: 10, fill: "#1b4a1b" }} />
 <YAxis tick={{ fontSize: 10, fill: AXIS_TICK_LIGHT }} unit={unit} />
 <Tooltip contentStyle={TT_STYLE} />
 <Legend wrapperStyle={{ fontSize: 10 }} />
 <Bar dataKey="SW Monsoon" stackId="s" fill="#2563eb" />
 <Bar dataKey="NE Monsoon" stackId="s" fill="#0891b2" />
 <Bar dataKey="Winter" stackId="s" fill="#d97706" />
 <Bar dataKey="Summer" stackId="s" fill="#dc2626" />
 </BarChart>
 </ResponsiveContainer>
 );
}

function YoYDeltaChart({ estateStats }: { estateStats: Array<{ estate: string; yoyDelta: number | null }> }) {
 const yoyFill = (v: number | null) => v !== null && v >= 0 ? "#059669" : "#dc2626";
 return (
 <ResponsiveContainer width="100%" height={280}>
 <BarChart data={estateStats} layout="vertical">
 <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} />
 <XAxis type="number" tick={{ fontSize: 10, fill: AXIS_TICK_LIGHT }} unit="%" />
 <YAxis dataKey="estate" type="category" tick={{ fontSize: 10, fill: "#1b4a1b" }} width={100} />
 <Tooltip contentStyle={TT_STYLE} formatter={(v: any) => [`${v >= 0 ? "+" : ""}${v}%`, "YoY Change"]} />
 <Bar dataKey="yoyDelta" radius={[0, 4, 4, 0]} barSize={18}>
 {estateStats.map(entry => (
 <Cell key={entry.estate} fill={yoyFill(entry.yoyDelta)} />
 ))}
 </Bar>
 </BarChart>
 </ResponsiveContainer>
 );
}

function EstateTimelineRow({ data, year, period, month, unit, estates, estateColors }: {
 data: Row[];
 year: number;
 period: string;
 month: number;
 unit: string;
 estates: readonly string[];
 estateColors: Record<string, string>;
}) {
 const IN_FACTOR = 25.4;
 const rnd = (n: number, d = 1) => Math.round(n * 10 ** d) / 10 ** d;

 const getMonthsForPeriod = useCallback(() => {
 if (period === "month") return [month];
 if (period === "quarter") {
 const b = Math.floor(Number(month) / 3) * 3;
 return [b, b + 1, b + 2];
 }
 if (period === "half") return month < 6 ? [0, 1, 2, 3, 4, 5] : [6, 7, 8, 9, 10, 11];
 return [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
 }, [period, month]);

 const getMonthLabel = () => {
 if (period === "month") return MONTH_NAMES[month];
 if (period === "quarter") {
 const b = Math.floor(Number(month) / 3) * 3;
 return MONTH_NAMES[b] + "–" + MONTH_NAMES[b + 2];
 }
 if (period === "half") return month < 6 ? "Jan–Jun" : "Jul–Dec";
 return "Full year";
 };

 const allYears = useMemo(() => {
 const yrs = [...new Set(data.map(r => new Date(r.date).getFullYear()))].sort((a, b) => a - b);
 return yrs.length > 0 ? yrs : [year - 2, year - 1, year, year + 1, year + 2];
 }, [data, year]);

 const sumPeriod = useCallback((estateName: string, yr: number, months: number[]) => {
 const mSet = new Set(months);
 let mm = 0;
 const dateSet = new Set<string>();
 for (const r of data) {
 if (r.estate === estateName && new Date(r.date).getFullYear() === yr && mSet.has(new Date(r.date).getMonth())) {
 mm += r.rainfall_mm;
 if (r.rainfall_mm > 0) dateSet.add(r.date);
 }
 }
 return { mm, rd: dateSet.size };
 }, [data]);

 const months = getMonthsForPeriod();
 const periodLabel = getMonthLabel();

 const rankings = useMemo(() => {
 return estates.map(e => {
 const cur = sumPeriod(e, year, months);
 return { name: e, mm: cur.mm, rd: cur.rd };
 }).sort((a, b) => b.mm - a.mm);
 }, [estates, year, months, sumPeriod]);

 const rankMap = useMemo(() => {
 const m: Record<string, number> = {};
 rankings.forEach((e, i) => { m[e.name] = i + 1; });
 return m;
 }, [rankings]);

 return (
 <div className={s.timelineRow}>
 {estates.map(e => {
 const c = estateColors[e];
 const cur = sumPeriod(e, year, months);
 const prevYear = year - 1;
 const prev = sumPeriod(e, prevYear, months);
 const diffPct = prev.mm > 0 ? Math.round((cur.mm - prev.mm) / prev.mm * 100) : (cur.mm > 0 ? 100 : 0);
 const trend = diffPct > 0 ? "up" : diffPct < 0 ? "down" : "flat";
 const trendIcon = trend === "up" ? "↑" : trend === "down" ? "↓" : "→";

 const yr5 = allYears.filter(y => y >= year - 2 && y <= year + 2);
 const yr5Vals = yr5.map(y => sumPeriod(e, y, months).mm).filter(v => v > 0);
 const avg5 = yr5Vals.length > 0 ? Math.round(yr5Vals.reduce((a, b) => a + b, 0) / yr5Vals.length) : 0;
 const avg5rd = yr5.map(y => sumPeriod(e, y, months).rd);
 const avg5rdVal = avg5rd.length > 0 ? Math.round(avg5rd.reduce((a, b) => a + b, 0) / avg5rd.length) : 0;

 const allVals = yr5.map(y => sumPeriod(e, y, months).mm);
 const maxVal = Math.max(...allVals, 1);

 const rank = rankMap[e];
 const totalEst = rankings.reduce((s, r) => s + r.mm, 0);
 const share = totalEst > 0 ? Math.round(cur.mm / totalEst * 100) : 0;

 const ytdEndMonth = period === 'month' ? month : period === 'quarter' ? (Math.floor(Number(month) / 3) * 3 + 2) : period === 'half' ? (month < 6 ? 5 : 11) : 11;
 const ytdVal = sumPeriod(e, year, Array.from({length: ytdEndMonth + 1}, (_, i) => i)).mm;
 const ytdRd = sumPeriod(e, year, Array.from({length: ytdEndMonth + 1}, (_, i) => i)).rd;

 return (
 <div key={e} className={s.tlCard} style={{ borderTopColor: c, borderLeftColor: c }}>
 <div className={s.tlHeader}>
 <div className={s.tlDot} style={{ background: c }} />
 <div className={s.tlName}>{e}</div>
 </div>
 <div className={s.tlPeriod}>{periodLabel} {year} · Rank #{rank}</div>

 <div className={s.tl}>
 <div className={s.tlLine} />
 {yr5.map(yr => {
 const val = sumPeriod(e, yr, months);
 const isSel = yr === year;
 const barW = Math.round((val.mm / maxVal) * 100);

 return (
 <div key={yr} className={`${s.tlRow} ${isSel ? s.tlRowSel : ""}`} style={isSel ? { borderColor: c } : undefined}>
 <div className={`${s.tlYr} ${isSel ? s.tlYrSel : ""}`}
 style={isSel ? { color: c } : yr < year ? { color: "#6b7280" } : { color: "#9ca3af" }}>
 {String(yr).slice(2)}
 </div>
 <div className={s.tlDotCol}>
 <div className={`${s.tlDotInner} ${isSel ? s.tlDotSel : ""}`}
 style={isSel ? { background: c, boxShadow: `0 0 0 2px #fff, 0 0 0 4px ${c}` } : {}} />
 </div>
 <div className={s.tlBarWrap}>
 <div className={s.tlBar} style={{ width: `${barW}%`, background: isSel ? c : "#e5dfc8" }} />
 </div>
 <div className={`${s.tlMm} ${isSel ? s.tlMmSel : ""}`}
 style={isSel ? { color: c } : { color: "#9ca3af" }}>
 {unit === "mm" ? val.mm : rnd(val.mm / IN_FACTOR, 2)}{unit}
 </div>
 <div className={s.tlRd}>
 {val.rd > 0 && <span className={s.tlRdBadge}>{val.rd}d</span>}
 </div>
 </div>
 );
 })}
 </div>

 <div className={s.tlStats}>
 <div className={s.tlChip}>5yr avg <b>{unit === "mm" ? avg5 : rnd(avg5 / IN_FACTOR, 2)}{unit}</b> <span style={{color:"#9ca3af",fontWeight:400}}>· {avg5rdVal}d</span></div>
 <div className={`${s.tlTrend} ${trend === "up" ? s.tlTrendUp : trend === "down" ? s.tlTrendDown : s.tlTrendFlat}`}>
 {trendIcon} {Math.abs(diffPct)}% vs {prevYear}
 </div>
 <div className={s.tlChip}>YTD <b>{unit === "mm" ? ytdVal : rnd(ytdVal / IN_FACTOR, 2)}{unit}</b> <span style={{color:"#9ca3af",fontWeight:400}}>· {ytdRd}d</span></div>
 <div className={s.tlChip}>Share <b>{share}%</b></div>
 </div>
 </div>
 );
 })}
 </div>
 );
}
