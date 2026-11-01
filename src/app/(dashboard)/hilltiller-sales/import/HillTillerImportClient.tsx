'use client';

import { useMemo, useState } from 'react';
import { CheckCircle2, Database, FileSpreadsheet, Upload } from 'lucide-react';
import {
  HILLTILLER_IMPORT_STORAGE_KEY,
  emptySnapshot,
  formatCount,
  formatInr,
  parseCsv,
  summarizeInventory,
  summarizeOrders,
  summarizeProducts,
  summarizeTransactions,
  type CsvRow,
  type HillTillerImportFileKind,
  type HillTillerImportSnapshot,
} from '@/lib/hilltiller/import-summary';
import s from '../hilltiller-sales.module.css';

type LoadedFile = {
  name: string;
  rows: CsvRow[];
  columnCount: number;
};

const fileConfigs: {
  kind: HillTillerImportFileKind;
  title: string;
  helper: string;
  requiredColumns: string[];
}[] = [
  {
    kind: 'orders',
    title: 'Orders CSV',
    helper: 'Full Shopify orders export with line items, customers, taxes, discounts, shipping, and fulfillment.',
    requiredColumns: ['Name', 'Created at', 'Lineitem name', 'Total'],
  },
  {
    kind: 'transactions',
    title: 'Sales Transactions CSV',
    helper: 'Shopify transaction history export for payment gateway and payment status analysis.',
    requiredColumns: ['Order', 'Kind', 'Gateway', 'Created At', 'Amount'],
  },
  {
    kind: 'products',
    title: 'Products CSV',
    helper: 'Shopify product export for products, variants, prices, product status, and product metadata.',
    requiredColumns: ['Handle', 'Title', 'Variant Price', 'Status'],
  },
  {
    kind: 'inventory',
    title: 'Inventory CSV',
    helper: 'Shopify inventory export, preferably All states and All locations.',
    requiredColumns: ['Handle', 'Title', 'Location', 'Available (not editable)', 'On hand (current)'],
  },
];

