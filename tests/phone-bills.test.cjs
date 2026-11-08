/* eslint-disable @typescript-eslint/no-require-imports */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
function load(path, mocks = {}) {
  const m = { exports: {} };
  const output = ts.transpileModule(fs.readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  new Function('require', 'module', 'exports', output)(name => name in mocks ? mocks[name] : require(name), m, m.exports);
  return m.exports;
}
const h = load('src/lib/phone-bills.ts');
const html = load('src/lib/phone-statement-html.ts', { './phone-bills': h });
const rows = h.parsePhoneCsv(fs.readFileSync('public/data/phone-bill-reimbursements.csv', 'utf8'));
const feb = rows.filter(r => r.month === 'February' && r.year === '2026');
const example = { ...feb[0], payee: 'Mrs. NA' };

test('February corrections reconcile exactly to the user-confirmed amount and recipient', () => {
  assert.equal(h.totalBills(feb), 14914.5);
  assert.equal(feb.find(r => r.phone.replace(/\s/g, '') === '6381195115').amount, 1178);
  const na = feb.find(r => r.accountNo === '9041904329');
  assert.equal(na.amount, 1178);
  assert.equal(na.payee, 'Mrs. NA');
  assert.deepEqual(h.payeeTotals(feb), [{ payee: 'Mr. AM', total: 13736.5 }, { payee: 'Mrs. NA', total: 1178 }]);
});
test('PNG imports include all 21 accounts and recalculate totals independently of sheet formulas', () => {
  const expected = { March: 14851.86, April: 14851.86, May: 14851.86, June: 14652.88, July: 14716.85, August: 15063.57, September: 13965.82 };
  for (const [month, total] of Object.entries(expected)) {
    const entries = rows.filter(r => r.month === month && r.year === '2026');
    assert.equal(entries.length, 21, month);
    assert.equal(new Set(entries.map(h.billKey)).size, 21, month);
    assert.equal(h.totalBills(entries), total, month);
    assert.equal(h.payeeTotals(entries)[1].total, 2357.82, month);
  }
});
test('unknown amounts stay pending; invalid monetary values cannot enter the register', () => {
  assert.equal(h.cleanBillRow({ ...example, amount: null }).amount, null);
  assert.equal(h.cleanBillRow({ ...example, amount: 0 }).amount, 0);
  for (const amount of [-1, Infinity, NaN, '1178', 1.234, undefined]) assert.throws(() => h.cleanBillRow({ ...example, amount }));
  assert.throws(() => h.cleanBillRow({ ...example, phone: '', accountNo: '' }));
  assert.throws(() => h.cleanBillRow({ ...example, payee: 'someone else' }));
});
test('saved corrections replace a source entry instead of adding a second charge', () => {
  const corrected = { ...example, amount: 100 };
  const combined = h.mergeBillRows(feb, [corrected]);
  assert.equal(combined.length, feb.length);
  assert.equal(combined.find(r => h.billKey(r) === h.billKey(example)).amount, 100);
});
test('payment rejects impossible dates, future dates, partial amounts and missing references', () => {
  assert.equal(h.paymentError({ date: '2026-02-28', reference: 'VOUCHER-1', amount: 14914.5 }, 14914.5), '');
  for (const date of ['2026-02-30', '2026-99-10', '2099-01-01', '', null]) assert.notEqual(h.paymentError({ date, reference: 'TEST', amount: 14914.5 }, 14914.5), '');
  assert.notEqual(h.paymentError({ date: '2026-02-28', reference: '', amount: 14914.5 }, 14914.5), '');
  assert.notEqual(h.paymentError({ date: '2026-02-28', reference: 'TEST', amount: 100 }, 14914.5), '');
});
test('printable statement escapes source text, displays the two recipients and requested signatures', () => {
  const document = html.phoneStatementHtml([{ ...example, user: '<script>alert(1)</script>', remarks: '<img src=x>' }], '2026-02');
  assert.ok(document.includes('&lt;script&gt;'));
  assert.ok(!document.includes('<script>'));
  assert.ok(document.includes('Mr. AM'));
  assert.ok(document.includes('Mrs. NA'));
  assert.ok(document.includes('Ponraj'));
  assert.ok(document.includes('Payment received by'));
  assert.ok(document.includes('size:A4 portrait'));
});
test('every registry, statement and file endpoint rejects unauthorized requests before touching data', async () => {
  const blocked = () => ({ error: new Response('Unauthorized', { status: 401 }) });
  for (const [path, methods] of [
    ['src/app/api/phone-bills/route.ts', ['GET', 'POST', 'PATCH']],
    ['src/app/api/phone-bills/statements/route.ts', ['GET', 'POST', 'PATCH']],
    ['src/app/api/phone-bills/files/route.ts', ['GET', 'POST']],
  ]) {
    const route = load(path, { '@/lib/phone-bills-server': { phoneBillAuth: blocked }, '@/lib/phone-bills': h, '@/lib/auth/api': { UUID_RE: /^[0-9a-f-]{36}$/ } });
    for (const method of methods) assert.equal((await route[method](new Request('http://localhost/api/test', { method }))).status, 401);
  }
});
test('statement creation computes source rows on the server and ignores client-supplied totals', async () => {
  let args;
  const route = load('src/app/api/phone-bills/statements/route.ts', {
    '@/lib/phone-bills-server': { phoneBillAuth: async () => ({ user: { id: 'admin' }, supabase: { rpc: async (name, input) => { args = input; return { data: { id: 'test' }, error: null }; } } }), basePhoneRows: async () => feb },
    '@/lib/phone-bills': h, '@/lib/auth/api': { UUID_RE: /^[0-9a-f-]{36}$/ },
  });
  const response = await route.POST(new Request('http://localhost/api/phone-bills/statements', { method: 'POST', body: JSON.stringify({ period: '2026-02', total: 1, rows: [] }) }));
  assert.equal(response.status, 201);
  assert.equal(args.base_rows.length, 20);
  assert.equal(h.totalBills(args.base_rows), 14914.5);
  assert.equal(args.actor, 'admin');
  assert.ok(args.base_rows.every(r => r.entryKey === h.billKey(r)));
});

test('historical cutoff includes February and earlier years, while March requires a recorded payment', () => {
  for (const period of ['2020-12', '2025-12', '2026-01', '2026-02']) assert.equal(h.historicallyPaid(period), true);
  for (const period of ['2026-03', '2027-01', 'invalid', '2026-00']) assert.equal(h.historicallyPaid(period), false);
  assert.equal(h.paymentStatus('2026-03', null, 1), 'Unpaid');
  assert.equal(h.paymentStatus('2026-03', '2026-04-01', 0), 'Paid — scan pending');
  assert.equal(h.paymentStatus('2026-03', '2026-04-01', 1), 'Paid — scan saved');
});
test('history keeps saved totals, old scans and real payment details without inventing historical dates', () => {
  const statements = [
    { id: 'old', period: '2025-01', total: 123, payment_date: null, payment_reference: null },
    { id: 'march', period: '2026-03', total: 15000, payment_date: '2026-04-01', payment_reference: 'V-1' },
  ];
  const files = [{ id: 'file', statement_id: 'old', file_name: 'old.pdf', created_at: '2026-11-08' }];
  const history = h.buildPaymentHistory(rows, statements, files);
  const old = history.find(r => r.period === '2025-01');
  assert.equal(old.paid, true); assert.equal(old.paymentDate, null); assert.equal(old.reference, null);
  assert.equal(old.total, 123); assert.equal(old.files[0].id, 'file');
  const march = history.find(r => r.period === '2026-03');
  assert.equal(march.total, 15000); assert.equal(march.reference, 'V-1'); assert.equal(march.status, 'Paid — scan pending');
  assert.equal(history.find(r => r.period === '2026-04').paid, false);
  assert.equal(history.find(r => r.period === '2026-02').paid, true);
});
test('history endpoint rejects unauthorized access', async () => {
  const route = load('src/app/api/phone-bills/history/route.ts', { '@/lib/phone-bills-server': { phoneBillAuth: () => ({ error: new Response('Unauthorized', { status: 401 }) }) }, '@/lib/phone-bills': h });
  assert.equal((await route.GET(new Request('http://localhost/api/phone-bills/history'))).status, 401);
});
test('historical payments cannot be recorded a second time through the API', async () => {
  const route = load('src/app/api/phone-bills/statements/route.ts', {
    '@/lib/phone-bills-server': { phoneBillAuth: async () => ({ supabase: { from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { total: 14914.5, payment_date: null, period: '2026-02' } }) }) }) }) } }) },
    '@/lib/phone-bills': h, '@/lib/auth/api': { UUID_RE: /^[0-9a-f-]{36}$/ },
  });
  const response = await route.PATCH(new Request('http://localhost/api/phone-bills/statements', { method: 'PATCH', body: JSON.stringify({ id: '00000000-0000-0000-0000-000000000001', date: '2026-02-28', reference: 'DUPLICATE', amount: 14914.5 }) }));
  assert.equal(response.status, 409);
});

