import {NextResponse} from 'next/server';
import {courierAuth} from '../../../_auth';
import {UUID_RE} from '@/lib/auth/api';
export async function GET(request:Request,{params}:{params:Promise<{id:string}>}){
 const auth=await courierAuth(request);if('error'in auth)return auth.error;const {id}=await params;if(!UUID_RE.test(id))return NextResponse.json({error:'Invalid bill.'},{status:400});
 const {data:bill,error}=await auth.supabase.from('courier_bills').select('original_path').eq('id',id).maybeSingle();if(error)return NextResponse.json({error:'Unable to load this original.'},{status:503});if(!bill)return NextResponse.json({error:'Bill not found.'},{status:404});
 const {data,error:linkError}=await auth.supabase.storage.from('courier-bills').createSignedUrl(bill.original_path,300);if(linkError||!data)return NextResponse.json({error:'Original temporarily unavailable.'},{status:503});return NextResponse.redirect(data.signedUrl,{headers:{'Cache-Control':'private, no-store'}});
}
