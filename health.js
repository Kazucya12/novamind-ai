import { redis, configured } from './_lib.js';

/* Buka https://DOMAINMU/api/health untuk cek konfigurasi (hanya true/false, tidak menampilkan rahasia) */
export default async function handler(req, res) {
  const e = process.env;
  const out = {
    AUTH_SECRET: !!e.AUTH_SECRET,
    ADMIN_SECRET: !!e.ADMIN_SECRET,
    UPSTREAM_URL: !!e.UPSTREAM_URL,
    ACCESS_CODE: !!e.ACCESS_CODE,
    RESEND_API_KEY: !!e.RESEND_API_KEY,
    REDIS_URL: !!(e.UPSTASH_REDIS_REST_URL || e.KV_REST_API_URL),
    REDIS_TOKEN: !!(e.UPSTASH_REDIS_REST_TOKEN || e.KV_REST_API_TOKEN),
    node: process.version,
  };
  try { out.redis_ping = configured() ? await redis('PING') : 'dilewati (belum dikonfigurasi)'; }
  catch (err) { out.redis_ping = 'GAGAL: ' + String(err.message).slice(0, 120); }
  if (e.UPSTREAM_URL) {
    try {
      const h = e.ACCESS_CODE ? { Authorization: 'Bearer ' + e.ACCESS_CODE } : {};
      const r = await fetch(e.UPSTREAM_URL.replace(/\/$/, '') + '/models', { headers: h, signal: AbortSignal.timeout(5000) });
      out.upstream_status = r.status;
    } catch (err) { out.upstream_status = 'GAGAL: ' + String(err.message).slice(0, 120); }
  }
  res.status(200).json(out);
}
