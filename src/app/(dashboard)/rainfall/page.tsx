"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import {
  LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from "recharts";
import {
  Droplets, CloudRain, TrendingUp, Clock, Mountain,
  Upload, Plus, Pencil, Trash2, Calendar,
} from "lucide-react";
import { UploadModal } from "@/components/rainfall/UploadModal";
import { RecordModal, type RainfallRecord } from "@/components/rainfall/RecordModal";

// ─── Constants ────────────────────────────────────────────────────────────────
const ESTATES = ["Gowri", "Hidden Falls", "Moganad", "Orchardale", "Stanmore", "Vyapurikuttai"];

const ESTATE_COLORS: Record<string, string> = {
  "Gowri": "#38bdf8",
  "Hidden Falls": "#f87171",
  "Moganad": "#4ade80",
  "Orchardale": "#f59e0b",
  "Stanmore": "#a78bfa",
  "Vyapurikuttai": "#fb923c",
};

const MONTHS = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];

const MONTH_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const MEDALS = ["🥇","🥈","🥉"];

// ─── Types ────────────────────────────────────────────────────────────────────
type Row = {
  id: number;
  date: string;
  estate: string;
  rainfall_mm: number;
  inches: number;
  year: number;
  month: number;
};

type Grouping = "daily" | "monthly" | "yearly";
type Unit = "mm" | "in";

// ─── Helpers ──────────────────────────────────────────────────────────────────
const daysBetween = (a: string, b: string) =>
  Math.floor((new Date(b).getTime() - new Date(a).getTime()) / 86400000);

const fmtDate = (d: string) => {
  const dt = new Date(d + "T00:00:00");
  return dt.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
};

