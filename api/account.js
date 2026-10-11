// Vercel serverless: akun + sinkron chat + verifikasi email saat daftar. Database: Upstash Redis. Email: Brevo.
// Variabel Vercel: AUTH_SECRET, KV_REST_API_URL/TOKEN (Upstash), dan salah satu pengirim email:
//   Gmail : GMAIL_USER + GMAIL_APP_PASSWORD   (paling mudah)
//   Brevo : BREVO_API_KEY + MAIL_FROM
import crypto from 'node:crypto';
import tls from 'node:tls';
import { promisify } from 'node:util';
const scrypt = promisify(crypto.scrypt);

const URL_ = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const TOK = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
const SECRET = process.env.AUTH_SECRET;
const BREVO = process.env.BREVO_API_KEY;
const FROM = process.env.MAIL_FROM;
const GUSER = process.env.GMAIL_USER;
const GPASS = String(process.env.GMAIL_APP_PASSWORD || '').replace(/\s+/g, '');
const MAIL_OK = !!((GUSER && GPASS) || (BREVO && FROM));
const MAIL_ERR = 'Layanan email belum dikonfigurasi (isi GMAIL_USER dan GMAIL_APP_PASSWORD di Vercel).';
const DAYS = 30, MAX = 900000;
const CODE_TTL = 600, RESEND_WAIT = 60, MAX_TRIES = 5;
// Kuota AI + paket Pro (semua bisa diubah lewat variabel Vercel tanpa edit kode)
const DAILY_FREE = Math.max(1, Number(process.env.DAILY_FREE) || 30);   // pesan/hari akun gratis
const DAILY_PRO = Math.max(1, Number(process.env.DAILY_PRO) || 300);    // pesan/hari akun Pro
const PRO_DAYS = Math.max(1, Number(process.env.PRO_DAYS) || 30);       // lama Pro per pembelian
const ADMIN_KEY = process.env.ADMIN_KEY || '';                          // kunci panel admin.html
const PRO_PRICE = process.env.PRO_PRICE || 'Rp 25.000';                 // teks harga
const PRO_LINK = process.env.PRO_LINK || '';                            // link bayar (Trakteer/Saweria/WhatsApp)
const WIB = 7 * 3600e3;

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

// kirim email lewat SMTP Gmail (TLS port 465), tanpa library
function smtpSend({ host, port, user, pass, from, to, subject, html }) {
  return new Promise((resolve, reject) => {
    const body = Buffer.from(html).toString('base64').replace(/.{76}/g, '$&\r\n');
    const msg = ['From: "NovaMind" <' + from + '>', 'To: <' + to + '>', 'Subject: =?UTF-8?B?' + Buffer.from(subject).toString('base64') + '?=',
      'Date: ' + new Date().toUTCString(), 'MIME-Version: 1.0', 'Content-Type: text/html; charset=UTF-8', 'Content-Transfer-Encoding: base64', '', body].join('\r\n');
    const steps = [
      ['EHLO novamind', 250], ['AUTH LOGIN', 334], [Buffer.from(user).toString('base64'), 334], [Buffer.from(pass).toString('base64'), 235],
      ['MAIL FROM:<' + from + '>', 250], ['RCPT TO:<' + to + '>', 250], ['DATA', 354], [msg + '\r\n.', 250], ['QUIT', 221],
    ];
    let i = -1, buf = '', done = false;
    const sock = tls.connect({ host, port, servername: host });
    const fin = (err) => { if (done) return; done = true; clearTimeout(t); try { sock.destroy(); } catch {} err ? reject(err) : resolve(); };
    const t = setTimeout(() => fin(new Error('SMTP timeout')), 15000);
    sock.setEncoding('utf8');
    sock.on('error', (e) => fin(new Error('SMTP: ' + e.message)));
    sock.on('close', () => fin(i >= steps.length - 1 ? null : new Error('SMTP terputus')));
    sock.on('data', (d) => {
      buf += d;
      let k;
      while ((k = buf.indexOf('\r\n')) >= 0) {
        const line = buf.slice(0, k); buf = buf.slice(k + 2);
        if (!/^\d{3} /.test(line)) continue; // baris lanjutan (250-...)
        const code = +line.slice(0, 3), want = i < 0 ? 220 : steps[i][1];
        if (code !== want) return fin(new Error('SMTP ' + line.slice(0, 90)));
        i++;
        if (steps[i][0] === 'QUIT') { sock.write('QUIT\r\n'); return fin(null); }
        sock.write(steps[i][0] + '\r\n');
      }
    });
  });
}

