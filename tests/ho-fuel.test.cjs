/* eslint-disable @typescript-eslint/no-require-imports */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const ts = require('typescript');
const fs = require('node:fs');
const mod = { exports: {} };
new Function('module', 'exports', ts.transpileModule(fs.readFileSync('src/lib/ho-fuel.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText)(mod, mod.exports);
const { fuelPeriod, currentFuelRows, fuelTotals, hoFuelToday } = mod.exports;
test('month follows transaction date including month boundaries', () => {
  assert.deepEqual(fuelPeriod('2026-04-01'), { year: 2026, month: 4 });
  assert.deepEqual(fuelPeriod('2027-01-01'), { year: 2027, month: 1 });
  assert.match(hoFuelToday(), /^\d{4}-\d{2}-\d{2}$/);
});
test('future purchases cannot inflate current stock; each fuel reconciles separately', () => {
  const rows = [
    { date:'2026-11-01', transaction_type:'PURCHASE', fuel_type:'DIESEL', qty_l:'100', amount:'9000' },
    { date:'2026-11-09', transaction_type:'ISSUE', fuel_type:'DIESEL', qty_l:20, amount:0 },
    { date:'2026-11-09', transaction_type:'PURCHASE', fuel_type:'PETROL', qty_l:10, amount:1000 },
    { date:'2026-12-04', transaction_type:'PURCHASE', fuel_type:'DIESEL', qty_l:200, amount:19000 },
  ];
  const totals = fuelTotals(currentFuelRows(rows, '2026-11-09'));
  assert.equal(totals.dieselStock, 80);
  assert.equal(totals.petrolStock, 10);
  assert.equal(totals.totalPurchased, 110);
  assert.equal(totals.amt, 10000);
  assert.equal(rows.length, 4);
});
