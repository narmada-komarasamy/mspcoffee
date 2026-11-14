const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const mod = { exports:{} };
const code = ts.transpileModule(fs.readFileSync('src/lib/processing.ts','utf8'), { compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true} }).outputText;
new Function('require','module','exports',code)(name => name === './processing-options.json' ? require('../src/lib/processing-options.json') : require(name), mod, mod.exports);
const lib = mod.exports;
const season = {id:'2026-2027',start_date:'2026-04-01',revision:1};
function entry(extra={}) { return {...lib.emptyProcessingBatch(),harvest_date:'2026-11-01',processing_date:'2026-11-01',drying_started_on:'2026-11-04',field_name:'All Fields',variety:'MIXED',picking_round:'1st Round',method:'MSP 90 + Special Washed',lot_type:'Special',quality_code:'1',fermentation_hours:76,...extra}; }
const clean = row => lib.cleanProcessingBatch(row, season, '2026-11-14');
test('actual fermentation hours are manual and independent of calendar-date differences',()=>{
  for(const hours of [46,76,86,86.5]) assert.equal(clean(entry({fermentation_hours:hours})).fermentation_hours,hours);
  assert.equal(clean(entry({fermentation_hours:null})).fermentation_hours,null);
  assert.throws(()=>clean(entry({fermentation_hours:-1})),/fermentation hours/);
});
test('no-fermentation methods always use zero and cannot be marked Fermenting',()=>{
  for(const method of ['Naturals - No Fermentation','Washed - No Fermentation','PSD - Black (No Fermentation)']) {
    assert.equal(clean(entry({method,fermentation_hours:86})).fermentation_hours,0);
    assert.throws(()=>clean(entry({method,stage:'Fermenting'})),/directly to drying/);
  }
});
test('yard days start when the batch goes onto the table and end when bagged, excluding godown delay',()=>{
  const row = clean(entry({dried_on:'2026-11-12',godown_date:'2026-11-14'}));
  assert.equal(lib.processingYardDays(row),8);
  assert.equal(lib.processingYardDays({...row,harvest_date:'2026-10-30',godown_date:null}),8);
  assert.equal(lib.processingYardDays({...row,dried_on:null}),null);
  assert.equal(lib.processingYardDays({drying_started_on:'2026-12-29',dried_on:'2027-01-02'}),4);
  assert.equal(lib.processingYardDays({drying_started_on:'2026-11-04',dried_on:'2026-11-04'}),0);
});
test('drying, bagging and completion validation follows the actual processing timeline',()=>{
  assert.throws(()=>clean(entry({drying_started_on:'2026-10-31'})),/Put out to dry/);
  assert.throws(()=>clean(entry({drying_started_on:'2026-11-15'})),/Put out to dry/);
  assert.throws(()=>clean(entry({drying_started_on:null})),/put out to dry/);
  assert.throws(()=>clean(entry({dried_on:'2026-11-03'})),/Bagged and weighed/);
  assert.throws(()=>clean(entry({status:'Complete',stage:'Dried',gross_kg:1000,floats_kg:0,actual_dry_kg:250,moisture:11.5,dried_on:'2026-11-12',fermentation_hours:null})),/fermentation hours/);
});
