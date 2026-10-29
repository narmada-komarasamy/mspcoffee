/* eslint-disable @typescript-eslint/no-require-imports */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const crypto = require('node:crypto');
function load(path, mocks = {}) {
  const code = ts.transpileModule(fs.readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const fixtureModule = { exports: {} };
  new Function('require', 'module', 'exports', code)(name => name in mocks ? mocks[name] : require(name), fixtureModule, fixtureModule.exports);
  return fixtureModule.exports;
}
const helpers = load('src/lib/fleet/maintenance.ts');
const server = load('src/lib/fleet/maintenance-server.ts', { 'server-only': {}, './maintenance': helpers });
const urls = load('src/lib/storage/urls.ts');
const file = () => new File(['%PDF-1.4 same bytes'], 'renamed.pdf', { type: 'application/pdf' });
const existing = { id: 10, date: '2026-09-17', vehicle_id: 'TN 54 M 6336', vehicle_type: 'Estate', account: 'BVE', fuel_type: 'Diesel', maint_cost: 34362, fuel_cost: 200, fuel_filled_l: 10, starting_km: 100, closing_km: 200, maintenance_performed: 'Existing service description', remarks: 'Keep these remarks', maintenance_vendor: '', maintenance_bill_text: '', maintenance_bill_path: '', maintenance_bill_name: '' };
const extraction = { total: 34362, date: '2020-09-15', workshop: 'Workshop', maintenance_items: 'Brake service', bill_text: 'Original invoice text', notes: '' };

test('same vehicle and amount match across dates and registration formatting; unchanged edits do not create a new expense warning', () => {
  const proposed = { ...existing, id: undefined, vehicle_id: 'tn54m6336', date: '2020-09-15' };
  assert.deepEqual(helpers.possibleMaintenanceDuplicates([existing], proposed).map(r => r.id), [10]);
  assert.deepEqual(helpers.possibleMaintenanceDuplicates([existing], existing, existing), []);
  assert.deepEqual(helpers.possibleMaintenanceDuplicates([existing], { ...proposed, maint_cost: 0 }), []);
  assert.equal(helpers.validBillDate('2026-02-30'), false);
});

test('legacy attached files are fingerprinted; renaming the same bytes still finds the saved entry', async () => {
  const bytes = await file().arrayBuffer();
  const hash = server.billFingerprint(bytes);
  assert.equal(hash, crypto.createHash('sha256').update(Buffer.from(bytes)).digest('hex'));
  const records = [{ ...existing, maintenance_bill_path: 'old/original.pdf', maintenance_bill_sha256: null }];
  let downloads = 0;
  const supabase = {
    from() {
      let filters = [], patch;
      const query = {
        select() { return query; }, limit() { return query; }, order() { return query; },
        eq(key, value) { filters.push(r => r[key] === value); return query; },
        neq(key, value) { filters.push(r => r[key] !== value); return query; },
        is(key, value) { filters.push(r => r[key] === value); return query; },
        gt(key, value) { filters.push(r => r[key] > value); return query; },
        update(value) { patch = value; return query; },
        then(resolve) { const data = records.filter(r => filters.every(fn => fn(r))); if (patch) data.forEach(r => Object.assign(r, patch)); return Promise.resolve({ data, error: null }).then(resolve); },
      }; return query;
    },
    storage: { from: () => ({ download: async () => { downloads++; return { data: file(), error: null }; } }) },
  };
  assert.equal((await server.findExactBill(supabase, hash)).id, 10);
  assert.equal(records[0].maintenance_bill_sha256, hash);
  assert.equal((await server.findExactBill(supabase, hash)).id, 10);
  assert.equal(downloads, 1);
});

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
function formHarness(rows = [existing]) {
  const states = []; let cursor = 0;
  const react = {
    useState(initial) { const i = cursor++; if (!(i in states)) states[i] = typeof initial === 'function' ? initial() : initial; return [states[i], value => { states[i] = typeof value === 'function' ? value(states[i]) : value; }]; },
    useRef() { return { current: null }; }, useEffect() {},
  };
  const Review = load('src/components/fleet/MaintenanceDuplicateReview.tsx', { '@/lib/fleet/maintenance': helpers, '@/lib/storage/urls': urls }).MaintenanceDuplicateReview;
  const Modal = load('src/components/fleet/RecordModal.tsx', {
    react, '@/lib/fleet/maintenance': helpers, '@/lib/storage/urls': urls,
    '@/lib/fleet/odometer': load('src/lib/fleet/odometer.ts'),
    './MaintenanceDuplicateReview': { MaintenanceDuplicateReview: Review },
    '@/lib/supabase': { supabase: { from: () => ({ select: () => ({ eq: () => ({ single: async () => ({ data: existing, error: null }) }) }) }) } },
  }).RecordModal;
  const render = () => { cursor = 0; return Modal({ record: null, rows, vehicles: [], onClose() {}, onSuccess() {} }); };
  const input = predicate => nodes(render()).find(n => n.type === 'input' && predicate(n.props)).props;
  return { render, Review,
    change(id, value) { input(p => p.id === id).onChange({ target: { value } }); },
    vehicle(value) { input(p => p.list === 'vehicle-list').onChange({ target: { value } }); },
    input,
    review() { return nodes(render()).find(n => n.type === Review).props; },
    save() { return nodes(render()).find(n => n.type === 'button' && (text(n).includes('Add record') || text(n).includes('Attach bill to existing entry'))).props; },
    async upload() { input(p => p.type === 'file').onChange({ target: { files: [file()], value: 'file' } }); for (let i = 0; i < 4; i++) await new Promise(resolve => setImmediate(resolve)); },
  };
}

test('upload preserves the log date, shows bill date, and attaches to an existing expense without changing its fuel or cost', async () => {
  const previous = global.fetch; let saved;
  global.fetch = async (url, options) => {
    if (url.endsWith('/check')) return Response.json({ existing: null });
    if (url.endsWith('/extract')) return Response.json(extraction);
    saved = options.body; return Response.json({ ok: true });
  };
  try {
    const form = formHarness();
    form.change('fleet-log-date', '2026-10-29'); form.vehicle('TN54M6336');
    await form.upload();
    assert.equal(form.input(p => p.id === 'fleet-log-date').value, '2026-10-29');
    assert.equal(form.input(p => p.id === 'maintenance-bill-date').value, '2020-09-15');
    assert.equal(form.save().disabled, true);
    assert.equal(form.review().matches[0].id, 10);
    form.review().onSelect(10, true);
    for (let i = 0; i < 3; i++) await new Promise(resolve => setImmediate(resolve));
    assert.equal(form.input(p => p.id === 'fleet-log-date').value, '2026-09-17');
    assert.equal(form.save().disabled, true);
    form.input(p => p.type === 'checkbox').onChange({ target: { checked: true } });
    assert.equal(form.save().disabled, false);
    await form.save().onClick();
    const row = JSON.parse(saved.get('record'));
    assert.equal(row.id, 10); assert.equal(row.maint_cost, 34362); assert.equal(row.fuel_cost, 200);
    assert.equal(row.date, '2026-09-17'); assert.equal(row.maintenance_bill_date, '2020-09-15');
    assert.equal(saved.get('attachmentOnly'), 'true');
    assert.equal(saved.get('dateReviewed'), 'true');
  } finally { global.fetch = previous; }
});

test('exact repeated upload is blocked before AI extraction and points to its existing record', async () => {
  const previous = global.fetch; let calls = 0;
  global.fetch = async () => { calls++; return Response.json({ existing: { ...existing, maintenance_bill_path: 'saved/bill.pdf' } }); };
  try {
    const form = formHarness(); await form.upload();
    assert.equal(calls, 1);
    assert.ok(text(form.render()).includes('This exact bill is already saved'));
    assert.equal(form.save().disabled, true);
    const link = nodes(form.render()).find(n => n.type === 'a' && text(n) === 'View saved bill');
    assert.ok(link.props.href.includes('saved%2Fbill.pdf'));
  } finally { global.fetch = previous; }
});

test('genuinely separate expense requires explicit review and a changed date resets that confirmation', async () => {
  const previous = global.fetch;
  global.fetch = async url => Response.json(url.endsWith('/check') ? { existing: null } : extraction);
  try {
    const form = formHarness(); form.vehicle(existing.vehicle_id); await form.upload();
    form.review().onConfirm(true);
    form.input(p => p.type === 'checkbox').onChange({ target: { checked: true } });
    assert.equal(form.save().disabled, false);
    form.change('fleet-log-date', '2026-10-28');
    assert.equal(form.review().checked, false);
    assert.equal(form.save().disabled, true);
  } finally { global.fetch = previous; }
});

function saveHarness({ duplicate = null, rpcError = null } = {}) {
  const calls = { uploads: [], removes: [], args: null };
  const api = load('src/app/api/fleet/maintenance-bill/route.ts', {
    '@/lib/fleet/maintenance': helpers,
    '@/lib/fleet/maintenance-server': { billFingerprint: server.billFingerprint, findExactBill: async () => duplicate },
    '@/lib/auth/api': { requireApiUser: async () => ({ user: { id: 'staff' }, supabase: {
      from: () => ({ select: () => ({ eq: () => ({ single: async () => ({ data: existing, error: null }) }) }) }),
      storage: { from: () => ({ upload: async (...args) => { calls.uploads.push(args); return { error: null }; }, remove: async value => { calls.removes.push(value); return { error: null }; } }) },
      rpc: async (_name, args) => { calls.args = args; return { data: rpcError ? null : { ok: true }, error: rpcError }; },
    } }) },
  });
  return { api, calls };
}
function saveRequest(row, extras = {}) {
  const body = new FormData(); body.set('record', JSON.stringify(row)); body.set('file', file());
  for (const [key, value] of Object.entries(extras)) body.set(key, value);
  return new Request('http://localhost/save', { method: 'POST', body });
}

test('server attaches only bill metadata, preserving current expense fields despite stale client data', async () => {
  const { api, calls } = saveHarness();
  const response = await api.POST(saveRequest({ ...existing, date: '2020-09-15', fuel_cost: 999999, starting_km: 0, maintenance_bill_date: '2020-09-15' }, { attachmentOnly: 'true', dateReviewed: 'true' }));
  assert.equal(response.status, 200);
  const payload = calls.args.p_record;
  assert.equal(payload.date, '2026-09-17'); assert.equal(payload.fuel_cost, 200); assert.equal(payload.starting_km, 100); assert.equal(payload.maint_cost, 34362);
  assert.equal(payload.maintenance_bill_date, '2020-09-15');
});

test('server blocks exact repeated files before upload, and does not delete an original after an uncertain transport result', async () => {
  const duplicate = saveHarness({ duplicate: existing });
  assert.equal((await duplicate.api.POST(saveRequest({ ...existing, id: undefined }))).status, 409);
  assert.equal(duplicate.calls.uploads.length, 0);
  const uncertain = saveHarness({ rpcError: { code: '', message: 'Fetch failed' } });
  assert.equal((await uncertain.api.POST(saveRequest({ ...existing, id: undefined }))).status, 400);
  assert.equal(uncertain.calls.removes.length, 0);
});
