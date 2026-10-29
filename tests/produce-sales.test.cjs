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
const lib = load('src/lib/produce-sales.ts');
const batch = { id: '11111111-1111-4111-8111-111111111111', itemCode: 'DUR-ME-001', product: 'Durian', estate: 'ME', unit: 'Pieces', receivedPieces: 1, receivedWeightKg: 2.2, soldPieces: 0, soldWeightKg: 0 };
const secondBatch = { ...batch, id: '22222222-2222-4222-8222-222222222222', itemCode: 'AVO-SE-002', product: 'Avocado', estate: 'SE', receivedWeightKg: 1.5 };
const draft = { ...lib.blankDraft(batch.id), date: '2026-10-29', buyerName: 'Test Buyer', buyerPhone: '9000000000', buyerEmail: 'buyer@example.com', buyerAddress: 'Test address', weightSoldKg: '2.200', ratePerKg: '1000', courierPacking: '250' };

test('draft invoice and email carry every selected item, buyer and calculation field', () => {
  const sale = lib.buildDraftSale(draft, batch);
  assert.equal(sale.totalAmount, 2450);
  assert.equal(lib.invoiceNumber(sale), 'DRAFT');
  const email = lib.buildEmailDraft(sale);
  assert.equal(email.to, 'buyer@example.com');
  assert.equal(email.attachment, '');
  for (const value of ['DUR-ME-001', 'Durian', 'ME', 'Pieces: 1', '2.200 kg', 'Rs.1,000', 'Rs.250', 'Rs.2,450', 'Test address', '9000000000']) assert.ok(email.body.includes(value), value);
  const switched = lib.buildEmailDraft(lib.buildDraftSale({ ...draft, weightSoldKg: '1.5', ratePerKg: '200', courierPacking: '50' }, secondBatch));
  assert.ok(switched.body.includes('AVO-SE-002'));
  assert.ok(switched.body.includes('Rs.350'));
  assert.ok(!switched.body.includes('DUR-ME-001'));
  assert.equal(lib.buildDraftSale(draft, null), null);
});

test('complementary and replacement invoices charge only courier; saved documents retain token/email', () => {
  for (const saleType of ['Complementary', 'Replacement']) {
    const sale = lib.buildDraftSale({ ...draft, saleType }, batch);
    assert.equal(sale.produceAmount, 0);
    assert.equal(sale.totalAmount, 250);
    const saved = { ...sale, id: 'saved-id', isDraft: false };
    assert.notEqual(lib.invoiceNumber(saved), 'DRAFT');
    assert.ok(lib.buildEmailDraft(saved).attachment.endsWith('-bill.html'));
    const html = lib.invoiceHtml(saved);
    assert.ok(html.includes('DUR-ME-001'));
    assert.ok(html.includes('buyer@example.com'));
  }
});

test('buyer email is restored by phone and does not leak to a different customer', () => {
  const customers = [{ id: 'c1', phone: '9000000000', email: 'remembered@example.com', name: 'Returning buyer', address: 'Saved address' }];
  const recalled = lib.applyCustomerPhone(draft, customers, '');
  assert.equal(recalled.buyerEmail, 'remembered@example.com');
  assert.equal(recalled.buyerName, 'Returning buyer');
  assert.equal(lib.applyCustomerPhone({ ...recalled, buyerPhone: '8000000000' }, customers, recalled.buyerPhone).buyerEmail, '');
  assert.ok(lib.validBuyerEmail(''));
  assert.ok(lib.validBuyerEmail(' buyer@example.com '));
  for (const invalid of ['broken', 'a@b', 'a@example.com,other@example.com', 'a\r\nb@example.com']) assert.equal(lib.validBuyerEmail(invalid), false);
});

