/**
 * MSP Coffee — Fleet Fuel Expenses
 * Google Apps Script: auto-sync Google Sheet → Supabase fleet_daily table
 *
 * SETUP (one-time):
 *  1. Open your Fleet Expenses Google Sheet
 *  2. Extensions → Apps Script
 *  3. Paste this entire file (constants already filled in below)
 *  4. Save → select setupTrigger → Run → authorise all permissions
 *     This installs an onEdit trigger so the sheet syncs to Supabase
 *     instantly every time a cell is changed.
 *  5. Verify: select testSync → Run and check Execution log.
 *
 * SHEET FORMAT (first row = headers, data from row 2):
 *   Date | Vehicle ID | Vehicle Type | Account | Fuel Type |
 *   Starting KM | Closing KM | Fuel Filled (L) | Fuel Cost |
 *   Maint Cost | Maintenance Performed | Remarks
 */

// ─── CONFIG ───────────────────────────────────────────────────────────────────
const SUPABASE_URL = "https://aeawxovvyvpcjkhyxgcq.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFlYXd4b3Z2eXZwY2praHl4Z2NxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ5NDY1MTgsImV4cCI6MjA5MDUyMjUxOH0.V8Bu91H6lidK1A4qqyPAotp7KFRaF9dm2iEFZvWxWPg";
const TABLE_NAME   = "fleet_daily";
const SHEET_NAME   = "Fleet Data";  // exact tab name in your Sheet
// ─────────────────────────────────────────────────────────────────────────────

const VALID_ACCOUNTS      = ["BVE", "HFE", "ME", "ORE", "RSE", "SE"];
const VALID_VEHICLE_TYPES = ["Estate", "Personal"];
const VALID_FUEL_TYPES    = ["Diesel", "Petrol"];

