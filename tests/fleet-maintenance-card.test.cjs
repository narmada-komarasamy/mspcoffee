/* eslint-disable @typescript-eslint/no-require-imports */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');

function load(path, mocks = {}) {
  const code = ts.transpileModule(fs.readFileSync(path, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const fixtureModule = { exports: {} };
  new Function('require', 'module', 'exports', code)(name => name in mocks ? mocks[name] : require(name), fixtureModule, fixtureModule.exports);
  return fixtureModule.exports;
}
const helpers = load('src/lib/fleet/maintenance.ts');
const urls = load('src/lib/storage/urls.ts');
const css = { __esModule: true, default: new Proxy({}, { get: (_, name) => String(name) }) };
const base = { vehicle_id: 'TN 54 M 6336', date: '2026-09-10', maint_cost: 0, maintenance_performed: '', fuel_cost: 0, fuel_filled_l: 0, starting_km: 1, closing_km: 2, km_run: 1, vehicle_type: 'Estate', account: 'ME', fuel_type: 'Diesel' };
const rows = [
  { ...base, id: 1, maint_cost: 30000, maintenance_vendor: 'Workshop A', maintenance_performed: 'Brake pads', maintenance_bill_path: 'first/bill.pdf' },
  { ...base, id: 2, date: '2026-09-20', maint_cost: '4762', maintenance_vendor: 'Workshop B' },
  { ...base, id: 3, fuel_cost: 2000 },
];
function nodes(node) {
  if (Array.isArray(node)) return node.flatMap(nodes);
  if (!node || typeof node !== 'object' || !node.props) return [];
  return [node, ...nodes(node.props.children)];
}
function text(node) {
  if (Array.isArray(node)) return node.map(text).join('');
  if (node == null || typeof node === 'boolean') return '';
  return typeof node === 'object' ? text(node.props?.children) : String(node);
}
function reactHarness(seed) {
  const states = [];
  let cursor = 0, ids = 0;
  const react = {
    useState(initial) { const index = cursor++; if (!(index in states)) states[index] = seed ? seed(index, initial) : (typeof initial === 'function' ? initial() : initial); return [states[index], value => { states[index] = typeof value === 'function' ? value(states[index]) : value; }]; },
    useEffect() {}, useRef() { return { current: null }; }, useId() { return `id-${ids++}`; },
    useMemo(fn) { return fn(); }, useCallback(fn) { return fn; },
  };
  return { react, reset() { cursor = 0; } };
}
function cardHarness(records) {
  const hooks = reactHarness();
  const { MaintenanceCostCard } = load('src/components/fleet/MaintenanceCostCard.tsx', {
    react: hooks.react, '@/lib/fleet/maintenance': helpers, '@/lib/storage/urls': urls,
    './MaintenanceCostCard.module.css': css,
  });
  let edited;
  const props = { rows: records, total: records.reduce((sum, row) => sum + Number(row.maint_cost), 0), selection: 'TN 54 M 6336 · Sep · 2026', className: 'kpiCard', style: {}, children: 'Maintenance Cost', onEdit: row => { edited = row; } };
  const render = () => { hooks.reset(); return MaintenanceCostCard(props); };
  return { render, edited: () => edited, dialog: () => {
    const component = nodes(render()).find(node => typeof node.type === 'function');
    return component.type(component.props);
  } };
}

test('maintenance list reconciles the full cost, retains missing attachments and excludes fuel-only entries', () => {
  const entries = helpers.maintenanceEntries(rows);
  assert.deepEqual(entries.map(row => row.id), [2, 1]);
  assert.equal(entries.reduce((total, row) => total + Number(row.maint_cost), 0), 34762);
  assert.deepEqual(rows.map(row => row.id), [1, 2, 3]);
  assert.equal(helpers.singleMaintenanceBillPath(rows), '');
  assert.equal(helpers.singleMaintenanceBillPath([rows[0], rows[2]]), 'first/bill.pdf');
});

test('one attached maintenance entry opens the authenticated original directly in a new tab', () => {
  const harness = cardHarness([rows[0], rows[2]]);
  const anchor = nodes(harness.render()).find(node => node.type === 'a');
  assert.equal(anchor.props.target, '_blank');
  assert.equal(anchor.props.rel, 'noopener noreferrer');
  const url = new URL(anchor.props.href, 'https://example.com');
  assert.equal(url.pathname, '/api/storage/signed-url');
  assert.equal(url.searchParams.get('bucket'), 'fleet-maintenance-bills');
  assert.equal(url.searchParams.get('path'), 'first/bill.pdf');
});

test('multiple entries show dates, workshops, amounts, bill links and no-bill labels; Add bill edits the right record', () => {
  const harness = cardHarness(rows);
  const button = nodes(harness.render()).find(node => node.type === 'button');
  assert.equal(button.props['aria-haspopup'], 'dialog');
  button.props.onClick();
  const dialog = harness.dialog();
  const content = text(dialog);
  for (const value of ['34,762.00', 'Workshop A', 'Workshop B', 'No bill uploaded', 'Brake pads', '2 maintenance entries', '1 bill attached']) assert.ok(content.includes(value), value);
  const links = nodes(dialog).filter(node => node.type === 'a');
  assert.equal(links.length, 1);
  const addBill = nodes(dialog).find(node => node.type === 'button' && text(node) === 'Add bill');
  addBill.props.onClick();
  assert.equal(harness.edited().id, 2);
  assert.equal(nodes(harness.render()).some(node => typeof node.type === 'function'), false);
});

test('single missing bill and empty periods open the list; Escape closes the dialog', () => {
  for (const records of [[rows[1]], []]) {
    const harness = cardHarness(records);
    nodes(harness.render()).find(node => node.type === 'button').props.onClick();
    const dialog = harness.dialog();
    assert.ok(text(dialog).includes(records.length ? 'No bill uploaded' : 'No maintenance entries'));
    let prevented = false;
    dialog.props.onCancel({ preventDefault() { prevented = true; } });
    assert.equal(prevented, true);
    assert.equal(nodes(harness.render()).some(node => typeof node.type === 'function'), false);
  }
});

test('spotlight card receives exactly the selected vehicle, year and month rows and matching total', () => {
  const fixtures = [...rows,
    { ...base, id: 4, vehicle_id: 'OTHER', maint_cost: 9000 },
    { ...base, id: 5, date: '2026-08-15', maint_cost: 8000 },
    { ...base, id: 6, date: '2025-09-15', maint_cost: 7000 },
  ];
  const hooks = reactHarness((index, initial) => index === 0 ? fixtures : index === 1 ? false : (typeof initial === 'function' ? initial() : initial));
  const Card = () => null;
  const Page = load('src/app/(dashboard)/fuel-expenses/page.tsx', {
    react: hooks.react,
    '@/lib/supabase': { supabase: {} },
    '@/lib/fleet/maintenance': helpers, '@/lib/storage/urls': urls,
    './fleet.module.css': css,
    '@/components/fleet/UploadModal': {}, '@/components/fleet/RecordModal': {}, '@/components/fleet/PhotoEntryModal': {},
    '@/components/fleet/MaintenanceCostCard': { MaintenanceCostCard: Card },
  }).default;
  const render = () => { hooks.reset(); return Page(); };
  function change(label, value) {
    const group = nodes(render()).find(node => node.props.className === 'ctrlGroup' && text(node.props.children[0]) === label);
    assert.ok(group, label);
    nodes(group).find(node => node.type === 'select').props.onChange({ target: { value } });
  }
  change('Select Vehicle', 'TN 54 M 6336'); change('Year', '2026'); change('Month', 'Sep');
  const card = nodes(render()).find(node => node.type === Card);
  assert.deepEqual(card.props.rows.map(row => row.id), [1, 2, 3]);
  assert.equal(card.props.total, 34762);
  assert.equal(card.props.selection, 'TN 54 M 6336 · Sep · 2026');
});
