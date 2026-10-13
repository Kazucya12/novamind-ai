// NovaMind AI - proxy untuk Dattio AI (Vercel Function)
// Autentikasi & kuota ditangani di route (lib/quota.js), bukan di sini.
// Environment Variables di Vercel:
//   DATTIO_KEY     (WAJIB)       API key Dattio
//   ALLOWED_ORIGIN (opsional)    alamat situs lain yang boleh memanggil, pisahkan koma
//   UPSTREAM       (opsional)    default https://bandelbanget.xyz/v1
//   MODELS         (opsional)    daftar model yang diizinkan, pisahkan koma

const hits = new Map();
const MAX_BODY = 4300000; // batas Vercel 4,5 MB
const MAX_TOKENS = 4096;
const LIMIT = 20; // permintaan per menit per IP (per instance)

const J = (o, s, h) => new Response(JSON.stringify(o), {
  status: s, headers: { 'Content-Type': 'application/json', ...h }
});

function cors(req) {
  const o = req.headers.get('origin') || '';
  const list = (process.env.ALLOWED_ORIGIN || '').split(',').map(s => s.trim()).filter(Boolean);
  const host = req.headers.get('host') || '';
  const same = !o || o.endsWith('//' + host); // aplikasi di domain yang sama
  const ok = same || !list.length ? true : list.includes(o);
  return {
    ok,
    h: {
      'Access-Control-Allow-Origin': ok ? (o || '*') : 'null',
      'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
      'Access-Control-Allow-Headers': 'Authorization,Content-Type',
      'Access-Control-Expose-Headers': 'X-Usage-Used,X-Usage-Limit,X-Usage-Plan',
      'Access-Control-Max-Age': '86400',
      'Vary': 'Origin'
    }
  };
}

function limited(req) {
  const ip = (req.headers.get('x-forwarded-for') || 'x').split(',')[0].trim();
  const now = Date.now();
  const arr = (hits.get(ip) || []).filter(t => now - t < 60000);
  arr.push(now);
  hits.set(ip, arr);
  if (hits.size > 5000) hits.clear();
  return arr.length > LIMIT;
}

export async function handle(req, kind) {
  const { ok, h } = cors(req);
  if (req.method === 'OPTIONS') return new Response(null, { status: ok ? 204 : 403, headers: h });
  if (!ok) return J({ error: { message: 'Origin tidak diizinkan' } }, 403, h);
  const env = process.env;
  const KEY = env.DATTIO_KEY;
  if (!KEY) return J({ error: { message: 'DATTIO_KEY belum diisi di server' } }, 500, h);

  if (limited(req)) return J({ error: { message: 'Terlalu banyak permintaan, coba lagi sebentar' } }, 429, h);

  const up = (env.UPSTREAM || 'https://bandelbanget.xyz/v1').replace(/\/$/, '');
  const init = { headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + KEY } };
  let target;

  if (kind === 'chat' && req.method === 'POST') {
    const raw = await req.text();
    if (raw.length > MAX_BODY) return J({ error: { message: 'Permintaan terlalu besar (maks sekitar 4 MB)' } }, 413, h);
    let b;
    try { b = JSON.parse(raw); } catch (e) { return J({ error: { message: 'JSON tidak valid' } }, 400, h); }
    if (!Array.isArray(b.messages) || !b.model) return J({ error: { message: 'Format permintaan salah' } }, 400, h);
    const allow = (env.MODELS || '').split(',').map(s => s.trim()).filter(Boolean);
    if (allow.length && !allow.includes(b.model)) return J({ error: { message: 'Model tidak diizinkan' } }, 403, h);
    b.max_tokens = Math.min(Number(b.max_tokens) || MAX_TOKENS, MAX_TOKENS);
    target = up + '/chat/completions';
    init.method = 'POST';
    init.body = JSON.stringify(b);
  } else if (kind === 'models' && req.method === 'GET') {
    target = up + '/models';
    init.method = 'GET';
  } else {
    return J({ error: { message: 'Tidak ditemukan' } }, 404, h);
  }

  let res;
  try { res = await fetch(target, init); }
  catch (e) { return J({ error: { message: 'Server Dattio tidak bisa dihubungi' } }, 502, h); }
  return new Response(res.body, {
    status: res.status,
    headers: { 'Content-Type': res.headers.get('content-type') || 'application/json', 'Cache-Control': 'no-store', ...h }
  });
}
