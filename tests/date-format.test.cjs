const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const dates = require('./helpers/date-test-support.cjs')('@/lib/date-format');
function load(path) {
  const mod = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  new Function('require', 'module', 'exports', code)(name => {
    const dateDependency = require('./helpers/date-test-support.cjs')(name);
    if (dateDependency) return dateDependency;

    if (name === '@/lib/date-format') return dates;
    return require(name);
  }, mod, mod.exports);
  return mod.exports;
}
test('DD/MM/YYYY has a fixed day/month order and retains leading zeroes', () => {
  for (const [iso, display] of [['2026-11-14','14/11/2026'],['2026-02-01','01/02/2026'],['2024-02-29','29/02/2024']]) {
    assert.equal(dates.formatDate(iso), display); assert.equal(dates.parseAppDate(display), iso);
  }
  assert.equal(dates.parseAppDate('01/02/2026'), '2026-02-01');
  assert.equal(dates.parseAppDate('14112026'), '2026-11-14');
  for (const bad of ['31022026','29022025','32112026','01132026','11/14/2026']) assert.equal(dates.parseAppDate(bad), '');
  assert.equal(dates.formatDate(''), '—'); assert.equal(dates.formatDate('11 Jul'), '11 Jul');
});
test('timestamps use India time while date-only values are never shifted', () => {
  assert.equal(dates.formatDate('2026-11-14T20:00:00Z'), '15/11/2026');
  assert.equal(dates.formatDateTime('2026-11-14T20:00:00Z'), '15/11/2026 01:30');
  assert.equal(dates.formatDate('2026-11-14'), '14/11/2026');
});
test('the shared date control validates real dates and ISO min/max boundaries', () => {
  assert.equal(dates.dateInputError('14/11/2026','2026-11-01','2026-11-14'), '');
  assert.match(dates.dateInputError('15/11/2026',undefined,'2026-11-14'), /14\/11\/2026/);
  assert.match(dates.dateInputError('31112026'), /real date/);
  assert.match(dates.dateInputError('1411'), /DD\/MM\/YYYY/);
});
test('the actual React date control renders DD/MM/YYYY and preserves ISO form submission', () => {
  const React = require('react');
  const { renderToStaticMarkup } = require('react-dom/server');
  const { DateInput, dateChangeEvent } = load('src/components/ui/date-input.tsx');
  const html = renderToStaticMarkup(React.createElement(DateInput, { name:'harvest_date', value:'2026-11-14', onChange() {}, required:true }));
  assert.match(html, /type="text"[^>]*value="14\/11\/2026"/);
  assert.match(html, /type="hidden" name="harvest_date" value="2026-11-14"/);
  assert.match(html, /placeholder="DD\/MM\/YYYY"/);
  const target = { value:'14/11/2026', name:'harvest_date' };
  const event = dateChangeEvent({ target, currentTarget:target }, '2026-11-14');
  assert.equal(event.target.value, '2026-11-14'); assert.equal(event.currentTarget.name, 'harvest_date'); assert.equal(target.value, '14/11/2026');
});
