/**
 * MSP Coffee — Fleet Fuel Expenses
 * Google Apps Script: auto-sync Google Sheet → Supabase fleet_daily table
 *
 * SETUP (one-time):
 *  1. Run setupProperties() — paste real values first, then run.
 *  2. Run setupTrigger()    — installs onEdit trigger on onEditSync.
 *  3. Run rebuildFleetFromSheet() — backfills DB from current sheet state.
 *
 * SHEET FORMAT (row 1 = headers, data from row 2):
 *   Date | Vehicle ID | Vehicle Type | Account | Fuel Type |
 *   Starting KM | Closing KM | Fuel Filled (L) | Fuel Cost |
 *   Maint Cost | Maintenance Performed | Remarks
 */

// ─── Non-secret constants ─────────────────────────────────────────────────────
const VALID_ACCOUNTS      = ["BVE", "HFE", "ME", "ORE", "RSE", "SE", "MSPLTD"];
const VALID_VEHICLE_TYPES = ["Estate", "Personal"];
const VALID_FUEL_TYPES    = ["Diesel", "Petrol"];

// ─── Script Properties (secrets live here, not in code) ──────────────────────
/**
 * Run ONCE. Replace placeholder values with real ones before running.
 * After running, the values are stored in Script Properties — safe to leave
 * this function in place (it just overwrites the same values on re-run).
 */
function setupProperties() {
  PropertiesService.getScriptProperties().setProperties({
    SUPABASE_URL: "https://aeawxovvyvpcjkhyxgcq.supabase.co",
    SUPABASE_KEY: "<paste anon key here>",
    TABLE_NAME:   "fleet_daily",
    SHEET_NAME:   "Fleet Data",
  }, true);
  Logger.log("Script properties set. Delete this function body after running once.");
}

function cfg() {
  const p   = PropertiesService.getScriptProperties();
  const get = k => {
    const v = p.getProperty(k);
    if (!v) throw new Error(`Missing script property: ${k}. Run setupProperties() once.`);
    return v;
  };
  return {
    supabaseUrl: get("SUPABASE_URL"),
    supabaseKey: get("SUPABASE_KEY"),
    table:       get("TABLE_NAME"),
    sheet:       get("SHEET_NAME"),
  };
}

// ─── Header resolution ────────────────────────────────────────────────────────
function resolveColumns(headers) {
  const find = candidates => {
    for (const c of candidates) {
      const i = headers.indexOf(c);
      if (i !== -1) return i;
    }
    return -1;
  };

  const col = {
    date:                  find(["date", "sync date", "entry date", "txn date"]),
    vehicle_id:            find(["vehicle id", "vehicle"]),
    vehicle_type:          find(["vehicle type", "type"]),
    account:               find(["account"]),
    fuel_type:             find(["fuel type", "fuel category", "fuel"]),
    starting_km:           find(["starting km", "start km", "opening km"]),
    closing_km:            find(["closing km", "close km", "ending km"]),
    fuel_filled_l:         find(["fuel filled (l)", "fuel filled", "litres", "liters"]),
    fuel_cost:             find(["fuel cost (₹)", "fuel cost(₹)", "fuel cost", "fuel expense", "fuel amount", "fuel amt", "fuel charges", "fuel (₹)", "fuel(₹)", "cost of fuel", "petrol cost", "diesel cost", "petrol/diesel cost"]),
    maint_cost:            find(["maint cost (₹)", "maint cost(₹)", "maint cost", "maintenance cost (₹)", "maintenance cost(₹)", "maintenance cost", "maintenance", "maint", "maintenance charges", "maintenance amt", "maintenance amount", "repair cost", "service cost", "maint charges", "maint amt", "maintenance expense"]),
    maintenance_performed: find(["maintenance performed", "maint performed", "work done"]),
    remarks:               find(["remarks", "notes"]),
  };

  // ── Warn on undetected cost columns ───────────────────────────────────────
  if (col.fuel_cost === -1)  Logger.log("⚠️  WARNING: 'Fuel Cost' column not found. Headers detected: " + headers.join(" | "));
  if (col.maint_cost === -1) Logger.log("⚠️  WARNING: 'Maint Cost' column not found. Headers detected: " + headers.join(" | "));

  // Required — throw loudly so execution turns red in Apps Script UI
  const missing = ["date", "vehicle_id"].filter(k => col[k] === -1);
  if (missing.length) {
    throw new Error(
      `Required header missing. Found headers: ${JSON.stringify(headers)}. Needed: ${missing.join(", ")}.`
    );
  }

  // Optional — log once per run
  const OPTIONAL_DEFAULTS = {
    vehicle_type: "Estate", account: "BVE", fuel_type: "Diesel",
    starting_km: 0, closing_km: 0, fuel_filled_l: 0,
    fuel_cost: 0, maint_cost: 0, maintenance_performed: "''", remarks: "''",
  };
  for (const [k, def] of Object.entries(OPTIONAL_DEFAULTS)) {
    if (col[k] === -1) Logger.log(`Note: optional header '${k}' not found, defaulting to ${def}`);
  }

  return col;
}

