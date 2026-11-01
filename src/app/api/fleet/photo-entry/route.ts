import { NextResponse } from 'next/server';
import { createHash } from 'node:crypto';
import { fleetAuth } from '@/lib/fleet/auth';
import { cleanFleetEntry, PHOTO_BUCKET, photoFilesError, photoSignature } from '@/lib/fleet/evidence';
export const maxDuration = 60;
export async function POST(request: Request) {
  const auth = await fleetAuth(request);
  if ('error' in auth) return auth.error;
  try {
    const form = await request.formData();
    const input = JSON.parse(String(form.get('record')));
    const record = cleanFleetEntry(input);
    const attach = form.get('mode') === 'attach';
    if (attach && (!Number.isSafeInteger(input.id) || input.id <= 0 || !Number.isSafeInteger(input.entry_version) || input.entry_version <= 0)) return NextResponse.json({error:'Reopen the existing entry before attaching photos.'},{status:400});
    const files = (['fuel','odometer'] as const).flatMap(kind => {
      const file = form.get(kind);
      return file instanceof File ? [{kind,file}] : [];
    });
    const invalid = photoFilesError(files.map(item => item.file));
    if (invalid) return NextResponse.json({error:invalid},{status:400});
    const photos = [];
    // Validate every file before any upload.
    for (const {kind,file} of files) {
      const bytes = new Uint8Array(await file.arrayBuffer());
      if (!photoSignature(bytes,file.type)) return NextResponse.json({error:'The photo does not match its file type. Choose an original JPG, PNG or WebP image.'},{status:400});
      photos.push({kind,file,bytes,sha256:createHash('sha256').update(bytes).digest('hex'),path:`${crypto.randomUUID()}/${kind}.${file.type === 'image/jpeg' ? 'jpg' : file.type === 'image/png' ? 'png' : 'webp'}`});
    }
    const uploaded: string[] = [];
    for (const photo of photos) {
      const {error} = await auth.supabase.storage.from(PHOTO_BUCKET).upload(photo.path,photo.bytes,{contentType:photo.file.type,upsert:false});
      if (error) {
        if (uploaded.length) await auth.supabase.storage.from(PHOTO_BUCKET).remove(uploaded);
        return NextResponse.json({error:'Could not store both original photos. Nothing was saved; please retry.'},{status:503});
      }
      uploaded.push(photo.path);
    }
    const {data,error} = await auth.supabase.rpc('save_fleet_entry',{
      p_record:attach ? {...record,id:input.id} : record,p_mode:attach?'attach':'create',p_expected_version:attach?input.entry_version:null,
      p_photos:photos.map(photo=>({kind:photo.kind,path:photo.path,name:photo.file.name.slice(0,255),sha256:photo.sha256})),
      p_confirmed_ids:[],p_date_reviewed:false,p_expected_path:'',p_actor:auth.user.id,
    });
    if (error || !data?.ok) {
      // A lost response may hide a committed transaction. Retain originals in that case.
      if (!error || ['23505','23514','22P02','P0001'].includes(error.code)) await auth.supabase.storage.from(PHOTO_BUCKET).remove(uploaded);
      return NextResponse.json(error ? {error:'Could not confirm the save. Check the daily log before retrying.'} : data,{status:error?503:409});
    }
    return NextResponse.json(data,{headers:{'Cache-Control':'private, no-store'}});
  } catch {
    return NextResponse.json({error:'Could not save the photo entry. Keep the originals and check the log before retrying.'},{status:400});
  }
}
