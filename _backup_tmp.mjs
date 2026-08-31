import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const SUPABASE_URL = 'https://aeawxovvyvpcjkhyxgcq.supabase.co';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY;

const TABLES = [
  'green_lots',
  'hilltiller_stock',
  'coffee_sales',
  'parchment_batches',
  'blends',
  'blend_recipe_items',
  'coffee_audit_log',
  'app_users',
  'user_permissions',
];

const BACKUP_DIR = '/sessions/affectionate-epic-mayer/mnt/mspcoffee/backups';
const now = new Date();
const dateStr = now.toISOString().slice(0, 10); // YYYY-MM-DD

fs.mkdirSync(BACKUP_DIR, { recursive: true });

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: false },
});

// Fetch all rows with pagination (Supabase caps at 1000/req by default)
async function fetchAll(table) {
  const pageSize = 1000;
  let from = 0;
  let all = [];
  while (true) {
    const { data, error } = await supabase
      .from(table)
      .select('*')
      .range(from, from + pageSize - 1);
    if (error) throw error;
    all = all.concat(data);
    if (!data || data.length < pageSize) break;
    from += pageSize;
  }
  return all;
}

const results = {};
const combined = {};
const summary = [];

for (const table of TABLES) {
  try {
    const rows = await fetchAll(table);
    const file = path.join(BACKUP_DIR, `${table}_${dateStr}.json`);
    fs.writeFileSync(file, JSON.stringify(rows, null, 2));
    const bytes = fs.statSync(file).size;
    combined[table] = rows;
    results[table] = { status: 'ok', rows: rows.length, bytes };
    summary.push({ table, rows: rows.length, bytes, status: rows.length === 0 ? 'EMPTY (flag)' : 'ok' });
  } catch (e) {
    combined[table] = null;
    results[table] = { status: 'error', error: e.message || String(e) };
    summary.push({ table, rows: 0, bytes: 0, status: `ERROR: ${e.message || e}` });
  }
}

// Combined file
const combinedFile = path.join(BACKUP_DIR, `msp_coffee_backup_${dateStr}.json`);
const combinedPayload = {
  _meta: {
    generated_at: now.toISOString(),
    supabase_url: SUPABASE_URL,
    tables: TABLES,
    per_table: results,
  },
  ...combined,
};
fs.writeFileSync(combinedFile, JSON.stringify(combinedPayload, null, 2));
const combinedBytes = fs.statSync(combinedFile).size;

// Total size of all backup files written today
let totalBytes = combinedBytes;
for (const t of TABLES) {
  if (results[t].status === 'ok') totalBytes += results[t].bytes;
}

console.log(JSON.stringify({
  generated_at: now.toISOString(),
  date: dateStr,
  combined_file_bytes: combinedBytes,
  total_bytes: totalBytes,
  summary,
}, null, 2));
