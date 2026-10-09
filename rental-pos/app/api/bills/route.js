import { NextResponse } from 'next/server';
import { readDb, writeDb, safe, newId, safePhoto, removeUnusedPhotos } from '@/lib/db';
import {
  calcBooking,
  calcSettlement,
  addDays,
  nowLocal,
  isValidLocal,
  normalizePhone,
  round2,
  toMs,
  billStart,
  cleanMethod,
  MIN,
} from '@/lib/util';

export const dynamic = 'force-dynamic';

const fail = (error, status = 400) => NextResponse.json({ error }, { status });

/* ---------------------------------- read --------------------------------- */

export const GET = safe(async (req) => {
  const id = new URL(req.url).searchParams.get('id');
  const db = await readDb();
  if (id) {
    const bill = db.bills.find((b) => b.id === id);
    if (!bill) return fail('Not found', 404);
    return NextResponse.json({ bill, settings: db.settings });
  }
  const bills = [...db.bills].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return NextResponse.json({ bills, settings: db.settings });
});

/* -------------------------------- helpers -------------------------------- */

function checkCustomer(body) {
  const customerName = String(body.customerName || '').trim();
  const phone = String(body.phone || '').trim();
  if (!customerName) return { error: 'Customer name is required' };
  const digits = normalizePhone(phone).length;
  if (digits < 9 || digits > 15) return { error: 'Enter a valid phone number' };
  return {
    customer: {
      customerName,
      phone,
      nic: String(body.nic || '').trim(),
      idPhoto: safePhoto(body.idPhoto),
      idPhotoBack: safePhoto(body.idPhotoBack),
      notes: String(body.notes || '').slice(0, 500),
    },
  };
}

// builds the bill lines and checks stock. `oldBill` = the bill being edited (its own items do not count as rented)
function buildLines(db, rows, oldBill) {
  const rented = {};
  for (const b of db.bills) {
    if (b.status !== 'active' || (oldBill && b.id === oldBill.id)) continue;
    for (const i of b.items) rented[i.itemId] = (rented[i.itemId] || 0) + i.qty;
  }
  const wanted = new Map();
  for (const row of Array.isArray(rows) ? rows : []) {
    const qty = Math.max(1, parseInt(row.qty, 10) || 1);
    wanted.set(row.itemId, (wanted.get(row.itemId) || 0) + qty);
  }
  if (wanted.size === 0) return { error: 'Add at least one item' };

  const lines = [];
  for (const [itemId, qty] of wanted) {
    const it = db.items.find((x) => x.id === itemId);
    const old = oldBill?.items.find((l) => l.itemId === itemId);
    if (!it && !old) return { error: 'Item not found' };
    if (it) {
      const free = it.stock - (rented[itemId] || 0);
      if (qty > free) return { error: `Only ${Math.max(0, free)} of "${it.name}" available` };
    }
    lines.push({
      itemId,
      code: it ? it.code || '' : old.code || '',
      name: it ? it.name : old.name,
      category: it ? it.category : old.category,
      qty,
      rate: old ? old.rate : it.rate, // an edited bill keeps the rate it was made with
      halfRate: old ? Number(old.halfRate) || 0 : Number(it.halfRate) || 0,
    });
  }
  return { lines };
}

function applyBooking(bill, body, lines) {
  const halfDay = body.halfDay === true || body.halfDay === 'true';
  const days = halfDay ? 1 : Math.max(1, Math.min(365, parseInt(body.days, 10) || 1));
  const startAt = isValidLocal(body.startAt) ? body.startAt : bill.startAt || nowLocal();
  const dType = body.discountType === 'percent' ? 'percent' : 'amount';
  const dValue = Math.max(0, Number(body.discountValue) || 0);
  const bk = calcBooking(lines, days, dType, dValue, halfDay);

  bill.items = lines;
  bill.days = days;
  bill.halfDay = halfDay;
  bill.startAt = startAt;
  bill.dueAt = addDays(startAt, halfDay ? 0.5 : days);
  bill.startDate = startAt.slice(0, 10);
  bill.dueDate = bill.dueAt.slice(0, 10);
  bill.subtotal = bk.subtotal;
  bill.discountType = dType;
  bill.discountValue = dValue;
  bill.discountAmount = bk.discountAmount;
  bill.total = bk.total;

  const advance = round2(Math.max(0, Number(body.advance) || 0));
  const old = (bill.payments || []).find((p) => p.type === 'advance');
  const method = cleanMethod(body.advanceMethod ?? old?.method);
  bill.payments = (bill.payments || []).filter((p) => p.type !== 'advance');
  if (advance > 0) bill.payments.unshift({ at: old?.at || nowLocal(), amount: advance, type: 'advance', method, note: '' });
  bill.advance = advance;
  bill.advanceMethod = method;
}

/* --------------------------------- create -------------------------------- */

