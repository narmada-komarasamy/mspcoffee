"use client";

import { useEffect, useState, useCallback, useMemo, useReducer, useRef } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from "recharts";
import {
  Plus, X, Printer, Send, ArrowDownToLine, Pencil, ChevronDown, ChevronRight,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import css from "./coffee-storage.module.css";

/* ═══════════════════════════════════════════════════════════════
   TYPES
═══════════════════════════════════════════════════════════════ */
type Process = "Bag Natural" | "Regular Washed" | "Watermelon Washed";
type BatchStatus = "yard" | "at-mill" | "milled" | "depleted";
type GreenStatus  = "in-stock" | "reserved" | "depleted";
type SaleStatus   = "pending" | "shipped" | "transferred";
type BlendStatus  = "draft" | "active" | "retired";
type Channel      = "exporter" | "cafe" | "internal-roast" | "retail";
type AuditAction  = "batch-created" | "sent-to-mill" | "milling-return" | "weight-adjust" | "transfer" | "sale-created" | "blend-created" | "blend-produced";

type ParchBatch = {
  id: string; lot: string; date: string; field: string;
  process: Process; cherry_kg: number; floats_kg: number;
  nett_kg: number; parch_kg: number; rate_per_kg: number;
  status: BatchStatus; bin: string | null; grade: string | null;
  score: number | null; notes: string | null; tasting_notes: string | null;
  sent_to_mill: string | null; expected_return: string | null;
  miller: string | null; expected_green_kg: number | null; truck_ref: string | null;
};
type GreenLot = {
  id: string; lot: string; derived_from: string[];
  green_kg_in: number; current_kg: number; rate_per_kg: number;
  process: string; field: string; grade: string; screen: string;
  score: number | null; milled_date: string; warehouse: string;
  status: GreenStatus; notes: string | null; season: string;
};
type CoffeeSale = {
  id: string; date: string; channel: Channel; customer: string;
  green_lot_ids: string[]; kg: number; price_per_kg: number;
  currency: string; status: SaleStatus;
  incoterm: string | null; reference: string | null; notes: string | null;
};
type Blend = {
  id: string; name: string; description: string | null;
  total_kg: number; status: BlendStatus;
  target_sell_price_per_kg: number; created_date: string;
  recipe?: { green_lot_id: string; kg: number }[];
};
type AuditEntry = {
  id: string; ts: string; actor: string; action: AuditAction;
  entity: string; before: string | null; after: string | null; note: string | null;
};

type AppState = {
  batches: ParchBatch[];
  greenLots: GreenLot[];
  sales: CoffeeSale[];
  blends: Blend[];
  audit: AuditEntry[];
  loading: boolean;
};

type Tab = "overview" | "yard" | "milling" | "green" | "hilltiller" | "blends" | "sales" | "audit";

/* ═══════════════════════════════════════════════════════════════
   HELPERS
═══════════════════════════════════════════════════════════════ */
const n = (v: unknown) => Number(v) || 0;

function fmtKg(v: number) {
  if (v >= 1000) return `${(v / 1000).toFixed(2)}t`;
  return `${Math.round(v)} kg`;
}
function fmtINR(v: number) {
  if (!v && v !== 0) return "—";
  const abs = Math.abs(v);
  const sign = v < 0 ? "-" : "";
  if (abs >= 10_000_000) return `${sign}₹${(abs / 10_000_000).toFixed(2)}Cr`;
  if (abs >= 100_000)    return `${sign}₹${(abs / 100_000).toFixed(2)}L`;
  return `${sign}₹${Math.round(abs).toLocaleString("en-IN")}`;
}
function fmtDate(s: string | null | undefined) {
  if (!s) return "—";
  const [y, m, d] = s.split("-");
  return `${d}/${m}/${y}`;
}
function todayStr() { return new Date().toISOString().slice(0, 10); }
function processSlug(p: string) {
  if (p === "Bag Natural") return "natural";
  if (p === "Regular Washed") return "washed";
  return "watermelon";
}
function processBadgeClass(p: string) {
  if (p === "Bag Natural") return css.badgeNatural;
  if (p === "Regular Washed") return css.badgeWashed;
  return css.badgeWatermelon;
}
function statusBadgeClass(s: string) {
  const map: Record<string, string> = {
    yard: css.badgeYard, "at-mill": css.badgeAtMill, milled: css.badgeMilled, depleted: css.badgeDepleted,
    "in-stock": css.badgeInStock, reserved: css.badgeReserved,
    pending: css.badgePending, shipped: css.badgeShipped, transferred: css.badgeTransferred,
    draft: css.badgeDraft, active: css.badgeActive, retired: css.badgeRetired,
  };
  return `${css.badge} ${map[s] ?? ""}`;
}
function channelBadgeClass(ch: string) {
  const map: Record<string, string> = {
    exporter: css.badgeExp, cafe: css.badgeCafe, "internal-roast": css.badgeRoast, retail: css.badgeRetail,
  };
  return `${css.badge} ${map[ch] ?? ""}`;
}
function channelLabel(ch: string) {
  const map: Record<string, string> = {
    exporter: "EXP", cafe: "CAFÉ", "internal-roast": "ROAST", retail: "RTL",
  };
  return map[ch] ?? ch;
}
function auditActionClass(a: AuditAction) {
  const map: Record<AuditAction, string> = {
    "batch-created": css.badgeBatchCreated, "sent-to-mill": css.badgeSentToMill,
    "milling-return": css.badgeMillingReturn, "weight-adjust": css.badgeWeightAdjust,
    transfer: css.badgeTransferAudit, "sale-created": css.badgeSaleCreated,
    "blend-created": css.badgeBlendCreated, "blend-produced": css.badgeBlendCreated,
  };
  return `${css.badge} ${map[a] ?? ""}`;
}
function processColor(p: string) {
  if (p === "Bag Natural") return "#f5a623";
  if (p === "Regular Washed") return "#1fc8c8";
  return "#e8524a";
}
function channelColor(ch: string) {
  const map: Record<string, string> = {
    exporter: "#3498db", cafe: "#2ecc71", "internal-roast": "#f5a623", retail: "#9b59b6",
  };
  return map[ch] ?? "#7a90b0";
}
const TT_STYLE = {
  backgroundColor: "#0a1824", border: "1px solid #2a3f5a",
  borderRadius: 6, fontSize: 11, color: "var(--t-text)",
};

function getUser() {
  try {
    const s = localStorage.getItem("msp_user");
    return s ? JSON.parse(s)?.name ?? "User" : "User";
  } catch { return "User"; }
}

/* ═══════════════════════════════════════════════════════════════
   DATA LAYER — Supabase
═══════════════════════════════════════════════════════════════ */
async function fetchAll(): Promise<Omit<AppState, "loading">> {
  const [bRes, gRes, sRes, blRes, brRes, aRes] = await Promise.all([
    supabase.from("parchment_batches").select("*").order("date", { ascending: false }),
    supabase.from("green_lots").select("*").order("milled_date", { ascending: false }),
    supabase.from("coffee_sales").select("*").order("date", { ascending: false }),
    supabase.from("blends").select("*").order("created_date", { ascending: false }),
    supabase.from("blend_recipe_items").select("*"),
    supabase.from("coffee_audit_log").select("*").order("ts", { ascending: false }).limit(200),
  ]);
  const batches   = (bRes.data ?? []) as ParchBatch[];
  const greenLots = (gRes.data ?? []) as GreenLot[];
  const sales     = (sRes.data ?? []) as CoffeeSale[];
  const blendRaw  = (blRes.data ?? []) as Blend[];
  const recipeItems = (brRes.data ?? []) as { blend_id: string; green_lot_id: string; kg: number }[];
  const audit     = (aRes.data ?? []) as AuditEntry[];

  const blends: Blend[] = blendRaw.map(b => ({
    ...b,
    recipe: recipeItems.filter(r => r.blend_id === b.id).map(r => ({ green_lot_id: r.green_lot_id, kg: r.kg })),
  }));
  return { batches, greenLots, sales, blends, audit };
}

async function writeAudit(entry: Omit<AuditEntry, "id">) {
  await supabase.from("coffee_audit_log").insert([entry]);
}

/* ═══════════════════════════════════════════════════════════════
   MAIN PAGE
═══════════════════════════════════════════════════════════════ */
export default function CoffeeStoragePage() {
  const [state, setState] = useState<AppState>({ batches: [], greenLots: [], sales: [], blends: [], audit: [], loading: true });
  const [tab, setTab] = useState<Tab>("overview");

  const reload = useCallback(async () => {
    setState(s => ({ ...s, loading: true }));
    const data = await fetchAll();
    setState({ ...data, loading: false });
  }, []);

  useEffect(() => { reload(); }, [reload]);

  if (state.loading) return <div className={css.loading}>Loading Coffee Storage…</div>;

  const { batches, greenLots, sales, blends, audit } = state;

  return (
    <div>
      {/* Tab strip */}
      <div className={css.tabs}>
        {([
          ["overview", "📊 Overview"],
          ["yard",     "🌾 Parchment Yard", "Sheet 1"],
          ["milling",  "⚙️ Milling"],
          ["green",       "☕ Green Store",          "Sheet 2"],
          ["hilltiller",  "🌱 HillTiller Green Stock"],
          ["blends",      "🧪 Blends"],
          ["sales",    "🌍 Sales"],
          ["audit",    "📋 Audit Log"],
        ] as [Tab, string, string?][]).map(([t, label, sub]) => (
          <button key={t} className={`${css.tab} ${tab === t ? css.tabActive : ""}`} onClick={() => setTab(t)}>
            {label}
            {sub && <span className={css.tabSubLabel}>{sub}</span>}
          </button>
        ))}
      </div>

      {tab === "overview" && <OverviewTab batches={batches} greenLots={greenLots} sales={sales} setTab={setTab} />}
      {tab === "yard"     && <YardTab     batches={batches} greenLots={greenLots} reload={reload} />}
      {tab === "milling"  && <MillingTab  batches={batches} greenLots={greenLots} reload={reload} />}
      {tab === "green"    && <GreenTab    greenLots={greenLots} reload={reload} setTab={setTab} />}
      {tab === "hilltiller" && <HillTillerTab />}
      {tab === "blends"   && <BlendsTab   blends={blends} greenLots={greenLots} reload={reload} setTab={setTab} />}
      {tab === "sales"    && <SalesTab    sales={sales} greenLots={greenLots} reload={reload} setTab={setTab} />}
      {tab === "audit"    && <AuditTab    audit={audit} />}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   OVERVIEW TAB
═══════════════════════════════════════════════════════════════ */
function OverviewTab({ batches, greenLots, sales, setTab }: {
  batches: ParchBatch[]; greenLots: GreenLot[]; sales: CoffeeSale[];
  setTab: (t: Tab) => void;
}) {
  const kpis = useMemo(() => {
    const totalOrders   = sales.length;
    const totalQty      = sales.reduce((a, s) => a + n(s.kg), 0);
    const totalRevenue  = sales.reduce((a, s) => a + n(s.kg) * n(s.price_per_kg), 0);
    const stockValue    = greenLots.filter(g => g.status === "in-stock")
                           .reduce((a, g) => a + n(g.current_kg) * n(g.rate_per_kg), 0);
    return { totalOrders, totalQty, totalRevenue, stockValue };
  }, [sales, greenLots]);

  const customerData = useMemo(() => {
    const map = new Map<string, number>();
    sales.forEach(s => {
      if (s.customer) map.set(s.customer, (map.get(s.customer) ?? 0) + n(s.kg) * n(s.price_per_kg));
    });
    const colors = ["#1fc8c8","#f5a623","#2ecc71","#e8524a","#9b59b6","#3498db"];
    return Array.from(map.entries()).sort(([,a],[,b]) => b-a).slice(0,6)
      .map(([customer, revenue], i) => ({ customer, revenue: Math.round(revenue), color: colors[i % colors.length] }));
  }, [sales]);

  const monthlyData = useMemo(() => {
    const map = new Map<string, number>();
    sales.forEach(s => {
      if (!s.date) return;
      const key = s.date.slice(0,7);
      map.set(key, (map.get(key) ?? 0) + 1);
    });
    return Array.from(map.entries()).sort(([a],[b]) => a.localeCompare(b)).slice(-8)
      .map(([k, count]) => { const [y,m] = k.split("-"); return { label: ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][parseInt(m)-1] + " '" + y.slice(2), count }; });
  }, [sales]);

  const yardCount   = batches.filter(b => b.status === "yard").length;
  const millingCount= batches.filter(b => b.status === "at-mill").length;
  const greenCount  = greenLots.filter(g => g.status === "in-stock").length;
  const soldYTD     = sales.filter(s => s.date?.startsWith(new Date().getFullYear().toString())).reduce((a,s)=>a+n(s.kg),0);

  const flowSteps: { icon: string; label: string; sub: string; value: string; color: string; tab: Tab }[] = [
    { icon: "🌿", label: "Cherry",        sub: "Field harvest",     value: `${batches.length} lots`,         color: "#2ecc71", tab: "yard"    },
    { icon: "🌾", label: "Parchment Yard", sub: "Sheet 1",          value: `${yardCount} on yard`,           color: "#f5a623", tab: "yard"    },
    { icon: "⚙️",  label: "Milling",       sub: "In transit",        value: `${millingCount} dispatched`,     color: "#1fc8c8", tab: "milling" },
    { icon: "☕", label: "Green Store",   sub: "Sheet 2",            value: `${greenCount} in stock`,         color: "#9b59b6", tab: "green"   },
    { icon: "🌍", label: "Sales",          sub: "Exporters / Cafés", value: `${fmtKg(soldYTD)} sold YTD`,    color: "#3498db", tab: "sales"   },
  ];

  const recent = sales.slice(0, 6);

  return (
    <div>
      {/* KPI cards */}
      <div className={css.kpiGrid}>
        <div className={css.kpiCard}>
          <div className={css.kpiLabel}>📦 Total Orders</div>
          <div className={css.kpiValue}>{kpis.totalOrders}</div>
          <div className={css.kpiSub}>All time sales</div>
          <div className={css.kpiAccent} style={{ background: "#1fc8c8" }} />
        </div>
        <div className={css.kpiCard}>
          <div className={css.kpiLabel}>☕ Total Qty</div>
          <div><span className={css.kpiValue}>{Math.round(kpis.totalQty).toLocaleString("en-IN")}</span><span className={css.kpiUnit}>kg</span></div>
          <div className={css.kpiSub}>All shipments</div>
          <div className={css.kpiAccent} style={{ background: "#f5a623" }} />
        </div>
        <div className={css.kpiCard}>
          <div className={css.kpiLabel}>🏦 Total Revenue</div>
          <div className={css.kpiValue} style={{ fontSize: "1.4rem" }}>{fmtINR(kpis.totalRevenue)}</div>
          <div className={css.kpiSub}>Gross from sales</div>
          <div className={css.kpiAccent} style={{ background: "#1fc8c8" }} />
        </div>
        <div className={css.kpiCard}>
          <div className={css.kpiLabel}>📉 Stock Value</div>
          <div className={css.kpiValue} style={{ fontSize: "1.4rem", color: "#e8524a" }}>{fmtINR(kpis.stockValue)}</div>
          <div className={css.kpiSub}>Green in-stock cost</div>
          <div className={css.kpiAccent} style={{ background: "#e8524a" }} />
        </div>
      </div>

      {/* Estate flow */}
      <div className={css.sectionHdr}><span>◆</span> ESTATE FLOW</div>
      <div className={css.estateFlow} style={{ marginBottom: 20 }}>
        {flowSteps.map(step => (
          <div key={step.tab + step.label} className={css.flowStep} onClick={() => setTab(step.tab)}>
            <div className={css.flowTopBorder} style={{ background: step.color }} />
            <div className={css.flowIcon}>{step.icon}</div>
            <div className={css.flowLabel}>{step.label}</div>
            <div className={css.flowSub}>{step.sub}</div>
            <div className={css.flowValue} style={{ color: step.color, marginTop: 6 }}>{step.value}</div>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className={css.charts2col}>
        <div className={css.chartCard}>
          <div className={css.sectionHdr}><span>◆</span> REVENUE BY CUSTOMER (₹)</div>
          {customerData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={customerData} margin={{ top:4, right:8, bottom:4, left:0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="customer" tick={{ fill:"#7a90b0", fontSize:10 }} tickLine={false} axisLine={false}
                  tickFormatter={v => v.length > 10 ? v.slice(0,9)+"…" : v} />
                <YAxis tick={{ fill:"#7a90b0", fontSize:10 }} tickLine={false} axisLine={false}
                  tickFormatter={v => v >= 100000 ? `₹${(v/100000).toFixed(1)}L` : `₹${v}`} />
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                <Tooltip contentStyle={TT_STYLE} formatter={(v: any) => [fmtINR(n(v)), "Revenue"]} />
                <Bar dataKey="revenue" radius={[4,4,0,0]}>
                  {customerData.map((d,i) => <Cell key={i} fill={d.color} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : <div className={css.empty}>No sales data yet</div>}
        </div>
        <div className={css.chartCard}>
          <div className={css.sectionHdr}><span>◆</span> MONTHLY ORDERS</div>
          {monthlyData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={monthlyData} layout="vertical" margin={{ top:4, right:16, bottom:4, left:40 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" horizontal={false} />
                <XAxis type="number" tick={{ fill:"#7a90b0", fontSize:10 }} tickLine={false} axisLine={false} allowDecimals={false} />
                <YAxis type="category" dataKey="label" tick={{ fill:"#7a90b0", fontSize:10 }} tickLine={false} axisLine={false} width={48} />
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                <Tooltip contentStyle={TT_STYLE} formatter={(v: any) => [v, "Orders"]} />
                <Bar dataKey="count" fill="#2ecc71" radius={[0,4,4,0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : <div className={css.empty}>No order data yet</div>}
        </div>
      </div>

      {/* Recent activity */}
      <div className={css.sectionRow}>
        <span className={css.sectionRowTitle}><span>◆</span> RECENT EXPORT ACTIVITY</span>
        <button className={css.btnViewAll} onClick={() => setTab("sales")}>View All →</button>
      </div>
      <div className={css.tableCard}>
        {recent.length === 0 ? <div className={css.empty}>No sales yet.</div> : (
          <table className={css.table}>
            <thead><tr>
              <th>Date</th><th>Channel</th><th>Customer</th>
              <th className={css.tdRight}>Qty</th><th className={css.tdRight}>Price/kg</th>
              <th className={css.tdRight}>Revenue</th><th>Status</th>
            </tr></thead>
            <tbody>
              {recent.map(s => (
                <tr key={s.id}>
                  <td className={css.tdMono}>{fmtDate(s.date)}</td>
                  <td><span className={channelBadgeClass(s.channel)}>{channelLabel(s.channel)}</span></td>
                  <td>{s.customer}</td>
                  <td className={css.tdNum}>{Math.round(s.kg).toLocaleString("en-IN")} kg</td>
                  <td className={css.tdNum}>₹{n(s.price_per_kg).toFixed(2)}</td>
                  <td className={css.tdNum} style={{ color:"#f5a623" }}>{fmtINR(n(s.kg)*n(s.price_per_kg))}</td>
                  <td><span className={statusBadgeClass(s.status)}>{s.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   PARCHMENT YARD TAB (Sheet 1)
═══════════════════════════════════════════════════════════════ */
function YardTab({ batches, greenLots, reload }: { batches: ParchBatch[]; greenLots: GreenLot[]; reload: () => void }) {
  const [selected,  setSelected]  = useState<Set<string>>(new Set());
  const [search,    setSearch]    = useState("");
  const [fStatus,   setFStatus]   = useState("ALL");
  const [fProcess,  setFProcess]  = useState("ALL");
  const [drawer,    setDrawer]    = useState<"mill"|"print"|"edit"|"new"|null>(null);
  const [editBatch, setEditBatch] = useState<ParchBatch | null>(null);

  const filtered = useMemo(() => batches.filter(b => {
    if (fStatus  !== "ALL" && b.status  !== fStatus)  return false;
    if (fProcess !== "ALL" && b.process !== fProcess) return false;
    if (search && !`${b.lot} ${b.field} ${b.id}`.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  }), [batches, fStatus, fProcess, search]);

  const yardBatches = batches.filter(b => b.status === "yard");
  const yardKg   = yardBatches.reduce((a,b) => a + n(b.parch_kg), 0);
  const yardVal  = yardBatches.reduce((a,b) => a + n(b.parch_kg) * n(b.rate_per_kg), 0);
  const millKg   = batches.filter(b => b.status==="at-mill").reduce((a,b)=>a+n(b.parch_kg),0);

  const naturalPct  = yardKg > 0 ? batches.filter(b=>b.status==="yard"&&b.process==="Bag Natural").reduce((a,b)=>a+n(b.parch_kg),0) / yardKg * 100 : 0;
  const washedPct   = yardKg > 0 ? batches.filter(b=>b.status==="yard"&&b.process==="Regular Washed").reduce((a,b)=>a+n(b.parch_kg),0) / yardKg * 100 : 0;
  const waterPct    = yardKg > 0 ? batches.filter(b=>b.status==="yard"&&b.process==="Watermelon Washed").reduce((a,b)=>a+n(b.parch_kg),0) / yardKg * 100 : 0;

  const selArr = filtered.filter(b => selected.has(b.id));
  const allOnYard = selArr.filter(b => b.status === "yard");

  function toggleRow(id: string) {
    setSelected(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });
  }
  function toggleAll() {
    if (selected.size === filtered.length) setSelected(new Set());
    else setSelected(new Set(filtered.map(b => b.id)));
  }

  return (
    <div>
      {/* KPI cards */}
      <div className={css.kpiGrid}>
        <div className={css.kpiCard}>
          <div className={css.kpiLabel}>🌾 On Yard</div>
          <div><span className={css.kpiValue}>{yardBatches.length}</span><span className={css.kpiUnit}>batches</span></div>
          <div className={css.kpiSub}>{fmtKg(yardKg)} total</div>
          <div className={css.kpiAccent} style={{ background:"#1fc8c8" }} />
        </div>
        <div className={css.kpiCard}>
          <div className={css.kpiLabel}>💰 Yard Value</div>
          <div className={css.kpiValue} style={{ fontSize:"1.35rem" }}>{fmtINR(yardVal)}</div>
          <div className={css.kpiSub}>At cost basis</div>
          <div className={css.kpiAccent} style={{ background:"#f5a623" }} />
        </div>
        <div className={css.kpiCard}>
          <div className={css.kpiLabel}>⚙️ Out to Mill</div>
          <div><span className={css.kpiValue}>{batches.filter(b=>b.status==="at-mill").length}</span><span className={css.kpiUnit}>batches</span></div>
          <div className={css.kpiSub}>{fmtKg(millKg)} dispatched</div>
          <div className={css.kpiAccent} style={{ background:"#f5a623" }} />
        </div>
        <div className={css.kpiCard}>
          <div className={css.kpiLabel}>📊 Yard Split</div>
          <div style={{ display:"flex", flexDirection:"column", gap:4, marginTop:4 }}>
            {[["Bag Natural", naturalPct, "#f5a623"], ["Reg. Washed", washedPct, "#1fc8c8"], ["Watermelon", waterPct, "#e8524a"]]
              .map(([label, pct, color]) => (
                <div key={label as string} style={{ display:"flex", alignItems:"center", gap:6 }}>
                  <div style={{ flex:1, height:5, background:"#16253a", borderRadius:3, overflow:"hidden" }}>
                    <div style={{ width:`${pct}%`, height:"100%", background: color as string, borderRadius:3 }} />
                  </div>
                  <span style={{ fontSize:10, color:"#7a90b0", width:32, textAlign:"right" }}>{(pct as number).toFixed(0)}%</span>
                </div>
              ))}
          </div>
          <div className={css.kpiAccent} style={{ background:"#2ecc71" }} />
        </div>
      </div>

      {/* Actions + filters */}
      <div className={css.actionBar}>
        <button className={css.btnNew} onClick={() => setDrawer("new")}><Plus size={13} /> New batch</button>
        <button className={css.btnSecondary} onClick={() => { if (allOnYard.length) setDrawer("mill"); }}
          style={{ opacity: allOnYard.length ? 1 : 0.4 }}>
          <Send size={13} /> Send to mill ({allOnYard.length})
        </button>
        <button className={css.btnSecondary} onClick={() => { if (selArr.length) setDrawer("print"); }}
          style={{ opacity: selArr.length ? 1 : 0.4 }}>
          <Printer size={13} /> Print labels ({selArr.length})
        </button>
      </div>
      <div className={css.filterBar}>
        <div className={css.ctrlGrp}>
          <span className={css.ctrlLbl}>Search</span>
          <input className={css.searchInput} placeholder="Lot, field, batch ID…" value={search} onChange={e=>setSearch(e.target.value)} />
        </div>
        <div className={css.ctrlGrp}>
          <span className={css.ctrlLbl}>Status</span>
          <select className={css.sel} value={fStatus} onChange={e=>setFStatus(e.target.value)}>
            <option value="ALL">All</option>
            <option value="yard">On Yard</option>
            <option value="at-mill">At Mill</option>
            <option value="milled">Milled</option>
            <option value="depleted">Depleted</option>
          </select>
        </div>
        <div className={css.ctrlGrp}>
          <span className={css.ctrlLbl}>Process</span>
          <select className={css.sel} value={fProcess} onChange={e=>setFProcess(e.target.value)}>
            <option value="ALL">All</option>
            <option value="Bag Natural">Bag Natural</option>
            <option value="Regular Washed">Regular Washed</option>
            <option value="Watermelon Washed">Watermelon Washed</option>
          </select>
        </div>
      </div>
      <div className={css.rowCount}>{filtered.length} batch{filtered.length !== 1 ? "es" : ""} · {selected.size} selected</div>

      <div className={css.tableCard}>
        <div className={css.tableWrap}>
          <table className={css.table}>
            <thead><tr>
              <th><input type="checkbox" className={css.chk} checked={selected.size===filtered.length&&filtered.length>0}
                onChange={toggleAll} /></th>
              <th>Batch</th><th>Date</th><th>Lot #</th><th>Field</th><th>Process</th>
              <th className={css.tdRight}>Cherry kg</th><th className={css.tdRight}>Parch kg</th>
              <th className={css.tdRight}>Outturn</th><th className={css.tdRight}>Rate ₹</th>
              <th className={css.tdRight}>Value</th><th>Bin</th><th>Grade</th><th>Status</th><th></th>
            </tr></thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={15} className={css.empty}>No batches match filters</td></tr>
              ) : filtered.map(b => {
                const outturn = b.cherry_kg > 0 ? (b.parch_kg / b.cherry_kg * 100).toFixed(1) : "—";
                return (
                  <tr key={b.id} className={selected.has(b.id) ? css.selected : ""}>
                    <td><input type="checkbox" className={css.chk} checked={selected.has(b.id)} onChange={()=>toggleRow(b.id)} /></td>
                    <td className={css.tdMono}>{b.id}</td>
                    <td className={css.tdMono}>{fmtDate(b.date)}</td>
                    <td className={css.tdMono} style={{ fontSize:11 }}>{b.lot}</td>
                    <td>{b.field}</td>
                    <td><span className={`${css.badge} ${processBadgeClass(b.process)}`}>{b.process}</span></td>
                    <td className={css.tdNum}>{Math.round(b.cherry_kg).toLocaleString("en-IN")}</td>
                    <td className={css.tdNum} style={{ fontWeight:600 }}>{Math.round(b.parch_kg).toLocaleString("en-IN")}</td>
                    <td className={css.tdNum}>{outturn}%</td>
                    <td className={css.tdNum}>₹{n(b.rate_per_kg).toFixed(2)}</td>
                    <td className={css.tdNum} style={{ color:"#f5a623" }}>{fmtINR(n(b.parch_kg)*n(b.rate_per_kg))}</td>
                    <td className={css.tdMono}>{b.bin ?? "—"}</td>
                    <td>{b.grade ? <span className={css.badge} style={{ background:"rgba(122,144,176,0.1)", color:"#7a90b0", border:"1px solid rgba(122,144,176,0.2)" }}>{b.grade}</span> : "—"}</td>
                    <td><span className={statusBadgeClass(b.status)}>{b.status}</span></td>
                    <td>
                      <button className={css.btnIconEdit} onClick={() => { setEditBatch(b); setDrawer("edit"); }}>
                        <Pencil size={11} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Drawers */}
      {drawer === "mill" && (
        <SendToMillDrawer batches={allOnYard} onClose={() => { setDrawer(null); setSelected(new Set()); }} reload={reload} />
      )}
      {drawer === "print" && (
        <PrintLabelsDrawer batches={selArr} onClose={() => setDrawer(null)} />
      )}
      {drawer === "edit" && editBatch && (
        <EditBatchDrawer batch={editBatch} onClose={() => { setDrawer(null); setEditBatch(null); }} reload={reload} />
      )}
      {drawer === "new" && (
        <NewBatchDrawer onClose={() => setDrawer(null)} reload={reload} />
      )}
    </div>
  );
}

/* ─── Send to Mill Drawer ─────────────────────────────────── */
function SendToMillDrawer({ batches, onClose, reload }: { batches: ParchBatch[]; onClose: () => void; reload: () => void }) {
  const [miller, setMiller]         = useState("");
  const [truckRef, setTruckRef]     = useState("");
  const [sentDate, setSentDate]     = useState(todayStr());
  const [expReturn, setExpReturn]   = useState("");
  const [outturnPct, setOutturnPct] = useState("45");
  const [saving, setSaving]         = useState(false);

  const expGreen = batches.reduce((a,b) => a + n(b.parch_kg) * n(outturnPct) / 100, 0);

  const confirm = async () => {
    if (!miller.trim() || !sentDate) { alert("Miller and sent date are required."); return; }
    setSaving(true);
    for (const b of batches) {
      const expKg = Math.round(n(b.parch_kg) * n(outturnPct) / 100);
      await supabase.from("parchment_batches").update({
        status: "at-mill", miller: miller.trim(), truck_ref: truckRef.trim() || null,
        sent_to_mill: sentDate, expected_return: expReturn || null, expected_green_kg: expKg,
      }).eq("id", b.id);
      await writeAudit({ ts: new Date().toISOString(), actor: getUser(), action: "sent-to-mill",
        entity: b.id, before: `yard ${b.bin ?? ""}`, after: miller.trim(), note: truckRef || null });
    }
    setSaving(false);
    reload();
    onClose();
  };

  return (
    <Drawer title={`⚙️ Send to Mill (${batches.length} batch${batches.length!==1?"es":""})`} onClose={onClose}>
      <div className={css.receiptBatchList}>
        {batches.map(b => (
          <div key={b.id} className={css.receiptBatchRow}>
            <span className={css.tdMono}>{b.id}</span>
            <span style={{ color:"#7a90b0", fontSize:11 }}>{b.field} · {b.process}</span>
            <span className={css.tdMono} style={{ color:"#f5a623" }}>{Math.round(b.parch_kg).toLocaleString("en-IN")} kg</span>
          </div>
        ))}
      </div>
      <div className={css.formGrid2}>
        <div className={css.formGroup}>
          <label className={css.formLabel}>Miller / Curing Works *</label>
          <input className={css.formInput} placeholder="e.g. BVE Curing Works" value={miller} onChange={e=>setMiller(e.target.value)} />
        </div>
        <div className={css.formGroup}>
          <label className={css.formLabel}>Truck Reference</label>
          <input className={css.formInput} placeholder="e.g. TN-38-AX-1234" value={truckRef} onChange={e=>setTruckRef(e.target.value)} />
        </div>
        <div className={css.formGroup}>
          <label className={css.formLabel}>Sent Date *</label>
          <input type="date" className={css.formInput} value={sentDate} onChange={e=>setSentDate(e.target.value)} />
        </div>
        <div className={css.formGroup}>
          <label className={css.formLabel}>Expected Return</label>
          <input type="date" className={css.formInput} value={expReturn} onChange={e=>setExpReturn(e.target.value)} />
        </div>
      </div>
      <div className={css.formGroup} style={{ marginTop:12 }}>
        <label className={css.formLabel}>Expected Outturn % (milling yield)</label>
        <input type="number" className={css.formInput} min="1" max="100" step="0.5" value={outturnPct}
          onChange={e=>setOutturnPct(e.target.value)} style={{ width:120 }} />
      </div>
      <div className={css.computedStrip}>
        <div className={css.computedItem}>
          <span className={css.computedLabel}>Parchment sent</span>
          <span className={css.computedValue}>{fmtKg(batches.reduce((a,b)=>a+n(b.parch_kg),0))}</span>
        </div>
        <div className={css.computedItem}>
          <span className={css.computedLabel}>Expected green</span>
          <span className={`${css.computedValue} ${css.computedValueGold}`}>{fmtKg(expGreen)}</span>
        </div>
        <div className={css.computedItem}>
          <span className={css.computedLabel}>At outturn</span>
          <span className={`${css.computedValue} ${css.computedValueGreen}`}>{n(outturnPct).toFixed(1)}%</span>
        </div>
      </div>
      <DrawerFooter onCancel={onClose} onConfirm={confirm} saving={saving} label="✓ Confirm Dispatch" />
    </Drawer>
  );
}

/* ─── Print Labels Drawer ─────────────────────────────────── */
function PrintLabelsDrawer({ batches, onClose }: { batches: ParchBatch[]; onClose: () => void }) {
  return (
    <Drawer title={`🖨️ Print Labels (${batches.length})`} onClose={onClose}>
      <div className={css.labelGrid}>
        {batches.map(b => (
          <div key={b.id} className={css.labelCard}>
            <div className={css.labelBrand}>
              <div className={css.labelM}>M</div>
              <div>
                <div className={css.labelBrandName}>MSP Coffee</div>
                <div style={{ fontSize:9, color:"#7a90b0" }}>Bison Valley Estate</div>
              </div>
            </div>
            <div className={css.labelField}>Lot</div>
            <div className={css.labelValue}>{b.lot}</div>
            <div className={css.labelField}>Field</div>
            <div className={css.labelValue}>{b.field}</div>
            <div style={{ display:"flex", gap:12, marginTop:6 }}>
              <div>
                <div className={css.labelField}>Process</div>
                <div className={css.labelMono}>{b.process}</div>
              </div>
              <div>
                <div className={css.labelField}>Bin</div>
                <div className={css.labelMono}>{b.bin ?? "—"}</div>
              </div>
              <div>
                <div className={css.labelField}>Parch. kg</div>
                <div className={css.labelMono}>{Math.round(b.parch_kg)} kg</div>
              </div>
            </div>
            <div style={{ marginTop:6 }}>
              <div className={css.labelField}>Date</div>
              <div className={css.labelMono}>{fmtDate(b.date)}</div>
            </div>
          </div>
        ))}
      </div>
      <div className={css.drawerFooter}>
        <button className={css.btnSecondary} onClick={onClose}>Close</button>
        <button className={css.btnPrimary} onClick={() => window.print()}>🖨️ Print</button>
      </div>
    </Drawer>
  );
}

/* ─── Edit Batch Drawer ───────────────────────────────────── */
function EditBatchDrawer({ batch, onClose, reload }: { batch: ParchBatch; onClose: () => void; reload: () => void }) {
  const [parchKg,   setParchKg]   = useState(String(batch.parch_kg));
  const [rate,      setRate]      = useState(String(batch.rate_per_kg));
  const [bin,       setBin]       = useState(batch.bin ?? "");
  const [grade,     setGrade]     = useState(batch.grade ?? "");
  const [score,     setScore]     = useState(String(batch.score ?? ""));
  const [notes,     setNotes]     = useState(batch.notes ?? "");
  const [tasting,   setTasting]   = useState(batch.tasting_notes ?? "");
  const [saving,    setSaving]    = useState(false);

  const parchDelta = n(parchKg) - batch.parch_kg;

  const save = async () => {
    setSaving(true);
    const weightChanged = Math.abs(parchDelta) > 0.01;
    await supabase.from("parchment_batches").update({
      parch_kg: n(parchKg), rate_per_kg: n(rate),
      bin: bin || null, grade: grade || null,
      score: score ? n(score) : null,
      notes: notes || null, tasting_notes: tasting || null,
    }).eq("id", batch.id);
    if (weightChanged) {
      await writeAudit({ ts: new Date().toISOString(), actor: getUser(), action: "weight-adjust",
        entity: batch.id, before: `${batch.parch_kg} kg`, after: `${parchKg} kg`,
        note: `Δ ${parchDelta > 0 ? "+" : ""}${parchDelta.toFixed(1)} kg` });
    }
    setSaving(false);
    reload();
    onClose();
  };

  return (
    <Drawer title={`✏️ Edit Batch ${batch.id}`} onClose={onClose}>
      <div style={{ display:"flex", gap:10, flexWrap:"wrap", marginBottom:16 }}>
        <span className={`${css.badge} ${processBadgeClass(batch.process)}`}>{batch.process}</span>
        <span className={statusBadgeClass(batch.status)}>{batch.status}</span>
        <span className={css.tdMono} style={{ fontSize:11, color:"#7a90b0" }}>{batch.field}</span>
        <span className={css.tdMono} style={{ fontSize:11, color:"#7a90b0" }}>{fmtDate(batch.date)}</span>
      </div>
      <div className={css.formGrid2}>
        <div className={css.formGroup}>
          <label className={css.formLabel}>Parchment kg {Math.abs(parchDelta) > 0.01 && <span style={{ color: parchDelta > 0 ? "#2ecc71" : "#e8524a", marginLeft:4 }}>Δ {parchDelta > 0 ? "+" : ""}{parchDelta.toFixed(1)}</span>}</label>
          <input type="number" className={css.formInput} min="0" step="0.1" value={parchKg} onChange={e=>setParchKg(e.target.value)} />
        </div>
        <div className={css.formGroup}>
          <label className={css.formLabel}>Rate ₹/kg</label>
          <input type="number" className={css.formInput} min="0" step="0.01" value={rate} onChange={e=>setRate(e.target.value)} />
        </div>
        <div className={css.formGroup}>
          <label className={css.formLabel}>Bin</label>
          <input className={css.formInput} placeholder="e.g. A-12" value={bin} onChange={e=>setBin(e.target.value)} />
        </div>
        <div className={css.formGroup}>
          <label className={css.formLabel}>Grade</label>
          <select className={css.formSelect} value={grade} onChange={e=>setGrade(e.target.value)}>
            <option value="">—</option>
            <option>Specialty</option><option>AAA</option><option>AA</option><option>A</option><option>PB</option>
          </select>
        </div>
        <div className={css.formGroup}>
          <label className={css.formLabel}>Cupping Score</label>
          <input type="number" className={css.formInput} min="70" max="100" step="0.25" value={score} onChange={e=>setScore(e.target.value)} />
        </div>
      </div>
      <div className={css.formGroup} style={{ marginTop:12 }}>
        <label className={css.formLabel}>Operational Notes</label>
        <textarea className={css.formTextarea} value={notes} onChange={e=>setNotes(e.target.value)} />
      </div>
      <div className={css.formGroup} style={{ marginTop:10 }}>
        <label className={css.formLabel}>Tasting Notes</label>
        <textarea className={css.formTextarea} value={tasting} onChange={e=>setTasting(e.target.value)} />
      </div>
      <DrawerFooter onCancel={onClose} onConfirm={save} saving={saving} label="💾 Save Changes" />
    </Drawer>
  );
}

/* ─── New Batch Drawer ────────────────────────────────────── */
function NewBatchDrawer({ onClose, reload }: { onClose: () => void; reload: () => void }) {
  const [form, setForm] = useState({
    lot: "", date: todayStr(), field: "", process: "Regular Washed" as Process,
    cherry_kg: "", floats_kg: "", parch_kg: "", rate_per_kg: "", bin: "",
  });
  const [saving, setSaving] = useState(false);

  const nettKg = Math.max(0, n(form.cherry_kg) - n(form.floats_kg));

  const save = async () => {
    if (!form.lot.trim() || !form.field.trim() || !form.date || !form.parch_kg) {
      alert("Lot, field, date and parchment kg are required."); return;
    }
    setSaving(true);
    const { data } = await supabase.from("parchment_batches").insert([{
      lot: form.lot.trim(), date: form.date, field: form.field.trim(),
      process: form.process, cherry_kg: n(form.cherry_kg), floats_kg: n(form.floats_kg),
      nett_kg: nettKg, parch_kg: n(form.parch_kg), rate_per_kg: n(form.rate_per_kg),
      bin: form.bin || null, status: "yard",
    }]).select().single();
    if (data) {
      await writeAudit({ ts: new Date().toISOString(), actor: getUser(), action: "batch-created",
        entity: data.id, before: null, after: `yard ${form.bin || ""}`, note: form.lot });
    }
    setSaving(false);
    reload();
    onClose();
  };

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  return (
    <Drawer title="➕ New Parchment Batch" onClose={onClose}>
      <div className={css.formGrid2}>
        <div className={css.formGroup}>
          <label className={css.formLabel}>Lot # *</label>
          <input className={css.formInput} placeholder="e.g. BVE31Oct24NAT1" value={form.lot} onChange={set("lot")} />
        </div>
        <div className={css.formGroup}>
          <label className={css.formLabel}>Date *</label>
          <input type="date" className={css.formInput} value={form.date} onChange={set("date")} />
        </div>
        <div className={css.formGroup}>
          <label className={css.formLabel}>Field *</label>
          <input className={css.formInput} placeholder="e.g. Pammandi Cholai" value={form.field} onChange={set("field")} />
        </div>
        <div className={css.formGroup}>
          <label className={css.formLabel}>Process</label>
          <select className={css.formSelect} value={form.process} onChange={set("process")}>
            <option>Bag Natural</option>
            <option>Regular Washed</option>
            <option>Watermelon Washed</option>
          </select>
        </div>
        <div className={css.formGroup}>
          <label className={css.formLabel}>Cherry kg</label>
          <input type="number" className={css.formInput} min="0" step="0.1" value={form.cherry_kg} onChange={set("cherry_kg")} />
        </div>
        <div className={css.formGroup}>
          <label className={css.formLabel}>Floats kg</label>
          <input type="number" className={css.formInput} min="0" step="0.1" value={form.floats_kg} onChange={set("floats_kg")} />
        </div>
        <div className={css.formGroup}>
          <label className={css.formLabel}>Nett kg (auto)</label>
          <input type="text" className={css.formInput} readOnly value={nettKg.toFixed(1)} />
        </div>
        <div className={css.formGroup}>
          <label className={css.formLabel}>Parchment kg *</label>
          <input type="number" className={css.formInput} min="0" step="0.1" value={form.parch_kg} onChange={set("parch_kg")} />
        </div>
        <div className={css.formGroup}>
          <label className={css.formLabel}>Rate ₹/kg</label>
          <input type="number" className={css.formInput} min="0" step="0.01" value={form.rate_per_kg} onChange={set("rate_per_kg")} />
        </div>
        <div className={css.formGroup}>
          <label className={css.formLabel}>Bin</label>
          <input className={css.formInput} placeholder="e.g. A-12" value={form.bin} onChange={set("bin")} />
        </div>
      </div>
      <DrawerFooter onCancel={onClose} onConfirm={save} saving={saving} label="✓ Create Batch" />
    </Drawer>
  );
}

/* ═══════════════════════════════════════════════════════════════
   MILLING TAB
═══════════════════════════════════════════════════════════════ */
function MillingTab({ batches, greenLots, reload }: { batches: ParchBatch[]; greenLots: GreenLot[]; reload: () => void }) {
  const [receiveGroup, setReceiveGroup] = useState<ParchBatch[] | null>(null);

  const atMill = batches.filter(b => b.status === "at-mill");

  // Group by miller + sent_to_mill date
  const groups = useMemo(() => {
    const map = new Map<string, ParchBatch[]>();
    atMill.forEach(b => {
      const key = `${b.miller ?? "Unknown"}||${b.sent_to_mill ?? ""}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(b);
    });
    return Array.from(map.entries()).map(([key, bList]) => {
      const [miller, sentDate] = key.split("||");
      return { miller, sentDate, batches: bList };
    });
  }, [atMill]);

  const parchSent  = atMill.reduce((a,b) => a + n(b.parch_kg), 0);
  const expGreen   = atMill.reduce((a,b) => a + n(b.expected_green_kg ?? 0), 0);
  const avgOutturn = parchSent > 0 ? (expGreen / parchSent * 100).toFixed(1) : "—";
  const lockedVal  = atMill.reduce((a,b) => a + n(b.parch_kg) * n(b.rate_per_kg), 0);

  return (
    <div>
      <div className={css.kpiGrid}>
        <div className={css.kpiCard}>
          <div className={css.kpiLabel}>⚙️ Batches Out</div>
          <div className={css.kpiValue}>{atMill.length}</div>
          <div className={css.kpiSub}>Currently at mill</div>
          <div className={css.kpiAccent} style={{ background:"#1fc8c8" }} />
        </div>
        <div className={css.kpiCard}>
          <div className={css.kpiLabel}>🌾 Parchment Sent</div>
          <div><span className={css.kpiValue}>{Math.round(parchSent).toLocaleString("en-IN")}</span><span className={css.kpiUnit}>kg</span></div>
          <div className={css.kpiSub}>Dispatched to mill</div>
          <div className={css.kpiAccent} style={{ background:"#f5a623" }} />
        </div>
        <div className={css.kpiCard}>
          <div className={css.kpiLabel}>☕ Green Expected</div>
          <div><span className={css.kpiValue}>{Math.round(expGreen).toLocaleString("en-IN")}</span><span className={css.kpiUnit}>kg</span></div>
          <div className={css.kpiSub}>Avg outturn {avgOutturn}%</div>
          <div className={css.kpiAccent} style={{ background:"#2ecc71" }} />
        </div>
        <div className={css.kpiCard}>
          <div className={css.kpiLabel}>🔒 Locked Value</div>
          <div className={css.kpiValue} style={{ fontSize:"1.35rem" }}>{fmtINR(lockedVal)}</div>
          <div className={css.kpiSub}>At parchment cost</div>
          <div className={css.kpiAccent} style={{ background:"#e8524a" }} />
        </div>
      </div>

      {groups.length === 0 ? (
        <div className={css.empty}>No batches currently at mill.</div>
      ) : groups.map(g => {
        const daysOut = g.sentDate ? Math.round((Date.now() - new Date(g.sentDate).getTime()) / 86_400_000) : null;
        return (
          <div key={g.miller+g.sentDate} className={css.dispatchCard}>
            <div className={css.dispatchHeader}>
              <div className={css.dispatchMeta}>
                <span className={css.dispatchTitle}>⚙️ {g.miller}</span>
                <span className={css.dispatchDetail}>Sent {fmtDate(g.sentDate)} · {g.batches.length} batch{g.batches.length!==1?"es":""}</span>
                {daysOut !== null && (
                  <span className={`${css.dispatchDays} ${daysOut > 30 ? css.dispatchDaysWarn : css.dispatchDaysNormal}`}>
                    {daysOut}d out
                  </span>
                )}
              </div>
              <button className={css.btnPrimary} onClick={() => setReceiveGroup(g.batches)}>
                <ArrowDownToLine size={13} /> Receive milled green
              </button>
            </div>
            <div className={css.tableWrap} style={{ maxHeight:280 }}>
              <table className={css.table}>
                <thead><tr>
                  <th>Batch</th><th>Lot #</th><th>Field</th><th>Process</th>
                  <th className={css.tdRight}>Parch sent</th><th className={css.tdRight}>Exp. green</th>
                  <th className={css.tdRight}>Cost value</th><th>Days out</th>
                </tr></thead>
                <tbody>
                  {g.batches.map(b => {
                    const d = b.sent_to_mill ? Math.round((Date.now()-new Date(b.sent_to_mill).getTime())/86_400_000) : null;
                    return (
                      <tr key={b.id}>
                        <td className={css.tdMono}>{b.id}</td>
                        <td className={css.tdMono} style={{ fontSize:11 }}>{b.lot}</td>
                        <td>{b.field}</td>
                        <td><span className={`${css.badge} ${processBadgeClass(b.process)}`}>{b.process}</span></td>
                        <td className={css.tdNum}>{Math.round(b.parch_kg).toLocaleString("en-IN")} kg</td>
                        <td className={css.tdNum} style={{ color:"#2ecc71" }}>{b.expected_green_kg ? `${Math.round(b.expected_green_kg).toLocaleString("en-IN")} kg` : "—"}</td>
                        <td className={css.tdNum} style={{ color:"#f5a623" }}>{fmtINR(n(b.parch_kg)*n(b.rate_per_kg))}</td>
                        <td>
                          {d !== null && (
                            <span className={`${css.dispatchDays} ${d>30?css.dispatchDaysWarn:css.dispatchDaysNormal}`}>{d}d</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}

      {receiveGroup && (
        <ReceiveGreenDrawer batches={receiveGroup} onClose={() => setReceiveGroup(null)} reload={reload} />
      )}
    </div>
  );
}

/* ─── Receive Green Drawer ────────────────────────────────── */
function ReceiveGreenDrawer({ batches, onClose, reload }: { batches: ParchBatch[]; onClose: () => void; reload: () => void }) {
  const totalParch   = batches.reduce((a,b) => a + n(b.parch_kg), 0);
  const totalExpGreen= batches.reduce((a,b) => a + n(b.expected_green_kg ?? 0), 0);
  const [actualKg,  setActualKg]  = useState(String(Math.round(totalExpGreen)));
  const [lot,       setLot]       = useState("");
  const [warehouse, setWarehouse] = useState("");
  const [recDate,   setRecDate]   = useState(todayStr());
  const [grade,     setGrade]     = useState("AA");
  const [screen,    setScreen]    = useState("17/18");
  const [score,     setScore]     = useState("");
  const [notes,     setNotes]     = useState("");
  const [saving,    setSaving]    = useState(false);

  const actual     = n(actualKg);
  const variance   = actual - totalExpGreen;
  const outturnPct = totalParch > 0 ? (actual / totalParch * 100).toFixed(1) : "—";
  const weightedCost = actual > 0
    ? batches.reduce((a,b) => a + n(b.parch_kg) * n(b.rate_per_kg), 0) / actual
    : 0;

  const confirm = async () => {
    if (!lot.trim() || !warehouse.trim() || !recDate || !actualKg) {
      alert("Lot, warehouse, received date and actual kg are required."); return;
    }
    setSaving(true);
    // Flip batches to milled
    for (const b of batches) {
      await supabase.from("parchment_batches").update({ status: "milled" }).eq("id", b.id);
    }
    // Insert green lot
    const { data: gl } = await supabase.from("green_lots").insert([{
      lot: lot.trim(), derived_from: batches.map(b=>b.id),
      green_kg_in: actual, current_kg: actual, rate_per_kg: weightedCost,
      process: batches[0].process, field: batches[0].field,
      grade, screen, score: score ? n(score) : null,
      milled_date: recDate, warehouse: warehouse.trim(),
      status: "in-stock", notes: notes || null,
    }]).select().single();
    if (gl) {
      await writeAudit({ ts: new Date().toISOString(), actor: getUser(), action: "milling-return",
        entity: gl.id, before: batches.map(b=>b.id).join(", "),
        after: `${actual} kg green @ ₹${weightedCost.toFixed(2)}/kg`, note: notes || null });
    }
    setSaving(false);
    reload();
    onClose();
  };

  return (
    <Drawer title="⬇️ Receive Milled Green" onClose={onClose}>
      <div className={css.receiptBatchList}>
        {batches.map(b => (
          <div key={b.id} className={css.receiptBatchRow}>
            <span className={css.tdMono}>{b.id}</span>
            <span style={{ color:"#7a90b0", fontSize:11 }}>{b.field}</span>
            <span className={css.tdMono} style={{ color:"#f5a623" }}>{Math.round(b.parch_kg)} kg parch</span>
          </div>
        ))}
      </div>
      <div className={css.formGrid2}>
        <div className={css.formGroup}>
          <label className={css.formLabel}>Actual green kg received *</label>
          <input type="number" className={css.formInput} min="0" step="0.1" value={actualKg} onChange={e=>setActualKg(e.target.value)} />
        </div>
        <div className={css.formGroup}>
          <label className={css.formLabel}>Green Lot # *</label>
          <input className={css.formInput} placeholder="e.g. G-BVE-001" value={lot} onChange={e=>setLot(e.target.value)} />
        </div>
        <div className={css.formGroup}>
          <label className={css.formLabel}>Warehouse / Bin *</label>
          <input className={css.formInput} placeholder="e.g. GW-02" value={warehouse} onChange={e=>setWarehouse(e.target.value)} />
        </div>
        <div className={css.formGroup}>
          <label className={css.formLabel}>Received Date *</label>
          <input type="date" className={css.formInput} value={recDate} onChange={e=>setRecDate(e.target.value)} />
        </div>
        <div className={css.formGroup}>
          <label className={css.formLabel}>Grade</label>
          <select className={css.formSelect} value={grade} onChange={e=>setGrade(e.target.value)}>
            <option>Specialty</option><option>AAA</option><option>AA</option><option>A</option><option>PB</option>
          </select>
        </div>
        <div className={css.formGroup}>
          <label className={css.formLabel}>Screen</label>
          <input className={css.formInput} placeholder="e.g. 17/18" value={screen} onChange={e=>setScreen(e.target.value)} />
        </div>
        <div className={css.formGroup}>
          <label className={css.formLabel}>Cupping Score</label>
          <input type="number" className={css.formInput} min="70" max="100" step="0.25" value={score} onChange={e=>setScore(e.target.value)} />
        </div>
      </div>
      <div className={css.formGroup} style={{ marginTop:10 }}>
        <label className={css.formLabel}>Notes</label>
        <textarea className={css.formTextarea} value={notes} onChange={e=>setNotes(e.target.value)} />
      </div>
      <div className={css.varianceCallout}>
        <div className={css.varianceItem}>
          <span className={css.varianceLabel}>Parchment in</span>
          <span className={css.varianceValue}>{fmtKg(totalParch)}</span>
        </div>
        <div className={css.varianceItem}>
          <span className={css.varianceLabel}>Expected green</span>
          <span className={css.varianceValue}>{fmtKg(totalExpGreen)}</span>
        </div>
        <div className={css.varianceItem}>
          <span className={css.varianceLabel}>Actual green</span>
          <span className={`${css.varianceValue} ${css.variancePos}`}>{fmtKg(actual)}</span>
        </div>
        <div className={css.varianceItem}>
          <span className={css.varianceLabel}>Variance</span>
          <span className={`${css.varianceValue} ${variance >= 0 ? css.variancePos : css.varianceNeg}`}>
            {variance >= 0 ? "+" : ""}{Math.round(variance)} kg
          </span>
        </div>
        <div className={css.varianceItem}>
          <span className={css.varianceLabel}>Outturn</span>
          <span className={css.varianceValue}>{outturnPct}%</span>
        </div>
        <div className={css.varianceItem}>
          <span className={css.varianceLabel}>Weighted cost</span>
          <span className={`${css.varianceValue} ${css.computedValueGold}`}>₹{weightedCost.toFixed(2)}/kg</span>
        </div>
      </div>
      <DrawerFooter onCancel={onClose} onConfirm={confirm} saving={saving} label="✓ Receive Green" />
    </Drawer>
  );
}

/* ═══════════════════════════════════════════════════════════════
   GREEN STORE TAB (Sheet 2)
═══════════════════════════════════════════════════════════════ */
/* ─── Add Green Lot Drawer ────────────────────────────────── */
const PROCESS_OPTIONS = [
  "Arabica NATURAL","Arabica WASHED","Arabica PSD",
  "Robusta NATURAL","Robusta WASHED","Robusta PSD",
];
const ESTATE_OPTIONS = [
  "STANMORE ESTATE","ORCHARDALE ESTATE","HIDDEN FALLS ESTATE",
  "MOGANAD ESTATE","BISON VALLEY ESTATE",
];

function AddLotDrawer({ season, onClose, reload }: { season: string; onClose: () => void; reload: () => void }) {
  const [lot,        setLot]        = useState("");
  const [field,      setField]      = useState(ESTATE_OPTIONS[0]);
  const [fieldOther, setFieldOther] = useState("");
  const [process,    setProcess]    = useState(PROCESS_OPTIONS[0]);
  const [grade,      setGrade]      = useState("AB");
  const [screen,     setScreen]     = useState("");
  const [score,      setScore]      = useState("");
  const [kgIn,       setKgIn]       = useState("");
  const [rate,       setRate]       = useState("");
  const [milledDate, setMilledDate] = useState(todayStr());
  const [warehouse,  setWarehouse]  = useState("Stanmore Godown");
  const [notes,      setNotes]      = useState("");
  const [saving,     setSaving]     = useState(false);

  const effectiveField = field === "__other__" ? fieldOther : field;

  const save = async () => {
    if (!lot.trim()) { alert("Lot number is required."); return; }
    if (!kgIn || n(kgIn) <= 0) { alert("Quantity (kg) is required."); return; }
    if (!rate || n(rate) <= 0) { alert("Rate ₹/kg is required."); return; }
    setSaving(true);
    await supabase.from("green_lots").insert([{
      lot:          lot.trim(),
      derived_from: [],
      green_kg_in:  n(kgIn),
      current_kg:   n(kgIn),
      rate_per_kg:  n(rate),
      process:      process,
      field:        effectiveField,
      grade:        grade,
      screen:       screen || null,
      score:        score ? n(score) : null,
      milled_date:  milledDate,
      warehouse:    warehouse,
      status:       "in-stock",
      notes:        notes || null,
      season:       season,
    }]);
    await writeAudit({ ts: new Date().toISOString(), actor: getUser(), action: "milling-return",
      entity: lot.trim(), before: null, after: `${kgIn} kg added to Green Store (${season})`, note: process });
    setSaving(false);
    reload();
    onClose();
  };

  return (
    <Drawer title={`➕ Add Lot — ${season} Season`} onClose={onClose}>
      <div className={css.formGrid2}>
        <div className={css.formGroup}>
          <label className={css.formLabel}>Lot Number *</label>
          <input className={css.formInput} placeholder="e.g. 215" value={lot} onChange={e=>setLot(e.target.value)} />
        </div>
        <div className={css.formGroup}>
          <label className={css.formLabel}>Milled Date</label>
          <input type="date" className={css.formInput} value={milledDate} onChange={e=>setMilledDate(e.target.value)} />
        </div>
        <div className={css.formGroup}>
          <label className={css.formLabel}>Estate / Field</label>
          <select className={css.formSelect} value={field} onChange={e=>setField(e.target.value)}>
            {ESTATE_OPTIONS.map(e => <option key={e} value={e}>{e}</option>)}
            <option value="__other__">Other…</option>
          </select>
          {field === "__other__" && (
            <input className={css.formInput} style={{ marginTop:6 }} placeholder="Enter estate name" value={fieldOther} onChange={e=>setFieldOther(e.target.value)} />
          )}
        </div>
        <div className={css.formGroup}>
          <label className={css.formLabel}>Process</label>
          <select className={css.formSelect} value={process} onChange={e=>setProcess(e.target.value)}>
            {PROCESS_OPTIONS.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
        <div className={css.formGroup}>
          <label className={css.formLabel}>Quantity In (kg) *</label>
          <input type="number" className={css.formInput} min="0" step="1" value={kgIn} onChange={e=>setKgIn(e.target.value)} />
        </div>
        <div className={css.formGroup}>
          <label className={css.formLabel}>Rate ₹/kg *</label>
          <input type="number" className={css.formInput} min="0" step="0.01" value={rate} onChange={e=>setRate(e.target.value)} />
        </div>
        <div className={css.formGroup}>
          <label className={css.formLabel}>Grade</label>
          <input className={css.formInput} placeholder="e.g. AB, A, PB" value={grade} onChange={e=>setGrade(e.target.value)} />
        </div>
        <div className={css.formGroup}>
          <label className={css.formLabel}>Screen</label>
          <input className={css.formInput} placeholder="e.g. 16/17" value={screen} onChange={e=>setScreen(e.target.value)} />
        </div>
        <div className={css.formGroup}>
          <label className={css.formLabel}>Cup Score</label>
          <input type="number" className={css.formInput} min="0" max="100" step="0.25" placeholder="e.g. 84.5" value={score} onChange={e=>setScore(e.target.value)} />
        </div>
        <div className={css.formGroup}>
          <label className={css.formLabel}>Warehouse</label>
          <input className={css.formInput} value={warehouse} onChange={e=>setWarehouse(e.target.value)} />
        </div>
      </div>
      <div className={css.formGroup} style={{ marginTop:8 }}>
        <label className={css.formLabel}>Notes</label>
        <textarea className={css.formTextarea} value={notes} onChange={e=>setNotes(e.target.value)} />
      </div>
      {n(kgIn) > 0 && n(rate) > 0 && (
        <div className={css.computedStrip} style={{ marginTop:12 }}>
          <div className={css.computedItem}>
            <span className={css.computedLabel}>Lot value</span>
            <span className={`${css.computedValue} ${css.computedValueGold}`}>{fmtINR(n(kgIn)*n(rate))}</span>
          </div>
          <div className={css.computedItem}>
            <span className={css.computedLabel}>Season</span>
            <span className={css.computedValue}>{season}</span>
          </div>
        </div>
      )}
      <DrawerFooter onCancel={onClose} onConfirm={save} saving={saving} label="✓ Add to Green Store" />
    </Drawer>
  );
}

const SEASONS = ["2024-2025", "2025-2026"] as const;
type Season = typeof SEASONS[number];

function GreenSeasonKPIs({ lots, season }: { lots: GreenLot[]; season: Season }) {
  const seasonLots = lots.filter(g => (g.season ?? "2024-2025") === season);
  const inStock    = seasonLots.filter(g => g.status === "in-stock");
  const totalKg    = inStock.reduce((a,g) => a + n(g.current_kg), 0);
  const stockVal   = inStock.reduce((a,g) => a + n(g.current_kg) * n(g.rate_per_kg), 0);
  const reserved   = seasonLots.filter(g => g.status === "reserved").reduce((a,g)=>a+n(g.current_kg),0);
  const soldYTD    = seasonLots.reduce((a,g) => a + (n(g.green_kg_in) - n(g.current_kg)), 0);

  const accentColor = season === "2024-2025" ? "#1fc8c8" : "#7c3aed";
  return (
    <div className={css.kpiGrid} style={{ marginBottom:8 }}>
      <div className={css.kpiCard}>
        <div className={css.kpiLabel}>☕ Green In Stock</div>
        <div><span className={css.kpiValue}>{Math.round(totalKg).toLocaleString("en-IN")}</span><span className={css.kpiUnit}>kg</span></div>
        <div className={css.kpiSub}>{inStock.length} active lots</div>
        <div className={css.kpiAccent} style={{ background: accentColor }} />
      </div>
      <div className={css.kpiCard}>
        <div className={css.kpiLabel}>💰 Stock Value</div>
        <div className={css.kpiValue} style={{ fontSize:"1.35rem" }}>{fmtINR(stockVal)}</div>
        <div className={css.kpiSub}>Weighted cost basis</div>
        <div className={css.kpiAccent} style={{ background:"#f5a623" }} />
      </div>
      <div className={css.kpiCard}>
        <div className={css.kpiLabel}>🔒 Reserved</div>
        <div><span className={css.kpiValue}>{Math.round(reserved).toLocaleString("en-IN")}</span><span className={css.kpiUnit}>kg</span></div>
        <div className={css.kpiSub}>Allocated to blends</div>
        <div className={css.kpiAccent} style={{ background:"#9b59b6" }} />
      </div>
      <div className={css.kpiCard}>
        <div className={css.kpiLabel}>📤 Sold / Used</div>
        <div><span className={css.kpiValue}>{Math.round(soldYTD).toLocaleString("en-IN")}</span><span className={css.kpiUnit}>kg</span></div>
        <div className={css.kpiSub}>Total depleted</div>
        <div className={css.kpiAccent} style={{ background:"#2ecc71" }} />
      </div>
    </div>
  );
}

function GreenLotTable({ lots, onSell }: { lots: GreenLot[]; onSell: (g: GreenLot) => void }) {
  if (lots.length === 0) return (
    <div className={css.tableCard}>
      <div className={css.tableWrap}>
        <table className={css.table}><tbody>
          <tr><td colSpan={13} className={css.empty}>No lots in this season yet.</td></tr>
        </tbody></table>
      </div>
    </div>
  );
  return (
    <div className={css.tableCard}>
      <div className={css.tableWrap}>
        <table className={css.table}>
          <thead><tr>
            <th>Lot</th><th>Derived from</th><th>Field</th><th>Process</th>
            <th>Grade</th><th>Screen</th><th>Score</th>
            <th className={css.tdRight}>Available</th><th className={css.tdRight}>Rate ₹/kg</th>
            <th className={css.tdRight}>Value</th><th>Bin</th><th>Status</th><th></th>
          </tr></thead>
          <tbody>
            {lots.map(g => {
              const pct = g.green_kg_in > 0 ? g.current_kg / g.green_kg_in : 0;
              const barClass = pct > 0.5 ? css.progressFill : pct > 0.2 ? css.progressFillLow : css.progressFillEmpty;
              return (
                <tr key={g.id}>
                  <td>
                    <div className={css.tdMono}>{g.lot}</div>
                    <div style={{ fontSize:10, color:"#7a90b0" }}>{fmtDate(g.milled_date)}</div>
                  </td>
                  <td className={css.tdMono} style={{ fontSize:10, color:"#7a90b0" }}>
                    {g.derived_from.slice(0,3).join(", ")}{g.derived_from.length>3 ? ` +${g.derived_from.length-3}` : ""}
                  </td>
                  <td>{g.field}</td>
                  <td><span className={`${css.badge} ${processBadgeClass(g.process)}`}>{g.process}</span></td>
                  <td>{g.grade || "—"}</td>
                  <td className={css.tdMono}>{g.screen || "—"}</td>
                  <td className={css.tdNum}>{g.score ?? "—"}</td>
                  <td>
                    <div className={css.progressWrap}>
                      <div style={{ fontSize:12, fontWeight:600, color:"var(--t-text)", fontVariantNumeric:"tabular-nums" }}>
                        {Math.round(g.current_kg).toLocaleString("en-IN")} kg
                      </div>
                      <div className={css.progressBar}>
                        <div className={barClass} style={{ width:`${Math.max(0,Math.min(100,pct*100)).toFixed(1)}%` }} />
                      </div>
                    </div>
                  </td>
                  <td className={css.tdNum}>₹{n(g.rate_per_kg).toFixed(2)}</td>
                  <td className={css.tdNum} style={{ color:"#f5a623" }}>{fmtINR(n(g.current_kg)*n(g.rate_per_kg))}</td>
                  <td className={css.tdMono}>{g.warehouse || "—"}</td>
                  <td><span className={statusBadgeClass(g.status)}>{g.status}</span></td>
                  <td>
                    {g.status === "in-stock" && (
                      <button className={css.btnNew} style={{ padding:"4px 10px", fontSize:11 }} onClick={()=>onSell(g)}>
                        Sell
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function GreenTab({ greenLots, reload, setTab }: { greenLots: GreenLot[]; reload: () => void; setTab: (t: Tab) => void }) {
  const [saleDrawer,    setSaleDrawer]    = useState<GreenLot | null>(null);
  const [addLotDrawer,  setAddLotDrawer]  = useState(false);
  const [activeSeason,  setActiveSeason]  = useState<Season>("2024-2025");
  const [filterEstate,  setFilterEstate]  = useState("all");
  const [filterProcess, setFilterProcess] = useState("all");
  const [filterScore,   setFilterScore]   = useState("all");

  const seasonLots = greenLots.filter(g => (g.season ?? "2024-2025") === activeSeason);

  const estates   = Array.from(new Set(seasonLots.map(g => g.field).filter(Boolean))).sort();
  const processes = Array.from(new Set(seasonLots.map(g => g.process).filter(Boolean))).sort();

  const filtered = seasonLots.filter(g => {
    if (filterEstate  !== "all" && g.field   !== filterEstate)  return false;
    if (filterProcess !== "all" && g.process !== filterProcess) return false;
    if (filterScore === "scored"   && !g.score)  return false;
    if (filterScore === "unscored" &&  g.score)  return false;
    if (filterScore === "85+"      && (g.score ?? 0) < 85) return false;
    if (filterScore === "80-85"    && ((g.score ?? 0) < 80 || (g.score ?? 0) >= 85)) return false;
    return true;
  });

  const seasonAccent = (s: Season) => s === "2024-2025" ? "#1fc8c8" : "#7c3aed";

  return (
    <div>
      {/* Season summary strip — always visible */}
      <div style={{ display:"flex", gap:12, marginBottom:16 }}>
        {SEASONS.map(s => {
          const sLots    = greenLots.filter(g => (g.season ?? "2024-2025") === s);
          const sInStock = sLots.filter(g => g.status === "in-stock");
          const sVal     = sInStock.reduce((a,g) => a + n(g.current_kg)*n(g.rate_per_kg), 0);
          const sKg      = sInStock.reduce((a,g) => a + n(g.current_kg), 0);
          const active   = activeSeason === s;
          return (
            <button key={s} onClick={() => { setActiveSeason(s); setFilterEstate("all"); setFilterProcess("all"); setFilterScore("all"); }}
              style={{
                flex:1, padding:"14px 18px", borderRadius:12, cursor:"pointer", textAlign:"left",
                border: active ? `2px solid ${seasonAccent(s)}` : "2px solid #e5dfc8",
                background: active ? "#fff" : "#faf7f0",
                boxShadow: active ? `0 0 0 3px ${seasonAccent(s)}22` : "none",
                transition:"all 0.15s",
              }}>
              <div style={{ fontSize:11, fontWeight:700, color: seasonAccent(s), letterSpacing:"0.05em", marginBottom:4 }}>
                🌱 {s} SEASON
              </div>
              <div style={{ fontSize:22, fontWeight:800, color:"var(--t-text)", lineHeight:1 }}>{fmtINR(sVal)}</div>
              <div style={{ fontSize:12, color:"var(--t-muted)", marginTop:4 }}>
                {Math.round(sKg).toLocaleString("en-IN")} kg · {sInStock.length} lots
              </div>
            </button>
          );
        })}
      </div>

      {/* KPIs for active season */}
      <GreenSeasonKPIs lots={greenLots} season={activeSeason} />

      {/* Filters + Record sale */}
      <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:12, flexWrap:"wrap" }}>
        <button className={css.btnNew} onClick={() => setSaleDrawer(filtered.find(g=>g.status==="in-stock") ?? null)}>
          <Plus size={13} /> Record sale ({activeSeason})
        </button>
        <button className={css.btnSecondary} onClick={() => setAddLotDrawer(true)}>
          <Plus size={13} /> Add lot ({activeSeason})
        </button>
        <select value={filterEstate} onChange={e=>setFilterEstate(e.target.value)}
          style={{ height:34, padding:"0 10px", border:"1px solid #e5dfc8", borderRadius:8, fontSize:13, background:"var(--t-bg)", color:"var(--t-text)", cursor:"pointer" }}>
          <option value="all">All Estates</option>
          {estates.map(e => <option key={e} value={e}>{e}</option>)}
        </select>
        <select value={filterProcess} onChange={e=>setFilterProcess(e.target.value)}
          style={{ height:34, padding:"0 10px", border:"1px solid #e5dfc8", borderRadius:8, fontSize:13, background:"var(--t-bg)", color:"var(--t-text)", cursor:"pointer" }}>
          <option value="all">All Processes</option>
          {processes.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
        <select value={filterScore} onChange={e=>setFilterScore(e.target.value)}
          style={{ height:34, padding:"0 10px", border:"1px solid #e5dfc8", borderRadius:8, fontSize:13, background:"var(--t-bg)", color:"var(--t-text)", cursor:"pointer" }}>
          <option value="all">All Scores</option>
          <option value="85+">85+</option>
          <option value="80-85">80–85</option>
          <option value="scored">Has score</option>
          <option value="unscored">No score</option>
        </select>
        <span style={{ fontSize:12, color:"var(--t-muted)" }}>
          {filtered.length} lot{filtered.length!==1?"s":""}
          {filtered.length > 0 && (
            <span style={{ marginLeft:8, fontWeight:600, color:"var(--t-text)" }}>
              · {Math.round(filtered.filter(g=>g.status==="in-stock").reduce((a,g)=>a+n(g.current_kg),0)).toLocaleString("en-IN")} kg
            </span>
          )}
        </span>
        {(filterEstate !== "all" || filterProcess !== "all" || filterScore !== "all") && (
          <button onClick={() => { setFilterEstate("all"); setFilterProcess("all"); setFilterScore("all"); }}
            style={{ height:34, padding:"0 12px", border:"1px solid #e5dfc8", borderRadius:8, fontSize:12, background:"#fff", color:"var(--t-muted)", cursor:"pointer", marginLeft:"auto" }}>
            ✕ Clear
          </button>
        )}
      </div>

      <GreenLotTable lots={filtered} onSell={setSaleDrawer} />

      {saleDrawer && (
        <RecordSaleDrawer greenLots={greenLots} defaultLot={saleDrawer} onClose={() => setSaleDrawer(null)} reload={reload} onSuccess={() => { reload(); setTab("sales"); }} />
      )}
      {addLotDrawer && (
        <AddLotDrawer season={activeSeason} onClose={() => setAddLotDrawer(false)} reload={reload} />
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   HILLTILLER GREEN STOCK TAB
═══════════════════════════════════════════════════════════════ */
type HTLot = {
  id: string;
  lot: string;
  date_received: string;
  supplier: string;
  process: string;
  grade: string;
  screen: string;
  score: number | null;
  green_kg_in: number;
  current_kg: number;
  rate_per_kg: number;
  warehouse: string;
  status: "in-stock" | "reserved" | "depleted";
  notes: string | null;
};

const htBlank: Omit<HTLot, "id"> = {
  lot: "", date_received: todayStr(), supplier: "HillTiller", process: "",
  grade: "", screen: "", score: null, green_kg_in: 0, current_kg: 0,
  rate_per_kg: 0, warehouse: "", status: "in-stock", notes: null,
};

function HillTillerTab() {
  const [lots,    setLots]    = useState<HTLot[]>([]);
  const [loading, setLoading] = useState(true);
  const [drawer,  setDrawer]  = useState(false);
  const [form,    setForm]    = useState<Omit<HTLot,"id">>(htBlank);
  const [saving,  setSaving]  = useState(false);
  const [editId,  setEditId]  = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from("hilltiller_stock").select("*").order("date_received", { ascending: false });
    setLots((data ?? []) as HTLot[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const inStock  = lots.filter(l => l.status === "in-stock");
  const totalKg  = inStock.reduce((a, l) => a + n(l.current_kg), 0);
  const stockVal = inStock.reduce((a, l) => a + n(l.current_kg) * n(l.rate_per_kg), 0);
  const reserved = lots.filter(l => l.status === "reserved").reduce((a, l) => a + n(l.current_kg), 0);
  const depleted = lots.filter(l => l.status === "depleted").reduce((a, l) => a + n(l.green_kg_in), 0);

  const openAdd = () => { setForm(htBlank); setEditId(null); setDrawer(true); };
  const openEdit = (l: HTLot) => {
    setForm({ lot: l.lot, date_received: l.date_received, supplier: l.supplier, process: l.process,
      grade: l.grade, screen: l.screen, score: l.score, green_kg_in: l.green_kg_in,
      current_kg: l.current_kg, rate_per_kg: l.rate_per_kg, warehouse: l.warehouse,
      status: l.status, notes: l.notes });
    setEditId(l.id);
    setDrawer(true);
  };

  const save = async () => {
    if (!form.lot.trim()) { alert("Lot number is required"); return; }
    setSaving(true);
    if (editId) {
      await supabase.from("hilltiller_stock").update({ ...form }).eq("id", editId);
    } else {
      await supabase.from("hilltiller_stock").insert([{ ...form, current_kg: form.green_kg_in }]);
    }
    setSaving(false);
    setDrawer(false);
    load();
  };

  const f = (k: keyof Omit<HTLot,"id">, v: unknown) => setForm(p => ({ ...p, [k]: v }));

  return (
    <div>
      {/* KPI row */}
      <div className={css.kpiGrid}>
        <div className={css.kpiCard}>
          <div className={css.kpiLabel}>🌱 Green In Stock</div>
          <div><span className={css.kpiValue}>{Math.round(totalKg).toLocaleString("en-IN")}</span><span className={css.kpiUnit}>kg</span></div>
          <div className={css.kpiSub}>{inStock.length} active lots</div>
          <div className={css.kpiAccent} style={{ background: "#2ecc71" }} />
        </div>
        <div className={css.kpiCard}>
          <div className={css.kpiLabel}>💰 Stock Value</div>
          <div className={css.kpiValue} style={{ fontSize: "1.35rem" }}>{fmtINR(stockVal)}</div>
          <div className={css.kpiSub}>Weighted cost basis</div>
          <div className={css.kpiAccent} style={{ background: "#f5a623" }} />
        </div>
        <div className={css.kpiCard}>
          <div className={css.kpiLabel}>🔒 Reserved</div>
          <div><span className={css.kpiValue}>{Math.round(reserved).toLocaleString("en-IN")}</span><span className={css.kpiUnit}>kg</span></div>
          <div className={css.kpiSub}>Allocated to blends</div>
          <div className={css.kpiAccent} style={{ background: "#9b59b6" }} />
        </div>
        <div className={css.kpiCard}>
          <div className={css.kpiLabel}>📦 Total Received</div>
          <div><span className={css.kpiValue}>{Math.round(lots.reduce((a,l)=>a+n(l.green_kg_in),0)).toLocaleString("en-IN")}</span><span className={css.kpiUnit}>kg</span></div>
          <div className={css.kpiSub}>{depleted > 0 ? `${Math.round(depleted)} kg depleted` : "All lots tracked"}</div>
          <div className={css.kpiAccent} style={{ background: "#1fc8c8" }} />
        </div>
      </div>

      <div className={css.actionBar}>
        <button className={css.btnNew} onClick={openAdd}><Plus size={13} /> Add Stock</button>
      </div>

      <div className={css.tableCard}>
        <div className={css.tableWrap}>
          <table className={css.table}>
            <thead><tr>
              <th>Lot</th><th>Date</th><th>Supplier</th><th>Process</th>
              <th>Grade</th><th>Screen</th><th>Score</th>
              <th className={css.tdRight}>Available</th>
              <th className={css.tdRight}>Rate ₹/kg</th>
              <th className={css.tdRight}>Value</th>
              <th>Warehouse</th><th>Status</th><th></th>
            </tr></thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={13} className={css.empty}>Loading…</td></tr>
              ) : lots.length === 0 ? (
                <tr><td colSpan={13} className={css.empty}>No HillTiller stock yet. Click &quot;Add Stock&quot; to begin.</td></tr>
              ) : lots.map(l => {
                const pct = l.green_kg_in > 0 ? l.current_kg / l.green_kg_in : 0;
                const barClass = pct > 0.5 ? css.progressFill : pct > 0.2 ? css.progressFillLow : css.progressFillEmpty;
                return (
                  <tr key={l.id}>
                    <td><div className={css.tdMono}>{l.lot}</div></td>
                    <td style={{ fontSize: 11, color: "#7a90b0" }}>{fmtDate(l.date_received)}</td>
                    <td>{l.supplier || "—"}</td>
                    <td><span className={`${css.badge} ${processBadgeClass(l.process)}`}>{l.process || "—"}</span></td>
                    <td>{l.grade || "—"}</td>
                    <td className={css.tdMono}>{l.screen || "—"}</td>
                    <td className={css.tdNum}>{l.score ?? "—"}</td>
                    <td>
                      <div className={css.progressWrap}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: "var(--t-text)", fontVariantNumeric: "tabular-nums" }}>
                          {Math.round(l.current_kg).toLocaleString("en-IN")} kg
                        </div>
                        <div className={css.progressBar}>
                          <div className={barClass} style={{ width: `${Math.max(0, Math.min(100, pct * 100)).toFixed(1)}%` }} />
                        </div>
                      </div>
                    </td>
                    <td className={css.tdNum}>₹{n(l.rate_per_kg).toFixed(2)}</td>
                    <td className={css.tdNum} style={{ color: "#f5a623" }}>{fmtINR(n(l.current_kg) * n(l.rate_per_kg))}</td>
                    <td className={css.tdMono}>{l.warehouse || "—"}</td>
                    <td><span className={statusBadgeClass(l.status)}>{l.status}</span></td>
                    <td>
                      <button className={css.btnNew} style={{ padding: "4px 10px", fontSize: 11 }} onClick={() => openEdit(l)}>
                        Edit
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit drawer */}
      {drawer && (
        <Drawer title={editId ? "✏️ Edit Lot" : "🌱 Add HillTiller Stock"} onClose={() => setDrawer(false)}>
          <div className={css.formGrid2}>
            <div className={css.formGroup}>
              <label className={css.formLabel}>Lot Number *</label>
              <input className={css.formInput} value={form.lot} onChange={e => f("lot", e.target.value)} placeholder="e.g. HT-2026-001" />
            </div>
            <div className={css.formGroup}>
              <label className={css.formLabel}>Date Received *</label>
              <input type="date" className={css.formInput} value={form.date_received} onChange={e => f("date_received", e.target.value)} />
            </div>
            <div className={css.formGroup}>
              <label className={css.formLabel}>Supplier</label>
              <input className={css.formInput} value={form.supplier} onChange={e => f("supplier", e.target.value)} />
            </div>
            <div className={css.formGroup}>
              <label className={css.formLabel}>Process</label>
              <input className={css.formInput} value={form.process} onChange={e => f("process", e.target.value)} placeholder="e.g. Washed" />
            </div>
            <div className={css.formGroup}>
              <label className={css.formLabel}>Grade</label>
              <input className={css.formInput} value={form.grade} onChange={e => f("grade", e.target.value)} />
            </div>
            <div className={css.formGroup}>
              <label className={css.formLabel}>Screen</label>
              <input className={css.formInput} value={form.screen} onChange={e => f("screen", e.target.value)} />
            </div>
            <div className={css.formGroup}>
              <label className={css.formLabel}>Score</label>
              <input type="number" className={css.formInput} value={form.score ?? ""} onChange={e => f("score", e.target.value ? Number(e.target.value) : null)} placeholder="e.g. 84" />
            </div>
            <div className={css.formGroup}>
              <label className={css.formLabel}>Green kg In *</label>
              <input type="number" className={css.formInput} min="0" step="0.1" value={form.green_kg_in || ""} onChange={e => f("green_kg_in", Number(e.target.value))} />
            </div>
            {editId && (
              <div className={css.formGroup}>
                <label className={css.formLabel}>Current kg</label>
                <input type="number" className={css.formInput} min="0" step="0.1" value={form.current_kg || ""} onChange={e => f("current_kg", Number(e.target.value))} />
              </div>
            )}
            <div className={css.formGroup}>
              <label className={css.formLabel}>Rate ₹/kg</label>
              <input type="number" className={css.formInput} min="0" step="0.01" value={form.rate_per_kg || ""} onChange={e => f("rate_per_kg", Number(e.target.value))} />
            </div>
            <div className={css.formGroup}>
              <label className={css.formLabel}>Warehouse / Bin</label>
              <input className={css.formInput} value={form.warehouse} onChange={e => f("warehouse", e.target.value)} />
            </div>
            <div className={css.formGroup}>
              <label className={css.formLabel}>Status</label>
              <select className={css.formSelect} value={form.status} onChange={e => f("status", e.target.value)}>
                <option value="in-stock">In Stock</option>
                <option value="reserved">Reserved</option>
                <option value="depleted">Depleted</option>
              </select>
            </div>
          </div>
          <div className={css.formGroup} style={{ marginTop: 8 }}>
            <label className={css.formLabel}>Notes</label>
            <textarea className={css.formInput} rows={2} value={form.notes ?? ""} onChange={e => f("notes", e.target.value || null)} />
          </div>
          <button className={css.btnConfirm} onClick={save} disabled={saving} style={{ marginTop: 16 }}>
            {saving ? "Saving…" : editId ? "Save Changes" : "Add to Stock"}
          </button>
        </Drawer>
      )}
    </div>
  );
}

/* ─── Record Sale Drawer ──────────────────────────────────── */
// Unified lot row used in the dropdown
type UnifiedLot = { id: string; lot: string; current_kg: number; rate_per_kg: number; label: string; source: "green" | "hilltiller" };

function RecordSaleDrawer({ greenLots, defaultLot, onClose, reload, onSuccess }: {
  greenLots: GreenLot[]; defaultLot: GreenLot | null; onClose: () => void; reload: () => void; onSuccess?: () => void;
}) {
  // Fetch HillTiller lots
  const [htLots, setHtLots] = useState<HTLot[]>([]);
  useEffect(() => {
    supabase.from("hilltiller_stock").select("*").eq("status", "in-stock")
      .then(({ data }) => setHtLots((data ?? []) as HTLot[]));
  }, []);

  const greenAvailable = greenLots.filter(g => g.status === "in-stock");

  // Combined lot list for dropdown
  const allLots: UnifiedLot[] = [
    ...greenAvailable.map(g => ({
      id: g.id, lot: g.lot, current_kg: g.current_kg, rate_per_kg: g.rate_per_kg,
      label: `${g.lot} · ${g.field} · ${g.process} · ${Math.round(g.current_kg)} kg · ₹${n(g.rate_per_kg).toFixed(0)}/kg`,
      source: "green" as const,
    })),
    ...htLots.map(h => ({
      id: h.id, lot: h.lot, current_kg: h.current_kg, rate_per_kg: h.rate_per_kg,
      label: `${h.lot} · ${h.supplier} · ${h.process} · ${Math.round(h.current_kg)} kg · ₹${n(h.rate_per_kg).toFixed(0)}/kg`,
      source: "hilltiller" as const,
    })),
  ];

  const [channel,   setChannel]   = useState<Channel>("exporter");
  const [customer,  setCustomer]  = useState("");
  const [lotId,     setLotId]     = useState(defaultLot?.id ?? allLots[0]?.id ?? "");
  const [kg,        setKg]        = useState("");
  const [price,     setPrice]     = useState("");
  const [date,      setDate]      = useState(todayStr());
  const [ref,       setRef]       = useState("");
  const [notes,     setNotes]     = useState("");
  const [saving,    setSaving]    = useState(false);

  // Set default lot once allLots loads
  useEffect(() => {
    if (!lotId && allLots.length > 0) setLotId(allLots[0].id);
  }, [allLots.length]); // eslint-disable-line

  const selectedLot = allLots.find(l => l.id === lotId);
  const revenue     = n(kg) * n(price);
  const margin      = (n(price) - n(selectedLot?.rate_per_kg ?? 0)) * n(kg);

  const confirm = async () => {
    if (!customer.trim() || !lotId || !kg || !price || !date) {
      alert("Customer, lot, qty, price, and date are required."); return;
    }
    if (selectedLot && n(kg) > selectedLot.current_kg) {
      alert(`Only ${Math.round(selectedLot.current_kg)} kg available in this lot.`); return;
    }
    setSaving(true);
    const { data: sale, error: saleError } = await supabase.from("coffee_sales").insert([{
      date, channel, customer: customer.trim(), green_lot_ids: [lotId],
      kg: n(kg), price_per_kg: n(price), currency: "INR",
      status: channel === "internal-roast" ? "transferred" : "pending",
      reference: ref || null, notes: notes || null,
    }]).select().single();

    if (saleError || !sale) {
      setSaving(false);
      alert(`Failed to record sale: ${saleError?.message ?? "Unknown error"}. No stock has been deducted. Please try again or contact your administrator.`);
      return;
    }

    // Deduct from the correct table — only runs after a confirmed INSERT
    if (selectedLot) {
      const newKg = selectedLot.current_kg - n(kg);
      const table = selectedLot.source === "hilltiller" ? "hilltiller_stock" : "green_lots";
      const { error: deductError } = await supabase.from(table).update({
        current_kg: newKg,
        status: newKg <= 0 ? "depleted" : "in-stock",
      }).eq("id", lotId);
      if (deductError) {
        // Sale was recorded but stock deduction failed — log it clearly
        console.error("Stock deduction failed after sale was recorded:", deductError);
        alert(`Sale recorded (${sale.id}) but stock deduction failed: ${deductError.message}. Please manually adjust the stock for lot ${selectedLot.lot}.`);
      }
    }
    await writeAudit({ ts: new Date().toISOString(), actor: getUser(), action: "sale-created",
      entity: sale.id, before: null, after: `${kg}kg @ ₹${price}/kg → ${customer}`, note: channel });
    setSaving(false);
    onClose();
    if (onSuccess) onSuccess(); else reload();
  };

  const channelOptions: { key: Channel; label: string; icon: string }[] = [
    { key: "exporter", label: "Exporter", icon: "🌍" },
    { key: "cafe", label: "Local Café", icon: "☕" },
    { key: "internal-roast", label: "Internal Roastery", icon: "🔥" },
    { key: "retail", label: "Direct Retail", icon: "🛒" },
  ];

  return (
    <Drawer title="📤 Record Sale" onClose={onClose}>
      <div className={css.channelBtnBar}>
        {channelOptions.map(c => (
          <button key={c.key} onClick={() => setChannel(c.key)}
            className={`${css.channelBtn} ${channel===c.key ? (c.key==="exporter"?css.channelBtnActiveExp:c.key==="cafe"?css.channelBtnActiveCafe:c.key==="internal-roast"?css.channelBtnActiveRoast:css.channelBtnActiveRetail) : ""}`}>
            {c.icon} {c.label}
          </button>
        ))}
      </div>
      <div className={css.formGrid2}>
        <div className={css.formGroup}>
          <label className={css.formLabel}>Customer *</label>
          <input className={css.formInput} placeholder="e.g. Starbucks India" value={customer} onChange={e=>setCustomer(e.target.value)} />
        </div>
        <div className={css.formGroup}>
          <label className={css.formLabel}>Green Lot *</label>
          <select className={css.formSelect} value={lotId} onChange={e=>setLotId(e.target.value)}>
            {SEASONS.map(s => {
              const sLots = greenAvailable.filter(g => (g.season ?? "2024-2025") === s);
              if (sLots.length === 0) return null;
              return (
                <optgroup key={s} label={`☕ Green Store ${s}`}>
                  {sLots.map(g => (
                    <option key={g.id} value={g.id}>
                      {g.lot} · {g.field} · {g.process} · {Math.round(g.current_kg)} kg · ₹{n(g.rate_per_kg).toFixed(0)}/kg
                    </option>
                  ))}
                </optgroup>
              );
            })}
            {htLots.length > 0 && (
              <optgroup label="🌱 HillTiller Green Stock">
                {htLots.map(h => (
                  <option key={h.id} value={h.id}>
                    {h.lot} · {h.supplier} · {h.process} · {Math.round(h.current_kg)} kg · ₹{n(h.rate_per_kg).toFixed(0)}/kg
                  </option>
                ))}
              </optgroup>
            )}
            {allLots.length === 0 && <option value="">No stock available</option>}
          </select>
          {selectedLot && (
            <span style={{ fontSize:10, color:"#7a90b0", marginTop:2, display:"block" }}>
              Available: {Math.round(selectedLot.current_kg)} kg
              {selectedLot.source === "hilltiller" && " · HillTiller stock"}
            </span>
          )}
        </div>
        <div className={css.formGroup}>
          <label className={css.formLabel}>Quantity (kg) *</label>
          <input type="number" className={css.formInput} min="0" step="0.1" value={kg} onChange={e=>setKg(e.target.value)} />
        </div>
        <div className={css.formGroup}>
          <label className={css.formLabel}>Sale Price ₹/kg *</label>
          <input type="number" className={css.formInput} min="0" step="0.01" value={price} onChange={e=>setPrice(e.target.value)} />
        </div>
        <div className={css.formGroup}>
          <label className={css.formLabel}>Date *</label>
          <input type="date" className={css.formInput} value={date} onChange={e=>setDate(e.target.value)} />
        </div>
        <div className={css.formGroup}>
          <label className={css.formLabel}>Reference</label>
          <input className={css.formInput} placeholder="PO or contract #" value={ref} onChange={e=>setRef(e.target.value)} />
        </div>
      </div>
      <div className={css.formGroup} style={{ marginTop:10 }}>
        <label className={css.formLabel}>Notes</label>
        <textarea className={css.formTextarea} value={notes} onChange={e=>setNotes(e.target.value)} />
      </div>
      <div className={css.computedStrip}>
        <div className={css.computedItem}>
          <span className={css.computedLabel}>Revenue</span>
          <span className={`${css.computedValue} ${css.computedValueGold}`}>{fmtINR(revenue)}</span>
        </div>
        <div className={css.computedItem}>
          <span className={css.computedLabel}>Margin/kg</span>
          <span className={`${css.computedValue} ${margin>=0?css.computedValueGreen:css.computedValueRed}`}>
            ₹{(n(price)-n(selectedLot?.rate_per_kg??0)).toFixed(2)}
          </span>
        </div>
        <div className={css.computedItem}>
          <span className={css.computedLabel}>Total margin</span>
          <span className={`${css.computedValue} ${margin>=0?css.computedValueGreen:css.computedValueRed}`}>
            {fmtINR(margin)}
          </span>
        </div>
      </div>
      <DrawerFooter onCancel={onClose} onConfirm={confirm} saving={saving} label="✓ Record Sale" />
    </Drawer>
  );
}

/* ═══════════════════════════════════════════════════════════════
   BLENDS TAB
═══════════════════════════════════════════════════════════════ */
/* ─── Sell Blend Drawer ───────────────────────────────────── */
function SellBlendDrawer({ blend, greenLots, onClose, reload, onSuccess }: {
  blend: Blend; greenLots: GreenLot[]; onClose: () => void; reload: () => void; onSuccess?: () => void;
}) {
  const [htLots,   setHtLots]   = useState<HTLot[]>([]);
  const [channel,  setChannel]  = useState<Channel>("exporter");
  const [customer, setCustomer] = useState("");
  const [kg,       setKg]       = useState("");
  const [price,    setPrice]    = useState(String(blend.target_sell_price_per_kg || ""));
  const [date,     setDate]     = useState(todayStr());
  const [ref,      setRef]      = useState("");
  const [notes,    setNotes]    = useState("");
  const [saving,   setSaving]   = useState(false);

  useEffect(() => {
    supabase.from("hilltiller_stock").select("*")
      .then(({ data }) => setHtLots((data ?? []) as HTLot[]));
  }, []);

  const recipe      = blend.recipe ?? [];
  const recipeTotal = recipe.reduce((a, r) => a + n(r.kg), 0);

  const resolveLot = (id: string) => {
    const g = greenLots.find(l => l.id === id);
    if (g) return { lot: g.lot, field: g.field, process: g.process, current_kg: g.current_kg, rate_per_kg: g.rate_per_kg, source: "green" as const, status: g.status };
    const h = htLots.find(l => l.id === id);
    if (h) return { lot: h.lot, field: h.supplier, process: h.process, current_kg: h.current_kg, rate_per_kg: h.rate_per_kg, source: "hilltiller" as const, status: h.status };
    return null;
  };

  // Max sellable kg = minimum available across lots (proportional)
  const maxKg = recipeTotal > 0 ? recipe.reduce((min, r) => {
    const lot = resolveLot(r.green_lot_id);
    if (!lot) return min;
    const canMake = (n(lot.current_kg) / n(r.kg)) * recipeTotal;
    return Math.min(min, canMake);
  }, Infinity) : 0;

  const saleKg       = n(kg);
  const weightedCost = recipeTotal > 0
    ? recipe.reduce((a, r) => a + n(r.kg) * n(resolveLot(r.green_lot_id)?.rate_per_kg ?? 0), 0) / recipeTotal
    : 0;
  const revenue      = saleKg * n(price);
  const margin       = (n(price) - weightedCost) * saleKg;
  const insufficient = saleKg > 0 && saleKg > maxKg;

  const channelOptions: { key: Channel; label: string; icon: string }[] = [
    { key: "exporter",       label: "Exporter",          icon: "🌍" },
    { key: "cafe",           label: "Local Café",         icon: "☕" },
    { key: "internal-roast", label: "Internal Roastery",  icon: "🔥" },
    { key: "retail",         label: "Direct Retail",      icon: "🛒" },
  ];

  const confirm = async () => {
    if (!customer.trim() || !kg || !price || !date) {
      alert("Customer, quantity, price and date are required."); return;
    }
    if (insufficient) { alert(`Maximum available from this blend is ${Math.floor(maxKg)} kg.`); return; }
    setSaving(true);

    // Collect lot IDs first (no deduction yet)
    const lotIds: string[] = recipe.map(r => r.green_lot_id).filter(id => resolveLot(id));

    // INSERT the sale record first — deductions only happen after confirmed
    const { data: sale, error: saleError } = await supabase.from("coffee_sales").insert([{
      date, channel, customer: customer.trim(),
      green_lot_ids: lotIds,
      kg: saleKg, price_per_kg: n(price), currency: "INR",
      status: channel === "internal-roast" ? "transferred" : "pending",
      reference: ref || null,
      notes: `Blend sale: ${blend.name}${notes ? ` — ${notes}` : ""}`,
    }]).select().single();

    if (saleError || !sale) {
      setSaving(false);
      alert(`Failed to record sale: ${saleError?.message ?? "Unknown error"}. No stock has been deducted. Please try again or contact your administrator.`);
      return;
    }

    // Proportional deduction from each recipe lot — only after confirmed INSERT
    for (const r of recipe) {
      const lot = resolveLot(r.green_lot_id);
      if (!lot) continue;
      const deduct = (n(r.kg) / recipeTotal) * saleKg;
      const newKg  = lot.current_kg - deduct;
      const table  = lot.source === "hilltiller" ? "hilltiller_stock" : "green_lots";
      await supabase.from(table).update({
        current_kg: newKg,
        status: newKg <= 0 ? "depleted" : lot.status,
      }).eq("id", r.green_lot_id);
    }

    await writeAudit({ ts: new Date().toISOString(), actor: getUser(), action: "sale-created",
      entity: sale.id, before: null,
      after: `${saleKg} kg @ ₹${price}/kg → ${customer} (blend: ${blend.name})`,
      note: channel });

    setSaving(false);
    onClose();
    if (onSuccess) onSuccess(); else reload();
  };

  return (
    <Drawer title={`🌍 Sell Blend — ${blend.name}`} onClose={onClose}>
      {/* Recipe summary */}
      <div style={{ background:"#f9f6ef", borderRadius:10, padding:"10px 14px", marginBottom:14, border:"1px solid #e5dfc8" }}>
        <div style={{ fontSize:11, fontWeight:700, color:"#7a90b0", marginBottom:6, letterSpacing:"0.05em" }}>RECIPE</div>
        {recipe.map(r => {
          const lot = resolveLot(r.green_lot_id);
          const pct = recipeTotal > 0 ? (n(r.kg)/recipeTotal*100).toFixed(0) : "0";
          return (
            <div key={r.green_lot_id} style={{ display:"flex", justifyContent:"space-between", fontSize:12, marginBottom:3 }}>
              <span className={css.tdMono}>{lot?.lot ?? r.green_lot_id}
                {lot?.source === "hilltiller" && <span style={{ fontSize:9, fontWeight:700, background:"#dcfce7", color:"#166534", borderRadius:4, padding:"1px 5px", marginLeft:4 }}>HT</span>}
              </span>
              <span style={{ color:"var(--t-muted)" }}>{lot?.field} · {pct}% · {Math.round(lot?.current_kg??0)} kg avail</span>
            </div>
          );
        })}
        <div style={{ fontSize:11, color:"var(--t-muted)", marginTop:6 }}>
          Max sellable: <strong style={{ color: maxKg > 0 ? "var(--t-text)" : "#e8524a" }}>{isFinite(maxKg) ? Math.floor(maxKg).toLocaleString("en-IN") : 0} kg</strong>
          &nbsp;·&nbsp;Cost/kg: <strong>₹{weightedCost.toFixed(2)}</strong>
        </div>
      </div>

      {/* Channel selector */}
      <div className={css.channelBtnBar}>
        {channelOptions.map(c => (
          <button key={c.key} onClick={() => setChannel(c.key)}
            className={`${css.channelBtn} ${channel===c.key ? (c.key==="exporter"?css.channelBtnActiveExp:c.key==="cafe"?css.channelBtnActiveCafe:c.key==="internal-roast"?css.channelBtnActiveRoast:css.channelBtnActiveRetail) : ""}`}>
            {c.icon} {c.label}
          </button>
        ))}
      </div>

      <div className={css.formGrid2}>
        <div className={css.formGroup}>
          <label className={css.formLabel}>Customer *</label>
          <input className={css.formInput} placeholder="e.g. Starbucks India" value={customer} onChange={e=>setCustomer(e.target.value)} />
        </div>
        <div className={css.formGroup}>
          <label className={css.formLabel}>Quantity (kg) *</label>
          <input type="number" className={`${css.formInput} ${insufficient ? css.inputError ?? "" : ""}`}
            min="0" step="1" value={kg} onChange={e=>setKg(e.target.value)} />
          {insufficient && <span style={{ fontSize:10, color:"#e8524a" }}>Exceeds available stock ({Math.floor(maxKg)} kg max)</span>}
        </div>
        <div className={css.formGroup}>
          <label className={css.formLabel}>Sale Price ₹/kg *</label>
          <input type="number" className={css.formInput} min="0" step="0.01" value={price} onChange={e=>setPrice(e.target.value)} />
        </div>
        <div className={css.formGroup}>
          <label className={css.formLabel}>Date *</label>
          <input type="date" className={css.formInput} value={date} onChange={e=>setDate(e.target.value)} />
        </div>
        <div className={css.formGroup}>
          <label className={css.formLabel}>Reference</label>
          <input className={css.formInput} placeholder="PO or contract #" value={ref} onChange={e=>setRef(e.target.value)} />
        </div>
      </div>
      <div className={css.formGroup} style={{ marginTop:10 }}>
        <label className={css.formLabel}>Notes</label>
        <textarea className={css.formTextarea} value={notes} onChange={e=>setNotes(e.target.value)} />
      </div>

      <div className={css.computedStrip}>
        <div className={css.computedItem}>
          <span className={css.computedLabel}>Revenue</span>
          <span className={`${css.computedValue} ${css.computedValueGold}`}>{fmtINR(revenue)}</span>
        </div>
        <div className={css.computedItem}>
          <span className={css.computedLabel}>Margin/kg</span>
          <span className={`${css.computedValue} ${margin>=0?css.computedValueGreen:css.computedValueRed}`}>
            ₹{(n(price)-weightedCost).toFixed(2)}
          </span>
        </div>
        <div className={css.computedItem}>
          <span className={css.computedLabel}>Total margin</span>
          <span className={`${css.computedValue} ${margin>=0?css.computedValueGreen:css.computedValueRed}`}>{fmtINR(margin)}</span>
        </div>
      </div>
      <DrawerFooter onCancel={onClose} onConfirm={confirm} saving={saving} disabled={insufficient || !kg} label="🌍 Record Blend Sale" />
    </Drawer>
  );
}

function BlendsTab({ blends, greenLots, reload, setTab }: { blends: Blend[]; greenLots: GreenLot[]; reload: () => void; setTab: (t: Tab) => void }) {
  const [drawer, setDrawer] = useState<"builder"|"produce"|"sell"|null>(null);
  const [editBlend, setEditBlend] = useState<Blend | null>(null);
  const [produceBlend, setProduceBlend] = useState<Blend | null>(null);
  const [sellBlend, setSellBlend] = useState<Blend | null>(null);

  const activeBlends = blends.filter(b => b.status !== "retired");

  return (
    <div>
      <div className={css.actionBar}>
        <button className={css.btnNew} onClick={() => { setEditBlend(null); setDrawer("builder"); }}>
          <Plus size={13} /> New blend
        </button>
      </div>

      {activeBlends.length === 0 ? (
        <div className={css.empty}>No blends yet. Create your first blend recipe.</div>
      ) : (
        <div className={css.blendGrid}>
          {activeBlends.map(b => {
            const recipeTotal = (b.recipe ?? []).reduce((a,r)=>a+n(r.kg),0);
            const weightedCost = recipeTotal > 0
              ? (b.recipe ?? []).reduce((a,r) => {
                  const lot = greenLots.find(g=>g.id===r.green_lot_id);
                  return a + n(r.kg) * n(lot?.rate_per_kg??0);
                }, 0) / recipeTotal
              : 0;
            const margin = n(b.target_sell_price_per_kg) - weightedCost;

            return (
              <div key={b.id} className={css.blendCard}>
                <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between" }}>
                  <div>
                    <div className={css.blendCardTitle}>{b.name}</div>
                    <div className={css.blendCardDesc}>{b.description}</div>
                  </div>
                  <span className={statusBadgeClass(b.status)}>{b.status}</span>
                </div>

                {(b.recipe ?? []).length > 0 && (
                  <div style={{ marginBottom:8 }}>
                    {(b.recipe ?? []).map(r => {
                      const lot = greenLots.find(g=>g.id===r.green_lot_id);
                      const pct = recipeTotal > 0 ? n(r.kg)/recipeTotal*100 : 0;
                      return (
                        <div key={r.green_lot_id} className={css.blendRecipeRow}>
                          <span className={css.blendRecipeLabel}>{lot?.lot ?? r.green_lot_id}</span>
                          <div className={css.blendRecipeBar}>
                            <div className={css.blendRecipeBarFill}
                              style={{ width:`${pct.toFixed(1)}%`, background: processColor(lot?.process??"") }} />
                          </div>
                          <span className={css.blendRecipeKg}>{Math.round(n(r.kg))} kg</span>
                        </div>
                      );
                    })}
                  </div>
                )}

                <div className={css.blendCostSummary}>
                  <div className={css.blendCostItem}>
                    <span className={css.blendCostLabel}>Total kg</span>
                    <span className={css.blendCostValue}>{Math.round(recipeTotal).toLocaleString("en-IN")}</span>
                  </div>
                  <div className={css.blendCostItem}>
                    <span className={css.blendCostLabel}>Cost/kg</span>
                    <span className={css.blendCostValue}>₹{weightedCost.toFixed(2)}</span>
                  </div>
                  <div className={css.blendCostItem}>
                    <span className={css.blendCostLabel}>Target sell</span>
                    <span className={css.blendCostValue}>₹{n(b.target_sell_price_per_kg).toFixed(2)}</span>
                  </div>
                  <div className={css.blendCostItem}>
                    <span className={css.blendCostLabel}>Margin/kg</span>
                    <span className={css.blendCostValue} style={{ color: margin>=0?"#2ecc71":"#e8524a" }}>₹{margin.toFixed(2)}</span>
                  </div>
                </div>

                <div className={css.blendCardActions}>
                  <button className={css.btnSecondary} style={{ fontSize:12 }}
                    onClick={() => { setEditBlend(b); setDrawer("builder"); }}>
                    <Pencil size={11} /> Edit recipe
                  </button>
                  <button className={css.btnPrimary} style={{ fontSize:12 }}
                    onClick={() => { setProduceBlend(b); setDrawer("produce"); }}>
                    ▶ Produce batch
                  </button>
                  <button className={css.btnNew} style={{ fontSize:12 }}
                    onClick={() => { setSellBlend(b); setDrawer("sell"); }}>
                    🌍 Sell blend
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {drawer === "builder" && (
        <BlendBuilderDrawer blend={editBlend} greenLots={greenLots} onClose={() => { setDrawer(null); setEditBlend(null); }} reload={reload} />
      )}
      {drawer === "produce" && produceBlend && (
        <ProduceBlendDrawer blend={produceBlend} greenLots={greenLots} onClose={() => { setDrawer(null); setProduceBlend(null); }} reload={reload} />
      )}
      {drawer === "sell" && sellBlend && (
        <SellBlendDrawer blend={sellBlend} greenLots={greenLots} onClose={() => { setDrawer(null); setSellBlend(null); }} reload={reload} onSuccess={() => { reload(); setTab("sales"); }} />
      )}
    </div>
  );
}

/* ─── Blend Builder Drawer ────────────────────────────────── */
function BlendBuilderDrawer({ blend, greenLots, onClose, reload }: {
  blend: Blend | null; greenLots: GreenLot[]; onClose: () => void; reload: () => void;
}) {
  const [name,        setName]        = useState(blend?.name ?? "");
  const [description, setDescription] = useState(blend?.description ?? "");
  const [targetPrice, setTargetPrice] = useState(String(blend?.target_sell_price_per_kg ?? ""));
  const [status,      setStatus]      = useState<BlendStatus>(blend?.status ?? "draft");
  const [recipe,      setRecipe]      = useState<{ green_lot_id: string; kg: number }[]>(blend?.recipe ?? []);
  const [addLotId,    setAddLotId]    = useState("");
  const [saving,      setSaving]      = useState(false);
  const [htLots,      setHtLots]      = useState<HTLot[]>([]);

  useEffect(() => {
    supabase.from("hilltiller_stock").select("*").eq("status", "in-stock")
      .then(({ data }) => setHtLots((data ?? []) as HTLot[]));
  }, []);

  // Unified lot lookup across both sources
  const getLot = (id: string) => {
    const g = greenLots.find(l => l.id === id);
    if (g) return { lot: g.lot, desc: `${g.field} · ${g.process}`, current_kg: g.current_kg, rate_per_kg: g.rate_per_kg, source: "green" };
    const h = htLots.find(l => l.id === id);
    if (h) return { lot: h.lot, desc: `${h.supplier} · ${h.process}`, current_kg: h.current_kg, rate_per_kg: h.rate_per_kg, source: "hilltiller" };
    return null;
  };

  const greenAvail = greenLots.filter(g => g.status === "in-stock" && !recipe.some(r => r.green_lot_id === g.id));
  const htAvail    = htLots.filter(h => !recipe.some(r => r.green_lot_id === h.id));

  const recipeTotal  = recipe.reduce((a,r) => a + n(r.kg), 0);
  const weightedCost = recipeTotal > 0
    ? recipe.reduce((a,r) => a + n(r.kg) * n(getLot(r.green_lot_id)?.rate_per_kg ?? 0), 0) / recipeTotal
    : 0;
  const totalCost = recipe.reduce((a,r) => a + n(r.kg) * n(getLot(r.green_lot_id)?.rate_per_kg ?? 0), 0);

  const addLot = () => {
    if (!addLotId) return;
    setRecipe(r => [...r, { green_lot_id: addLotId, kg: 0 }]);
    setAddLotId("");
  };
  const updateKg = (id: string, kg: number) => setRecipe(r => r.map(row => row.green_lot_id===id ? { ...row, kg } : row));
  const removeLot = (id: string) => setRecipe(r => r.filter(row => row.green_lot_id !== id));

  const save = async () => {
    if (!name.trim()) { alert("Blend name required."); return; }
    setSaving(true);
    let blendId = blend?.id;
    if (blend) {
      await supabase.from("blends").update({
        name: name.trim(), description: description.trim() || null,
        target_sell_price_per_kg: n(targetPrice), total_kg: recipeTotal, status,
      }).eq("id", blend.id);
      await supabase.from("blend_recipe_items").delete().eq("blend_id", blend.id);
    } else {
      const { data } = await supabase.from("blends").insert([{
        name: name.trim(), description: description.trim() || null,
        target_sell_price_per_kg: n(targetPrice), total_kg: recipeTotal, status,
      }]).select().single();
      blendId = data?.id;
      if (blendId) {
        await writeAudit({ ts: new Date().toISOString(), actor: getUser(), action: "blend-created",
          entity: blendId, before: null, after: name.trim(), note: null });
      }
    }
    if (blendId && recipe.length > 0) {
      await supabase.from("blend_recipe_items").insert(recipe.map(r => ({ blend_id: blendId, ...r })));
    }
    setSaving(false);
    reload();
    onClose();
  };

  return (
    <Drawer title={blend ? `✏️ Edit Blend — ${blend.name}` : "➕ New Blend Recipe"} wide onClose={onClose}>
      <div className={css.formGrid2}>
        <div className={css.formGroup}>
          <label className={css.formLabel}>Blend Name *</label>
          <input className={css.formInput} placeholder="e.g. House Blend 2026" value={name} onChange={e=>setName(e.target.value)} />
        </div>
        <div className={css.formGroup}>
          <label className={css.formLabel}>Target Sell ₹/kg</label>
          <input type="number" className={css.formInput} min="0" step="0.01" value={targetPrice} onChange={e=>setTargetPrice(e.target.value)} />
        </div>
      </div>
      <div className={css.formGrid2}>
        <div className={css.formGroup}>
          <label className={css.formLabel}>Description</label>
          <input className={css.formInput} placeholder="Brief blend description" value={description} onChange={e=>setDescription(e.target.value)} />
        </div>
        <div className={css.formGroup}>
          <label className={css.formLabel}>Status</label>
          <select className={css.formSelect} value={status} onChange={e=>setStatus(e.target.value as BlendStatus)}>
            <option value="draft">Draft</option>
            <option value="active">Active</option>
            <option value="retired">Retired</option>
          </select>
        </div>
      </div>

      <div className={css.formSectionTitle} style={{ marginTop:16 }}>Recipe</div>
      {recipe.length === 0 ? (
        <div style={{ color:"#7a90b0", fontSize:12, marginBottom:10 }}>No lots added yet.</div>
      ) : recipe.map(r => {
        const lot = getLot(r.green_lot_id);
        const pct = recipeTotal > 0 ? (n(r.kg)/recipeTotal*100).toFixed(1) : "0.0";
        return (
          <div key={r.green_lot_id} className={css.recipeRow}>
            <div className={css.recipeRowLot}>
              <div style={{ display:"flex", alignItems:"center", gap:5 }}>
                {lot?.lot ?? r.green_lot_id}
                {lot?.source === "hilltiller" && (
                  <span style={{ fontSize:9, fontWeight:700, background:"#dcfce7", color:"#166534", borderRadius:4, padding:"1px 5px" }}>HT</span>
                )}
              </div>
              <div style={{ fontSize:10, color:"#7a90b0" }}>{lot?.desc} · {Math.round(n(lot?.current_kg??0))} kg avail.</div>
            </div>
            <span className={css.recipeRowPct}>{pct}%</span>
            <input type="number" className={css.recipeKgInput} min="0" step="1" value={r.kg}
              onChange={e=>updateKg(r.green_lot_id, n(e.target.value))} />
            <button style={{ background:"transparent", border:"none", color:"#e8524a", cursor:"pointer", fontSize:14 }} onClick={()=>removeLot(r.green_lot_id)}>×</button>
          </div>
        );
      })}

      {(greenAvail.length > 0 || htAvail.length > 0) && (() => {
        // Combine all available lots and normalise process into a category
        type AvailLot = { id: string; label: string; process: string; rate: number };
        const getCat = (p: string) => {
          const lp = p.toLowerCase();
          if (lp.includes('natural')) return 'Natural';
          if (lp.includes('washed'))  return 'Washed';
          if (lp.includes('honey') || lp.includes('psd')) return 'Black Honey';
          return 'Other';
        };
        const CAT_ORDER = ['Washed', 'Natural', 'Black Honey', 'Other'];
        const CAT_EMOJI: Record<string, string> = {
          'Washed':     '💧 Washed',
          'Natural':    '☀️ Natural',
          'Black Honey':'🍯 Black Honey',
          'Other':      '🌿 Other',
        };
        const allAvail: AvailLot[] = [
          ...greenAvail.map(g => ({
            id: g.id,
            label: `${g.lot} · ${g.field} · ${g.process} · ${Math.round(g.current_kg)} kg · ₹${n(g.rate_per_kg).toFixed(0)}/kg`,
            process: g.process,
            rate: n(g.rate_per_kg),
          })),
          ...htAvail.map(h => ({
            id: h.id,
            label: `${h.lot} · ${h.supplier} · ${h.process} · ${Math.round(h.current_kg)} kg · ₹${n(h.rate_per_kg).toFixed(0)}/kg`,
            process: h.process,
            rate: n(h.rate_per_kg),
          })),
        ];
        const grouped: Record<string, AvailLot[]> = {};
        for (const lot of allAvail) {
          const cat = getCat(lot.process);
          if (!grouped[cat]) grouped[cat] = [];
          grouped[cat].push(lot);
        }
        // Sort each category low → high price
        for (const cat of CAT_ORDER) {
          grouped[cat]?.sort((a, b) => a.rate - b.rate);
        }
        return (
          <div style={{ display:"flex", gap:8, marginTop:8 }}>
            <select className={css.formSelect} value={addLotId} onChange={e=>setAddLotId(e.target.value)} style={{ flex:1 }}>
              <option value="">Add a lot…</option>
              {CAT_ORDER.filter(cat => grouped[cat]?.length).map(cat => (
                <optgroup key={cat} label={CAT_EMOJI[cat]}>
                  {grouped[cat].map(lot => (
                    <option key={lot.id} value={lot.id}>{lot.label}</option>
                  ))}
                </optgroup>
              ))}
            </select>
            <button className={css.btnSecondary} onClick={addLot} disabled={!addLotId}>Add</button>
          </div>
        );
      })()}

      <div className={css.computedStrip} style={{ marginTop:14 }}>
        <div className={css.computedItem}>
          <span className={css.computedLabel}>Blend total</span>
          <span className={css.computedValue}>{fmtKg(recipeTotal)}</span>
        </div>
        <div className={css.computedItem}>
          <span className={css.computedLabel}>Weighted cost</span>
          <span className={`${css.computedValue} ${css.computedValueGold}`}>₹{weightedCost.toFixed(2)}/kg</span>
        </div>
        <div className={css.computedItem}>
          <span className={css.computedLabel}>Total cost</span>
          <span className={css.computedValue}>{fmtINR(totalCost)}</span>
        </div>
        <div className={css.computedItem}>
          <span className={css.computedLabel}>Margin/kg</span>
          <span className={`${css.computedValue} ${(n(targetPrice)-weightedCost)>=0?css.computedValueGreen:css.computedValueRed}`}>
            ₹{(n(targetPrice)-weightedCost).toFixed(2)}
          </span>
        </div>
        {recipeTotal > 0 && n(targetPrice) > 0 && (
          <div className={css.computedItem}>
            <span className={css.computedLabel}>vs Target</span>
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: '4px',
              padding: '3px 10px', borderRadius: '999px', fontWeight: 700, fontSize: '12px',
              background: (n(targetPrice) - weightedCost) >= 0 ? '#dcfce7' : '#fee2e2',
              color:      (n(targetPrice) - weightedCost) >= 0 ? '#15803d' : '#dc2626',
              border: `1px solid ${(n(targetPrice) - weightedCost) >= 0 ? '#86efac' : '#fca5a5'}`,
            }}>
              {(n(targetPrice) - weightedCost) >= 0 ? '▲' : '▼'}
              {(n(targetPrice) - weightedCost) >= 0 ? ' Above target' : ' Below target'}
            </span>
          </div>
        )}
      </div>
      <DrawerFooter onCancel={onClose} onConfirm={save} saving={saving} label="💾 Save Blend" />
    </Drawer>
  );
}

/* ─── Produce Blend Drawer ────────────────────────────────── */
function ProduceBlendDrawer({ blend, greenLots, onClose, reload }: {
  blend: Blend; greenLots: GreenLot[]; onClose: () => void; reload: () => void;
}) {
  const [scale,   setScale]   = useState(1.0);
  const [saving,  setSaving]  = useState(false);
  const [htLots,  setHtLots]  = useState<HTLot[]>([]);

  useEffect(() => {
    supabase.from("hilltiller_stock").select("*")
      .then(({ data }) => setHtLots((data ?? []) as HTLot[]));
  }, []);

  // Resolve a lot id from either source
  const resolveLot = (id: string) => {
    const g = greenLots.find(l => l.id === id);
    if (g) return { lot: g.lot, desc: g.field, current_kg: g.current_kg, rate_per_kg: g.rate_per_kg, source: "green" as const, status: g.status };
    const h = htLots.find(l => l.id === id);
    if (h) return { lot: h.lot, desc: `${h.supplier} · HT`, current_kg: h.current_kg, rate_per_kg: h.rate_per_kg, source: "hilltiller" as const, status: h.status };
    return null;
  };

  const recipe = blend.recipe ?? [];
  const hasInsufficient = recipe.some(r => {
    const lot = resolveLot(r.green_lot_id);
    return n(r.kg) * scale > n(lot?.current_kg ?? 0);
  });

  const confirm = async () => {
    if (hasInsufficient) return;
    setSaving(true);
    for (const r of recipe) {
      const lot = resolveLot(r.green_lot_id);
      if (!lot) continue;
      const newKg = lot.current_kg - n(r.kg) * scale;
      const table = lot.source === "hilltiller" ? "hilltiller_stock" : "green_lots";
      await supabase.from(table).update({
        current_kg: newKg,
        status: newKg <= 0 ? "depleted" : lot.status,
      }).eq("id", r.green_lot_id);
    }
    await writeAudit({ ts: new Date().toISOString(), actor: getUser(), action: "blend-produced",
      entity: blend.id, before: null,
      after: `${scale.toFixed(1)}× (${fmtKg(recipe.reduce((a,r)=>a+n(r.kg),0)*scale)}) — ${recipe.map(r=>resolveLot(r.green_lot_id)?.lot??r.green_lot_id).join(", ")}`,
      note: null });
    setSaving(false);
    reload();
    onClose();
  };

  return (
    <Drawer title={`▶ Produce — ${blend.name}`} onClose={onClose}>
      <div className={css.scaleSliderWrap}>
        <label className={css.formLabel}>Scale: {scale.toFixed(1)}×</label>
        <input type="range" className={css.scaleSlider} min="0.5" max="5" step="0.5" value={scale}
          onChange={e=>setScale(n(e.target.value))} />
        <div style={{ fontSize:11, color:"#7a90b0" }}>
          Producing {fmtKg(recipe.reduce((a,r)=>a+n(r.kg),0)*scale)} total
        </div>
      </div>

      <div className={css.formSectionTitle}>Lot Allocations</div>
      {recipe.map(r => {
        const lot = resolveLot(r.green_lot_id);
        const allocKg = n(r.kg) * scale;
        const remaining = n(lot?.current_kg??0) - allocKg;
        const insufficient = allocKg > n(lot?.current_kg??0);
        return (
          <div key={r.green_lot_id} className={`${css.produce_alloc_row} ${insufficient?css.produce_alloc_insufficient:""}`}>
            <span className={css.tdMono} style={{ fontSize:11 }}>
              {lot?.lot ?? r.green_lot_id}
              {lot?.source === "hilltiller" && (
                <span style={{ fontSize:9, fontWeight:700, background:"#dcfce7", color:"#166534", borderRadius:4, padding:"1px 5px", marginLeft:4 }}>HT</span>
              )}
            </span>
            <span style={{ fontSize:11, color:"#7a90b0" }}>{lot?.desc}</span>
            <span style={{ fontSize:12, color: insufficient?"#e8524a":"#d1e8f5" }}>
              –{Math.round(allocKg)} kg → {Math.round(remaining)} kg left
            </span>
          </div>
        );
      })}

      {hasInsufficient && (
        <div style={{ color:"#e8524a", fontSize:12, marginTop:10 }}>
          ⚠️ Insufficient stock in one or more lots. Reduce scale or edit the recipe.
        </div>
      )}

      <div className={css.computedStrip} style={{ marginTop:14 }}>
        <div className={css.computedItem}>
          <span className={css.computedLabel}>Production qty</span>
          <span className={css.computedValue}>{fmtKg(recipe.reduce((a,r)=>a+n(r.kg),0)*scale)}</span>
        </div>
        <div className={css.computedItem}>
          <span className={css.computedLabel}>Production cost</span>
          <span className={`${css.computedValue} ${css.computedValueGold}`}>
            {fmtINR(recipe.reduce((a,r)=>{
              const lot = resolveLot(r.green_lot_id);
              return a + n(r.kg)*scale*n(lot?.rate_per_kg??0);
            },0))}
          </span>
        </div>
      </div>
      <DrawerFooter onCancel={onClose} onConfirm={confirm} saving={saving} disabled={hasInsufficient} label="✓ Produce" />
    </Drawer>
  );
}

/* ═══════════════════════════════════════════════════════════════
   SALES TAB
═══════════════════════════════════════════════════════════════ */
function SalesTab({ sales, greenLots, reload, setTab }: { sales: CoffeeSale[]; greenLots: GreenLot[]; reload: () => void; setTab: (t: Tab) => void }) {
  const [channelFilter, setChannelFilter] = useState<Channel | "all">("all");
  const [saleDrawer, setSaleDrawer] = useState(false);

  const channels: Channel[] = ["exporter", "cafe", "internal-roast", "retail"];

  const channelStats = useMemo(() => {
    return channels.map(ch => ({
      ch,
      kg:       sales.filter(s=>s.channel===ch).reduce((a,s)=>a+n(s.kg),0),
      orders:   sales.filter(s=>s.channel===ch).length,
      revenue:  sales.filter(s=>s.channel===ch).reduce((a,s)=>a+n(s.kg)*n(s.price_per_kg),0),
    }));
  }, [sales]);

  const filtered = channelFilter === "all" ? sales : sales.filter(s=>s.channel===channelFilter);

  const chanLabel = (ch: string) => ({ exporter:"Exporter", cafe:"Local Café", "internal-roast":"Roastery", retail:"Retail" }[ch] ?? ch);

  return (
    <div>
      <div className={css.salesKpiGrid}>
        {channelStats.map(cs => (
          <div key={cs.ch} className={css.salesKpiCard}>
            <div className={css.salesKpiTop} style={{ background: channelColor(cs.ch) }} />
            <div className={css.salesKpiBody}>
              <div className={css.salesKpiChannel}>{chanLabel(cs.ch)}</div>
              <div className={css.salesKpiKg}>{Math.round(cs.kg).toLocaleString("en-IN")} kg</div>
              <div className={css.salesKpiSub}>{cs.orders} order{cs.orders!==1?"s":""} · {fmtINR(cs.revenue)}</div>
            </div>
          </div>
        ))}
      </div>

      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:12, flexWrap:"wrap", gap:8 }}>
        <div className={css.channelTabs}>
          {([["all","All Sales"],["exporter","Exporter"],["cafe","Café"],["internal-roast","Roastery"],["retail","Retail"]] as [Channel|"all", string][]).map(([ch,label]) => (
            <button key={ch} onClick={()=>setChannelFilter(ch)}
              className={`${css.channelTab} ${channelFilter===ch?css.channelTabActive:""}`}>
              {label}
            </button>
          ))}
        </div>
        <button className={css.btnNew} onClick={()=>setSaleDrawer(true)}>
          <Plus size={13} /> Record sale
        </button>
      </div>

      <div className={css.tableCard}>
        <div className={css.tableWrap}>
          <table className={css.table}>
            <thead><tr>
              <th>Order #</th><th>Date</th><th>Ch.</th><th>Customer</th>
              <th>Lots</th><th className={css.tdRight}>Qty</th>
              <th className={css.tdRight}>Price/kg</th><th className={css.tdRight}>Total</th>
              <th>Ref</th><th>Status</th>
            </tr></thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={10} className={css.empty}>No sales found.</td></tr>
              ) : filtered.map(s => (
                <tr key={s.id}>
                  <td className={css.tdMono} style={{ fontWeight:600 }}>{s.id}</td>
                  <td className={css.tdMono}>{fmtDate(s.date)}</td>
                  <td><span className={channelBadgeClass(s.channel)}>{channelLabel(s.channel)}</span></td>
                  <td>{s.customer}</td>
                  <td className={css.tdMono} style={{ fontSize:10 }}>{s.green_lot_ids.slice(0,2).join(", ")}{s.green_lot_ids.length>2?` +${s.green_lot_ids.length-2}`:""}</td>
                  <td className={css.tdNum}>{Math.round(n(s.kg)).toLocaleString("en-IN")} kg</td>
                  <td className={css.tdNum}>₹{n(s.price_per_kg).toFixed(2)}</td>
                  <td className={css.tdNum} style={{ color:"#f5a623" }}>{fmtINR(n(s.kg)*n(s.price_per_kg))}</td>
                  <td className={css.tdMono} style={{ fontSize:10 }}>{s.reference ?? "—"}</td>
                  <td><span className={statusBadgeClass(s.status)}>{s.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {saleDrawer && (
        <RecordSaleDrawer greenLots={greenLots} defaultLot={null} onClose={()=>setSaleDrawer(false)} reload={reload} onSuccess={() => { reload(); setTab("sales"); }} />
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   AUDIT LOG TAB
═══════════════════════════════════════════════════════════════ */
function AuditTab({ audit }: { audit: AuditEntry[] }) {
  return (
    <div>
      <div className={css.tableCard}>
        <div className={css.tableWrap} style={{ maxHeight:"calc(100vh - 280px)" }}>
          {audit.length === 0 ? (
            <div className={css.empty}>No audit entries yet.</div>
          ) : (
            <table className={css.table}>
              <thead><tr>
                <th>Timestamp</th><th>Actor</th><th>Action</th><th>Entity</th>
                <th>Before</th><th>After</th><th>Note</th>
              </tr></thead>
              <tbody>
                {audit.map(a => (
                  <tr key={a.id}>
                    <td className={css.tdMono} style={{ fontSize:11, color:"#7a90b0" }}>
                      {new Date(a.ts).toLocaleString("en-IN", { day:"2-digit", month:"short", hour:"2-digit", minute:"2-digit" })}
                    </td>
                    <td className={css.tdMono} style={{ fontSize:11.5 }}>{a.actor}</td>
                    <td><span className={`${css.badge} ${auditActionClass(a.action)}`}>{a.action}</span></td>
                    <td className={css.tdMono} style={{ fontWeight:600 }}>{a.entity}</td>
                    <td className={css.tdMono} style={{ color:"#7a90b0", fontSize:11 }}>{a.before ?? "—"}</td>
                    <td className={css.tdMono} style={{ fontSize:11 }}>{a.after ?? "—"}</td>
                    <td style={{ fontSize:11.5, color:"#7a90b0", fontStyle:"italic" }}>{a.note ?? ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   SHARED UI PRIMITIVES
═══════════════════════════════════════════════════════════════ */
function Drawer({ title, children, onClose, wide }: {
  title: string; children: React.ReactNode; onClose: () => void; wide?: boolean;
}) {
  return (
    <>
      <div className={css.drawerOverlay} onClick={onClose} />
      <div className={`${css.drawer} ${wide ? css.drawerWide : ""}`}>
        <div className={css.drawerHeader}>
          <span className={css.drawerTitle}>{title}</span>
          <button className={css.drawerClose} onClick={onClose}><X size={14} /></button>
        </div>
        <div className={css.drawerBody}>{children}</div>
      </div>
    </>
  );
}

function DrawerFooter({ onCancel, onConfirm, saving, label, disabled }: {
  onCancel: () => void; onConfirm: () => void; saving: boolean; label: string; disabled?: boolean;
}) {
  return (
    <div className={css.drawerFooter}>
      <button className={css.btnSecondary} onClick={onCancel}>Cancel</button>
      <button className={css.btnPrimary} disabled={saving || !!disabled} onClick={onConfirm}>
        {saving ? "Saving…" : label}
      </button>
    </div>
  );
}
