import crypto from 'node:crypto';
import { redis, configured, norm, ip, body, rate, signToken, verifyToken, bearer, hashPw, checkPw, getQuota, addPro, dayKey } from './_lib.js';

const emailOk = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e) && e.length <= 120;
const newCode = () => String(crypto.randomInt(0, 1e6)).padStart(6, '0');
const J = (res, code, o) => res.status(code).json(o);

async function sendMail(to, code) {
  const key = process.env.RESEND_API_KEY;
  if (!key) { console.log('[DEV] kode verifikasi', to, code); return true; }
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: process.env.MAIL_FROM || 'NovaMind <onboarding@resend.dev>',
      to: [to],
      subject: 'Kode verifikasi NovaMind: ' + code,
      html: '<p>Kode verifikasi NovaMind kamu:</p><h2 style="letter-spacing:4px">' + code + '</h2><p>Berlaku 10 menit. Abaikan email ini jika kamu tidak mendaftar.</p>',
    }),
  });
  return r.ok;
}
const session = (u, data, ts) => ({ token: signToken(u.email), user: { name: u.name, email: u.email }, data, ts });

export default async function handler(req, res) {
  if (req.method !== 'POST') return J(res, 405, { error: 'Method not allowed' });
  if (!configured()) return J(res, 500, { error: 'Server belum dikonfigurasi (AUTH_SECRET / Redis).' });
  const b = body(req), a = b.a;
  try {
    /* ===== tanpa login ===== */
    if (a === 'register') {
      const name = String(b.name || '').trim().slice(0, 60), email = norm(b.email), pass = String(b.pass || '');
      if (name.length < 2) return J(res, 400, { error: 'Nama minimal 2 karakter' });
      if (!emailOk(email)) return J(res, 400, { error: 'Format email tidak valid' });
      if (pass.length < 8 || pass.length > 100) return J(res, 400, { error: 'Kata sandi 8-100 karakter' });
      if (!(await rate('rl:reg:' + ip(req), 10, 3600))) return J(res, 429, { error: 'Terlalu banyak pendaftaran. Coba lagi nanti.' });
      if (await redis('EXISTS', 'u:' + email)) return J(res, 409, { error: 'Email sudah terdaftar. Silakan masuk.' });
      const ttl = await redis('TTL', 'cd:' + email);
      if (ttl > 0) return J(res, 429, { error: 'Tunggu sebentar sebelum meminta kode lagi.', wait: ttl });
      const { salt, hash } = hashPw(pass), code = newCode();
      await redis('SET', 'pend:' + email, JSON.stringify({ name, salt, hash, code, tries: 0 }), 'EX', 600);
      await redis('SET', 'cd:' + email, '1', 'EX', 60);
      if (!(await sendMail(email, code))) return J(res, 502, { error: 'Gagal mengirim email verifikasi. Coba lagi.' });
      return J(res, 200, { ok: true });
    }
    if (a === 'resend') {
      const email = norm(b.email), p = JSON.parse((await redis('GET', 'pend:' + email)) || 'null');
      if (!p) return J(res, 400, { error: 'Pendaftaran kedaluwarsa. Daftar ulang.' });
      const ttl = await redis('TTL', 'cd:' + email);
      if (ttl > 0) return J(res, 429, { error: 'Tunggu sebentar sebelum meminta kode lagi.', wait: ttl });
      p.code = newCode(); p.tries = 0;
      await redis('SET', 'pend:' + email, JSON.stringify(p), 'EX', 600);
      await redis('SET', 'cd:' + email, '1', 'EX', 60);
      if (!(await sendMail(email, p.code))) return J(res, 502, { error: 'Gagal mengirim email verifikasi.' });
      return J(res, 200, { ok: true });
    }
    if (a === 'verify') {
      const email = norm(b.email), code = String(b.code || '').replace(/\D/g, '');
      const p = JSON.parse((await redis('GET', 'pend:' + email)) || 'null');
      if (!p) return J(res, 400, { error: 'Kode kedaluwarsa. Daftar ulang.' });
      if (p.tries >= 5) { await redis('DEL', 'pend:' + email); return J(res, 429, { error: 'Terlalu banyak percobaan. Daftar ulang.' }); }
      if (code !== p.code) {
        p.tries++; await redis('SET', 'pend:' + email, JSON.stringify(p), 'KEEPTTL');
        return J(res, 400, { error: 'Kode salah' });
      }
      const u = { name: p.name, email, salt: p.salt, hash: p.hash, created: Date.now() };
      if ((await redis('SET', 'u:' + email, JSON.stringify(u), 'NX')) !== 'OK') return J(res, 409, { error: 'Email sudah terdaftar.' });
      await redis('DEL', 'pend:' + email);
      return J(res, 200, session(u, null, 0));
    }
    if (a === 'login') {
      const email = norm(b.email), pass = String(b.pass || '');
      if ((+(await redis('GET', 'lf:' + email)) || 0) >= 8) return J(res, 429, { error: 'Terlalu banyak percobaan. Coba lagi 15 menit lagi.' });
      const u = JSON.parse((await redis('GET', 'u:' + email)) || 'null');
      if (!u || !checkPw(pass, u.salt, u.hash)) {
        if ((await redis('INCR', 'lf:' + email)) === 1) await redis('EXPIRE', 'lf:' + email, 900);
        return J(res, 401, { error: 'Email atau kata sandi salah' });
      }
      await redis('DEL', 'lf:' + email);
      const [data, ts] = await Promise.all([redis('GET', 'd:' + email), redis('GET', 'dts:' + email)]);
      return J(res, 200, session(u, data, +ts || 0));
    }

    /* ===== wajib login ===== */
    const email = verifyToken(bearer(req));
    if (!email || !(await redis('EXISTS', 'u:' + email))) return J(res, 401, { error: 'Sesi berakhir. Masuk lagi.' });

    if (a === 'save') {
      const data = typeof b.data === 'string' ? b.data : '', ts = +b.ts || Date.now();
      if (data.length > 800000) return J(res, 413, { error: 'Data terlalu besar untuk disinkronkan.' });
      const cur = +(await redis('GET', 'dts:' + email)) || 0;
      if (ts >= cur) { await redis('SET', 'd:' + email, data); await redis('SET', 'dts:' + email, String(ts)); }
      return J(res, 200, { ok: true });
    }
    if (a === 'load') {
      const [data, ts] = await Promise.all([redis('GET', 'd:' + email), redis('GET', 'dts:' + email)]);
      return J(res, 200, { data, ts: +ts || 0 });
    }
    if (a === 'delete') {
      await redis('DEL', 'u:' + email, 'd:' + email, 'dts:' + email, 'pro:' + email, 'tk:' + email);
      return J(res, 200, { ok: true });
    }
    if (a === 'quota') return J(res, 200, { quota: await getQuota(email) });
    if (a === 'use') {
      const q0 = await getQuota(email), key = 'used:' + email + ':' + dayKey();
      const n = await redis('INCR', key);
      if (n === 1) await redis('EXPIRE', key, 172800);
      if (n > q0.limit) {
        await redis('DECR', key);
        return J(res, 429, { error: 'Kuota harian habis (' + q0.limit + ' pesan). Reset 00.00 WIB atau upgrade ke Pro.', quota: await getQuota(email) });
      }
      /* tiket 1x pakai: dikonsumsi oleh proxy saat memanggil AI */
      const tk = 'tk:' + email;
      await redis('INCR', tk); await redis('EXPIRE', tk, 600);
      return J(res, 200, { quota: await getQuota(email) });
    }
    if (a === 'redeem') {
      const code = String(b.code || '').trim().toUpperCase();
      if (!(await rate('rl:rd:' + email, 10, 900))) return J(res, 429, { error: 'Terlalu banyak percobaan. Coba lagi nanti.' });
      if (!/^NM-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(code)) return J(res, 400, { error: 'Format kode tidak valid' });
      const days = +(await redis('GETDEL', 'code:' + code));
      if (!days) return J(res, 400, { error: 'Kode tidak valid atau sudah dipakai' });
      await addPro(email, days);
      return J(res, 200, { quota: await getQuota(email), days });
    }
    return J(res, 400, { error: 'Aksi tidak dikenal' });
  } catch (e) {
    console.error(e);
    return J(res, 500, { error: 'Kesalahan server. Coba lagi.' });
  }
}
