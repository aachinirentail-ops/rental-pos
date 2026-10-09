// Shared helpers (used by both the browser and the API routes - no Node-only code here).
//
// All dates/times are "local Sri Lanka time" strings: 'YYYY-MM-DDTHH:mm' (no timezone).
// A date-only string 'YYYY-MM-DD' is treated as 00:00.

export const MIN = 60000;
export const HOUR = 3600000;
export const DAY = 86400000;
const SL_OFFSET = 5.5 * HOUR;

export const DEFAULT_SETTINGS = {
  shopName: 'My Rental Shop',
  shopPhone: '',
  graceMinutes: 15, // extra minutes ignored before billing the next hour/day
  rounding: 'hourly', // 'hourly' = charge exact days + hours, 'daily' = round up to full days
};

/* ---------------------------- payment methods ---------------------------- */

export const PAY_METHODS = ['cash', 'bank', 'card', 'online'];
const METHOD_NAMES = {
  cash: { en: 'Cash', si: 'මුදල්' },
  bank: { en: 'Bank transfer', si: 'බැංකු මාරුව' },
  card: { en: 'Card', si: 'කාඩ්පත' },
  online: { en: 'Online / wallet', si: 'ඔන්ලයින් / වොලට්' },
};
export function cleanMethod(m) {
  return PAY_METHODS.includes(m) ? m : 'cash';
}
export function methodLabel(m, lang = 'en') {
  return (METHOD_NAMES[cleanMethod(m)] || METHOD_NAMES.cash)[lang === 'si' ? 'si' : 'en'];
}

// "Concrete mixer (M-001)" - the item number is the number written on the tool
export function itemLabel(i) {
  return i && i.code ? `${i.name} (${i.code})` : (i && i.name) || '';
}

/* ------------------------------ date / time ------------------------------ */

export function nowLocal() {
  return new Date(Date.now() + SL_OFFSET).toISOString().slice(0, 16);
}
export function today() {
  return nowLocal().slice(0, 10);
}
export function toMs(s) {
  if (!s) return NaN;
  const str = s.length === 10 ? s + 'T00:00' : String(s).slice(0, 16);
  return Date.parse(str + ':00Z');
}
export function fromMs(ms) {
  return new Date(ms).toISOString().slice(0, 16);
}
export function isValidLocal(s) {
  return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(s) && !isNaN(toMs(s));
}
// keeps the format of the input (date-only in -> date-only out)
export function addDays(s, n) {
  const out = fromMs(toMs(s) + Number(n) * DAY);
  return s.length === 10 ? out.slice(0, 10) : out;
}
// ISO string with Z (UTC)  ->  local Sri Lanka 'YYYY-MM-DDTHH:mm'
export function localFromIso(iso) {
  if (!iso) return '';
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(iso)) return iso;
  const ms = Date.parse(iso);
  return isNaN(ms) ? '' : fromMs(ms + SL_OFFSET);
}
export function fmtDT(s) {
  if (!s) return '-';
  if (s.length < 16) return s;
  let h = parseInt(s.slice(11, 13), 10);
  const ap = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${s.slice(0, 10)} ${h}:${s.slice(14, 16)} ${ap}`;
}
const DAY_NAMES = {
  en: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
  si: ['ඉරිදා', 'සඳුදා', 'අඟහරුවාදා', 'බදාදා', 'බ්‍රහස්පතින්දා', 'සිකුරාදා', 'සෙනසුරාදා'],
};
const DAY_SHORT = {
  en: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
  si: ['ඉරි', 'සඳු', 'අඟ', 'බදා', 'බ්‍රහ', 'සිකු', 'සෙන'],
};
const MONTH_NAMES = {
  en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
  si: ['ජනවාරි', 'පෙබරවාරි', 'මාර්තු', 'අප්‍රේල්', 'මැයි', 'ජූනි', 'ජූලි', 'අගෝස්තු', 'සැප්තැම්බර්', 'ඔක්තෝබර්', 'නොවැම්බර්', 'දෙසැම්බර්'],
};
const dowOf = (s) => new Date(s.slice(0, 10) + 'T00:00:00Z').getUTCDay();
// 'YYYY-MM-DD...'  ->  Thursday, 8 October 2026
export function fmtLongDate(s, lang = 'en') {
  if (!s) return '';
  const l = lang === 'si' ? 'si' : 'en';
  const y = s.slice(0, 4);
  const m = MONTH_NAMES[l][parseInt(s.slice(5, 7), 10) - 1];
  const d = parseInt(s.slice(8, 10), 10);
  return `${DAY_NAMES[l][dowOf(s)]}, ${d} ${m} ${y}`;
}
export function dayShort(s, lang = 'en') {
  return DAY_SHORT[lang === 'si' ? 'si' : 'en'][dowOf(s)];
}
// 'YYYY-MM-DDTHH:mm' -> 2:05 PM
export function fmtClock(s) {
  if (!s || s.length < 16) return '';
  let h = parseInt(s.slice(11, 13), 10);
  const ap = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h}:${s.slice(14, 16)} ${ap}`;
}
export function splitDT(s) {
  const f = fmtDT(s);
  return { date: f.slice(0, 10), time: f.slice(11) };
}
// 2 days 5 hrs / 5 hrs 20 min / 20 min   (Sinhala when lang === 'si')
export function fmtDuration(ms, lang = 'en') {
  const total = Math.max(0, Math.round(ms / MIN));
  const d = Math.floor(total / 1440);
  const h = Math.floor((total % 1440) / 60);
  const m = total % 60;
  const parts = [];
  if (lang === 'si') {
    if (d) parts.push(`දින ${d}`);
    if (h) parts.push(`පැය ${h}`);
    if (m && !d) parts.push(`මිනිත්තු ${m}`);
    return parts.length ? parts.join(' ') : 'මිනිත්තු 0';
  }
  if (d) parts.push(`${d} day${d > 1 ? 's' : ''}`);
  if (h) parts.push(`${h} hr${h > 1 ? 's' : ''}`);
  if (m && !d) parts.push(`${m} min`);
  return parts.length ? parts.join(' ') : '0 min';
}

