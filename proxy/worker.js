/**
 * BG VFR Planner — METAR/TAF proxy (Cloudflare Worker).
 *
 * aviationweather.gov does not send CORS headers, so browsers block direct
 * requests from the app. This worker forwards only METAR/TAF requests for
 * valid ICAO codes, adds CORS for the app's own origins and caches results
 * for 2 minutes. Single file, no dependencies: paste it into the Cloudflare
 * dashboard editor ("Edit code") and deploy.
 *
 *   GET /metar?ids=LBSF,LBPD   → aviationweather.gov /api/data/metar (JSON)
 *   GET /taf?ids=LBSF          → aviationweather.gov /api/data/taf   (JSON)
 */

/** Origins allowed to read the responses. */
export const ALLOWED_ORIGINS = [
  'https://yummydumpling.github.io',
  'http://localhost:5173',
  'http://localhost:4173',
];

const UPSTREAM = 'https://aviationweather.gov/api/data';
const USER_AGENT = 'BG-VFR-Planner-proxy/1.0 (+https://github.com/yummydumpling/bg-vfr-planner)';
const CACHE_SECONDS = 120;
const MAX_IDS = 12;

/** "lbsf, LBPD" → "LBSF,LBPD"; null if anything is not a 4-letter ICAO code. */
export function parseIds(raw) {
  if (!raw) return null;
  const ids = raw.split(',').map((s) => s.trim().toUpperCase()).filter(Boolean);
  if (!ids.length || ids.length > MAX_IDS) return null;
  if (!ids.every((id) => /^[A-Z]{4}$/.test(id))) return null;
  return [...new Set(ids)].sort().join(',');
}

export function corsHeaders(origin) {
  const h = { Vary: 'Origin' };
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    h['Access-Control-Allow-Origin'] = origin;
    h['Access-Control-Allow-Methods'] = 'GET, OPTIONS';
    h['Access-Control-Max-Age'] = '86400';
  }
  return h;
}

function json(body, status, origin, extra = {}) {
  return new Response(typeof body === 'string' ? body : JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...corsHeaders(origin), ...extra },
  });
}

export default {
  async fetch(request, _env, ctx) {
    const url = new URL(request.url);
    const origin = request.headers.get('Origin');

    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(origin) });
    if (request.method !== 'GET') return json({ error: 'method not allowed' }, 405, origin);

    const product = url.pathname.replace(/^\/+|\/+$/g, '');
    if (product !== 'metar' && product !== 'taf') return json({ error: 'use /metar or /taf' }, 404, origin);
    // Browsers always send Origin on cross-origin requests; refuse other sites.
    if (origin && !ALLOWED_ORIGINS.includes(origin)) return json({ error: 'origin not allowed' }, 403, origin);

    const ids = parseIds(url.searchParams.get('ids'));
    if (!ids) return json({ error: 'ids must be 1–12 four-letter ICAO codes' }, 400, origin);

    const upstream = `${UPSTREAM}/${product}?ids=${ids}&format=json${product === 'taf' ? '' : '&hours=2'}`;
    const cache = typeof caches !== 'undefined' ? caches.default : null;
    const cacheKey = new Request(upstream);
    if (cache) {
      const hit = await cache.match(cacheKey);
      if (hit) return json(await hit.text(), 200, origin, { 'Cache-Control': `max-age=${CACHE_SECONDS}`, 'X-Proxy-Cache': 'HIT' });
    }

    let res;
    try {
      res = await fetch(upstream, { headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' } });
    } catch {
      return json({ error: 'weather service unreachable' }, 502, origin);
    }
    // aviationweather.gov answers 204 when there is no data for these stations
    const text = res.status === 204 ? '[]' : await res.text();
    if (!res.ok) return json({ error: `weather service HTTP ${res.status}` }, 502, origin);

    if (cache && ctx?.waitUntil) {
      ctx.waitUntil(cache.put(cacheKey, new Response(text, { headers: { 'Cache-Control': `max-age=${CACHE_SECONDS}` } })));
    }
    return json(text, 200, origin, { 'Cache-Control': `max-age=${CACHE_SECONDS}`, 'X-Proxy-Cache': 'MISS' });
  },
};