function syncFleetToSupabase() {
  const ss    = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    Logger.log("Sheet not found: " + SHEET_NAME);
    return;
  }

  const lastRow = sheet.getLastRow();
  if (lastRow < 2) { Logger.log("No data rows found."); return; }

  const range   = sheet.getRange(1, 1, lastRow, sheet.getLastColumn());
  const values  = range.getValues();
  const headers = values[0].map(h => String(h).trim().toLowerCase());

  // ── Header index map ───────────────────────────────────────────────────────
  const col = {
    date:                  findCol(headers, ["date"]),
    vehicle_id:            findCol(headers, ["vehicle id", "vehicle"]),
    vehicle_type:          findCol(headers, ["vehicle type", "type"]),
    account:               findCol(headers, ["account"]),
    fuel_type:             findCol(headers, ["fuel type", "fuel category", "fuel"]),
    starting_km:           findCol(headers, ["starting km", "start km", "opening km"]),
    closing_km:            findCol(headers, ["closing km", "close km", "ending km"]),
    fuel_filled_l:         findCol(headers, ["fuel filled (l)", "fuel filled", "litres", "liters"]),
    fuel_cost:             findCol(headers, ["fuel cost (₹)", "fuel cost(₹)", "fuel cost", "fuel expense", "fuel amount", "fuel amt", "fuel charges", "fuel (₹)", "fuel(₹)", "cost of fuel", "petrol cost", "diesel cost", "petrol/diesel cost"]),
    maint_cost:            findCol(headers, ["maint cost (₹)", "maint cost(₹)", "maint cost", "maintenance cost (₹)", "maintenance cost(₹)", "maintenance cost", "maintenance", "maint", "maintenance charges", "maintenance amt", "maintenance amount", "repair cost", "service cost", "maint charges", "maint amt", "maintenance expense"]),
    maintenance_performed: findCol(headers, ["maintenance performed", "maint performed", "work done"]),
    remarks:               findCol(headers, ["remarks", "notes"]),
  };

  // ── Warn on undetected cost columns ───────────────────────────────────────
  if (col.fuel_cost === -1)  Logger.log("⚠️  WARNING: 'Fuel Cost' column not found. Headers detected: " + headers.join(" | "));
  if (col.maint_cost === -1) Logger.log("⚠️  WARNING: 'Maint Cost' column not found. Headers detected: " + headers.join(" | "));

  const rows    = [];
  const skipped = [];

  for (let i = 1; i < values.length; i++) {
    const row    = values[i];
    const rowNum = i + 1;

    const rawDate = row[col.date];
    if (!rawDate) continue; // skip empty rows silently
    const date = formatDate(rawDate);
    if (!date) { skipped.push("Row " + rowNum + ": invalid date '" + rawDate + "'"); continue; }

    const vehicle_id = String(row[col.vehicle_id] ?? "").trim();
    if (!vehicle_id) { skipped.push("Row " + rowNum + ": missing Vehicle ID"); continue; }

    const vehicle_type    = coerce(row[col.vehicle_type], "Estate", VALID_VEHICLE_TYPES);
    const account         = coerce(row[col.account],      "BVE",    VALID_ACCOUNTS);
    const fuel_type       = coerce(row[col.fuel_type],    "Diesel", VALID_FUEL_TYPES);
    const starting_km     = num(row[col.starting_km]);
    const closing_km      = num(row[col.closing_km]);
    const km_run          = Math.max(0, closing_km - starting_km);
    const fuel_filled_l   = num(row[col.fuel_filled_l]);
    const fuel_cost       = num(row[col.fuel_cost]);
    const maint_cost      = num(row[col.maint_cost]);
    const total_cost      = fuel_cost + maint_cost;
    const avg_mileage     = fuel_filled_l > 0 ? round3(km_run / fuel_filled_l) : 0;
    const cost_per_km     = km_run > 0 ? round3(total_cost / km_run) : 0;
    const maintenance_performed = String(row[col.maintenance_performed] ?? "").trim();
    const remarks               = String(row[col.remarks]               ?? "").trim();

    const d     = new Date(date);
    const month = d.getMonth() + 1;
    const year  = d.getFullYear();

    rows.push({
      date, month, year, vehicle_id, vehicle_type, account, fuel_type,
      starting_km, closing_km, km_run, fuel_filled_l, fuel_cost, maint_cost,
      total_cost, avg_mileage, cost_per_km, maintenance_performed, remarks,
    });
  }

  if (skipped.length > 0) Logger.log("Skipped rows:\n" + skipped.join("\n"));
  if (rows.length === 0) { Logger.log("No valid rows to sync."); return; }

  // ── Deduplicate: keep last occurrence of each date + vehicle_id ───────────
  const seen = new Map();
  for (const row of rows) {
    seen.set(row.date + "|" + row.vehicle_id, row);
  }
  const dedupedRows = Array.from(seen.values());
  Logger.log(
    "Parsed " + rows.length + " rows → " + dedupedRows.length +
    " unique after dedup (removed " + (rows.length - dedupedRows.length) + " duplicates)"
  );

  // ── Upsert in batches (no delete — keeps the table live during sync) ────────
  // Conflict target: date + vehicle_id (unique constraint in DB)
  const BATCH  = 500;
  let upserted = 0;

  for (let i = 0; i < dedupedRows.length; i += BATCH) {
    const batch = dedupedRows.slice(i, i + BATCH);
    const resp  = UrlFetchApp.fetch(
      SUPABASE_URL + "/rest/v1/" + TABLE_NAME + "?on_conflict=date,vehicle_id",
      {
        method: "POST",
        headers: {
          ...buildHeaders(),
          "Prefer": "resolution=merge-duplicates,return=minimal",
        },
        payload: JSON.stringify(batch),
        muteHttpExceptions: true,
      }
    );
    const code = resp.getResponseCode();
    if (code >= 200 && code < 300) {
      upserted += batch.length;
    } else {
      Logger.log(
        "Batch upsert error (rows " + i + "–" + (i + batch.length - 1) + "): " +
        code + " — " + resp.getContentText().slice(0, 300)
      );
    }
  }

  Logger.log("Sync complete: " + upserted + " / " + dedupedRows.length + " rows upserted.");
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildHeaders() {
  return {
    "apikey":        SUPABASE_KEY,
    "Authorization": "Bearer " + SUPABASE_KEY,
    "Content-Type":  "application/json",
  };
}