/* -------------------------------- numbers -------------------------------- */

export function round2(n) {
  return Math.round((Number(n) || 0) * 100) / 100;
}
// 1,250 -> 1.3K   12,000 -> 12K   2,400,000 -> 2.4M  (short labels for charts)
export function compact(n) {
  const v = Math.abs(Number(n) || 0);
  const sign = n < 0 ? '-' : '';
  if (v >= 1e6) return sign + String(Math.round((v / 1e6) * 10) / 10) + 'M';
  if (v >= 1e3) return sign + String(Math.round((v / 1e3) * (v >= 1e4 ? 1 : 10)) / (v >= 1e4 ? 1 : 10)) + 'K';
  return sign + String(Math.round(v));
}

// how much of an item is left in the shop:  out | low | ok
export function stockState(it) {
  const stock = Number(it.stock) || 0;
  const left = Number(it.available) || 0;
  if (stock <= 0 || left <= 0) return 'out';
  if (stock >= 2 && left / stock <= 0.34) return 'low';
  return 'ok';
}

export function money(n) {
  return 'Rs. ' + Number(n || 0).toLocaleString('en-LK', { maximumFractionDigits: 2 });
}

// 0771234567 / +94771234567 / 94771234567  ->  94771234567
export function normalizePhone(phone) {
  let p = String(phone || '').replace(/\D/g, '');
  if (p.startsWith('00')) p = p.slice(2);
  if (p.startsWith('0')) p = '94' + p.slice(1);
  if (p.length === 9) p = '94' + p;
  return p;
}
export function waLink(phone, text) {
  return `https://wa.me/${normalizePhone(phone)}?text=${encodeURIComponent(text)}`;
}
// used to recognise the same customer again (NIC first, phone as fallback)
export function nicKey(nic) {
  return String(nic || '').replace(/[\s.-]/g, '').toLowerCase();
}
export function customerKey(c) {
  return nicKey(c.nic) || normalizePhone(c.phone);
}

/* ------------------------------ bill maths ------------------------------- */

export function perDayTotal(items) {
  return round2((items || []).reduce((s, l) => s + (Number(l.qty) || 0) * (Number(l.rate) || 0), 0));
}

