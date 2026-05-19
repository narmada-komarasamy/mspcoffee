"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { Download, Plus, Pencil, Trash2, X, Palette } from "lucide-react";
import { supabase } from "@/lib/supabase";
import css from "./export.module.css";

/* ─── Constants ──────────────────────────────────────────────────────────────── */
const CURRENCIES: Record<string, string> = {
  USD: "$", EUR: "€", GBP: "£", AED: "د.إ",
  JPY: "¥", SGD: "S$", CHF: "Fr", AUD: "A$", CAD: "C$", INR: "₹",
};
const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const PAGE_SIZE = 25;
const CLIENT_COLORS = [
  "#1fc8c8","#f5a623","#2ecc71","#e8524a","#9b59b6","#3498db",
  "#fb923c","#f472b6","#a3e635","#34d399",
];

/* ─── Types ──────────────────────────────────────────────────────────────────── */
type ExportOrder = {
  id: number;
  date: string;
  client: string;
  product: string;
  qty_kg: number;
  price: number;
  currency: string;
  contract_date: string | null;
  rate_contract: number | null;
  rate_receipt: number | null;
  borrowed: number;
  date_borrowed: string | null;
  int_rate: number;
  date_received: string | null;
  credited: number;
  expenses: number;
  days: number;
  interest: number;
  net_profit: number;
  created_at: string;
};

type OrderForm = {
  date: string; client: string; product: string;
  qty_kg: string; price: string; currency: string;
  contract_date: string; rate_contract: string; rate_receipt: string;
  borrowed: string; date_borrowed: string; int_rate: string;
  date_received: string; credited: string; expenses: string;
};

type ThemeConfig = {
  bg: string; surface: string; card: string; border: string; text: string; muted: string;
  teal: string; gold: string; red: string; green: string;
};
const THEME_DEFAULT: ThemeConfig = {
  bg: "#0d1b2a", surface: "#16253a", card: "#1b2a3d",
  border: "#2a3f5a", text: "#e8edf4", muted: "#7a90b0",
  teal: "#1fc8c8", gold: "#f5a623", red: "#e8524a", green: "#2ecc71",
};

/* ─── Helpers ────────────────────────────────────────────────────────────────── */
const n = (v: unknown) => Number(v) || 0;

