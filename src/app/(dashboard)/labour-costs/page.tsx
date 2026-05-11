"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, ReferenceLine,
} from "recharts";
import s from "./labour.module.css";

/* ── Types ─────────────────────────────────────────────────────────────── */
type RateKey = "mn" | "mp" | "wn" | "wp";
type RatesMap = Record<RateKey, number>;

type MomRecord = {
  month: string;   // "2025-01"
  days: number;
  people: number;
  mn: number;
  mp: number;
  wn: number;
  wp: number;
  misc: number;
  total: number;
  target: number;
};

/* ── Helpers ────────────────────────────────────────────────────────────── */
const fmtRupee = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;
const monthLabel = (key: string) => {
  if (!key) return "";
  const [y, m] = key.split("-");
  const names = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${names[parseInt(m, 10) - 1]} ${y}`;
};
const currentMonthKey = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};
const nextMonthKey = (key: string) => {
  const [y, m] = key.split("-").map(Number);
  const d = new Date(y, m, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};

const LABELS: Record<RateKey, string> = {
  mn: "Men No PF",
  mp: "Men With PF",
  wn: "Women No PF",
  wp: "Women With PF",
};

const BAR_COLORS: Record<string, string> = {
  mn:   "#1B4F8A",
  mp:   "#3B82F6",
  wn:   "#2D6A4F",
  wp:   "#52B788",
  misc: "#C49A3C",
};

const LS_KEY = "msp_mom_v2";

/* ════════════════════════════════════════════════════════════════════════════
   Component
════════════════════════════════════════════════════════════════════════════ */
export default function LabourCostsPage() {
  const [tab, setTab] = useState<"optimizer" | "mom">("optimizer");

  /* ── Optimizer state ──────────────────────────────────────────────────── */
  const [rates, setRates] = useState<RatesMap>({ mn: 600, mp: 720, wn: 500, wp: 610 });
  const [misc,  setMisc]  = useState<RatesMap>({ mn: 0,   mp: 0,   wn: 0,   wp: 0   });
  const [fixed, setFixed] = useState(0);
  const [counts, setCounts] = useState<RatesMap>({ mn: 20, mp: 10, wn: 15, wp: 5 });
  const [days,   setDays]   = useState(25);
  const [target, setTarget] = useState(500000);

  /* ── Optimizer derived ────────────────────────────────────────────────── */
  const computed = useMemo(() => {
    const keys: RateKey[] = ["mn", "mp", "wn", "wp"];
    const eff: RatesMap  = { mn: 0, mp: 0, wn: 0, wp: 0 };
    const sub: RatesMap  = { mn: 0, mp: 0, wn: 0, wp: 0 };
    keys.forEach(k => {
      eff[k] = rates[k] + misc[k];
      sub[k] = counts[k] * eff[k] * days;
    });
    const laborT = keys.reduce((s, k) => s + sub[k], 0);
    const miscT  = keys.reduce((s, k) => s + misc[k] * counts[k], 0) * days + fixed;
    const total  = laborT + fixed;
    const people = keys.reduce((s, k) => s + counts[k], 0);
    const cpd    = days > 0 ? total / days : 0;
    const cpwd   = (days > 0 && people > 0) ? laborT / (days * people) : 0;
    return { eff, sub, laborT, miscT, total, people, cpd, cpwd };
  }, [rates, misc, fixed, counts, days]);

  /* ── MoM state ────────────────────────────────────────────────────────── */
  const [momData,     setMomData]     = useState<MomRecord[]>([]);
  const [filterFrom,  setFilterFrom]  = useState("");
  const [filterTo,    setFilterTo]    = useState("");

  /* form */
  const [mfMonth,  setMfMonth]  = useState(currentMonthKey);
  const [mfDays,   setMfDays]   = useState(25);
  const [mfPeople, setMfPeople] = useState(50);
  const [mfMn,     setMfMn]     = useState(0);
  const [mfMp,     setMfMp]     = useState(0);
  const [mfWn,     setMfWn]     = useState(0);
  const [mfWp,     setMfWp]     = useState(0);
  const [mfMisc,   setMfMisc]   = useState(0);
  const [mfTarget, setMfTarget] = useState(500000);

  /* load from localStorage */
  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) setMomData(JSON.parse(raw) as MomRecord[]);
    } catch {}
  }, []);

  /* save on change */
  useEffect(() => {
    localStorage.setItem(LS_KEY, JSON.stringify(momData));
  }, [momData]);

  /* ── MoM filtered + sorted ────────────────────────────────────────────── */
  const filteredMom = useMemo(() => {
    return momData
      .filter(r => (!filterFrom || r.month >= filterFrom) && (!filterTo || r.month <= filterTo))
      .sort((a, b) => a.month.localeCompare(b.month));
  }, [momData, filterFrom, filterTo]);

  /* ── MoM summary stats ────────────────────────────────────────────────── */
  const momStats = useMemo(() => {
    if (filteredMom.length === 0) return null;
    const totals = filteredMom.reduce((s, r) => s + r.total, 0);
    const avg    = totals / filteredMom.length;
    const sorted = [...filteredMom].sort((a, b) => a.total - b.total);
    const low    = sorted[0];
    const high   = sorted[sorted.length - 1];
    const budgetTotal = filteredMom.reduce((s, r) => s + r.target, 0);
    const vsbudget    = totals - budgetTotal;
    const trend = filteredMom.length >= 2
      ? ((filteredMom[filteredMom.length - 1].total - filteredMom[filteredMom.length - 2].total) /
          filteredMom[filteredMom.length - 2].total) * 100
      : null;
    return { totals, avg, low, high, vsbudget, trend };
  }, [filteredMom]);

  /* ── MoM chart data ───────────────────────────────────────────────────── */
  const chartData = useMemo(() =>
    filteredMom.map(r => ({
      month:  monthLabel(r.month),
      mn:     r.mn,
      mp:     r.mp,
      wn:     r.wn,
      wp:     r.wp,
      misc:   r.misc,
      target: r.target,
    })),
  [filteredMom]);

  /* ── Handlers ─────────────────────────────────────────────────────────── */
  const handleFillFromOptimizer = useCallback(() => {
    setMfDays(days);
    setMfPeople(computed.people);
    setMfMn(computed.sub.mn);
    setMfMp(computed.sub.mp);
    setMfWn(computed.sub.wn);
    setMfWp(computed.sub.wp);
    setMfMisc(Math.round(computed.miscT));
    setMfTarget(target);
  }, [days, computed, target]);

  const handleSaveMonth = useCallback(() => {
    const total = mfMn + mfMp + mfWn + mfWp + mfMisc;
    const record: MomRecord = {
      month:  mfMonth,
      days:   mfDays,
      people: mfPeople,
      mn:     mfMn,
      mp:     mfMp,
      wn:     mfWn,
      wp:     mfWp,
      misc:   mfMisc,
      total,
      target: mfTarget,
    };
    setMomData(prev => {
      const exists = prev.find(r => r.month === mfMonth);
      if (exists) {
        if (!confirm(`Overwrite record for ${monthLabel(mfMonth)}?`)) return prev;
        return prev.map(r => r.month === mfMonth ? record : r);
      }
      return [...prev, record];
    });
    setMfMonth(nextMonthKey(mfMonth));
  }, [mfMonth, mfDays, mfPeople, mfMn, mfMp, mfWn, mfWp, mfMisc, mfTarget]);

  const handleDeleteRecord = useCallback((month: string) => {
    if (!confirm(`Delete record for ${monthLabel(month)}?`)) return;
    setMomData(prev => prev.filter(r => r.month !== month));
  }, []);

  const setQuickRange = (months: number) => {
    const d = new Date();
    const to   = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    d.setMonth(d.getMonth() - months + 1);
    const from = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    setFilterFrom(from);
    setFilterTo(to);
  };

  /* ── Scenarios ────────────────────────────────────────────────────────── */
  const scenarios = useMemo(() => {
    const baseTotal = computed.total;
    const basePeople = computed.people;
    const baseDays = days;

    const calc = (d: number, c: RatesMap) => {
      const keys: RateKey[] = ["mn", "mp", "wn", "wp"];
      let labor = 0;
      keys.forEach(k => { labor += c[k] * (rates[k] + misc[k]) * d; });
      return labor + fixed;
    };

    const cut20hc: RatesMap = {
      mn: Math.round(counts.mn * 0.8),
      mp: Math.round(counts.mp * 0.8),
      wn: Math.round(counts.wn * 0.8),
      wp: Math.round(counts.wp * 0.8),
    };
    const noPfCounts: RatesMap = {
      mn: counts.mn + counts.mp,
      mp: 0,
      wn: counts.wn + counts.wp,
      wp: 0,
    };
    const womenOnly: RatesMap = { mn: 0, mp: 0, wn: counts.wn + counts.mn, wp: 0 };
    const cut10hc: RatesMap = {
      mn: Math.round(counts.mn * 0.9),
      mp: Math.round(counts.mp * 0.9),
      wn: Math.round(counts.wn * 0.9),
      wp: Math.round(counts.wp * 0.9),
    };

    const scens = [
      { label: "-5 Days",             cost: calc(Math.max(0, baseDays - 5),  counts),    h: basePeople, d: Math.max(0, baseDays - 5) },
      { label: "-10 Days",            cost: calc(Math.max(0, baseDays - 10), counts),    h: basePeople, d: Math.max(0, baseDays - 10) },
      { label: "Cut 20% Headcount",   cost: calc(baseDays, cut20hc),                     h: Object.values(cut20hc).reduce((a,b)=>a+b,0), d: baseDays },
      { label: "Shift All to No-PF",  cost: calc(baseDays, noPfCounts),                  h: basePeople, d: baseDays },
      { label: "Women-Only Workforce",cost: calc(baseDays, womenOnly),                   h: counts.wn + counts.mn, d: baseDays },
      { label: "-5 Days + Cut 10%",   cost: calc(Math.max(0, baseDays - 5), cut10hc),   h: Object.values(cut10hc).reduce((a,b)=>a+b,0), d: Math.max(0, baseDays - 5) },
    ];

    return scens.map(sc => ({ ...sc, diff: sc.cost - baseTotal }));
  }, [computed, rates, misc, fixed, counts, days]);

  /* ── MoM footer totals ────────────────────────────────────────────────── */
  const momFooter = useMemo(() => {
    if (filteredMom.length === 0) return null;
    const n = filteredMom.length;
    return {
      mn:     filteredMom.reduce((s,r) => s+r.mn, 0),
      mp:     filteredMom.reduce((s,r) => s+r.mp, 0),
      wn:     filteredMom.reduce((s,r) => s+r.wn, 0),
      wp:     filteredMom.reduce((s,r) => s+r.wp, 0),
      misc:   filteredMom.reduce((s,r) => s+r.misc, 0),
      total:  filteredMom.reduce((s,r) => s+r.total, 0),
      target: filteredMom.reduce((s,r) => s+r.target, 0),
      avgDays:   (filteredMom.reduce((s,r) => s+r.days, 0)   / n).toFixed(1),
      avgPeople: (filteredMom.reduce((s,r) => s+r.people, 0) / n).toFixed(0),
    };
  }, [filteredMom]);

  /* ── MoM % vs prev ────────────────────────────────────────────────────── */
  const momPct = useCallback((idx: number) => {
    if (idx === 0) return null;
    const prev = filteredMom[idx - 1].total;
    if (prev === 0) return null;
    return ((filteredMom[idx].total - prev) / prev) * 100;
  }, [filteredMom]);

  /* ════════════════════════════════════════════════════════════════════════
     RENDER
  ════════════════════════════════════════════════════════════════════════ */
  return (
    <div className={s.page}>
      {/* Header */}
      <div className={s.pageHeader}>
        <div className={s.pageEyebrow}>MSP Coffee · Estate Operations</div>
        <h1 className={s.pageTitle}>Labour <span>Cost Optimizer</span></h1>
      </div>

      {/* Tabs */}
      <div className={s.tabNav}>
        <button
          className={`${s.tabBtn} ${tab === "optimizer" ? s.tabBtnActive : ""}`}
          onClick={() => setTab("optimizer")}
        >
          Cost Optimizer
        </button>
        <button
          className={`${s.tabBtn} ${tab === "mom" ? s.tabBtnActive : ""}`}
          onClick={() => setTab("mom")}
        >
          Month-on-Month
        </button>
      </div>

      {/* ══ TAB 1 — COST OPTIMIZER ════════════════════════════════════════ */}
      {tab === "optimizer" && (
        <>
          {/* ── Pay rates card ──────────────────────────────────────────── */}
          <div className={s.card}>
            <div className={s.cardTitle}>Pay Rates &amp; Miscellaneous</div>
            <div className={s.rateGrid}>
              {(["mn", "mp", "wn", "wp"] as RateKey[]).map(k => (
                <div key={k} className={s.rateGroup}>
                  <div className={s.rateGroupHeader}>
                    <span className={s.rateGroupLabel}>{LABELS[k]}</span>
                    <span className={`${s.badge} ${k === "mp" || k === "wp" ? s.badgeBlue : s.badgeGrey}`}>
                      {k === "mp" || k === "wp" ? "PF" : "No PF"}
                    </span>
                  </div>
                  <div className={s.rateInputRow}>
                    <label>Daily rate</label>
                    <span className={s.rupeePrefix}>₹</span>
                    <input
                      type="number"
                      className={s.numInput}
                      value={rates[k]}
                      min={0}
                      onChange={e => setRates(prev => ({ ...prev, [k]: Number(e.target.value) || 0 }))}
                    />
                  </div>
                  <div className={s.rateInputRow}>
                    <label>Misc/day</label>
                    <span className={s.rupeePrefix}>₹</span>
                    <input
                      type="number"
                      className={s.numInput}
                      value={misc[k]}
                      min={0}
                      onChange={e => setMisc(prev => ({ ...prev, [k]: Number(e.target.value) || 0 }))}
                    />
                  </div>
                </div>
              ))}

              {/* Fixed / one-time */}
              <div className={`${s.rateGroup} ${s.rateGroupFixed}`}>
                <div className={s.rateGroupHeader}>
                  <span className={s.rateGroupLabel}>Fixed / One-Time Misc</span>
                  <span className={`${s.badge} ${s.badgeGold}`}>Fixed</span>
                </div>
                <div className={s.rateInputRow}>
                  <label>Amount</label>
                  <span className={s.rupeePrefix}>₹</span>
                  <input
                    type="number"
                    className={s.numInput}
                    value={fixed}
                    min={0}
                    onChange={e => setFixed(Number(e.target.value) || 0)}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* ── Headcount card ──────────────────────────────────────────── */}
          <div className={s.card}>
            <div className={s.cardTitle}>Headcount</div>
            <div className={s.sliderGrid}>
              {(["mn", "mp", "wn", "wp"] as RateKey[]).map(k => (
                <div key={k} className={s.sliderRow}>
                  <div className={s.sliderLabel}>
                    <span className={s.sliderLabelText}>{LABELS[k]}</span>
                    <span className={s.sliderValue}>{counts[k]}</span>
                  </div>
                  <input
                    type="range"
                    className={s.slider}
                    min={0}
                    max={150}
                    value={counts[k]}
                    onChange={e => setCounts(prev => ({ ...prev, [k]: Number(e.target.value) }))}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* ── Days + Target ────────────────────────────────────────────── */}
          <div className={s.twoColGrid}>
            <div className={s.card} style={{ marginBottom: 0 }}>
              <div className={s.cardTitle}>Working Days</div>
              <div className={s.pillRow}>
                {[15, 20, 25, 26, 30].map(d => (
                  <button
                    key={d}
                    className={`${s.dayPill} ${days === d ? s.dayPillActive : ""}`}
                    onClick={() => setDays(d)}
                  >
                    {d}
                  </button>
                ))}
              </div>
              <input
                type="number"
                className={s.numInput}
                value={days}
                min={1}
                max={31}
                onChange={e => setDays(Number(e.target.value) || 25)}
                style={{ width: "100%" }}
              />
            </div>

            <div className={s.card} style={{ marginBottom: 0 }}>
              <div className={s.cardTitle}>Cost Target</div>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontSize: 16, color: "#8B6545", fontWeight: 600 }}>₹</span>
                <input
                  type="number"
                  className={s.numInput}
                  value={target}
                  min={0}
                  onChange={e => setTarget(Number(e.target.value) || 0)}
                  style={{ width: "100%" }}
                />
              </div>
              {target > 0 && (
                <div className={`${s.targetStatus} ${computed.total <= target ? s.targetUnder : s.targetOver}`}>
                  {computed.total <= target
                    ? `✓ Under by ${fmtRupee(target - computed.total)}`
                    : `↑ Over by ${fmtRupee(computed.total - target)}`}
                </div>
              )}
            </div>
          </div>

          <div style={{ marginBottom: "1rem" }} />

          {/* ── 5 KPI metric cards ──────────────────────────────────────── */}
          <div className={s.metricRow}>
            <div className={`${s.metricCard} ${s.metricPrimary}`}>
              <div className={s.metricLabel}>Total Labour Cost</div>
              <div className={s.metricValue}>{fmtRupee(computed.total)}</div>
              <div className={s.metricSub}>for {days} days</div>
            </div>
            <div className={`${s.metricCard} ${s.metricDefault}`}>
              <div className={s.metricLabel}>Total Headcount</div>
              <div className={s.metricValue}>{computed.people}</div>
              <div className={s.metricSub}>workers</div>
            </div>
            <div className={`${s.metricCard} ${s.metricGold}`}>
              <div className={s.metricLabel}>Cost per Day</div>
              <div className={s.metricValue}>{fmtRupee(computed.cpd)}</div>
              <div className={s.metricSub}>daily total</div>
            </div>
            <div className={`${s.metricCard} ${s.metricGreen}`}>
              <div className={s.metricLabel}>Avg Cost / Worker / Day</div>
              <div className={s.metricValue}>{fmtRupee(computed.cpwd)}</div>
              <div className={s.metricSub}>from labour only</div>
            </div>
            <div className={`${s.metricCard} ${s.metricBlue}`}>
              <div className={s.metricLabel}>Misc &amp; Fixed</div>
              <div className={s.metricValue}>{fmtRupee(computed.miscT)}</div>
              <div className={s.metricSub}>overheads</div>
            </div>
          </div>

          {/* ── Breakdown table ──────────────────────────────────────────── */}
          <div className={s.card}>
            <div className={s.cardTitle}>Cost Breakdown</div>
            <div className={s.tableWrapper}>
              <table className={s.breakdownTable}>
                <thead>
                  <tr>
                    <th>Category</th>
                    <th>People</th>
                    <th>Rate/day</th>
                    <th>Misc/day</th>
                    <th>Effective rate</th>
                    <th>Subtotal</th>
                    <th>Share %</th>
                  </tr>
                </thead>
                <tbody>
                  {(["mn", "mp", "wn", "wp"] as RateKey[]).map(k => {
                    const share = computed.total > 0 ? (computed.sub[k] / computed.total) * 100 : 0;
                    return (
                      <tr key={k}>
                        <td style={{ fontWeight: 600 }}>{LABELS[k]}</td>
                        <td>{counts[k]}</td>
                        <td>{fmtRupee(rates[k])}</td>
                        <td>{fmtRupee(misc[k])}</td>
                        <td>{fmtRupee(computed.eff[k])}</td>
                        <td style={{ fontWeight: 600 }}>{fmtRupee(computed.sub[k])}</td>
                        <td>
                          <div className={s.shareBar}>
                            <div className={s.shareBarTrack}>
                              <div className={s.shareBarFill} style={{ width: `${share}%` }} />
                            </div>
                            <span className={s.shareBarText}>{share.toFixed(1)}%</span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {fixed > 0 && (
                    <tr>
                      <td style={{ fontWeight: 600, color: "#8B6400" }}>Fixed / Misc</td>
                      <td>—</td>
                      <td>—</td>
                      <td>—</td>
                      <td>—</td>
                      <td style={{ fontWeight: 600 }}>{fmtRupee(fixed)}</td>
                      <td>
                        <div className={s.shareBar}>
                          <div className={s.shareBarTrack}>
                            <div className={s.shareBarFill} style={{ width: `${computed.total > 0 ? (fixed / computed.total) * 100 : 0}%`, background: "#C49A3C" }} />
                          </div>
                          <span className={s.shareBarText}>{computed.total > 0 ? ((fixed / computed.total) * 100).toFixed(1) : "0.0"}%</span>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
                <tfoot>
                  <tr className={s.totalsRow}>
                    <td>TOTAL</td>
                    <td>{computed.people}</td>
                    <td>—</td>
                    <td>—</td>
                    <td>—</td>
                    <td>{fmtRupee(computed.total)}</td>
                    <td>100%</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* ── Scenarios ────────────────────────────────────────────────── */}
          <div className={s.card}>
            <div className={s.cardTitle}>Scenarios</div>
            <div className={s.scenarioGrid}>
              {scenarios.map(sc => (
                <div key={sc.label} className={s.scenarioCard}>
                  <div className={s.scenarioTitle}>{sc.label}</div>
                  <div className={s.scenarioCost}>{fmtRupee(sc.cost)}</div>
                  <div className={`${s.scenarioSaves} ${sc.diff <= 0 ? s.scenarioSavesGreen : s.scenarioSavesRed}`}>
                    {sc.diff <= 0
                      ? `↓ saves ${fmtRupee(Math.abs(sc.diff))}`
                      : `↑ costs ${fmtRupee(sc.diff)} more`}
                  </div>
                  <div className={s.scenarioMeta}>{sc.h} workers · {sc.d} days</div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* ══ TAB 2 — MONTH-ON-MONTH ════════════════════════════════════════ */}
      {tab === "mom" && (
        <>
          <div className={s.momLayout}>
            {/* Left: form */}
            <div className={s.card} style={{ marginBottom: 0 }}>
              <div className={s.cardTitle}>Log a Month</div>
              <div className={s.momForm}>
                <div className={s.formGroup}>
                  <label className={s.formLabel}>Month</label>
                  <input type="month" className={s.formInput} value={mfMonth}
                    onChange={e => setMfMonth(e.target.value)} />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  <div className={s.formGroup}>
                    <label className={s.formLabel}>Working Days</label>
                    <input type="number" className={s.formInput} value={mfDays} min={1} max={31}
                      onChange={e => setMfDays(Number(e.target.value) || 0)} />
                  </div>
                  <div className={s.formGroup}>
                    <label className={s.formLabel}>Total Headcount</label>
                    <input type="number" className={s.formInput} value={mfPeople} min={0}
                      onChange={e => setMfPeople(Number(e.target.value) || 0)} />
                  </div>
                </div>

                <div className={s.momRateGrid}>
                  {([["mn","Men No PF"],["mp","Men With PF"],["wn","Women No PF"],["wp","Women With PF"]] as [string,string][]).map(([k, lbl]) => (
                    <div key={k} className={s.formGroup}>
                      <label className={s.formLabel}>{lbl} (₹)</label>
                      <input type="number" className={s.formInput} min={0}
                        value={k === "mn" ? mfMn : k === "mp" ? mfMp : k === "wn" ? mfWn : mfWp}
                        onChange={e => {
                          const v = Number(e.target.value) || 0;
                          if (k === "mn") setMfMn(v);
                          else if (k === "mp") setMfMp(v);
                          else if (k === "wn") setMfWn(v);
                          else setMfWp(v);
                        }}
                      />
                    </div>
                  ))}
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  <div className={s.formGroup}>
                    <label className={s.formLabel}>Misc / Fixed (₹)</label>
                    <input type="number" className={s.formInput} value={mfMisc} min={0}
                      onChange={e => setMfMisc(Number(e.target.value) || 0)} />
                  </div>
                  <div className={s.formGroup}>
                    <label className={s.formLabel}>Budget / Target (₹)</label>
                    <input type="number" className={s.formInput} value={mfTarget} min={0}
                      onChange={e => setMfTarget(Number(e.target.value) || 0)} />
                  </div>
                </div>

                <div style={{ padding: "8px 10px", background: "rgba(59,31,14,0.04)", borderRadius: 8, fontSize: 12, color: "#6B3A22", fontWeight: 600 }}>
                  Projected total: {fmtRupee(mfMn + mfMp + mfWn + mfWp + mfMisc)}
                </div>

                <button className={s.fillBtn} onClick={handleFillFromOptimizer}>
                  ↙ Fill from current optimizer values
                </button>
                <button className={s.saveBtn} onClick={handleSaveMonth}>
                  + Save this month&apos;s record
                </button>
              </div>
            </div>

            {/* Right: summary + chart */}
            <div className={s.momRight}>
              {/* Filters */}
              <div className={s.card} style={{ marginBottom: 0 }}>
                <div className={s.cardTitle}>Filter Range</div>
                <div className={s.filterRow}>
                  <div className={s.formGroup} style={{ minWidth: 140 }}>
                    <label className={s.formLabel}>From</label>
                    <input type="month" className={s.formInput} value={filterFrom}
                      onChange={e => setFilterFrom(e.target.value)} />
                  </div>
                  <div className={s.formGroup} style={{ minWidth: 140 }}>
                    <label className={s.formLabel}>To</label>
                    <input type="month" className={s.formInput} value={filterTo}
                      onChange={e => setFilterTo(e.target.value)} />
                  </div>
                  <button className={s.rangeBtn}
                    style={{ alignSelf: "flex-end", marginBottom: 2 }}
                    onClick={() => { setFilterFrom(""); setFilterTo(""); }}>
                    Show All
                  </button>
                </div>
                <div className={s.quickRangeRow}>
                  {[3, 6, 12].map(n => (
                    <button key={n} className={s.rangeBtn} onClick={() => setQuickRange(n)}>
                      Last {n} months
                    </button>
                  ))}
                </div>
              </div>

              {/* Summary stat cards */}
              {momStats && (
                <div className={s.summaryGrid}>
                  <div className={s.statCard}>
                    <div className={s.statLabel}>Total Spend</div>
                    <div className={s.statValue}>{fmtRupee(momStats.totals)}</div>
                    <div className={s.statSub}>{filteredMom.length} months</div>
                  </div>
                  <div className={s.statCard}>
                    <div className={s.statLabel}>Monthly Avg</div>
                    <div className={s.statValue}>{fmtRupee(momStats.avg)}</div>
                    <div className={s.statSub}>per month</div>
                  </div>
                  <div className={s.statCard}>
                    <div className={s.statLabel}>Lowest Month</div>
                    <div className={s.statValue}>{fmtRupee(momStats.low.total)}</div>
                    <div className={s.statSub}>{monthLabel(momStats.low.month)}</div>
                  </div>
                  <div className={s.statCard}>
                    <div className={s.statLabel}>Highest Month</div>
                    <div className={s.statValue}>{fmtRupee(momStats.high.total)}</div>
                    <div className={s.statSub}>{monthLabel(momStats.high.month)}</div>
                  </div>
                  <div className={`${s.statCard}`}>
                    <div className={s.statLabel}>Total vs Budget</div>
                    <div className={`${s.statValue} ${momStats.vsbudget <= 0 ? s.tagGreen : s.tagRed}`}>
                      {momStats.vsbudget <= 0 ? `−${fmtRupee(Math.abs(momStats.vsbudget))}` : `+${fmtRupee(momStats.vsbudget)}`}
                    </div>
                    <div className={s.statSub}>{momStats.vsbudget <= 0 ? "under budget" : "over budget"}</div>
                  </div>
                  <div className={s.statCard}>
                    <div className={s.statLabel}>MoM Trend</div>
                    <div className={`${s.statValue} ${momStats.trend === null ? "" : momStats.trend <= 0 ? s.tagGreen : s.tagRed}`}>
                      {momStats.trend === null ? "—" : `${momStats.trend > 0 ? "+" : ""}${momStats.trend.toFixed(1)}%`}
                    </div>
                    <div className={s.statSub}>vs previous month</div>
                  </div>
                </div>
              )}

              {/* Chart */}
              {chartData.length > 0 && (
                <div className={s.chartBox}>
                  <div className={s.chartTitle}>Monthly Labour Cost Breakdown</div>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(59,31,14,0.1)" vertical={false} />
                      <XAxis dataKey="month" tick={{ fill: "#8B6545", fontSize: 10 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: "#8B6545", fontSize: 10 }} axisLine={false} tickLine={false}
                        tickFormatter={v => `₹${((v as number)/1000).toFixed(0)}k`} width={56} />
                      <Tooltip
                        contentStyle={{ background: "#FFFAF4", border: "1px solid rgba(107,58,34,0.2)", borderRadius: 8, fontSize: 11 }}
                        formatter={(v: unknown, name: unknown) => [fmtRupee(v as number), name as string]}
                      />
                      <Legend wrapperStyle={{ fontSize: 11, color: "#8B6545" }} />
                      <Bar dataKey="mn"   name="Men No PF"    stackId="a" fill={BAR_COLORS.mn} />
                      <Bar dataKey="mp"   name="Men With PF"  stackId="a" fill={BAR_COLORS.mp} />
                      <Bar dataKey="wn"   name="Women No PF"  stackId="a" fill={BAR_COLORS.wn} />
                      <Bar dataKey="wp"   name="Women With PF" stackId="a" fill={BAR_COLORS.wp} />
                      <Bar dataKey="misc" name="Misc/Fixed"   stackId="a" fill={BAR_COLORS.misc} radius={[4,4,0,0]} />
                      <ReferenceLine
                        y={filteredMom.length > 0 ? filteredMom.reduce((s,r) => s+r.target,0)/filteredMom.length : 0}
                        stroke="#9B2335"
                        strokeDasharray="5 3"
                        label={{ value: "Avg Budget", fill: "#9B2335", fontSize: 10, position: "right" }}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </div>

          {/* Records table */}
          <div className={s.card} style={{ marginTop: "1rem" }}>
            <div className={s.cardTitle}>Monthly Records</div>
            {filteredMom.length === 0 ? (
              <div className={s.emptyState}>📋 No records yet — log your first month above</div>
            ) : (
              <div className={s.momTableWrapper}>
                <table className={s.momTable}>
                  <thead>
                    <tr>
                      <th>Month</th>
                      <th>Days</th>
                      <th>People</th>
                      <th>Men No PF</th>
                      <th>Men PF</th>
                      <th>Women No PF</th>
                      <th>Women PF</th>
                      <th>Misc</th>
                      <th>Total Cost</th>
                      <th>Budget</th>
                      <th>vs Budget</th>
                      <th>MoM%</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredMom.map((r, idx) => {
                      const vsBudget = r.total - r.target;
                      const pct = momPct(idx);
                      return (
                        <tr key={r.month}>
                          <td style={{ fontWeight: 600 }}>{monthLabel(r.month)}</td>
                          <td>{r.days}</td>
                          <td>{r.people}</td>
                          <td>{fmtRupee(r.mn)}</td>
                          <td>{fmtRupee(r.mp)}</td>
                          <td>{fmtRupee(r.wn)}</td>
                          <td>{fmtRupee(r.wp)}</td>
                          <td>{fmtRupee(r.misc)}</td>
                          <td style={{ fontWeight: 700 }}>{fmtRupee(r.total)}</td>
                          <td style={{ color: "#8B6545" }}>{fmtRupee(r.target)}</td>
                          <td className={vsBudget <= 0 ? s.tagGreen : s.tagRed}>
                            {vsBudget <= 0 ? `−${fmtRupee(Math.abs(vsBudget))}` : `+${fmtRupee(vsBudget)}`}
                          </td>
                          <td className={pct === null ? "" : pct <= 0 ? s.tagGreen : s.tagRed}>
                            {pct === null ? "—" : `${pct > 0 ? "+" : ""}${pct.toFixed(1)}%`}
                          </td>
                          <td>
                            <button className={s.deleteBtn} onClick={() => handleDeleteRecord(r.month)}
                              title="Delete">✕</button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  {momFooter && (
                    <tfoot>
                      <tr>
                        <td>Total / Avg</td>
                        <td>{momFooter.avgDays}</td>
                        <td>{momFooter.avgPeople}</td>
                        <td>{fmtRupee(momFooter.mn)}</td>
                        <td>{fmtRupee(momFooter.mp)}</td>
                        <td>{fmtRupee(momFooter.wn)}</td>
                        <td>{fmtRupee(momFooter.wp)}</td>
                        <td>{fmtRupee(momFooter.misc)}</td>
                        <td style={{ fontWeight: 700 }}>{fmtRupee(momFooter.total)}</td>
                        <td>{fmtRupee(momFooter.target)}</td>
                        <td className={momFooter.total - momFooter.target <= 0 ? s.tagGreen : s.tagRed}>
                          {momFooter.total - momFooter.target <= 0
                            ? `−${fmtRupee(Math.abs(momFooter.total - momFooter.target))}`
                            : `+${fmtRupee(momFooter.total - momFooter.target)}`}
                        </td>
                        <td>—</td>
                        <td></td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