// Half-day (up to 12 hours): an item can have its own lower half-day rate.
// No half-day rate (or one that is not lower than the day rate) = the full day rate is charged.
export const HALF_DAY_MINUTES = 720;
export function halfRateOf(l) {
  const r = Number(l.rate) || 0;
  const h = Number(l.halfRate) || 0;
  return h > 0 && h < r ? h : r;
}
export function perHalfTotal(items) {
  return round2((items || []).reduce((s, l) => s + (Number(l.qty) || 0) * halfRateOf(l), 0));
}
export function hasHalfRate(items) {
  return (items || []).some((l) => halfRateOf(l) < (Number(l.rate) || 0));
}
// 'Half day (12 hrs)' / 'දින 3'
export function bookedLabel(b, lang = 'en') {
  if (b.halfDay) return lang === 'si' ? 'භාග දිනය (පැය 12)' : 'Half day (12 hrs)';
  return lang === 'si' ? `දින ${b.days}` : `${b.days} day${b.days > 1 ? 's' : ''}`;
}

// booking estimate (before the items come back)
export function calcBooking(items, days, discountType, discountValue, halfDay = false) {
  const half = !!halfDay;
  const d = half ? 1 : Math.max(1, parseInt(days, 10) || 1);
  const subtotal = half ? perHalfTotal(items) : round2(perDayTotal(items) * d);
  const dv = Math.max(0, Number(discountValue) || 0);
  const raw = discountType === 'percent' ? (subtotal * Math.min(dv, 100)) / 100 : dv;
  const discountAmount = round2(Math.min(raw, subtotal));
  return { days: d, halfDay: half, subtotal, discountAmount, total: round2(subtotal - discountAmount) };
}

export function billStart(b) {
  return b.startAt || (b.startDate ? b.startDate + 'T00:00' : '');
}
export function billDue(b) {
  return b.dueAt || (b.dueDate ? b.dueDate + 'T23:59' : '');
}

/**
 * Final bill when the items come back.
 *   o.returnedAt    'YYYY-MM-DDTHH:mm'
 *   o.basis         'actual' (time really used, days + hours)  |  'booked' (days that were booked)
 *   o.extraCharge   damage / cleaning etc.
 *   o.discountType  'amount' | 'percent'   (discount applies to the rental charge)
 *   o.paidNow       money collected from the customer now
 */
export function calcSettlement(bill, o, settings = DEFAULT_SETTINGS) {
  const grace = Math.max(0, Number(settings.graceMinutes ?? 15) || 0);
  const rounding = settings.rounding === 'daily' ? 'daily' : 'hourly';
  const startMs = toMs(billStart(bill));
  const endMs = toMs(o.returnedAt);
  const usedMinutes = Math.max(0, Math.round((endMs - startMs) / MIN));
  const perDay = perDayTotal(bill.items);
  const perHalf = perHalfTotal(bill.items);
  const basis = o.basis === 'booked' ? 'booked' : 'actual';
  // half-day price: a half-day booking charged as booked, or any rental that came back within
  // 12 hours (+ grace) when at least one item has a lower half-day rate
  const halfDay =
    basis === 'booked' ? !!bill.halfDay : usedMinutes - grace <= HALF_DAY_MINUTES && perHalf < perDay;

  let rentalCharge;
  let billedHours; // what we actually charged for
  if (halfDay) {
    billedHours = 12;
    rentalCharge = perHalf;
  } else if (basis === 'booked') {
    billedHours = bill.days * 24;
    rentalCharge = perDay * bill.days;
  } else if (rounding === 'daily') {
    const days = Math.max(1, Math.ceil(Math.max(0, usedMinutes - grace) / 1440));
    billedHours = days * 24;
    rentalCharge = perDay * days;
  } else {
    let hours = Math.floor(usedMinutes / 60) + (usedMinutes % 60 > grace ? 1 : 0);
    hours = Math.max(24, hours); // minimum one day
    billedHours = hours;
    rentalCharge = (perDay * hours) / 24;
  }
  rentalCharge = round2(rentalCharge);

  const extraCharge = round2(Math.max(0, Number(o.extraCharge) || 0));
  const discountType = o.discountType === 'percent' ? 'percent' : 'amount';
  const discountValue = Math.max(0, Number(o.discountValue) || 0);
  const rawDisc = discountType === 'percent' ? (rentalCharge * Math.min(discountValue, 100)) / 100 : discountValue;
  const discountAmount = round2(Math.min(rawDisc, rentalCharge));
  const finalTotal = round2(rentalCharge - discountAmount + extraCharge);

  const advance = round2(bill.advance || 0);
  const balance = round2(finalTotal - advance);
  const refund = balance < 0 ? round2(-balance) : 0;
  const due = balance > 0 ? balance : 0;
  // `received` = money the customer hands over (can be more than the balance -> change is given back)
  const receivedRaw = o.received !== undefined && o.received !== '' ? o.received : o.paidNow;
  const tendered = due > 0 ? round2(Math.max(0, Number(receivedRaw) || 0)) : 0;
  const paidNow = round2(Math.min(tendered, due));
  const change = round2(Math.max(0, tendered - due));
  const outstanding = round2(due - paidNow);

  return {
    method: cleanMethod(o.method),
    tendered,
    change,
    returnedAt: o.returnedAt,
    basis,
    halfDay,
    usedMinutes,
    billedHours,
    rentalCharge,
    extraCharge,
    extraNote: String(o.extraNote || '').slice(0, 200),
    discountType,
    discountValue,
    discountAmount,
    finalTotal,
    advance,
    due,
    paidNow,
    refund,
    outstanding,
  };
}

