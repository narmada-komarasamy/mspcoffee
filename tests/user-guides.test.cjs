const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const ts=require('typescript');
const {NextResponse}=require('next/server');
function load(file,dependencies){
 const mod={exports:{}};
 const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
 new Function('exports','module','require',code)(mod.exports,mod,name=>{
    const dateDependency = require('./helpers/date-test-support.cjs')(name);
    if (dateDependency) return dateDependency;

  if(name==='next/server')return {NextResponse};
  if(name in dependencies)return dependencies[name];
  if(name.startsWith('node:'))return require(name);
  throw Error('Unexpected import '+name);
 });return mod.exports;
}
const registry=load('src/lib/user-guides.ts',{});
const req=(suffix='')=>new Request('http://localhost/api/user-guides/courier-tracking'+suffix);
function handlers(status, overrides={}){
 const auth=async(_request,id)=>{ const code=overrides[id] ?? status; return code?{error:NextResponse.json({error:'Denied'},{status:code})}:{user:{id:'tester'}}; };
 return {
  list:load('src/app/api/user-guides/route.ts',{'@/lib/user-guide-auth':{userGuideAuth:auth},'@/lib/user-guides':registry}).GET,
  asset:load('src/app/api/user-guides/[id]/route.ts',{'@/lib/user-guide-auth':{userGuideAuth:auth},'@/lib/user-guides':registry}).GET,
 };
}
const context=(id='courier-tracking')=>({params:Promise.resolve({id})});
test('guide catalogue and every asset require a verified session',async()=>{
 const h=handlers(401);
 assert.equal((await h.list(req())).status,401);
 for(const query of ['','?download=1','?page=1','?page=2'])assert.equal((await h.asset(req(query),context())).status,401);
});
test('feature access denial hides the listing and blocks direct PDFs and previews',async()=>{
 const h=handlers(403),list=await h.list(req());
 assert.deepEqual(await list.json(),{guides:[]});
 assert.equal(list.headers.get('Cache-Control'),'private, no-store');
 for(const query of ['','?download=1','?page=1'])assert.equal((await h.asset(req(query),context())).status,403);
});
test('permission lookup failures fail closed rather than listing or serving a guide',async()=>{
 const h=handlers(503);
 assert.equal((await h.list(req())).status,503);
 assert.equal((await h.asset(req(),context())).status,503);
});
test('approved catalogue and assets are available with matching feature access',async()=>{
 const h=handlers(),list=await h.list(req());
 assert.equal((await list.json()).guides[0].id,'courier-tracking');
 const pdf=await h.asset(req('?download=1'),context());
 assert.equal(pdf.headers.get('Content-Type'),'application/pdf');
 assert.match(pdf.headers.get('Content-Disposition'),/^attachment;/);
 assert.equal(pdf.headers.get('Cache-Control'),'private, no-store');
 assert.equal(Buffer.from(await pdf.arrayBuffer()).subarray(0,4).toString(),'%PDF');
 for(const page of [1,2]){
  const image=await h.asset(req('?page='+page),context());
  assert.equal(image.headers.get('Content-Type'),'image/png');
  assert.equal(Buffer.from(await image.arrayBuffer()).subarray(1,4).toString(),'PNG');
 }
});
test('unknown guides and invalid page parameters cannot select arbitrary files',async()=>{
 const h=handlers();
 assert.equal((await h.asset(req(),context('../README'))).status,404);
 for(const page of ['0','3','../../README.md'])assert.equal((await h.asset(req('?page='+encodeURIComponent(page)),context())).status,404);
});


