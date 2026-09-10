import { NextResponse } from 'next/server';
import {
  BUCKET,
  UUID_RE,
  requireEstateProduceUser,
  safeFileName,
  text,
} from '../_helpers';
import { signedStorageUrl } from '@/lib/storage/urls';

const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

export async function POST(request: Request) {
  const auth = await requireEstateProduceUser(request);
  if ('error' in auth) return auth.error;

  const formData = await request.formData().catch(() => null);
  if (!formData) return NextResponse.json({ error: 'Photo upload is required' }, { status: 400 });

  const file = formData.get('photo');
  const recordId = text(formData.get('recordId'));

  if (!(file instanceof File) || file.size <= 0) {
    return NextResponse.json({ error: 'Choose a photo to upload' }, { status: 400 });
  }
  if (!allowedTypes.includes(file.type)) {
    return NextResponse.json({ error: 'Photo must be JPG, PNG, GIF, or WebP' }, { status: 400 });
  }
  if (file.size > 10 * 1024 * 1024) {
    return NextResponse.json({ error: 'Photo must be 10 MB or smaller' }, { status: 400 });
  }

  const folder = UUID_RE.test(recordId) ? recordId : `drafts/${auth.user.id}`;
  const path = `${folder}/${Date.now()}-${safeFileName(file.name || 'estate-produce-photo')}`;
  const bytes = await file.arrayBuffer();

  const { error } = await auth.supabase.storage
    .from(BUCKET)
    .upload(path, Buffer.from(bytes), {
      contentType: file.type,
      upsert: true,
    });

  if (error) {
    return NextResponse.json({ error: `Photo upload failed: ${error.message}` }, { status: 500 });
  }

  return NextResponse.json({
    path,
    url: signedStorageUrl(BUCKET, path),
    fileName: file.name,
    contentType: file.type,
    size: file.size,
  }, { status: 201 });
}