test('history API returns persisted payments and scans and fails visibly when saved records cannot load', async () => {
  let failed = false;
  const route = load('src/app/api/phone-bills/history/route.ts', {
    '@/lib/phone-bills-server': {
      allPhoneRows: async () => feb,
      phoneBillAuth: async () => ({ supabase: { from: table => {
        const query = { select: () => query, order: () => query, range: async () => failed ? { error: {} } : { data: table === 'phone_bill_statements' ? [{ id: 's', period: '2026-02', total: 14914.5, payment_date: null, payment_reference: null }] : [{ id: 'f', statement_id: 's', file_name: 'signed.pdf', created_at: '2026-11-08' }] } };
        return query;
      } } }),
    }, '@/lib/phone-bills': h,
  });
  const response = await route.GET(new Request('http://localhost/api/phone-bills/history'));
  assert.equal(response.status, 200);
  const { history } = await response.json();
  assert.equal(history[0].files[0].file_name, 'signed.pdf');
  assert.equal(history[0].status, 'Paid — historical · Scan saved');
  failed = true;
  assert.equal((await route.GET(new Request('http://localhost/api/phone-bills/history'))).status, 503);
});
test('historical printouts describe the opening balance without fabricated payment details', () => {
  const document = html.phoneStatementHtml(feb, '2026-02');
  assert.ok(document.includes('Paid — historical'));
  assert.ok(document.includes('Payment date and voucher reference not recorded'));
  assert.ok(!html.phoneStatementHtml(feb, '2026-03').includes('Paid — historical'));
});

