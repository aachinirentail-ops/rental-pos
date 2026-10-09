import fs from 'fs';
import path from 'path';
import { DEFAULT_SETTINGS, normalizeBill } from './util';

const DATA_DIR = path.join(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');
export const UPLOAD_DIR = path.join(DATA_DIR, 'uploads');

// ---- storage backend: Supabase when SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY are set, otherwise local files ----
const SB_URL = (process.env.SUPABASE_URL || '').replace(/\/+$/, '');
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const SB_BUCKET = process.env.SUPABASE_BUCKET || 'uploads';
export const useSupabase = () => !!(SB_URL && SB_KEY);

const sbHeaders = (extra = {}) => ({ apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY, ...extra });
async function sb(pathname, init = {}) {
  const res = await fetch(SB_URL + pathname, { cache: 'no-store', ...init, headers: sbHeaders(init.headers) });
  return res;
}
async function sbFail(res, what) {
  let msg = '';
  try { msg = (await res.text()).slice(0, 300); } catch {}
  const e = new Error(`Supabase ${what} failed (${res.status}) ${msg}`);
  e.status = 500;
  return e;
}

const empty = () => ({ items: [], bills: [], counter: 0, settings: { ...DEFAULT_SETTINGS } });

export function ensure() {
  if (useSupabase()) return;
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify(empty(), null, 2));
  }
}

function parseFile(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function clean(raw) {
  const db = { ...empty(), ...raw };
  db.settings = { ...DEFAULT_SETTINGS, ...(raw.settings || {}) };
  db.items = (Array.isArray(db.items) ? db.items : []).map((it) => ({ ...it, code: String(it.code || ''), photo: it.photo || '' }));
  db.bills = (Array.isArray(db.bills) ? db.bills : []).map(normalizeBill);
  db.counter = Math.max(Number(db.counter) || 0, db.bills.length);
  return db;
}

async function readSupabase() {
  const q = '/rest/v1/app_data?id=eq.1&select=data,version';
  let res = await sb(q);
  if (!res.ok) throw await sbFail(res, 'read');
  let rows = await res.json();
  if (!rows.length) {
    // first run: create the single data row
    const ins = await sb('/rest/v1/app_data', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Prefer: 'resolution=ignore-duplicates,return=minimal' },
      body: JSON.stringify({ id: 1, data: empty(), version: 0 }),
    });
    if (!ins.ok) throw await sbFail(ins, 'init');
    res = await sb(q);
    if (!res.ok) throw await sbFail(res, 'read');
    rows = await res.json();
  }
  const db = clean(rows[0].data || {});
  Object.defineProperty(db, '__version', { value: Number(rows[0].version) || 0, enumerable: false, writable: true });
  return db;
}

export async function readDb() {
  if (useSupabase()) return readSupabase();
  ensure();
  let raw;
  try {
    raw = parseFile(DB_FILE);
  } catch (e) {
    // the file is damaged (power cut while saving?) - keep it aside and use the last backup
    try { fs.copyFileSync(DB_FILE, DB_FILE + '.corrupt-' + Date.now()); } catch {}
    try { raw = parseFile(DB_FILE + '.bak'); } catch { raw = empty(); }
  }
  return clean(raw);
}

// local: write to a temp file first, then swap it in, so a crash can never leave half a file
// supabase: compare-and-swap on a version number, so two people saving at once can never overwrite each other
export async function writeDb(db) {
  if (useSupabase()) {
    const v = db.__version || 0;
    const res = await sb(`/rest/v1/app_data?id=eq.1&version=eq.${v}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Prefer: 'return=representation' },
      body: JSON.stringify({ data: db, version: v + 1, updated_at: new Date().toISOString() }),
    });
    if (!res.ok) throw await sbFail(res, 'save');
    const rows = await res.json();
    if (!rows.length) {
      const e = new Error('Someone else saved a change a moment ago. Please try again.');
      e.status = 409;
      throw e;
    }
    db.__version = v + 1;
    return;
  }
  ensure();
  const tmp = DB_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(db, null, 2));
  try { fs.copyFileSync(DB_FILE, DB_FILE + '.bak'); } catch {}
  fs.renameSync(tmp, DB_FILE);
}

// ---- photos ----
export async function savePhoto(name, buffer, contentType) {
  if (useSupabase()) {
    const res = await sb(`/storage/v1/object/${SB_BUCKET}/${name}`, {
      method: 'POST',
      headers: { 'Content-Type': contentType, 'x-upsert': 'false' },
      body: buffer,
    });
    if (!res.ok) throw await sbFail(res, 'upload');
    return;
  }
  ensure();
  fs.writeFileSync(path.join(UPLOAD_DIR, name), buffer);
}

export async function loadPhoto(name) {
  if (useSupabase()) {
    const res = await sb(`/storage/v1/object/${SB_BUCKET}/${name}`);
    if (res.status === 404 || res.status === 400) return null;
    if (!res.ok) throw await sbFail(res, 'download');
    return Buffer.from(await res.arrayBuffer());
  }
  const file = path.join(UPLOAD_DIR, name);
  return fs.existsSync(file) ? fs.readFileSync(file) : null;
}

// turn thrown errors into a JSON answer (409 = someone else saved at the same time)
export const safe = (fn) => async (...args) => {
  try {
    return await fn(...args);
  } catch (e) {
    console.error(e);
    const status = e && e.status ? e.status : 500;
    return Response.json({ error: status === 409 ? e.message : 'Server error: ' + (e && e.message ? e.message : e) }, { status });
  }
};

export function newId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

// only accept file names that our own upload route could have produced
// (prefix "id" = customer ID photos, "item" = item photos)
const FILE_RE = /^(id|item)-[A-Za-z0-9_-]+\.(jpg|png|webp)$/;
export function safePhoto(name, prefix = 'id') {
  const n = String(name || '');
  return FILE_RE.test(n) && n.startsWith(prefix + '-') ? n : '';
}

// delete photo files that no remaining bill / item uses
export async function removeUnusedPhotos(db, names) {
  const used = new Set();
  for (const b of db.bills) {
    if (b.idPhoto) used.add(b.idPhoto);
    if (b.idPhotoBack) used.add(b.idPhotoBack);
  }
  for (const it of db.items) if (it.photo) used.add(it.photo);
  for (const n of names) {
    const safe = FILE_RE.test(String(n || '')) ? String(n) : '';
    if (!safe || used.has(safe)) continue;
    try {
      if (useSupabase()) await sb(`/storage/v1/object/${SB_BUCKET}/${safe}`, { method: 'DELETE' });
      else fs.unlinkSync(path.join(UPLOAD_DIR, safe));
    } catch {}
  }
}
