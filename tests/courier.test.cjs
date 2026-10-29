const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const ts=require('typescript');
const mod={exports:{}};
new Function('exports','module',ts.transpileModule(fs.readFileSync('src/lib/courier.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(mod.exports,mod);
const lib=mod.exports;
const base={recipientName:'Test recipient',courier:'DHL',sent:'2026-10-29',tracking:'12345',status:'Dispatched',paymentStatus:'Unpaid',cost:''};
test('missing historical costs remain null; zero and GST-inclusive amounts are preserved',()=>{
 assert.equal(lib.cleanShipment(base).cost,null);
 assert.equal(lib.cleanShipment({...base,cost:'0'}).cost,0);
 assert.equal(lib.cleanShipment({...base,cost:'118.75',onBehalfOf:'GTE',invoiceNumber:'INV-1'}).cost,118.75);
 for(const cost of ['-1','NaN','12.345','Infinity'])assert.throws(()=>lib.cleanShipment({...base,cost}));
});
test('tracking, hand delivery names, dates and statuses are validated server side',()=>{
 assert.throws(()=>lib.cleanShipment({...base,tracking:''}));
 assert.throws(()=>lib.cleanShipment({...base,courier:'Hand delivered',tracking:''}));
 assert.equal(lib.cleanShipment({...base,courier:'Hand delivered',tracking:'',deliveredBy:'C. Mani'}).deliveredBy,'C. Mani');
 assert.throws(()=>lib.cleanShipment({...base,sent:'2026-02-30'}));
 assert.throws(()=>lib.cleanShipment({...base,expected:'2026-10-28'}));
 assert.throws(()=>lib.cleanShipment({...base,paymentStatus:'Invented'}));
 assert.equal(lib.cleanShipment({...base,status:'Not recorded',paymentStatus:'Not recorded',tracking:''}).status,'Not recorded');
});
test('monthly, courier, payment and review filters drive the statement and CSV consistently',()=>{
 const script=fs.readFileSync('public/courier-app.html','utf8').match(/<script>([\s\S]*?)<\/script>/)[1];new vm.Script(script);
 const fields=Object.fromEntries(['search','filter','monthFilter','courierFilter','paymentFilter','reviewFilter'].map(k=>[k,{value:''}]));fields.monthFilter.value='2026-10';
 const shipments=[{recipientName:'A',sent:'2026-10-29',courier:'DHL',paymentStatus:'Paid',cost:'118.75',createdAt:'3'},{recipientName:'B',sent:'2026-10-01',courier:'VRL',cost:null,reviewRequired:true,createdAt:'2'},{recipientName:'C',sent:'2026-09-01',courier:'DHL',cost:0,createdAt:'1'}];
 const ctx={shipments,$:k=>fields[k]};vm.createContext(ctx);vm.runInContext(script.slice(script.indexOf('function filteredShipments'),script.indexOf('function updateReport')),ctx);
 let list=ctx.filteredShipments();assert.equal(list.length,2);assert.equal(ctx.reportTotals(list).total,118.75);assert.equal(ctx.reportTotals(list).missing,1);
 fields.paymentFilter.value='Not recorded';assert.equal(ctx.filteredShipments().length,1);fields.reviewFilter.value='review';assert.equal(ctx.filteredShipments()[0].recipientName,'B');
 fields.paymentFilter.value='Paid';assert.equal(ctx.filteredShipments().length,0);
 assert(script.includes('const list=filteredShipments();if(!list.length)'));
 assert(!script.includes('localStorage'));
 assert(!script.includes('sampleRecipients'));
});
test('receipt restrictions fit the hosting upload limit',()=>{
 assert.equal(lib.fileError({type:'application/pdf',size:4096}),'');
 assert(lib.fileError({type:'text/html',size:4096}));assert(lib.fileError({type:'image/png',size:5*1024*1024}));
});
