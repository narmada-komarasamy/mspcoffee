/* eslint-disable @typescript-eslint/no-require-imports */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
function load(file, mocks={}){const m={exports:{}};const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;new Function('require','module','exports',code)(name=>name in mocks?mocks[name]:require(name),m,m.exports);return m.exports;}
const r=load('src/lib/reports.ts');
const config={type:'weekly',anchor:'2026-11-08',modules:[...r.REPORT_MODULES],title:r.REPORT_TITLES.weekly,detail:false};
test('report periods use Monday–Sunday and April–March quarters, halves and financial years',()=>{
 assert.deepEqual(r.reportPeriod('weekly','2026-11-08'),{start:'2026-11-02',end:'2026-11-08',financialYear:2026});
 assert.deepEqual(r.lastCompletedPeriod('weekly','2026-11-09'),r.reportPeriod('weekly','2026-11-08'));
 assert.deepEqual(r.reportPeriod('quarterly','2027-02-10'),{start:'2027-01-01',end:'2027-03-31',financialYear:2026});
 assert.deepEqual(r.reportPeriod('half_yearly','2026-08-10'),{start:'2026-04-01',end:'2026-09-30',financialYear:2026});
 assert.deepEqual(r.reportPeriod('half_yearly','2027-02-10'),{start:'2026-10-01',end:'2027-03-31',financialYear:2026});
 assert.deepEqual(r.lastCompletedPeriod('yearly','2026-11-09'),{start:'2025-04-01',end:'2026-03-31',financialYear:2025});
 assert.equal(r.reportPeriod('monthly','2024-02-29').end,'2024-02-29');
 assert.equal(r.lastCompletedPeriod('daily','2026-03-01').start,'2026-02-28');
 assert.throws(()=>r.reportPeriod('monthly','2026-02-30'));
});
test('report settings enforce selected sections and one-page defaults',()=>{
 for(const type of r.REPORT_TYPES)assert.equal(r.cleanReportConfig({...config,type}).detail,false);
 for(const type of ['daily','weekly','monthly','yearly'])assert.throws(()=>r.cleanReportConfig({...config,type,detail:true}));
 assert.equal(r.cleanReportConfig({...config,type:'quarterly',detail:true}).detail,true);
 assert.throws(()=>r.cleanReportConfig({...config,modules:[]}));
});
const rain=[{date:'2026-11-04',estate:'Moganad',rainfall_mm:14},{date:'2026-11-06',estate:'Moganad',rainfall_mm:21},{date:'2026-11-07',estate:'Stanmore',rainfall_mm:11}];
const fleet=[{date:'2026-11-02',vehicle_id:'A',km_run:151,fuel_filled_l:5,fuel_cost:545},{date:'2026-11-06',vehicle_id:'A',km_run:426,fuel_filled_l:51.79,fuel_cost:5244.12}];
const ho=[{date:'2026-11-07',transaction_type:'PURCHASE',fuel_type:'DIESEL',qty_l:400,amount:40172},{date:'2026-11-07',transaction_type:'ISSUE',fuel_type:'DIESEL',qty_l:20,amount:0}];
test('KPI totals deduplicate vehicle counts and keep rain estates, HO purchases and issues separate',()=>{
 const summary=r.summarizeReport(rain,fleet,ho);
 assert.equal(summary.fleet.vehicles,1);assert.equal(summary.fleet.km,577);assert.equal(summary.fleet.spend,5789.12);
 assert.equal(summary.rainfall.estates[0].mm,35);assert.equal(summary.rainfall.estates[1].mm,11);
 assert.equal(summary.ho.issued,20);assert.equal(summary.ho.purchased,400);assert.equal(summary.ho.spend,40172);
 assert.equal(r.summarizeReport([],[],[]).fleet.km,null);
 assert.equal(r.summarizeReport([],[],[]).ho.issued,null);
});
function server(){return load('src/lib/reports-server.ts',{'server-only':{},'@/lib/auth/api':{},'./reports':r});}
test('snapshot pagination reads all rows, shares fleet reads, preserves the previous period and excludes future-dated data',async()=>{
 const calls=[];
 const data={rainfall:rain,fleet_daily:fleet,ho_fuel_log:ho};
 const db={from:table=>{let low,high;const q={select:()=>q,gte:(_,v)=>{low=v;return q;},lte:(_,v)=>{high=v;return q;},order:()=>q,range:async(a,b)=>{calls.push([table,low,high,a,b]);const rows=data[table].filter(row=>row.date>=low&&row.date<=high);return {data:a?[]:rows};}};return q;}};
 const snapshot=await server().buildReportSnapshot(db,config);
 assert.equal(calls.filter(c=>c[0]==='fleet_daily').length,1);
 assert.equal(snapshot.current.fleet.km,577);assert.equal(snapshot.previous.fleet.km,null);
 assert.deepEqual(snapshot.period,{start:'2026-11-02',end:'2026-11-08',financialYear:2026});
 assert.ok(snapshot.warnings.some(w=>w.includes('not confirmed zeroes')));
 const original=snapshot.current.fleet.km;fleet[0].km_run=1;assert.equal(snapshot.current.fleet.km,original);fleet[0].km_run=151;
 const paged={from:()=>{const q={select:()=>q,gte:()=>q,lte:()=>q,order:()=>q,range:async(a)=>({data:Array(a===0?1000:a===1000?4:0).fill(fleet[0])})};return q;}};
 const big=await server().buildReportSnapshot(paged,{...config,modules:['distance']});assert.equal(big.current.fleet.entries,1004);
 const today=r.indiaToday();const current=await server().buildReportSnapshot(db,{...config,type:'yearly',anchor:today});
 assert.ok(current.warnings.some(w=>w.includes('still open')));
 assert.ok(calls.every(c=>c[2]<=today));
});
function snapshot(type='weekly',detail=false){return {version:1,reference:'MSP-RPT-20261108-EXAMPLE1',generatedAt:'2026-11-09T02:00:00Z',config:{...config,type,detail},period:r.reportPeriod(type,config.anchor),comparisonPeriod:r.previousPeriod(type,r.reportPeriod(type,config.anchor)),current:r.summarizeReport(rain,fleet,ho),previous:r.summarizeReport([],[],[]),months:[{month:'2026-11',summary:r.summarizeReport(rain,fleet,ho)}],warnings:['Only recorded entries are included. Missing entries are not confirmed zeroes.']};}
test('all report types generate A4 PDFs; only requested quarterly/half-yearly detail uses page two',async()=>{
 const pdf=load('src/lib/reports-pdf.ts',{'./reports':r});const {PDFDocument}=require('pdf-lib');
 for(const type of r.REPORT_TYPES){const result=await pdf.renderReportPdf(snapshot(type));assert.equal(result.pages,1,type);const doc=await PDFDocument.load(result.bytes);assert.ok(Math.abs(doc.getPage(0).getWidth()-595.28)<.1);}
 for(const type of ['quarterly','half_yearly'])assert.equal((await pdf.renderReportPdf(snapshot(type,true))).pages,2);
 const result=await pdf.renderReportPdf(snapshot());fs.writeFileSync('/tmp/msp-weekly-report.pdf',result.bytes);
});
test('archive, preview and original PDF endpoints reject unauthenticated requests',async()=>{
 const auth={reportsAuth:async()=>({error:new Response('Unauthorized',{status:401})})};
 for(const [file,methods] of [['src/app/api/reports/route.ts',['GET','POST']],['src/app/api/reports/preview/route.ts',['POST']],['src/app/api/reports/pdf/route.ts',['GET']]]){
  const api=load(file,{'@/lib/reports-server':auth,'@/lib/reports-pdf':{},'@/lib/reports':r,'@/lib/auth/api':{UUID_RE:/^[a-f0-9-]{36}$/}});
  for(const method of methods)assert.equal((await api[method](new Request('http://localhost/api/reports',{method}))).status,401);
 }
});
test('Reports is immediately below User Guides in navigation and access configuration',()=>{
 for(const file of ['src/lib/auth/access.ts','src/app/(dashboard)/layout.tsx'])assert.match(fs.readFileSync(file,'utf8'),/label: 'User Guides'[^\n]*\n[^\n]*label: 'Reports'/);
});

