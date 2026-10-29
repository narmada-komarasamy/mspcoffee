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
const odometer = load('src/lib/fleet/odometer.ts');
const rows = [
  { id: 1, vehicle_id: 'TN-01-AB-1234', date: '2026-10-20', closing_km: '1200' },
  { id: 2, vehicle_id: 'TN-01-AB-1234', date: '2026-10-25', closing_km: 1300 },
  { id: 3, vehicle_id: 'TN-01-AB-1234', date: '2026-10-27', closing_km: 0 },
  { id: 4, vehicle_id: 'TN-02', date: '2026-10-24', closing_km: 8400 },
  { id: 5, vehicle_id: 'TN-01-AB-1234', date: '2026-11-01', closing_km: 1500 },
];

test('uses the most recent usable prior reading regardless of row order or registration spacing', () => {
  assert.equal(odometer.startingKmFor(rows.toReversed(), ' tn 01 ab 1234 ', '2026-10-29'), 1300);
  assert.equal(odometer.startingKmFor(rows, 'TN-02', '2026-10-29'), 8400);
});

test('backdated entries exclude the same day and future readings; missing history is zero', () => {
  assert.equal(odometer.startingKmFor(rows, 'TN-01-AB-1234', '2026-10-25'), 1200);
  assert.equal(odometer.startingKmFor(rows, 'TN-01-AB-1234', '2026-10-19'), 0);
  assert.equal(odometer.startingKmFor(rows, 'UNKNOWN', '2026-10-29'), 0);
  assert.equal(odometer.startingKmFor(rows, '', '2026-10-29'), 0);
});

// Run the actual form event handlers with synchronous state, without live data or network writes.
function formHarness(componentName, props) {
  const states = [];
  let cursor = 0;
  const react = {
    useState(initial) {
      const index = cursor++;
      if (!(index in states)) states[index] = typeof initial === 'function' ? initial() : initial;
      return [states[index], value => { states[index] = typeof value === 'function' ? value(states[index]) : value; }];
    },
    useEffect() {},
    useMemo(fn) { return fn(); },
    useRef() { return { current: null }; },
  };
  const component = load(`src/components/fleet/${componentName}.tsx`, {
    react,
    '@/lib/supabase': { supabase: {} },
    '@/lib/fleet/odometer': odometer,
    '@/lib/fleet/maintenance': load('src/lib/fleet/maintenance.ts'),
    './MaintenanceDuplicateReview': {},
    '@/lib/storage/urls': {},
  })[componentName];
  function elements(node) {
    if (Array.isArray(node)) return node.flatMap(elements);
    if (!node || typeof node !== 'object' || !node.props) return [];
    return [node, ...elements(node.props.children)];
  }
  function input(predicate) {
    cursor = 0;
    return elements(component(props)).find(node => node.type === 'input' && predicate(node.props)).props;
  }
  return {
    change(predicate, value) { input(predicate).onChange({ target: { value } }); },
    value(predicate) { return input(predicate).value; },
  };
}

for (const componentName of ['RecordModal', 'PhotoEntryModal']) {
  test(`${componentName}: vehicle selection, date changes and manual corrections update the form correctly`, () => {
    const form = formHarness(componentName, { record: null, rows, vehicles: [], onClose() {}, onSuccess() {} });
    const vehicle = p => Boolean(p.list);
    const date = p => p.type === 'date';
    const starting = p => p.id?.endsWith('starting-km');
    form.change(date, '2026-10-29');
    form.change(vehicle, 'TN-01-AB-1234');
    assert.equal(form.value(starting), 1300);
    form.change(starting, '1315');
    assert.equal(form.value(starting), 1315);
    form.change(vehicle, 'TN-02');
    assert.equal(form.value(starting), 8400);
    form.change(vehicle, 'TN-01-AB-1234');
    form.change(date, '2026-10-25');
    assert.equal(form.value(starting), 1200);
    form.change(date, '2026-10-19');
    assert.equal(form.value(starting), 0);
    form.change(vehicle, 'UNKNOWN');
    assert.equal(form.value(starting), 0);
  });
}

test('editing a saved record preserves its starting KM', () => {
  const form = formHarness('RecordModal', {
    record: { id: 99, date: '2026-10-29', vehicle_id: 'TN-01-AB-1234', starting_km: 1299, closing_km: 1350 },
    rows, vehicles: [], onClose() {}, onSuccess() {},
  });
  assert.equal(form.value(p => p.id === 'fleet-starting-km'), 1299);
  form.change(p => p.type === 'date', '2026-10-25');
  assert.equal(form.value(p => p.id === 'fleet-starting-km'), 1299);
});
