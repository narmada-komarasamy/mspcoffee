const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const ts=require('typescript');
function load(path){const mod={exports:{}};new Function('exports','module',ts.transpileModule(fs.readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(mod.exports,mod);return mod.exports;}
const {reconciliation,dispatchReadiness,cleanBill,trackingKey}=load('src/lib/courier-reconciliation.ts');
const {practiceData}=load('src/lib/courier-reconciliation-practice.ts');
const {sampleBill}=load('src/lib/courier-reconciliation-samples.ts');
function fixture(){return practiceData(true);}

test('a complete, balanced practice invoice is ready for a separate approval step',()=>{
 const {bill,shipments}=fixture();const result=reconciliation(bill,shipments);
 assert.equal(result.matched,5);assert.equal(result.canApprove,true);assert.equal(result.totalDifference,0);
 assert.equal(result.unbilled.length,0);assert.equal(result.lineDifference,0);
 assert.equal(shipments[0].cost,null);assert.equal(shipments[0].invoiceNumber,undefined);
});
test('duplicate invoice lines and missing dispatches block approval',()=>{
 const {bill,shipments}=practiceData(false);const result=reconciliation(bill,shipments);
 assert.equal(result.rows.filter(r=>r.status==='duplicate').length,2);
 assert.equal(result.rows.filter(r=>r.status==='not_found').length,1);
 assert.equal(result.unbilled.length,1);assert.equal(result.canApprove,false);
});
test('matching requires the same courier and AWB, never a recipient name alone',()=>{
 const {bill,shipments}=fixture();shipments[0].courier='DTDC';shipments[1].tracking='';
 let result=reconciliation(bill,shipments);assert.equal(result.rows[0].status,'not_found');assert.equal(result.rows[1].status,'not_found');
 shipments[2].tracking=' example-nov-003 ';result=reconciliation(bill,shipments);assert.equal(result.rows[2].status,'matched');
 assert.notEqual(trackingKey('AB-123'),trackingKey('AB123'));
});
test('dispatch dates and destinations must agree with an exact consignment match',()=>{
 const {bill,shipments}=fixture();shipments[0].sent='2026-11-03';shipments[1].city='Madurai';
 const result=reconciliation(bill,shipments);assert.equal(result.rows[0].status,'date_difference');assert.equal(result.rows[1].status,'destination_difference');assert.equal(result.canApprove,false);
});
test('invoice-level fuel, GST and rounding are checked without guessing per-line tax',()=>{
 const {bill,shipments}=fixture();shipments[0].cost=177;delete bill.lines[0].totalIncludingTax;
 bill.fuel=20;bill.cgst=54.90;bill.sgst=54.90;bill.rounding=0.20;bill.total=720;
 const result=reconciliation(bill,shipments);assert.equal(result.rows[0].status,'matched');assert.equal(result.calculatedTotal,720);assert.equal(result.canApprove,true);
 bill.total=719;assert.notEqual(reconciliation(bill,shipments).totalDifference,0);assert.equal(reconciliation(bill,shipments).canApprove,false);
});
test('like-for-like charge differences, negative amounts and unreadable amounts block approval',()=>{
 const {bill,shipments}=fixture();shipments[0].cost=149;bill.lines[1].amount=null;bill.lines[2].amount=-1;
 const result=reconciliation(bill,shipments);assert.equal(result.rows[0].status,'cost_difference');assert.equal(result.rows[1].status,'invalid_line');assert.equal(result.rows[2].status,'invalid_line');assert.equal(result.canApprove,false);
});
test('ambiguous register matches and shipments already on another invoice block double billing',()=>{
 const {bill,shipments}=fixture();shipments.push({...shipments[0],id:'duplicate-register'});shipments[1].reconciledInvoiceNumber='OLD-INVOICE';
 const result=reconciliation(bill,shipments);assert.equal(result.rows[0].status,'ambiguous');assert.equal(result.rows[1].status,'already_billed');assert.equal(result.canApprove,false);
});
test('supplied bill excerpts keep original September dates, preserve actual totals and cannot be approved as complete',()=>{
 for(const key of ['professional','dtdc']){const bill=sampleBill(key);const result=reconciliation(bill,[]);assert.equal(bill.periodFrom,'2026-09-01');assert.equal(result.canApprove,false);assert.notEqual(result.lineDifference,0);assert(bill.warnings.length);}
 assert.equal(sampleBill('professional').total,2772);assert.equal(sampleBill('dtdc').total,23529);assert.equal(reconciliation(sampleBill('dtdc'),[]).totalDifference,0.20);
});
test('invalid periods, missing charges and foreign currencies cannot pass approval',()=>{
 const {bill,shipments}=fixture();bill.fuel=null;bill.currency='USD';bill.periodTo='2026-02-30';
 const result=reconciliation(bill,shipments);assert.equal(result.canApprove,false);assert(result.issues.some(s=>s.includes('currency')));assert(result.issues.some(s=>s.includes('period')));assert.equal(result.calculatedTotal,null);
});
test('November readiness excludes hand deliveries and treats unknown charges as acceptable',()=>{
 const {shipments}=fixture();shipments.push({...shipments[0],id:'old',sent:'2026-10-31'},{...shipments[0],id:'hand',courier:'Hand delivered',tracking:''});
 assert.deepEqual(dispatchReadiness(shipments),{total:5,missingTracking:0,missingCourier:0,missingRecipientDetails:0,missingSender:0,ready:5});
 shipments[0].tracking='';shipments[1].city='';shipments[2].onBehalfOf='';assert.equal(dispatchReadiness(shipments).ready,2);
});
test('the bill reader accepts only structured amounts, keeps nulls, and rejects excessive rows',()=>{
 const {bill}=fixture();const cleaned=cleanBill({...bill,fuel:'unknown',lines:[{tracking:'  ABC123 ',sent:'2026-11-01',destination:'Salem',amount:null}]});
 assert.equal(cleaned.fuel,null);assert.equal(cleaned.lines[0].amount,null);assert.equal(cleaned.lines[0].tracking,'ABC123');
 assert.throws(()=>cleanBill(null));assert.throws(()=>cleanBill({...bill,lines:Array(501).fill({})}));
});
