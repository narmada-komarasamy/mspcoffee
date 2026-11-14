/* eslint-disable @typescript-eslint/no-require-imports */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
function load(path, mocks = {}) {
  const module = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  new Function('require', 'module', 'exports', code)(name => { const dateDependency = require('./helpers/date-test-support.cjs')(name); if (dateDependency) return dateDependency; return name in mocks ? mocks[name] : require(name); }, module, module.exports);
  return module.exports;
}
const contacts = load('src/lib/email/contacts.ts');
test('saved addresses combine To and CC, normalize case, deduplicate and reject invalid values', () => {
  assert.deepEqual(contacts.rememberedEmails([
    { recipients: [' Cashier@Example.com ', 'not-email', null], cc: ['ashok@example.com'] },
    { recipients: ['cashier@example.com', 'other@example.com'], cc: 'not-an-array' },
  ]), ['cashier@example.com', 'ashok@example.com', 'other@example.com']);
});
test('predictive matching supports partial addresses and excludes other already-entered recipients', () => {
  const saved = ['cashier@example.com', 'ashok@example.com', 'office@example.com'];
  assert.deepEqual(contacts.suggestedEmails('cas', 3, saved), ['cashier@example.com']);
  assert.deepEqual(contacts.suggestedEmails('cashier@example.com, ', 21, saved), ['ashok@example.com', 'office@example.com']);
  assert.deepEqual(contacts.suggestedEmails('unknown', 7, saved), []);
  assert.equal(contacts.suggestedEmails('', 0, Array.from({length: 20}, (_,i) => `user${i}@example.com`)).length, 6);
});
test('choosing a suggestion replaces only the active address and preserves the other recipients', () => {
  const value = 'first@example.com; cas; last@example.com';
  const chosen = contacts.chooseEmail(value, value.indexOf('cas') + 2, 'cashier@example.com');
  assert.equal(chosen.value, 'first@example.com; cashier@example.com; last@example.com');
  assert.equal(chosen.caret, chosen.value.indexOf('; last'));
  assert.deepEqual(contacts.chooseEmail('', 0, 'cashier@example.com'), { value: 'cashier@example.com', caret: 19 });
  assert.equal(contacts.chooseEmail('first@example.com\ncas', 21, 'cashier@example.com').value, 'first@example.com\n cashier@example.com');
});
test('contact lookup authenticates and returns only this user’s successful or logged report addresses', async () => {
  let allowed = false;
  const calls = [];
  const query = { select: () => query, eq: (...args) => { calls.push(args); return query; }, in: (...args) => { calls.push(args); return query; }, order: () => query, limit: async () => ({ data: [{ recipients: ['cashier@example.com'], cc: ['ashok@example.com'] }] }) };
  const route = load('src/app/api/email/contacts/route.ts', {
    '../_auth': { requireEmailUser: async () => allowed ? { user: { id: 'admin-1' }, supabase: { from: () => query } } : { error: new Response('Unauthorized', { status: 401 }) } },
    '@/lib/email/contacts': contacts,
  });
  assert.equal((await route.GET(new Request('http://localhost/api/email/contacts'))).status, 401);
  assert.equal(calls.length, 0);
  allowed = true;
  const response = await route.GET(new Request('http://localhost/api/email/contacts'));
  assert.deepEqual((await response.json()).addresses, ['cashier@example.com', 'ashok@example.com']);
  assert.ok(calls.some(args => args[0] === 'requested_by' && args[1] === 'admin-1'));
  assert.ok(calls.some(args => args[0] === 'status' && args[1].join(',') === 'sent,logged'));
  assert.equal(response.headers.get('Cache-Control'), 'private, no-store');
});
