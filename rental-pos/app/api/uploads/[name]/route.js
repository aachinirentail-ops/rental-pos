import path from 'path';
import { loadPhoto, safe } from '@/lib/db';

export const dynamic = 'force-dynamic';

const TYPES = { jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp' };

export const GET = safe(async (_req, { params }) => {
  const { name: raw } = await params; // `await` also works on Next 14 (plain object) and Next 15 (promise)
  const name = path.basename(String(raw)); // blocks ../ tricks
  const data = await loadPhoto(name);
  if (!data) return new Response('Not found', { status: 404 });
  const ext = name.split('.').pop().toLowerCase();
  return new Response(data, {
    headers: {
      'Content-Type': TYPES[ext] || 'application/octet-stream',
      'Cache-Control': 'private, max-age=3600',
    },
  });
});