test('monthly email includes only the chosen month, every filtered entry, recipient totals and an automatic report attachment', () => {
  const email = load('src/lib/phone-bill-email.ts', { './phone-bills': h });
  const march = rows.filter(r => r.month === 'March' && r.year === '2026');
  const payload = email.phoneBillEmail(march, 'March', '2026', 'month is March; year is 2026');
  assert.equal(payload.data.sections[0].rows.length, 21);
  assert.ok(payload.subject.includes('March 2026'));
  assert.equal(payload.attachmentName, 'MSP_Phone_Bills_2026_03.pdf');
  assert.equal(payload.data.summary.find(r => r.label === 'Total reimbursement').value, h.billMoney(14851.86));
  assert.equal(payload.data.summary.find(r => r.label === 'Reimburse Mrs. NA').value, h.billMoney(2357.82));
  const validate = load('src/lib/email/payload.ts');
  assert.ok('payload' in validate.validateEmailPayload({ ...payload, recipients: ['test@example.com'] }));
  const rendered = load('src/lib/email/render.ts').renderEmail(payload);
  assert.ok(rendered.html.includes('March 2026'));
  assert.ok(!rendered.html.includes('February 2026'));
  assert.ok(rendered.html.includes('Included bill entries'));
  assert.throws(() => email.phoneBillEmail(rows, 'March', '2026', ''));
  assert.throws(() => email.phoneBillEmail(march, 'ALL', '2026', ''));
  assert.throws(() => email.phoneBillEmail([], 'March', '2026', ''));
  const partial = email.phoneBillEmail(march.slice(0, 1), 'March', '2026', 'user is Mr.MR');
  assert.equal(partial.data.sections[0].rows.length, 1);
  assert.equal(partial.data.summary.find(r => r.label === 'Register filters').value, 'user is Mr.MR');
});

