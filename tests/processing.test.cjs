const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const { NextResponse } = require('next/server');
function load(path, dependencies = {}) {
  const mod = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true, target: ts.ScriptTarget.ES2022 } }).outputText;
  new Function('require', 'module', 'exports', code)(name => {
    if (name in dependencies) return dependencies[name];
    if (name === 'server-only') return {};
    if (name === './processing-options.json') return JSON.parse(fs.readFileSync('src/lib/processing-options.json', 'utf8'));
    return require(name);
  }, mod, mod.exports);
  return mod.exports;
}
const lib = load('src/lib/processing.ts');
const season = { id: lib.PROCESSING_SEASON, start_date: '2026-04-01', revision: 1 };
const input = () => ({ ...lib.emptyProcessingBatch(), processing_date: '2026-11-01', harvest_date: '2026-11-01', lot_number: '  LOT-1  ', field_name: 'All Fields', variety: 'MIXED', picking_round: 'Fly' });
const clean = (value, setup = season) => lib.cleanProcessingBatch(value, setup, '2026-11-14');

test('unfinished measurements remain null; explicit zero remains zero; notes are retained', () => {
  const row = clean({ ...input(), gross_kg: 1000, floats_kg: 0, fermentation_hours: 0, recipe_notes: 'Recipe A\nSecond line', reserved: 'forged', updated_by: 'forged', net_kg: 9000 });
  assert.equal(row.lot_number, '');
  assert.equal(row.floats_kg, 0); assert.equal(row.fermentation_hours, 0);
  assert.equal(row.actual_dry_kg, null); assert.equal(row.recipe_notes, 'Recipe A\nSecond line');
  assert.equal(row.net_kg, undefined); assert.equal(row.reserved, undefined); assert.equal(row.updated_by, undefined);
  assert.equal(lib.processingNet(row), 1000); assert.equal(lib.processingOutturn(row), null);
  assert.equal(lib.processingNet(clean(input())), null);
});
test('actual outturn uses actual dry weight and requires a known positive net', () => {
  assert.equal(lib.processingOutturn({ gross_kg: 1100, floats_kg: 100, actual_dry_kg: 250 }), 25);
  assert.equal(lib.processingOutturn({ gross_kg: 100, floats_kg: 100, actual_dry_kg: 0 }), null);
});
test('rejects invalid dates, future dates, pre-season dates and missing setup', () => {
  for (const processing_date of ['2026-02-30', '2026-11-15', '2026-03-31', 'bad']) assert.throws(() => clean({ ...input(), processing_date }), /date/i);
  assert.throws(() => clean(input(), { ...season, start_date: null }), /season start/);
  assert.throws(() => clean({ ...input(), dried_on: '2026-10-31' }), /Drying completion/);
});
test('rejects invalid weights, ranges, booleans, nonnumeric input and fractional picking rounds', () => {
  for (const fields of [{ gross_kg: -1 }, { gross_kg: true }, { gross_kg: [] }, { gross_kg: 'bad' }, { gross_kg: Infinity }, { gross_kg: 10, floats_kg: 11 }, { floats_kg: 2 }, { gross_kg: 10, floats_kg: 0, actual_dry_kg: 11 }, { ph: 15 }, { moisture: 101 }, { fermentation_hours: -1 }, { picking_round: 1.5 }]) assert.throws(() => clean({ ...input(), ...fields }));
});
test('completion requires actual dry, moisture, drying date, net weight and Dried stage', () => {
  assert.throws(() => clean({ ...input(), status: 'Complete' }), /complete a batch/);
  const row = clean({ ...input(), status: 'Complete', stage: 'Dried', gross_kg: 1000, floats_kg: 0, actual_dry_kg: 240, moisture: 11.5, dried_on: '2026-11-14' });
  assert.equal(row.status, 'Complete');
});
test('lot matching normalizes spaces and case and cannot be bypassed with split references', () => {
  const row = input();
  assert.equal(lib.processingLotKey(row), lib.processingLotKey({ ...row, lot_number: 'lot-1' }));
  assert.equal(lib.processingLotKey(row), lib.processingLotKey({ ...row, split_reference: 'A' }));
});