// ─── Row parsing ──────────────────────────────────────────────────────────────
/**
 * Parses one data row. Returns a DB record object or null.
 * Mutates `skip` to accumulate skip-reason counts and first-offender samples.
 */
function parseRow(rowValues, col, rowNum, skip) {
  const rawDate = rowValues[col.date];
  if (!rawDate) { skip.emptyDate++; return null; }

  const date = formatDate(rawDate);
  if (!date) {
    skip.invalidDate++;
    if (!skip.invalidDateSample) skip.invalidDateSample = `row ${rowNum} raw='${rawDate}'`;
    return null;
  }

  const vehicle_id = String(rowValues[col.vehicle_id] ?? "").trim();
  if (!vehicle_id) {
    skip.missingVehicleId++;
    if (!skip.missingVehicleSample) skip.missingVehicleSample = `row ${rowNum}`;
    return null;
  }

  const vehicle_type  = coerce(rowValues[col.vehicle_type],  "Estate", VALID_VEHICLE_TYPES);
  const account       = coerce(rowValues[col.account],       "BVE",    VALID_ACCOUNTS);
  const fuel_type     = coerce(rowValues[col.fuel_type],     "Diesel", VALID_FUEL_TYPES);
  const starting_km   = num(rowValues[col.starting_km]);
  const closing_km    = num(rowValues[col.closing_km]);
  const km_run        = Math.max(0, closing_km - starting_km);
  const fuel_filled_l = num(rowValues[col.fuel_filled_l]);
  const fuel_cost     = num(rowValues[col.fuel_cost]);
  const maint_cost    = num(rowValues[col.maint_cost]);
  const total_cost    = fuel_cost + maint_cost;
  const avg_mileage   = fuel_filled_l > 0 ? round3(km_run / fuel_filled_l) : 0;
  const cost_per_km   = km_run > 0 ? round3(total_cost / km_run) : 0;
  const maintenance_performed = String(rowValues[col.maintenance_performed] ?? "").trim();
  const remarks               = String(rowValues[col.remarks]               ?? "").trim();

  const d = new Date(date);
  skip.ok++;
  return {
    date, month: d.getMonth() + 1, year: d.getFullYear(),
    vehicle_id, vehicle_type, account, fuel_type,
    starting_km, closing_km, km_run, fuel_filled_l, fuel_cost, maint_cost,
    total_cost, avg_mileage, cost_per_km, maintenance_performed, remarks,
  };
}