test('each guide is listed and served only with its own feature permission',async()=>{
 for(const [blocked,allowed] of [['courier-tracking','fleet-fuel'],['fleet-fuel','courier-tracking']]){
  const h=handlers(0,{[blocked]:403});
  const list=await (await h.list(req())).json();
  assert.deepEqual(list.guides.map(guide=>guide.id),registry.USER_GUIDES.filter(guide=>guide.id!==blocked).map(guide=>guide.id));
  assert.equal((await h.asset(req(),context(blocked))).status,403);
  assert.equal((await h.asset(req(),context(allowed))).status,200);
 }
});
test('Fleet guide serves its approved PDF and four pages, with strict page bounds',async()=>{
 const h=handlers(),ctx=context('fleet-fuel');
 const pdf=await h.asset(req('?download=1'),ctx);
 assert.match(pdf.headers.get('Content-Disposition'),/MSP_Coffee_Fleet_Fuel_Guide.pdf/);
 assert.equal(Buffer.from(await pdf.arrayBuffer()).subarray(0,4).toString(),'%PDF');
 for(const page of [1,2,3,4])assert.equal((await h.asset(req('?page='+page),ctx)).status,200);
 for(const page of ['0','5','01','-1','1.0','../README'])assert.equal((await h.asset(req('?page='+encodeURIComponent(page)),ctx)).status,404);
});
test('guide authorization dispatches to feature guards with read-only fleet access',async()=>{
 const calls=[];
 const auth=load('src/lib/user-guide-auth.ts',{
  '@/app/api/courier/_auth':{courierAuth:async()=>{calls.push('courier');return {user:{id:'courier'}}}},
  '@/lib/fleet/auth':{fleetAuth:async(_req,write)=>{calls.push(['fleet',write]);return {user:{id:'fleet'}}}},
  '@/lib/auth/api':{requireApiUser:async()=>({user:{id:'admin',role:'admin'}}),UUID_RE:/^uuid$/},
 }).userGuideAuth;
 await auth(req(),'courier-tracking');await auth(req(),'fleet-fuel');
 assert.deepEqual(calls,['courier',['fleet',false]]);
 assert.equal((await auth(req(),'unknown')).error.status,404);
});

 test('HO Fuel guide provides two private page previews and its PDF',async()=>{
 const h=handlers(),ctx=context('ho-fuel');
 const pdf=await h.asset(req('?download=1'),ctx);
 assert.equal(pdf.status,200);
 assert.match(pdf.headers.get('Content-Disposition'),/MSP_Coffee_HO_Fuel_Guide.pdf/);
 for(const page of [1,2])assert.equal((await h.asset(req('?page='+page),ctx)).status,200);
 assert.equal((await h.asset(req('?page=3'),ctx)).status,404);
 const denied=handlers(0,{'ho-fuel':403});
 assert.equal((await denied.asset(req(),ctx)).status,403);
 assert.equal((await denied.asset(req('?page=1'),ctx)).status,403);
 assert.ok(!(await (await denied.list(req())).json()).guides.some(g=>g.id==='ho-fuel'));
 });
 test('HO Fuel guide checks its own role and user overrides and fails closed',async()=>{
 const id='123e4567-e89b-12d3-a456-426614174000';
 for(const scenario of [
 {role:'read',user:null,status:200}, {role:'none',user:'read',status:200},
 {role:'read',user:'none',status:403}, {role:'none',user:null,status:403},
 {role:'read',user:null,fail:true,status:503},
 ]) {
 const tables=[];
 const auth=load('src/lib/user-guide-auth.ts',{
 '@/app/api/courier/_auth':{},'@/lib/fleet/auth':{},
 '@/lib/auth/api':{UUID_RE:/^[0-9a-f-]{36}$/,requireApiUser:async()=>({user:{id,role:'supervisor'},supabase:{from(table){tables.push(table);const chain={select(){return chain},eq(_key,value){if(_key==='page_href')assert.equal(value,'/ho-fuel');return chain},async maybeSingle(){return {data:table==='role_permissions'?{access:scenario.role}:scenario.user?{access:scenario.user}:null,error:scenario.fail?{message:'failed'}:null}}};return chain;}}})},
 }).userGuideAuth;
 const result=await auth(req(),'ho-fuel');assert.equal(result.error?.status??200,scenario.status);
 assert.equal(tables[0],'role_permissions');
 }
 });