function request(body, method = 'POST') { return new Request('https://mspcoffee.vercel.app/api/processing', { method, headers: { 'content-type': 'application/json', origin: 'https://mspcoffee.vercel.app' }, body: JSON.stringify(body) }); }
function routes(auth) {
  return load('src/app/api/processing/route.ts', {
    '@/lib/processing': lib,
    '@/lib/processing-server': { processingAuth: auth, processingSeason: async () => season, processingError: e => NextResponse.json({ error: e.code }, { status: e.code === '23505' ? 409 : 503 }) },
  });
}
test('all processing API operations authenticate before reading or writing', async () => {
  const seen = [];
  const r = routes(async (_, write) => { seen.push(!!write); return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }; });
  assert.equal((await r.GET(new Request('https://mspcoffee.vercel.app/api/processing'))).status, 401);
  assert.equal((await r.POST(request(input()))).status, 401);
  assert.equal((await r.PATCH(request(input(), 'PATCH'))).status, 401);
  assert.deepEqual(seen, [false, true, true]);
});
test('save takes actor identity from authentication and update uses a revision condition', async () => {
  let saved; const filters = [];
  const db = { from() { const q = { insert(data) { saved = data; return q; }, update(data) { saved = data; return q; }, eq(...args) { filters.push(args); return q; }, select() { return q; }, async maybeSingle() { return { data: { ...saved, lot_number: 'SE01Nov26MIXED2-01', revision: 2 }, error: null }; } }; return q; } };
  const r = routes(async () => ({ supabase: db, user: { id: 'real-user', name: 'Ashok' } }));
  const created = await r.POST(request({ ...input(), updated_by: 'forged', updated_by_name: 'forged' }));
  assert.equal(created.status, 201); assert.equal(saved.updated_by, 'real-user'); assert.equal(saved.updated_by_name, 'Ashok'); assert.equal(saved.lot_number, undefined);
  const row = (await created.json()).batch;
  assert.equal((await r.PATCH(request({ ...row, remarks: 'Updated' }, 'PATCH'))).status, 200);
  assert.ok(filters.some(([key, value]) => key === 'revision' && value === 2));
});
test('stale versions and duplicate insert races give conflicts rather than overwrite', async () => {
  for (const duplicate of [false, true]) {
    const db = { from() { const q = { insert() { return q; }, update() { return q; }, eq() { return q; }, select() { return q; }, async maybeSingle() { return { data: null, error: duplicate ? { code: '23505' } : null }; } }; return q; } };
    const r = routes(async () => ({ supabase: db, user: { id: 'user', name: 'Tester' } }));
    const response = duplicate ? await r.POST(request(input())) : await r.PATCH(request({ ...input(), revision: 1 }, 'PATCH'));
    assert.equal(response.status, 409);
  }
});
test('loading the register paginates beyond the database row cap', async () => {
  const all = Array.from({ length: 1003 }, (_, i) => ({ id: String(i) }));
  const db = { from() { const q = { select() { return q; }, eq() { return q; }, order() { return q; }, async range(a, b) { return { data: all.slice(a, b + 1), error: null }; } }; return q; } };
  const response = await routes(async () => ({ supabase: db, canWrite: true })).GET(new Request('https://mspcoffee.vercel.app/api/processing'));
  assert.equal((await response.json()).batches.length, 1003);
  assert.equal(response.headers.get('cache-control'), 'private, no-store');
});
test('processing authorization rejects cross-origin writes, non-admin writes and configured read denial', async () => {
  const user = { id: 'legacy-user', role: 'supervisor' };
  let access = 'read';
  const db = { from() { const q = { select() { return q; }, eq() { return q; }, async maybeSingle() { return { data: { access }, error: null }; } }; return q; } };
  const auth = load('src/lib/processing-server.ts', { '@/lib/processing': lib, '@/lib/auth/api': { UUID_RE: /^[0-9a-f-]{36}$/, requireApiUser: async () => ({ user, supabase: db }) } });
  assert.equal((await auth.processingAuth(request(input()), true)).error.status, 403);
  assert.equal((await auth.processingAuth(new Request('https://mspcoffee.vercel.app/api/processing'))).canWrite, false);
  access = 'none'; assert.equal((await auth.processingAuth(new Request('https://mspcoffee.vercel.app/api/processing'))).error.status, 403);
  user.role = 'admin';
  const foreign = new Request('https://mspcoffee.vercel.app/api/processing', { method: 'POST', headers: { origin: 'https://other.example' } });
  assert.equal((await auth.processingAuth(foreign, true)).error.status, 403);
});