// ─── Skip summary ─────────────────────────────────────────────────────────────
function logSkipSummary(total, s) {
  Logger.log(
    `Parsed ${total} rows from sheet:\n` +
    `  ok:                ${s.ok}\n` +
    `  empty date:        ${s.emptyDate}\n` +
    `  invalid date:      ${s.invalidDate}` +
      (s.invalidDateSample ? ` (sample: ${s.invalidDateSample})` : "") + "\n" +
    `  missing vehicle:   ${s.missingVehicleId}` +
      (s.missingVehicleSample ? ` (sample: ${s.missingVehicleSample})` : "")
  );
}

// ─── Dedup helper ─────────────────────────────────────────────────────────────
/** Keeps last occurrence of each (date, vehicle_id) pair within rows. */
function dedupRows(rows) {
  const seen = new Map();
  for (const r of rows) seen.set(r.date + "|" + r.vehicle_id, r);
  return Array.from(seen.values());
}

// ─── Upsert helper ────────────────────────────────────────────────────────────
/** Returns true if any batch failed. */
function upsertRows(rows, config) {
  const BATCH = 500;
  let anyFailed = false;
  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);
    const resp  = UrlFetchApp.fetch(
      `${config.supabaseUrl}/rest/v1/${config.table}?on_conflict=date,vehicle_id`,
      {
        method:  "POST",
        headers: { ...buildHeaders(config.supabaseKey), "Prefer": "resolution=merge-duplicates,return=minimal" },
        payload: JSON.stringify(batch),
        muteHttpExceptions: true,
      }
    );
    const code = resp.getResponseCode();
    if (code < 200 || code >= 300) {
      Logger.log(
        `Upsert error (rows ${i}–${i + batch.length - 1}): ${code} — ` +
        resp.getContentText().slice(0, 500)
      );
      anyFailed = true;
    }
  }
  return anyFailed;
}

// ─── onEdit fast path (one upsert per edit) ───────────────────────────────────
function onEditSync(e) {
  if (!e || !e.range) {
    throw new Error(
      "onEditSync called without an event. Use rebuildFleetFromSheet or wipeAndRebuildFleet instead."
    );
  }

  const config = cfg();
  const sheet  = e.range.getSheet();
  if (sheet.getName() !== config.sheet) return;
  if (e.range.getRow() === 1) { Logger.log("Header row edited — skipping sync."); return; }

  const lastCol  = sheet.getLastColumn();
  const headers  = sheet.getRange(1, 1, 1, lastCol).getValues()[0]
                     .map(h => String(h).trim().toLowerCase());
  const col = resolveColumns(headers); // throws (red execution) if required headers missing

  const firstRow  = e.range.getRow();
  const numRows   = e.range.getLastRow() - firstRow + 1;
  const allValues = sheet.getRange(firstRow, 1, numRows, lastCol).getValues();
  const skip      = { ok: 0, emptyDate: 0, invalidDate: 0, missingVehicleId: 0 };
  const records   = [];

  for (let i = 0; i < numRows; i++) {
    const rec = parseRow(allValues[i], col, firstRow + i, skip);
    if (rec) records.push(rec);
  }

  if (records.length === 0) {
    // Don't throw — user may be mid-typing
    Logger.log(`Edited rows ${firstRow}–${firstRow + numRows - 1} produced no valid records: ${JSON.stringify(skip)}`);
    return;
  }

  const toUpsert = dedupRows(records);
  upsertRows(toUpsert, config);
  Logger.log(`Upserted ${toUpsert.length} record(s) from edited rows ${firstRow}–${firstRow + numRows - 1}.`);
}

// ─── Rebuild: safe upsert, no DELETE ─────────────────────────────────────────
function rebuildFleetFromSheet() {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try { _rebuild(false); } finally { lock.releaseLock(); }
}

// ─── Nuclear option ───────────────────────────────────────────────────────────
/**
 * Do NOT run casually. This wipes the entire fleet_daily table and re-syncs
 * from the current sheet state. If the sheet has bad/missing data, the DB
 * will mirror that.
 */
