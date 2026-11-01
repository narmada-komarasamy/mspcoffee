import { NextResponse } from 'next/server';
import { fleetAuth } from '@/lib/fleet/auth';
export async function DELETE(request:Request,context:{params:Promise<{id:string}>}){
  const auth=await fleetAuth(request);if('error' in auth)return auth.error;
  try {
    const {id}=await context.params, body=await request.json();
    if(!Number.isSafeInteger(Number(id))||Number(id)<=0||!Number.isSafeInteger(body.version)||body.version<=0)return NextResponse.json({error:'Reopen this entry before deleting.'},{status:400});
    const {data,error}=await auth.supabase.rpc('delete_fleet_entry',{p_id:Number(id),p_version:body.version,p_actor:auth.user.id});
    if(error)return NextResponse.json({error:'Could not delete the entry.'},{status:503});
    return NextResponse.json(data,{status:data?.ok?200:409});
  }catch{return NextResponse.json({error:'Invalid deletion request.'},{status:400});}
}
