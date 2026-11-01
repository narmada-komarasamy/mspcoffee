export type CsvRow = Record<string, string>;

export type HillTillerImportFileKind = 'orders' | 'transactions' | 'products' | 'inventory';

export type HillTillerImportSnapshot = {
  version: 1;
  savedAt: string;
  files: Record<HillTillerImportFileKind, {
    name: string;
    rowCount: number;
    columnCount: number;
  } | null>;
  orders: {
    orderCount: number;
    lineItemCount: number;
    unitsSold: number;
    uniqueCustomerCount: number;
    dateStart: string | null;
    dateEnd: string | null;
    subtotal: number;
    shipping: number;
    taxes: number;
    total: number;
    discounts: number;
    refunds: number;
    unfulfilled: number;
    fulfilled: number;
    pending: number;
    sourceRows: SummaryRow[];
    paymentRows: SummaryRow[];
    productRows: SummaryRow[];
    weightRows: SummaryRow[];
    trendRows: TrendRow[];
  } | null;
  transactions: {
    rowCount: number;
    dateStart: string | null;
    dateEnd: string | null;
    successfulAmount: number;
    refundAmount: number;
    gatewayRows: SummaryRow[];
    statusRows: SummaryRow[];
  } | null;
  products: {
    productCount: number;
    variantRows: number;
    activeRows: number;
    draftRows: number;
    skuBlankRows: number;
    costRows: number;
    inventoryQty: number;
    statusRows: SummaryRow[];
    typeRows: SummaryRow[];
  } | null;
  inventory: {
    rowCount: number;
    productCount: number;
    locationRows: SummaryRow[];
    available: number;
    onHand: number;
    committed: number;
    unavailable: number;
    incoming: number;
    lowStockRows: InventoryLowStockRow[];
    topStockRows: SummaryRow[];
  } | null;
};

export type SummaryRow = {
  label: string;
  count: number;
  amount?: number;
};

export type TrendRow = {
  label: string;
  date: string;
  orders: number;
  amount: number;
};

export type InventoryLowStockRow = {
  title: string;
  variant: string;
  location: string;
  available: number;
  onHand: number;
};

export const HILLTILLER_IMPORT_STORAGE_KEY = 'hilltiller_sales_import_snapshot_v1';

export function parseCsv(text: string): CsvRow[] {
  const normalized = text.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;

  for (let index = 0; index < normalized.length; index += 1) {
    const char = normalized[index];
    const next = normalized[index + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        cell += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === ',' && !inQuotes) {
      row.push(cell);
      cell = '';
      continue;
    }

    if (char === '\n' && !inQuotes) {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
      continue;
    }

    cell += char;
  }

  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }

  const [headers = [], ...body] = rows.filter((csvRow) => csvRow.some((value) => value.trim() !== ''));
  return body.map((csvRow) => {
    const record: CsvRow = {};
    headers.forEach((header, index) => {
      record[header.trim()] = csvRow[index]?.trim() ?? '';
    });
    return record;
  });
}

