"use client";

import { useState, useEffect, useMemo } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from "recharts";
import s from "./cup.module.css";

/* ── Types ─────────────────────────────────────────────────────────────────── */
type Coffee = {
  _id: string;
  lot: string; series: string; name: string; type: string;
  estate: string; process: string; processDetail: string;
  score: number; priceINR: string; priceUSD: string;
  date: string; field: string; acidity: string; body: string;
  notes: string; qty: string; year: number;
  _userAdded: boolean; // false = seed row (no delete button)
};

type DbRow = {
  id: string; lot: string; series: string; name: string; type: string;
  estate: string; process: string; process_detail: string;
  score: number; price_inr: string; price_usd: string;
  date: string; field: string; acidity: string; body: string;
  notes: string; qty: string; year: number; is_seed: boolean;
};

function dbToCoffee(r: DbRow): Coffee {
  return {
    _id:          r.id,
    _userAdded:   !r.is_seed,
    lot:          r.lot,
    series:       r.series,
    name:         r.name,
    type:         r.type,
    estate:       r.estate,
    process:      r.process,
    processDetail: r.process_detail,
    score:        Number(r.score),
    priceINR:     r.price_inr,
    priceUSD:     r.price_usd,
    date:         r.date,
    field:        r.field,
    acidity:      r.acidity,
    body:         r.body,
    notes:        r.notes,
    qty:          r.qty,
    year:         r.year,
  };
}

function coffeeToDb(form: typeof BLANK_FORM): Omit<DbRow, 'id' | 'is_seed'> {
  return {
    lot:            form.lot.trim(),
    series:         form.series,
    name:           form.name.trim(),
    type:           form.type || 'Arabica',
    estate:         form.estate,
    process:        form.process,
    process_detail: form.processDetail || '—',
    score:          parseFloat(form.score),
    price_inr:      form.priceINR || '—',
    price_usd:      form.priceUSD || '—',
    date:           form.date || '—',
    field:          form.field || '—',
    acidity:        form.acidity || '—',
    body:           form.body || '—',
    notes:          form.notes || '—',
    qty:            form.qty || '—',
    year:           parseInt(form.year),
  };
}

type ThemeKey = "forest" | "coffee" | "navy" | "burgundy" | "slate";

/* ── Themes ─────────────────────────────────────────────────────────────────── */
const THEMES: Record<ThemeKey, { label: string; swatch: string; vars: Record<string, string> }> = {
  forest:   { label: "Forest Green", swatch: "var(--t-heading)", vars: { "--green-dark": "var(--t-heading)", "--green-mid": "var(--t-green)", "--cream": "var(--t-bg)", "--border": "var(--t-border)" } },
  coffee:   { label: "Deep Coffee",  swatch: "#3e2010", vars: { "--green-dark": "#3e2010", "--green-mid": "#6b3a1f", "--cream": "#fdf5ee", "--border": "#e8d8c4" } },
  navy:     { label: "Navy Blue",    swatch: "#1a2a4a", vars: { "--green-dark": "#1a2a4a", "--green-mid": "#253d6e", "--cream": "#f0f4ff", "--border": "#d0d8f0" } },
  burgundy: { label: "Burgundy",     swatch: "#4a1020", vars: { "--green-dark": "#4a1020", "--green-mid": "#7a1f35", "--cream": "#fff0f3", "--border": "#f0d0d8" } },
  slate:    { label: "Slate",        swatch: "#2a3540", vars: { "--green-dark": "#2a3540", "--green-mid": "#3d5060", "--cream": "#f2f5f7", "--border": "#d4dde3" } },
};

/* ── Helpers ─────────────────────────────────────────────────────────────────── */
function getTier(score: number) {
  if (score >= 89) return { label: "Exceptional", color: "#dc2626" };
  if (score >= 87) return { label: "Outstanding", color: "#d97706" };
  if (score >= 85) return { label: "Excellent",   color: "#059669" };
  if (score >= 83) return { label: "Very Good",   color: "#3b82f6" };
  return               { label: "Good",        color: "#7c6d5a" };
}