test('downloaded invoice escapes buyer and item text', () => {
  const sale = { ...lib.buildDraftSale(draft, batch), isDraft: false, buyerName: '<script>test</script>', buyerAddress: '<img src=x>', product: 'A & B' };
  const html = lib.invoiceHtml(sale);
  assert.ok(!html.includes('<script>test'));
  assert.ok(html.includes('&lt;script&gt;test'));
  assert.ok(html.includes('A &amp; B'));
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

// Exercise actual page handlers with fixture API responses, without writing live stock.
test('page previews before saving, follows edits, finalizes after save and recalls buyer email', async () => {
  const oldFetch = global.fetch;
  let storedSales = [], customers = [], posted = null;
  const items = [batch, secondBatch].map(b => ({ id: b.id, itemCode: b.itemCode, product: b.product, estate: b.estate, unit: 'Pieces', quantity: 1, weightKg: b.receivedWeightKg, receivedDate: '2026-10-20' }));
  global.fetch = async (url, options) => {
    if (url === '/api/auth/me') return Response.json({ user: { role: 'admin' } });
    if (url.includes('/store?')) return Response.json({ items });
    if (options?.method === 'POST') {
      posted = JSON.parse(options.body);
      const sale = { ...lib.buildDraftSale({ ...posted, weightSoldKg: String(posted.weightSoldKg), piecesSold: String(posted.piecesSold), ratePerKg: String(posted.ratePerKg), courierPacking: String(posted.courierPacking) }, items.find(i => i.id === posted.batchId)), id: 'saved-invoice', isDraft: false };
      customers = [{ phone: posted.buyerPhone, email: posted.buyerEmail, name: posted.buyerName, address: posted.buyerAddress }];
      storedSales = [sale];
      items.splice(items.findIndex(i => i.id === posted.batchId), 1);
      return Response.json({ sale });
    }
    return Response.json({ sales: storedSales, customers });
  };
  try {
    const states = [], effects = [];
    let cursor = 0, first = true;
    const react = {
      useState(initial) { const index = cursor++; if (!(index in states)) states[index] = typeof initial === 'function' ? initial() : initial; return [states[index], v => { states[index] = typeof v === 'function' ? v(states[index]) : v; }]; },
      useEffect(fn) { if (first) effects.push(fn); },
      useMemo(fn) { return fn(); }, useCallback(fn) { return fn; },
    };
    const Page = load('src/app/(dashboard)/employee-portal/ramesh/stores/produce-sales/page.tsx', { react, '@/lib/produce-sales': lib }).default;
    const render = () => { cursor = 0; const page = Page(); first = false; return page; };
    const field = label => {
      const element = nodes(render()).find(n => n.type === 'label' && text(n.props.children[0]) === label);
      assert.ok(element, label);
      return nodes(element).find(n => ['input', 'select', 'textarea'].includes(n.type)).props;
    };
    const change = (label, value) => field(label).onChange({ target: { value } });
    const button = label => nodes(render()).find(n => n.type === 'button' && text(n).trim() === label).props;
    render(); effects.forEach(fn => fn());
    for (let i = 0; i < 3; i++) await new Promise(resolve => setImmediate(resolve));
    assert.ok(text(render()).includes('Draft Invoice Preview'));
    assert.equal(button('Print').disabled, true);
    change('Buyer Name', 'Test Buyer'); change('Buyer Phone', '9000000000'); change('Buyer Email', 'buyer@example.com');
    assert.equal(field('To').value, 'buyer@example.com');
    assert.ok(field('Message').value.includes('DUR-ME-001'));
    change('Subject', 'Custom subject');
    change('Produce Token No.', secondBatch.id);
    assert.ok(field('Message').value.includes('AVO-SE-002'));
    assert.ok(!field('Message').value.includes('DUR-ME-001'));
    assert.notEqual(field('Subject').value, 'Custom subject');
    change('Rate Per Kg', '200'); change('Courier/Packing', '50');
    assert.ok(field('Message').value.includes('Total: Rs.350'));
    await button('Save Sale').onClick();
    assert.equal(posted.buyerEmail, 'buyer@example.com');
    assert.ok(text(render()).includes('Saved Invoice'));
    assert.equal(button('Print').disabled, false);
    assert.ok(field('Message').value.includes('AVO-SE-002'));
    assert.ok(field('Attachment Name').value.endsWith('.html'));
    change('Buyer Phone', '9000000000');
    assert.equal(field('Buyer Email').value, 'buyer@example.com');
    assert.ok(text(render()).includes('Draft Invoice Preview'));
    assert.ok(field('Message').value.includes('DUR-ME-001'));
  } finally { global.fetch = oldFetch; }
});

function routeHarness() {
  const calls = [];
  const mock = { from(table) {
    let written;
    const query = {
      select() { return query; }, eq() { return query; }, order() { return query; }, limit() { return query; },
      upsert(value) { written = value; calls.push({ table, operation: 'upsert', value }); return query; },
      insert(value) { written = value; calls.push({ table, operation: 'insert', value }); return query; },
      update() { return query; },
      async single() {
        if (table === 'produce_store_items') return { data: { id: batch.id, item_code: batch.itemCode, product: batch.product, estate: 'ME', unit: 'Pieces', quantity: 1, weight_kg: 2.2, status: 'In Store' }, error: null };
        if (table === 'produce_customers') return { data: { id: 'customer-id' }, error: null };
        return { data: { ...written[0], id: 'sale-id' }, error: null };
      },
      then(resolve) { return Promise.resolve({ data: table === 'produce_customers' ? [{ id: 'customer-id', phone: '9000000000', email: 'buyer@example.com' }] : [{ id: 'sale-id', buyer_email: 'buyer@example.com', store_item_code: 'DUR-ME-001' }], error: null }).then(resolve); },
    };
    return query;
  } };
  const helpers = { ESTATES: ['ME'], ESTATE_PRODUCE_RECORD_ID_RE: /^[a-f0-9-]{36}$/i, SALE_TYPES: ['Charged Sale', 'Complementary', 'Replacement'], PAYMENT_MODES: ['Bank'], PAYMENT_STATUSES: ['Pending', 'Paid'], requireEstateProduceUser: async () => ({ supabase: mock, user: { id: 'user-id', name: 'Test' } }), text: v => String(v ?? '').trim(), nullableText: v => v || null, numberValue: v => Number(v) || 0, badRequest: error => Response.json({ error }, { status: 400 }), estateProduceSetupError: message => message };
  return { calls, api: load('src/app/api/estate-produce/sales/route.ts', { '../_helpers': helpers, '@/lib/produce-sales': lib }) };
}

test('sales API saves and returns the trusted produce token and buyer email, including customer recall', async () => {
  const { api, calls } = routeHarness();
  const response = await api.POST(new Request('http://localhost/sales', { method: 'POST', body: JSON.stringify({ ...draft, itemCode: 'untrusted-client-code', weightSoldKg: 2.2, piecesSold: 1, ratePerKg: 1000, courierPacking: 250 }) }));
  assert.equal(response.status, 200);
  const { sale } = await response.json();
  assert.equal(sale.buyerEmail, 'buyer@example.com');
  assert.equal(sale.itemCode, 'DUR-ME-001');
  assert.equal(sale.totalAmount, 2450);
  assert.equal(calls.find(c => c.table === 'produce_customers').value.email, 'buyer@example.com');
  const loaded = await (await api.GET(new Request('http://localhost/sales'))).json();
  assert.equal(loaded.customers[0].email, 'buyer@example.com');
  assert.equal(loaded.sales[0].buyerEmail, 'buyer@example.com');
  assert.equal(loaded.sales[0].itemCode, 'DUR-ME-001');
});

test('invalid email is rejected before any database writes', async () => {
  const { api, calls } = routeHarness();
  const response = await api.POST(new Request('http://localhost/sales', { method: 'POST', body: JSON.stringify({ ...draft, buyerEmail: 'broken-email' }) }));
  assert.equal(response.status, 400);
  assert.equal(calls.length, 0);
});
