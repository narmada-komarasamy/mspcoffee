import { NextResponse } from 'next/server';
import { UUID_RE } from '@/lib/auth/api';
import { cleanShipment, text } from '@/lib/courier';
import { courierAuth } from './_auth';
export async function GET(request: Request) {
  const auth=await courierAuth(request);if('error' in auth)return auth.error;
  const shipments=[]; const recipients=[];
  // Fetch all pages so statements cannot silently omit records beyond the API row limit.
  for(let offset=0;;offset+=500){
    const {data,error}=await auth.supabase.from('courier_shipments').select('*').order('created_at',{ascending:false}).order('id').range(offset,offset+499);
    if(error)return NextResponse.json({error:'Unable to load courier shipments.'},{status:500});
    shipments.push(...data);if(data.length<500)break;
  }
  for(let offset=0;;offset+=500){
    const {data,error}=await auth.supabase.from('courier_recipients').select('*').order('id').range(offset,offset+499);
    if(error)return NextResponse.json({error:'Unable to load saved recipients.'},{status:500});
    recipients.push(...data);if(data.length<500)break;
  }
  return NextResponse.json({shipments:shipments.map(s=>({...s.data,id:s.id,recipientId:s.recipient_id,receiptPath:s.receipt_path,createdAt:s.created_at,updatedAt:s.updated_at,reviewRequired:s.review_required,sourceRef:s.source_ref})),recipients:recipients.map(r=>({...r.data,id:r.id,reviewRequired:r.review_required}))},{headers:{'Cache-Control':'private, no-store'}});
}
export async function POST(request: Request) {
  const auth=await courierAuth(request,true);if('error' in auth)return auth.error;
  try{
    const body=await request.json(); const data=cleanShipment(body);
    const id=text(body.id);if(!UUID_RE.test(id))throw new Error('Invalid shipment identifier.');
    const recipientId=text(body.recipientId);if(recipientId&&!UUID_RE.test(recipientId))throw new Error('Invalid recipient.');
    const {data:saved,error}=await auth.supabase.rpc('save_courier_shipment',{p_id:id,p_data:data,p_recipient_id:recipientId||null,p_update_contact:body.updateContact===true,p_actor:auth.user.id,p_expected:text(body.updatedAt)||null,p_new:body.isNew===true,p_reviewed:body.reviewed===true});
    if(error){const conflict=error.code==='23505'||error.code==='40001';return NextResponse.json({error:error.code==='23505'?'This courier and tracking number already exist, or this saved contact already exists. Open the existing record.':error.code==='40001'?'This shipment changed in another session. Reload and try again.':'Could not save the shipment.'},{status:conflict?409:500})}
    return NextResponse.json({id:saved});
  }catch(error){return NextResponse.json({error:error instanceof Error?error.message:'Invalid shipment.'},{status:400})}
}
