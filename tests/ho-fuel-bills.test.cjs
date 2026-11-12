/* eslint-disable @typescript-eslint/no-require-imports */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
function load(path, mocks = {}) {
  const module = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(path,'utf8'), { compilerOptions: { module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022 } }).outputText;
  new Function('require','module','exports',code)(name => name in mocks ? mocks[name] : require(name),module,module.exports);
  return module.exports;
}
const fuel = load('src/lib/ho-fuel.ts');
const uuid = 'c271301a-a1a1-4111-8111-121212121212';
const uuidRE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const server = load('src/lib/ho-fuel-server.ts', { 'server-only':{}, '@/lib/auth/api':{ UUID_RE:uuidRE } });
const base = { date:'2026-10-31',fuel_type:'DIESEL',source:'Supplier',qty_l:200,amount:20086,reviewed:true,bill_ids:[uuid] };
const request = (body) => new Request('http://localhost/api/ho-fuel/purchases',{ method:'POST',headers:{ 'Content-Type':'application/json' },body:JSON.stringify(body) });
function purchases(supabase = {}, authOverride) {
  return load('src/app/api/ho-fuel/purchases/route.ts', {
    '@/lib/ho-fuel-server':{ hoFuelAuth:async () => authOverride || { user:{id:'admin'},supabase } },
    '@/lib/ho-fuel':fuel,'@/lib/auth/api':{ UUID_RE:uuidRE },
  });
}
test('DD/MM/YYYY is strict and round trips without locale or timezone ambiguity', () => {
  assert.equal(fuel.formatFuelDate('2026-12-04'),'04/12/2026');
  assert.equal(fuel.parseFuelDate('04/12/2026'),'2026-12-04');
  assert.equal(fuel.parseFuelDate('29/02/2028'),'2028-02-29');
  for (const invalid of ['29/02/2026','31/04/2026','1/2/2026','2026-12-04','04/13/2026']) assert.equal(fuel.parseFuelDate(invalid),'');
});
test('unreadable, invalid and non-finite extraction fields are left empty', () => {
  const data = fuel.cleanFuelExtraction({ date:'2026-02-30',source:' Supplier ',fuel_type:'UNKNOWN',qty_l:-2,amount:Infinity,notes:'check original' });
  assert.deepEqual(data,{ date:'',source:'Supplier',fuel_type:'',qty_l:null,amount:null,notes:'check original' });
});
test('purchase API refuses missing bills, unreviewed values, invalid dates and costs before writing',async () => {
  const route = purchases({ rpc() { throw new Error('Must not write'); } });
  for (const change of [{bill_ids:[]},{reviewed:false},{date:'2026-02-30'},{date:'2999-12-04'},{amount:0},{qty_l:-1},{fuel_type:'OTHER'},{bill_ids:[uuid,uuid]},{source:' '},{qty_l:'200'}]) {
    const response = await route.POST(request({...base,...change}));
    assert.equal(response.status,400,JSON.stringify(change));
  }
});
test('reviewed purchase uses the atomic database operation with verified user identity',async () => {
  let called;
  const route = purchases({ rpc:async (name,args) => { called = {name,args}; return { data:123,error:null }; } });
  const response = await route.POST(request(base));
  assert.equal(response.status,201);
  assert.equal(called.name,'save_ho_fuel_purchase');
  assert.equal(called.args.p_user,'admin');
  assert.deepEqual(called.args.p_bill_ids,[uuid]);
  assert.equal(called.args.p_entry.amount,20086);
});
test('used bills or a failed atomic save report failure, with no second insert',async () => {
  const route = purchases({ rpc:async () => ({error:{ message:'already used' }}) });
  assert.equal((await route.POST(request(base))).status,409);
});
test('API preserves access-denied responses',async () => {
  const route = purchases({}, {error:Response.json({error:'Access denied'},{status:403})});
  assert.equal((await route.POST(request(base))).status,403);
});
function billRoute(db) {
  return load('src/app/api/ho-fuel/bills/route.ts', {
    '@/lib/auth/api':{ UUID_RE:uuidRE },
    '@/lib/ho-fuel-server':{ ...server,hoFuelAuth:async () => ({user:{id:'admin'},supabase:db}) },
  });
}
function upload(file, purchaseId) {
  const form = new FormData(); form.append('file',file); if(purchaseId) form.append('purchaseId',String(purchaseId));
  return new Request('http://localhost/api/ho-fuel/bills',{method:'POST',body:form});
}
test('file upload rejects disguised files before storage',async () => {
  const route = billRoute({storage:{from() {throw new Error('Must not upload');}}});
  assert.equal((await route.POST(upload(new File(['not PDF'],'bad.pdf',{type:'application/pdf'})))).status,400);
});
test('attachment record failure removes uploaded object',async () => {
  let removed;
  const route = billRoute({
    storage:{from:() => ({upload:async () => ({error:null}),remove:async paths => {removed=paths;return {error:null};}})},
    from:() => ({insert:() => ({select:() => ({single:async () => ({error:{message:'failed'}})})})}),
  });
  const response = await route.POST(upload(new File(['%PDF-1.4'],'bill.pdf',{type:'application/pdf'})));
  assert.equal(response.status,500);
  assert.equal(removed.length,1);
  assert.match(removed[0],/^admin\//);
});
test('pending bills belonging to another user cannot be opened',async () => {
  const route = billRoute({from:() => ({select:() => ({eq:() => ({maybeSingle:async () => ({data:{purchase_id:null,uploaded_by:'other',file_path:'other/secret.pdf'}})})})})});
  const response = await route.GET(new Request(`http://localhost/api/ho-fuel/bills?id=${uuid}`));
  assert.equal(response.status,404);
});
test('HO Fuel write permission and request origin are checked',async () => {
  for (const access of ['none','read']) {
    const db = {from:() => ({select:() => ({eq() {return this;},maybeSingle:async () => ({data:{access},error:null})})})};
    const auth = load('src/lib/ho-fuel-server.ts', { 'server-only':{},'@/lib/auth/api':{UUID_RE:uuidRE,requireApiUser:async () => ({user:{id:'legacy',role:'supervisor'},supabase:db})} });
    assert.equal((await auth.hoFuelAuth(new Request('http://localhost/api/ho-fuel/bills'),true)).error.status,403);
  }
  const auth = load('src/lib/ho-fuel-server.ts', { 'server-only':{},'@/lib/auth/api':{UUID_RE:uuidRE,requireApiUser:async () => ({user:{id:'admin',role:'admin'}})} });
  assert.equal((await auth.hoFuelAuth(new Request('http://localhost/api/ho-fuel/bills',{headers:{origin:'http://other'}}),true)).error.status,403);
});