const SERIES_BADGE: Record<string, string> = {
  "Gold Series":     s.badgeGold,
  "Small Batch":     s.badgeSmall,
  "Nano Lot":        s.badgeNano,
  "Limited Edition": s.badgeLimited,
};

const ESTATE_COLORS: Record<string, string> = {
  "Stanmore Estate":     "#1b5e20",
  "Moganad Estate":      "#1a237e",
  "Orchardale Estate":   "#4a148c",
  "Bison Valley Estate": "#e65100",
  "Hidden Falls Estate": "#006064",
};

function parseTasteNotes(notes: string): string[] {
  if (!notes || notes === "—") return [];
  return notes.split(/,|\./).map(t => t.trim()).filter(t => t.length > 1 && t.length < 35).slice(0, 5);
}

const BLANK_FORM = {
  year: "", lot: "", series: "Gold Series", name: "", type: "", estate: "Stanmore Estate",
  process: "Natural", processDetail: "", field: "", score: "", priceINR: "", priceUSD: "",
  acidity: "", body: "", notes: "", date: "", qty: "",
};

/* ── Coffee Card ─────────────────────────────────────────────────────────────── */
function CoffeeCard({ coffee: c, onDelete }: { coffee: Coffee; onDelete: (id: string) => void }) {
  const tier = getTier(c.score);
  const tasteTags = parseTasteNotes(c.notes);
  const estColor = ESTATE_COLORS[c.estate] || "var(--t-heading)";

  return (
    <div className={`${s.card} ${c._userAdded ? s.userAdded : ""}`}>
      <div className={s.cardTop}>
        <div className={s.cardMeta}>
          <div className={s.lotLine}>
            <span className={s.lotNum}>LOT {c.lot}</span>
            <span className={`${s.seriesBadge} ${SERIES_BADGE[c.series] || s.badgeSmall}`}>
              {c.series === "Limited Edition" ? "Ltd Edition" : c.series}
            </span>
            <span className={s.yearPill}>{c.year}</span>
            {c._userAdded && (
              <button className={s.delBtn} onClick={() => onDelete(c._id)}>✕ Delete</button>
            )}
          </div>
          <div className={s.cardName}>{c.name}</div>
          <div className={s.cardEstate}>
            <div className={s.estateDot} style={{ background: estColor }} />
            <span style={{ color: estColor, fontWeight: 600 }}>{c.estate}</span>
          </div>
        </div>
        <div className={s.scoreCircle} style={{ borderColor: tier.color, color: tier.color }}>
          <div className={s.scoreNum}>{c.score}</div>
          <div className={s.scoreLabel}>{tier.label}</div>
        </div>
      </div>
      <div className={s.cardDivider} />
      <div className={s.cardProcess}>
        <span className={s.processTag}>{c.type}</span>
        <span className={s.processTag}>{c.processDetail}</span>
        <div className={s.cardPrice}>
          <span className={s.priceInr}>{c.priceINR}</span>
          {c.priceUSD !== "—" && <span className={s.priceUsd}>{c.priceUSD}</span>}
        </div>
      </div>
      {c.acidity !== "—" && (
        <div className={s.cardNotes}>
          {c.acidity !== "—" && <div className={s.notesSection}><span className={s.notesLabel}>Acidity</span><div className={s.notesValue}>{c.acidity}</div></div>}
          {c.body !== "—" && <div className={s.notesSection}><span className={s.notesLabel}>Body</span><div className={s.notesValue}>{c.body}</div></div>}
          {tasteTags.length > 0 && (
            <div className={s.notesSection}>
              <span className={s.notesLabel}>Taste Notes</span>
              <div className={s.tasteTags}>{tasteTags.map((t, i) => <span key={i} className={s.tasteTag}>{t}</span>)}</div>
            </div>
          )}
        </div>
      )}
      <div className={s.cardBottom}>
        <div className={s.metaItem}><div className={s.metaLbl}>Date</div><div className={s.metaVal}>{c.date}</div></div>
        {c.field !== "—" && <div className={s.metaItem}><div className={s.metaLbl}>Field</div><div className={s.metaVal}>{c.field}</div></div>}
        <div className={s.metaItem}><div className={s.metaLbl}>Qty</div><div className={s.metaVal}>{c.qty}</div></div>
      </div>
    </div>
  );
}

