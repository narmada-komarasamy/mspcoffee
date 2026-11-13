/* eslint-disable @typescript-eslint/no-require-imports */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const XLSX = require('xlsx');
function load(path,mocks={}) {
 const mod={exports:{}};
 const code=ts.transpileModule(fs.readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 new Function('require','module','exports',code)(name=>name in mocks?mocks[name]:require(name),mod,mod.exports);
 return mod.exports;
}
const dates=load('src/lib/rainfall-dates.ts');
const today='2026-11-13';
const helpers={...dates,rainfallDateError:date=>dates.rainfallDateError(date,today)};
const payload=load('src/app/api/rainfall/_auth.ts',{'@/lib/rainfall-dates':helpers,'@/lib/auth/api':{requireApiUser(){throw new Error('not used');}}});
const entry={date:'2026-11-09',estate:'Gowri',rainfall_mm:11};
test('India date rolls over at 18:30 UTC irrespective of browser timezone',()=>{
 assert.equal(dates.rainfallToday(new Date('2026-11-13T18:29:59Z')),'2026-11-13');
 assert.equal(dates.rainfallToday(new Date('2026-11-13T18:30:00Z')),'2026-11-14');
});
test('calendar validation rejects impossible dates rather than JS normalisation',()=>{
 for(const value of ['2026-02-29','2026-04-31','2026-13-01','13/11/2026','2026-2-03','']) assert.equal(dates.validRainfallDate(value),false,value);
 assert.equal(dates.validRainfallDate('2028-02-29'),true);
 assert.equal(dates.rainfallDateError(today,today),'');
 assert.match(dates.rainfallDateError('2026-11-26',today),/future/);
});
test('latest reading and totals ignore future readings while retaining them for review',()=>{
 const rows=[{date:'2026-11-26',rainfall_mm:11},{date:'2026-11-09',rainfall_mm:5},{date:'2026-11-08',rainfall_mm:2}];
 const summary=dates.rainfallReadingSummary(rows,today);
 assert.equal(summary.latest,'2026-11-09');
 assert.equal(summary.current.reduce((s,r)=>s+r.rainfall_mm,0),7);
 assert.deepEqual(summary.future,[rows[0]]);
 assert.equal(rows.length,3);
 assert.equal(dates.rainfallReadingSummary([],today).latest,'');
 assert.equal(dates.rainfallReadingSummary([rows[0]],today).latest,'');
 assert.equal(dates.rainfallDateLabel(summary.latest),'09/11/2026');
});
test('text import dates always use day/month/year and reject ambiguous native parsing',()=>{
 assert.equal(dates.parseRainfallImportDate('04/11/2026'),'2026-11-04');
 assert.equal(dates.parseRainfallImportDate('26/11/2026'),'2026-11-26');
 assert.equal(dates.parseRainfallImportDate('11/26/2026'),'');
 assert.equal(dates.parseRainfallImportDate('31/04/2026'),'');
 assert.equal(dates.parseRainfallImportDate('2026-11-09'),'2026-11-09');
 assert.equal(dates.parseRainfallImportDate('9 November 2026'),'');
});
test('Excel serial dates retain their calendar day alongside DD/MM/YYYY text cells',()=>{
 const workbook=XLSX.utils.book_new();
 XLSX.utils.book_append_sheet(workbook,XLSX.utils.aoa_to_sheet([['Date','Estate','mm'],[new Date(2026,10,9),'Gowri',2],['04/11/2026','Gowri',3]]),'Rainfall Data');
 const decoded=XLSX.read(XLSX.write(workbook,{type:'buffer',bookType:'xlsx'}),{type:'buffer',cellDates:false});
 const rows=XLSX.utils.sheet_to_json(decoded.Sheets['Rainfall Data'],{raw:true});
 assert.equal(typeof rows[0].Date,'number');
 const parts=XLSX.SSF.parse_date_code(rows[0].Date);
 assert.equal(dates.parseRainfallImportDate(`${parts.y}-${String(parts.m).padStart(2,'0')}-${String(parts.d).padStart(2,'0')}`),'2026-11-09');
 assert.equal(dates.parseRainfallImportDate(rows[1].Date),'2026-11-04');
});
test('shared server payload validator accepts historical dates and rejects future and impossible dates',()=>{
 assert.equal(payload.parseRainfallPayload(entry).record.date,entry.date);
 assert.equal(payload.parseRainfallPayload({...entry,date:today}).record.date,today);
 for(const date of ['2026-11-26','2026-02-30']) assert.ok(payload.parseRainfallPayload({...entry,date}).error);
});
function route(path,db){return load(path,{'./_auth':{...payload,requireRainfallUser:async()=>({supabase:db})},'../_auth':{...payload,requireRainfallUser:async()=>({supabase:db})}});}
const request=body=>new Request('http://localhost/api/rainfall',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
test('manual create and edit reject future readings before any database write',async()=>{
 const db={from(){throw new Error('Must not write');}};
 assert.equal((await route('src/app/api/rainfall/route.ts',db).POST(request({...entry,date:'2026-11-26'}))).status,400);
 assert.equal((await route('src/app/api/rainfall/[id]/route.ts',db).PATCH(request({...entry,date:'2026-11-26'}),{params:Promise.resolve({id:'10'})})).status,400);
});
test('bulk upload validates the entire batch before saving any record',async()=>{
 const db={from(){throw new Error('Must not write a partially valid batch');}};
 const result=await route('src/app/api/rainfall/bulk/route.ts',db).POST(request({rows:[entry,{...entry,date:'2026-11-26'}]}));
 assert.equal(result.status,400);
 assert.match((await result.json()).error,/future/);
});
