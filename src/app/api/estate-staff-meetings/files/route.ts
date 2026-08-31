import { NextResponse } from 'next/server';
import { requireEstateStaffMeetingUser, stringValue } from '../_auth';
import { signedStorageUrl } from '@/lib/storage/urls';

const fileTypes = ['meeting-pack', 'audio', 'minutes-draft', 'signed-minutes', 'attachment'];

export async function POST(request: Request) {
  const auth = await requireEstateStaffMeetingUser(request);
  if ('error' in auth) return auth.error;

  const formData = await request.formData();
  const meetingId = stringValue(formData.get('meetingId'));
  const fileType = stringValue(formData.get('fileType'));
  const uploadedBy = stringValue(formData.get('uploadedBy'));
  const file = formData.get('file');

  if (!meetingId || !fileTypes.includes(fileType) || !(file instanceof File)) {
    return NextResponse.json({ error: 'Meeting, file type and file are required' }, { status: 400 });
  }

  const ext = file.name.split('.').pop() ?? 'bin';
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '-');
  const path = `${meetingId}/${fileType}/${Date.now()}-${safeName || `file.${ext}`}`;
  const { error: uploadError } = await auth.supabase.storage
    .from('estate-staff-meetings')
    .upload(path, file, { contentType: file.type || undefined, upsert: false });

  if (uploadError) {
    return NextResponse.json({ error: `Upload failed: ${uploadError.message}` }, { status: 500 });
  }

  const { error: fileError } = await auth.supabase.from('estate_staff_meeting_files').insert([{
    meeting_id: meetingId,
    file_type: fileType,
    file_name: file.name,
    file_path: path,
    public_url: signedStorageUrl('estate-staff-meetings', path),
    content_type: file.type || null,
    file_size: file.size,
    uploaded_by: uploadedBy || null,
  }]);

  if (fileError) {
    return NextResponse.json({ error: `File uploaded, but record save failed: ${fileError.message}` }, { status: 500 });
  }

  return NextResponse.json({ ok: true }, { status: 201 });
}
