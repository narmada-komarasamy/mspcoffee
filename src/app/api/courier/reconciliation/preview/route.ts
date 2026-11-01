import {NextResponse} from 'next/server';
import {courierAuth} from '../../_auth';
import {COURIER_START_DATE} from '@/lib/courier';
import {sampleBill} from '@/lib/courier-reconciliation-samples';

export async function GET(request:Request){
  const auth=await courierAuth(request);if('error' in auth)return auth.error;
  const rows=[];
  for(let offset=0;;offset+=500){
    const {data,error}=await auth.supabase.from('courier_shipments').select('id,data').gte('data->>sent',COURIER_START_DATE).order('id').range(offset,offset+499);
    if(error)return NextResponse.json({error:'Unable to load the dispatch register.'},{status:503});
    rows.push(...data);if(data.length<500)break;
  }
  const key=new URL(request.url).searchParams.get('sample');
  return NextResponse.json({shipments:rows.map(r=>({id:r.id,...r.data})),bill:key==='professional'||key==='dtdc'?sampleBill(key):null},{headers:{'Cache-Control':'private, no-store'}});
}
