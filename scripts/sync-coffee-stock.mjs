import { createClient } from "@supabase/supabase-js";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import XLSX from "xlsx";

const DEFAULT_SHEET = "/Users/ashokrajes/Downloads/Clean coffee Sale 2024-2025.xlsx - ESTATE WISE GREEN COFFEE.csv";
const DEFAULT_SEASON = "2024-2025";

function loadEnv() {
  try {
    const env = readFileSync(resolve(".env.local"), "utf8");
    for (const line of env.split("\n")) {
      const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (!match || process.env[match[1]]) continue;
      process.env[match[1]] = match[2].replace(/^["']|["']$/g, "");
    }
  } catch {}
}

function argValue(name, fallback) {
  const prefix = `${name}=`;
  const found = process.argv.find(arg => arg.startsWith(prefix));
  return found ? found.slice(prefix.length) : fallback;
}

function n(value) {
  return Number(value) || 0;
}

function normalizeSheetLabel(value) {
  return String(value ?? "").toLowerCase().replace(/\s+/g, " ").replace(/[_/.-]+/g, " ").trim();
}

function parseSheetNumber(value) {
  const cleaned = String(value ?? "").replace(/,/g, "").replace(/[^0-9.-]/g, "").trim();
  const parsed = parseFloat(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
}

function findColumn(header, variants) {
  for (const variant of variants.map(normalizeSheetLabel)) {
    for (let i = 0; i < header.length; i++) {
      if (header[i] === variant || header[i].includes(variant)) return i;
    }
  }
  return -1;
}

function guessProcess(process, details) {
  const raw = `${process} ${details}`.toLowerCase();
  if (raw.includes("watermelon")) return "Watermelon Washed";
  if (raw.includes("washed")) return "Regular Washed";
  if (raw.includes("natural")) return "Bag Natural";
  return process || details || "Unknown";
}

function parseStockSheet(sheetPath, season) {
  const wb = XLSX.readFile(sheetPath);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
  if (!data.length) throw new Error("Sheet is empty.");

  let headerRow = data.findIndex(row => {
    const header = row.map(normalizeSheetLabel);
    return findColumn(header, ["lot", "lot no", "lot number", "garden lot", "id"]) >= 0
      && findColumn(header, ["kg", "qty", "quantity", "stock kg", "available kg", "current kg", "balance kg", "in kgs", "kgs"]) >= 0;
  });
  if (headerRow === -1) {
    headerRow = data.findIndex(row => /^\d{2,4}$/.test(String(row?.[0] ?? "").trim()));
    if (headerRow > 0) headerRow -= 1;
  }
  if (headerRow < 0) throw new Error("Could not find the stock table header.");

  const header = data[headerRow].map(normalizeSheetLabel);
  const iLot = findColumn(header, ["lot", "lot no", "lot number", "lot_no", "lot_number", "garden lot", "id"]);
  const iEstate = findColumn(header, ["estate", "garden", "estate name", "field"]);
  const iProcess = findColumn(header, ["process", "process type"]);
  const iDetails = findColumn(header, ["process details", "details", "description"]);
  const iGrade = findColumn(header, ["grade", "screen grade", "grade/size", "variety"]);
  const iScreen = findColumn(header, ["screen", "size", "screen size", "sieve"]);
  const iScore = findColumn(header, ["score", "cup score", "quality score", "cup_score"]);
  const iRate = findColumn(header, ["purchase price per kg", "price per kg", "rate per kg", "rate"]);
  let iKg = findColumn(header, ["kg", "qty", "quantity", "stock kg", "available kg", "current kg", "balance kg", "in kgs", "kgs"]);

  if (iKg === -1) {
    for (let c = 0; c < header.length; c++) {
      let numericCount = 0;
      for (let r = headerRow + 1; r < Math.min(data.length, headerRow + 30); r++) {
        const v = String(data[r]?.[c] || "").trim().replace(/,/g, "");
        if (v && !Number.isNaN(parseFloat(v))) numericCount++;
      }
      if (numericCount >= 3 && c !== iLot && c !== iScore) {
        iKg = c;
        break;
      }
    }
  }
  if (iLot === -1 || iKg === -1) throw new Error("Could not find lot and kg columns.");

  const rows = [];
  for (let r = headerRow + 1; r < data.length; r++) {
    const rawLot = String(data[r]?.[iLot] || "").trim();
    if (!rawLot || /total amount|grand total/i.test(rawLot)) continue;
    const lotMatch = rawLot.match(/\d+/);
    if (!lotMatch) continue;
    const sheetKg = parseSheetNumber(data[r]?.[iKg]);
    if (sheetKg <= 0) continue;
    rows.push({
      lot: lotMatch[0],
      estate: iEstate >= 0 ? String(data[r]?.[iEstate] || "").trim() : "",
      process: guessProcess(
        iProcess >= 0 ? String(data[r]?.[iProcess] || "").trim() : "",
        iDetails >= 0 ? String(data[r]?.[iDetails] || "").trim() : "",
      ),
      grade: iGrade >= 0 ? String(data[r]?.[iGrade] || "").trim() : "",
      screen: iScreen >= 0 ? String(data[r]?.[iScreen] || "").trim() : "",
      score: iScore >= 0 && data[r]?.[iScore] ? Number(data[r][iScore]) : null,
      sheetKg,
      ratePerKg: iRate >= 0 ? parseSheetNumber(data[r]?.[iRate]) : 0,
      season,
    });
  }
  return rows;
}

async function main() {
  loadEnv();
  const sheetPath = argValue("--sheet", DEFAULT_SHEET);
  const season = argValue("--season", DEFAULT_SEASON);
  const apply = process.argv.includes("--apply");
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;
  if (!url || !key) throw new Error("Set SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");

  const rows = parseStockSheet(sheetPath, season);
  const supabase = createClient(url, key, { auth: { persistSession: false } });
  const [{ data: greenLots, error: greenError }, { data: sales, error: salesError }] = await Promise.all([
    supabase.from("green_lots").select("*"),
    supabase.from("coffee_sales").select("*"),
  ]);
  if (greenError) throw greenError;
  if (salesError) throw salesError;

  const lotByKey = new Map();
  for (const lot of greenLots ?? []) lotByKey.set(`${lot.season ?? DEFAULT_SEASON}::${lot.lot}`, lot);

  const lotIdsWithSales = new Set();
  for (const sale of sales ?? []) {
    if (sale.status === "cancelled") continue;
    for (const id of sale.green_lot_ids ?? []) lotIdsWithSales.add(id);
    for (const allocation of Array.isArray(sale.lot_allocations) ? sale.lot_allocations : []) {
      if (allocation?.green_lot_id) lotIdsWithSales.add(allocation.green_lot_id);
    }
  }

  const sheetLots = new Set(rows.map(row => `${row.season}::${row.lot}`));
  const plan = { matched: [], added: [], updated: [], depleted: [], protected: [] };

  for (const lot of greenLots ?? []) {
    if ((lot.season ?? DEFAULT_SEASON) !== season || lot.status !== "in-stock") continue;
    if (sheetLots.has(`${season}::${lot.lot}`)) continue;
    if (lotIdsWithSales.has(lot.id)) plan.protected.push(lot);
    else plan.depleted.push(lot);
  }

  for (const row of rows) {
    const lot = lotByKey.get(`${row.season}::${row.lot}`);
    if (!lot) {
      plan.added.push(row);
      continue;
    }
    const nextCurrentKg = Math.min(row.sheetKg, n(lot.green_kg_in) || row.sheetKg);
    const changed = n(lot.current_kg) !== nextCurrentKg
      || (row.estate && lot.field !== row.estate)
      || (row.process && lot.process !== row.process)
      || (row.grade && lot.grade !== row.grade)
      || (row.screen && lot.screen !== row.screen)
      || (row.ratePerKg > 0 && n(lot.rate_per_kg) !== row.ratePerKg);
    (changed ? plan.updated : plan.matched).push({ ...row, id: lot.id, nextCurrentKg, greenKgIn: n(lot.green_kg_in) });
  }

  console.log(`Parsed ${rows.length} sheet lots for ${season}.`);
  console.log(`Plan: ${plan.added.length} add, ${plan.updated.length} update, ${plan.depleted.length} deplete, ${plan.matched.length} unchanged, ${plan.protected.length} protected.`);
  console.log(`Sheet total: ${Math.round(rows.reduce((sum, row) => sum + row.sheetKg, 0)).toLocaleString("en-IN")} kg`);
  console.log(`Sheet value: INR ${Math.round(rows.reduce((sum, row) => sum + row.sheetKg * row.ratePerKg, 0)).toLocaleString("en-IN")}`);
  if (plan.protected.length) console.log(`Protected lots: ${plan.protected.map(lot => lot.lot).join(", ")}`);

  if (!apply) {
    console.log("Dry run only. Re-run with --apply to write changes.");
    return;
  }

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupPath = resolve(`backups/coffee-storage-sync-${stamp}.json`);
  mkdirSync(dirname(backupPath), { recursive: true });
  writeFileSync(backupPath, JSON.stringify({ greenLots, sales }, null, 2));
  console.log(`Backup written: ${backupPath}`);

  let ok = 0;
  const errors = [];
  for (const lot of plan.depleted) {
    const { error } = await supabase.from("green_lots").update({ current_kg: 0, status: "depleted" }).eq("id", lot.id);
    if (error) errors.push(`Deplete ${lot.lot}: ${error.message}`);
    else ok++;
  }
  for (const row of plan.added) {
    const id = `G-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const { error } = await supabase.from("green_lots").insert({
      id,
      lot: row.lot,
      derived_from: [],
      green_kg_in: row.sheetKg,
      current_kg: row.sheetKg,
      rate_per_kg: row.ratePerKg,
      process: row.process || "Unknown",
      field: row.estate || "Unknown",
      grade: row.grade || "",
      screen: row.screen || "",
      score: row.score,
      milled_date: new Date().toISOString().slice(0, 10),
      warehouse: "",
      status: "in-stock",
      season: row.season,
    });
    if (error) errors.push(`Add ${row.lot}: ${error.message}`);
    else ok++;
  }
  for (const row of plan.updated) {
    const patch = {
      current_kg: row.nextCurrentKg,
      status: row.nextCurrentKg <= 0 ? "depleted" : "in-stock",
    };
    if (row.process) patch.process = row.process;
    if (row.estate) patch.field = row.estate;
    if (row.grade) patch.grade = row.grade;
    if (row.screen) patch.screen = row.screen;
    if (row.score !== null) patch.score = row.score;
    if (row.ratePerKg > 0) patch.rate_per_kg = row.ratePerKg;
    const { error } = await supabase.from("green_lots").update(patch).eq("id", row.id);
    if (error) errors.push(`Update ${row.lot}: ${error.message}`);
    else ok++;
  }
  console.log(`Applied ${ok} changes with ${errors.length} error(s).`);
  if (errors.length) {
    for (const error of errors) console.error(error);
    process.exitCode = 1;
  }
}

main().catch(error => {
  console.error(error.message || error);
  process.exit(1);
});