function findCol(headers, candidates) {
  for (const c of candidates) {
    const idx = headers.indexOf(c);
    if (idx !== -1) return idx;
  }
  return -1;
}

function formatDate(raw) {
  if (raw instanceof Date) {
    const y = raw.getFullYear();
    const m = String(raw.getMonth() + 1).padStart(2, "0");
    const d = String(raw.getDate()).padStart(2, "0");
    return y + "-" + m + "-" + d;
  }
  const s = String(raw).trim();
  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(s)) {
    const parts = s.split("/");
    // DD/MM/YYYY (Indian format)
    return parts[2] + "-" + parts[1].padStart(2, "0") + "-" + parts[0].padStart(2, "0");
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

function round3(v) {
  return Math.round(v * 1000) / 1000;
}

function coerce(val, defaultVal, valid) {
  const s = String(val ?? "").trim();
  return valid.includes(s) ? s : defaultVal;
}

// ─── Trigger setup ────────────────────────────────────────────────────────────
/**
 * Run this ONCE to install an onEdit trigger.
 * After that, every cell edit in the sheet fires syncFleetToSupabase instantly.
 * Re-running it is safe — it removes old triggers first to avoid duplicates.
 */
function setupTrigger() {
  // Remove any existing fleet sync triggers to avoid duplicates
  ScriptApp.getProjectTriggers().forEach(function(t) {
    if (t.getHandlerFunction() === "syncFleetToSupabase") {
      ScriptApp.deleteTrigger(t);
    }
  });

  // Install onEdit installable trigger (fires on any cell change)
  ScriptApp.newTrigger("syncFleetToSupabase")
    .forSpreadsheet(SpreadsheetApp.getActiveSpreadsheet())
    .onEdit()
    .create();

  Logger.log("✓ onEdit trigger installed — sheet will now sync to Supabase instantly on every edit.");

  // Run an immediate sync so data is up to date right now
  Logger.log("Running initial sync...");
  syncFleetToSupabase();
}

// ─── Test helper ──────────────────────────────────────────────────────────────
function testSync() {
  syncFleetToSupabase();
}

// ─── Diagnose headers ─────────────────────────────────────────────────────────
/**
 * Run this to see exactly what headers your sheet has and which columns
 * the script found. Useful for debugging missing cost data.
 */
function diagnoseHeaders() {
  const ss      = SpreadsheetApp.getActiveSpreadsheet();
  const sheet   = ss.getSheetByName(SHEET_NAME);
  if (!sheet) { Logger.log("Sheet not found: " + SHEET_NAME); return; }

  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn())
                       .getValues()[0]
                       .map(h => String(h).trim());

  Logger.log("=== RAW HEADERS (as seen in row 1) ===");
  headers.forEach(function(h, i) {
    Logger.log("  Col " + (i + 1) + ": \"" + h + "\"");
  });

  const lc = headers.map(h => h.toLowerCase());

  const checks = {
    fuel_cost:  findCol(lc, ["fuel cost (₹)", "fuel cost(₹)", "fuel cost", "fuel expense", "fuel amount", "fuel amt", "fuel charges", "fuel (₹)", "fuel(₹)", "cost of fuel", "petrol cost", "diesel cost", "petrol/diesel cost"]),
    maint_cost: findCol(lc, ["maint cost (₹)", "maint cost(₹)", "maint cost", "maintenance cost (₹)", "maintenance cost(₹)", "maintenance cost", "maintenance", "maint", "maintenance charges", "maintenance amt", "maintenance amount", "repair cost", "service cost", "maint charges", "maint amt", "maintenance expense"]),
  };

  Logger.log("\n=== COST COLUMN DETECTION ===");
  for (var key in checks) {
    var idx = checks[key];
    if (idx === -1) {
      Logger.log("  ❌ " + key + " → NOT FOUND (column will be 0)");
    } else {
      Logger.log("  ✅ " + key + " → found at Col " + (idx + 1) + ": \"" + headers[idx] + "\"");
    }
  }
  Logger.log("\nIf a column shows NOT FOUND, rename that column header in the sheet to match one of the expected names listed in fleet_apps_script.js, then run testSync().");
}
