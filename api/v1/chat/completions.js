import { redis, configured, body, verifyToken, bearer, getQuota, dayKey, PRO_MODELS, MAXTOK } from '../../_lib.js';

const err = (res, code, message) => res.status(code).json({ error: { message } });
const TEST = 'Balas hanya dengan kata: OK';

export default async function handler(req, res) {
  if (req.method !== 'POST') return err(res, 405, 'Method not allowed');
  if (!configured() || !process.env.UPSTREAM_URL) return err(res, 500, 'Server belum dikonfigurasi (UPSTREAM_URL).');
  const email = verifyToken(bearer(req));
  if (!email) return err(res, 401, 'Sesi berakhir. Masuk lagi.');
  const b = body(req);
  if (typeof b.model !== 'string' || !Array.isArray(b.messages) || !b.messages.length) return err(res, 400, 'Permintaan tidak valid.');

  const users = b.messages.filter((m) => m && m.role === 'user');
  const isTest = b.messages.length <= 2 && users.length === 1 && users[0].content === TEST;
  const q = await getQuota(email), pro = q.plan === 'pro';
  if (PRO_MODELS.includes(b.model) && !pro) return err(res, 403, 'Model ini khusus NovaMind Pro.');

  let spent = false;
  if (!isTest) {
    const n = await redis('DECR', 'tk:' + email);
    if (n < 0) { await redis('INCR', 'tk:' + email); return err(res, 429, 'Kuota habis atau permintaan tidak sah. Muat ulang halaman.'); }
    spent = true;
  }
  const refund = async () => {
    if (!spent) return; spent = false;
    try { await redis('INCR', 'tk:' + email); await redis('DECR', 'used:' + email + ':' + dayKey()); } catch {}
  };

  const out = { model: b.model, messages: b.messages, stream: b.stream !== false, max_tokens: isTest ? 8 : pro ? MAXTOK.pro : MAXTOK.free };
  if (typeof b.temperature === 'number') out.temperature = b.temperature;
  const headers = { 'Content-Type': 'application/json' };
  if (process.env.ACCESS_CODE) headers.Authorization = 'Bearer ' + process.env.ACCESS_CODE;

  const ctl = new AbortController();
  res.on('close', () => ctl.abort());
  let up;
  try {
    up = await fetch(process.env.UPSTREAM_URL.replace(/\/$/, '') + '/chat/completions', { method: 'POST', headers, body: JSON.stringify(out), signal: ctl.signal });
  } catch { await refund(); return err(res, 502, 'Server AI tidak bisa dihubungi.'); }
  if (!up.ok) await refund();

  res.status(up.status);
  res.setHeader('Content-Type', up.headers.get('content-type') || 'application/json');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('X-Accel-Buffering', 'no');
  if (!up.body) return res.end(await up.text());
  try { for await (const chunk of up.body) res.write(chunk); } catch {}
  res.end();
}
