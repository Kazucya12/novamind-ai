// Vercel serverless (gaya sama dengan api/v1/*): akun + sinkron chat. Database: Upstash Redis.
import crypto from 'node:crypto';
import { promisify } from 'node:util';
const scrypt = promisify(crypto.scrypt);

const URL_ = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const TOK = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
const SECRET = process.env.AUTH_SECRET;
const DAYS = 30, MAX = 900000;

async function rd(...cmd) {
  const r = await fetch(URL_, { method: 'POST', headers: { Authorization: 'Bearer ' + TOK, 'Content-Type': 'application/json' }, body: JSON.stringify(cmd) });
  const j = await r.json();
  if (j.error) throw new Error(j.error);
  return j.result;
}
const b64 = (s) => Buffer.from(s).toString('base64url');
const sign = (p) => crypto.createHmac('sha256', SECRET).update(p).digest('base64url');
function mint(email) { const p = b64(JSON.stringify({ e: email, x: Date.now() + DAYS * 864e5 })); return p + '.' + sign(p); }
function verify(t) {
  try {
    const [p, s] = String(t || '').split('.');
    const a = Buffer.from(s || ''), b = Buffer.from(sign(p));
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
    const o = JSON.parse(Buffer.from(p, 'base64url').toString());
    return o.x > Date.now() ? o.e : null;
  } catch { return null; }
}
const hashPw = async (pw, salt) => (await scrypt(pw, salt, 32)).toString('hex');
const emailOk = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e) && e.length <= 120;
const pub = (u) => ({ name: u.name, email: u.email, created: u.created });

const json = (c, o) => new Response(JSON.stringify(o), { status: c, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

export const OPTIONS = () => new Response(null, { status: 204 });

export const POST = async (req) => {
  const out = json;
  if (!URL_ || !TOK || !SECRET) return out(500, { error: 'Server belum dikonfigurasi (database / AUTH_SECRET belum diisi di Vercel).' });
  let b = {};
  try { b = (await req.json()) || {}; } catch { b = {}; }
  try {
    const a = b.a;
    if (a === 'register') {
      const name = String(b.name || '').trim().slice(0, 60), email = String(b.email || '').trim().toLowerCase(), pass = String(b.pass || '');
      if (name.length < 2) return out(400, { error: 'Nama minimal 2 karakter' });
      if (!emailOk(email)) return out(400, { error: 'Format email tidak valid' });
      if (pass.length < 8 || pass.length > 200) return out(400, { error: 'Kata sandi minimal 8 karakter' });
      const salt = crypto.randomBytes(16).toString('hex');
      const u = { name, email, salt, hash: await hashPw(pass, salt), created: Date.now() };
      const ok = await rd('SET', 'u:' + email, JSON.stringify(u), 'NX');
      if (!ok) return out(409, { error: 'Email sudah terdaftar, silakan masuk' });
      let ts = 0;
      if (typeof b.data === 'string' && b.data.length < MAX) { ts = Number(b.ts) || Date.now(); await rd('SET', 'd:' + email, JSON.stringify({ data: b.data, ts })); }
      return out(200, { token: mint(email), user: pub(u), data: ts ? b.data : null, ts });
    }
    if (a === 'login') {
      const email = String(b.email || '').trim().toLowerCase(), pass = String(b.pass || '');
      if (!emailOk(email) || !pass) return out(400, { error: 'Isi email dan kata sandi dengan benar' });
      const rk = 'rl:' + email, n = await rd('INCR', rk);
      if (n === 1) await rd('EXPIRE', rk, 900);
      if (n > 8) return out(429, { error: 'Terlalu banyak percobaan. Coba lagi dalam 15 menit.' });
      const raw = await rd('GET', 'u:' + email);
      const u = raw ? JSON.parse(raw) : null;
      if (!u) { await hashPw(pass, 'x'.repeat(32)); return out(401, { error: 'Email atau kata sandi salah' }); }
      const h = Buffer.from(await hashPw(pass, u.salt)), g = Buffer.from(u.hash);
      if (h.length !== g.length || !crypto.timingSafeEqual(h, g)) return out(401, { error: 'Email atau kata sandi salah' });
      await rd('DEL', rk);
      const d = await rd('GET', 'd:' + email);
      const o = d ? JSON.parse(d) : { data: null, ts: 0 };
      return out(200, { token: mint(email), user: pub(u), data: o.data, ts: o.ts });
    }
    const tk = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '') || b.token;
    const email = verify(tk);
    if (!email) return out(401, { error: 'Sesi berakhir, silakan masuk lagi' });
    if (a === 'load') {
      const raw = await rd('GET', 'u:' + email);
      if (!raw) return out(401, { error: 'Akun tidak ditemukan' });
      const d = await rd('GET', 'd:' + email);
      const o = d ? JSON.parse(d) : { data: null, ts: 0 };
      return out(200, { user: pub(JSON.parse(raw)), data: o.data, ts: o.ts });
    }
    if (a === 'save') {
      if (typeof b.data !== 'string' || b.data.length >= MAX) return out(413, { error: 'Data terlalu besar' });
      await rd('SET', 'd:' + email, JSON.stringify({ data: b.data, ts: Number(b.ts) || Date.now() }));
      return out(200, { ok: true });
    }
    if (a === 'delete') { await rd('DEL', 'u:' + email, 'd:' + email); return out(200, { ok: true }); }
    return out(400, { error: 'Aksi tidak dikenal' });
  } catch (e) {
    return out(500, { error: 'Kesalahan server: ' + String(e.message || e).slice(0, 120) });
  }
};