function r1(n: number) { return Math.round(n * 10) / 10; }

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function RainfallPage() {
  const [data, setData] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [year, setYear] = useState<string>("all");
  const [month, setMonth] = useState<string>("all");
  const [estateFilter, setEstateFilter] = useState<string>("all");
  const [unit, setUnit] = useState<Unit>("mm");

  // Compare pills (up to 3)
  const [compareEstates, setCompareEstates] = useState<string[]>(["Gowri", "Moganad", "Orchardale"]);

  // Chart grouping
  const [grouping, setGrouping] = useState<Grouping>("monthly");

  // Modals
  const [showUpload, setShowUpload] = useState(false);
  const [editRecord, setEditRecord] = useState<RainfallRecord | null | undefined>(undefined); // undefined=closed, null=new

  // Manage records table visibility
  const [showRecords, setShowRecords] = useState(false);
  const [recordPage, setRecordPage] = useState(0);
  const RECORDS_PER_PAGE = 20;

  // ─── Load data ──────────────────────────────────────────────────────────────
  const loadData = useCallback(async () => {
    setLoading(true);
    const { data: rows } = await supabase
      .from("rainfall")
      .select("*")
      .order("date", { ascending: true });

    const normalised: Row[] = (rows ?? []).map((r) => {
      const [y, m] = r.date.split("-").map(Number);
      return { ...r, year: y, month: m };
    });
    setData(normalised);
    if (normalised.length > 0) {
      const years = [...new Set(normalised.map((r) => r.year))];
      setYear(String(Math.max(...years)));
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // ─── Derived values ──────────────────────────────────────────────────────────
  const val = (r: Row) => unit === "mm" ? r.rainfall_mm : r.inches;
  const unitStr = unit === "mm" ? "mm" : "in";

  const years = useMemo(
    () => [...new Set(data.map((r) => r.year))].sort((a, b) => b - a),
    [data]
  );

  // Filtered data (respects year, month, estate)
  const filtered = useMemo(() => data.filter((r) => {
    if (year !== "all" && r.year !== Number(year)) return false;
    if (month !== "all" && r.month !== Number(month)) return false;
    if (estateFilter !== "all" && r.estate !== estateFilter) return false;
    return true;
  }), [data, year, month, estateFilter]);

  // Filtered but ignoring estate filter (for compare cards)
  const filteredNoEstate = useMemo(() => data.filter((r) => {
    if (year !== "all" && r.year !== Number(year)) return false;
    if (month !== "all" && r.month !== Number(month)) return false;
    return true;
  }), [data, year, month]);

  // ─── KPIs ────────────────────────────────────────────────────────────────────
  const kpis = useMemo(() => {
    const withRain = filtered.filter((r) => r.rainfall_mm > 0);
    const total = r1(withRain.reduce((s, r) => s + val(r), 0));

    const maxRow = withRain.reduce<Row | null>((a, b) => (a && val(a) >= val(b) ? a : b), null);

    const curYear = new Date().getFullYear();
    const rtd = r1(data.filter((r) => r.year === curYear && r.rainfall_mm > 0).reduce((s, r) => s + val(r), 0));

    const rainyDates = new Set(withRain.map((r) => r.date));

    const allRainyDates = [...new Set(data.filter((r) => r.rainfall_mm > 0).map((r) => r.date))].sort();
    const lastRainDate = allRainyDates[allRainyDates.length - 1];
    const dslr = lastRainDate ? daysBetween(lastRainDate, new Date().toISOString().slice(0, 10)) : null;

    return { total, maxRow, rtd, curYear, rainyDays: rainyDates.size, dslr, lastRainDate };
  }, [filtered, data, unit]);

  // ─── Chart data ──────────────────────────────────────────────────────────────
  const chartData = useMemo(() => {
    const activeEstates = compareEstates.length > 0 ? compareEstates : ESTATES;
    const source = filteredNoEstate.filter((r) => activeEstates.includes(r.estate));

    if (grouping === "daily") {
      const map: Record<string, Record<string, number>> = {};
      source.forEach((r) => {
        if (!map[r.date]) map[r.date] = {};
        map[r.date][r.estate] = (map[r.date][r.estate] ?? 0) + val(r);
      });
      return Object.entries(map)
        .sort((a, b) => a[0].localeCompare(b[0]))
        .slice(-90) // last 90 days for readability
        .map(([date, vals]) => ({ name: date.slice(5), ...vals }));
    }

    if (grouping === "monthly") {
      const map: Record<string, Record<string, number>> = {};
      source.forEach((r) => {
        const key = `${r.year}-${String(r.month).padStart(2, "0")}`;
        if (!map[key]) map[key] = {};
        map[key][r.estate] = (map[key][r.estate] ?? 0) + val(r);
      });
      return Object.entries(map)
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([k, vals]) => {
          const [, m] = k.split("-");
          return { name: MONTH_SHORT[Number(m) - 1], ...vals };
        });
    }

    // yearly
    const map: Record<number, Record<string, number>> = {};
    data.filter((r) => activeEstates.includes(r.estate)).forEach((r) => {
      if (!map[r.year]) map[r.year] = {};
      map[r.year][r.estate] = (map[r.year][r.estate] ?? 0) + val(r);
    });
    return Object.entries(map)
      .sort((a, b) => Number(a[0]) - Number(b[0]))
      .map(([yr, vals]) => ({ name: yr, ...vals }));
  }, [filteredNoEstate, data, compareEstates, grouping, unit]);

  // ─── Top 10 events ───────────────────────────────────────────────────────────
  const topEvents = useMemo(() =>
    [...filtered]
      .filter((r) => r.rainfall_mm > 0)
      .sort((a, b) => b.rainfall_mm - a.rainfall_mm)
      .slice(0, 10),
    [filtered]
  );

  // ─── Compare cards ───────────────────────────────────────────────────────────
  const compareCards = useMemo(() => {
    const curYear = new Date().getFullYear();
    const allTotals = ESTATES.map((e) => ({
      estate: e,
      total: filteredNoEstate.filter((r) => r.estate === e && r.rainfall_mm > 0).reduce((s, r) => s + val(r), 0),
    })).sort((a, b) => b.total - a.total);

    return compareEstates.map((estate) => {
      const eData = filteredNoEstate.filter((r) => r.estate === estate);
      const rainyEData = eData.filter((r) => r.rainfall_mm > 0);
      const total = r1(rainyEData.reduce((s, r) => s + val(r), 0));
      const maxEvent = rainyEData.reduce<Row | null>((a, b) => (a && val(a) >= val(b) ? a : b), null);
      const rainyDays = new Set(rainyEData.map((r) => r.date)).size;
      const avg = rainyDays > 0 ? r1(total / rainyDays) : 0;

      const allRainyDates = [...new Set(data.filter((r) => r.estate === estate && r.rainfall_mm > 0).map((r) => r.date))].sort();
      const lastRain = allRainyDates[allRainyDates.length - 1];
      const dslr = lastRain ? daysBetween(lastRain, new Date().toISOString().slice(0, 10)) : null;

      const rtdEstate = r1(data.filter((r) => r.estate === estate && r.year === curYear && r.rainfall_mm > 0).reduce((s, r) => s + val(r), 0));
      const rank = allTotals.findIndex((x) => x.estate === estate) + 1;

      return { estate, total, maxEvent, rainyDays, avg, dslr, lastRain, rtdEstate, rank };
    });
  }, [compareEstates, filteredNoEstate, data, unit]);

  // ─── Toggle compare estate ────────────────────────────────────────────────────
  const toggleCompare = (estate: string) => {
    setCompareEstates((prev) => {
      if (prev.includes(estate)) {
        return prev.length > 1 ? prev.filter((e) => e !== estate) : prev;
      }
      if (prev.length < 3) return [...prev, estate];
      return [...prev.slice(1), estate];
    });
  };

  // ─── Records for table ────────────────────────────────────────────────────────
  const sortedRecords = useMemo(() =>
    [...filtered].sort((a, b) => b.date.localeCompare(a.date)),
    [filtered]
  );
  const pagedRecords = sortedRecords.slice(recordPage * RECORDS_PER_PAGE, (recordPage + 1) * RECORDS_PER_PAGE);

  // ─── Render ──────────────────────────────────────────────────────────────────
  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <Droplets className="h-8 w-8 animate-pulse text-[#38bdf8]" />
    </div>
  );

  const activeEstates = compareEstates.length > 0 ? compareEstates : ESTATES;

  return (
    <>
      <div className="space-y-6 pb-8">
        {/* ─── Controls ────────────────────────────────────────────────────────── */}
        <div className="flex flex-wrap items-end gap-3">
          {/* Year */}
          <div>
            <label className="block text-[10px] text-white/40 uppercase tracking-widest mb-1.5">Year</label>
            <select value={year} onChange={(e) => setYear(e.target.value)}
              className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#38bdf8]/50 appearance-none min-w-[100px]">
              <option value="all" className="bg-[#0a1824]">All Years</option>
              {years.map((y) => <option key={y} value={y} className="bg-[#0a1824]">{y}</option>)}
            </select>
          </div>

          {/* Month */}
          <div>
            <label className="block text-[10px] text-white/40 uppercase tracking-widest mb-1.5">Month</label>
            <select value={month} onChange={(e) => setMonth(e.target.value)}
              className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#38bdf8]/50 appearance-none min-w-[120px]">
              <option value="all" className="bg-[#0a1824]">All Months</option>
              {MONTHS.map((m, i) => <option key={i} value={i + 1} className="bg-[#0a1824]">{m}</option>)}
            </select>
          </div>

          {/* Estate */}
          <div>
            <label className="block text-[10px] text-white/40 uppercase tracking-widest mb-1.5">Estate</label>
            <select value={estateFilter} onChange={(e) => setEstateFilter(e.target.value)}
              className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#38bdf8]/50 appearance-none min-w-[140px]">
              <option value="all" className="bg-[#0a1824]">All Estates</option>
              {ESTATES.map((e) => <option key={e} value={e} className="bg-[#0a1824]">{e}</option>)}
            </select>
          </div>

          {/* Unit toggle */}
          <div>
            <label className="block text-[10px] text-white/40 uppercase tracking-widest mb-1.5">Unit</label>
            <div className="flex rounded-lg bg-white/5 border border-white/10 p-0.5">
              {(["mm", "in"] as Unit[]).map((u) => (
                <button key={u} onClick={() => setUnit(u)}
                  className={`px-4 py-1.5 text-sm rounded-md transition ${unit === u ? "bg-[#38bdf8] text-[#020508] font-semibold" : "text-white/60 hover:text-white"}`}>
                  {u}
                </button>
              ))}
            </div>
          </div>

          {/* Reset */}
          <button
            onClick={() => { setYear("all"); setMonth("all"); setEstateFilter("all"); setUnit("mm"); }}
            className="px-4 py-2 rounded-lg border border-white/10 text-white/50 text-sm hover:border-red-400/50 hover:text-red-400 transition">
            Reset
          </button>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Actions */}
          <button
            onClick={() => setEditRecord(null)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-white/70 text-sm hover:bg-white/10 transition">
            <Plus className="h-4 w-4" /> Add Record
          </button>
          <button
            onClick={() => setShowUpload(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#38bdf8] text-[#020508] text-sm font-semibold hover:bg-[#7dd3fc] transition">
            <Upload className="h-4 w-4" /> Upload Excel
          </button>
        </div>

        {/* ─── Estate Pills ─────────────────────────────────────────────────────── */}
        <div>
          <p className="text-[10px] text-white/40 uppercase tracking-widest mb-2">Compare Estates (select up to 3)</p>
          <div className="flex flex-wrap gap-2">
            {ESTATES.map((estate) => {
              const active = compareEstates.includes(estate);
              const color = ESTATE_COLORS[estate];
              return (
                <button key={estate} onClick={() => toggleCompare(estate)}
                  style={{ borderColor: active ? color : "transparent", color: active ? color : "rgba(255,255,255,0.3)" }}
                  className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium border transition ${active ? "bg-white/5" : "bg-transparent"} hover:opacity-80`}>
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
                  {estate}
                </button>
              );
            })}
          </div>
        </div>

        {/* ─── KPI Cards ────────────────────────────────────────────────────────── */}
        <div>
          <p className="text-[10px] text-white/40 uppercase tracking-widest mb-3">Key Performance Indicators</p>
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            {/* Total Rainfall */}
            <div className="rounded-xl bg-[#0a1824] border border-[#38bdf8]/20 p-4">
              <div className="flex items-center gap-2 text-white/50 text-xs mb-2">
                <Droplets className="h-3.5 w-3.5 text-[#38bdf8]" /> Total Rainfall
              </div>
              <p className="text-2xl font-bold text-white">{kpis.total}<span className="text-sm text-white/40 ml-1">{unitStr}</span></p>
              <p className="text-xs text-white/40 mt-1">across selected period</p>
            </div>

            {/* Highest Event */}
            <div className="rounded-xl bg-[#0a1824] border border-[#e4b84a]/20 p-4">
              <div className="flex items-center gap-2 text-white/50 text-xs mb-2">
                <Mountain className="h-3.5 w-3.5 text-[#e4b84a]" /> Highest Event
              </div>
              <p className="text-2xl font-bold text-white">
                {kpis.maxRow ? r1(val(kpis.maxRow)) : "—"}<span className="text-sm text-white/40 ml-1">{unitStr}</span>
              </p>
              <p className="text-xs text-white/40 mt-1">
                {kpis.maxRow ? `${kpis.maxRow.estate} · ${fmtDate(kpis.maxRow.date)}` : "—"}
              </p>
            </div>

            {/* Rain to Date */}
            <div className="rounded-xl bg-[#0a1824] border border-[#f87171]/20 p-4">
              <div className="flex items-center gap-2 text-white/50 text-xs mb-2">
                <Calendar className="h-3.5 w-3.5 text-[#f87171]" /> Rain to Date
              </div>
              <p className="text-2xl font-bold text-white">{kpis.rtd}<span className="text-sm text-white/40 ml-1">{unitStr}</span></p>
              <p className="text-xs text-white/40 mt-1">YTD {kpis.curYear}</p>
            </div>

            {/* Rainy Days */}
            <div className="rounded-xl bg-[#0a1824] border border-[#4ade80]/20 p-4">
              <div className="flex items-center gap-2 text-white/50 text-xs mb-2">
                <CloudRain className="h-3.5 w-3.5 text-[#4ade80]" /> Rainy Days
              </div>
              <p className="text-2xl font-bold text-white">{kpis.rainyDays}<span className="text-sm text-white/40 ml-1">days</span></p>
              <p className="text-xs text-white/40 mt-1">in selected period</p>
            </div>

            {/* Days Since Last Rain */}
            <div className="rounded-xl bg-[#0a1824] border border-[#a78bfa]/20 p-4">
              <div className="flex items-center gap-2 text-white/50 text-xs mb-2">
                <Clock className="h-3.5 w-3.5 text-[#a78bfa]" /> Days Since Last Rain
              </div>
              <p className="text-2xl font-bold text-white">
                {kpis.dslr ?? "—"}<span className="text-sm text-white/40 ml-1">days</span>
              </p>
              <p className="text-xs text-white/40 mt-1">
                {kpis.lastRainDate ? `last rain ${fmtDate(kpis.lastRainDate)}` : "—"}
              </p>
            </div>
          </div>
        </div>

        {/* ─── Estate Comparison Cards ──────────────────────────────────────────── */}
        {compareCards.length > 0 && (
          <div>
            <p className="text-[10px] text-white/40 uppercase tracking-widest mb-3">Estate Comparison</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {compareCards.map(({ estate, total, maxEvent, rainyDays, avg, dslr, lastRain, rtdEstate, rank }) => {
                const color = ESTATE_COLORS[estate];
                return (
                  <div key={estate} className="rounded-xl bg-[#0a1824] p-5"
                    style={{ border: `1px solid ${color}33` }}>
                    <div className="flex items-center gap-2 mb-4">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
                      <span className="font-semibold text-sm" style={{ color }}>{estate}</span>
                      <span className="ml-auto text-lg">{MEDALS[rank - 1] ?? `#${rank}`}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <p className="text-[10px] text-white/40 mb-1">Total Rainfall</p>
                        <p className="text-xl font-bold" style={{ color }}>{total}<span className="text-xs text-white/40 ml-1">{unitStr}</span></p>
                        <p className="text-[10px] text-white/30">selected period</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-white/40 mb-1">Highest Event</p>
                        <p className="text-xl font-bold text-white">{maxEvent ? r1(val(maxEvent)) : "—"}<span className="text-xs text-white/40 ml-1">{unitStr}</span></p>
                        <p className="text-[10px] text-white/30">{maxEvent ? fmtDate(maxEvent.date) : "—"}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-white/40 mb-1">Rainy Days</p>
                        <p className="text-xl font-bold text-white">{rainyDays}<span className="text-xs text-white/40 ml-1">days</span></p>
                        <p className="text-[10px] text-white/30">avg {avg} {unitStr}/day</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-white/40 mb-1">Rain to Date</p>
                        <p className="text-xl font-bold text-white">{rtdEstate}<span className="text-xs text-white/40 ml-1">{unitStr}</span></p>
                        <p className="text-[10px] text-white/30">YTD {new Date().getFullYear()}</p>
                      </div>
                      <div className="col-span-2">
                        <p className="text-[10px] text-white/40 mb-1">Days Since Last Rainfall</p>
                        <p className="text-xl font-bold" style={{ color }}>{dslr ?? "—"}<span className="text-xs text-white/40 ml-1">days</span></p>
                        <p className="text-[10px] text-white/30">{lastRain ? `last rain ${fmtDate(lastRain)}` : "—"}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ─── Rainfall Chart ───────────────────────────────────────────────────── */}
        <div className="rounded-xl bg-[#0a1824] border border-white/10 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
            <div>
              <p className="text-sm font-semibold text-white">Rainfall Trend</p>
              <p className="text-xs text-white/40 mt-0.5">
                {grouping.charAt(0).toUpperCase() + grouping.slice(1)} totals · {activeEstates.join(", ")}
              </p>
            </div>
            <div className="flex rounded-lg bg-white/5 border border-white/10 p-0.5">
              {(["daily", "monthly", "yearly"] as Grouping[]).map((g) => (
                <button key={g} onClick={() => setGrouping(g)}
                  className={`px-3 py-1.5 text-xs rounded-md capitalize transition ${grouping === g ? "bg-[#38bdf8] text-[#020508] font-semibold" : "text-white/50 hover:text-white"}`}>
                  {g}
                </button>
              ))}
            </div>
          </div>
          <div className="p-4">
            {data.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-60 text-white/30">
                <CloudRain className="h-10 w-10 mb-2" />
                <p className="text-sm">No data — upload your Excel to get started</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={320}>
                {grouping === "monthly" ? (
                  <LineChart data={chartData} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                    <XAxis dataKey="name" stroke="rgba(255,255,255,0.3)" fontSize={11} />
                    <YAxis stroke="rgba(255,255,255,0.3)" fontSize={11} />
                    <Tooltip contentStyle={{ backgroundColor: "#0a1824", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, color: "#fff", fontSize: 12 }} />
                    <Legend />
                    {activeEstates.map((e) => (
                      <Line key={e} type="monotone" dataKey={e} stroke={ESTATE_COLORS[e]} strokeWidth={2} dot={{ r: 2 }} activeDot={{ r: 4 }} connectNulls />
                    ))}
                  </LineChart>
                ) : (
                  <BarChart data={chartData} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                    <XAxis dataKey="name" stroke="rgba(255,255,255,0.3)" fontSize={11} />
                    <YAxis stroke="rgba(255,255,255,0.3)" fontSize={11} />
                    <Tooltip contentStyle={{ backgroundColor: "#0a1824", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, color: "#fff", fontSize: 12 }} />
                    <Legend />
                    {activeEstates.map((e) => (
                      <Bar key={e} dataKey={e} fill={ESTATE_COLORS[e]} radius={[3, 3, 0, 0]} />
                    ))}
                  </BarChart>
                )}
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* ─── Top 10 Events ────────────────────────────────────────────────────── */}
        <div className="rounded-xl bg-[#0a1824] border border-white/10 overflow-hidden">
          <div className="px-5 py-4 border-b border-white/10">
            <p className="text-sm font-semibold text-white">Top 10 Highest Rainfall Events</p>
            <p className="text-xs text-white/40 mt-0.5">based on current filters</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 text-[10px] text-white/40 uppercase tracking-widest">
                  <th className="px-5 py-3 text-left w-8">#</th>
                  <th className="px-5 py-3 text-left">Date</th>
                  <th className="px-5 py-3 text-left">Estate</th>
                  <th className="px-5 py-3 text-right">mm</th>
                  <th className="px-5 py-3 text-right">Inches</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {topEvents.length === 0 ? (
                  <tr><td colSpan={6} className="px-5 py-8 text-center text-white/30 text-sm">No data for selected filters</td></tr>
                ) : topEvents.map((r, i) => (
                  <tr key={r.id} className="border-t border-white/5 hover:bg-white/3 transition">
                    <td className="px-5 py-3 text-white/30 text-xs">{i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `#${i + 1}`}</td>
                    <td className="px-5 py-3 text-white/70 text-xs">{fmtDate(r.date)}</td>
                    <td className="px-5 py-3">
                      <span className="flex items-center gap-1.5 text-xs">
                        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: ESTATE_COLORS[r.estate] }} />
                        <span style={{ color: ESTATE_COLORS[r.estate] }}>{r.estate}</span>
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right text-[#38bdf8] font-medium">{r.rainfall_mm}</td>
                    <td className="px-5 py-3 text-right text-white/40 text-xs">{r.inches.toFixed(3)}</td>
                    <td className="px-5 py-3 text-right">
                      <button onClick={() => setEditRecord({ id: r.id, date: r.date, estate: r.estate, rainfall_mm: r.rainfall_mm, inches: r.inches })}
                        className="text-white/30 hover:text-[#38bdf8] transition">
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* ─── Annual Totals ────────────────────────────────────────────────────── */}
        <div>
          <p className="text-[10px] text-white/40 uppercase tracking-widest mb-3">Annual Totals</p>
          <div className="flex flex-wrap gap-3">
            {years.map((y) => {
              const yTotal = r1(data
                .filter((r) => r.year === y && r.rainfall_mm > 0 && (estateFilter === "all" || r.estate === estateFilter))
                .reduce((s, r) => s + val(r), 0));
              const isSelected = String(y) === year;
              return (
                <button key={y} onClick={() => { setYear(isSelected ? "all" : String(y)); setGrouping("monthly"); }}
                  className={`rounded-xl px-5 py-3 text-left border transition ${isSelected ? "bg-[#38bdf8]/10 border-[#38bdf8]/30" : "bg-[#0a1824] border-white/10 hover:bg-white/5"}`}>
                  <p className="text-lg font-bold text-white">{y}</p>
                  <p className="text-xs text-white/40">{yTotal} {unitStr}</p>
                </button>
              );
            })}
          </div>
        </div>

        {/* ─── Records Table ────────────────────────────────────────────────────── */}
        <div className="rounded-xl bg-[#0a1824] border border-white/10 overflow-hidden">
          <button
            onClick={() => setShowRecords((v) => !v)}
            className="w-full flex items-center justify-between px-5 py-4 border-b border-white/10 hover:bg-white/3 transition">
            <div>
              <p className="text-sm font-semibold text-white text-left">All Records</p>
              <p className="text-xs text-white/40 mt-0.5 text-left">{filtered.length.toLocaleString()} records · click to {showRecords ? "hide" : "show"}</p>
            </div>
            <span className="text-white/30 text-xs">{showRecords ? "▲" : "▼"}</span>
          </button>

          {showRecords && (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/10 text-[10px] text-white/40 uppercase tracking-widest">
                      <th className="px-5 py-3 text-left">Date</th>
                      <th className="px-5 py-3 text-left">Estate</th>
                      <th className="px-5 py-3 text-right">mm</th>
                      <th className="px-5 py-3 text-right">Inches</th>
                      <th className="px-5 py-3 text-right">Edit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pagedRecords.map((r) => (
                      <tr key={r.id} className="border-t border-white/5 hover:bg-white/3 transition">
                        <td className="px-5 py-2.5 text-white/60 text-xs">{fmtDate(r.date)}</td>
                        <td className="px-5 py-2.5">
                          <span className="flex items-center gap-1.5 text-xs">
                            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: ESTATE_COLORS[r.estate] }} />
                            <span style={{ color: ESTATE_COLORS[r.estate] }}>{r.estate}</span>
                          </span>
                        </td>
                        <td className="px-5 py-2.5 text-right text-[#38bdf8] text-xs">{r.rainfall_mm}</td>
                        <td className="px-5 py-2.5 text-right text-white/40 text-xs">{r.inches.toFixed(3)}</td>
                        <td className="px-5 py-2.5 text-right">
                          <button onClick={() => setEditRecord({ id: r.id, date: r.date, estate: r.estate, rainfall_mm: r.rainfall_mm, inches: r.inches })}
                            className="text-white/30 hover:text-[#38bdf8] transition">
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {/* Pagination */}
              <div className="flex items-center justify-between px-5 py-3 border-t border-white/10 text-xs text-white/40">
                <span>
                  {recordPage * RECORDS_PER_PAGE + 1}–{Math.min((recordPage + 1) * RECORDS_PER_PAGE, sortedRecords.length)} of {sortedRecords.length.toLocaleString()}
                </span>
                <div className="flex gap-2">
                  <button disabled={recordPage === 0} onClick={() => setRecordPage((p) => p - 1)}
                    className="px-3 py-1 rounded border border-white/10 disabled:opacity-30 hover:border-white/20 transition">← Prev</button>
                  <button disabled={(recordPage + 1) * RECORDS_PER_PAGE >= sortedRecords.length}
                    onClick={() => setRecordPage((p) => p + 1)}
                    className="px-3 py-1 rounded border border-white/10 disabled:opacity-30 hover:border-white/20 transition">Next →</button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ─── Modals ───────────────────────────────────────────────────────────── */}
      {showUpload && (
        <UploadModal onClose={() => setShowUpload(false)} onSuccess={loadData} />
      )}
      {editRecord !== undefined && (
        <RecordModal record={editRecord} onClose={() => setEditRecord(undefined)} onSuccess={loadData} />
      )}
    </>
  );
}
