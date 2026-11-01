'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  BarChart3,
  Database,
  IndianRupee,
  PackageCheck,
  ReceiptText,
  ShoppingBag,
  Users,
} from 'lucide-react';
import {
  formatCount,
  formatInr,
  type HillTillerImportSnapshot,
  type SummaryRow,
  type TrendRow,
} from '@/lib/hilltiller/import-summary';
import s from '../hilltiller-sales.module.css';

type ViewMode = 'simple' | 'complex';

const storageKey = 'hilltiller_sales_view_mode';

export function HillTillerDashboardClient() {
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    if (typeof window === 'undefined') return 'simple';
    const saved = window.localStorage.getItem(storageKey);
    return saved === 'complex' ? 'complex' : 'simple';
  });
  const [dateRange, setDateRange] = useState('today-live');
  const [channel, setChannel] = useState('separate');
  const [product, setProduct] = useState('all-products');
  const [weight, setWeight] = useState('all-weights');
  const [payment, setPayment] = useState('all-payments');
  const [location, setLocation] = useState('all-locations');
  const [customerType, setCustomerType] = useState('all-customers');
  const [snapshot, setSnapshot] = useState<HillTillerImportSnapshot | null>(null);
  const [loadingSnapshot, setLoadingSnapshot] = useState(true);
  const [snapshotError, setSnapshotError] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function loadSnapshot() {
      setLoadingSnapshot(true);
      setSnapshotError('');
      try {
        const response = await fetch('/api/hilltiller-sales/import');
        const body = await response.json().catch(() => null) as { snapshot?: HillTillerImportSnapshot | null; error?: string } | null;
        if (!response.ok) throw new Error(body?.error ?? 'Could not load HillTiller import');
        if (!cancelled) setSnapshot(body?.snapshot ?? null);
      } catch (error) {
        if (!cancelled) setSnapshotError(error instanceof Error ? error.message : 'Could not load HillTiller import');
      } finally {
        if (!cancelled) setLoadingSnapshot(false);
      }
    }

    loadSnapshot();
    return () => {
      cancelled = true;
    };
  }, []);

  const setPreferredMode = (mode: ViewMode) => {
    setViewMode(mode);
    window.localStorage.setItem(storageKey, mode);
  };

  const rangeTrendRows = useMemo(
    () => filterTrendRows(snapshot?.orders?.trendRows ?? [], dateRange),
    [dateRange, snapshot],
  );
  const rangeSales = rangeTrendRows.reduce((sum, row) => sum + row.amount, 0);
  const rangeOrders = rangeTrendRows.reduce((sum, row) => sum + row.orders, 0);
  const hasSnapshot = Boolean(snapshot?.orders || snapshot?.transactions || snapshot?.products || snapshot?.inventory);
  const kpis = [
    {
      label: 'New Sales',
      value: formatInr(rangeSales || snapshot?.orders?.total || snapshot?.transactions?.successfulAmount || 0),
      meta: rangeTrendRows.length ? labelForDateRange(dateRange) : 'Import CSV files to populate',
      icon: IndianRupee,
    },
    {
      label: 'Orders',
      value: formatCount(rangeOrders || snapshot?.orders?.orderCount || 0),
      meta: snapshot?.orders ? `${formatCount(snapshot.orders.lineItemCount)} line items imported` : 'Awaiting orders CSV',
      icon: ShoppingBag,
    },
    {
      label: 'Net Sales',
      value: formatInr((snapshot?.orders?.total ?? 0) - (snapshot?.orders?.refunds ?? 0)),
      meta: 'After recorded refunds',
      icon: ReceiptText,
    },
    {
      label: 'Unfulfilled',
      value: formatCount(snapshot?.orders?.unfulfilled ?? 0),
      meta: 'Open fulfillment queue',
      icon: PackageCheck,
    },
    {
      label: 'Low Stock',
      value: formatCount(snapshot?.inventory?.lowStockRows.length ?? 0),
      meta: `${formatCount(snapshot?.inventory?.available ?? 0)} available units`,
      icon: AlertTriangle,
    },
    {
      label: 'Customers',
      value: formatCount(snapshot?.orders?.uniqueCustomerCount ?? 0),
      meta: 'Unique customer emails',
      icon: Users,
    },
  ];

  const visibleKpis = viewMode === 'simple' ? kpis.slice(0, 4) : kpis;
  const trendRows = rangeTrendRows.length ? rangeTrendRows : snapshot?.orders?.trendRows.slice(-7) ?? [];
  const maxTrendAmount = Math.max(...trendRows.map((row) => row.amount), 1);
  const weightRows = snapshot?.orders?.weightRows?.length ? snapshot.orders.weightRows : [];
  const topProductRows = snapshot?.orders?.productRows ?? [];
  const sourceRows = snapshot?.orders?.sourceRows ?? [];
  const paymentRows = snapshot?.orders?.paymentRows ?? snapshot?.transactions?.gatewayRows ?? [];

  return (
    <div className={s.page}>
      <section className={s.hero}>
        <div>
          <p className={s.eyebrow}>HillTiller Coffee Sales Management</p>
          <h1 className={s.title}>Sales Dashboard</h1>
          <p className={s.subtitle}>
            Simple view keeps the morning numbers clean. Complex view opens the dense
            KPI and chart layout for deeper sales, GST, customer, payment, and inventory analysis.
          </p>
        </div>
        <span className={s.statusPill}>
          {hasSnapshot ? <Database size={16} /> : <BarChart3 size={16} />}
          {hasSnapshot ? 'Supabase import loaded' : loadingSnapshot ? 'Loading import' : 'Awaiting CSV import'}
        </span>
      </section>

      {snapshotError && (
        <div className={s.notice}>
          {snapshotError}
        </div>
      )}

      {!hasSnapshot && !loadingSnapshot && (
        <div className={s.notice}>
          No saved Supabase import found yet. Open HillTiller Sales &gt; Data Import,
          load the Shopify CSV files, and save to Supabase.
          <div style={{ marginTop: 12 }}>
            <Link className={s.primaryButton} href="/hilltiller-sales/import">
              Open Data Import
            </Link>
          </div>
        </div>
      )}

      <section className={s.toolbar}>
        <label className={s.field}>
          <span className={s.label}>View</span>
          <span className={s.viewToggle}>
            <button
              className={`${s.toggleButton} ${viewMode === 'simple' ? s.toggleButtonActive : ''}`}
              type="button"
              onClick={() => setPreferredMode('simple')}
            >
              Simple
            </button>
            <button
              className={`${s.toggleButton} ${viewMode === 'complex' ? s.toggleButtonActive : ''}`}
              type="button"
              onClick={() => setPreferredMode('complex')}
            >
              Complex
            </button>
          </span>
        </label>

        <label className={`${s.field} ${s.fieldWide}`}>
          <span className={s.label}>Date Range</span>
          <select className={s.select} value={dateRange} onChange={(event) => setDateRange(event.target.value)}>
            <option value="today-live">Today Live</option>
            <option value="yesterday">Yesterday Completed</option>
            <option value="last-7-days">Last 7 Days</option>
            <option value="month-to-date">Month to Date</option>
            <option value="custom">Custom Range</option>
          </select>
        </label>

        <label className={s.field}>
          <span className={s.label}>Channel</span>
          <select className={s.select} value={channel} onChange={(event) => setChannel(event.target.value)}>
            <option value="separate">POS and Online</option>
            <option value="online">Online Only</option>
            <option value="pos">POS Only</option>
            <option value="combined">Combined</option>
          </select>
        </label>

        <label className={s.field}>
          <span className={s.label}>Product</span>
          <select className={s.select} value={product} onChange={(event) => setProduct(event.target.value)}>
            <option value="all-products">All Products</option>
            <option value="coffee">Coffee</option>
            <option value="future-products">Future Products</option>
          </select>
        </label>

        <label className={s.field}>
          <span className={s.label}>Weight</span>
          <select className={s.select} value={weight} onChange={(event) => setWeight(event.target.value)}>
            <option value="all-weights">All Weights</option>
            <option value="250g">250g</option>
            <option value="500g">500g</option>
            <option value="1kg">1kg</option>
          </select>
        </label>

        {viewMode === 'complex' && (
          <>
            <label className={s.field}>
              <span className={s.label}>Payment</span>
              <select className={s.select} value={payment} onChange={(event) => setPayment(event.target.value)}>
                <option value="all-payments">All Payments</option>
                <option value="shopify-payments">Shopify Payments</option>
                <option value="razorpay">Razorpay</option>
                <option value="stripe">Stripe</option>
                <option value="paypal">PayPal</option>
                <option value="cod">COD</option>
                <option value="bank-transfer">Bank Transfer</option>
              </select>
            </label>

            <label className={s.field}>
              <span className={s.label}>Location</span>
              <select className={s.select} value={location} onChange={(event) => setLocation(event.target.value)}>
                <option value="all-locations">All Locations</option>
                <option value="online-store">Online Store</option>
                <option value="pos-location">POS Location</option>
              </select>
            </label>

            <label className={s.field}>
              <span className={s.label}>Customer Type</span>
              <select className={s.select} value={customerType} onChange={(event) => setCustomerType(event.target.value)}>
                <option value="all-customers">All Customers</option>
                <option value="new">New</option>
                <option value="repeat">Repeat</option>
                <option value="dormant">Dormant</option>
              </select>
            </label>
          </>
        )}
      </section>

      <section className={s.kpiGrid}>
        {visibleKpis.map(({ label, value, meta, icon: Icon }) => (
          <article className={s.kpiCard} key={label}>
            <Icon size={19} color="var(--t-accent)" />
            <p className={s.kpiLabel}>{label}</p>
            <p className={s.kpiValue}>{value}</p>
            <p className={s.kpiMeta}>{meta}</p>
          </article>
        ))}
      </section>

      {viewMode === 'simple' ? (
        <section className={s.menuGrid}>
          {[
            ['Today / Selected Range', `${formatInr(rangeSales || snapshot?.orders?.total || 0)} from ${formatCount(rangeOrders || snapshot?.orders?.orderCount || 0)} orders.`],
            ['Yesterday Completed', 'Use the Date Range dropdown to switch to yesterday once the CSV snapshot is saved.'],
            ['Inventory Risk', `${formatCount(snapshot?.inventory?.lowStockRows.length ?? 0)} stock rows are at or below 10 units.`],
            ['GST Snapshot', `${formatInr(snapshot?.orders?.taxes ?? 0)} tax collected in imported orders.`],
          ].map(([title, text]) => (
            <article className={s.kpiCard} key={title}>
              <p className={s.kpiLabel}>{title}</p>
              <p className={s.kpiMeta}>{text}</p>
            </article>
          ))}
        </section>
      ) : (
        <section className={s.panelGrid}>
          <article className={`${s.panel} ${s.panelLarge}`}>
            <h2 className={s.panelTitle}>Sales Trend</h2>
            {trendRows.length ? (
              <div className={s.miniChart}>
                {trendRows.slice(-14).map((item) => (
                  <div className={s.miniColumn} key={item.date}>
                    <div className={s.miniBar} style={{ height: `${Math.max(8, (item.amount / maxTrendAmount) * 100)}%` }} />
                    <span className={s.miniLabel}>{item.label}</span>
                  </div>
                ))}
              </div>
            ) : <div className={s.emptyState}>Import the Orders CSV to show sales trend.</div>}
          </article>

          <article className={`${s.panel} ${s.panelSmall}`}>
            <h2 className={s.panelTitle}>Sales By Weight</h2>
            {weightRows.length ? <BarRows rows={weightRows} valueType="count" /> : <div className={s.emptyState}>Import order line items to group sales by weight.</div>}
          </article>

          <article className={s.panel}>
            <h2 className={s.panelTitle}>POS vs Online</h2>
            {sourceRows.length ? <SummaryTable rows={sourceRows} labelHeader="Channel" amountHeader="Sales" currency /> : <div className={s.emptyState}>Import Orders CSV to split sources.</div>}
          </article>

          <article className={s.panel}>
            <h2 className={s.panelTitle}>GST and Accounting</h2>
            <table className={s.table}>
              <tbody>
                <tr><td>Subtotal</td><td>{formatInr(snapshot?.orders?.subtotal ?? 0)}</td></tr>
                <tr><td>GST / taxes collected</td><td>{formatInr(snapshot?.orders?.taxes ?? 0)}</td></tr>
                <tr><td>Shipping charged</td><td>{formatInr(snapshot?.orders?.shipping ?? 0)}</td></tr>
                <tr><td>Refunded amount</td><td>{formatInr(snapshot?.orders?.refunds ?? 0)}</td></tr>
                <tr><td>Discounts</td><td>{formatInr(snapshot?.orders?.discounts ?? 0)}</td></tr>
              </tbody>
            </table>
          </article>

          <article className={s.panel}>
            <h2 className={s.panelTitle}>Inventory Risk</h2>
            {snapshot?.inventory?.lowStockRows.length ? (
              <div className={s.tableWrap}>
                <table className={s.table}>
                  <thead><tr><th>Product</th><th>Variant</th><th>Available</th></tr></thead>
                  <tbody>
                    {snapshot.inventory.lowStockRows.slice(0, 8).map((row) => (
                      <tr key={`${row.title}-${row.variant}-${row.location}`}>
                        <td>{row.title}</td>
                        <td>{row.variant}</td>
                        <td>{formatCount(row.available)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : <div className={s.emptyState}>Import Inventory CSV to show low-stock rows.</div>}
          </article>

          <article className={s.panel}>
            <h2 className={s.panelTitle}>Payment Mix</h2>
            {paymentRows.length ? <SummaryTable rows={paymentRows} labelHeader="Payment" amountHeader="Sales" currency /> : <div className={s.emptyState}>Import Orders or Transactions CSV to show payment mix.</div>}
          </article>

          <article className={`${s.panel} ${s.panelLarge}`}>
            <h2 className={s.panelTitle}>Top Products</h2>
            {topProductRows.length ? <SummaryTable rows={topProductRows.slice(0, 10)} labelHeader="Product" amountHeader="Revenue" currency /> : <div className={s.emptyState}>Import Orders CSV to show product revenue.</div>}
          </article>
        </section>
      )}
    </div>
  );
}

function BarRows({ rows, valueType }: { rows: SummaryRow[]; valueType: 'count' | 'amount' }) {
  const maxValue = Math.max(...rows.map((row) => valueType === 'amount' ? row.amount ?? 0 : row.count), 1);
  return (
    <div className={s.barRows}>
      {rows.map((row) => {
        const value = valueType === 'amount' ? row.amount ?? 0 : row.count;
        return (
          <div className={s.barRow} key={row.label}>
            <span>{row.label}</span>
            <span className={s.barTrack}><span className={s.barFill} style={{ width: `${Math.max(3, (value / maxValue) * 100)}%` }} /></span>
            <span>{valueType === 'amount' ? formatInr(value) : formatCount(value)}</span>
          </div>
        );
      })}
    </div>
  );
}

function SummaryTable({
  rows,
  labelHeader,
  amountHeader,
  currency = false,
}: {
  rows: SummaryRow[];
  labelHeader: string;
  amountHeader: string;
  currency?: boolean;
}) {
  return (
    <div className={s.tableWrap}>
      <table className={s.table}>
        <thead>
          <tr><th>{labelHeader}</th><th>Count</th><th>{amountHeader}</th></tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.label}>
              <td>{row.label}</td>
              <td>{formatCount(row.count)}</td>
              <td>{currency ? formatInr(row.amount ?? 0) : formatCount(row.amount ?? 0)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function filterTrendRows(rows: TrendRow[], dateRange: string) {
  if (!rows.length) return [];
  const sorted = [...rows].sort((a, b) => a.date.localeCompare(b.date));
  const maxDate = sorted[sorted.length - 1]?.date;
  if (!maxDate) return sorted;

  const end = new Date(`${maxDate}T00:00:00.000Z`);
  const start = new Date(end);

  if (dateRange === 'yesterday') {
    start.setUTCDate(end.getUTCDate() - 1);
    const key = start.toISOString().slice(0, 10);
    return sorted.filter((row) => row.date === key);
  }

  if (dateRange === 'last-7-days') {
    start.setUTCDate(end.getUTCDate() - 6);
    const startKey = start.toISOString().slice(0, 10);
    return sorted.filter((row) => row.date >= startKey && row.date <= maxDate);
  }

  if (dateRange === 'month-to-date') {
    const monthKey = maxDate.slice(0, 7);
    return sorted.filter((row) => row.date.startsWith(monthKey));
  }

  if (dateRange === 'today-live') {
    return sorted.filter((row) => row.date === maxDate);
  }

  return sorted;
}

function labelForDateRange(dateRange: string) {
  if (dateRange === 'yesterday') return 'Yesterday completed';
  if (dateRange === 'last-7-days') return 'Last 7 days';
  if (dateRange === 'month-to-date') return 'Month to date';
  if (dateRange === 'today-live') return 'Latest imported day';
  return 'Imported date range';
}
