import { NextResponse } from 'next/server';
import { UUID_RE } from '@/lib/auth/api';
import { fileError } from '@/lib/courier';
import { courierAuth } from '../_auth';
const BUCKET='courier-receipts';
export async function GET(request:Request){
 const auth=await courierAuth(request);if('error'in auth)return auth.error;
 const id=new URL(request.url).searchParams.get('id')||'';if(!UUID_RE.test(id))return NextResponse.json({error:'Invalid shipment.'},{status:400});
 const {data}=await auth.supabase.from('courier_shipments').select('receipt_path').eq('id',id).single();
 if(!data?.receipt_path)return NextResponse.json({error:'No receipt attached.'},{status:404});
 const {data:link,error}=await auth.supabase.storage.from(BUCKET).createSignedUrl(data.receipt_path,300);
 if(error||!link)return NextResponse.json({error:'Receipt unavailable.'},{status:404});
 return NextResponse.redirect(link.signedUrl,{headers:{'Cache-Control':'no-store'}});
}
export async function POST(request:Request){
 const auth=await courierAuth(request,true);if('error'in auth)return auth.error;
 const form=await request.formData(),file=form.get('file'),id=String(form.get('id')||'');
 if(!UUID_RE.test(id)||!(file instanceof File))return NextResponse.json({error:'Choose a shipment and receipt.'},{status:400});
 const invalid=fileError(file);if(invalid)return NextResponse.json({error:invalid},{status:400});
 const {data:existing}=await auth.supabase.from('courier_shipments').select('id,receipt_path').eq('id',id).single();
 if(!existing)return NextResponse.json({error:'Save the shipment first.'},{status:404});
 const ext:Record<string,string>={'application/pdf':'pdf','image/png':'png','image/jpeg':'jpg','image/webp':'webp'};
 const path=`${id}/${crypto.randomUUID()}.${ext[file.type]}`;
 const {error:upload}=await auth.supabase.storage.from(BUCKET).upload(path,await file.arrayBuffer(),{contentType:file.type,upsert:false});
 if(upload)return NextResponse.json({error:'Receipt upload failed. The shipment is saved; retry the receipt upload.'},{status:500});
 const {error}=await auth.supabase.from('courier_shipments').update({receipt_path:path,updated_at:new Date().toISOString()}).eq('id',id);
 if(error){await auth.supabase.storage.from(BUCKET).remove([path]);return NextResponse.json({error:'Receipt could not be linked. Retry the upload.'},{status:500})}
 return NextResponse.json({path});
}