export function outstandingOf(bill) {
  return bill.status === 'returned' ? Number(bill.settlement?.outstanding) || 0 : 0;
}

/* ----------------------------- bill status ------------------------------- */

// overdue / due-today / due-tomorrow / active / returned
export function dueInfo(bill) {
  if (bill.status !== 'active') return { state: bill.status, ms: 0 };
  const now = nowLocal();
  const dueAt = billDue(bill);
  const diff = toMs(dueAt) - toMs(now);
  if (diff < 0) return { state: 'overdue', ms: -diff };
  const dueDate = dueAt.slice(0, 10);
  const day = now.slice(0, 10);
  if (dueDate === day) return { state: 'due-today', ms: diff };
  if (dueDate === addDays(day, 1)) return { state: 'due-tomorrow', ms: diff };
  return { state: 'active', ms: diff };
}

// Fills in anything an older bill (from the first version of the app) does not have.
export function normalizeBill(raw) {
  const b = { ...raw };
  b.items = (Array.isArray(b.items) ? b.items : []).map((l) => ({ ...l, halfRate: Number(l.halfRate) || 0 }));
  b.halfDay = !!b.halfDay;
  b.days = b.halfDay ? 1 : Math.max(1, parseInt(b.days, 10) || 1);
  b.advance = round2(b.advance || 0);
  b.idPhotoBack = b.idPhotoBack || '';
  b.idPhoto = b.idPhoto || '';
  b.nic = b.nic || '';
  b.notes = b.notes || '';

  b.startAt = b.startAt || (b.startDate ? b.startDate + 'T00:00' : localFromIso(b.createdAt));
  b.dueAt = b.dueAt || (b.dueDate ? b.dueDate + 'T23:59' : addDays(b.startAt, b.halfDay ? 0.5 : b.days));
  b.createdAt = b.createdAt || b.startAt + ':00.000Z';
  b.startDate = b.startAt.slice(0, 10);
  b.dueDate = b.dueAt.slice(0, 10);

  if (!Array.isArray(b.payments)) {
    b.payments = b.advance > 0
      ? [{ at: localFromIso(b.createdAt) || b.startAt, amount: b.advance, type: 'advance', note: '' }]
      : [];
  }
  b.payments = b.payments.map((p) => ({ ...p, method: cleanMethod(p.method) }));
  b.advanceMethod = cleanMethod((b.payments.find((p) => p.type === 'advance') || {}).method || b.advanceMethod);
  b.returnedAt = b.returnedAt ? localFromIso(b.returnedAt) : null;

  if (b.status === 'returned' && !b.settlement) {
    // returned in the first version of the app: assume it was settled in full
    const paidNow = Math.max(0, round2((b.total || 0) - b.advance));
    b.settlement = {
      returnedAt: b.returnedAt || b.dueAt,
      basis: 'booked',
      usedMinutes: Math.max(0, Math.round((toMs(b.returnedAt || b.dueAt) - toMs(b.startAt)) / MIN)),
      billedHours: b.days * 24,
      rentalCharge: round2(b.subtotal || 0),
      extraCharge: 0,
      extraNote: '',
      discountType: b.discountType || 'amount',
      discountValue: b.discountValue || 0,
      discountAmount: round2(b.discountAmount || 0),
      finalTotal: round2(b.total || 0),
      advance: b.advance,
      due: paidNow,
      paidNow,
      refund: 0,
      outstanding: 0,
    };
    if (paidNow > 0) {
      b.payments.push({ at: b.returnedAt || b.dueAt, amount: paidNow, type: 'final', method: 'cash', note: '' });
    }
  }
  if (!b.settlement) b.settlement = null;
  if (b.settlement) {
    b.settlement = {
      ...b.settlement,
      method: cleanMethod(b.settlement.method),
      tendered: round2(b.settlement.tendered ?? b.settlement.paidNow ?? 0),
      change: round2(b.settlement.change || 0),
    };
  }
  return b;
}