test('monthly PDF fits one A4 page with every account across all source months', async () => {
  const pdf = load('src/lib/phone-statement-pdf.ts', { './phone-bills': h });
  const { PDFDocument } = require('pdf-lib');
  const logo = fs.readFileSync('public/msp-logo.png');
  for (const period of new Set(rows.map(h.billPeriod))) {
    const monthly = rows.filter(r => h.billPeriod(r) === period);
    if (monthly.some(r => r.amount === null)) continue;
    const bytes = await pdf.phoneStatementPdf(monthly, period, logo);
    const document = await PDFDocument.load(bytes);
    assert.equal(document.getPageCount(), 1, period);
    assert.ok(Math.abs(document.getPage(0).getWidth() - 595.28) < 0.1);
    if (period === '2026-03') fs.writeFileSync('/tmp/msp-phone-march.pdf', bytes);
  }
  await assert.rejects(pdf.phoneStatementPdf([{...example, amount: null}], '2026-02', logo), /Complete all bill amounts/);
  await assert.rejects(pdf.phoneStatementPdf(Array(200).fill(example), '2026-02', logo), /one-page/);
});
test('email preparation uses the full saved snapshot and produces a real PDF attachment', async () => {
  const email = load('src/lib/phone-bill-email.ts', { './phone-bills': h });
  const pdf = load('src/lib/phone-statement-pdf.ts', { './phone-bills': h });
  const march = rows.filter(r => r.month === 'March' && r.year === '2026');
  const snapshot = { id: 's', reference: 'MSP-PH-202603', period: '2026-03', rows: march, total: 14851.86, created_at: '2026-11-08', payment_date: null };
  let saved = snapshot; let issued = 0;
  const server = load('src/lib/phone-bill-email-server.ts', {
    'server-only': {}, './phone-bills': h, './phone-bill-email': email, './phone-statement-pdf': pdf,
    './phone-bills-server': { basePhoneRows: async () => march, allPhoneRows: async () => { throw new Error('Must prefer saved snapshot'); } },
  });
  const supabase = { from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: saved }) }) }) }), rpc: async () => { issued++; saved = snapshot; return { data: snapshot }; } };
  const input = { ...email.phoneBillEmail(march.slice(0, 1), 'March', '2026', 'partial'), recipients: ['test@example.com'], note: 'Please sign and return.' };
  const prepared = await server.preparePhoneBillEmail(supabase, input, 'admin');
  assert.equal(issued, 0);
  assert.equal(prepared.attachmentContentType, 'application/pdf');
  assert.equal(prepared.attachmentContent.subarray(0, 4).toString(), '%PDF');
  assert.equal(prepared.payload.data.summary.find(r => r.label === 'Accounts included').value, '21');
  assert.equal(prepared.payload.data.sections, undefined);
  assert.deepEqual(prepared.payload.recipients, ['test@example.com']);
  const legacy = { ...input, phoneBillPeriod: undefined, attachmentName: 'MSP_Phone_Bills_2026_03.html', note: 'March 2027' };
  const compatible = await server.preparePhoneBillEmail(supabase, legacy, 'admin');
  assert.equal(compatible.payload.phoneBillPeriod, '2026-03');
  assert.equal(compatible.payload.note, 'March 2027');
  assert.ok(compatible.payload.attachmentName.endsWith('.pdf'));
  await assert.rejects(server.preparePhoneBillEmail(supabase, { ...input, phoneBillPeriod: '2027-03' }, 'admin'), /inconsistent/);
  await assert.rejects(server.preparePhoneBillEmail(supabase, { ...legacy, data: { summary: [] } }, 'admin'), /missing/);
  saved = null;
  await server.preparePhoneBillEmail(supabase, input, 'admin');
  assert.equal(issued, 1);
  await assert.rejects(server.preparePhoneBillEmail(supabase, {...input, phoneBillPeriod:'invalid'}, 'admin'), /missing or inconsistent/);
});
test('PDF preview route rejects unauthorized access', async () => {
  const route = load('src/app/api/phone-bills/pdf/route.ts', { '@/lib/phone-bills-server': { phoneBillAuth: () => ({ error: new Response('Unauthorized', { status: 401 }) }) }, '@/lib/phone-bills': h, '@/lib/phone-bill-email-server': {} });
  assert.equal((await route.GET(new Request('http://localhost/api/phone-bills/pdf?period=2026-03'))).status, 401);
});

test('send endpoint passes the generated PDF bytes and MIME type to the email provider', async () => {
  const email = load('src/lib/phone-bill-email.ts', { './phone-bills': h });
  const validation = load('src/lib/email/payload.ts');
  const input = { ...email.phoneBillEmail(feb, 'February', '2026', ''), recipients: ['test@example.com'] };
  const bytes = Buffer.from('%PDF-1.7 test document');
  let delivery;
  const route = load('src/app/api/email/send/route.ts', {
    '@/lib/email/payload': validation,
    '@/lib/email/render': { renderEmail: () => ({ subject: 'Monthly PDF', text: 'Please sign.', html: '<p>Please sign.</p>' }) },
    '@/lib/phone-bill-email-server': { preparePhoneBillEmail: async () => ({ payload: input, attachmentContent: bytes, attachmentContentType: 'application/pdf' }) },
    '@/lib/email/provider': { sendEmail: async data => { delivery = data; return { status: 'sent', provider: 'test' }; }, EmailDeliveryError: class extends Error {} },
    '../_auth': { requireEmailUser: async () => ({ user: { id: 'admin' }, supabase: { from: () => ({ insert: () => ({ select: () => ({ single: async () => ({ data: { id: 'log' } }) }) }), update: () => ({ eq: async () => ({ error: null }) }) }) } }) },
    '@/lib/auth/rate-limit': { checkRateLimit: () => ({}), rateLimitKey: () => 'test' },
  });
  const response = await route.POST(new Request('http://localhost/api/email/send', { method: 'POST', body: JSON.stringify(input) }));
  assert.equal(response.status, 201);
  assert.equal(delivery.attachmentContent, bytes);
  assert.equal(delivery.attachmentContentType, 'application/pdf');
  assert.ok(delivery.payload.attachmentName.endsWith('.pdf'));
});