export function HillTillerImportClient() {
  const [loaded, setLoaded] = useState<Partial<Record<HillTillerImportFileKind, LoadedFile>>>({});
  const [errors, setErrors] = useState<Partial<Record<HillTillerImportFileKind, string>>>({});
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState('');
  const [saving, setSaving] = useState(false);

  const snapshot = useMemo(() => buildSnapshot(loaded), [loaded]);
  const hasAnyFile = Object.values(loaded).some(Boolean);
  const canSave = Boolean(snapshot.orders || snapshot.transactions || snapshot.products || snapshot.inventory);

  const handleFile = async (kind: HillTillerImportFileKind, file: File | null) => {
    setErrors((current) => ({ ...current, [kind]: '' }));
    if (!file) return;

    try {
      const text = await file.text();
      const rows = parseCsv(text);
      const headers = rows[0] ? Object.keys(rows[0]) : [];
      const config = fileConfigs.find((item) => item.kind === kind);
      const missing = config?.requiredColumns.filter((column) => !headers.includes(column)) ?? [];
      if (missing.length) {
        setErrors((current) => ({
          ...current,
          [kind]: `This file is missing: ${missing.join(', ')}`,
        }));
        return;
      }

      setLoaded((current) => ({
        ...current,
        [kind]: { name: file.name, rows, columnCount: headers.length },
      }));
    } catch (error) {
      setErrors((current) => ({
        ...current,
        [kind]: error instanceof Error ? error.message : 'Could not read this CSV file',
      }));
    }
  };

  const saveSnapshot = async () => {
    const next = { ...snapshot, savedAt: new Date().toISOString() };
    setSaving(true);
    setSaveMessage('');

    try {
      const response = await fetch('/api/hilltiller-sales/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          snapshot: next,
          files: Object.entries(loaded)
            .filter((entry): entry is [HillTillerImportFileKind, LoadedFile] => Boolean(entry[1]))
            .map(([kind, file]) => ({
              kind,
              name: file.name,
              rows: file.rows,
              columnCount: file.columnCount,
            })),
        }),
      });

      const body = await response.json().catch(() => null) as { error?: string; batch?: { created_at?: string } } | null;
      if (!response.ok) throw new Error(body?.error ?? 'Could not save import to Supabase');

      window.localStorage.removeItem(HILLTILLER_IMPORT_STORAGE_KEY);
      setSavedAt(body?.batch?.created_at ?? next.savedAt);
      setSaveMessage('Saved to Supabase. The dashboard will read this as the latest HillTiller import.');
    } catch (error) {
      setSaveMessage(error instanceof Error ? error.message : 'Could not save import to Supabase');
    } finally {
      setSaving(false);
    }
  };

  const clearSnapshot = () => {
    window.localStorage.removeItem(HILLTILLER_IMPORT_STORAGE_KEY);
    setSavedAt(null);
    setSaveMessage('Local browser fallback cleared. Supabase imports are not deleted from this button.');
  };

  return (
    <div className={s.page}>
      <section className={s.hero}>
        <div>
          <p className={s.eyebrow}>CSV Workflow</p>
          <h1 className={s.title}>Data Import</h1>
          <p className={s.subtitle}>
            Load Shopify CSV files, review the detected data, and save a dashboard snapshot.
            This first version keeps the snapshot in this browser only. It does not upload
            customer/order data to the shared database yet.
          </p>
        </div>
        <span className={s.statusPill}><Upload size={16} /> CSV first</span>
      </section>

      {savedAt && (
        <div className={`${s.notice} ${s.successNotice}`}>
          Dashboard data saved in Supabase {new Date(savedAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST.
          Open the dashboard to view the imported KPIs and charts.
        </div>
      )}

      {saveMessage && (
        <div className={`${s.notice} ${saveMessage.includes('Could not') ? '' : s.successNotice}`}>
          {saveMessage}
        </div>
      )}

      <section className={s.menuGrid}>
        {fileConfigs.map((config) => {
          const file = loaded[config.kind];
          return (
            <article className={s.menuCard} key={config.kind}>
              <span className={s.menuIcon}><FileSpreadsheet size={22} /></span>
              <div>
                <h2 className={s.menuTitle}>{config.title}</h2>
                <p className={s.menuText}>{config.helper}</p>
              </div>
              <label className={s.field}>
                <span className={s.label}>Choose CSV</span>
                <input
                  className={s.fileInput}
                  type="file"
                  accept=".csv,text/csv"
                  onChange={(event) => handleFile(config.kind, event.target.files?.[0] ?? null)}
                />
              </label>
              {file && (
                <span className={s.badge}>
                  <CheckCircle2 size={13} />
                  {file.name} · {formatCount(file.rows.length)} rows
                </span>
              )}
              {errors[config.kind] && <p className={s.dangerText}>{errors[config.kind]}</p>}
            </article>
          );
        })}
      </section>

      <section className={s.toolbar}>
        <button className={s.primaryButton} type="button" onClick={saveSnapshot} disabled={!canSave || saving}>
          <Database size={16} />
          {saving ? 'Saving to Supabase...' : 'Save to Supabase'}
        </button>
        <button className={s.secondaryButton} type="button" onClick={clearSnapshot}>
          Clear Browser Fallback
        </button>
        {!hasAnyFile && <span className={s.settingText}>Choose at least one CSV file to preview its data.</span>}
      </section>

      <section className={s.kpiGrid}>
        <article className={s.kpiCard}>
          <p className={s.kpiLabel}>Orders</p>
          <p className={s.kpiValue}>{formatCount(snapshot.orders?.orderCount ?? 0)}</p>
          <p className={s.kpiMeta}>{formatCount(snapshot.orders?.lineItemCount ?? 0)} line items</p>
        </article>
        <article className={s.kpiCard}>
          <p className={s.kpiLabel}>Sales Total</p>
          <p className={s.kpiValue}>{formatInr(snapshot.orders?.total ?? snapshot.transactions?.successfulAmount ?? 0)}</p>
          <p className={s.kpiMeta}>From imported files</p>
        </article>
        <article className={s.kpiCard}>
          <p className={s.kpiLabel}>Products</p>
          <p className={s.kpiValue}>{formatCount(snapshot.products?.productCount ?? 0)}</p>
          <p className={s.kpiMeta}>{formatCount(snapshot.products?.variantRows ?? 0)} product rows</p>
        </article>
        <article className={s.kpiCard}>
          <p className={s.kpiLabel}>Inventory Available</p>
          <p className={s.kpiValue}>{formatCount(snapshot.inventory?.available ?? 0)}</p>
          <p className={s.kpiMeta}>{formatCount(snapshot.inventory?.lowStockRows.length ?? 0)} low-stock rows</p>
        </article>
      </section>

      <section className={s.panelGrid}>
        <PreviewPanel title="Imported Files" rows={Object.entries(snapshot.files).map(([kind, file]) => ({
          label: kind,
          count: file?.rowCount ?? 0,
          amount: file?.columnCount ?? 0,
        }))} amountLabel="Columns" />
        <PreviewPanel title="Payment Methods" rows={snapshot.orders?.paymentRows ?? snapshot.transactions?.gatewayRows ?? []} amountLabel="Amount" currency />
        <PreviewPanel title="Top Products" rows={snapshot.orders?.productRows ?? []} amountLabel="Revenue" currency />
        <PreviewPanel title="Low Stock" rows={(snapshot.inventory?.lowStockRows ?? []).slice(0, 8).map((row) => ({
          label: `${row.title} · ${row.variant}`,
          count: row.available,
          amount: row.onHand,
        }))} amountLabel="On hand" />
      </section>
    </div>
  );
}

function PreviewPanel({
  title,
  rows,
  amountLabel,
  currency = false,
}: {
  title: string;
  rows: { label: string; count: number; amount?: number }[];
  amountLabel: string;
  currency?: boolean;
}) {
  return (
    <article className={s.panel}>
      <h2 className={s.panelTitle}>{title}</h2>
      {rows.length ? (
        <div className={s.tableWrap}>
          <table className={s.table}>
            <thead>
              <tr><th>Item</th><th>Count</th><th>{amountLabel}</th></tr>
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
      ) : (
        <div className={s.emptyState}>Load the matching CSV file to preview this section.</div>
      )}
    </article>
  );
}

function buildSnapshot(loaded: Partial<Record<HillTillerImportFileKind, LoadedFile>>): HillTillerImportSnapshot {
  const snapshot = emptySnapshot();

  for (const config of fileConfigs) {
    const file = loaded[config.kind];
    snapshot.files[config.kind] = file
      ? { name: file.name, rowCount: file.rows.length, columnCount: file.columnCount }
      : null;
  }

  snapshot.orders = loaded.orders ? summarizeOrders(loaded.orders.rows) : null;
  snapshot.transactions = loaded.transactions ? summarizeTransactions(loaded.transactions.rows) : null;
  snapshot.products = loaded.products ? summarizeProducts(loaded.products.rows) : null;
  snapshot.inventory = loaded.inventory ? summarizeInventory(loaded.inventory.rows) : null;

  return snapshot;
}
