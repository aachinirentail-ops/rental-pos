import { NextResponse } from 'next/server';
import { readDb, writeDb, safe, newId, safePhoto, removeUnusedPhotos } from '@/lib/db';

export const dynamic = 'force-dynamic';

function withAvailability(db) {
  const out = {};
  for (const b of db.bills) {
    if (b.status !== 'active') continue;
    for (const i of b.items) out[i.itemId] = (out[i.itemId] || 0) + i.qty;
  }
  return db.items.map((it) => ({
    ...it,
    halfRate: Number(it.halfRate) || 0,
    rented: out[it.id] || 0,
    available: Math.max(0, it.stock - (out[it.id] || 0)),
  }));
}

const bad = (error) => NextResponse.json({ error }, { status: 400 });

// half-day rate is optional (empty / 0 = none) and must be lower than the day rate
function checkHalf(value, rate) {
  if (value === undefined || value === null || String(value).trim() === '') return { half: 0 };
  const h = Number(value);
  if (!Number.isFinite(h) || h < 0) return { error: 'Enter a valid half-day rate' };
  if (h > 0 && h >= rate) return { error: 'The half-day rate must be lower than the rate per day' };
  return { half: h };
}

// the item number (the number written on the tool) must be different for every item
function codeTaken(db, code, exceptId) {
  const c = code.toLowerCase();
  return !!c && db.items.some((x) => x.id !== exceptId && String(x.code || '').toLowerCase() === c);
}

export const GET = safe(async () => {
  const db = await readDb();
  return NextResponse.json(withAvailability(db));
});

export const POST = safe(async (req) => {
  const body = await req.json();
  const name = String(body.name || '').trim();
  const category = String(body.category || '').trim();
  const code = String(body.code || '').trim().slice(0, 30);
  if (!name || !category) return bad('Name and category are required');
  const rate = Number(body.rate);
  if (!Number.isFinite(rate) || rate < 0) return bad('Enter a valid rate');
  const db = await readDb();
  if (codeTaken(db, code)) return bad(`Item number "${code}" is already used by another item`);
  const { half, error: he } = checkHalf(body.halfRate, rate);
  if (he) return bad(he);
  const item = {
    id: newId(),
    code,
    name,
    category,
    rate,
    halfRate: half,
    stock: Math.max(0, parseInt(body.stock, 10) || 0),
    photo: safePhoto(body.photo, 'item'),
  };
  db.items.push(item);
  await writeDb(db);
  return NextResponse.json(item);
});

export const PUT = safe(async (req) => {
  const body = await req.json();
  const db = await readDb();
  const it = db.items.find((x) => x.id === body.id);
  if (!it) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const name = String(body.name ?? it.name).trim();
  const category = String(body.category ?? it.category).trim();
  const code = String(body.code ?? it.code ?? '').trim().slice(0, 30);
  if (!name || !category) return bad('Name and category are required');
  const rate = Number(body.rate ?? it.rate);
  if (!Number.isFinite(rate) || rate < 0) return bad('Enter a valid rate');
  const stock = Math.max(0, parseInt(body.stock ?? it.stock, 10) || 0);
  const { half, error: he } = checkHalf(body.halfRate === undefined ? it.halfRate : body.halfRate, rate);
  if (he) return bad(he);
  if (codeTaken(db, code, it.id)) return bad(`Item number "${code}" is already used by another item`);

  // stock can not go below what is out on rent right now
  const rented = withAvailability(db).find((x) => x.id === it.id)?.rented || 0;
  if (stock < rented) return bad(`${rented} of this item are rented out right now - stock cannot be less than that`);

  const oldPhoto = it.photo;
  const photo = body.photo === undefined ? it.photo : safePhoto(body.photo, 'item');

  // (bills keep the rate they were made with, so changing the rate only affects new bills)
  Object.assign(it, { name, category, code, rate, halfRate: half, stock, photo });
  await writeDb(db);
  await removeUnusedPhotos(db, [oldPhoto]);
  return NextResponse.json(it);
});

export const DELETE = safe(async (req) => {
  const id = new URL(req.url).searchParams.get('id');
  const db = await readDb();
  const item = db.items.find((x) => x.id === id);
  const inUse = db.bills.some((b) => b.status === 'active' && b.items.some((i) => i.itemId === id));
  if (inUse) {
    return NextResponse.json({ error: 'This item is currently rented out' }, { status: 400 });
  }
  db.items = db.items.filter((x) => x.id !== id);
  await writeDb(db);
  if (item) await removeUnusedPhotos(db, [item.photo]);
  return NextResponse.json({ ok: true });
});
