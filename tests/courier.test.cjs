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
test('date range, courier, payment and review filters drive the statement and CSV consistently',()=>{
 const script=fs.readFileSync('public/courier-app.html','utf8').match(/<script>([\s\S]*?)<\/script>/)[1];new vm.Script(script);
 const fields=Object.fromEntries(['search','filter','fromDate','toDate','courierFilter','paymentFilter','reviewFilter'].map(k=>[k,{value:''}]));fields.fromDate.value='2026-10-01';fields.toDate.value='2026-10-31';
 const shipments=[{recipientName:'A',sent:'2026-10-29',courier:'DHL',paymentStatus:'Paid',cost:'118.75',createdAt:'3'},{recipientName:'B',sent:'2026-10-01',courier:'VRL',cost:null,reviewRequired:true,createdAt:'2'},{recipientName:'C',sent:'2026-09-01',courier:'DHL',cost:0,createdAt:'1'}];
 const ctx={shipments,$:k=>fields[k]};vm.createContext(ctx);vm.runInContext(script.slice(script.indexOf('function validDateRange'),script.indexOf('function updateReport')),ctx);
 let list=ctx.filteredShipments();assert.equal(list.length,2);assert.equal(ctx.reportTotals(list).total,118.75);assert.equal(ctx.reportTotals(list).missing,1);
 fields.paymentFilter.value='Not recorded';assert.equal(ctx.filteredShipments().length,1);fields.reviewFilter.value='review';assert.equal(ctx.filteredShipments()[0].recipientName,'B');
 fields.paymentFilter.value='Paid';assert.equal(ctx.filteredShipments().length,0);
 assert(script.includes('const list=filteredShipments();if(!list.length)'));
 assert(!script.includes('localStorage'));
 assert(!script.includes('sampleRecipients'));
});
test('calendar ranges include both endpoints, cross months and allow either endpoint to be blank',()=>{
 const script=fs.readFileSync('public/courier-app.html','utf8').match(/<script>([\s\S]*?)<\/script>/)[1];
 const fields=Object.fromEntries(['search','filter','fromDate','toDate','courierFilter','paymentFilter','reviewFilter'].map(k=>[k,{value:''}]));
 const dates=['2026-04-30','2026-05-01','2026-05-31','2026-06-30','2026-07-01','2026-08-01','2026-08-15','2026-08-16'];
 const shipments=dates.map((sent,i)=>({sent,recipientName:'Package '+i,courier:'DHL',paymentStatus:'Paid',cost:10,createdAt:sent}));
 const ctx={shipments,$:k=>fields[k],labelDate:d=>d};vm.createContext(ctx);
 vm.runInContext(script.slice(script.indexOf('function validDateRange'),script.indexOf('function updateReport')),ctx);
 function range(from,to){fields.fromDate.value=from;fields.toDate.value=to;return Array.from(ctx.filteredShipments(),s=>s.sent).sort()}
 assert.deepEqual(range('2026-05-01','2026-06-30'),dates.slice(1,4));
 assert.equal(ctx.reportTotals(ctx.filteredShipments()).total,30);
 assert.equal(ctx.dateRangeLabel(),'2026-05-01 to 2026-06-30');
 assert.deepEqual(range('2026-08-01','2026-08-15'),dates.slice(5,7));
 assert.deepEqual(range('2026-08-15','2026-08-15'),['2026-08-15']);
 assert.deepEqual(range('','2026-05-01'),dates.slice(0,2));
 assert.equal(ctx.dateRangeLabel(),'2025-04-01 to 2026-05-01');
 assert.deepEqual(range('2026-08-15',''),dates.slice(6));
 assert.equal(ctx.dateRangeLabel(),'From 2026-08-15');
 assert.equal(range('','').length,dates.length);
 assert.equal(ctx.dateRangeLabel(),'From 2025-04-01');
 assert.deepEqual(range('2026-06-30','2026-05-01'),[]);
 assert.equal(ctx.validDateRange(),false);
 assert.equal(ctx.dateRangeLabel(),'Invalid date range');
});
test('CSV, printed statement and clear filters use the calendar range',async()=>{
 const script=fs.readFileSync('public/courier-app.html','utf8').match(/<script>([\s\S]*?)<\/script>/)[1];
 const fields=Object.fromEntries(['search','filter','fromDate','toDate','courierFilter','paymentFilter','reviewFilter','export','clearFilters','printReport','dateRangeError','printPeriod','printStamp','reportTotal','reportMissing'].map(k=>[k,{value:'',replaceChildren(){}}]));
 fields.fromDate.value='2026-05-01';fields.toDate.value='2026-06-30';
 const shipments=[{sent:'2026-05-01',recipientName:'Included',courier:'DHL',cost:20,createdAt:'1'},{sent:'2026-07-01',recipientName:'Excluded',courier:'DHL',cost:100,createdAt:'2'}];
 let blob,link,printed=false,renders=0,message;
 const ctx={shipments,$:k=>fields[k],labelDate:d=>d,money:v=>String(v),Option:function(){},Blob,
  URL:{createObjectURL(b){blob=b;return 'blob:test'},revokeObjectURL(){}},document:{createElement(){return link={click(){}}}},
  setTimeout(){},toast:m=>message=m,render:()=>{renders++;ctx.updateReport(ctx.filteredShipments())},window:{print:()=>printed=true}};
 vm.createContext(ctx);
 vm.runInContext(script.slice(script.indexOf('function csv'),script.indexOf("$('uploadTracking').onclick")),ctx);
 vm.runInContext(script.slice(script.indexOf('function validDateRange'),script.indexOf("$('fromDate').value='2025-04-01'")),ctx);
 vm.runInContext(script.slice(script.indexOf('function updateDateRange'),script.indexOf("window.addEventListener('beforeprint'")),ctx);
 fields.export.onclick();
 assert.equal(link.download,'msp-courier-2026-05-01-to-2026-06-30.csv');
 const data=await blob.text();assert(data.includes('Included'));assert(!data.includes('Excluded'));
 fields.printReport.onclick();assert(printed);assert(fields.printPeriod.textContent.startsWith('2026-05-01 to 2026-06-30'));assert(fields.reportTotal.textContent.includes('Total recorded cost: 20'));
 fields.fromDate.value='2026-07-01';printed=false;blob=null;
 fields.fromDate.onchange();assert.equal(fields.dateRangeError.hidden,false);
 fields.export.onclick();fields.printReport.onclick();assert.equal(blob,null);assert.equal(printed,false);assert(message.includes('From date'));
 fields.clearFilters.onclick();assert.equal(fields.fromDate.value,'2025-04-01');assert.equal(fields.toDate.value,'');assert.equal(fields.fromDate.max,'');assert.equal(fields.toDate.min,'2025-04-01');assert.equal(fields.dateRangeError.hidden,true);assert.equal(ctx.filteredShipments().length,2);assert(renders>0);
});
test('historical scope excludes older entries from unbounded searches and totals',()=>{
 const script=fs.readFileSync('public/courier-app.html','utf8').match(/<script>([\s\S]*?)<\/script>/)[1];
 const fields=Object.fromEntries(['search','filter','fromDate','toDate','courierFilter','paymentFilter','reviewFilter'].map(k=>[k,{value:''}]));
 const shipments=[{sent:'2022-03-01',cost:900,createdAt:'1'},{sent:'2025-03-31',cost:100,createdAt:'2'},{sent:'2025-04-01',cost:20,createdAt:'3'}];
 const ctx={shipments,$:k=>fields[k],labelDate:d=>d};vm.createContext(ctx);
 vm.runInContext(script.slice(script.indexOf('function validDateRange'),script.indexOf('function updateReport')),ctx);
 assert.equal(ctx.filteredShipments().length,1);assert.equal(ctx.reportTotals(ctx.filteredShipments()).total,20);
 fields.fromDate.value='2022-01-01';assert.equal(ctx.validDateRange(),false);assert.equal(ctx.filteredShipments().length,0);
 assert.throws(()=>lib.cleanShipment({...base,sent:'2025-03-31'}));
});
test('confirmed imports retain provenance when editing and cannot acquire metadata from form fields',()=>{
 const previous={confirmedBy:'Ashok',registerPage:6,registerRow:3,importBatch:'confirmed',sourceNotes:'Original note',sent:'2025-07-02'};
 const fields=lib.cleanShipment({...base,confirmedBy:'Invented',registerPage:999});
 const saved=lib.shipmentDataForSave(previous,fields);
 assert.equal(saved.confirmedBy,'Ashok');assert.equal(saved.registerPage,6);assert.equal(saved.sourceNotes,'Original note');assert.equal(saved.sent,base.sent);
 assert.equal(lib.cleanShipment({...base,courier:'ddtc'}).courier,'DTDC');
});
test('historical unknown hand delivery person can stay unknown without weakening new dispatch validation',()=>{
 const input={...base,courier:'Hand delivered',tracking:'',deliveredBy:'',status:'Not recorded'};
 assert.throws(()=>lib.cleanShipment(input));
 const previous={source_ref:'register:row-6',data:{courier:'Hand delivered',deliveredBy:''}};
 assert.equal(lib.cleanShipment(input,previous).deliveredBy,'');
 assert.throws(()=>lib.cleanShipment({...input,status:'Delivered'},previous));
 assert.throws(()=>lib.cleanShipment(input,{source_ref:'register:row-6',data:{courier:'DHL'}}));
});
test('receipt restrictions fit the hosting upload limit',()=>{
 assert.equal(lib.fileError({type:'application/pdf',size:4096}),'');
 assert(lib.fileError({type:'text/html',size:4096}));assert(lib.fileError({type:'image/png',size:5*1024*1024}));
});
test('November dispatches need recipient destination and sender details while charges may wait',()=>{
 assert.throws(()=>lib.cleanShipment({...base,sent:'2026-11-01'}));
 const ready={...base,sent:'2026-11-01',address:'Recipient street address',city:'Chennai',onBehalfOf:'Moganad Estate'};
 assert.equal(lib.cleanShipment(ready).cost,null);
 assert.equal(lib.cleanShipment({...ready,status:'Pending',tracking:''}).status,'Pending');
});
