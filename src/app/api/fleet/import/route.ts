import { NextResponse } from 'next/server';
import { fleetAuth } from '@/lib/fleet/auth';
import { cleanFleetEntry, fleetRowKey } from '@/lib/fleet/evidence';
export async function POST(request: Request) {
  const auth=await fleetAuth(request);if ('error' in auth) return auth.error;
  try {
    const body=await request.json();
    if (!Array.isArray(body.rows) || !body.rows.length || body.rows.length>500) throw Error('Import 1 to 500 rows at a time.');
    const rows=body.rows.map((input:Record<string,unknown>)=>cleanFleetEntry(input));
    const seen=new Set<string>();
    for (const row of rows) { const key=fleetRowKey(row);if(seen.has(key))throw Error(`The file repeats ${row.vehicle_id} on ${row.date}. Resolve the repeated rows first.`);seen.add(key); }
    const {data,error}=await auth.supabase.rpc('import_fleet_rows',{p_rows:rows,p_actor:auth.user.id});
    if(error || !data?.ok)return NextResponse.json({error:'Import could not be confirmed. Check the daily log before retrying; existing rows will not be overwritten.'},{status:503});
    return NextResponse.json(data,{headers:{'Cache-Control':'private, no-store'}});
  } catch(error) {return NextResponse.json({error:error instanceof Error?error.message:'Invalid import.'},{status:400});}
}
