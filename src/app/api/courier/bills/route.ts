import {NextResponse} from 'next/server';
import {createHash} from 'node:crypto';
import {courierAuth} from '../_auth';
import {fileError} from '@/lib/courier';
import {UUID_RE} from '@/lib/auth/api';
import {cleanBill} from '@/lib/courier-reconciliation';
import {originalFileType} from '@/lib/courier-bills';
import {billApprover,billError} from './_shared';
export async function GET(request:Request){
 const auth=await courierAuth(request);if('error'in auth)return auth.error;
 try{const bills=[];for(let offset=0;;offset+=200){const {data,error}=await auth.supabase.from('courier_bills').select('*').order('created_at',{ascending:false}).order('id').range(offset,offset+199);if(error)return billError(error);bills.push(...data);if(data.length<200)break;}
 return NextResponse.json({bills,canApprove:await billApprover(auth.supabase,auth.user.id),userName:auth.user.name},{headers:{'Cache-Control':'private, no-store'}});
 }catch{return NextResponse.json({error:'Unable to load saved courier bills.'},{status:503});}
}
export async function POST(request:Request){
 const auth=await courierAuth(request,true);if('error'in auth)return auth.error;
 try{
  const form=await request.formData(),id=String(form.get('id')??''),file=form.get('file');
  if(!UUID_RE.test(id)||!(file instanceof File))throw new Error('Select the complete original bill and a valid bill identifier.');
  const invalid=fileError(file);if(invalid)throw new Error(invalid);
  const invoice=cleanBill(JSON.parse(String(form.get('invoice')??'')));
  const bytes=new Uint8Array(await file.arrayBuffer());if(!originalFileType(bytes,file.type))throw new Error('The file contents do not match its PDF or image type.');
  const hash=createHash('sha256').update(bytes).digest('hex');
  const {data:duplicates,error:lookupError}=await auth.supabase.from('courier_bills').select('id,original_hash').or(`id.eq.${id},original_hash.eq.${hash}`);
  if(lookupError)return billError(lookupError);
  if(duplicates?.length){const same=duplicates.find(b=>b.id===id&&b.original_hash===hash);return NextResponse.json(same?{id:same.id}:{error:'This original bill has already been saved.',existingId:duplicates[0].id},{status:same?200:409});}
  const ext:Record<string,string>={'application/pdf':'pdf','image/jpeg':'jpg','image/png':'png','image/webp':'webp'};const path=`${id}/${hash}.${ext[file.type]}`;
  const {error:uploadError}=await auth.supabase.storage.from('courier-bills').upload(path,bytes,{contentType:file.type,upsert:false});
  // A timed-out prior attempt may have stored this exact content-addressed file.
  if(uploadError&&String(uploadError.statusCode)!=='409')return NextResponse.json({error:'Original bill upload failed. Retry saving this bill.'},{status:503});
  const {error}=await auth.supabase.rpc('save_courier_bill',{p_id:id,p_invoice:{...invoice,sourceLabel:file.name.slice(0,500)},p_path:path,p_hash:hash,p_actor:auth.user.id,p_expected:null});
  if(error){const {data:saved,error:checkError}=await auth.supabase.from('courier_bills').select('id').eq('id',id).maybeSingle();if(saved)return NextResponse.json({id:saved.id});if(!checkError)await auth.supabase.storage.from('courier-bills').remove([path]);return billError(error);}
  return NextResponse.json({id});
 }catch(error){return NextResponse.json({error:error instanceof Error?error.message:'Invalid bill.'},{status:400});}
}