function wipeAndRebuildFleet() {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try { _rebuild(true); } finally { lock.releaseLock(); }
}

function _rebuild(wipe) {
  const config = cfg();
  const sheet  = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(config.sheet);
  if (!sheet) throw new Error(`Sheet not found: ${config.sheet}`);

  const lastRow = sheet.getLastRow();
  if (lastRow < 2) throw new Error("No data rows found in sheet.");

  const lastCol = sheet.getLastColumn();
  const values  = sheet.getRange(1, 1, lastRow, lastCol).getValues();
  const headers = values[0].map(h => String(h).trim().toLowerCase());
  const col     = resolveColumns(headers); // throws (red) if required headers missing

  const skip    = { ok: 0, emptyDate: 0, invalidDate: 0, missingVehicleId: 0 };
  const records = [];
  for (let i = 1; i < values.length; i++) {
    const rec = parseRow(values[i], col, i + 1, skip);
    if (rec) records.push(rec);
  }

  logSkipSummary(values.length - 1, skip);
  if (skip.ok === 0) {
    throw new Error("No valid rows produced from sheet — see row-skip summary above");
  }

  const deduped = dedupRows(records);
  if (deduped.length < records.length) {
    Logger.log(`Deduped ${records.length - deduped.length} duplicate (date, vehicle_id) pairs — keeping last occurrence.`);
  }

  if (wipe) {
    const del = UrlFetchApp.fetch(
      `${config.supabaseUrl}/rest/v1/${config.table}?id=gte.0`,
      { method: "DELETE", headers: buildHeaders(config.supabaseKey), muteHttpExceptions: true }
    );
    Logger.log(`DELETE all rows: ${del.getResponseCode()}`);
  }

  const anyFailed = upsertRows(deduped, config);
  if (anyFailed) throw new Error("Some batches failed — see log");
  Logger.log(`${wipe ? "Wipe+rebuild" : "Rebuild"} complete: ${deduped.length} rows upserted.`);
}

// ─── Daily backup ─────────────────────────────────────────────────────────────
/**
 * Copies the Fleet Data sheet to a separate backup Google Sheet (created once,
 * ID stored in Script Properties). Each run adds a tab named YYYY-MM-DD.
 * Tabs older than 30 days are automatically deleted.
 *
 * Schedule: run setupBackupTrigger() once to install a daily 2 AM trigger.
 */
function backupFleetData() {
  const config = cfg();
  const ss     = SpreadsheetApp.getActiveSpreadsheet();
  const source = ss.getSheetByName(config.sheet);
  if (!source) throw new Error("Fleet Data sheet not found — cannot back up.");

  // Get or create the backup spreadsheet
  const props   = PropertiesService.getScriptProperties();
  let   backupId = props.getProperty("BACKUP_SHEET_ID");
  let   backupSS;

  if (backupId) {
    try {
      backupSS = SpreadsheetApp.openById(backupId);
    } catch (_) {
      backupId = null; // file was deleted — recreate
    }
  }
  if (!backupId) {
    backupSS = SpreadsheetApp.create("Fleet Data — Backups");
    props.setProperty("BACKUP_SHEET_ID", backupSS.getId());
    Logger.log("Created backup spreadsheet: " + backupSS.getUrl());
  }

  // Tab name = today's date
  const today   = formatDate(new Date());
  const existing = backupSS.getSheetByName(today);
  if (existing) {
    Logger.log("Backup for " + today + " already exists — skipping.");
    return;
  }

  // Copy values (not formulas) into a new tab
  const numRows = source.getLastRow();
  const numCols = source.getLastColumn();
  const data    = source.getRange(1, 1, numRows, numCols).getValues();
  const tab     = backupSS.insertSheet(today);
  tab.getRange(1, 1, numRows, numCols).setValues(data);
  Logger.log("Backup complete: " + numRows + " rows saved to tab '" + today + "'.");

  // Delete tabs older than 30 days
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 30);
  backupSS.getSheets().forEach(function(s) {
    const name = s.getName();
    if (/^\d{4}-\d{2}-\d{2}$/.test(name) && new Date(name) < cutoff) {
      backupSS.deleteSheet(s);
      Logger.log("Deleted old backup tab: " + name);
    }
  });
}

