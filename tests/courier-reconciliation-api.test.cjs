const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const ts=require('typescript');
const {NextResponse}=require('next/server');
function load(path,deps={}){const mod={exports:{}};new Function('exports','module','require',ts.transpileModule(fs.readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(mod.exports,mod,key=>{ const dateDependency = require('./helpers/date-test-support.cjs')(key); if (dateDependency) return dateDependency; return key==='next/server'?{NextResponse}:key in deps?deps[key]:(()=>{throw Error(key)})(); });return mod.exports;}
const lib=load('src/lib/courier.ts'),matching=load('src/lib/courier-reconciliation.ts'),samples=load('src/lib/courier-reconciliation-samples.ts');
function extract(auth){return load('src/app/api/courier/reconciliation/extract/route.ts',{'../../_auth':{courierAuth:auth},'@/lib/courier':lib,'@/lib/courier-reconciliation':matching,'@/lib/auth/rate-limit':{checkRateLimit:()=>({}),rateLimitKey:()=>''}});}
function fileRequest(){const form=new FormData();form.set('file',new File(['fixture'],'bill.pdf',{type:'application/pdf'}));return new Request('http://localhost/api/courier/reconciliation/extract',{method:'POST',body:form});}

test('bill extraction requires write authorization and never writes invoice or payment data',async()=>{
 let write;
 const handler=extract(async(_request,w)=>{write=w;return {error:NextResponse.json({error:'Access denied'},{status:403})};});
 assert.equal((await handler.POST(fileRequest())).status,403);assert.equal(write,true);
});
test('bill sample preview requires authentication',async()=>{
 const handler=load('src/app/api/courier/reconciliation/preview/route.ts',{'../../_auth':{courierAuth:async()=>({error:NextResponse.json({error:'Unauthorized'},{status:401})})},'@/lib/courier':lib,'@/lib/courier-reconciliation-samples':samples});
 assert.equal((await handler.GET(new Request('http://localhost/api/courier/reconciliation/preview?sample=professional'))).status,401);
});
test('a missing local document reader key produces a clear fallback without an external request',async()=>{
 const keys=['OPENAI_API_KEY','OPENAI_FLEET_PARSE_API_KEY','OPENAI_KEY'];const saved=keys.map(k=>process.env[k]);let calls=0;const prior=global.fetch;
 try{keys.forEach(k=>delete process.env[k]);global.fetch=async()=>{calls++;throw Error('No request expected')};const handler=extract(async()=>({user:{id:'tester'}}));const response=await handler.POST(fileRequest());assert.equal(response.status,503);assert.match((await response.json()).error,/not configured/);assert.equal(calls,0);}
 finally{global.fetch=prior;keys.forEach((k,i)=>saved[i]===undefined?delete process.env[k]:process.env[k]=saved[i]);}
});
test('incomplete model extraction is rejected rather than showing a partial bill as complete',async()=>{
 const before=process.env.OPENAI_API_KEY,prior=global.fetch;
 try{process.env.OPENAI_API_KEY='test-only';global.fetch=async()=>Response.json({status:'incomplete',output_text:'{}'});const handler=extract(async()=>({user:{id:'tester'}}));const response=await handler.POST(fileRequest());assert.equal(response.status,422);assert.match((await response.json()).error,/not read completely/);}
 finally{global.fetch=prior;if(before===undefined)delete process.env.OPENAI_API_KEY;else process.env.OPENAI_API_KEY=before;}
});
test('a completed extraction returns reviewed bill data without creating a shipment or marking payment',async()=>{
 const before=process.env.OPENAI_API_KEY,prior=global.fetch;let prompt;
 try{process.env.OPENAI_API_KEY='test-only';global.fetch=async(_url,options)=>{prompt=JSON.parse(options.body);return Response.json({status:'completed',output_text:JSON.stringify(samples.sampleBill('professional'))});};const handler=extract(async()=>({user:{id:'tester'}}));const response=await handler.POST(fileRequest());const data=await response.json();assert.equal(response.status,200);assert.equal(data.bill.invoiceNumber,'SINV823087');assert.equal(data.bill.lines.length,3);assert.equal(data.bill.currency,'INR');assert.equal(data.paymentStatus,undefined);assert(prompt.input[0].content[1].text.includes('Do not allocate invoice GST/fuel'));}
 finally{global.fetch=prior;if(before===undefined)delete process.env.OPENAI_API_KEY;else process.env.OPENAI_API_KEY=before;}
});
