/**
 * MSP Coffee — HO Fuel Stock
 * Google Apps Script: auto-sync "HO Fuel" Google Sheet → Supabase ho_fuel_log table
 *
 * SETUP (one-time):
 *  1. Open your HO Fuel Google Sheet
 *  2. Extensions → Apps Script
 *  3. Paste this entire file
 *  4. Save → select setupTrigger → Run → authorise all permissions
 *     This installs an onEdit trigger AND runs an immediate sync.
 *  5. Check Execution log — you should see sync stats.
 *
 * SHEET FORMAT:
 *   Row 1: Main headers (Date, Month, Bunk Name, Fuel, Vehicle Number,
 *           Name of the Estate, Name of the Vehicle,
 *           PURCHASE [Diesel|Petrol], ISSUED [Diesel|Petrol],
 *           STOCK [Diesel|Petrol], RATE [Diesel(₹)|Petrol(₹)],
 *           Mode of Payment & Payment By, Name of Receiver, Remarks)
 *   Row 2: Sub-headers
 *   Row 3+: Data
 */

// ─── CONFIG ───────────────────────────────────────────────────────────────────
const HO_SUPABASE_URL = "https://aeawxovvyvpcjkhyxgcq.supabase.co";
const HO_SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFlYXd4b3Z2eXZwY2praHl4Z2NxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ5NDY1MTgsImV4cCI6MjA5MDUyMjUxOH0.V8Bu91H6lidK1A4qqyPAotp7KFRaF9dm2iEFZvWxWPg";
const HO_TABLE_NAME   = "ho_fuel_log";
const HO_SHEET_NAME   = "HO Fuel";  // exact tab name — adjust if different
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Column indices (0-based, data starts at row 3):
 *  0  A  Date
 *  1  B  Month
 *  2  C  Bunk Name (source/supplier)
 *  3  D  Fuel (DIESEL / PETROL)
 *  4  E  Vehicle Number
 *  5  F  Name of the Estate
 *  6  G  Name of the Vehicle
 *  7  H  PURCHASE — Diesel (L)
 *  8  I  PURCHASE — Petrol (L)
 *  9  J  ISSUED   — Diesel (L)
 * 10  K  ISSUED   — Petrol (L)
 * 11  L  STOCK    — Diesel  (formula, skipped)
 * 12  M  STOCK    — Petrol  (formula, skipped)
 * 13  N  RATE/AMOUNT — Diesel (₹ total)
 * 14  O  RATE/AMOUNT — Petrol (₹ total)
 * 15  P  Mode of Payment & Payment By
 * 16  Q  Name of Receiver
 * 17  R  Remarks
 */