/**
 * Run ONCE to install a daily 2 AM backup trigger.
 * Re-running is safe — removes any existing backup trigger first.
 */
function setupBackupTrigger() {
  ScriptApp.getProjectTriggers().forEach(function(t) {
    if (t.getHandlerFunction() === "backupFleetData") ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger("backupFleetData")
    .timeBased()
    .everyDays(1)
    .atHour(2)
    .create();
  Logger.log("✓ Daily backup trigger installed — runs every day at 2 AM.");
  Logger.log("Run backupFleetData() now to create the first backup immediately.");
}

// ─── Debug helpers ────────────────────────────────────────────────────────────
/** Run this manually to see exactly what headers the script is reading. */
function debugHeaders() {
  const config = cfg();
  const sheet  = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(config.sheet);
  if (!sheet) { Logger.log("Sheet not found: " + config.sheet); return; }
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0]
                    .map(h => String(h).trim().toLowerCase());
  Logger.log("Raw headers: " + JSON.stringify(headers));
  try {
    const col = resolveColumns(headers);
    Logger.log("Resolved columns: " + JSON.stringify(col));
  } catch (e) {
    Logger.log("ERROR: " + e.message);
  }
}

/** Run this to check which triggers are currently installed. */
function debugTriggers() {
  const triggers = ScriptApp.getProjectTriggers();
  if (triggers.length === 0) { Logger.log("No triggers installed."); return; }
  triggers.forEach(t => Logger.log(
    `Trigger: ${t.getHandlerFunction()} | type: ${t.getEventType()} | source: ${t.getTriggerSource()}`
  ));
}

// ─── Trigger setup ────────────────────────────────────────────────────────────
/**
 * Run ONCE (or again to update). Cleans up stale triggers (old and new handler
 * names) before installing the fresh one.
 */
function setupTrigger() {
  ScriptApp.getProjectTriggers().forEach(function(t) {
    const fn = t.getHandlerFunction();
    if (fn === "onEditSync" || fn === "syncFleetToSupabase") ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger("onEditSync")
    .forSpreadsheet(SpreadsheetApp.getActiveSpreadsheet())
    .onEdit()
    .create();
  Logger.log("✓ Trigger installed. Run rebuildFleetFromSheet() once to backfill the DB from the current sheet state.");
}

// ─── Low-level helpers ────────────────────────────────────────────────────────
function buildHeaders(key) {
  return { "apikey": key, "Authorization": "Bearer " + key, "Content-Type": "application/json" };
}

function formatDate(raw) {
  if (raw instanceof Date) {
    return raw.getFullYear() + "-" +
           String(raw.getMonth() + 1).padStart(2, "0") + "-" +
           String(raw.getDate()).padStart(2, "0");
  }
  const s = String(raw).trim();
  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(s)) {
    const [day, mon, yr] = s.split("/");
    return `${yr}-${mon.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const d = new Date(s);
  if (!isNaN(d.getTime())) {
    return d.getFullYear() + "-" +
           String(d.getMonth() + 1).padStart(2, "0") + "-" +
           String(d.getDate()).padStart(2, "0");
  }
  return null;
}

function num(v) {
  if (v === null || v === undefined || v === "") return 0;
  const n = parseFloat(String(v).replace(/,/g, ""));
  return isNaN(n) ? 0 : n;
}

function round3(v) { return Math.round(v * 1000) / 1000; }

function coerce(val, defaultVal, valid) {
  const s = String(val ?? "").trim();
  return valid.includes(s) ? s : defaultVal;
}