test('read-only report access cannot create archives',async()=>{
 const api=load('src/lib/reports-server.ts',{'server-only':{},'./reports':r,'@/lib/auth/api':{UUID_RE:/^uuid$/,requireApiUser:async()=>({user:{id:'ceo',role:'ceo'},supabase:{from:()=>({select:()=>({eq:()=>({eq:()=>({maybeSingle:async()=>({data:{access:'read'}})})})})})}})}});
 const result=await api.reportsAuth(new Request('http://localhost/api/reports',{method:'POST'}),true);
 assert.equal(result.error.status,403);
});
test('archive saving uses server-built figures, private PDF storage and an integrity hash',async()=>{
 const s=snapshot();const bytes=Buffer.from('%PDF original');let inserted,uploaded;
 const query={select:()=>query,single:async()=>({data:{id:'saved',reference:s.reference}})};
 const api=load('src/app/api/reports/route.ts',{
  '@/lib/reports':r,'@/lib/reports-pdf':{renderReportPdf:async()=>({bytes,pages:1})},
  '@/lib/reports-server':{reportsAuth:async()=>({user:{id:'admin'},supabase:{storage:{from:()=>({upload:async(path,data,options)=>{uploaded={path,data,options};return {};},remove:async()=>({})})},from:()=>({insert:value=>{inserted=value;return query;}})}}),buildReportSnapshot:async()=>s,pdfHash:()=> 'a'.repeat(64),REPORT_BUCKET:'report-archive'},
 });
 const response=await api.POST(new Request('http://localhost/api/reports',{method:'POST',body:JSON.stringify({...config,snapshot:{total:1},pdf_path:'attacker.pdf'})}));
 assert.equal(response.status,201);assert.equal(inserted.snapshot,s);assert.equal(inserted.created_by,'admin');
 assert.equal(inserted.pdf_sha256,'a'.repeat(64));assert.equal(uploaded.data,bytes);assert.equal(uploaded.options.upsert,false);assert.notEqual(inserted.pdf_path,'attacker.pdf');
});
test('opening an old report returns its original PDF and rejects changed bytes',async()=>{
 const original=Buffer.from('%PDF original stored report');const hash=server().pdfHash(original);let file=original;
 const db={
  from:()=>({select:()=>({eq:()=>({maybeSingle:async()=>({data:{pdf_path:'original.pdf',pdf_sha256:hash,reference:'MSP-ORIGINAL'}})})})}),
  storage:{from:()=>({download:async()=>({data:new Blob([file])})})},
 };
 const api=load('src/app/api/reports/pdf/route.ts',{
  '@/lib/auth/api':{UUID_RE:/^[a-f0-9-]{36}$/},
  '@/lib/reports-server':{REPORT_BUCKET:'report-archive',pdfHash:server().pdfHash,reportsAuth:async()=>({supabase:db})},
 });
 const url='http://localhost/api/reports/pdf?id=00000000-0000-4000-8000-000000000001';
 const response=await api.GET(new Request(url));assert.equal(response.status,200);assert.deepEqual(Buffer.from(await response.arrayBuffer()),original);
 assert.ok((await api.GET(new Request(url+'&download=1'))).headers.get('Content-Disposition').startsWith('attachment;'));
 file=Buffer.from('%PDF changed after saving');assert.equal((await api.GET(new Request(url))).status,500);
});