/* ----------------------------- WhatsApp texts ---------------------------- */
// The messages follow the language selected in the app (en / si).

function itemLines(bill, lang) {
  const per = lang === 'si' ? 'දිනකට' : 'day';
  return bill.items.map((i) => `- ${itemLabel(i)} x${i.qty} @ ${money(i.rate)}/${per}`).join('\n');
}

// before the items come back (shown to the customer when the bill is made)
export function invoiceText(bill, shopName, lang = 'en') {
  const balance = money(Math.max(0, bill.total - (bill.advance || 0)));
  const due = billDue(bill);
  if (lang === 'si') {
    return (
      `${shopName}\nබිල්පත ${bill.billNo}\n\n` +
      `ගනුදෙනුකරු: ${bill.customerName}\n\n${itemLines(bill, lang)}\n\n` +
      `කුලියට ගත් වේලාව: ${fmtDT(billStart(bill))}\n` +
      `ආපසු භාරදිය යුතු වේලාව: ${fmtDT(due)} (${bookedLabel(bill, lang)})\n\n` +
      `උප මුළු: ${money(bill.subtotal)}\n` +
      (bill.discountAmount ? `වට්ටම: -${money(bill.discountAmount)}\n` : '') +
      `ඇස්තමේන්තුගත මුළු මුදල: ${money(bill.total)}\n` +
      `ගෙවූ අත්තිකාරම: ${money(bill.advance)}\n` +
      `ආපසු භාරදෙන විට ගෙවිය යුතු ශේෂය: ${balance}\n\n` +
      `* දින/පැය වෙනස් වුවහොත් අවසන් මුදල ආපසු භාරදෙන විට ගණනය කෙරේ.\nස්තූතියි!`
    );
  }
  return (
    `${shopName}\nBill ${bill.billNo}\n\n` +
    `Customer: ${bill.customerName}\n\n${itemLines(bill, lang)}\n\n` +
    `Rented: ${fmtDT(billStart(bill))}\n` +
    `Return by: ${fmtDT(due)} (${bookedLabel(bill, lang)})\n\n` +
    `Subtotal: ${money(bill.subtotal)}\n` +
    (bill.discountAmount ? `Discount: -${money(bill.discountAmount)}\n` : '') +
    `Estimated total: ${money(bill.total)}\n` +
    `Advance paid: ${money(bill.advance)}\n` +
    `Balance on return: ${balance}\n\n` +
    `* The final amount is calculated on return (actual days and hours used).\nThank you!`
  );
}

// reminder for an active rental (includes what it would cost if returned right now)
export function reminderText(bill, shopName, lang = 'en', settings = DEFAULT_SETTINGS) {
  const info = dueInfo(bill);
  const list = bill.items.map((i) => `${itemLabel(i)} x${i.qty}`).join(', ');
  const est = calcSettlement(
    bill,
    { returnedAt: nowLocal(), basis: 'actual', discountType: bill.discountType, discountValue: bill.discountValue },
    settings
  );
  const dueTxt = fmtDT(billDue(bill));

  if (lang === 'si') {
    let when;
    if (info.state === 'overdue') when = `${dueTxt} (${fmtDuration(info.ms, lang)} ප්‍රමාදයි)`;
    else if (info.state === 'due-today') when = `අද - ${dueTxt}`;
    else if (info.state === 'due-tomorrow') when = `හෙට - ${dueTxt}`;
    else when = dueTxt;
    return (
      `ආයුබෝවන් ${bill.customerName},\n${shopName} වෙතින් මතක් කිරීමක්.\n\n` +
      `බිල්පත: ${bill.billNo}\nභාණ්ඩ: ${list}\nආපසු භාරදිය යුතු වේලාව: ${when}\n\n` +
      `දැනට ගත වූ කාලය: ${fmtDuration(est.usedMinutes * MIN, lang)}\n` +
      `දැනට මුළු මුදල: ${money(est.finalTotal)}\n` +
      `ගෙවූ අත්තිකාරම: ${money(est.advance)}\n` +
      (est.due > 0 ? `ගෙවිය යුතු ශේෂය (දැන් භාරදුන්නොත්): ${money(est.due)}\n` : '') +
      `\nකරුණාකර භාණ්ඩ නියමිත වේලාවට ආපසු භාරදෙන්න. ස්තූතියි!`
    );
  }
  let when;
  if (info.state === 'overdue') when = `${dueTxt} (${fmtDuration(info.ms, lang)} overdue)`;
  else if (info.state === 'due-today') when = `TODAY - ${dueTxt}`;
  else if (info.state === 'due-tomorrow') when = `TOMORROW - ${dueTxt}`;
  else when = dueTxt;
  return (
    `Hello ${bill.customerName},\nThis is a friendly reminder from ${shopName}.\n\n` +
    `Bill: ${bill.billNo}\nItems: ${list}\nReturn by: ${when}\n\n` +
    `Time used so far: ${fmtDuration(est.usedMinutes * MIN, lang)}\n` +
    `Total so far: ${money(est.finalTotal)}\n` +
    `Advance paid: ${money(est.advance)}\n` +
    (est.due > 0 ? `Balance if returned now: ${money(est.due)}\n` : '') +
    `\nPlease return the items on time. Thank you!`
  );
}