export const POST = safe(async (req) => {
  const body = await req.json();
  const { customer, error: ce } = checkCustomer(body);
  if (ce) return fail(ce);
  const db = await readDb();
  const { lines, error: le } = buildLines(db, body.items, null);
  if (le) return fail(le);

  db.counter += 1;
  const bill = {
    id: newId(),
    billNo: 'R-' + String(db.counter).padStart(4, '0'),
    ...customer,
    payments: [],
    status: 'active',
    createdAt: new Date().toISOString(),
    returnedAt: null,
    settlement: null,
  };
  applyBooking(bill, body, lines);
  db.bills.push(bill);
  await writeDb(db);
  return NextResponse.json(bill);
});

/* ---------------------------------- edit --------------------------------- */

export const PUT = safe(async (req) => {
  const body = await req.json();
  const db = await readDb();
  const bill = db.bills.find((b) => b.id === body.id);
  if (!bill) return fail('Not found', 404);

  const { customer, error: ce } = checkCustomer(body);
  if (ce) return fail(ce);

  const oldPhotos = [bill.idPhoto, bill.idPhotoBack];
  Object.assign(bill, customer);

  // a returned bill is already settled: only the customer details, photos and notes can change
  if (bill.status === 'active') {
    const { lines, error: le } = buildLines(db, body.items, bill);
    if (le) return fail(le);
    applyBooking(bill, body, lines);
  }
  await writeDb(db);
  await removeUnusedPhotos(db, oldPhotos);
  return NextResponse.json(bill);
});

/* ------------------------- return / re-open / pay ------------------------- */

export const PATCH = safe(async (req) => {
  const body = await req.json();
  const db = await readDb();
  const bill = db.bills.find((b) => b.id === body.id);
  if (!bill) return fail('Not found', 404);

  if (body.action === 'return') {
    if (bill.status !== 'active') return fail('This bill is already closed');
    const returnedAt = isValidLocal(body.returnedAt) ? body.returnedAt : nowLocal();
    if (toMs(returnedAt) > toMs(nowLocal()) + 10 * MIN) return fail('The return time cannot be in the future');
    if (toMs(returnedAt) < toMs(billStart(bill))) return fail('The return time cannot be before the rental start');
    const s = calcSettlement(bill, { ...body, returnedAt }, db.settings);
    bill.status = 'returned';
    bill.returnedAt = returnedAt;
    bill.settlement = s;
    bill.payments = bill.payments.filter((p) => p.type === 'advance');
    if (s.paidNow > 0) {
      bill.payments.push({ at: nowLocal(), amount: s.paidNow, type: 'final', method: s.method, tendered: s.tendered, change: s.change, note: '' });
    }
    if (s.refund > 0) bill.payments.push({ at: nowLocal(), amount: -s.refund, type: 'refund', method: s.method, note: '' });
  } else if (body.action === 'reopen') {
    if (bill.status !== 'returned') return fail('This bill is not closed');
    const rented = {};
    for (const b of db.bills) {
      if (b.status !== 'active') continue;
      for (const i of b.items) rented[i.itemId] = (rented[i.itemId] || 0) + i.qty;
    }
    for (const l of bill.items) {
      const it = db.items.find((x) => x.id === l.itemId);
      if (it && l.qty > it.stock - (rented[l.itemId] || 0)) {
        return fail(`Not enough stock of "${it.name}" to re-open this bill`);
      }
    }
    bill.status = 'active';
    bill.returnedAt = null;
    bill.settlement = null;
    bill.payments = bill.payments.filter((p) => p.type === 'advance');
  } else if (body.action === 'pay') {
    if (bill.status !== 'returned' || !bill.settlement) return fail('Only closed bills can take a later payment');
    const left = bill.settlement.outstanding || 0;
    // `received` = what the customer handed over (more than `left` -> the rest is change); `amount` = older field name
    const tendered = round2(Math.max(0, Number(body.received ?? body.amount) || 0));
    const amount = round2(Math.min(tendered, left));
    if (amount <= 0) return fail('Nothing to pay');
    bill.settlement.paidNow = round2(bill.settlement.paidNow + amount);
    bill.settlement.outstanding = round2(left - amount);
    bill.payments.push({
      at: nowLocal(),
      amount,
      type: 'final',
      method: cleanMethod(body.method),
      tendered,
      change: round2(Math.max(0, tendered - left)),
      note: String(body.note || '').slice(0, 100),
    });
  } else {
    return fail('Unknown action');
  }
  await writeDb(db);
  return NextResponse.json(bill);
});

/* --------------------------------- delete -------------------------------- */

export const DELETE = safe(async (req) => {
  const id = new URL(req.url).searchParams.get('id');
  const db = await readDb();
  const bill = db.bills.find((b) => b.id === id);
  if (!bill) return fail('Not found', 404);
  db.bills = db.bills.filter((b) => b.id !== id);
  await writeDb(db);
  await removeUnusedPhotos(db, [bill.idPhoto, bill.idPhotoBack]);
  return NextResponse.json({ ok: true });
});