async function sendMail(to, name, code) {
  const html = '<div style="font-family:Arial,sans-serif;max-width:420px;margin:auto;padding:24px;border:1px solid #e5e5ef;border-radius:14px">'
    + '<h2 style="margin:0 0 8px">NovaMind AI</h2>'
    + '<p>Halo ' + esc(name) + ', ini kode verifikasimu:</p>'
    + '<p style="font-size:34px;letter-spacing:8px;font-weight:700;margin:14px 0">' + code + '</p>'
    + '<p style="color:#666;font-size:13px">Kode berlaku 10 menit. Jangan bagikan kode ini ke siapa pun. Abaikan email ini jika kamu tidak mendaftar.</p></div>';
  const subject = 'Kode verifikasi NovaMind: ' + code;
  if (GUSER && GPASS) {
    await smtpSend({ host: process.env.SMTP_HOST || 'smtp.gmail.com', port: Number(process.env.SMTP_PORT) || 465, user: GUSER, pass: GPASS, from: GUSER, to, subject, html });
    return;
  }
  const r = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'api-key': BREVO, 'Content-Type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({ sender: { name: 'NovaMind', email: FROM }, to: [{ email: to, name }], subject, htmlContent: html }),
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
  const ip = getIp(req);
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

const getIp = (req) => (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || 'x';
const dayKey = () => new Date(Date.now() + WIB).toISOString().slice(0, 10);
const nextReset = () => Math.floor((Date.now() + WIB) / 864e5 + 1) * 864e5 - WIB; // 00.00 WIB berikutnya
function mkQuota(proUntil, used) {
  const isPro = proUntil > Date.now(), limit = isPro ? DAILY_PRO : DAILY_FREE, u = Math.min(used, limit);
  return {
    plan: isPro ? 'pro' : 'free', limit, used: u, remaining: Math.max(limit - used, 0), proUntil: isPro ? proUntil : 0, resetAt: nextReset(),
    plans: { free: DAILY_FREE, pro: DAILY_PRO, days: PRO_DAYS, price: PRO_PRICE, link: PRO_LINK },
  };
}
async function quotaOf(email) {
  const [pro, used] = await Promise.all([rd('GET', 'pro:' + email), rd('GET', 'q:' + email + ':' + dayKey())]);
  return mkQuota(Number(pro) || 0, Number(used) || 0);
}
const CODE_ABC = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function newVoucher() { let c = ''; for (let i = 0; i < 8; i++) c += CODE_ABC[crypto.randomInt(CODE_ABC.length)]; return 'NM' + c; }
const fmtVoucher = (c) => c.slice(0, 2) + '-' + c.slice(2, 6) + '-' + c.slice(6);
async function grantPro(email, days) {
  const cur = Number(await rd('GET', 'pro:' + email)) || 0;
  const until = Math.max(cur, Date.now()) + days * 864e5;
  await rd('SET', 'pro:' + email, String(until));
  return until;
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
      if (!MAIL_OK) return out(500, { error: MAIL_ERR });
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
      if (!MAIL_OK) return out(500, { error: MAIL_ERR });
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
    // panel admin: buat kode Pro / beri Pro manual (butuh ADMIN_KEY)
    if (a === 'admin_codes' || a === 'admin_grant') {
      if (!ADMIN_KEY) return out(500, { error: 'ADMIN_KEY belum diisi di Vercel.' });
      const ip = getIp(req), n = await rd('INCR', 'ra:' + ip);
      if (n === 1) await rd('EXPIRE', 'ra:' + ip, 900);
      if (n > 20) return out(429, { error: 'Terlalu banyak percobaan. Coba lagi nanti.' });
      const x = Buffer.from(String(b.key || '')), y = Buffer.from(ADMIN_KEY);
      if (x.length !== y.length || !crypto.timingSafeEqual(x, y)) return out(401, { error: 'Kunci admin salah' });
      const days = Math.min(Math.max(Math.floor(Number(b.days)) || PRO_DAYS, 1), 365);
      if (a === 'admin_codes') {
        const cnt = Math.min(Math.max(Math.floor(Number(b.count)) || 1, 1), 50), list = [];
        for (let i = 0; i < cnt; i++) { const c = newVoucher(); await rd('SET', 'v:' + c, String(days)); list.push(fmtVoucher(c)); }
        return out(200, { codes: list, days });
      }
      const em = String(b.email || '').trim().toLowerCase();
      if (!emailOk(em)) return out(400, { error: 'Format email tidak valid' });
      if (!(await rd('EXISTS', 'u:' + em))) return out(404, { error: 'Akun dengan email itu belum terdaftar' });
      return out(200, { email: em, proUntil: await grantPro(em, days) });
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
    if (a === 'quota') return out(200, { quota: await quotaOf(email) });
    if (a === 'use') {
      if (!(await rd('EXISTS', 'u:' + email))) return out(401, { error: 'Akun tidak ditemukan' });
      const proUntil = Number(await rd('GET', 'pro:' + email)) || 0;
      const limit = proUntil > Date.now() ? DAILY_PRO : DAILY_FREE, k = 'q:' + email + ':' + dayKey();
      const n = await rd('INCR', k);
      if (n === 1) await rd('EXPIRE', k, 172800);
      if (n > limit) {
        await rd('DECR', k);
        const isPro = proUntil > Date.now();
        return out(429, { error: 'Kuota harian ' + (isPro ? 'Pro ' : '') + 'habis (' + limit + '/' + limit + '). Reset otomatis jam 00.00 WIB.' + (isPro ? '' : ' Upgrade ke Pro untuk batas lebih besar.'), quota: mkQuota(proUntil, limit) });
      }
      return out(200, { quota: mkQuota(proUntil, n) });
    }
    if (a === 'redeem') {
      const code = String(b.code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
      if (code.length < 8) return out(400, { error: 'Kode tidak valid' });
      const rk = 'rv:' + email, n = await rd('INCR', rk);
      if (n === 1) await rd('EXPIRE', rk, 900);
      if (n > 10) return out(429, { error: 'Terlalu banyak percobaan. Coba lagi dalam 15 menit.' });
      const raw = await rd('GET', 'v:' + code);
      if (!raw || (await rd('DEL', 'v:' + code)) !== 1) return out(400, { error: 'Kode tidak valid atau sudah dipakai' });
      const days = Number(raw) || PRO_DAYS;
      await grantPro(email, days);
      return out(200, { ok: true, days, quota: await quotaOf(email) });
    }
    if (a === 'delete') { await rd('DEL', 'u:' + email, 'd:' + email); return out(200, { ok: true }); }
    return out(400, { error: 'Aksi tidak dikenal' });
  } catch (e) {
    return out(500, { error: 'Kesalahan server: ' + String(e.message || e).slice(0, 120) });
  }
};
