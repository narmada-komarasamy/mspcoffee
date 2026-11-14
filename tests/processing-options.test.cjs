const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
function load(path, dependencies = {}) {
  const mod = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  new Function('require', 'module', 'exports', code)(name => {
    const dateDependency = require('./helpers/date-test-support.cjs')(name);
    if (dateDependency) return dateDependency;

    if (name in dependencies) return dependencies[name];
    if (name === './processing-options.json') return JSON.parse(fs.readFileSync('src/lib/processing-options.json', 'utf8'));
    return require(name);
  }, mod, mod.exports);
  return mod.exports;
}
const lib = load('src/lib/processing.ts');
const setup = { id: '2026-2027', start_date: '2026-04-01', revision: 1 };
function sample(fields = {}) { return { ...lib.emptyProcessingBatch(), harvest_date: '2026-11-01', processing_date: '2026-11-02', drying_started_on: '2026-11-04', field_name: 'All Fields', picking_round: 'Fly', variety: 'MIXED', ...fields }; }
function clean(row) { return lib.cleanProcessingBatch(row, setup, '2026-11-14'); }

test('estate dropdowns contain the workbook master fields before any batches have been saved', () => {
  const o = lib.PROCESSING_OPTIONS;
  assert.deepEqual(Object.fromEntries(Object.entries(o.fields).map(([k,v]) => [k,v.length])), { 'stanmore-estate': 22, bve: 10, 'moganad-estate': 35, 'orchardale-estate': 9, 'hidden-falls-estate': 11 });
  assert.ok(o.fields['stanmore-estate'].includes('Leclar'));
  assert.ok(o.fields.bve.includes('Pammandi Cholai'));
  assert.ok(!o.fields.bve.includes('Leclar'));
  assert.deepEqual(o.rounds, ['Fly', '1st Round', '2nd Round', '3rd Round', 'Stripping', 'Special', 'Award', 'Gleanings']);
  assert.equal(o.methods.length, 33);
  for (const list of [o.methods, o.dryingSurfaces, o.storageLocations, ...Object.values(o.fields)]) {
    assert.equal(list.length, new Set(list).size);
    assert.ok(list.every(v => v === v.trim() && !lib.isGowriOption(v)));
  }
});
test('Gleanings is always Regular and cupping accepts exactly Special or Regular', () => {
  assert.equal(clean(sample({ lot_type: 'Gleanings', quality_code: '2' })).quality_code, '2');
  assert.throws(() => clean(sample({ lot_type: 'Gleanings', quality_code: '1' })), /quality/);
  for (const code of ['1','2']) assert.equal(clean(sample({ lot_type: 'For Cupping', quality_code: code })).quality_code, code);
  for (const code of ['3','C1','Stripping']) assert.throws(() => clean(sample({ lot_type: 'For Cupping', quality_code: code })), /quality/);
});
test('lot base uses harvest date, not processing date, and separates regular and special', () => {
  const row = sample();
  assert.equal(lib.processingLotBase(row), 'SE01Nov26MIXED2');
  assert.equal(lib.processingLotBase({ ...row, quality_code: '1' }), 'SE01Nov26MIXED1');
  assert.equal(lib.processingLotBase({ ...row, estate: 'bve' }), 'BVE01Nov26MIXED2');
  assert.equal(lib.processingLotBase({ ...row, harvest_date: 'bad' }), '');
});
test('wet parchment calculations, floats and yard days follow the workbook without turning blanks into zero', () => {
  const row = clean(sample({ gross_kg: 1100, floats_kg: 100, wet_kg: 400, actual_dry_kg: 200, dried_on: '2026-11-10', godown_date: '2026-11-14' }));
  assert.equal(lib.processingNet(row), 1000);
  assert.equal(lib.processingWetOutturn(row), 40);
  assert.equal(lib.processingDryFromWet(row), 50);
  assert.equal(lib.processingOutturn(row), 20);
  assert.equal(lib.processingYardDays(row), 6);
  assert.equal(lib.processingYardDays({ ...row, dried_on: null }), null);
  assert.equal(lib.processingDryFromWet({ wet_kg: 0, actual_dry_kg: 100 }), null);
  assert.equal(lib.processingNet({ entry_version: 1, gross_kg: 1000, tare_kg: 10 }), 990);
  assert.throws(() => clean(sample({ harvest_date: '2026-11-03' })), /Harvest date/);
  assert.throws(() => clean(sample({ dried_on: '2026-11-10', godown_date: '2026-11-09' })), /Godown transfer/);
  assert.throws(() => clean(sample({ drying_surface: 'GE Brick' })), /Gowri/);
  assert.throws(() => clean(sample({ storage_location: 'Gowri Go-down' })), /Gowri/);
});

test('changing the estate resets the selected field and loads its list; cupping grade sets the normal or special process', () => {
  let cursor = 0;
  const state = [];
  const react = { useEffect() {}, useRef() { return { current: null }; }, useState(initial) {
    const index = cursor++;
    if (!(index in state)) state[index] = typeof initial === 'function' ? initial() : initial;
    return [state[index], value => { state[index] = typeof value === 'function' ? value(state[index]) : value; }];
  } };
  function Select() {}
  const Component = load('src/components/processing/ProcessingRegister.tsx', { react, 'next/link': {}, 'lucide-react': {}, '@/components/ui/button': {}, '@/lib/processing': lib, './processing.module.css': {}, './ProcessingSelect': { default: Select, __esModule: true } }).default;
  function render() { cursor = 0; return Component({}); }
  render(); state[0] = setup; state[3] = true; state[5] = false;
  function nodes(x) { if (Array.isArray(x)) return x.flatMap(nodes); return x && typeof x === 'object' ? [x, ...nodes(x.props?.children)] : []; }
  function select(tree, label) { return nodes(tree).find(x => x.type === Select && x.props.label === label); }
  let tree = render();
  assert.ok(select(tree, 'Field / block').props.options.includes('Leclar'));
  select(tree, 'Field / block').props.onChange('Leclar');
  tree = render();
  const estate = nodes(tree).find(x => x.type === 'label' && x.props.children[0] === 'Estate').props.children[1];
  estate.props.onChange({ target: { value: 'bve' } });
  tree = render();
  assert.equal(select(tree, 'Field / block').props.value, '');
  assert.ok(select(tree, 'Field / block').props.options.includes('Pammandi Cholai'));
  assert.ok(!select(tree, 'Field / block').props.options.includes('Leclar'));
  select(tree, 'Lot type').props.onChange('For Cupping'); tree = render();
  const quality = nodes(tree).find(x => x.type === 'label' && x.props.children[0] === 'Quality').props.children[1];
  assert.equal(select(tree, 'Processing method').props.value, 'MSP 90 + Special Washed');
  quality.props.onChange({ target: { value: '2' } }); tree = render();
  assert.equal(select(tree, 'Processing method').props.value, 'Naturals - No Fermentation');
});
