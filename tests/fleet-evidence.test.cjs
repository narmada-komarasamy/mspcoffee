const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');const ts=require('typescript');
function load(file,mocks={}){
 const mod={exports:{}};
 const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 new Function('require','module','exports',code)(name=>name in mocks?mocks[name]:require(name),mod,mod.exports);return mod.exports;
}
const maintenance=load('src/lib/fleet/maintenance.ts');
const evidence=load('src/lib/fleet/evidence.ts',{'./maintenance':maintenance});
const row={date:'2026-11-01',vehicle_id:'TN 54 M 6336',vehicle_type:'Estate',account:'BVE',fuel_type:'Diesel',starting_km:100,closing_km:200,fuel_filled_l:10,fuel_cost:1000,maint_cost:0};
const image=()=>new File([new Uint8Array([255,216,255,224,0,1])],'fuel.jpg',{type:'image/jpeg'});
function api(file,result={data:{ok:true,id:1},error:null},authStatus=0){
 const seen={uploads:[],removes:[],args:null,rpc:0};
 const db={storage:{from:()=>({upload:async(path)=>{seen.uploads.push(path);return {error:null}},remove:async(paths)=>{seen.removes.push(...paths);return {error:null}}})},rpc:async(name,args)=>{seen.rpc++;seen.name=name;seen.args=args;return result}};
 const route=load(file,{'@/lib/fleet/auth':{fleetAuth:async()=>authStatus?{error:Response.json({error:'Denied'},{status:authStatus})}:{user:{id:'verified-staff'},supabase:db}},'@/lib/fleet/evidence':evidence});
 return {route,seen};
}
function photoRequest(values=row,extras={}){const form=new FormData();form.set('record',JSON.stringify(values));form.set('fuel',image());for(const [key,value]of Object.entries(extras))form.set(key,value);return new Request('http://localhost/api/fleet/photo-entry',{method:'POST',body:form});}
const importRequest=rows=>new Request('http://localhost/api/fleet/import',{method:'POST',body:JSON.stringify({rows}),headers:{'Content-Type':'application/json'}});
test('photo and import writes require authorization before uploads or database calls',async()=>{
 for(const file of ['photo-entry','import'])for(const status of [401,403,503]){
  const {route,seen}=api(`src/app/api/fleet/${file}/route.ts`,undefined,status);
  assert.equal((await route.POST(file==='import'?importRequest([row]):photoRequest())).status,status);
  assert.equal(seen.rpc,0);assert.equal(seen.uploads.length,0);
 }
});
test('photo save retains original bytes and names and uses the verified actor',async()=>{
 const {route,seen}=api('src/app/api/fleet/photo-entry/route.ts');
 assert.equal((await route.POST(photoRequest({...row,total_cost:1,id:999}))).status,200);
 assert.equal(seen.name,'save_fleet_entry');assert.equal(seen.args.p_mode,'create');assert.equal(seen.args.p_record.id,undefined);
 assert.equal(seen.args.p_record.total_cost,1000);assert.equal(seen.args.p_actor,'verified-staff');
 assert.equal(seen.args.p_photos[0].name,'fuel.jpg');assert.equal(seen.args.p_photos[0].sha256.length,64);assert.equal(seen.uploads.length,1);
});
test('invalid photo bytes and excessive combined size cannot upload or save',async()=>{
 const {route,seen}=api('src/app/api/fleet/photo-entry/route.ts');
 const bad=new FormData();bad.set('record',JSON.stringify(row));bad.set('fuel',new File(['not an image'],'fake.jpg',{type:'image/jpeg'}));
 assert.equal((await route.POST(new Request('http://localhost',{method:'POST',body:bad}))).status,400);
 assert.equal(seen.uploads.length,0);assert.equal(seen.rpc,0);
 assert.ok(evidence.photoFilesError([{type:'image/jpeg',size:2*1024*1024},{type:'image/png',size:2*1024*1024}]));
});
test('attach-only passes a reviewed version while conflicts preserve the original expense',async()=>{
 const {route,seen}=api('src/app/api/fleet/photo-entry/route.ts',{data:{ok:false,code:'STALE_ENTRY',error:'Changed'},error:null});
 const response=await route.POST(photoRequest({...row,id:23,entry_version:4},{mode:'attach'}));
 assert.equal(response.status,409);assert.equal(seen.args.p_mode,'attach');assert.equal(seen.args.p_expected_version,4);
 assert.equal(seen.removes.length,1);
});
test('a transport error after save never deletes a potentially committed original',async()=>{
 const {route,seen}=api('src/app/api/fleet/photo-entry/route.ts',{data:null,error:{code:'',message:'timeout'}});
 assert.equal((await route.POST(photoRequest())).status,503);assert.equal(seen.removes.length,0);
});
test('imports reject repeated normalised vehicle/date rows and invalid dates before database access',async()=>{
 const {route,seen}=api('src/app/api/fleet/import/route.ts');
 assert.equal((await route.POST(importRequest([row,{...row,vehicle_id:'tn54m6336'}]))).status,400);
 assert.equal((await route.POST(importRequest([{...row,date:'2026-02-30'}]))).status,400);
 assert.equal((await route.POST(importRequest(Array(501).fill(row)))).status,400);assert.equal(seen.rpc,0);
});
test('imports call insert-only transaction and report actual saved and skipped counts',async()=>{
 const result={ok:true,inserted:0,skipped:[{vehicle_id:row.vehicle_id,date:row.date,reason:'Already exists'}]};
 const {route,seen}=api('src/app/api/fleet/import/route.ts',{data:result,error:null});
 assert.deepEqual(await (await route.POST(importRequest([{...row,id:77,fuel_bill_path:'forged'}]))).json(),result);
 assert.equal(seen.name,'import_fleet_rows');assert.equal(seen.args.p_rows[0].id,undefined);assert.equal(seen.args.p_rows[0].fuel_bill_path,undefined);
});
test('photos and imports no longer write from the browser or treat import progress as success',()=>{
 for(const name of ['PhotoEntryModal','UploadModal'])assert.doesNotMatch(fs.readFileSync(`src/components/fleet/${name}.tsx`,'utf8'),/\.upsert\(/);
 assert.match(fs.readFileSync('src/components/fleet/UploadModal.tsx','utf8'),/setUploadedCount\(result.inserted\)/);
});
