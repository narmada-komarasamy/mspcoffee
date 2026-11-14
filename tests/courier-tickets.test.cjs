const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const ts=require('typescript');
const {NextResponse}=require('next/server');
function load(path,deps={}){const mod={exports:{}};new Function('exports','module','require',ts.transpileModule(fs.readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(mod.exports,mod,name=>{
    const dateDependency = require('./helpers/date-test-support.cjs')(name);
    if (dateDependency) return dateDependency;
if(name==='next/server')return {NextResponse};if(name in deps)return deps[name];throw Error(name)});return mod.exports;}
const courier=load('src/lib/courier.ts');
const tickets=load('src/lib/courier-tickets.ts',{'@/lib/courier':courier});
const print=load('src/lib/courier-print.ts',{'@/lib/courier':courier,'@/lib/courier-tickets':tickets});
const authApi=load('src/lib/auth/api.ts',{'@/lib/supabase/admin':{},'@/lib/supabase/server':{}});
const id='aa6b7734-6782-4a93-ae73-5fcb380cf125';
const ticket={id,shipment_id:id,ticket_number:3,revision:1,status:'Open',owner:'Ramesh',problem:'Missing',next_followup:null,history:[],created_at:'2026-11-02T00:00:00Z'};
const route=(file,auth)=>load(file,{'../_auth':{courierAuth:auth},'../../_auth':{courierAuth:auth},'../../../_auth':{courierAuth:auth},'@/lib/auth/api':authApi,'@/lib/courier':courier,'@/lib/courier-tickets':tickets,'@/lib/courier-print':print});
const req=(body,method='POST')=>new Request('https://example.com/api/courier/tickets',{method,headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});

test('ticket validation requires accountable owner, valid date, and a resolution note',()=>{
 const base={status:'Following up',owner:'Ramesh',problem:'Missing',nextFollowup:'2026-11-03'};
 assert.equal(tickets.ticketFields(base).next_followup,'2026-11-03');
 for(const bad of [{owner:''},{problem:''},{status:'Invented'},{nextFollowup:'2026-02-30'},{status:'Resolved'}])assert.throws(()=>tickets.ticketFields({...base,...bad}));
 assert.equal(tickets.ticketFields({...base,status:'Resolved',note:'Delivered'}).note,'Delivered');
});
test('labels and tickets escape shipment text and use the confirmed shared return address',()=>{
 const hostile='<script>alert(1)</script>';
 const shipment={onBehalfOf:hostile,recipientName:'Recipient',address:'Address',courier:'DHL',tracking:hostile,cost:null};
 const label=print.labelHtml(shipment);const sheet=print.ticketHtml({...ticket,problem:hostile},shipment,true);
 assert(!label.includes(hostile));assert(!sheet.includes(hostile));assert(label.includes('&lt;script&gt;'));
 assert(label.includes('94432 67682'));assert(label.includes('Semmanatham Post'));assert(sheet.includes('Cost not entered'));
 assert(sheet.includes('/api/courier/receipt?id='+id));assert(sheet.includes('MSP-TKT-00003'));
 assert.throws(()=>print.labelHtml({...shipment,onBehalfOf:''}));assert.throws(()=>print.labelHtml({...shipment,address:''}));
});
test('every ticket and print endpoint checks courier permission before data access',async()=>{
 const denied=async()=>({error:NextResponse.json({error:'Access denied'},{status:403})});
 for(const [file,method] of [['tickets/route.ts','GET'],['tickets/route.ts','POST'],['tickets/[id]/route.ts','PATCH'],['tickets/[id]/print/route.ts','GET'],['print-label/route.ts','POST']]){
  const handler=route('src/app/api/courier/'+file,denied);const response=await handler[method](method==='GET'?new Request('https://example.com'):req({},method),{params:Promise.resolve({id})});assert.equal(response.status,403);
 }
});
test('ticket creation verifies saved shipment and duplicate requests reopen the same record',async()=>{
 let inserted,scope;const supabase={from(table){return {select(){return this},eq(){return this},gte(key,value){scope=[key,value];return this},upsert(values,options){inserted={values,options};return this},async maybeSingle(){return {data:table==='courier_shipments'?{id,data:{}}:null,error:null}},async single(){return {data:ticket,error:null}}}}};
 const handler=route('src/app/api/courier/tickets/route.ts',async()=>({supabase,user:{id:'actor'}}));
 const response=await handler.POST(req({shipmentId:id,status:'Resolved',created_by:'forged'}));
 assert.equal(response.status,200);assert.equal((await response.json()).ticket.id,id);
 assert.deepEqual(inserted,{values:{shipment_id:id,created_by:'actor'},options:{onConflict:'shipment_id',ignoreDuplicates:true}});
 assert.deepEqual(scope,['data->>sent','2025-04-01']);
});
test('ticket updates preserve server history and reject stale revisions and lost update races',async()=>{
 let saved,race=false;const previous={...ticket,history:[{note:'Original'}]};
 const supabase={from(){let updating=false;return {select(){return this},eq(){return this},update(values){saved=values;updating=true;return this},async maybeSingle(){return {data:updating?(race?null:{...previous,...saved}):previous,error:null}}}}};
 const handler=route('src/app/api/courier/tickets/[id]/route.ts',async()=>({supabase,user:{id:'real-actor'}}));
 const details={revision:1,status:'Following up',owner:'Ramesh',problem:'Missing',note:'Contacted courier',history:[{note:'Forged'}]};
 let response=await handler.PATCH(req(details,'PATCH'),{params:Promise.resolve({id})});assert.equal(response.status,200);
 assert.equal(saved.revision,2);assert.equal(saved.history[0].note,'Original');assert.equal(saved.history[1].actor,'real-actor');
 saved=null;response=await handler.PATCH(req({...details,revision:2},'PATCH'),{params:Promise.resolve({id})});assert.equal(response.status,409);assert.equal(saved,null);
 race=true;response=await handler.PATCH(req(details,'PATCH'),{params:Promise.resolve({id})});assert.equal(response.status,409);
});
test('draft labels print without creating or updating shipments',async()=>{
 const handler=route('src/app/api/courier/print-label/route.ts',async()=>({user:{id:'actor'},supabase:{from(){throw Error('Unexpected database write')}}}));
 const form=new FormData();for(const [key,value] of Object.entries({onBehalfOf:'MSP Coffee',recipientName:'Sample',address:'Sample Road'}))form.set(key,value);
 const response=await handler.POST(new Request('https://example.com/api/courier/print-label',{method:'POST',body:form}));assert.equal(response.status,200);assert.equal(response.headers.get('Cache-Control'),'private, no-store');
 assert((await response.text()).includes('FROM'));
});
test('ticket list fetches every page and browser scripts parse',async()=>{
 let calls=0;const supabase={from(){return {select(){return this},order(){return this},async range(){calls++;return {data:calls===1?Array(500).fill(ticket):[ticket],error:null}}}}};
 const handler=route('src/app/api/courier/tickets/route.ts',async()=>({supabase}));const response=await handler.GET(new Request('https://example.com'));assert.equal((await response.json()).tickets.length,501);
 new vm.Script(fs.readFileSync('public/courier-tools.js','utf8'));new vm.Script(fs.readFileSync('public/courier-print.js','utf8'));
});