export function summarizeOrders(rows: CsvRow[]): HillTillerImportSnapshot['orders'] {
  if (!rows.length) return null;

  const orders = new Map<string, CsvRow>();
  const customers = new Set<string>();
  const sources = new Map<string, SummaryRow>();
  const payments = new Map<string, SummaryRow>();
  const products = new Map<string, SummaryRow>();
  const weights = new Map<string, SummaryRow>();
  const trends = new Map<string, TrendRow>();

  let lineItemCount = 0;
  let unitsSold = 0;
  let subtotal = 0;
  let shipping = 0;
  let taxes = 0;
  let total = 0;
  let discounts = 0;
  let refunds = 0;
  let fulfilled = 0;
  let unfulfilled = 0;
  let pending = 0;
  const dates: number[] = [];

  for (const row of rows) {
    const name = row.Name;
    if (name && !orders.has(name)) {
      orders.set(name, row);
      subtotal += toNumber(row.Subtotal);
      shipping += toNumber(row.Shipping);
      taxes += toNumber(row.Taxes);
      total += toNumber(row.Total);
      discounts += toNumber(row['Discount Amount']);
      refunds += toNumber(row['Refunded Amount']);

      const sourceLabel = normalizeSource(row.Source);
      addSummary(sources, sourceLabel, 1, toNumber(row.Total));

      const paymentLabel = row['Payment Method'] || 'Blank';
      addSummary(payments, paymentLabel, 1, toNumber(row.Total));

      const financial = row['Financial Status'] || '';
      if (financial === 'pending') pending += 1;

      const fulfillment = row['Fulfillment Status'] || '';
      if (fulfillment === 'fulfilled') fulfilled += 1;
      if (fulfillment === 'unfulfilled') unfulfilled += 1;

      if (row.Email) customers.add(row.Email.toLowerCase());

      const parsedDate = parseShopifyDate(row['Created at']);
      if (parsedDate) {
        dates.push(parsedDate.getTime());
        const key = parsedDate.toISOString().slice(0, 10);
        const current = trends.get(key) ?? { label: formatDayLabel(parsedDate), date: key, orders: 0, amount: 0 };
        current.orders += 1;
        current.amount += toNumber(row.Total);
        trends.set(key, current);
      }
    }

    if (row['Lineitem name']) {
      lineItemCount += 1;
      const quantity = toNumber(row['Lineitem quantity']);
      const lineRevenue = quantity * toNumber(row['Lineitem price']) - toNumber(row['Lineitem discount']);
      unitsSold += quantity;
      addSummary(products, row['Lineitem name'], quantity, lineRevenue);
      addSummary(weights, extractWeight(row['Lineitem name']), quantity, lineRevenue);
    }
  }

  return {
    orderCount: orders.size,
    lineItemCount,
    unitsSold,
    uniqueCustomerCount: customers.size,
    dateStart: dates.length ? new Date(Math.min(...dates)).toISOString() : null,
    dateEnd: dates.length ? new Date(Math.max(...dates)).toISOString() : null,
    subtotal,
    shipping,
    taxes,
    total,
    discounts,
    refunds,
    unfulfilled,
    fulfilled,
    pending,
    sourceRows: topSummaryRows(sources, 8),
    paymentRows: topSummaryRows(payments, 8),
    productRows: topSummaryRows(products, 12),
    weightRows: topSummaryRows(weights, 8),
    trendRows: [...trends.values()].sort((a, b) => a.date.localeCompare(b.date)),
  };
}

export function summarizeTransactions(rows: CsvRow[]): HillTillerImportSnapshot['transactions'] {
  if (!rows.length) return null;

  const gateways = new Map<string, SummaryRow>();
  const statuses = new Map<string, SummaryRow>();
  const dates: number[] = [];
  let successfulAmount = 0;
  let refundAmount = 0;

  for (const row of rows) {
    const amount = toNumber(row.Amount);
    addSummary(gateways, row.Gateway || 'Blank', 1, amount);
    addSummary(statuses, row.Status || 'Blank', 1, amount);
    if (row.Status === 'success') successfulAmount += amount;
    if (row.Kind === 'refund') refundAmount += amount;

    const parsedDate = parseShopifyDate(row['Created At']);
    if (parsedDate) dates.push(parsedDate.getTime());
  }

  return {
    rowCount: rows.length,
    dateStart: dates.length ? new Date(Math.min(...dates)).toISOString() : null,
    dateEnd: dates.length ? new Date(Math.max(...dates)).toISOString() : null,
    successfulAmount,
    refundAmount,
    gatewayRows: topSummaryRows(gateways, 8),
    statusRows: topSummaryRows(statuses, 8),
  };
}

export function summarizeProducts(rows: CsvRow[]): HillTillerImportSnapshot['products'] {
  if (!rows.length) return null;

  const products = new Set<string>();
  const statuses = new Map<string, SummaryRow>();
  const types = new Map<string, SummaryRow>();
  let activeRows = 0;
  let draftRows = 0;
  let skuBlankRows = 0;
  let costRows = 0;
  let inventoryQty = 0;

  for (const row of rows) {
    if (row.Handle) products.add(row.Handle);
    const status = row.Status || 'Continuation row';
    addSummary(statuses, status, 1);
    addSummary(types, row.Type || 'Unspecified', 1);
    if (row.Status === 'active') activeRows += 1;
    if (row.Status === 'draft') draftRows += 1;
    if (!row['Variant SKU']) skuBlankRows += 1;
    if (row['Cost per item']) costRows += 1;
    inventoryQty += toNumber(row['Variant Inventory Qty']);
  }

  return {
    productCount: products.size,
    variantRows: rows.length,
    activeRows,
    draftRows,
    skuBlankRows,
    costRows,
    inventoryQty,
    statusRows: topSummaryRows(statuses, 8),
    typeRows: topSummaryRows(types, 8),
  };
}

