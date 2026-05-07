"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import {
  LineChart, Line,
  BarChart, Bar,
  PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { AlertTriangle, Download, Palette } from "lucide-react";
import { createClient } from "@supabase/supabase-js";
import css from "./ho-fuel.module.css";

const supabase = createClient(
  "https://aeawxovvyvpcjkhyxgcq.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFlYXd4b3Z2eXZwY2praHl4Z2NxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ5NDY1MTgsImV4cCI6MjA5MDUyMjUxOH0.V8Bu91H6lidK1A4qqyPAotp7KFRaF9dm2iEFZvWxWPg"
);

const LOW_STOCK_THRESHOLD = 50_000;

/* ─── Theme ───────────────────────────────────────────────────────────────────── */
type HoThemeConfig = {
  bg: string; surface: string; card: string; border: string; text: string; muted: string;
  teal: string; gold: string; red: string; green: string;
};
type HoColors = { teal: string; gold: string; red: string; green: string };

const HO_THEME_DEFAULT: HoThemeConfig = {
  bg:      "#0d1b2a",
  surface: "#16253a",
  card:    "#1b2a3d",
  border:  "#2a3f5a",
  text:    "#e8edf4",
  muted:   "#7a90b0",
  teal:    "#1fc8c8",
  gold:    "#f5a623",
  red:     "#e8524a",
  green:   "#2ecc71",
};
const PAGE_SIZE = 50;

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const MONTHS_FULL = ["January","February","March","April","May","June","July","August","September","October","November","December"];

type TxRow = {
  id: number; date: string; month: number; year: number;
  transaction_type: "PURCHASE" | "ISSUE";
  fuel_type: "DIESEL" | "PETROL";
  source: string; vehicle_number: string; estate: string;
  vehicle_name: string; qty_l: number; amount: number;
  mode_of_payment: string; receiver_name: string; remarks: string;
};

function fmt(n: number) {
  return n.toLocaleString("en-IN", { maximumFractionDigits: 1 });
}

function fmtCur(n: number) {
  return "₹" + n.toLocaleString("en-IN", { maximumFractionDigits: 0 });
}

