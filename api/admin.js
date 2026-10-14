import crypto from 'node:crypto';
import { redis, configured, norm, ip, body, rate, addPro } from './_lib.js';

const AL = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const part = () => Array.from({ length: 4 }, () => AL[crypto.randomInt(AL.length)]).join('');
const clamp = (n, lo, hi, d) => Math.min(hi, Math.max(lo, Math.floor(+n) || d));

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!configured() || !process.env.ADMIN_SECRET) return res.status(500).json({ error: 'ADMIN_SECRET belum diatur.' });
  const given = Buffer.from(String(req.headers['x-admin-secret'] || '')), real = Buffer.from(process.env.ADMIN_SECRET);
  if (given.length !== real.length || !crypto.timingSafeEqual(given, real)) {
    await rate('rl:adm:' + ip(req), 1e9, 3600);
    const n = +(await redis('GET', 'rl:adm:' + ip(req))) || 0;
    return res.status(n > 10 ? 429 : 401).json({ error: 'Akses ditolak' });
  }
  const b = body(req);
  try {
    if (b.a === 'gen') {
      const count = clamp(b.count, 1, 50, 1), days = clamp(b.days, 1, 365, 30), codes = [];
      for (let i = 0; i < count; i++) {
        const c = 'NM-' + part() + '-' + part();
        await redis('SET', 'code:' + c, String(days));
        codes.push(c);
      }
      return res.status(200).json({ codes, days });
    }
    if (b.a === 'grant') {
      const email = norm(b.email), days = clamp(b.days, 1, 365, 30);
      if (!(await redis('EXISTS', 'u:' + email))) return res.status(404).json({ error: 'Akun tidak ditemukan' });
      return res.status(200).json({ email, proUntil: await addPro(email, days) });
    }
    return res.status(400).json({ error: 'Aksi tidak dikenal' });
  } catch (e) { console.error(e); return res.status(500).json({ error: 'Kesalahan server' }); }
}
