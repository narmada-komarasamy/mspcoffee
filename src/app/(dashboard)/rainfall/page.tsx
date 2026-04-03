"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Card, CardContent } from "@/components/ui/card";
import {
  Droplets,
  Mountain,
  Calendar,
  CloudRain,
  TrendingUp,
} from "lucide-react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

type RainfallRow = {
  id: number;
  date: string;
  estate: string;
  rainfall_mm: number;
  inches: number;
  // derived client-side from date string (table no longer has generated columns)
  year: number;
  month: number;
};

const ESTATE_COLORS: Record<string, string> = {
  Gowri: "#38bdf8",
  "Hidden Falls": "#f87171",
  Moganad: "#4ade80",
  Orchardale: "#fbbf24",
  Stanmore: "#a78bfa",
  Vyapurikuttai: "#fb923c",
};

const ESTATES = Object.keys(ESTATE_COLORS);

const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

export default function RainfallPage() {
  const [data, setData] = useState<RainfallRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [chartMode, setChartMode] = useState<"monthly" | "yearly">("monthly");
  const [selectedEstates, setSelectedEstates] = useState<Set<string>>(
    new Set(ESTATES)
  );
  const [userEstate, setUserEstate] = useState<string | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem("msp_user");
    if (stored) {
      const u = JSON.parse(stored);
      if (u.role === "supervisor" && u.estate) {
        setUserEstate(u.estate);
        setSelectedEstates(new Set([u.estate]));
      }
    }
  }, []);

  useEffect(() => {
    supabase
      .from("rainfall")
      .select("*")
      .order("date", { ascending: true })
      .then(({ data: rows }) => {
        // Derive year and month from the date string (YYYY-MM-DD) client-side
        const normalized = (rows ?? []).map((r) => {
          const [y, m] = r.date.split("-").map(Number);
          return { ...r, year: y, month: m };
        });
        setData(normalized);
        if (normalized.length > 0) {
          const years = [...new Set(normalized.map((r) => r.year))];
          setSelectedYear(Math.max(...years));
        }
        setLoading(false);
      });
  }, []);

  const years = useMemo(
    () => [...new Set(data.map((r) => r.year))].sort((a, b) => b - a),
    [data]
  );

  const filtered = useMemo(
    () =>
      data.filter(
        (r) =>
          (selectedYear === null || r.year === selectedYear) &&
          selectedEstates.has(r.estate)
      ),
    [data, selectedYear, selectedEstates]
  );

  // KPIs
  const totalMm = filtered.reduce((s, r) => s + Number(r.rainfall_mm), 0);
  const highestEstate = useMemo(() => {
    const byEstate: Record<string, number> = {};
    filtered.forEach((r) => {
      byEstate[r.estate] = (byEstate[r.estate] ?? 0) + Number(r.rainfall_mm);
    });
    const sorted = Object.entries(byEstate).sort((a, b) => b[1] - a[1]);
    return sorted[0] ?? ["—", 0];
  }, [filtered]);

  const avgPerMonth = useMemo(() => {
    const months = new Set(filtered.map((r) => `${r.year}-${r.month}`));
    return months.size > 0 ? totalMm / months.size : 0;
  }, [filtered, totalMm]);

  const rainyDays = useMemo(() => {
    const days = new Set(
      filtered.filter((r) => Number(r.rainfall_mm) > 0).map((r) => r.date)
    );
    return days.size;
  }, [filtered]);

  // Chart data
  const monthlyChartData = useMemo(() => {
    if (chartMode !== "monthly") return [];
    const map: Record<number, Record<string, number>> = {};
    filtered.forEach((r) => {
      if (!map[r.month]) map[r.month] = {};
      map[r.month][r.estate] = (map[r.month][r.estate] ?? 0) + Number(r.rainfall_mm);
    });
    return Object.entries(map)
      .sort((a, b) => Number(a[0]) - Number(b[0]))
      .map(([m, vals]) => ({ name: MONTH_NAMES[Number(m) - 1], ...vals }));
  }, [filtered, chartMode]);

  const yearlyChartData = useMemo(() => {
    if (chartMode !== "yearly") return [];
    const map: Record<number, Record<string, number>> = {};
    data
      .filter((r) => selectedEstates.has(r.estate))
      .forEach((r) => {
        if (!map[r.year]) map[r.year] = {};
        map[r.year][r.estate] =
          (map[r.year][r.estate] ?? 0) + Number(r.rainfall_mm);
      });
    return Object.entries(map)
      .map(([yr, vals]) => ({ name: yr, ...vals }))
      .sort((a, b) => Number(a.name) - Number(b.name));
  }, [data, selectedEstates, chartMode]);

  const toggleEstate = (estate: string) => {
    if (userEstate) return; // supervisor locked
    setSelectedEstates((prev) => {
      const next = new Set(prev);
      if (next.has(estate)) {
        if (next.size > 1) next.delete(estate);
      } else {
        next.add(estate);
      }
      return next;
    });
  };

  const activeEstates = ESTATES.filter((e) => selectedEstates.has(e));

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Droplets className="h-8 w-8 animate-pulse text-[#86efac]" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Filters row */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Year dropdown */}
        <select
          value={selectedYear ?? ""}
          onChange={(e) =>
            setSelectedYear(e.target.value ? Number(e.target.value) : null)
          }
          className="rounded-lg bg-white/10 border border-white/10 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#86efac]/50"
        >
          <option value="" className="bg-[#14222e]">
            All Years
          </option>
          {years.map((y) => (
            <option key={y} value={y} className="bg-[#14222e]">
              {y}
            </option>
          ))}
        </select>

        {/* Monthly/Yearly toggle */}
        <div className="flex rounded-lg bg-white/10 p-0.5">
          {(["monthly", "yearly"] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => setChartMode(mode)}
              className={`px-3 py-1.5 text-sm rounded-md capitalize transition ${
                chartMode === mode
                  ? "bg-[#86efac] text-[#14222e] font-medium"
                  : "text-white/70 hover:text-white"
              }`}
            >
              {mode}
            </button>
          ))}
        </div>

        {/* Estate filter pills */}
        <div className="flex flex-wrap gap-2 ml-auto">
          {ESTATES.map((estate) => (
            <button
              key={estate}
              onClick={() => toggleEstate(estate)}
              disabled={!!userEstate}
              className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium border transition ${
                selectedEstates.has(estate)
                  ? "border-white/20 text-white"
                  : "border-transparent text-white/30"
              } ${userEstate ? "cursor-default" : "hover:border-white/30"}`}
            >
              <span
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: ESTATE_COLORS[estate] }}
              />
              {estate}
            </button>
          ))}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-white/5 border-white/10 text-white">
          <CardContent className="pt-5 pb-4 px-5">
            <div className="flex items-center gap-2 text-white/60 text-xs mb-1">
              <Droplets className="h-3.5 w-3.5" /> Total Rainfall
            </div>
            <p className="text-2xl font-bold">{totalMm.toFixed(1)} mm</p>
          </CardContent>
        </Card>
        <Card className="bg-white/5 border-white/10 text-white">
          <CardContent className="pt-5 pb-4 px-5">
            <div className="flex items-center gap-2 text-white/60 text-xs mb-1">
              <Mountain className="h-3.5 w-3.5" /> Highest Estate
            </div>
            <p className="text-2xl font-bold">{highestEstate[0]}</p>
            <p className="text-xs text-white/50">
              {Number(highestEstate[1]).toFixed(1)} mm
            </p>
          </CardContent>
        </Card>
        <Card className="bg-white/5 border-white/10 text-white">
          <CardContent className="pt-5 pb-4 px-5">
            <div className="flex items-center gap-2 text-white/60 text-xs mb-1">
              <TrendingUp className="h-3.5 w-3.5" /> Avg / Month
            </div>
            <p className="text-2xl font-bold">{avgPerMonth.toFixed(1)} mm</p>
          </CardContent>
        </Card>
        <Card className="bg-white/5 border-white/10 text-white">
          <CardContent className="pt-5 pb-4 px-5">
            <div className="flex items-center gap-2 text-white/60 text-xs mb-1">
              <CloudRain className="h-3.5 w-3.5" /> Rainy Days
            </div>
            <p className="text-2xl font-bold">{rainyDays}</p>
          </CardContent>
        </Card>
      </div>

      {/* Chart */}
      <Card className="bg-white/5 border-white/10">
        <CardContent className="pt-6 pb-4 px-2 sm:px-4">
          {data.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-white/40">
              <CloudRain className="h-12 w-12 mb-3" />
              <p>No rainfall data yet</p>
              <p className="text-sm">Add records to see charts</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={350}>
              {chartMode === "monthly" ? (
                <LineChart data={monthlyChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                  <XAxis dataKey="name" stroke="rgba(255,255,255,0.4)" fontSize={12} />
                  <YAxis stroke="rgba(255,255,255,0.4)" fontSize={12} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#14222e",
                      border: "1px solid rgba(255,255,255,0.1)",
                      borderRadius: 8,
                      color: "#fff",
                    }}
                  />
                  <Legend />
                  {activeEstates.map((estate) => (
                    <Line
                      key={estate}
                      type="monotone"
                      dataKey={estate}
                      stroke={ESTATE_COLORS[estate]}
                      strokeWidth={2}
                      dot={{ r: 3 }}
                      activeDot={{ r: 5 }}
                    />
                  ))}
                </LineChart>
              ) : (
                <BarChart data={yearlyChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                  <XAxis dataKey="name" stroke="rgba(255,255,255,0.4)" fontSize={12} />
                  <YAxis stroke="rgba(255,255,255,0.4)" fontSize={12} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#14222e",
                      border: "1px solid rgba(255,255,255,0.1)",
                      borderRadius: 8,
                      color: "#fff",
                    }}
                  />
                  <Legend />
                  {activeEstates.map((estate) => (
                    <Bar
                      key={estate}
                      dataKey={estate}
                      fill={ESTATE_COLORS[estate]}
                      radius={[4, 4, 0, 0]}
                    />
                  ))}
                </BarChart>
              )}
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Year cards */}
      {years.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-white/60">Browse by Year</h3>
          <div className="flex flex-wrap gap-3">
            {years.map((y) => {
              const yearTotal = data
                .filter((r) => r.year === y && selectedEstates.has(r.estate))
                .reduce((s, r) => s + Number(r.rainfall_mm), 0);
              return (
                <button
                  key={y}
                  onClick={() => {
                    setSelectedYear(y);
                    setChartMode("monthly");
                  }}
                  className={`rounded-xl px-5 py-3 text-left border transition ${
                    selectedYear === y
                      ? "bg-[#86efac]/15 border-[#86efac]/30"
                      : "bg-white/5 border-white/10 hover:bg-white/10"
                  }`}
                >
                  <p className="text-lg font-bold">{y}</p>
                  <p className="text-xs text-white/50">
                    {yearTotal.toFixed(0)} mm
                  </p>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
