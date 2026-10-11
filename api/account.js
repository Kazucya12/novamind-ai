// Vercel serverless: akun + sinkron chat + verifikasi email saat daftar. Database: Upstash Redis. Email: Brevo.
// Variabel Vercel yang dibutuhkan: AUTH_SECRET, KV_REST_API_URL/TOKEN (Upstash), BREVO_API_KEY, MAIL_FROM
import crypto from 'node:crypto';
import { promisify } from 'node:util';
const scrypt = promisify(crypto.scrypt);

const URL_ = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const TOK = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
const SECRET = process.env.AUTH_SECRET;
const BREVO = process.env.BREVO_API_KEY;
const FROM = process.env.MAIL_FROM;
const DAYS = 30, MAX = 900000;
const CODE_TTL = 600, RESEND_WAIT = 60, MAX_TRIES = 5;

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
const codeHash = (email, code) => sign('c:' + email + ':' + code);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const json = (c, o) => new Response(JSON.stringify(o), { status: c, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

async function sendMail(to, name, code) {
  const html = '<div style="font-family:Arial,sans-serif;max-width:420px;margin:auto;padding:24px;border:1px solid #e5e5ef;border-radius:14px">'
    + '<h2 style="margin:0 0 8px">NovaMind AI</h2>'
    + '<p>Halo ' + esc(name) + ', ini kode verifikasimu:</p>'
    + '<p style="font-size:34px;letter-spacing:8px;font-weight:700;margin:14px 0">' + code + '</p>'
    + '<p style="color:#666;font-size:13px">Kode berlaku 10 menit. Jangan bagikan kode ini ke siapa pun. Abaikan email ini jika kamu tidak mendaftar.</p></div>';
  const r = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'api-key': BREVO, 'Content-Type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({ sender: { name: 'NovaMind', email: FROM }, to: [{ email: to, name }], subject: 'Kode verifikasi NovaMind: ' + code, htmlContent: html }),
  });
  if (!r.ok) { let t = ''; try { t = await r.text(); } catch {} throw new Error('Gagal kirim email (' + r.status + '): ' + t.slice(0, 100)); }
}

// buat kode baru, simpan (hash), lalu kirim ke email
async function issue(email, pv) {
  const code = String(crypto.randomInt(100000, 1000000));
  await rd('SET', 'pv:' + email, JSON.stringify({ ...pv, ch: codeHash(email, code) }), 'EX', CODE_TTL);
  await rd('DEL', 'pt:' + email);
  try { await sendMail(email, pv.name, code); }
  catch (e) { await rd('DEL', 'pv:' + email); throw e; }
}

// batas pengiriman: cooldown per email, per jam per email, per jam per IP
async function sendGuard(req, email) {
  const ip = (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || 'x';
  const ni = await rd('INCR', 'ri:' + ip);
  if (ni === 1) await rd('EXPIRE', 'ri:' + ip, 3600);
  if (ni > 10) return { error: 'Terlalu banyak permintaan dari jaringanmu. Coba lagi nanti.' };
  const cd = await rd('SET', 'pc:' + email, '1', 'NX', 'EX', RESEND_WAIT);
  if (!cd) { const w = await rd('TTL', 'pc:' + email); return { error: 'Tunggu ' + Math.max(w, 1) + ' detik sebelum kirim ulang kode.', wait: Math.max(w, 1) }; }
  const ne = await rd('INCR', 'ps:' + email);
  if (ne === 1) await rd('EXPIRE', 'ps:' + email, 3600);
  if (ne > 5) return { error: 'Batas kirim kode per jam tercapai. Coba lagi nanti.' };
  return null;
}

export const OPTIONS = () => new Response(null, { status: 204 });

export const POST = async (req) => {
  const out = json;
  if (!URL_ || !TOK || !SECRET) return out(500, { error: 'Server belum dikonfigurasi (database / AUTH_SECRET belum diisi di Vercel).' });
  let b = {};
  try { b = (await req.json()) || {}; } catch { b = {}; }
  try {
    const a = b.a;

    // langkah 1: validasi data, kirim kode ke email (akun belum dibuat)
    if (a === 'register') {
      if (!BREVO || !FROM) return out(500, { error: 'Layanan email belum dikonfigurasi (BREVO_API_KEY / MAIL_FROM belum diisi di Vercel).' });
      const name = String(b.name || '').trim().slice(0, 60), email = String(b.email || '').trim().toLowerCase(), pass = String(b.pass || '');
      if (name.length < 2) return out(400, { error: 'Nama minimal 2 karakter' });
      if (!emailOk(email)) return out(400, { error: 'Format email tidak valid' });
      if (pass.length < 8 || pass.length > 200) return out(400, { error: 'Kata sandi minimal 8 karakter' });
      if (await rd('EXISTS', 'u:' + email)) return out(409, { error: 'Email sudah terdaftar, silakan masuk' });
      const g = await sendGuard(req, email);
      if (g) return out(429, g);
      const salt = crypto.randomBytes(16).toString('hex');
      await issue(email, { name, salt, hash: await hashPw(pass, salt) });
      return out(200, { pending: true });
    }

    // langkah 2: cek kode, baru akun dibuat
    if (a === 'verify') {
      const email = String(b.email || '').trim().toLowerCase(), code = String(b.code || '').replace(/\D/g, '');
      if (!emailOk(email) || code.length !== 6) return out(400, { error: 'Masukkan 6 digit kode' });
      const raw = await rd('GET', 'pv:' + email);
      if (!raw) return out(400, { error: 'Kode kedaluwarsa. Daftar ulang untuk mendapat kode baru.' });
      const n = await rd('INCR', 'pt:' + email);
      if (n === 1) await rd('EXPIRE', 'pt:' + email, CODE_TTL);
      if (n > MAX_TRIES) { await rd('DEL', 'pv:' + email, 'pt:' + email); return out(429, { error: 'Terlalu banyak salah. Daftar ulang untuk mendapat kode baru.' }); }
      const pv = JSON.parse(raw);
      const x = Buffer.from(codeHash(email, code)), y = Buffer.from(pv.ch);
      if (x.length !== y.length || !crypto.timingSafeEqual(x, y)) return out(400, { error: 'Kode salah (sisa percobaan: ' + (MAX_TRIES - n) + ')' });
      const u = { name: pv.name, email, salt: pv.salt, hash: pv.hash, created: Date.now() };
      const ok = await rd('SET', 'u:' + email, JSON.stringify(u), 'NX');
      if (!ok) return out(409, { error: 'Email sudah terdaftar, silakan masuk' });
      await rd('DEL', 'pv:' + email, 'pt:' + email);
      return out(200, { token: mint(email), user: pub(u), data: null, ts: 0 });
    }

    // kirim ulang kode (dengan cooldown)
    if (a === 'resend') {
      if (!BREVO || !FROM) return out(500, { error: 'Layanan email belum dikonfigurasi (BREVO_API_KEY / MAIL_FROM belum diisi di Vercel).' });
      const email = String(b.email || '').trim().toLowerCase();
      if (!emailOk(email)) return out(400, { error: 'Format email tidak valid' });
      const raw = await rd('GET', 'pv:' + email);
      if (!raw) return out(400, { error: 'Sesi pendaftaran berakhir. Daftar ulang.' });
      const g = await sendGuard(req, email);
      if (g) return out(429, g);
      const pv = JSON.parse(raw);
      await issue(email, { name: pv.name, salt: pv.salt, hash: pv.hash });
      return out(200, { ok: true });
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
