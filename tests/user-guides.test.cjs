const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const ts=require('typescript');
const {NextResponse}=require('next/server');
function load(file,dependencies){
 const mod={exports:{}};
 const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
 new Function('exports','module','require',code)(mod.exports,mod,name=>{
  if(name==='next/server')return {NextResponse};
  if(name in dependencies)return dependencies[name];
  if(name.startsWith('node:'))return require(name);
  throw Error('Unexpected import '+name);
 });return mod.exports;
}
const registry=load('src/lib/user-guides.ts',{});
const req=(suffix='')=>new Request('http://localhost/api/user-guides/courier-tracking'+suffix);
function handlers(status){
 const auth=async()=>status?{error:NextResponse.json({error:'Denied'},{status})}:{user:{id:'tester'}};
 return {
  list:load('src/app/api/user-guides/route.ts',{'../courier/_auth':{courierAuth:auth},'@/lib/user-guides':registry}).GET,
  asset:load('src/app/api/user-guides/[id]/route.ts',{'../../courier/_auth':{courierAuth:auth},'@/lib/user-guides':registry}).GET,
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