function fmtINR(v: number | null | undefined): string {
  if (v === null || v === undefined || isNaN(Number(v))) return "—";
  const abs = Math.abs(Number(v));
  const sign = Number(v) < 0 ? "-" : "";
  if (abs >= 10_000_000) return `${sign}₹${(abs / 10_000_000).toFixed(2)}Cr`;
  if (abs >= 100_000)    return `${sign}₹${(abs / 100_000).toFixed(2)}L`;
  return `${sign}₹${abs.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}
function fmtNum(v: number | null | undefined, d = 2): string {
  if (v === null || v === undefined || isNaN(Number(v))) return "—";
  return Number(v).toLocaleString("en-IN", { maximumFractionDigits: d, minimumFractionDigits: d });
}
function fmtDate(s: string | null | undefined): string {
  if (!s) return "—";
  const [y, m, d] = s.split("-");
  return `${d}/${m}/${y}`;
}
function daysBetween(d1: string, d2: string): number | null {
  if (!d1 || !d2) return null;
  const diff = new Date(d2).getTime() - new Date(d1).getTime();
  return Math.max(0, Math.round(diff / 86_400_000));
}
function calcInterest(borrowed: number, rate: number, days: number | null): number | null {
  if (!borrowed || !rate || days === null) return null;
  return parseFloat((borrowed * (rate / 100) * (days / 365)).toFixed(2));
}
function calcNetProfit(credited: number, borrowed: number, interest: number | null, expenses: number): number | null {
  if (!credited) return null;
  return parseFloat((credited - borrowed - (interest ?? 0) - expenses).toFixed(2));
}
function todayStr() {
  return new Date().toISOString().slice(0, 10);
}
function getStatus(o: ExportOrder) {
  return o.date_received ? "completed" : "pending";
}

const EMPTY_FORM: OrderForm = {
  date: "", client: "", product: "", qty_kg: "", price: "", currency: "USD",
  contract_date: "", rate_contract: "", rate_receipt: "",
  borrowed: "", date_borrowed: "", int_rate: "",
  date_received: "", credited: "", expenses: "",
};

const TT_STYLE = {
  backgroundColor: "var(--msp-navy-mid)",
  border: "1px solid var(--msp-navy-border)",
  borderRadius: 8, fontSize: 11, color: "var(--msp-text)",
};

/* ═══════════════════════════════════════════════════════════════════════════════
   MAIN PAGE
═══════════════════════════════════════════════════════════════════════════════ */
export default function ExportPage() {
  const [tab, setTab] = useState<"overview" | "records" | "analytics">("overview");
  const [orders, setOrders] = useState<ExportOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const realtimeRef = useRef(false);

  /* ── Modal state ─────────────────────────────────────────────────────────── */
  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState<OrderForm>({ ...EMPTY_FORM, date: todayStr() });
  const [saving, setSaving] = useState(false);
  const [formMsg, setFormMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  /* ── Theme ───────────────────────────────────────────────────────────────── */
  const [theme, setTheme] = useState<ThemeConfig>({ ...THEME_DEFAULT });
  const [showPalette, setShowPalette] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("mspc-export-theme");
    if (saved) try { setTheme(JSON.parse(saved)); } catch {}
  }, []);

  const updateTheme = useCallback(<K extends keyof ThemeConfig>(key: K, val: ThemeConfig[K]) => {
    setTheme(prev => {
      const next = { ...prev, [key]: val };
      localStorage.setItem("mspc-export-theme", JSON.stringify(next));
      return next;
    });
  }, []);
  const resetTheme = () => { setTheme({ ...THEME_DEFAULT }); localStorage.removeItem("mspc-export-theme"); };

  /* ── Data loading ────────────────────────────────────────────────────────── */
  const loadOrders = useCallback(async () => {
    setLoading(true);
    const all: ExportOrder[] = [];
    let from = 0;
    while (true) {
      const { data, error } = await supabase
        .from("export_orders")
        .select("*")
        .order("date", { ascending: false })
        .range(from, from + 999);
      if (error || !data || data.length === 0) break;
      all.push(...(data as ExportOrder[]));
      if (data.length < 1000) break;
      from += 1000;
    }
    setOrders(all);
    setLoading(false);
  }, []);

  useEffect(() => { loadOrders(); }, [loadOrders]);

  useEffect(() => {
    if (realtimeRef.current) return;
    realtimeRef.current = true;
    const ch = supabase
      .channel("export_orders_changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "export_orders" }, () => loadOrders())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [loadOrders]);

  /* ── Auto-calculated fields ──────────────────────────────────────────────── */
  const calcDays     = useMemo(() => daysBetween(form.date_borrowed, form.date_received), [form.date_borrowed, form.date_received]);
  const calcInt      = useMemo(() => calcInterest(n(form.borrowed), n(form.int_rate), calcDays), [form.borrowed, form.int_rate, calcDays]);
  const calcProfit   = useMemo(() => calcNetProfit(n(form.credited), n(form.borrowed), calcInt, n(form.expenses)), [form.credited, form.borrowed, calcInt, form.expenses]);

  /* ── Modal actions ───────────────────────────────────────────────────────── */
  const openNew = () => {
    setEditId(null);
    setForm({ ...EMPTY_FORM, date: todayStr() });
    setFormMsg(null);
    setModalOpen(true);
  };

  const openEdit = useCallback((o: ExportOrder) => {
    setEditId(o.id);
    setForm({
      date:          o.date || "",
      client:        o.client || "",
      product:       o.product || "",
      qty_kg:        o.qty_kg ? String(o.qty_kg) : "",
      price:         o.price ? String(o.price) : "",
      currency:      o.currency || "USD",
      contract_date: o.contract_date || "",
      rate_contract: o.rate_contract ? String(o.rate_contract) : "",
      rate_receipt:  o.rate_receipt  ? String(o.rate_receipt)  : "",
      borrowed:      o.borrowed ? String(o.borrowed) : "",
      date_borrowed: o.date_borrowed || "",
      int_rate:      o.int_rate ? String(o.int_rate) : "",
      date_received: o.date_received || "",
      credited:      o.credited ? String(o.credited) : "",
      expenses:      o.expenses ? String(o.expenses) : "",
    });
    setFormMsg(null);
    setModalOpen(true);
  }, []);

  const closeModal = () => { setModalOpen(false); setEditId(null); setFormMsg(null); };

  const saveOrder = async () => {
    if (!form.date || !form.client.trim() || !form.product.trim() || !form.qty_kg || !form.price) {
      setFormMsg({ type: "error", text: "Date, Client, Product, Quantity and Price are required." });
      return;
    }
    setSaving(true);
    setFormMsg(null);

    const payload = {
      date:          form.date,
      client:        form.client.trim(),
      product:       form.product.trim(),
      qty_kg:        n(form.qty_kg),
      price:         n(form.price),
      currency:      form.currency,
      contract_date: form.contract_date || null,
      rate_contract: form.rate_contract ? n(form.rate_contract) : null,
      rate_receipt:  form.rate_receipt  ? n(form.rate_receipt)  : null,
      borrowed:      n(form.borrowed),
      date_borrowed: form.date_borrowed || null,
      int_rate:      n(form.int_rate),
      date_received: form.date_received || null,
      credited:      n(form.credited),
      expenses:      n(form.expenses),
      days:          calcDays   ?? 0,
      interest:      calcInt    ?? 0,
      net_profit:    calcProfit ?? 0,
    };

    const { error } = editId
      ? await supabase.from("export_orders").update(payload).eq("id", editId)
      : await supabase.from("export_orders").insert([payload]);

    setSaving(false);
    if (error) {
      setFormMsg({ type: "error", text: error.message });
    } else {
      closeModal();
      loadOrders();
    }
  };

  const deleteOrder = useCallback(async (id: number) => {
    if (!confirm("Delete this export order? This cannot be undone.")) return;
    await supabase.from("export_orders").delete().eq("id", id);
    loadOrders();
  }, [loadOrders]);

  if (loading) return <div className={css.loading}>Loading export orders…</div>;

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
      {/* ── Tab bar ────────────────────────────────────────────────────────── */}
      <div className={css.tabs}>
        {([
          ["overview",  "📊 Overview"],
          ["records",   "📋 All Records"],
          ["analytics", "📈 Analytics"],
        ] as const).map(([t, label]) => (
          <button
            key={t}
            className={`${css.tab} ${tab === t ? css.tabActive : ""}`}
            onClick={() => setTab(t)}
          >
            {label}
          </button>
        ))}
        <div className={css.tabActions}>
          <button className={css.btnNew} onClick={openNew}>
            <Plus size={13} /> New Order
          </button>
          <button
            className={`${css.paletteBtn} ${showPalette ? css.paletteBtnActive : ""}`}
            onClick={() => setShowPalette(v => !v)}
          >
            <Palette size={13} /> Colours
          </button>
        </div>
      </div>

      {/* ── Tab content ────────────────────────────────────────────────────── */}
      {tab === "overview"  && <OverviewTab  orders={orders} theme={theme} onViewAll={() => setTab("records")} onEdit={openEdit} />}
      {tab === "records"   && <RecordsTab   orders={orders} onEdit={openEdit} onDelete={deleteOrder} />}
      {tab === "analytics" && <AnalyticsTab orders={orders} theme={theme} />}

      {/* ── Order Modal ────────────────────────────────────────────────────── */}
      {modalOpen && (
        <div className={css.modalOverlay} onClick={e => { if (e.target === e.currentTarget) closeModal(); }}>
          <div className={css.modal}>
            <div className={css.modalHeader}>
              <span className={css.modalTitle}>
                {editId ? "✏️ Edit Export Order" : "➕ New Export Order"}
              </span>
              <button className={css.modalClose} onClick={closeModal}><X size={14} /></button>
            </div>

            <div className={css.modalBody}>
              {/* Section 1: Order Details */}
              <div className={css.formSection}>
                <div className={css.formSectionTitle}>📦 Order Details</div>
                <div className={css.formGrid4}>
                  <div className={css.formGroup}>
                    <label className={css.formLabel}>Date of Shipment *</label>
                    <input type="date" className={css.formInput} value={form.date}
                      onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
                  </div>
                  <div className={css.formGroup}>
                    <label className={css.formLabel}>Client / Buyer *</label>
                    <input type="text" className={css.formInput} placeholder="e.g. Acme Coffee GmbH"
                      value={form.client}
                      onChange={e => setForm(f => ({ ...f, client: e.target.value }))} />
                  </div>
                  <div className={css.formGroup}>
                    <label className={css.formLabel}>Product *</label>
                    <input type="text" className={css.formInput} placeholder="e.g. Arabica Grade 1"
                      value={form.product}
                      onChange={e => setForm(f => ({ ...f, product: e.target.value }))} />
                  </div>
                  <div className={css.formGroup}>
                    <label className={css.formLabel}>Quantity (kg) *</label>
                    <input type="number" className={css.formInput} placeholder="e.g. 5000" min="0" step="0.01"
                      value={form.qty_kg}
                      onChange={e => setForm(f => ({ ...f, qty_kg: e.target.value }))} />
                  </div>
                </div>
              </div>

              {/* Section 2: Pricing & Currency */}
              <div className={css.formSection}>
                <div className={css.formSectionTitle}>💱 Pricing &amp; Currency</div>
                <div className={css.formGrid4}>
                  <div className={css.formGroup}>
                    <label className={css.formLabel}>Price per kg *</label>
                    <div className={css.priceWrap}>
                      <input type="number" className={css.formInput} placeholder="e.g. 4.50" min="0" step="0.0001"
                        value={form.price}
                        onChange={e => setForm(f => ({ ...f, price: e.target.value }))} />
                      <select className={css.formInput} value={form.currency}
                        onChange={e => setForm(f => ({ ...f, currency: e.target.value }))}>
                        {Object.keys(CURRENCIES).map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className={css.formGroup}>
                    <label className={css.formLabel}>Contract Signed On</label>
                    <input type="date" className={css.formInput} value={form.contract_date}
                      onChange={e => setForm(f => ({ ...f, contract_date: e.target.value }))} />
                  </div>
                  <div className={css.formGroup}>
                    <label className={css.formLabel}>Rate @ Contract (₹/unit)</label>
                    <input type="number" className={css.formInput} placeholder="e.g. 83.50" min="0" step="0.0001"
                      value={form.rate_contract}
                      onChange={e => setForm(f => ({ ...f, rate_contract: e.target.value }))} />
                  </div>
                  <div className={css.formGroup}>
                    <label className={css.formLabel}>Rate @ Receipt (₹/unit)</label>
                    <input type="number" className={css.formInput} placeholder="e.g. 84.20" min="0" step="0.0001"
                      value={form.rate_receipt}
                      onChange={e => setForm(f => ({ ...f, rate_receipt: e.target.value }))} />
                  </div>
                </div>
              </div>

              {/* Section 3: Borrowing & Finance */}
              <div className={css.formSection}>
                <div className={css.formSectionTitle}>🏦 Borrowing &amp; Finance</div>
                <div className={css.formGrid3}>
                  <div className={css.formGroup}>
                    <label className={css.formLabel}>Amount Borrowed (₹)</label>
                    <input type="number" className={css.formInput} placeholder="e.g. 25,00,000" min="0"
                      value={form.borrowed}
                      onChange={e => setForm(f => ({ ...f, borrowed: e.target.value }))} />
                  </div>
                  <div className={css.formGroup}>
                    <label className={css.formLabel}>Date Borrowed</label>
                    <input type="date" className={css.formInput} value={form.date_borrowed}
                      onChange={e => setForm(f => ({ ...f, date_borrowed: e.target.value }))} />
                  </div>
                  <div className={css.formGroup}>
                    <label className={css.formLabel}>Interest Rate (% p.a.)</label>
                    <input type="number" className={css.formInput} placeholder="e.g. 12.5" min="0" step="0.01"
                      value={form.int_rate}
                      onChange={e => setForm(f => ({ ...f, int_rate: e.target.value }))} />
                  </div>
                </div>
              </div>

              {/* Section 4: Payment Receipt */}
              <div className={css.formSection}>
                <div className={css.formSectionTitle}>✅ Payment Receipt</div>
                <div className={css.formGrid3}>
                  <div className={css.formGroup}>
                    <label className={css.formLabel}>Date Money Received</label>
                    <input type="date" className={css.formInput} value={form.date_received}
                      onChange={e => setForm(f => ({ ...f, date_received: e.target.value }))} />
                  </div>
                  <div className={css.formGroup}>
                    <label className={css.formLabel}>Amount Credited to Bank (₹)</label>
                    <input type="number" className={css.formInput} placeholder="e.g. 42,00,000" min="0"
                      value={form.credited}
                      onChange={e => setForm(f => ({ ...f, credited: e.target.value }))} />
                  </div>
                  <div className={css.formGroup}>
                    <label className={css.formLabel}>Expenses on Consignment (₹)</label>
                    <input type="number" className={css.formInput} placeholder="e.g. 85,000" min="0"
                      value={form.expenses}
                      onChange={e => setForm(f => ({ ...f, expenses: e.target.value }))} />
                  </div>
                </div>
              </div>

              {/* Section 5: Auto-calculated */}
              <div className={css.formSection} style={{ marginBottom: 0 }}>
                <div className={css.formSectionTitle}>
                  🧮 Calculated Figures
                  <span className={css.calcBadge}>Auto-calculated</span>
                </div>
                <div className={css.formGrid3}>
                  <div className={css.formGroup}>
                    <label className={css.formLabel}>Days (Borrowed → Received)</label>
                    <input type="text" className={css.formInput} readOnly
                      value={calcDays !== null ? String(calcDays) : ""} placeholder="—" />
                  </div>
                  <div className={css.formGroup}>
                    <label className={css.formLabel}>Interest (₹) — P × R × D/365</label>
                    <input type="text" className={css.formInput} readOnly
                      value={calcInt !== null ? calcInt.toFixed(2) : ""} placeholder="—" />
                  </div>
                  <div className={css.formGroup}>
                    <label className={css.formLabel}>Net Profit (₹) — Credited − Borrowed − Int − Exp</label>
                    <input type="text" className={css.formInput} readOnly
                      value={calcProfit !== null ? calcProfit.toFixed(2) : ""} placeholder="—"
                      style={{ color: calcProfit !== null ? (calcProfit >= 0 ? "#2ecc71" : "#e8524a") : undefined }} />
                  </div>
                </div>
              </div>

              {formMsg && (
                <div className={`${css.formMsg} ${formMsg.type === "success" ? css.formMsgSuccess : css.formMsgError}`}>
                  {formMsg.text}
                </div>
              )}
            </div>

            <div className={css.modalFooter}>
              <button className={css.btnCancel} onClick={closeModal}>Cancel</button>
              <button className={css.btnSave} disabled={saving} onClick={saveOrder}>
                {saving ? "Saving…" : "💾 Save Order"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Colour Customiser Panel ─────────────────────────────────────────── */}
      {showPalette && <div className={css.cpOverlay} onClick={() => setShowPalette(false)} />}
      <div className={`${css.cpPanel} ${showPalette ? css.cpPanelOpen : ""}`}>
        <button className={css.cpTab} onClick={() => setShowPalette(v => !v)} title="Colour Customiser">
          <Palette size={18} />
        </button>
        <div className={css.cpBody}>
          <div className={css.cpHeader}>
            <span>🎨</span>
            <span className={css.cpTitle}>Colour Customiser</span>
          </div>
          <div className={css.cpSectionTitle}>Theme</div>
          {([
            { key: "bg",      label: "Background"      },
            { key: "surface", label: "Surface / Cards" },
            { key: "card",    label: "Inner Cards"      },
            { key: "border",  label: "Borders"          },
            { key: "text",    label: "Body Text"        },
            { key: "muted",   label: "Muted Labels"     },
          ] as { key: keyof ThemeConfig; label: string }[]).map(({ key, label }) => (
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
            { key: "teal",  label: "Teal / Primary"  },
            { key: "gold",  label: "Gold / Revenue"  },
            { key: "green", label: "Green / Profit"  },
            { key: "red",   label: "Red / Loss"      },
          ] as { key: keyof ThemeConfig; label: string }[]).map(({ key, label }) => (
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

/* ═══════════════════════════════════════════════════════════════════════════════
   OVERVIEW TAB
═══════════════════════════════════════════════════════════════════════════════ */
function OverviewTab({
  orders, theme, onViewAll, onEdit,
}: {
  orders: ExportOrder[];
  theme: ThemeConfig;
  onViewAll: () => void;
  onEdit: (o: ExportOrder) => void;
}) {
  const { teal, gold, green, red } = theme;

  const totals = useMemo(() => {
    const completed = orders.filter(o => o.date_received);
    return {
      totalOrders:    orders.length,
      completedCount: completed.length,
      pendingCount:   orders.length - completed.length,
      totalQty:       orders.reduce((a, o) => a + n(o.qty_kg), 0),
      totalCredited:  orders.reduce((a, o) => a + n(o.credited), 0),
      totalInterest:  orders.reduce((a, o) => a + n(o.interest), 0),
      totalExpenses:  orders.reduce((a, o) => a + n(o.expenses), 0),
      totalProfit:    orders.reduce((a, o) => a + n(o.net_profit), 0),
    };
  }, [orders]);

  const clientData = useMemo(() => {
    const map = new Map<string, number>();
    orders.forEach(o => {
      if (o.client) map.set(o.client, (map.get(o.client) ?? 0) + n(o.credited));
    });
    return Array.from(map.entries())
      .sort(([,a],[,b]) => b - a)
      .slice(0, 8)
      .map(([client, revenue], i) => ({ client, revenue: Math.round(revenue), color: CLIENT_COLORS[i % CLIENT_COLORS.length] }));
  }, [orders]);

  const monthlyData = useMemo(() => {
    const map = new Map<string, number>();
    orders.forEach(o => {
      if (!o.date) return;
      const key = o.date.slice(0, 7);
      map.set(key, (map.get(key) ?? 0) + 1);
    });
    return Array.from(map.entries())
      .sort(([a],[b]) => a.localeCompare(b))
      .slice(-12)
      .map(([key, count]) => {
        const [y, m] = key.split("-");
        return { label: MONTHS[parseInt(m) - 1] + " " + y.slice(2), count };
      });
  }, [orders]);

  const recent = useMemo(() => [...orders].slice(0, 8), [orders]);

  return (
    <div>
      {/* KPI Cards */}
      <div className={css.kpiGrid}>
        <div className={css.kpiCard} style={{ "--accent": teal } as React.CSSProperties}>
          <div className={css.kpiLabel}>📦 Total Orders</div>
          <div className={css.kpiValue}>{totals.totalOrders}</div>
          <div className={css.kpiSub}>{totals.completedCount} completed · {totals.pendingCount} pending</div>
          <div className={css.kpiBar}><div className={css.kpiBarFill} style={{ width: "100%", background: teal }} /></div>
        </div>
        <div className={css.kpiCard} style={{ "--accent": gold } as React.CSSProperties}>
          <div className={css.kpiLabel}>☕ Total Qty</div>
          <div>
            <span className={css.kpiValue}>{fmtNum(totals.totalQty, 0)}</span>
            <span className={css.kpiUnit}>kg</span>
          </div>
          <div className={css.kpiSub}>All shipments</div>
          <div className={css.kpiBar}><div className={css.kpiBarFill} style={{ width: "100%", background: gold }} /></div>
        </div>
        <div className={css.kpiCard} style={{ "--accent": teal } as React.CSSProperties}>
          <div className={css.kpiLabel}>🏦 Total Revenue</div>
          <div className={css.kpiValue} style={{ fontSize: "1.35rem" }}>{fmtINR(totals.totalCredited)}</div>
          <div className={css.kpiSub}>Credited to bank</div>
          <div className={css.kpiBar}><div className={css.kpiBarFill} style={{ width: "100%", background: teal }} /></div>
        </div>
        <div className={css.kpiCard} style={{ "--accent": red } as React.CSSProperties}>
          <div className={css.kpiLabel}>📉 Interest + Expenses</div>
          <div className={css.kpiValue} style={{ fontSize: "1.35rem", color: red }}>{fmtINR(totals.totalInterest + totals.totalExpenses)}</div>
          <div className={css.kpiSub}>Int: {fmtINR(totals.totalInterest)} · Exp: {fmtINR(totals.totalExpenses)}</div>
          <div className={css.kpiBar}><div className={css.kpiBarFill} style={{ width: "100%", background: red }} /></div>
        </div>
        <div className={css.kpiCard} style={{ "--accent": totals.totalProfit >= 0 ? green : red } as React.CSSProperties}>
          <div className={css.kpiLabel}>💚 Net Profit</div>
          <div className={css.kpiValue} style={{ fontSize: "1.35rem", color: totals.totalProfit >= 0 ? green : red }}>
            {fmtINR(totals.totalProfit)}
          </div>
          <div className={css.kpiSub}>After interest &amp; expenses</div>
          <div className={css.kpiBar}><div className={css.kpiBarFill} style={{ width: "100%", background: totals.totalProfit >= 0 ? green : red }} /></div>
        </div>
      </div>

      {/* Charts */}
      <div className={css.charts2col}>
        <div className={css.chartCard}>
          <div className={css.sectionHdr}><span>◆</span> REVENUE BY CLIENT (₹)</div>
          {clientData.length > 0 ? (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={clientData} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="client" tick={{ fill: "var(--msp-neutral)", fontSize: 10 }}
                  tickLine={false} axisLine={false}
                  tickFormatter={v => v.length > 12 ? v.slice(0, 11) + "…" : v} />
                <YAxis tick={{ fill: "var(--msp-neutral)", fontSize: 10 }} tickLine={false} axisLine={false}
                  tickFormatter={v => v >= 100000 ? `₹${(v/100000).toFixed(1)}L` : `₹${v}`} />
                <Tooltip contentStyle={TT_STYLE} formatter={(v: unknown) => [fmtINR(n(v)), "Revenue"]} />
                <Bar dataKey="revenue" radius={[4, 4, 0, 0]}>
                  {clientData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className={css.empty}>No data yet</div>
          )}
        </div>

        <div className={css.chartCard}>
          <div className={css.sectionHdr}><span>◆</span> MONTHLY ORDERS</div>
          {monthlyData.length > 0 ? (
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={monthlyData} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="label" tick={{ fill: "var(--msp-neutral)", fontSize: 10 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fill: "var(--msp-neutral)", fontSize: 10 }} tickLine={false} axisLine={false} allowDecimals={false} />
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                <Tooltip contentStyle={TT_STYLE} formatter={(v: any) => [v, "Orders"]} />
                <Line type="monotone" dataKey="count" stroke={gold} strokeWidth={2}
                  dot={{ fill: gold, r: 4 }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className={css.empty}>No data yet</div>
          )}
        </div>
      </div>

      {/* Recent Orders */}
      <div className={css.sectionRow}>
        <span className={css.sectionRowTitle}><span>◆</span> RECENT EXPORT ORDERS</span>
        <button className={css.btnViewAll} onClick={onViewAll}>View All →</button>
      </div>
      <div className={css.tableCard}>
        {recent.length === 0 ? (
          <div className={css.empty}>No orders yet. Click "New Order" to add one.</div>
        ) : (
          <table className={css.table}>
            <thead>
              <tr>
                <th>Date</th><th>Client</th><th>Product</th><th className={css.tdRight}>Qty (kg)</th>
                <th>Price</th><th className={css.tdRight}>Rate @Contract</th>
                <th className={css.tdRight}>Credited (₹)</th><th className={css.tdRight}>Net Profit (₹)</th>
                <th>Status</th><th></th>
              </tr>
            </thead>
            <tbody>
              {recent.map(o => {
                const status = getStatus(o);
                const sym = CURRENCIES[o.currency] ?? o.currency;
                return (
                  <tr key={o.id}>
                    <td style={{ whiteSpace: "nowrap" }}>{fmtDate(o.date)}</td>
                    <td>{o.client}</td>
                    <td>{o.product}</td>
                    <td className={css.tdNum}>{fmtNum(o.qty_kg, 0)}</td>
                    <td><span className={css.currencyPill}>{o.currency}</span>{sym}{fmtNum(o.price, 4)}</td>
                    <td className={css.tdNum}>{o.rate_contract ? `₹${fmtNum(o.rate_contract, 2)}` : "—"}</td>
                    <td className={`${css.tdNum}`} style={{ color: "#f5a623" }}>{fmtINR(o.credited)}</td>
                    <td className={`${css.tdNum} ${n(o.net_profit) >= 0 ? css.profitPos : css.profitNeg}`}>
                      {fmtINR(o.net_profit)}
                    </td>
                    <td>
                      <span className={status === "completed" ? css.badgeCompleted : css.badgePending}>
                        {status}
                      </span>
                    </td>
                    <td>
                      <button className={css.btnIconEdit} onClick={() => onEdit(o)}>
                        <Pencil size={11} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════════
   ALL RECORDS TAB
═══════════════════════════════════════════════════════════════════════════════ */
function RecordsTab({
  orders, onEdit, onDelete,
}: {
  orders: ExportOrder[];
  onEdit: (o: ExportOrder) => void;
  onDelete: (id: number) => void;
}) {
  const [search,        setSearch]        = useState("");
  const [filterProduct, setFilterProduct] = useState("ALL");
  const [filterStatus,  setFilterStatus]  = useState("ALL");
  const [page,          setPage]          = useState(0);

  const products = useMemo(() => Array.from(new Set(orders.map(o => o.product).filter(Boolean))).sort(), [orders]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return orders.filter(o => {
      if (filterProduct !== "ALL" && o.product !== filterProduct) return false;
      if (filterStatus  !== "ALL" && getStatus(o) !== filterStatus) return false;
      if (q && !`${o.client} ${o.product}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [orders, search, filterProduct, filterStatus]);

  const prevKey = useRef("");
  const filterKey = `${search}|${filterProduct}|${filterStatus}`;
  if (prevKey.current !== filterKey) { prevKey.current = filterKey; if (page !== 0) setPage(0); }

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageRows   = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const downloadCSV = useCallback(() => {
    const hdr = ["Date","Client","Product","Qty(kg)","Price","Currency","Borrowed(₹)","Date Borrowed",
                 "Int Rate%","Contract Date","Rate@Contract","Date Received","Credited(₹)",
                 "Rate@Receipt","Expenses(₹)","Days","Interest(₹)","Net Profit(₹)","Status"];
    const rows = filtered.map(o => [
      o.date, o.client, o.product, o.qty_kg, o.price, o.currency, o.borrowed,
      o.date_borrowed ?? "", o.int_rate, o.contract_date ?? "", o.rate_contract ?? "",
      o.date_received ?? "", o.credited, o.rate_receipt ?? "", o.expenses,
      o.days, o.interest, o.net_profit, getStatus(o),
    ]);
    const csv = [hdr, ...rows].map(r => r.map(v => `"${v ?? ""}"`).join(",")).join("\n");
    const a = Object.assign(document.createElement("a"), {
      href: "data:text/csv;charset=utf-8," + encodeURIComponent(csv),
      download: `MSP_Exports_${new Date().toISOString().slice(0, 10)}.csv`,
    });
    a.click();
  }, [filtered]);

  return (
    <div>
      <div className={css.filterBar}>
        <div className={css.ctrlGrp}>
          <span className={css.ctrlLbl}>Search</span>
          <input className={css.searchInput} placeholder="Client or product…" value={search}
            onChange={e => setSearch(e.target.value)} />
        </div>
        <div className={css.ctrlGrp}>
          <span className={css.ctrlLbl}>Product</span>
          <select className={css.sel} value={filterProduct} onChange={e => setFilterProduct(e.target.value)}>
            <option value="ALL">All Products</option>
            {products.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
        <div className={css.ctrlGrp}>
          <span className={css.ctrlLbl}>Status</span>
          <select className={css.sel} value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
            <option value="ALL">All</option>
            <option value="completed">Completed</option>
            <option value="pending">Pending</option>
          </select>
        </div>
        <button className={css.btnExport} onClick={downloadCSV} style={{ alignSelf: "flex-end" }}>
          <Download size={13} /> Export CSV
        </button>
      </div>

      <div className={css.recordsCount}>
        {filtered.length} order{filtered.length !== 1 ? "s" : ""} found
      </div>

      <div className={css.tableCard}>
        <table className={css.table}>
          <thead>
            <tr>
              <th>Date</th><th>Client</th><th>Product</th><th className={css.tdRight}>Qty (kg)</th>
              <th>Price</th><th>Borrowed (₹)</th><th>Date Brwd</th><th>Int %</th>
              <th>Ctr Date</th><th className={css.tdRight}>Rate @Ctr</th>
              <th>Rcvd Date</th><th className={css.tdRight}>Credited (₹)</th>
              <th className={css.tdRight}>Rate @Rcpt</th><th className={css.tdRight}>Expenses (₹)</th>
              <th className={css.tdRight}>Days</th><th className={css.tdRight}>Interest (₹)</th>
              <th className={css.tdRight}>Net Profit (₹)</th>
              <th>Status</th><th></th>
            </tr>
          </thead>
          <tbody>
            {pageRows.length === 0 ? (
              <tr>
                <td colSpan={19} style={{ textAlign: "center", color: "var(--msp-neutral)", padding: "2.5rem" }}>
                  No orders match the selected filters
                </td>
              </tr>
            ) : pageRows.map(o => {
              const status = getStatus(o);
              const sym = CURRENCIES[o.currency] ?? o.currency;
              return (
                <tr key={o.id}>
                  <td style={{ whiteSpace: "nowrap" }}>{fmtDate(o.date)}</td>
                  <td>{o.client}</td>
                  <td>{o.product}</td>
                  <td className={css.tdNum}>{fmtNum(o.qty_kg, 0)}</td>
                  <td><span className={css.currencyPill}>{o.currency}</span>{sym}{fmtNum(o.price, 4)}</td>
                  <td className={css.tdNum}>{o.borrowed ? fmtINR(o.borrowed) : "—"}</td>
                  <td style={{ whiteSpace: "nowrap" }}>{fmtDate(o.date_borrowed)}</td>
                  <td className={css.tdNum}>{o.int_rate ? `${o.int_rate}%` : "—"}</td>
                  <td style={{ whiteSpace: "nowrap" }}>{fmtDate(o.contract_date)}</td>
                  <td className={css.tdNum}>{o.rate_contract ? `₹${fmtNum(o.rate_contract, 2)}` : "—"}</td>
                  <td style={{ whiteSpace: "nowrap" }}>{fmtDate(o.date_received)}</td>
                  <td className={`${css.tdNum}`} style={{ color: "#f5a623" }}>{fmtINR(o.credited)}</td>
                  <td className={css.tdNum}>{o.rate_receipt ? `₹${fmtNum(o.rate_receipt, 2)}` : "—"}</td>
                  <td className={css.tdNum}>{o.expenses ? fmtINR(o.expenses) : "—"}</td>
                  <td className={`${css.tdNum} ${css.tdMuted}`}>{o.days || "—"}</td>
                  <td className={`${css.tdNum}`} style={{ color: "#e8524a" }}>{o.interest ? fmtINR(o.interest) : "—"}</td>
                  <td className={`${css.tdNum} ${n(o.net_profit) >= 0 ? css.profitPos : css.profitNeg}`}>
                    {fmtINR(o.net_profit)}
                  </td>
                  <td>
                    <span className={status === "completed" ? css.badgeCompleted : css.badgePending}>
                      {status}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: "flex", gap: "0.25rem" }}>
                      <button className={css.btnIconEdit} onClick={() => onEdit(o)}>
                        <Pencil size={11} />
                      </button>
                      <button className={css.btnIconDel} onClick={() => onDelete(o.id)}>
                        <Trash2 size={11} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className={css.pagination}>
        <button className={css.pageBtn} disabled={page === 0} onClick={() => setPage(0)}>«</button>
        <button className={css.pageBtn} disabled={page === 0} onClick={() => setPage(p => p - 1)}>‹</button>
        <span>Page {page + 1} / {totalPages}</span>
        <button className={css.pageBtn} disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>›</button>
        <button className={css.pageBtn} disabled={page >= totalPages - 1} onClick={() => setPage(totalPages - 1)}>»</button>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════════
   ANALYTICS TAB
═══════════════════════════════════════════════════════════════════════════════ */
function AnalyticsTab({ orders, theme }: { orders: ExportOrder[]; theme: ThemeConfig }) {
  const { green, red, gold, teal } = theme;

  const breakdownData = useMemo(() => {
    const tCredited = orders.reduce((a, o) => a + n(o.credited), 0);
    const tBorrowed = orders.reduce((a, o) => a + n(o.borrowed), 0);
    const tInterest = orders.reduce((a, o) => a + n(o.interest), 0);
    const tExpenses = orders.reduce((a, o) => a + n(o.expenses), 0);
    const tProfit   = orders.reduce((a, o) => a + n(o.net_profit), 0);
    if (tCredited === 0) return [];
    return [
      { name: "Net Profit",       value: Math.max(0, tProfit),   color: green },
      { name: "Amount Borrowed",  value: tBorrowed,              color: teal  },
      { name: "Interest",         value: tInterest,              color: red   },
      { name: "Expenses",         value: tExpenses,              color: gold  },
    ].filter(d => d.value > 0);
  }, [orders, green, teal, red, gold]);

  const productData = useMemo(() => {
    const map = new Map<string, number>();
    orders.forEach(o => {
      if (o.product) map.set(o.product, (map.get(o.product) ?? 0) + n(o.credited));
    });
    return Array.from(map.entries())
      .sort(([,a],[,b]) => b - a)
      .map(([name, value], i) => ({ name, value: Math.round(value), color: CLIENT_COLORS[i % CLIENT_COLORS.length] }));
  }, [orders]);

  const rateData = useMemo(() => {
    return orders
      .filter(o => o.rate_contract || o.rate_receipt)
      .sort((a, b) => a.date.localeCompare(b.date))
      .map(o => ({
        label:    fmtDate(o.date),
        contract: o.rate_contract ?? null,
        receipt:  o.rate_receipt  ?? null,
      }));
  }, [orders]);

  return (
    <div>
      <div className={css.charts2col}>
        {/* Profit breakdown */}
        <div className={css.chartCard}>
          <div className={css.sectionHdr}><span>◆</span> PROFIT vs INTEREST vs EXPENSES</div>
          {breakdownData.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={breakdownData} cx="50%" cy="50%"
                    innerRadius={60} outerRadius={90} paddingAngle={3} dataKey="value">
                    {breakdownData.map((d, i) => <Cell key={i} fill={d.color} />)}
                  </Pie>
                  <Tooltip contentStyle={TT_STYLE} formatter={(v: unknown) => [fmtINR(n(v))]} />
                </PieChart>
              </ResponsiveContainer>
              <div className={css.pieLegendRow}>
                {breakdownData.map(d => {
                  const total = breakdownData.reduce((a, x) => a + x.value, 0);
                  const pct = total > 0 ? Math.round((d.value / total) * 100) : 0;
                  return (
                    <div key={d.name} className={css.pieLegendItem}>
                      <span className={css.pieLegendDot} style={{ background: d.color }} />
                      <div>
                        <div>{d.name} — {fmtINR(d.value)}</div>
                        <div className={css.pieLegendSub}>{pct}% of total</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <div className={css.empty}>No data yet</div>
          )}
        </div>

        {/* Revenue by product */}
        <div className={css.chartCard}>
          <div className={css.sectionHdr}><span>◆</span> REVENUE BY PRODUCT (₹)</div>
          {productData.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={productData} cx="50%" cy="50%"
                    innerRadius={60} outerRadius={90} paddingAngle={3} dataKey="value">
                    {productData.map((d, i) => <Cell key={i} fill={d.color} />)}
                  </Pie>
                  <Tooltip contentStyle={TT_STYLE} formatter={(v: unknown) => [fmtINR(n(v))]} />
                </PieChart>
              </ResponsiveContainer>
              <div className={css.pieLegendRow}>
                {productData.map(d => {
                  const total = productData.reduce((a, x) => a + x.value, 0);
                  const pct = total > 0 ? Math.round((d.value / total) * 100) : 0;
                  return (
                    <div key={d.name} className={css.pieLegendItem}>
                      <span className={css.pieLegendDot} style={{ background: d.color }} />
                      <div>
                        <div>{d.name} — {fmtINR(d.value)}</div>
                        <div className={css.pieLegendSub}>{pct}% of revenue</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <div className={css.empty}>No data yet</div>
          )}
        </div>
      </div>

      {/* Exchange rate trend */}
      <div className={css.charts1col}>
        <div className={css.chartCard}>
          <div className={css.sectionHdr}><span>◆</span> EXCHANGE RATE TREND — CONTRACT vs RECEIPT</div>
          <div className={css.legendRow}>
            <span className={css.legendDot}><span className={css.dot} style={{ background: gold }} />Rate @ Contract</span>
            <span className={css.legendDot}><span className={css.dot} style={{ background: green }} />Rate @ Receipt</span>
          </div>
          {rateData.length > 0 ? (
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={rateData} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="label" tick={{ fill: "var(--msp-neutral)", fontSize: 10 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fill: "var(--msp-neutral)", fontSize: 10 }} tickLine={false} axisLine={false}
                  tickFormatter={v => `₹${v}`} />
                <Tooltip contentStyle={TT_STYLE}
                  formatter={(v: unknown, name: unknown) => [`₹${fmtNum(n(v), 2)}`, name as string]} />
                <Line type="monotone" dataKey="contract" name="Rate @ Contract" stroke={gold}
                  strokeWidth={2} dot={{ fill: gold, r: 4 }} connectNulls />
                <Line type="monotone" dataKey="receipt" name="Rate @ Receipt" stroke={green}
                  strokeWidth={2} dot={{ fill: green, r: 4 }} strokeDasharray="5 3" connectNulls />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className={css.empty}>No exchange rate data yet</div>
          )}
        </div>
      </div>
    </div>
  );
}
