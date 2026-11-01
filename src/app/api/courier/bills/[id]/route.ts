import {NextResponse} from 'next/server';
import {courierAuth} from '../../_auth';
import {UUID_RE} from '@/lib/auth/api';
import {cleanBill,reconciliation} from '@/lib/courier-reconciliation';
import {billApprover,billError,billShipments} from '../_shared';
type Context={params:Promise<{id:string}>};
export async function GET(request:Request,{params}:Context){
 const auth=await courierAuth(request);if('error'in auth)return auth.error;const {id}=await params;if(!UUID_RE.test(id))return NextResponse.json({error:'Invalid bill.'},{status:400});
 try{const {data:bill,error}=await auth.supabase.from('courier_bills').select('*').eq('id',id).maybeSingle();if(error)return billError(error);if(!bill)return NextResponse.json({error:'Bill not found.'},{status:404});
 const [shipments,events,payment,links,canApprove]=await Promise.all([billShipments(auth.supabase),auth.supabase.from('courier_bill_events').select('id,actor_id,action,created_at,saved_data').eq('bill_id',id).order('id'),auth.supabase.from('courier_bill_payments').select('*').eq('bill_id',id).maybeSingle(),auth.supabase.from('courier_bill_links').select('line_id,shipment_id,shipment_snapshot').eq('bill_id',id),billApprover(auth.supabase,auth.user.id)]);
 if(events.error||payment.error||links.error)return NextResponse.json({error:'Unable to load the bill history.'},{status:503});
 return NextResponse.json({bill,shipments,matching:reconciliation(bill.invoice,shipments),events:events.data,payment:payment.data,links:links.data,canApprove},{headers:{'Cache-Control':'private, no-store'}});
 }catch{return NextResponse.json({error:'Unable to load bill details.'},{status:503});}
}
export async function PATCH(request:Request,{params}:Context){
 const auth=await courierAuth(request,true);if('error'in auth)return auth.error;const {id}=await params;if(!UUID_RE.test(id))return NextResponse.json({error:'Invalid bill.'},{status:400});
 try{const body=await request.json();if(!Number.isInteger(body.version)||body.version<1)throw new Error('Reload the saved bill before editing.');const invoice=cleanBill(body.invoice);
 const {data:bill,error}=await auth.supabase.from('courier_bills').select('original_path,original_hash').eq('id',id).maybeSingle();if(error)return billError(error);if(!bill)return NextResponse.json({error:'Bill not found.'},{status:404});
 const {error:saving}=await auth.supabase.rpc('save_courier_bill',{p_id:id,p_invoice:invoice,p_path:bill.original_path,p_hash:bill.original_hash,p_actor:auth.user.id,p_expected:body.version});if(saving)return billError(saving);return NextResponse.json({id});
 }catch(error){return NextResponse.json({error:error instanceof Error?error.message:'Invalid bill.'},{status:400});}
}
