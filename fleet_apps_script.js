/**
 * MSP Coffee — Fleet Fuel Expenses
 * Google Apps Script: auto-sync Google Sheet → Supabase fleet_daily table
 *
 * SETUP:
 *  1. Open your Fleet Expenses Google Sheet
 *  2. Extensions → Apps Script
 *  3. Paste this entire file, replace the constants below
 *  4. Save → Run → authorise
 *  5. Add a trigger: Triggers (clock icon) → Add Trigger
 *     - Function: syncFleetToSupabase
 *     - Event source: Time-driven
 *     - Type: Hour timer → Every hour  (or "From spreadsheet → On edit" for instant sync)
 *
 * SHEET FORMAT (first row = headers, data from row 2):
 *   Date | Vehicle ID | Vehicle Type | Account | Fuel Type |
 *   Starting KM | Closing KM | Fuel Filled (L) | Fuel Cost |
 *   Maint Cost | Maintenance Performed | Remarks
 *
 *  (KM Run, Total Cost, Avg Mileage, Cost/KM are computed here in the script)
 */

// ─── CONFIG ──────────────────────────────────────────────────────────────────
const SUPABASE_URL  = "https://YOUR_PROJECT_REF.supabase.co";
const SUPABASE_KEY  = "YOUR_SUPABASE_ANON_KEY";   // Settings → API → anon key
const TABLE_NAME    = "fleet_daily";
const SHEET_NAME    = "Fleet Data";                // exact tab name in your Sheet
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

  const range  = sheet.getRange(1, 1, lastRow, sheet.getLastColumn());
  const values = range.getValues();
  const headers = values[0].map(h => String(h).trim().toLowerCase());

  // ── Header index map ───────────────────────────────────────────────────────
  const col = {
    date:                  findCol(headers, ["date"]),
    vehicle_id:            findCol(headers, ["vehicle id", "vehicle"]),
    vehicle_type:          findCol(headers, ["vehicle type", "type"]),
    account:               findCol(headers, ["account"]),
    fuel_type:             findCol(headers, ["fuel type", "fuel"]),
    starting_km:           findCol(headers, ["starting km", "start km", "opening km"]),
    closing_km:            findCol(headers, ["closing km", "close km", "ending km"]),
    fuel_filled_l:         findCol(headers, ["fuel filled (l)", "fuel filled", "litres", "liters"]),
    fuel_cost:             findCol(headers, ["fuel cost", "fuel expense"]),
    maint_cost:            findCol(headers, ["maint cost", "maintenance cost", "maintenance"]),
    maintenance_performed: findCol(headers, ["maintenance performed", "maint performed", "work done"]),
    remarks:               findCol(headers, ["remarks", "notes"]),
  };

  const rows = [];
  const skipped = [];

  for (let i = 1; i < values.length; i++) {
    const row = values[i];
    const rowNum = i + 1;

    // Date
    const rawDate = row[col.date];
    if (!rawDate) continue;  // skip empty rows silently
    const date = formatDate(rawDate);
    if (!date) { skipped.push("Row " + rowNum + ": invalid date '" + rawDate + "'"); continue; }

    // Vehicle ID
    const vehicle_id = String(row[col.vehicle_id] ?? "").trim();
    if (!vehicle_id) { skipped.push("Row " + rowNum + ": missing Vehicle ID"); continue; }

    // Coerce and validate
    const vehicle_type    = coerce(row[col.vehicle_type], "Estate",  VALID_VEHICLE_TYPES);
    const account         = coerce(row[col.account],      "BVE",     VALID_ACCOUNTS);
    const fuel_type       = coerce(row[col.fuel_type],    "Diesel",  VALID_FUEL_TYPES);
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

  Logger.log("Syncing " + rows.length + " rows to Supabase…");

  // ── Step 1: Delete all existing rows ──────────────────────────────────────
  const delResp = UrlFetchApp.fetch(
    SUPABASE_URL + "/rest/v1/" + TABLE_NAME + "?id=gte.0",
    {
      method: "DELETE",
      headers: buildHeaders(),
      muteHttpExceptions: true,
    }
  );
  Logger.log("DELETE status: " + delResp.getResponseCode());

  // ── Step 2: Batch insert ───────────────────────────────────────────────────
  const BATCH = 500;
  let inserted = 0;

  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);
    const resp = UrlFetchApp.fetch(
      SUPABASE_URL + "/rest/v1/" + TABLE_NAME,
      {
        method: "POST",
        headers: {
          ...buildHeaders(),
          "Prefer": "return=minimal",
        },
        payload: JSON.stringify(batch),
        muteHttpExceptions: true,
      }
    );
    const code = resp.getResponseCode();
    if (code >= 200 && code < 300) {
      inserted += batch.length;
    } else {
      Logger.log("Batch insert error (rows " + i + "–" + (i + batch.length - 1) + "): " +
                 code + " — " + resp.getContentText().slice(0, 300));
    }
  }

  Logger.log("Sync complete: " + inserted + " / " + rows.length + " rows inserted.");
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
  // DD/MM/YYYY or MM/DD/YYYY
  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(s)) {
    const parts = s.split("/");
    // Assume DD/MM/YYYY (Indian format)
    return parts[2] + "-" + parts[1].padStart(2,"0") + "-" + parts[0].padStart(2,"0");
  }
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const d = new Date(s);
  if (!isNaN(d.getTime())) {
    return d.getFullYear() + "-" +
           String(d.getMonth()+1).padStart(2,"0") + "-" +
           String(d.getDate()).padStart(2,"0");
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

// ─── Test helper: run manually to verify one sync ─────────────────────────────
function testSync() {
  syncFleetToSupabase();
}
