/* eslint-disable @typescript-eslint/no-require-imports -- Node's built-in test runner loads these isolated CommonJS fixtures. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');

// Exercise route behavior without contacting live AI or the production database.
function load(path, mocks = {}) {
  const output = ts.transpileModule(fs.readFileSync(path, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const fixtureModule = { exports: {} };
  new Function('require', 'module', 'exports', output)(name => mocks[name] ?? require(name), fixtureModule, fixtureModule.exports);
  return fixtureModule.exports;
}
const helpers = load('src/lib/fleet/maintenance.ts');
const helperMocks = { '@/lib/fleet/maintenance': helpers };

test('search finds original bill text across vehicles, case and word order', () => {
  const records = [
    { vehicle_id: 'TN01', maintenance_performed: '', remarks: '', maintenance_bill_text: 'Front BRAKE padS replacement' },
    { vehicle_id: 'TN02', maintenance_performed: 'Brake pads', remarks: '' },
    { vehicle_id: 'TN03', maintenance_performed: 'Oil change', remarks: '', maintenance_vendor: 'ABC Motors' },
  ];
  assert.deepEqual(records.filter(r => helpers.matchesMaintenanceSearch(r, '  pads brake  ')).map(r => r.vehicle_id), ['TN01', 'TN02']);
  assert.equal(helpers.matchesMaintenanceSearch(records[2], 'abc motors'), true);
  assert.equal(helpers.matchesMaintenanceSearch(records[2], 'brake pads'), false);
  assert.equal(helpers.matchesMaintenanceSearch(records[0], '   '), true);
});

test('unreadable totals never become zero and impossible dates remain blank', () => {
  for (const total of [null, '', '1,200', -1, Infinity]) assert.equal(helpers.cleanBillExtraction({ total }).total, null);
  assert.equal(helpers.cleanBillExtraction({ total: 1200.25 }).total, 1200.25);
  assert.equal(helpers.cleanBillExtraction({ date: '2026-02-30' }).date, '');
  assert.equal(helpers.cleanBillExtraction({ date: '2026-10-28' }).date, '2026-10-28');
});

test('bill validation enforces type, nonempty files and upload size', () => {
  assert.equal(helpers.billFileError({ type: 'application/pdf', size: 123 }), '');
  assert.ok(helpers.billFileError({ type: 'text/html', size: 123 }));
  assert.ok(helpers.billFileError({ type: 'image/jpeg', size: 0 }));
  assert.ok(helpers.billFileError({ type: 'image/png', size: helpers.MAX_BILL_BYTES + 1 }));
});

function fileRequest(record, file) {
  const body = new FormData();
  if (record) body.set('record', JSON.stringify(record));
  if (file) body.set('file', file);
  return new Request('http://localhost/api/fleet/maintenance-bill', { method: 'POST', body });
}
const pdf = () => new File(['%PDF-1.4 test'], 'bill.pdf', { type: 'application/pdf' });
const record = { date: '2026-10-28', vehicle_id: 'TN01', vehicle_type: 'Estate', account: 'BVE', fuel_type: 'Diesel', starting_km: 10, closing_km: 30, fuel_filled_l: 2, fuel_cost: 200, maint_cost: 1050.50, maintenance_bill_text: 'Brake pads', total_cost: 999999, maintenance_bill_path: 'untrusted/path' };

function saveHarness({ failSave = false, existing = false } = {}) {
  const calls = { uploads: [], removes: [], writes: [] };
  const storage = {
    upload: async (...args) => { calls.uploads.push(args); return { error: null }; },
    remove: async paths => { calls.removes.push(paths); return { error: null }; },
  };
  const result = { error: failSave ? { code: '23505' } : null };
  const db = {
    insert: async payload => { calls.writes.push(payload); return result; },
    update: payload => { calls.writes.push(payload); return { eq: async () => result }; },
    select: () => ({ eq: () => ({ single: async () => ({ data: existing ? { maintenance_bill_path: 'old/bill.pdf' } : null }) }) }),
  };
  const api = load('src/app/api/fleet/maintenance-bill/route.ts', {
    ...helperMocks,
    '@/lib/auth/api': { requireApiUser: async () => ({ user: { id: 'admin' }, supabase: { from: () => db, storage: { from: () => storage } } }) },
  });
  return { api, calls };
}

test('saving attaches original and derives combined cost instead of trusting client totals or paths', async () => {
  const { api, calls } = saveHarness();
  assert.equal((await api.POST(fileRequest(record, pdf()))).status, 200);
  const saved = calls.writes[0];
  assert.equal(saved.total_cost, 1250.50);
  assert.equal(saved.km_run, 20);
  assert.equal(saved.maintenance_bill_name, 'bill.pdf');
  assert.match(saved.maintenance_bill_path, /\/bill\.pdf$/);
  assert.notEqual(saved.maintenance_bill_path, record.maintenance_bill_path);
  assert.equal(saved.maintenance_bill_text, 'Brake pads');
});

test('saving without a replacement preserves the original attachment', async () => {
  const { api, calls } = saveHarness({ existing: true });
  assert.equal((await api.POST(fileRequest({ ...record, id: 12 }))).status, 200);
  assert.equal('maintenance_bill_path' in calls.writes[0], false);
  assert.equal(calls.uploads.length, 0);
});

test('failed save cleans up new upload, retaining previous original', async () => {
  const { api, calls } = saveHarness({ failSave: true, existing: true });
  assert.equal((await api.POST(fileRequest({ ...record, id: 12 }, pdf()))).status, 400);
  assert.deepEqual(calls.removes, [[calls.uploads[0][0]]]);
  assert.notEqual(calls.removes[0][0], 'old/bill.pdf');
});

test('successful replacement removes old original only after saving', async () => {
  const { api, calls } = saveHarness({ existing: true });
  assert.equal((await api.POST(fileRequest({ ...record, id: 12 }, pdf()))).status, 200);
  assert.deepEqual(calls.removes, [['old/bill.pdf']]);
});

test('invalid costs are rejected before storage upload', async () => {
  const { api, calls } = saveHarness();
  assert.equal((await api.POST(fileRequest({ ...record, maint_cost: -5 }, pdf()))).status, 400);
  assert.equal(calls.uploads.length, 0);
});

test('unauthenticated extraction and saving do not process files', async () => {
  const mocks = { ...helperMocks, '@/lib/auth/api': { requireApiUser: async () => ({ error: Response.json({ error: 'Unauthorized' }, { status: 401 }) }) }, '@/lib/auth/rate-limit': {} };
  for (const path of ['src/app/api/fleet/maintenance-bill/route.ts', 'src/app/api/fleet/maintenance-bill/extract/route.ts']) {
    assert.equal((await load(path, mocks).POST(fileRequest(record, pdf()))).status, 401);
  }
});

test('extraction sends PDFs as files and photos as images; null total remains reviewable', async () => {
  const previousFetch = global.fetch;
  const previousKey = process.env.OPENAI_FLEET_PARSE_API_KEY;
  process.env.OPENAI_FLEET_PARSE_API_KEY = 'test-key';
  const requests = [];
  global.fetch = async (_url, init) => {
    requests.push(JSON.parse(init.body));
    return Response.json({ status: 'completed', output: [{ content: [{ text: JSON.stringify({ total: null, workshop: 'ABC Motors', maintenance_items: 'Brake pads', bill_text: 'Brake pads GST' }) }] }] });
  };
  try {
    const api = load('src/app/api/fleet/maintenance-bill/extract/route.ts', {
      ...helperMocks,
      '@/lib/auth/api': { requireApiUser: async () => ({ user: { id: 'admin' } }) },
      '@/lib/auth/rate-limit': { checkRateLimit: () => ({}), rateLimitKey: () => 'test' },
    });
    for (const file of [pdf(), new File(['photo'], 'bill.jpg', { type: 'image/jpeg' })]) {
      const response = await api.POST(fileRequest(null, file));
      assert.equal(response.status, 200);
      const extracted = await response.json();
      assert.equal(extracted.total, null);
      assert.equal(extracted.bill_text, 'Brake pads GST');
    }
    assert.equal(requests[0].input[0].content[0].type, 'input_file');
    assert.match(requests[0].input[0].content[0].file_data, /^data:application\/pdf;base64,/);
    assert.equal(requests[1].input[0].content[0].type, 'input_image');
  } finally {
    global.fetch = previousFetch;
    if (previousKey === undefined) delete process.env.OPENAI_FLEET_PARSE_API_KEY;
    else process.env.OPENAI_FLEET_PARSE_API_KEY = previousKey;
  }
});
