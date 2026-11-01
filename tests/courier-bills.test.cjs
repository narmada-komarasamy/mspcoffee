const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const ts=require('typescript');
const {NextResponse}=require('next/server');
function load(path,deps={}){const mod={exports:{}};new Function('exports','module','require',ts.transpileModule(fs.readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(mod.exports,mod,key=>key==='next/server'?{NextResponse}:key in deps?deps[key]:require(key));return mod.exports;}
const paymentLib=load('src/lib/courier-bills.ts'),matching=load('src/lib/courier-reconciliation.ts'),courier=load('src/lib/courier.ts');
const uuid={UUID_RE:/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i};
const id='aa6b7734-6782-4a93-ae73-5fcb380cf125',context={params:Promise.resolve({id})};
const invoice={courier:'DHL',currency:'INR',invoiceNumber:'INV-1',invoiceDate:'2026-11-30',periodFrom:'2026-11-01',periodTo:'2026-11-30',billedTo:'MSP',subtotal:100,fuel:0,cgst:9,sgst:9,igst:0,other:0,rounding:0,total:118,warnings:[],lines:[{id:'line-1',tracking:'AWB123',sent:'2026-11-05',destination:'Salem',amount:100,totalIncludingTax:118}]};
const shipments=[{id:'ship-1',courier:'DHL',sent:'2026-11-05',recipientName:'Recipient',tracking:'AWB123',city:'Salem',cost:null,updatedAt:'2026-11-05T12:00:00Z'}];
const request=body=>new Request('http://localhost/api/courier/bills/'+id,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
const payment={paidOn:'2026-12-05',amount:118,deduction:0,deductionReason:'',method:'Bank transfer',reference:'BANK-123'};
function mockDB(bill={id,invoice,status:'draft',version:1}){const calls=[];return {calls,from(){return {select(){return this},eq(){return this},maybeSingle:async()=>({data:bill,error:null})};},rpc:async(name,args)=>{calls.push({name,args});return {data:id,error:null}}};}
function approver(db,allowed=true,rows=shipments){return load('src/app/api/courier/bills/[id]/approve/route.ts',{'../../../_auth':{courierAuth:async()=>({supabase:db,user:{id:'real-account'}})},'@/lib/auth/api':uuid,'@/lib/courier-reconciliation':matching,'../../_shared':{billApprover:async()=>allowed,billShipments:async()=>rows,billError:e=>NextResponse.json({error:e.message},{status:409})}});}
const review={version:1,originalChecked:true,reviewNote:'Checked the full original invoice and all totals',deferrals:{}};

test('payments require exact full settlement and explained deductions',()=>{
 assert.equal(paymentLib.validatePayment(payment,118).amount,118);
 assert.throws(()=>paymentLib.validatePayment({...payment,amount:100},118),/full bill/);
 assert.throws(()=>paymentLib.validatePayment({...payment,amount:100,deduction:18},118),/Explain/);
 assert.equal(paymentLib.validatePayment({...payment,amount:100,deduction:18,deductionReason:'Documented deduction per accounts voucher'},118).deduction,18);
 for(const patch of [{amount:118.001},{amount:-118},{paidOn:'2026-02-30'},{reference:''},{method:'Crypto'}])assert.throws(()=>paymentLib.validatePayment({...payment,...patch},118));
});
test('private original uploads require real file signatures',()=>{
 assert.equal(paymentLib.originalFileType(Buffer.from('%PDF-1.7'),'application/pdf'),true);
 assert.equal(paymentLib.originalFileType(Buffer.from('<html>fake</html>'),'application/pdf'),false);
 assert.equal(paymentLib.originalFileType(new Uint8Array([137,80,78,71,13,10,26,10]),'image/png'),true);
 assert.equal(paymentLib.originalFileType(new Uint8Array([137]),'image/png'),false);
 assert.equal(paymentLib.originalFileType(Buffer.from('RIFF1234WEBP'),'image/webp'),true);
});
test('every permanent bill endpoint requires authorization before any storage or database access',async()=>{
 const deny=async()=>({error:NextResponse.json({error:'Unauthorized'},{status:401})});
 const shared={billApprover:async()=>{throw Error('Unexpected access')},billShipments:async()=>{throw Error('Unexpected access')},billError:()=>{throw Error('Unexpected access')}};
 const deps={'@/lib/auth/api':uuid,'@/lib/courier':courier,'@/lib/courier-reconciliation':matching,'@/lib/courier-bills':paymentLib,'../_auth':{courierAuth:deny},'../../_auth':{courierAuth:deny},'../../../_auth':{courierAuth:deny},'./_shared':shared,'../_shared':shared,'../../_shared':shared};
 for(const [path,methods] of [['route.ts',['GET','POST']],['[id]/route.ts',['GET','PATCH']],['[id]/approve/route.ts',['POST']],['[id]/payment/route.ts',['POST']],['[id]/original/route.ts',['GET']]]){const route=load('src/app/api/courier/bills/'+path,deps);for(const method of methods)assert.equal((await route[method](request({}),context)).status,401);}
});
test('an unassigned user cannot approve even a perfectly matched bill',async()=>{const db=mockDB();const response=await approver(db,false).POST(request(review),context);assert.equal(response.status,403);assert.equal(db.calls.length,0);});
test('approval reloads dispatches, ignores forged browser links and records the authenticated account',async()=>{
 const db=mockDB();const response=await approver(db).POST(request({...review,p_actor:'forged',links:[{shipmentId:'forged'}]}),context);
 assert.equal(response.status,200);assert.equal(db.calls[0].name,'approve_courier_bill');assert.equal(db.calls[0].args.p_actor,'real-account');assert.deepEqual(db.calls[0].args.p_links,[{lineId:'line-1',shipmentId:'ship-1',updatedAt:shipments[0].updatedAt}]);
});
test('stale versions and changed dispatches block approval',async()=>{
 const db=mockDB();assert.equal((await approver(db).POST(request({...review,version:0}),context)).status,409);
 assert.equal((await approver(db,true,[{...shipments[0],sent:'2026-11-06'}]).POST(request(review),context)).status,400);assert.equal(db.calls.length,0);
});
test('missing dispatches need individual deferral notes; original review is mandatory',async()=>{
 const db=mockDB(),rows=[...shipments,{...shipments[0],id:'late-dispatch',tracking:'AWB456'}];const route=approver(db,true,rows);
 assert.equal((await route.POST(request(review),context)).status,400);
 assert.equal((await route.POST(request({...review,originalChecked:false}),context)).status,400);
 assert.equal((await route.POST(request({...review,deferrals:{'late-dispatch':'Courier confirmed billing in December'} }),context)).status,200);
 assert.equal(db.calls[0].args.p_deferrals[0].shipmentId,'late-dispatch');
});
test('retrying an already stored original reopens it without a duplicate upload',async()=>{
 const {createHash}=require('node:crypto'),bytes=Buffer.from('%PDF-1.7 fixture');let uploaded=0;
 const db={from(){return {select(){return this},or:async()=>({data:[{id,original_hash:createHash('sha256').update(bytes).digest('hex')}],error:null})}},storage:{from(){uploaded++;throw Error('No upload expected')}}};
 const route=load('src/app/api/courier/bills/route.ts',{'../_auth':{courierAuth:async()=>({supabase:db,user:{id:'real-account'}})},'@/lib/courier':courier,'@/lib/auth/api':uuid,'@/lib/courier-reconciliation':matching,'@/lib/courier-bills':paymentLib,'./_shared':{billError:()=>{},billApprover:()=>true}});
 const form=new FormData();form.set('id',id);form.set('invoice',JSON.stringify(invoice));form.set('file',new File([bytes],'bill.pdf',{type:'application/pdf'}));const response=await route.POST(new Request('http://localhost/api/courier/bills',{method:'POST',body:form}));
 assert.equal(response.status,200);assert.equal((await response.json()).id,id);assert.equal(uploaded,0);
});
test('already reconciled dispatches do not become false missing rows for another bill',()=>{
 const rows=[...shipments,{...shipments[0],tracking:'AWB456',reconciledInvoiceNumber:'OLDER-INVOICE'}];assert.equal(matching.reconciliation(invoice,rows).unbilled.length,0);
});

test('the downloadable report uses frozen dispatch snapshots and escapes spreadsheet formulas',()=>{
 const {billReportCSV}=load('src/lib/courier-bill-report.ts');
 const csv=billReportCSV({invoice,status:'approved',approved_at:'2026-12-05',approved_by:'admin'},null,[{line_id:'line-1',shipment_id:'ship-1',shipment_snapshot:{recipientName:'=HYPERLINK("example")',onBehalfOf:'MSP'}}]);
 assert(csv.includes('"Invoice total","118"'));assert(csv.includes('"\'=HYPERLINK(""example"")"'));assert(csv.includes('"AWB123"'));assert(csv.includes('"Approved by account","admin"'));
});

test('an upload retry recovers a stored original after an earlier save failed',async()=>{
 let saved=0;
 const db={from(){return {select(){return this},or:async()=>({data:[],error:null})}},storage:{from(){return {upload:async()=>({error:{statusCode:'409'}})}}},rpc:async()=>{saved++;return {data:id,error:null}}};
 const route=load('src/app/api/courier/bills/route.ts',{'../_auth':{courierAuth:async()=>({supabase:db,user:{id:'real-account'}})},'@/lib/courier':courier,'@/lib/auth/api':uuid,'@/lib/courier-reconciliation':matching,'@/lib/courier-bills':paymentLib,'./_shared':{billError:()=>{},billApprover:()=>true}});
 const form=new FormData();form.set('id',id);form.set('invoice',JSON.stringify(invoice));form.set('file',new File(['%PDF-1.7 fixture'],'bill.pdf',{type:'application/pdf'}));const response=await route.POST(new Request('http://localhost/api/courier/bills',{method:'POST',body:form}));
 assert.equal(response.status,200);assert.equal(saved,1);
});
