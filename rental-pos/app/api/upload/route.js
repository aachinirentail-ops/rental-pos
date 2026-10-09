import { NextResponse } from 'next/server';
import { savePhoto, safe } from '@/lib/db';

export const dynamic = 'force-dynamic';

const EXT = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };

export const POST = safe(async (req) => {
  const form = await req.formData();
  const file = form.get('file');
  if (!file || typeof file === 'string') {
    return NextResponse.json({ error: 'No file' }, { status: 400 });
  }
  const ext = EXT[file.type];
  if (!ext) return NextResponse.json({ error: 'Only JPG, PNG or WEBP images' }, { status: 400 });
  if (file.size > 15 * 1024 * 1024) {
    return NextResponse.json({ error: 'Image too large (max 15MB)' }, { status: 400 });
  }
  const prefix = form.get('kind') === 'item' ? 'item' : 'id'; // item photo or customer ID photo
  const name = `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}.${ext}`;
  await savePhoto(name, Buffer.from(await file.arrayBuffer()), file.type);
  return NextResponse.json({ name });
});