export function summarizeInventory(rows: CsvRow[]): HillTillerImportSnapshot['inventory'] {
  if (!rows.length) return null;

  const products = new Set<string>();
  const locations = new Map<string, SummaryRow>();
  const topStock = new Map<string, SummaryRow>();
  let available = 0;
  let onHand = 0;
  let committed = 0;
  let unavailable = 0;
  let incoming = 0;
  const lowStockRows: InventoryLowStockRow[] = [];

  for (const row of rows) {
    const title = row.Title || row.Handle || 'Untitled';
    const availableQty = toNumber(row['Available (not editable)']);
    const onHandQty = toNumber(row['On hand (current)']);
    products.add(row.Handle || title);
    addSummary(locations, row.Location || 'Blank', 1, availableQty);
    addSummary(topStock, title, 1, availableQty);
    available += availableQty;
    onHand += onHandQty;
    committed += toNumber(row['Committed (not editable)']);
    unavailable += toNumber(row['Unavailable (not editable)']);
    incoming += toNumber(row['Incoming (not editable)']);

    if (availableQty <= 10) {
      lowStockRows.push({
        title,
        variant: [row['Option1 Value'], row['Option2 Value'], row['Option3 Value']].filter(Boolean).join(' / ') || 'Default',
        location: row.Location || 'Blank',
        available: availableQty,
        onHand: onHandQty,
      });
    }
  }

  return {
    rowCount: rows.length,
    productCount: products.size,
    locationRows: topSummaryRows(locations, 8),
    available,
    onHand,
    committed,
    unavailable,
    incoming,
    lowStockRows: lowStockRows.sort((a, b) => a.available - b.available).slice(0, 20),
    topStockRows: topSummaryRows(topStock, 12),
  };
}

export function emptySnapshot(): HillTillerImportSnapshot {
  return {
    version: 1,
    savedAt: new Date().toISOString(),
    files: {
      orders: null,
      transactions: null,
      products: null,
      inventory: null,
    },
    orders: null,
    transactions: null,
    products: null,
    inventory: null,
  };
}

function addSummary(map: Map<string, SummaryRow>, label: string, count: number, amount = 0) {
  const cleanLabel = label || 'Blank';
  const current = map.get(cleanLabel) ?? { label: cleanLabel, count: 0, amount: 0 };
  current.count += count;
  current.amount = (current.amount ?? 0) + amount;
  map.set(cleanLabel, current);
}

function topSummaryRows(map: Map<string, SummaryRow>, limit: number) {
  return [...map.values()]
    .sort((a, b) => (b.amount ?? b.count) - (a.amount ?? a.count))
    .slice(0, limit);
}

export function toNumber(value: string | number | null | undefined) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  const cleaned = (value ?? '').replace(/[₹,\s]/g, '');
  const parsed = Number.parseFloat(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function formatInr(value: number) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatCount(value: number) {
  return new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(value);
}

function parseShopifyDate(value: string) {
  if (!value) return null;
  const normalized = value.replace(/ ([+-]\d{2})(\d{2})$/, ' $1:$2');
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDayLabel(date: Date) {
  return new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short' }).format(date);
}

function extractWeight(lineItemName: string) {
  const suffixMatch = lineItemName.match(/\s-\s(\d+(?:\.\d+)?)\s*(kg|g|ml)\s*$/i);
  if (!suffixMatch) return 'Unspecified';
  const rawNumber = Number.parseFloat(suffixMatch[1]);
  const cleanNumber = Number.isInteger(rawNumber) ? String(rawNumber) : String(rawNumber).replace(/0+$/, '').replace(/\.$/, '');
  return `${cleanNumber} ${suffixMatch[2].toUpperCase()}`;
}

function normalizeSource(source: string) {
  if (source === 'web') return 'Online';
  if (source.includes('pos')) return 'POS';
  if (source.includes('draft')) return 'Draft/POS';
  return source || 'Blank';
}
