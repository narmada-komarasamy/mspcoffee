import {NextResponse} from 'next/server';
import {courierAuth} from '../../../_auth';
import {UUID_RE} from '@/lib/auth/api';
import {validatePayment} from '@/lib/courier-bills';
import {billApprover,billError} from '../../_shared';
export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){
 const auth=await courierAuth(request,true);if('error'in auth)return auth.error;const {id}=await params;if(!UUID_RE.test(id))return NextResponse.json({error:'Invalid bill.'},{status:400});
 try{if(!await billApprover(auth.supabase,auth.user.id))return NextResponse.json({error:'Your account cannot record bill payments.'},{status:403});
 const body=await request.json();if(!UUID_RE.test(body.paymentId??''))throw new Error('Invalid payment identifier.');
 const {data:bill,error}=await auth.supabase.from('courier_bills').select('invoice').eq('id',id).maybeSingle();if(error)return billError(error);if(!bill)return NextResponse.json({error:'Bill not found.'},{status:404});
 const p=validatePayment(body,bill.invoice.total);
 const {error:paid}=await auth.supabase.rpc('pay_courier_bill',{p_id:id,p_payment_id:body.paymentId,p_actor:auth.user.id,p_paid_on:p.date,p_amount:p.amount,p_deduction:p.deduction,p_deduction_reason:p.reason,p_method:p.method,p_reference:p.reference});if(paid)return billError(paid);return NextResponse.json({id,status:'paid'});
 }catch(error){return NextResponse.json({error:error instanceof Error?error.message:'Invalid payment record.'},{status:400});}
}
