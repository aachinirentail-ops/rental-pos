import { NextResponse } from 'next/server';
import { readDb, writeDb, safe } from '@/lib/db';

export const dynamic = 'force-dynamic';

export const GET = safe(async () => {
  return NextResponse.json((await readDb()).settings);
});

export const PUT = safe(async (req) => {
  const body = await req.json();
  const db = await readDb();
  const grace = parseInt(body.graceMinutes, 10);
  db.settings = {
    ...db.settings,
    shopName: String(body.shopName || db.settings.shopName).trim(),
    shopPhone: String(body.shopPhone ?? db.settings.shopPhone).trim(),
    graceMinutes: Number.isFinite(grace) ? Math.min(Math.max(grace, 0), 180) : db.settings.graceMinutes,
    rounding: body.rounding === 'daily' ? 'daily' : 'hourly',
  };
  await writeDb(db);
  return NextResponse.json(db.settings);
});
