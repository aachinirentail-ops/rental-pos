// Optional: copy your local data/ (db.json + photos) into Supabase.
// Usage (after running supabase/schema.sql):
//   SUPABASE_URL=https://xxxx.supabase.co SUPABASE_SERVICE_ROLE_KEY=eyJ... node scripts/migrate-to-supabase.mjs
import fs from 'fs';
import path from 'path';

const URL_ = (process.env.SUPABASE_URL || '').replace(/\/+$/, '');
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const BUCKET = process.env.SUPABASE_BUCKET || 'uploads';
if (!URL_ || !KEY) { console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY first.'); process.exit(1); }
const H = { apikey: KEY, Authorization: 'Bearer ' + KEY };
const TYPES = { jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp' };

const data = JSON.parse(fs.readFileSync('data/db.json', 'utf8'));
const got = await (await fetch(`${URL_}/rest/v1/app_data?id=eq.1&select=version`, { headers: H })).json();
if (got.length) {
  const r = await fetch(`${URL_}/rest/v1/app_data?id=eq.1`, { method: 'PATCH', headers: { ...H, 'Content-Type': 'application/json' }, body: JSON.stringify({ data, version: got[0].version + 1 }) });
  if (!r.ok) throw new Error('save failed: ' + (await r.text()));
} else {
  const r = await fetch(`${URL_}/rest/v1/app_data`, { method: 'POST', headers: { ...H, 'Content-Type': 'application/json' }, body: JSON.stringify({ id: 1, data, version: 1 }) });
  if (!r.ok) throw new Error('save failed: ' + (await r.text()));
}
console.log(`data saved: ${data.items?.length || 0} items, ${data.bills?.length || 0} bills`);

const dir = 'data/uploads';
let n = 0;
for (const f of fs.existsSync(dir) ? fs.readdirSync(dir) : []) {
  const ext = f.split('.').pop().toLowerCase();
  if (!TYPES[ext]) continue;
  const r = await fetch(`${URL_}/storage/v1/object/${BUCKET}/${f}`, { method: 'POST', headers: { ...H, 'Content-Type': TYPES[ext], 'x-upsert': 'true' }, body: fs.readFileSync(path.join(dir, f)) });
  if (!r.ok) console.error('photo failed', f, await r.text()); else n++;
}
console.log(`photos uploaded: ${n}`);