function syncHoFuelToSupabase() {
  const ss    = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(HO_SHEET_NAME);
  if (!sheet) {
    Logger.log("Sheet not found: " + HO_SHEET_NAME);
    return;
  }

  const lastRow = sheet.getLastRow();
  if (lastRow < 3) { Logger.log("No data rows found (need at least row 3)."); return; }

  // Read from row 3 onward (rows 1 + 2 are headers/sub-headers)
  const range  = sheet.getRange(3, 1, lastRow - 2, 18);
  const values = range.getValues();

  const rows    = [];
  const skipped = [];

  for (let i = 0; i < values.length; i++) {
    const row    = values[i];
    const rowNum = i + 3;

    const rawDate = row[0];
    if (!rawDate) continue;                    // blank row — skip silently
    const date = hoFormatDate(rawDate);
    if (!date) {
      skipped.push("Row " + rowNum + ": invalid date '" + rawDate + "'");
      continue;
    }

    const d     = new Date(date);
    const month = d.getMonth() + 1;
    const year  = d.getFullYear();

    const source       = String(row[2]  ?? "").trim();
    const vehicleNum   = String(row[4]  ?? "").trim();
    const estate       = String(row[5]  ?? "").trim();
    const vehicleName  = String(row[6]  ?? "").trim();
    const modePay      = String(row[15] ?? "").trim();
    const receiverName = String(row[16] ?? "").trim();
    const remarks      = String(row[17] ?? "").trim();

    const purchaseDiesel = hoNum(row[7]);
    const purchasePetrol = hoNum(row[8]);
    const issuedDiesel   = hoNum(row[9]);
    const issuedPetrol   = hoNum(row[10]);
    const amountN        = hoNum(row[13]); // Amount column N (Diesel ₹)
    const amountO        = hoNum(row[14]); // Amount column O (Petrol ₹)

    // PURCHASE rows — one per fuel type that has a quantity
    if (purchaseDiesel > 0) {
      rows.push({
        date, month, year,
        transaction_type: "PURCHASE", fuel_type: "DIESEL",
        source: source || "UNKNOWN SUPPLIER",
        vehicle_number: vehicleNum, estate, vehicle_name: vehicleName,
        qty_l: purchaseDiesel,
        amount: amountN > 0 ? amountN : amountO,
        mode_of_payment: modePay, receiver_name: receiverName, remarks,
      });
    }
    if (purchasePetrol > 0) {
      rows.push({
        date, month, year,
        transaction_type: "PURCHASE", fuel_type: "PETROL",
        source: source || "UNKNOWN SUPPLIER",
        vehicle_number: vehicleNum, estate, vehicle_name: vehicleName,
        qty_l: purchasePetrol,
        amount: amountO > 0 ? amountO : amountN,
        mode_of_payment: modePay, receiver_name: receiverName, remarks,
      });
    }

    // ISSUE rows — one per fuel type that has a quantity
    if (issuedDiesel > 0) {
      rows.push({
        date, month, year,
        transaction_type: "ISSUE", fuel_type: "DIESEL",
        source: "HO STORE",
        vehicle_number: vehicleNum, estate, vehicle_name: vehicleName,
        qty_l: issuedDiesel,
        amount: 0,
        mode_of_payment: modePay, receiver_name: receiverName, remarks,
      });
    }
    if (issuedPetrol > 0) {
      rows.push({
        date, month, year,
        transaction_type: "ISSUE", fuel_type: "PETROL",
        source: "HO STORE",
        vehicle_number: vehicleNum, estate, vehicle_name: vehicleName,
        qty_l: issuedPetrol,
        amount: 0,
        mode_of_payment: modePay, receiver_name: receiverName, remarks,
      });
    }
  }

  if (skipped.length > 0) Logger.log("Skipped rows:\n" + skipped.join("\n"));
  if (rows.length === 0) { Logger.log("No valid rows to sync."); return; }

  Logger.log(
    "Parsed " + rows.length + " transaction rows from " +
    values.length + " sheet rows."
  );

  // ── Step 1: Delete all existing rows ──────────────────────────────────────
  const delResp = UrlFetchApp.fetch(
    HO_SUPABASE_URL + "/rest/v1/" + HO_TABLE_NAME + "?id=gte.0",
    { method: "DELETE", headers: hoHeaders(), muteHttpExceptions: true }
  );
  Logger.log("DELETE status: " + delResp.getResponseCode());

  // ── Step 2: Batch insert ───────────────────────────────────────────────────
  const BATCH  = 500;
  let inserted = 0;

  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);
    const resp  = UrlFetchApp.fetch(
      HO_SUPABASE_URL + "/rest/v1/" + HO_TABLE_NAME,
      {
        method: "POST",
        headers: { ...hoHeaders(), "Prefer": "return=minimal" },
        payload: JSON.stringify(batch),
        muteHttpExceptions: true,
      }
    );
    const code = resp.getResponseCode();
    if (code >= 200 && code < 300) {
      inserted += batch.length;
    } else {
      Logger.log(
        "Batch insert error (rows " + i + "–" + (i + batch.length - 1) + "): " +
        code + " — " + resp.getContentText().slice(0, 300)
      );
    }
  }

  Logger.log("Sync complete: " + inserted + " / " + rows.length + " rows inserted.");
}

// ─── Trigger setup ────────────────────────────────────────────────────────────
function setupHoTrigger() {
  // Remove any existing triggers for this function
  ScriptApp.getProjectTriggers().forEach(function(t) {
    if (t.getHandlerFunction() === "syncHoFuelToSupabase") {
      ScriptApp.deleteTrigger(t);
    }
  });

  ScriptApp.newTrigger("syncHoFuelToSupabase")
    .forSpreadsheet(SpreadsheetApp.getActiveSpreadsheet())
    .onEdit()
    .create();

  Logger.log("✓ onEdit trigger installed — sheet syncs to Supabase on every edit.");

  // Run an immediate sync
  Logger.log("Running initial sync...");
  syncHoFuelToSupabase();
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function hoHeaders() {
  return {
    "apikey":        HO_SUPABASE_KEY,
    "Authorization": "Bearer " + HO_SUPABASE_KEY,
    "Content-Type":  "application/json",
  };
}

function hoFormatDate(raw) {
  if (raw instanceof Date) {
    const y = raw.getFullYear();
    const m = String(raw.getMonth() + 1).padStart(2, "0");
    const d = String(raw.getDate()).padStart(2, "0");
    return y + "-" + m + "-" + d;
  }
  const s = String(raw).trim();
  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(s)) {
    const parts = s.split("/");
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

function hoNum(v) {
  if (v === null || v === undefined || v === "") return 0;
  const n = parseFloat(String(v).replace(/,/g, ""));
  return isNaN(n) ? 0 : n;
}

// ─── Test helper ──────────────────────────────────────────────────────────────
function testHoSync() {
  syncHoFuelToSupabase();
}