/* ── Main Page ───────────────────────────────────────────────────────────────── */
export default function CupScoresPage() {
  const [scores, setScores]           = useState<Coffee[]>([]);
  const [loading, setLoading]         = useState(true);
  const [themeKey, setThemeKey]       = useState<ThemeKey>("forest");
  const [lastUpdated, setLastUpdated] = useState("No entries added yet");
  const [fYear, setFYear]             = useState("");
  const [fEstate, setFEstate]         = useState("");
  const [fProcess, setFProcess]       = useState("");
  const [fSeries, setFSeries]         = useState("");
  const [fScore, setFScore]           = useState("");
  const [fSearch, setFSearch]         = useState("");
  const [sortBy, setSortBy]           = useState("score");
  const [modalOpen, setModalOpen]     = useState(false);
  const [editId, setEditId]           = useState<string | null>(null);
  const [form, setForm]               = useState({ ...BLANK_FORM });
  const [saving, setSaving]           = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [clockTime, setClockTime]     = useState("--:--:--");
  const [clockDate, setClockDate]     = useState("");

  // ── Load scores from Supabase on mount ──────────────────────────────────────
  useEffect(() => {
    const saved = localStorage.getItem("msp_cup_theme") as ThemeKey;
    if (saved && THEMES[saved]) setThemeKey(saved);

    fetch("/api/cup-scores")
      .then(r => r.json())
      .then((rows: DbRow[]) => {
        if (Array.isArray(rows)) setScores(rows.map(dbToCoffee));
      })
      .catch(() => {/* silently degrade */})
      .finally(() => setLoading(false));
  }, []);

  // ── Clock ────────────────────────────────────────────────────────────────────
  useEffect(() => {
    const tick = () => {
      const now = new Date();
      setClockTime(now.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
      setClockDate(now.toLocaleDateString("en-IN", { weekday: "short", day: "2-digit", month: "short", year: "numeric" }));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  // ── Derived data ─────────────────────────────────────────────────────────────
  const availYears   = useMemo(() => [...new Set(scores.map(c => c.year))].sort((a, b) => b - a), [scores]);
  const yearFiltered = useMemo(() => fYear ? scores.filter(c => String(c.year) === fYear) : scores, [scores, fYear]);

  const filteredData = useMemo(() => {
    const data = scores.filter(c => {
      if (fYear    && String(c.year) !== fYear)    return false;
      if (fEstate  && c.estate  !== fEstate)        return false;
      if (fProcess && c.process !== fProcess)       return false;
      if (fSeries  && c.series  !== fSeries)        return false;
      if (fScore   && c.score < parseFloat(fScore)) return false;
      if (fSearch) {
        const hay = (c.name + c.estate + c.process + c.processDetail + c.notes + c.type + c.lot).toLowerCase();
        if (!hay.includes(fSearch.toLowerCase())) return false;
      }
      return true;
    });
    return [...data].sort((a, b) => {
      if (sortBy === "score") return b.score - a.score;
      if (sortBy === "lot") {
        const al = isNaN(Number(a.lot)) ? a.lot : Number(a.lot);
        const bl = isNaN(Number(b.lot)) ? b.lot : Number(b.lot);
        return al < bl ? -1 : al > bl ? 1 : 0;
      }
      if (sortBy === "estate") return a.estate.localeCompare(b.estate);
      if (sortBy === "price") {
        const ap = parseFloat((a.priceINR || "0").replace(/[₹,]/g, "")) || 0;
        const bp = parseFloat((b.priceINR || "0").replace(/[₹,]/g, "")) || 0;
        return bp - ap;
      }
      return 0;
    });
  }, [scores, fYear, fEstate, fProcess, fSeries, fScore, fSearch, sortBy]);

  const summary = useMemo(() => {
    const data  = yearFiltered;
    const total = data.length;
    const avg   = total ? (data.reduce((sum, c) => sum + c.score, 0) / total).toFixed(2) : "—";
    const top   = total ? Math.max(...data.map(c => c.score)) : 0;
    const topLots = data.filter(c => c.score === top).map(c => "Lot " + c.lot).slice(0, 3).join(", ");
    const outstanding = data.filter(c => c.score >= 87).length;
    const estateCount = new Set(data.map(c => c.estate)).size;
    const years = [...new Set(scores.map(c => c.year))].sort();
    return { total, avg, top, topLots, outstanding, estateCount, years };
  }, [yearFiltered, scores]);

  const estateChartData = useMemo(() => {
    const defs = [
      { name: "Stanmore",    full: "Stanmore Estate",     color: "#1b5e20" },
      { name: "Moganad",     full: "Moganad Estate",      color: "#1a237e" },
      { name: "Orchardale",  full: "Orchardale Estate",   color: "#4a148c" },
      { name: "Bison Valley",full: "Bison Valley Estate", color: "#e65100" },
      { name: "Hidden Falls",full: "Hidden Falls Estate", color: "#006064" },
    ];
    return defs.map(d => {
      const lots = yearFiltered.filter(c => c.estate === d.full);
      return { name: d.name, avg: lots.length ? parseFloat((lots.reduce((sum, c) => sum + c.score, 0) / lots.length).toFixed(2)) : 0, fill: d.color };
    });
  }, [yearFiltered]);

  const processChartData = useMemo(() => [
    { name: "Natural",           value: yearFiltered.filter(c => c.process === "Natural").length,           fill: "#2e7d32" },
    { name: "Washed",            value: yearFiltered.filter(c => c.process === "Washed").length,            fill: "#1565c0" },
    { name: "Black Honey / PSD", value: yearFiltered.filter(c => c.process === "Black Honey / PSD").length, fill: "#b5770a" },
    { name: "Robusta",           value: yearFiltered.filter(c => c.process === "Robusta").length,           fill: "#5d4037" },
  ].filter(d => d.value > 0), [yearFiltered]);

  const distChartData = useMemo(() => [
    { range: "80–82", count: yearFiltered.filter(c => c.score >= 80 && c.score < 83).length, fill: "#7c6d5a" },
    { range: "83–84", count: yearFiltered.filter(c => c.score >= 83 && c.score < 85).length, fill: "#3b82f6" },
    { range: "85–86", count: yearFiltered.filter(c => c.score >= 85 && c.score < 87).length, fill: "#059669" },
    { range: "87–88", count: yearFiltered.filter(c => c.score >= 87 && c.score < 89).length, fill: "#d97706" },
    { range: "89+",   count: yearFiltered.filter(c => c.score >= 89).length,                 fill: "#dc2626" },
  ], [yearFiltered]);

  // ── Save (create / update) ───────────────────────────────────────────────────
  const saveScore = async () => {
    const year  = parseInt(form.year);
    const score = parseFloat(form.score);
    if (!year || !form.lot.trim() || !form.name.trim() || isNaN(score)) {
      alert("Please fill in Year, Lot No, Name and Cup Score."); return;
    }

    setSaving(true);
    try {
      const payload = coffeeToDb(form);
      let res: Response;

      if (editId) {
        res = await fetch(`/api/cup-scores/${editId}`, {
          method:  "PUT",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify(payload),
        });
      } else {
        res = await fetch("/api/cup-scores", {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify(payload),
        });
      }

      if (!res.ok) {
        const { error } = await res.json();
        alert(`Error: ${error}`); return;
      }

      const saved: DbRow = await res.json();
      const updated = editId
        ? scores.map(r => r._id === editId ? dbToCoffee(saved) : r)
        : [...scores, dbToCoffee(saved)];

      setScores(updated);
      const now = new Date().toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
      setLastUpdated(now);
      setModalOpen(false);
      setEditId(null);
    } finally {
      setSaving(false);
    }
  };

  // ── Delete ───────────────────────────────────────────────────────────────────
  const deleteScore = async (id: string) => {
    if (!confirm("Delete this score entry?")) return;

    const res = await fetch(`/api/cup-scores/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const { error } = await res.json();
      alert(`Error: ${error}`); return;
    }

    setScores(prev => prev.filter(r => r._id !== id));
    setLastUpdated(new Date().toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }));
  };

  const openAdd = () => {
    setEditId(null);
    setForm({ ...BLANK_FORM, year: String(new Date().getFullYear()) });
    setModalOpen(true);
  };

  const changeTheme = (key: ThemeKey) => {
    setThemeKey(key);
    localStorage.setItem("msp_cup_theme", key);
    setPaletteOpen(false);
  };

  const theme = THEMES[themeKey];

  return (
    <div className={s.page} style={theme.vars as React.CSSProperties}>

      {/* HEADER */}
      <div className={s.header}>
        <div className={s.headerLeft}>
          <div className={s.logo}>M</div>
          <div>
            <div className={s.headerTitle}>MSP Coffee P Ltd</div>
            <div className={s.headerSub}>Multi-Year Cup Score Catalogue</div>
          </div>
        </div>
        <div className={s.headerRight}>
          <div className={s.headerClock}>
            <div className={s.hclockTime}>{clockTime}</div>
            <div className={s.hclockDate}>{clockDate}</div>
            <div className={s.hclockUpdated}>↻ {lastUpdated}</div>
          </div>
          <div style={{ position: "relative" }}>
            <button className={s.paletteBtn} onClick={() => setPaletteOpen(p => !p)} title="Change colour theme">🎨</button>
            {paletteOpen && (
              <div className={s.palettePicker}>
                <div className={s.palettePickerTitle}>🎨 Colour Theme</div>
                {(Object.keys(THEMES) as ThemeKey[]).map(key => (
                  <div key={key} className={`${s.themeRow} ${themeKey === key ? s.themeRowActive : ""}`} onClick={() => changeTheme(key)}>
                    <div className={s.themeSwatch} style={{ background: THEMES[key].swatch }} />
                    <span className={s.themeName}>{THEMES[key].label}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className={s.yearBadge}>☕ {fYear || "All Years"}</div>
          <button className={s.btnAddScore} onClick={openAdd}>＋ Add Score</button>
        </div>
      </div>

      {/* LEGEND */}
      <div className={s.legendBar}>
        <span className={s.legendTitle}>SCORE KEY:</span>
        {[
          { color: "#7c6d5a", label: "80–82.99 Good" },
          { color: "#3b82f6", label: "83–84.99 Very Good" },
          { color: "#059669", label: "85–86.99 Excellent" },
          { color: "#d97706", label: "87–88.99 Outstanding" },
          { color: "#dc2626", label: "89+ Exceptional" },
        ].map(({ color, label }) => (
          <div key={label} className={s.legendItem}>
            <div className={s.legendDot} style={{ background: color }} />{label}
          </div>
        ))}
      </div>

      {/* SUMMARY */}
      <div className={s.summary}>
        <div className={`${s.scard} ${s.scardGold}`}>
          <div className={s.scardIcon}>☕</div>
          <div className={s.scardLabel}>Total Lots Cupped</div>
          <div className={s.scardValue}>{loading ? "…" : summary.total}</div>
          <div className={s.scardSub}>{fYear || "2025"} Season</div>
        </div>
        <div className={`${s.scard} ${s.scardBlue}`}>
          <div className={s.scardIcon}>📊</div>
          <div className={s.scardLabel}>Average Cup Score</div>
          <div className={s.scardValue}>{loading ? "…" : summary.avg}</div>
          <div className={s.scardSub}>All lots</div>
        </div>
        <div className={`${s.scard} ${s.scardAmber}`}>
          <div className={s.scardIcon}>🏆</div>
          <div className={s.scardLabel}>Highest Score</div>
          <div className={s.scardValue}>{loading ? "…" : summary.top}</div>
          <div className={s.scardSub}>{summary.topLots}</div>
        </div>
        <div className={s.scard}>
          <div className={s.scardIcon}>⭐</div>
          <div className={s.scardLabel}>Outstanding+ (87+)</div>
          <div className={s.scardValue}>{loading ? "…" : summary.outstanding}</div>
          <div className={s.scardSub}>{summary.total ? ((summary.outstanding / summary.total) * 100).toFixed(0) : 0}% of all lots</div>
        </div>
        <div className={s.scard}>
          <div className={s.scardIcon}>🌿</div>
          <div className={s.scardLabel}>Estates</div>
          <div className={s.scardValue}>{loading ? "…" : summary.estateCount}</div>
          <div className={s.scardSub}>Yercaud, Tamil Nadu</div>
        </div>
        <div className={`${s.scard} ${s.scardGold}`}>
          <div className={s.scardIcon}>📅</div>
          <div className={s.scardLabel}>Years on Record</div>
          <div className={s.scardValue}>{loading ? "…" : summary.years.length}</div>
          <div className={s.scardSub}>{summary.years.join(" · ")}</div>
        </div>
      </div>

      {/* CHARTS */}
      <div className={s.chartsRow}>
        <div className={s.chartCard}>
          <div className={s.chartTitle}>☕ Avg Score by Estate</div>
          <div className={s.chartWrap}>
            <ResponsiveContainer width="100%" height={170}>
              <BarChart data={estateChartData} margin={{ top: 4, right: 8, left: -10, bottom: 0 }}>
                <XAxis dataKey="name" tick={{ fontSize: 9 }} />
                <YAxis domain={[82, "auto"]} tick={{ fontSize: 10 }} />
                <Tooltip formatter={(v) => [typeof v === "number" ? v.toFixed(2) : v, "Avg Score"]} />
                <Bar dataKey="avg" radius={[4, 4, 0, 0]}>
                  {estateChartData.map((e, i) => <Cell key={i} fill={e.fill} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className={s.chartCard}>
          <div className={s.chartTitle}>📦 Lots by Process</div>
          <div className={s.chartWrap}>
            <ResponsiveContainer width="100%" height={170}>
              <PieChart>
                <Pie data={processChartData} dataKey="value" cx="45%" cy="50%" innerRadius="36%" outerRadius="62%">
                  {processChartData.map((e, i) => <Cell key={i} fill={e.fill} />)}
                </Pie>
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 10 }} />
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className={s.chartCard}>
          <div className={s.chartTitle}>📊 Score Distribution</div>
          <div className={s.chartWrap}>
            <ResponsiveContainer width="100%" height={170}>
              <BarChart data={distChartData} margin={{ top: 4, right: 8, left: -10, bottom: 0 }}>
                <XAxis dataKey="range" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                <Tooltip formatter={(v) => [v, "Lots"]} />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {distChartData.map((e, i) => <Cell key={i} fill={e.fill} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* FILTERS */}
      <div className={s.filters}>
        <div className={s.filterGroup}>
          <span className={s.filterLabel}>Year</span>
          <select className={s.fsel} value={fYear} onChange={e => setFYear(e.target.value)}>
            <option value="">All Years</option>
            {availYears.map(y => <option key={y} value={String(y)}>{y}</option>)}
          </select>
        </div>
        <div className={s.filterGroup}>
          <span className={s.filterLabel}>Estate</span>
          <select className={s.fsel} value={fEstate} onChange={e => setFEstate(e.target.value)}>
            <option value="">All Estates</option>
            {["Stanmore Estate","Moganad Estate","Orchardale Estate","Bison Valley Estate","Hidden Falls Estate"].map(v => <option key={v}>{v}</option>)}
          </select>
        </div>
        <div className={s.filterGroup}>
          <span className={s.filterLabel}>Process</span>
          <select className={s.fsel} value={fProcess} onChange={e => setFProcess(e.target.value)}>
            <option value="">All Processes</option>
            {["Natural","Washed","Black Honey / PSD","Robusta"].map(v => <option key={v}>{v}</option>)}
          </select>
        </div>
        <div className={s.filterGroup}>
          <span className={s.filterLabel}>Series</span>
          <select className={s.fsel} value={fSeries} onChange={e => setFSeries(e.target.value)}>
            <option value="">All Series</option>
            {["Gold Series","Small Batch","Nano Lot","Limited Edition"].map(v => <option key={v}>{v}</option>)}
          </select>
        </div>
        <div className={s.filterGroup}>
          <span className={s.filterLabel}>Score</span>
          <select className={s.fsel} value={fScore} onChange={e => setFScore(e.target.value)}>
            <option value="">All Scores</option>
            <option value="85">85+</option>
            <option value="86">86+</option>
            <option value="87">87+</option>
            <option value="88">88+</option>
          </select>
        </div>
        <input className={s.fsearch} value={fSearch} onChange={e => setFSearch(e.target.value)} placeholder="🔍 Search taste notes, estate, process..." />
        <button className={s.btnClear} onClick={() => { setFEstate(""); setFProcess(""); setFSeries(""); setFScore(""); setFSearch(""); }}>✕ Clear</button>
        <span className={s.resultsCount}>{filteredData.length} of {scores.length} lots</span>
      </div>

      {/* SORT */}
      <div className={s.sortRow}>
        <span className={s.sortLabel}>SORT:</span>
        {(["score","lot","estate","price"] as const).map(key => (
          <button key={key} className={`${s.sortBtn} ${sortBy === key ? s.sortBtnActive : ""}`} onClick={() => setSortBy(key)}>
            {key === "score" ? "Score ↓" : key.charAt(0).toUpperCase() + key.slice(1)}
          </button>
        ))}
      </div>

      {/* GRID */}
      {loading ? (
        <div className={s.noResults} style={{ padding: "60px 0", fontSize: "1rem", opacity: 0.6 }}>
          Loading scores from Supabase…
        </div>
      ) : (
        <div className={s.grid}>
          {filteredData.length === 0
            ? <div className={s.noResults}>No coffees match your filters.</div>
            : filteredData.map(c => <CoffeeCard key={c._id} coffee={c} onDelete={deleteScore} />)
          }
        </div>
      )}

      {/* MODAL */}
      {modalOpen && (
        <div className={s.modalOverlay} onClick={e => { if (e.target === e.currentTarget) setModalOpen(false); }}>
          <div className={s.modal}>
            <div className={s.modalHdr}>
              <div className={s.modalHdrTitle}>{editId ? "✏️ Edit Cup Score" : "➕ Add New Cup Score"}</div>
              <button className={s.modalClose} onClick={() => setModalOpen(false)}>✕</button>
            </div>
            <div className={s.modalBody}>
              <div className={s.formSectTitle}>📅 Year &amp; Lot</div>
              <div className={s.formGrid3}>
                <div className={s.formGroup}><label>Year *</label><input type="number" value={form.year} onChange={e => setForm(f => ({ ...f, year: e.target.value }))} placeholder="e.g. 2026" /></div>
                <div className={s.formGroup}><label>Lot No *</label><input type="text" value={form.lot} onChange={e => setForm(f => ({ ...f, lot: e.target.value }))} placeholder="e.g. 215" /></div>
                <div className={s.formGroup}><label>Series *</label>
                  <select value={form.series} onChange={e => setForm(f => ({ ...f, series: e.target.value }))}>
                    {["Gold Series","Small Batch","Nano Lot","Limited Edition"].map(o => <option key={o}>{o}</option>)}
                  </select>
                </div>
              </div>
              <div className={s.formSectTitle}>🌿 Coffee Details</div>
              <div className={s.formGrid}>
                <div className={s.formGroup}><label>Lot Name *</label><input type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. GOLD SERIES NATURALS" /></div>
                <div className={s.formGroup}><label>Coffee Type</label><input type="text" value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))} placeholder="e.g. Arabica Natural" /></div>
                <div className={s.formGroup}><label>Estate *</label>
                  <select value={form.estate} onChange={e => setForm(f => ({ ...f, estate: e.target.value }))}>
                    {["Stanmore Estate","Moganad Estate","Orchardale Estate","Bison Valley Estate","Hidden Falls Estate"].map(o => <option key={o}>{o}</option>)}
                  </select>
                </div>
                <div className={s.formGroup}><label>Process</label>
                  <select value={form.process} onChange={e => setForm(f => ({ ...f, process: e.target.value }))}>
                    {["Natural","Washed","Black Honey / PSD","Robusta"].map(o => <option key={o}>{o}</option>)}
                  </select>
                </div>
                <div className={s.formGroup}><label>Process Detail</label><input type="text" value={form.processDetail} onChange={e => setForm(f => ({ ...f, processDetail: e.target.value }))} placeholder="e.g. 48 Hrs Yeast Washed" /></div>
                <div className={s.formGroup}><label>Field / Block</label><input type="text" value={form.field} onChange={e => setForm(f => ({ ...f, field: e.target.value }))} placeholder="e.g. Meelish" /></div>
              </div>
              <div className={s.formSectTitle}>🏆 Score &amp; Pricing</div>
              <div className={s.formGrid3}>
                <div className={s.formGroup}><label>Cup Score *</label><input type="number" value={form.score} onChange={e => setForm(f => ({ ...f, score: e.target.value }))} placeholder="e.g. 86.75" step="0.25" /></div>
                <div className={s.formGroup}><label>Price (INR)</label><input type="text" value={form.priceINR} onChange={e => setForm(f => ({ ...f, priceINR: e.target.value }))} placeholder="e.g. ₹1,400" /></div>
                <div className={s.formGroup}><label>Price (USD FOB)</label><input type="text" value={form.priceUSD} onChange={e => setForm(f => ({ ...f, priceUSD: e.target.value }))} placeholder="e.g. $16.50" /></div>
              </div>
              <div className={s.formSectTitle}>☕ Cup Profile</div>
              <div className={s.formGrid}>
                <div className={s.formGroup}><label>Acidity</label><input type="text" value={form.acidity} onChange={e => setForm(f => ({ ...f, acidity: e.target.value }))} placeholder="e.g. Bright & Juicy" /></div>
                <div className={s.formGroup}><label>Body</label><input type="text" value={form.body} onChange={e => setForm(f => ({ ...f, body: e.target.value }))} placeholder="e.g. Silky, Medium+" /></div>
                <div className={s.formGroup}><label>Taste Notes</label><textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="e.g. Blackberry, blueberry, oolong tea, honey" /></div>
                <div className={s.formGroup}><label>Date Cupped</label><input type="text" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} placeholder="e.g. 15 Mar 26" /></div>
              </div>
              <div className={s.formGrid}>
                <div className={s.formGroup}><label>Quantity (kg)</label><input type="text" value={form.qty} onChange={e => setForm(f => ({ ...f, qty: e.target.value }))} placeholder="e.g. 500 kg" /></div>
              </div>
            </div>
            <div className={s.modalFooter}>
              <button className={`${s.btnModal} ${s.btnCancel}`} onClick={() => setModalOpen(false)}>Cancel</button>
              <button className={`${s.btnModal} ${s.btnSave}`} onClick={saveScore} disabled={saving}>
                {saving ? "Saving…" : "💾 Save Score"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
