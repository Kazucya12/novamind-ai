import { handle } from '../../../lib/proxy.js';
import { authEmail, consume, refund } from '../../../lib/quota.js';

const H = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' };
const err = (s, m, extra = {}) => new Response(JSON.stringify({ error: { message: m } }), { status: s, headers: { ...H, ...extra } });
const usage = (q) => ({ 'X-Usage-Used': String(q.used), 'X-Usage-Limit': String(q.limit), 'X-Usage-Plan': q.plan });

export const POST = async (req) => {
  const email = authEmail(req);
  if (!email) return err(401, 'Sesi berakhir, silakan masuk lagi');

  let q;
  try { q = await consume(email); }
  catch (e) { return err(500, 'Kesalahan server: ' + String(e.message || e).slice(0, 100)); }
  if (!q.ok) return err(q.status, q.error, q.limit ? usage(q) : {});

  const res = await handle(req, 'chat');
  if (!res.ok) await refund(q.key); // gagal di proxy/upstream, jatah dikembalikan

  const h = new Headers(res.headers);
  Object.entries(usage(q)).forEach(([k, v]) => h.set(k, v));
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers: h });
};

export const OPTIONS = (req) => handle(req, 'chat');
