import crypto from 'node:crypto';

const env = (k, d = '') => process.env[k] ?? d;

/* ---------- Redis (Upstash / Vercel KV, lewat REST) ---------- */
export async function redis(...cmd) {
  const url = env('UPSTASH_REDIS_REST_URL') || env('KV_REST_API_URL');
  const tok = env('UPSTASH_REDIS_REST_TOKEN') || env('KV_REST_API_TOKEN');
  const r = await fetch(url, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + tok, 'Content-Type': 'application/json' },
    body: JSON.stringify(cmd),
  });
  const j = await r.json();
  if (j.error) throw new Error(j.error);
  return j.result;
}

export function configured() {
  return !!(env('AUTH_SECRET') && (env('UPSTASH_REDIS_REST_URL') || env('KV_REST_API_URL')));
}

/* ---------- konfigurasi paket ---------- */
export const CFG = () => ({
  free: +env('FREE_LIMIT', 20),
  pro: +env('PRO_LIMIT', 200),
  price: env('PRO_PRICE', 'Rp25.000'),
  days: +env('PRO_DAYS', 30),
  link: env('BUY_LINK', ''),
});
export const PRO_MODELS = ['deepseek-v4-pro-0813', 'gpt-5.6-luna'];
export const MAXTOK = { free: 2500, pro: 5000 };

/* ---------- util ---------- */
export const norm = (e) => String(e || '').trim().toLowerCase();
export const ip = (req) => String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'x').split(',')[0].trim();
export function body(req) {
  let b = req.body;
  if (typeof b === 'string') { try { b = JSON.parse(b); } catch { b = {}; } }
  return b && typeof b === 'object' ? b : {};
}
export async function rate(key, max, ttl) {
  const n = await redis('INCR', key);
  if (n === 1) await redis('EXPIRE', key, ttl);
  return n <= max;
}

/* ---------- token & password ---------- */
const sig = (p) => crypto.createHmac('sha256', env('AUTH_SECRET')).update(p).digest('base64url');
export function signToken(email, days = 30) {
  const p = Buffer.from(JSON.stringify({ e: email, x: Date.now() + days * 864e5 })).toString('base64url');
  return p + '.' + sig(p);
}
export function verifyToken(t) {
  try {
    const [p, s] = String(t).split('.');
    const a = Buffer.from(s || ''), b = Buffer.from(sig(p));
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
    const o = JSON.parse(Buffer.from(p, 'base64url').toString());
    return o.x > Date.now() ? o.e : null;
  } catch { return null; }
}
export const bearer = (req) => {
  const h = req.headers.authorization || '';
  return h.startsWith('Bearer ') ? h.slice(7) : '';
};
export function hashPw(pw, salt = crypto.randomBytes(16).toString('hex')) {
  return { salt, hash: crypto.scryptSync(pw, salt, 64).toString('hex') };
}
export function checkPw(pw, salt, hash) {
  const h = crypto.scryptSync(pw, salt, 64), o = Buffer.from(hash, 'hex');
  return o.length === h.length && crypto.timingSafeEqual(h, o);
}

/* ---------- kuota ---------- */
export const dayKey = () => new Date(Date.now() + 7 * 36e5).toISOString().slice(0, 10); /* hari WIB */
export async function getQuota(email) {
  const c = CFG();
  const [used, pro] = await Promise.all([redis('GET', 'used:' + email + ':' + dayKey()), redis('GET', 'pro:' + email)]);
  const until = +pro || 0, isPro = until > Date.now(), limit = isPro ? c.pro : c.free, u = +used || 0;
  return {
    plan: isPro ? 'pro' : 'free', limit, used: u, remaining: Math.max(0, limit - u),
    proUntil: isPro ? until : 0,
    plans: { free: c.free, pro: c.pro, price: c.price, days: c.days, link: c.link },
  };
}
export async function addPro(email, days) {
  const cur = +(await redis('GET', 'pro:' + email)) || 0;
  const until = Math.max(cur, Date.now()) + days * 864e5;
  await redis('SET', 'pro:' + email, String(until));
  return until;
}