// final bill after the items were returned
export function finalBillText(bill, shopName, lang = 'en') {
  const s = bill.settlement;
  if (!s) return invoiceText(bill, shopName, lang);
  const used = fmtDuration(s.usedMinutes * MIN, lang);
  if (lang === 'si') {
    return (
      `${shopName}\nඅවසන් බිල්පත ${bill.billNo}\n\n` +
      `ගනුදෙනුකරු: ${bill.customerName}\n\n${itemLines(bill, lang)}\n\n` +
      `කුලියට ගත්: ${fmtDT(billStart(bill))}\n` +
      `ආපසු භාරදුන්: ${fmtDT(s.returnedAt)}\n` +
      `ගත වූ කාලය: ${used}\n\n` +
      `කුලී මුදල: ${money(s.rentalCharge)}\n` +
      (s.extraCharge ? `අමතර ගාස්තු${s.extraNote ? ` (${s.extraNote})` : ''}: ${money(s.extraCharge)}\n` : '') +
      (s.discountAmount ? `වට්ටම: -${money(s.discountAmount)}\n` : '') +
      `අවසන් මුළු මුදල: ${money(s.finalTotal)}\n` +
      `ගෙවූ අත්තිකාරම: ${money(s.advance)}\n` +
      (s.paidNow ? `අද ගෙවූ මුදල: ${money(s.paidNow)} (${methodLabel(s.method, lang)})\n` : '') +
      (s.change ? `ලැබුණු මුදල: ${money(s.tendered)} · ආපසු දුන් ඉතිරිය: ${money(s.change)}\n` : '') +
      (s.refund ? `ආපසු ලබාදුන් මුදල: ${money(s.refund)} (${methodLabel(s.method, lang)})\n` : '') +
      (s.outstanding ? `ගෙවීමට ඉතිරි: ${money(s.outstanding)}\n` : '') +
      `\nස්තූතියි! නැවත හමුවෙමු.`
    );
  }
  return (
    `${shopName}\nFinal bill ${bill.billNo}\n\n` +
    `Customer: ${bill.customerName}\n\n${itemLines(bill, lang)}\n\n` +
    `Rented: ${fmtDT(billStart(bill))}\n` +
    `Returned: ${fmtDT(s.returnedAt)}\n` +
    `Time used: ${used}\n\n` +
    `Rental charge: ${money(s.rentalCharge)}\n` +
    (s.extraCharge ? `Extra charge${s.extraNote ? ` (${s.extraNote})` : ''}: ${money(s.extraCharge)}\n` : '') +
    (s.discountAmount ? `Discount: -${money(s.discountAmount)}\n` : '') +
    `Final total: ${money(s.finalTotal)}\n` +
    `Advance paid: ${money(s.advance)}\n` +
    (s.paidNow ? `Paid on return: ${money(s.paidNow)} (${methodLabel(s.method, lang)})\n` : '') +
    (s.change ? `Received: ${money(s.tendered)} · Change given: ${money(s.change)}\n` : '') +
    (s.refund ? `Refunded to you: ${money(s.refund)} (${methodLabel(s.method, lang)})\n` : '') +
    (s.outstanding ? `Still to pay: ${money(s.outstanding)}\n` : '') +
    `\nThank you! See you again.`
  );
}