// ─────────────────────────────────────────────────────────────────────────────
export default function HoFuelPage() {
  const [tab, setTab] = useState<"overview" | "consumers" | "log" | "entry">("overview");
  const [rows, setRows] = useState<TxRow[]>([]);
  const [loading, setLoading] = useState(true);
  const realtimeRef = useRef(false);

  /* ── Theme ────────────────────────────────────────────────────────────────────── */
  const [theme, setTheme]                       = useState<HoThemeConfig>({ ...HO_THEME_DEFAULT });
  const [showPalettePanel, setShowPalettePanel] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("mspc-ho-theme");
    if (saved) try { setTheme(JSON.parse(saved)); } catch {}
  }, []);

  const updateTheme = useCallback(<K extends keyof HoThemeConfig>(key: K, val: HoThemeConfig[K]) => {
    setTheme(prev => {
      const next = { ...prev, [key]: val };
      localStorage.setItem("mspc-ho-theme", JSON.stringify(next));
      return next;
    });
  }, []);

  const resetTheme = () => {
    setTheme({ ...HO_THEME_DEFAULT });
    localStorage.removeItem("mspc-ho-theme");
  };

  const colors: HoColors = { teal: theme.teal, gold: theme.gold, red: theme.red, green: theme.green };

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

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    if (realtimeRef.current) return;
    realtimeRef.current = true;
    const ch = supabase
      .channel("ho_fuel_log_changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "ho_fuel_log" }, () => loadData())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [loadData]);

  const totals = useMemo(() => {
    let dP = 0, dI = 0, pP = 0, pI = 0, amt = 0;
    for (const r of rows) {
      if (r.fuel_type === "DIESEL") {
        if (r.transaction_type === "PURCHASE") { dP += r.qty_l; amt += r.amount; }
        else dI += r.qty_l;
      } else {
        if (r.transaction_type === "PURCHASE") { pP += r.qty_l; amt += r.amount; }
        else pI += r.qty_l;
      }
    }
    return { dP, dI, pP, pI, amt,
      dieselStock: dP - dI, petrolStock: pP - pI,
      totalPurchased: dP + pP, totalIssued: dI + pI };
  }, [rows]);

  if (loading) return <div className={css.loading}>Loading HO Fuel data…</div>;

  return (
    <div style={{
      "--t-bg":      theme.bg,
      "--t-surface": theme.surface,
      "--t-card":    theme.card,
      "--t-border":  theme.border,
      "--t-text":    theme.text,
      "--t-muted":   theme.muted,
      "--t-teal":    theme.teal,
    } as React.CSSProperties}>
      <div className={css.tabs}>
        {([
          ["overview",  "📊 Overview"],
          ["consumers", "🔥 Consumers"],
          ["log",       "📋 Transaction Log"],
          ["entry",     "➕ Log Fuel Entry"],
        ] as const).map(([t, label]) => (
          <button
            key={t}
            className={`${css.tab} ${tab === t ? css.tabActive : ""}`}
            onClick={() => setTab(t)}
          >
            {label}
          </button>
        ))}
        <button
          className={`${css.paletteBtn} ${showPalettePanel ? css.paletteBtnActive : ""}`}
          onClick={() => setShowPalettePanel(v => !v)}
          style={{ marginLeft: "auto" }}
        >
          <Palette size={13} /> Colours
        </button>
      </div>

      {tab === "overview"  && <OverviewTab  rows={rows} totals={totals} colors={colors} />}
      {tab === "consumers" && <ConsumersTab rows={rows} colors={colors} />}
      {tab === "log"       && <LogTab       rows={rows} />}
      {tab === "entry"     && <EntryTab     rows={rows} onSaved={loadData} />}

      {/* ── Colour Customiser Panel ───────────────────────────────────────────── */}
      {showPalettePanel && (
        <div className={css.cpOverlay} onClick={() => setShowPalettePanel(false)} />
      )}
      <div className={`${css.cpPanel} ${showPalettePanel ? css.cpPanelOpen : ""}`}>
        <button className={css.cpTab} onClick={() => setShowPalettePanel(v => !v)} title="Colour Customiser">
          <Palette size={18} />
        </button>
        <div className={css.cpBody}>
          <div className={css.cpHeader}>
            <span>🎨</span>
            <span className={css.cpTitle}>Colour Customiser</span>
          </div>

          <div className={css.cpSectionTitle}>Theme</div>
          {([
            { key: "bg",      label: "Background"       },
            { key: "surface", label: "Surface / Cards"  },
            { key: "card",    label: "Inner Cards"       },
            { key: "border",  label: "Borders"           },
            { key: "text",    label: "Body Text"         },
            { key: "muted",   label: "Muted Labels"      },
          ] as { key: keyof HoThemeConfig; label: string }[]).map(({ key, label }) => (
            <label key={key} className={css.cpRow}>
              <span className={css.cpLabel}>{label}</span>
              <span className={css.cpSwatch} style={{ backgroundColor: theme[key] as string }}>
                <input type="color" value={theme[key] as string}
                  onChange={e => updateTheme(key, e.target.value)}
                  className={css.cpColorInput} />
              </span>
            </label>
          ))}

          <div className={css.cpSectionTitle}>KPI Accents</div>
          {([
            { key: "teal",  label: "Teal / Petrol"   },
            { key: "gold",  label: "Gold / Diesel"   },
            { key: "red",   label: "Red / Issue"     },
            { key: "green", label: "Green / Purchase"},
          ] as { key: keyof HoThemeConfig; label: string }[]).map(({ key, label }) => (
            <label key={key} className={css.cpRow}>
              <span className={css.cpLabel}>{label}</span>
              <span className={css.cpSwatch} style={{ backgroundColor: theme[key] as string }}>
                <input type="color" value={theme[key] as string}
                  onChange={e => updateTheme(key, e.target.value)}
                  className={css.cpColorInput} />
              </span>
            </label>
          ))}

          <button className={css.cpResetBtn} onClick={resetTheme}>↺ Reset to defaults</button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// OVERVIEW TAB
// ─────────────────────────────────────────────────────────────────────────────
function OverviewTab({ rows, totals, colors }: {
  rows: TxRow[];
  totals: { dP:number; dI:number; pP:number; pI:number; amt:number;
            dieselStock:number; petrolStock:number; totalPurchased:number; totalIssued:number };
  colors: HoColors;
}) {
  const { teal, gold, red, green } = colors;
  const { dP, dI, pP, pI, amt, dieselStock, petrolStock, totalPurchased, totalIssued } = totals;

  const lowDiesel = dieselStock < LOW_STOCK_THRESHOLD;
  const lowPetrol = petrolStock < LOW_STOCK_THRESHOLD;

  // Timeline — monthly
  const timelineData = useMemo(() => {
    const map = new Map<string, { purchase: number; issued: number }>();
    for (const r of rows) {
      const key = `${r.year}-${String(r.month).padStart(2,"0")}`;
      const cur = map.get(key) ?? { purchase: 0, issued: 0 };
      if (r.transaction_type === "PURCHASE") cur.purchase += r.qty_l;
      else cur.issued += r.qty_l;
      map.set(key, cur);
    }
    let running = 0;
    return Array.from(map.entries()).sort().map(([key, v]) => {
      running += v.purchase - v.issued;
      const [y, m] = key.split("-");
      return {
        label: MONTHS[parseInt(m)-1] + " " + y.slice(2),
        purchase: Math.round(v.purchase * 10) / 10,
        issued: Math.round(v.issued * 10) / 10,
        stock: Math.round(running * 10) / 10,
      };
    });
  }, [rows]);

  // Estate issues
  const estateData = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of rows) {
      if (r.transaction_type === "ISSUE" && r.estate)
        map.set(r.estate, (map.get(r.estate) ?? 0) + r.qty_l);
    }
    return Array.from(map.entries())
      .sort(([,a],[,b]) => b - a).slice(0, 8)
      .map(([estate, qty]) => ({ estate, qty: Math.round(qty*10)/10 }));
  }, [rows]);
  const maxEstate = estateData[0]?.qty ?? 1;

  // Diesel vs Petrol pie
  const fuelSplitData = [
    { name: "Diesel", value: Math.round(dI * 10) / 10, color: gold },
    { name: "Petrol", value: Math.round(pI * 10) / 10, color: teal },
  ].filter(d => d.value > 0);

  // Monthly summary — oldest first, TOTAL row
  const monthlySummary = useMemo(() => {
    const map = new Map<string, { dP:number; pP:number; dI:number; pI:number }>();
    for (const r of rows) {
      const key = `${r.year}-${String(r.month).padStart(2,"0")}`;
      const cur = map.get(key) ?? { dP:0, pP:0, dI:0, pI:0 };
      if (r.fuel_type === "DIESEL") {
        if (r.transaction_type === "PURCHASE") cur.dP += r.qty_l;
        else cur.dI += r.qty_l;
      } else {
        if (r.transaction_type === "PURCHASE") cur.pP += r.qty_l;
        else cur.pI += r.qty_l;
      }
      map.set(key, cur);
    }
    return Array.from(map.entries()).sort().map(([key, v]) => {
      const [y, m] = key.split("-");
      return {
        label: MONTHS_FULL[parseInt(m)-1] + " " + y,
        dP: v.dP, pP: v.pP, dI: v.dI, pI: v.pI,
        total: v.dI + v.pI,
      };
    });
  }, [rows]);

  const totRow = monthlySummary.reduce(
    (acc, r) => ({ dP: acc.dP+r.dP, pP: acc.pP+r.pP, dI: acc.dI+r.dI, pI: acc.pI+r.pI, total: acc.total+r.total }),
    { dP: 0, pP: 0, dI: 0, pI: 0, total: 0 }
  );

  return (
    <div>
      {/* Alert */}
      {(lowDiesel || lowPetrol) && (
        <div className={css.alertBanner}>
          <AlertTriangle className={css.alertIcon} size={16} />
          {lowDiesel && `Diesel low: ${fmt(dieselStock)}L remaining. `}
          {lowPetrol && `Petrol low: ${fmt(petrolStock)}L remaining.`}
        </div>
      )}

      {/* KPI cards */}
      <div className={css.kpiGrid}>
        {/* Diesel */}
        <div className={css.kpiCard} style={{ "--accent": lowDiesel ? "var(--msp-danger)" : "var(--msp-gold-light)" } as React.CSSProperties}>
          <div className={css.kpiLabel}>⛽ Diesel in Store</div>
          <div>
            <span className={`${css.kpiValue} ${lowDiesel ? css.kpiValueLow : ""}`}>{fmt(dieselStock)}</span>
            <span className={css.kpiUnit}>L</span>
          </div>
          <div className={css.kpiSub}>Purchased: {fmt(dP)}L · Issued: {fmt(dI)}L</div>
          <div className={css.kpiBar}>
            <div className={css.kpiBarFill}
              style={{ width: `${Math.min(100,(dieselStock/LOW_STOCK_THRESHOLD)*100)}%`, background: lowDiesel ? "var(--msp-danger)" : "var(--msp-gold-light)" }} />
          </div>
        </div>
        {/* Petrol */}
        <div className={css.kpiCard} style={{ "--accent": lowPetrol ? "var(--msp-danger)" : "var(--msp-teal)" } as React.CSSProperties}>
          <div className={css.kpiLabel}>🛢️ Petrol in Store</div>
          <div>
            <span className={`${css.kpiValue} ${lowPetrol ? css.kpiValueLow : ""}`}>{fmt(petrolStock)}</span>
            <span className={css.kpiUnit}>L</span>
          </div>
          <div className={css.kpiSub}>Purchased: {fmt(pP)}L · Issued: {fmt(pI)}L</div>
          <div className={css.kpiBar}>
            <div className={css.kpiBarFill}
              style={{ width: `${Math.min(100,(petrolStock/LOW_STOCK_THRESHOLD)*100)}%`, background: lowPetrol ? "var(--msp-danger)" : "var(--msp-teal)" }} />
          </div>
        </div>
        {/* Total Purchased */}
        <div className={css.kpiCard} style={{ "--accent": "var(--msp-green)" } as React.CSSProperties}>
          <div className={css.kpiLabel}>📥 Total Purchased</div>
          <div>
            <span className={css.kpiValue}>{fmt(totalPurchased)}</span>
            <span className={css.kpiUnit}>L</span>
          </div>
          <div className={css.kpiSub}>All time · Diesel + Petrol</div>
          <div className={css.kpiBar}>
            <div className={css.kpiBarFill} style={{ width: "100%", background: "var(--msp-green)" }} />
          </div>
        </div>
        {/* Total Issued */}
        <div className={css.kpiCard} style={{ "--accent": "var(--msp-danger)" } as React.CSSProperties}>
          <div className={css.kpiLabel}>📤 Total Issued</div>
          <div>
            <span className={css.kpiValue}>{fmt(totalIssued)}</span>
            <span className={css.kpiUnit}>L</span>
          </div>
          <div className={css.kpiSub}>All time · Diesel + Petrol</div>
          <div className={css.kpiBar}>
            <div className={css.kpiBarFill}
              style={{ width: totalPurchased > 0 ? `${Math.min(100,(totalIssued/totalPurchased)*100)}%` : "0%", background: "var(--msp-danger)" }} />
          </div>
        </div>
      </div>

      {/* Timeline chart */}
      <div className={css.sectionHdr}><span>◆</span> PURCHASE vs ISSUE OVER TIME</div>
      <div className={`${css.chartCard} ${css.chartsFullRow}`}>
        <div className={css.chartSubTitle}>Daily Fuel Flow (Litres) — Purchases into store vs Issues to fleet</div>
        <div className={css.legendRow}>
          <span className={css.legendDot}><span className={css.dot} style={{ background: "var(--msp-green)" }} />Purchased (L)</span>
          <span className={css.legendDot}><span className={css.dot} style={{ background: "var(--msp-gold-light)" }} />Issued (L)</span>
          <span className={css.legendDot}><span className={css.dot} style={{ background: "var(--msp-teal)" }} />Running Stock (L)</span>
        </div>
        {timelineData.length > 0 ? (
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={timelineData} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="label" tick={{ fill: "var(--msp-neutral)", fontSize: 10 }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fill: "var(--msp-neutral)", fontSize: 10 }} tickLine={false} axisLine={false}
                tickFormatter={(v) => v >= 1000 ? `${(v/1000).toFixed(0)}k` : `${v}`} />
              <Tooltip
                contentStyle={{ background: "var(--msp-navy-mid)", border: "1px solid var(--msp-navy-border)", borderRadius: 8, fontSize: 12 }}
                labelStyle={{ color: "var(--msp-text)", fontWeight: 600 }}
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                formatter={(v: any, name: any) => [`${fmt(Number(v))} L`, name]}
              />
              <Line type="monotone" dataKey="purchase" stroke="var(--msp-green)" strokeWidth={2} dot={false} name="Purchased (L)" />
              <Line type="monotone" dataKey="issued"   stroke="var(--msp-gold-light)" strokeWidth={2} dot={false} name="Issued (L)" strokeDasharray="4 2" />
              <Line type="monotone" dataKey="stock"    stroke="var(--msp-teal)" strokeWidth={2} dot={false} name="Running Stock (L)" />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className={css.empty}>No data</div>
        )}
      </div>

      {/* Estate + Diesel vs Petrol */}
      <div className={css.charts2col}>
        {/* Consumption by Estate */}
        <div className={css.chartCard}>
          <div className={css.sectionHdr}><span>◆</span> CONSUMPTION BY ESTATE</div>
          {estateData.length > 0 ? (
            <div className={css.estateList}>
              {estateData.map((e) => (
                <div key={e.estate} className={css.estateRow}>
                  <div className={css.estateRowTop}>
                    <span className={css.estateName}>{e.estate || "Unknown"}</span>
                    <span className={css.estateQty}>{fmt(e.qty)} L</span>
                  </div>
                  <div className={css.estateBarBg}>
                    <div className={css.estateBarFill} style={{ width: `${(e.qty/maxEstate)*100}%` }} />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className={css.empty}>No issue data</div>
          )}
        </div>

        {/* Diesel vs Petrol Issued */}
        <div className={css.chartCard}>
          <div className={css.sectionHdr}><span>◆</span> DIESEL vs PETROL ISSUED</div>
          {fuelSplitData.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={fuelSplitData}
                    cx="50%" cy="50%"
                    innerRadius={55} outerRadius={85}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {fuelSplitData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ background: "var(--msp-navy-mid)", border: "1px solid var(--msp-navy-border)", borderRadius: 8, fontSize: 12 }}
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    formatter={(v: any) => [`${fmt(Number(v))} L`]}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className={css.pieLegendRow}>
                {fuelSplitData.map((d) => {
                  const total = fuelSplitData.reduce((a,b) => a + b.value, 0);
                  const pct = total > 0 ? Math.round((d.value/total)*100) : 0;
                  return (
                    <div key={d.name} className={css.pieLegendItem}>
                      <span className={css.pieLegendDot} style={{ background: d.color }} />
                      <div>
                        <div>{d.name} — {fmt(d.value)} L</div>
                        <div className={css.pieLegendSub}>{pct}% of total issues</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <div className={css.empty}>No issue data</div>
          )}
        </div>
      </div>

      {/* Monthly Summary */}
      <div className={css.sectionHdr}><span>◆</span> MONTHLY SUMMARY</div>
      <div className={css.tableCard}>
        {monthlySummary.length > 0 ? (
          <table className={css.table}>
            <thead>
              <tr>
                <th>Month</th>
                <th className={css.tdRight}>Diesel Purchased (L)</th>
                <th className={css.tdRight}>Petrol Purchased (L)</th>
                <th className={css.tdRight}>Diesel Issued (L)</th>
                <th className={css.tdRight}>Petrol Issued (L)</th>
                <th className={css.tdRight}>Total Issued (L)</th>
              </tr>
            </thead>
            <tbody>
              {monthlySummary.map((m) => (
                <tr key={m.label}>
                  <td>{m.label}</td>
                  <td className={css.tdNum}>{fmt(m.dP)}</td>
                  <td className={css.tdNum}>{fmt(m.pP)}</td>
                  <td className={css.tdNum}>{fmt(m.dI)}</td>
                  <td className={css.tdNum}>{fmt(m.pI)}</td>
                  <td className={css.tdNum}>{fmt(m.total)}</td>
                </tr>
              ))}
              <tr className={css.totalRow}>
                <td>TOTAL</td>
                <td className={css.tdNum}>{fmt(totRow.dP)}</td>
                <td className={css.tdNum}>{fmt(totRow.pP)}</td>
                <td className={css.tdNum}>{fmt(totRow.dI)}</td>
                <td className={css.tdNum}>{fmt(totRow.pI)}</td>
                <td className={css.tdNum}>{fmt(totRow.total)}</td>
              </tr>
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
function ConsumersTab({ rows, colors }: { rows: TxRow[]; colors: HoColors }) {
  const { teal, gold } = colors;
  const [filterMonth, setFilterMonth] = useState("ALL");
  const [filterFuel,  setFilterFuel]  = useState("ALL");
  const [filterEstate,setFilterEstate]= useState("ALL");

  const estates = useMemo(() => {
    const s = new Set<string>();
    rows.forEach((r) => { if (r.estate) s.add(r.estate); });
    return Array.from(s).sort();
  }, [rows]);

  const filtered = useMemo(() => rows.filter((r) => {
    if (r.transaction_type !== "ISSUE") return false;
    if (filterMonth !== "ALL" && r.month !== parseInt(filterMonth)) return false;
    if (filterFuel  !== "ALL" && r.fuel_type !== filterFuel)  return false;
    if (filterEstate !== "ALL" && r.estate !== filterEstate)  return false;
    return true;
  }), [rows, filterMonth, filterFuel, filterEstate]);

  const estateBreakdown = useMemo(() => {
    const map = new Map<string, { diesel:number; petrol:number }>();
    for (const r of filtered) {
      const key = r.estate || "Unknown";
      const cur = map.get(key) ?? { diesel:0, petrol:0 };
      if (r.fuel_type === "DIESEL") cur.diesel += r.qty_l;
      else cur.petrol += r.qty_l;
      map.set(key, cur);
    }
    return Array.from(map.entries())
      .sort(([,a],[,b]) => (b.diesel+b.petrol)-(a.diesel+a.petrol))
      .map(([estate,v]) => ({
        estate, diesel: Math.round(v.diesel*10)/10, petrol: Math.round(v.petrol*10)/10,
        total: Math.round((v.diesel+v.petrol)*10)/10,
      }));
  }, [filtered]);

  const vehicleBreakdown = useMemo(() => {
    const map = new Map<string, { diesel:number; petrol:number; estate:string }>();
    for (const r of filtered) {
      const key = r.vehicle_number || r.vehicle_name || "Unknown";
      const cur = map.get(key) ?? { diesel:0, petrol:0, estate: r.estate };
      if (r.fuel_type === "DIESEL") cur.diesel += r.qty_l;
      else cur.petrol += r.qty_l;
      map.set(key, cur);
    }
    const grandTotal = Array.from(map.values()).reduce((a,b) => a + b.diesel + b.petrol, 0);
    return Array.from(map.entries())
      .sort(([,a],[,b]) => (b.diesel+b.petrol)-(a.diesel+a.petrol))
      .slice(0, 15)
      .map(([vehicle, v], i) => ({
        rank: i + 1, vehicle, estate: v.estate,
        diesel: Math.round(v.diesel*10)/10, petrol: Math.round(v.petrol*10)/10,
        total: Math.round((v.diesel+v.petrol)*10)/10,
        pct: grandTotal > 0 ? Math.round(((v.diesel+v.petrol)/grandTotal)*1000)/10 : 0,
      }));
  }, [filtered]);

  return (
    <div>
      <div className={css.filterBar}>
        <div className={css.ctrlGrp}>
          <span className={css.ctrlLbl}>Month</span>
          <select className={css.sel} value={filterMonth} onChange={(e) => setFilterMonth(e.target.value)}>
            <option value="ALL">All Months</option>
            {MONTHS_FULL.map((m,i) => <option key={m} value={String(i+1)}>{m}</option>)}
          </select>
        </div>
        <div className={css.ctrlGrp}>
          <span className={css.ctrlLbl}>Fuel Type</span>
          <select className={css.sel} value={filterFuel} onChange={(e) => setFilterFuel(e.target.value)}>
            <option value="ALL">Diesel + Petrol</option>
            <option value="DIESEL">Diesel Only</option>
            <option value="PETROL">Petrol Only</option>
          </select>
        </div>
        <div className={css.ctrlGrp}>
          <span className={css.ctrlLbl}>Estate</span>
          <select className={css.sel} value={filterEstate} onChange={(e) => setFilterEstate(e.target.value)}>
            <option value="ALL">All Estates</option>
            {estates.map((e) => <option key={e} value={e}>{e}</option>)}
          </select>
        </div>
      </div>

      <div className={css.consumerGrid}>
        {/* Top consumers bar chart */}
        <div className={css.chartCard}>
          <div className={css.sectionHdr}><span>◆</span> TOP CONSUMERS — VEHICLE / EQUIPMENT</div>
          <div className={css.chartSubTitle}>Litres issued per vehicle/equipment</div>
          {vehicleBreakdown.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart
                data={vehicleBreakdown.slice(0,10)}
                layout="vertical"
                margin={{ top: 4, right: 16, bottom: 4, left: 100 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" horizontal={false} />
                <XAxis type="number" tick={{ fill: "var(--msp-neutral)", fontSize: 10 }} tickLine={false} axisLine={false}
                  tickFormatter={(v) => `${v}L`} />
                <YAxis type="category" dataKey="vehicle" tick={{ fill: "var(--msp-text)", fontSize: 10 }}
                  tickLine={false} axisLine={false} width={98} />
                <Tooltip
                  contentStyle={{ background: "var(--msp-navy-mid)", border: "1px solid var(--msp-navy-border)", borderRadius: 8, fontSize: 12 }}
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  formatter={(v: any, name: any) => [`${fmt(Number(v))} L`, name]}
                />
                <Bar dataKey="diesel" name="Diesel" fill="var(--msp-gold-light)" radius={[0,3,3,0]} stackId="a" />
                <Bar dataKey="petrol" name="Petrol" fill="var(--msp-teal)" radius={[0,3,3,0]} stackId="a" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className={css.empty}>No data</div>
          )}
        </div>

        {/* Consumption by estate */}
        <div className={css.chartCard}>
          <div className={css.sectionHdr}><span>◆</span> CONSUMPTION BY ESTATE</div>
          {estateBreakdown.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart
                data={estateBreakdown}
                layout="vertical"
                margin={{ top: 4, right: 16, bottom: 4, left: 80 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" horizontal={false} />
                <XAxis type="number" tick={{ fill: "var(--msp-neutral)", fontSize: 10 }} tickLine={false} axisLine={false}
                  tickFormatter={(v) => `${v}L`} />
                <YAxis type="category" dataKey="estate" tick={{ fill: "var(--msp-text)", fontSize: 10 }}
                  tickLine={false} axisLine={false} width={78} />
                <Tooltip
                  contentStyle={{ background: "var(--msp-navy-mid)", border: "1px solid var(--msp-navy-border)", borderRadius: 8, fontSize: 12 }}
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  formatter={(v: any, name: any) => [`${fmt(Number(v))} L`, name]}
                />
                <Bar dataKey="diesel" name="Diesel" fill="var(--msp-gold-light)" radius={[0,3,3,0]} stackId="a" />
                <Bar dataKey="petrol" name="Petrol" fill="var(--msp-teal)" radius={[0,3,3,0]} stackId="a" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className={css.empty}>No data</div>
          )}
        </div>
      </div>

      {/* Consumer breakdown table */}
      <div className={css.sectionHdr}><span>◆</span> CONSUMER BREAKDOWN TABLE</div>
      <div className={css.tableCard}>
        {vehicleBreakdown.length > 0 ? (
          <table className={css.table}>
            <thead>
              <tr>
                <th>#</th>
                <th>Vehicle / Equipment</th>
                <th>Estate</th>
                <th className={css.tdRight}>Diesel (L)</th>
                <th className={css.tdRight}>Petrol (L)</th>
                <th className={css.tdRight}>Total (L)</th>
                <th className={css.tdRight}>% of Total</th>
              </tr>
            </thead>
            <tbody>
              {vehicleBreakdown.map((v) => (
                <tr key={v.vehicle}>
                  <td style={{ color: "var(--msp-neutral)" }}>{v.rank}</td>
                  <td>{v.vehicle}</td>
                  <td>{v.estate}</td>
                  <td className={css.tdNum} style={{ color: "var(--msp-gold-light)" }}>{fmt(v.diesel)}</td>
                  <td className={css.tdNum} style={{ color: "var(--msp-teal)" }}>{fmt(v.petrol)}</td>
                  <td className={css.tdNum}>{fmt(v.total)}</td>
                  <td className={css.tdNum} style={{ color: "var(--msp-neutral)" }}>{v.pct}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className={css.empty}>No data for selected filters</div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TRANSACTION LOG TAB
// ─────────────────────────────────────────────────────────────────────────────
function LogTab({ rows }: { rows: TxRow[] }) {
  const [filterType,  setFilterType]  = useState("ALL");
  const [filterFuel,  setFilterFuel]  = useState("ALL");
  const [filterMonth, setFilterMonth] = useState("ALL");
  const [filterEstate,setFilterEstate]= useState("ALL");
  const [filterVehicle,setFilterVehicle]=useState("ALL");
  const [search,      setSearch]      = useState("");
  const [page,        setPage]        = useState(0);

  const estates = useMemo(() => {
    const s = new Set<string>();
    rows.forEach((r) => { if (r.estate) s.add(r.estate); });
    return Array.from(s).sort();
  }, [rows]);

  const vehicles = useMemo(() => {
    const s = new Set<string>();
    rows.forEach((r) => { if (r.vehicle_number) s.add(r.vehicle_number); });
    return Array.from(s).sort();
  }, [rows]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return rows.filter((r) => {
      if (filterType    !== "ALL" && r.transaction_type !== filterType) return false;
      if (filterFuel    !== "ALL" && r.fuel_type !== filterFuel)  return false;
      if (filterMonth   !== "ALL" && r.month !== parseInt(filterMonth)) return false;
      if (filterEstate  !== "ALL" && r.estate !== filterEstate)   return false;
      if (filterVehicle !== "ALL" && r.vehicle_number !== filterVehicle) return false;
      if (q) {
        const hay = `${r.vehicle_number} ${r.vehicle_name} ${r.estate} ${r.source} ${r.receiver_name} ${r.remarks}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    }).sort((a,b) => b.date.localeCompare(a.date));
  }, [rows, filterType, filterFuel, filterMonth, filterEstate, filterVehicle, search]);

  const prevFilter = useRef("");
  const filterKey = `${filterType}|${filterFuel}|${filterMonth}|${filterEstate}|${filterVehicle}|${search}`;
  if (prevFilter.current !== filterKey) {
    prevFilter.current = filterKey;
    if (page !== 0) setPage(0);
  }

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageRows   = filtered.slice(page * PAGE_SIZE, (page+1) * PAGE_SIZE);

  const downloadCSV = useCallback(() => {
    const hdr = ["Date","Type","Fuel","Source","Vehicle #","Vehicle Name","Estate","Qty (L)","Amount (₹)","Receiver","Remarks"];
    const body = filtered.map((r) =>
      [r.date,r.transaction_type,r.fuel_type,`"${r.source}"`,`"${r.vehicle_number}"`,
       `"${r.vehicle_name}"`,`"${r.estate}"`,r.qty_l,r.amount,`"${r.receiver_name}"`,`"${r.remarks}"`].join(",")
    );
    const blob = new Blob([[hdr.join(","), ...body].join("\n")], { type: "text/csv" });
    const a = Object.assign(document.createElement("a"), {
      href: URL.createObjectURL(blob),
      download: `ho_fuel_log_${new Date().toISOString().slice(0,10)}.csv`,
    });
    a.click();
    URL.revokeObjectURL(a.href);
  }, [filtered]);

  return (
    <div>
      <div className={css.filterBar}>
        <div className={css.ctrlGrp}>
          <span className={css.ctrlLbl}>Type</span>
          <select className={css.sel} value={filterType} onChange={(e) => setFilterType(e.target.value)}>
            <option value="ALL">All</option>
            <option value="PURCHASE">Purchases Only</option>
            <option value="ISSUE">Issues Only</option>
          </select>
        </div>
        <div className={css.ctrlGrp}>
          <span className={css.ctrlLbl}>Fuel</span>
          <select className={css.sel} value={filterFuel} onChange={(e) => setFilterFuel(e.target.value)}>
            <option value="ALL">All Types</option>
            <option value="DIESEL">Diesel</option>
            <option value="PETROL">Petrol</option>
          </select>
        </div>
        <div className={css.ctrlGrp}>
          <span className={css.ctrlLbl}>Month</span>
          <select className={css.sel} value={filterMonth} onChange={(e) => setFilterMonth(e.target.value)}>
            <option value="ALL">All Months</option>
            {MONTHS_FULL.map((m,i) => <option key={m} value={String(i+1)}>{m}</option>)}
          </select>
        </div>
        <div className={css.ctrlGrp}>
          <span className={css.ctrlLbl}>Vehicle / Equipment</span>
          <select className={css.sel} value={filterVehicle} onChange={(e) => setFilterVehicle(e.target.value)}>
            <option value="ALL">All</option>
            {vehicles.map((v) => <option key={v} value={v}>{v}</option>)}
          </select>
        </div>
        <div className={css.ctrlGrp}>
          <span className={css.ctrlLbl}>Estate</span>
          <select className={css.sel} value={filterEstate} onChange={(e) => setFilterEstate(e.target.value)}>
            <option value="ALL">All Estates</option>
            {estates.map((e) => <option key={e} value={e}>{e}</option>)}
          </select>
        </div>
        <div className={css.ctrlGrp}>
          <span className={css.ctrlLbl}>Search</span>
          <input className={css.searchInput} placeholder="Search…" value={search}
            onChange={(e) => setSearch(e.target.value)} />
        </div>
        <button className={css.exportBtn} onClick={downloadCSV}>
          <Download size={13} /> Export CSV
        </button>
      </div>

      <div style={{ fontSize: "0.8125rem", color: "var(--msp-neutral)", marginBottom: "0.875rem" }}>
        {filtered.length} transaction{filtered.length !== 1 ? "s" : ""} found
      </div>

      <div className={css.tableCard} style={{ marginBottom: "1rem" }}>
        <table className={css.table}>
          <thead>
            <tr>
              <th>Date</th><th>Type</th><th>Fuel</th><th>Source</th>
              <th>Vehicle / Equipment</th><th>Estate</th><th>Vehicle Name</th>
              <th className={css.tdRight}>Qty (L)</th>
              <th className={css.tdRight}>Rate (₹)</th>
              <th>Remarks</th>
            </tr>
          </thead>
          <tbody>
            {pageRows.length === 0 ? (
              <tr><td colSpan={10} style={{ textAlign:"center", color:"var(--msp-neutral)", padding:"2.5rem" }}>
                No transactions match the selected filters
              </td></tr>
            ) : pageRows.map((r) => (
              <tr key={r.id}>
                <td style={{ whiteSpace:"nowrap" }}>{r.date}</td>
                <td><span className={r.transaction_type === "PURCHASE" ? css.badgePurchase : css.badgeIssue}>{r.transaction_type}</span></td>
                <td><span className={r.fuel_type === "DIESEL" ? css.badgeDiesel : css.badgePetrol}>{r.fuel_type}</span></td>
                <td>{r.source}</td>
                <td>{r.vehicle_number}</td>
                <td>{r.estate}</td>
                <td>{r.vehicle_name}</td>
                <td className={css.tdNum}>{fmt(r.qty_l)}</td>
                <td className={css.tdNum}>{r.amount > 0 ? fmtCur(r.amount) : "—"}</td>
                <td style={{ color:"var(--msp-neutral)", fontSize:"0.75rem" }}>{r.remarks}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className={css.pagination}>
        <button className={css.pageBtn} disabled={page===0} onClick={() => setPage(0)}>«</button>
        <button className={css.pageBtn} disabled={page===0} onClick={() => setPage(p=>p-1)}>‹</button>
        <span>Page {page+1} / {totalPages}</span>
        <button className={css.pageBtn} disabled={page>=totalPages-1} onClick={() => setPage(p=>p+1)}>›</button>
        <button className={css.pageBtn} disabled={page>=totalPages-1} onClick={() => setPage(totalPages-1)}>»</button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ENTRY TAB
// ─────────────────────────────────────────────────────────────────────────────
function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}

const EMPTY_PURCHASE = { date: todayStr(), fuel_type: "DIESEL", source: "", qty_l: "", amount: "", mode_of_payment: "", remarks: "" };
const EMPTY_ISSUE    = { date: todayStr(), fuel_type: "PETROL", vehicle_number: "", vehicle_name: "", estate: "", qty_l: "", receiver_name: "", source: "HO STORE", remarks: "" };

function EntryTab({ rows, onSaved }: { rows: TxRow[]; onSaved: () => void }) {
  const [sessionCount, setSessionCount] = useState(0);
  const [purchase, setPurchase] = useState({ ...EMPTY_PURCHASE });
  const [issue,    setIssue]    = useState({ ...EMPTY_ISSUE });
  const [pMsg, setPMsg] = useState<{ type: "success"|"error"; text: string } | null>(null);
  const [iMsg, setIMsg] = useState<{ type: "success"|"error"; text: string } | null>(null);
  const [pSaving, setPSaving] = useState(false);
  const [iSaving, setISaving] = useState(false);

  const estates  = useMemo(() => Array.from(new Set(rows.filter(r=>r.estate).map(r=>r.estate))).sort(), [rows]);
  const vehicles = useMemo(() => Array.from(new Set(rows.filter(r=>r.vehicle_number).map(r=>r.vehicle_number))).sort(), [rows]);

  function parseDate(s: string) {
    const d = new Date(s);
    return { date: s, month: d.getMonth()+1, year: d.getFullYear() };
  }

  async function savePurchase() {
    if (!purchase.date || !purchase.source || !purchase.qty_l) {
      setPMsg({ type:"error", text:"Date, Supplier/Source and Quantity are required." }); return;
    }
    setPSaving(true); setPMsg(null);
    const { date, month, year } = parseDate(purchase.date);
    const { error } = await supabase.from("ho_fuel_log").insert([{
      date, month, year,
      transaction_type: "PURCHASE",
      fuel_type: purchase.fuel_type,
      source: purchase.source.trim(),
      vehicle_number: "", estate: "", vehicle_name: "",
      qty_l: parseFloat(purchase.qty_l),
      amount: parseFloat(purchase.amount || "0") || 0,
      mode_of_payment: purchase.mode_of_payment.trim(),
      receiver_name: "",
      remarks: purchase.remarks.trim(),
    }]);
    setPSaving(false);
    if (error) { setPMsg({ type:"error", text: error.message }); }
    else {
      setPMsg({ type:"success", text: `✓ Purchase saved — ${purchase.qty_l} L of ${purchase.fuel_type} on ${purchase.date}` });
      setSessionCount(c => c+1);
      setPurchase({ ...EMPTY_PURCHASE, date: purchase.date, fuel_type: purchase.fuel_type });
      onSaved();
    }
  }

  async function saveIssue() {
    if (!issue.date || !issue.vehicle_number || !issue.estate || !issue.qty_l) {
      setIMsg({ type:"error", text:"Date, Vehicle/Equipment, Estate and Quantity are required." }); return;
    }
    setISaving(true); setIMsg(null);
    const { date, month, year } = parseDate(issue.date);
    const { error } = await supabase.from("ho_fuel_log").insert([{
      date, month, year,
      transaction_type: "ISSUE",
      fuel_type: issue.fuel_type,
      source: "HO STORE",
      vehicle_number: issue.vehicle_number.trim(),
      vehicle_name: issue.vehicle_name.trim(),
      estate: issue.estate,
      qty_l: parseFloat(issue.qty_l),
      amount: 0,
      mode_of_payment: "",
      receiver_name: issue.receiver_name.trim(),
      remarks: issue.remarks.trim(),
    }]);
    setISaving(false);
    if (error) { setIMsg({ type:"error", text: error.message }); }
    else {
      setIMsg({ type:"success", text: `✓ Issue saved — ${issue.qty_l} L of ${issue.fuel_type} to ${issue.vehicle_number}` });
      setSessionCount(c => c+1);
      setIssue({ ...EMPTY_ISSUE, date: issue.date, fuel_type: issue.fuel_type });
      onSaved();
    }
  }

  return (
    <div>
      {/* Save bar */}
      <div className={css.saveBar}>
        <div>
          <span className={css.saveDot} />
          {sessionCount === 0
            ? <span className={css.saveLabel}>No new entries saved yet this session</span>
            : <span className={css.saveLabelCount}>{sessionCount} entr{sessionCount === 1 ? "y" : "ies"} saved this session</span>
          }
        </div>
        <div className={css.saveBarActions}>
          <button className={css.btnDanger} onClick={() => { setSessionCount(0); setPMsg(null); setIMsg(null); }}>
            🗑 Clear Session Count
          </button>
        </div>
      </div>

      <div className={css.entryGrid}>
        {/* ── PURCHASE FORM ── */}
        <div>
          <div className={css.sectionHdr}><span>◆</span> LOG FUEL PURCHASE (INTO STORE)</div>
          <div className={css.formCard}>
            <div className={css.formGrid}>
              <div className={css.formGroup}>
                <label className={css.formLabel}>Date *</label>
                <input type="date" className={css.formInput} value={purchase.date}
                  onChange={e => setPurchase(p=>({...p, date:e.target.value}))} />
              </div>
              <div className={css.formGroup}>
                <label className={css.formLabel}>Fuel Type *</label>
                <select className={css.formInput} value={purchase.fuel_type}
                  onChange={e => setPurchase(p=>({...p, fuel_type:e.target.value}))}>
                  <option value="DIESEL">Diesel</option>
                  <option value="PETROL">Petrol</option>
                </select>
              </div>
              <div className={css.formGroup}>
                <label className={css.formLabel}>Supplier / Source *</label>
                <input type="text" className={css.formInput} placeholder="e.g. Shanmugha Traders"
                  value={purchase.source}
                  onChange={e => setPurchase(p=>({...p, source:e.target.value}))} />
              </div>
              <div className={css.formGroup}>
                <label className={css.formLabel}>Quantity (Litres) *</label>
                <input type="number" className={css.formInput} placeholder="e.g. 200" min="0" step="0.5"
                  value={purchase.qty_l}
                  onChange={e => setPurchase(p=>({...p, qty_l:e.target.value}))} />
              </div>
              <div className={css.formGroup}>
                <label className={css.formLabel}>Total Cost (₹)</label>
                <input type="number" className={css.formInput} placeholder="e.g. 18500" min="0"
                  value={purchase.amount}
                  onChange={e => setPurchase(p=>({...p, amount:e.target.value}))} />
              </div>
              <div className={css.formGroup}>
                <label className={css.formLabel}>Mode of Payment</label>
                <input type="text" className={css.formInput} placeholder="e.g. Cash / UPI"
                  value={purchase.mode_of_payment}
                  onChange={e => setPurchase(p=>({...p, mode_of_payment:e.target.value}))} />
              </div>
              <div className={css.formGroupFull}>
                <label className={css.formLabel}>Remarks</label>
                <textarea className={css.formTextarea} placeholder="Any notes…"
                  value={purchase.remarks}
                  onChange={e => setPurchase(p=>({...p, remarks:e.target.value}))} />
              </div>
            </div>
            <div className={css.formActions}>
              <button className={css.btnSave} disabled={pSaving} onClick={savePurchase}>
                {pSaving ? "Saving…" : "✅ Save Purchase"}
              </button>
              <button className={css.btnClear} onClick={() => { setPurchase({...EMPTY_PURCHASE}); setPMsg(null); }}>
                Clear
              </button>
            </div>
            {pMsg && (
              <div className={`${css.formMsg} ${pMsg.type === "success" ? css.formMsgSuccess : css.formMsgError}`}>
                {pMsg.text}
              </div>
            )}
          </div>
        </div>

        {/* ── ISSUE FORM ── */}
        <div>
          <div className={css.sectionHdr}><span>◆</span> LOG FUEL ISSUE (FROM STORE)</div>
          <div className={css.formCard}>
            <div className={css.formGrid}>
              <div className={css.formGroup}>
                <label className={css.formLabel}>Date *</label>
                <input type="date" className={css.formInput} value={issue.date}
                  onChange={e => setIssue(i=>({...i, date:e.target.value}))} />
              </div>
              <div className={css.formGroup}>
                <label className={css.formLabel}>Fuel Type *</label>
                <select className={css.formInput} value={issue.fuel_type}
                  onChange={e => setIssue(i=>({...i, fuel_type:e.target.value}))}>
                  <option value="PETROL">Petrol</option>
                  <option value="DIESEL">Diesel</option>
                </select>
              </div>
              <div className={css.formGroup}>
                <label className={css.formLabel}>Vehicle / Equipment *</label>
                <input type="text" className={css.formInput} placeholder="— Select or type —"
                  list="vehicle-list"
                  value={issue.vehicle_number}
                  onChange={e => setIssue(i=>({...i, vehicle_number:e.target.value}))} />
                <datalist id="vehicle-list">
                  {vehicles.map(v => <option key={v} value={v} />)}
                </datalist>
              </div>
              <div className={css.formGroup}>
                <label className={css.formLabel}>Estate *</label>
                <select className={css.formInput} value={issue.estate}
                  onChange={e => setIssue(i=>({...i, estate:e.target.value}))}>
                  <option value="">— Select —</option>
                  {estates.map(e => <option key={e} value={e}>{e}</option>)}
                </select>
              </div>
              <div className={css.formGroup}>
                <label className={css.formLabel}>Vehicle Name</label>
                <input type="text" className={css.formInput} placeholder="e.g. Hero Impulse"
                  value={issue.vehicle_name}
                  onChange={e => setIssue(i=>({...i, vehicle_name:e.target.value}))} />
              </div>
              <div className={css.formGroup}>
                <label className={css.formLabel}>Quantity (Litres) *</label>
                <input type="number" className={css.formInput} placeholder="e.g. 5" min="0" step="0.5"
                  value={issue.qty_l}
                  onChange={e => setIssue(i=>({...i, qty_l:e.target.value}))} />
              </div>
              <div className={css.formGroup}>
                <label className={css.formLabel}>Received By</label>
                <input type="text" className={css.formInput} placeholder="Name of receiver"
                  value={issue.receiver_name}
                  onChange={e => setIssue(i=>({...i, receiver_name:e.target.value}))} />
              </div>
              <div className={css.formGroup}>
                <label className={css.formLabel}>Source</label>
                <input type="text" className={css.formInput} value="HO STORE" readOnly />
              </div>
              <div className={css.formGroupFull}>
                <label className={css.formLabel}>Remarks</label>
                <textarea className={css.formTextarea} placeholder="Any notes…"
                  value={issue.remarks}
                  onChange={e => setIssue(i=>({...i, remarks:e.target.value}))} />
              </div>
            </div>
            <div className={css.formActions}>
              <button className={css.btnSave} disabled={iSaving} onClick={saveIssue}>
                {iSaving ? "Saving…" : "✅ Save Issue"}
              </button>
              <button className={css.btnClear} onClick={() => { setIssue({...EMPTY_ISSUE}); setIMsg(null); }}>
                Clear
              </button>
            </div>
            {iMsg && (
              <div className={`${css.formMsg} ${iMsg.type === "success" ? css.formMsgSuccess : css.formMsgError}`}>
                {iMsg.text}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
