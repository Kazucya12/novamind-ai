// Kuota harian per akun (Upstash Redis). Dipakai route chat & models.
import crypto from 'node:crypto';

const URL_ = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const TOK = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
const SECRET = process.env.AUTH_SECRET;
const DAILY_FREE = Math.max(1, Number(process.env.DAILY_FREE) || 100);
const DAILY_PRO = Math.max(1, Number(process.env.DAILY_PRO) || 300);
const WIB = 7 * 3600e3;

async function rd(...cmd) {
  const r = await fetch(URL_, { method: 'POST', headers: { Authorization: 'Bearer ' + TOK, 'Content-Type': 'application/json' }, body: JSON.stringify(cmd) });
  const j = await r.json();
  if (j.error) throw new Error(j.error);
  return j.result;
}
const sign = (p) => crypto.createHmac('sha256', SECRET).update(p).digest('base64url');
function verify(t) {
  try {
    const [p, s] = String(t || '').split('.');
    const a = Buffer.from(s || ''), b = Buffer.from(sign(p));
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
    const o = JSON.parse(Buffer.from(p, 'base64url').toString());
    return o.x > Date.now() ? o.e : null;
  } catch { return null; }
}
const dayKey = () => new Date(Date.now() + WIB).toISOString().slice(0, 10);

export const authEmail = (req) =>
  verify((req.headers.get('authorization') || '').replace(/^Bearer\s+/i, ''));

// pakai 1 jatah; ok:false bila akun tidak ada / kuota habis
export async function consume(email) {
  if (!(await rd('EXISTS', 'u:' + email))) return { ok: false, status: 401, error: 'Akun tidak ditemukan' };
  const pro = Number(await rd('GET', 'pro:' + email)) || 0;
  const isPro = pro > Date.now();
  const limit = isPro ? DAILY_PRO : DAILY_FREE, plan = isPro ? 'pro' : 'free';
  const key = 'q:' + email + ':' + dayKey();
  const n = await rd('INCR', key);
  if (n === 1) await rd('EXPIRE', key, 172800);
  if (n > limit) {
    await rd('DECR', key);
    return { ok: false, status: 429, used: limit, limit, plan,
      error: 'Kuota harian ' + (isPro ? 'Pro ' : '') + 'habis (' + limit + '/' + limit + '). Reset otomatis jam 00.00 WIB.' + (isPro ? '' : ' Upgrade ke Pro untuk batas lebih besar.') };
  }
  return { ok: true, used: n, limit, plan, key };
}
export const refund = (key) => rd('DECR', key).catch(() => {});
