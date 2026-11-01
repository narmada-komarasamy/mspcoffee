import {NextResponse} from 'next/server';
import type {SupabaseClient} from '@supabase/supabase-js';
import {COURIER_START_DATE} from '@/lib/courier';
import type {ReconciliationShipment} from '@/lib/courier-reconciliation';
export async function billShipments(supabase:SupabaseClient){
 const rows:ReconciliationShipment[]=[];
 for(let offset=0;;offset+=500){const {data,error}=await supabase.from('courier_shipments').select('id,data,updated_at').gte('data->>sent',COURIER_START_DATE).order('id').range(offset,offset+499);if(error)throw new Error('Unable to load dispatches.');rows.push(...data.map(s=>({...s.data,id:s.id,updatedAt:s.updated_at})));if(data.length<500)break;}
 return rows as (ReconciliationShipment&{updatedAt:string})[];
}
export async function billApprover(supabase:SupabaseClient,actor:string){const {data,error}=await supabase.rpc('courier_can_approve_bill',{p_actor:actor});if(error)throw new Error('Unable to verify bill approval permission.');return data===true;}
export function billError(error:{code?:string;message?:string}){const status=error.code==='42501'?403:['23505','40001','23514'].includes(error.code??'')?409:500;return NextResponse.json({error:status===500?'The bill could not be saved. Your changes remain in the form.':error.code==='23505'?'This invoice, original file, consignment or payment reference has already been recorded. Open the existing record.':error.message||'Reload the bill and retry.'},{status});}
