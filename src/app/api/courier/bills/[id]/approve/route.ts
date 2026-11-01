import {NextResponse} from 'next/server';
import {courierAuth} from '../../../_auth';
import {UUID_RE} from '@/lib/auth/api';
import {reconciliation} from '@/lib/courier-reconciliation';
import {billApprover,billError,billShipments} from '../../_shared';
export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){
 const auth=await courierAuth(request,true);if('error'in auth)return auth.error;const {id}=await params;if(!UUID_RE.test(id))return NextResponse.json({error:'Invalid bill.'},{status:400});
 try{
  if(!await billApprover(auth.supabase,auth.user.id))return NextResponse.json({error:'Your account is not an assigned bill approver.'},{status:403});
  const body=await request.json();const note=typeof body.reviewNote==='string'?body.reviewNote.trim().slice(0,4000):'';
  if(body.originalChecked!==true||note.length<10)throw new Error('Check the original PDF and record your review note before approval.');
  const {data:bill,error}=await auth.supabase.from('courier_bills').select('*').eq('id',id).maybeSingle();if(error)return billError(error);if(!bill)return NextResponse.json({error:'Bill not found.'},{status:404});
  if(bill.status!=='draft'||bill.version!==body.version)return NextResponse.json({error:'Bill changed or is already approved. Reload.'},{status:409});
  const shipments=await billShipments(auth.supabase),result=reconciliation({...bill.invoice,warnings:[]},shipments);
  if(result.issues.length||result.unresolved)throw new Error('Resolve every invoice and matching issue before approval.');
  const deferrals=result.unbilled.map(s=>({shipmentId:s.id,reason:typeof body.deferrals?.[s.id]==='string'?body.deferrals[s.id].trim().slice(0,2000):''}));
  if(deferrals.some(d=>d.reason.length<10))throw new Error('Explain each dispatch absent from this bill, such as confirmed late billing.');
  const links=result.rows.map(row=>({lineId:row.line.id,shipmentId:row.shipment!.id,updatedAt:shipments.find(s=>s.id===row.shipment!.id)!.updatedAt}));
  const {error:approve}=await auth.supabase.rpc('approve_courier_bill',{p_id:id,p_version:bill.version,p_actor:auth.user.id,p_links:links,p_deferrals:deferrals,p_note:note});if(approve)return billError(approve);
  return NextResponse.json({id,status:'approved'});
 }catch(error){return NextResponse.json({error:error instanceof Error?error.message:'Unable to approve this bill.'},{status:400});}
}
