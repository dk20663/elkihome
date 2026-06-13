/**
 * Cloudflare Worker — прокси Supabase для embed-виджета elkihome24.ru
 *
 * Зачем: домен *.supabase.co заблокирован Роскомнадзором, поэтому из РФ
 * без VPN календарь на Тильде висит на запросах данных. Worker отдаёт
 * те же ответы со своего домена.
 *
 * Кеширование (edge cache via caches.default):
 *   - GET /rest/v1/houses              → 5 минут
 *   - GET /rest/v1/house_pricing       → 60 секунд
 *   - GET /rest/v1/public_bookings_view → 30 секунд
 *   Это делает повторные открытия календаря мгновенными для всех
 *   посетителей одного региона и снимает 99 % нагрузки с Supabase.
 *   Запись (POST/PATCH/DELETE) не кешируется.
 */

const TARGET = "https://hpfurpylorcuvcoevpsl.supabase.co";

const CACHE_RULES = [
  { path: "/rest/v1/public_bookings_view", ttl: 30 },
  { path: "/rest/v1/house_pricing", ttl: 60 },
  { path: "/rest/v1/houses", ttl: 300 },
];

function corsHeaders(request) {
  const reqHeaders =
    request.headers.get("Access-Control-Request-Headers") ||
    "authorization, apikey, content-type, accept-profile, content-profile, x-client-info, x-supabase-api-version, prefer, range";
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": reqHeaders,
    "Access-Control-Expose-Headers": "content-range, content-length, range",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin, Access-Control-Request-Headers",
  };
}

function cacheRuleFor(url) {
  return CACHE_RULES.find((r) => url.pathname.startsWith(r.path));
}

export default {
  async fetch(request, env, ctx) {
    const cors = corsHeaders(request);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors });
    }

    const url = new URL(request.url);
    const rule = request.method === "GET" ? cacheRuleFor(url) : null;

    // Edge cache lookup (keyed by full URL + query).
    const cache = caches.default;
    const cacheKey = new Request(url.toString(), { method: "GET" });
    if (rule) {
      const hit = await cache.match(cacheKey);
      if (hit) {
        const h = new Headers(hit.headers);
        for (const [k, v] of Object.entries(cors)) h.set(k, v);
        h.set("X-Edge-Cache", "HIT");
        return new Response(hit.body, { status: hit.status, headers: h });
      }
    }

    const targetUrl = TARGET + url.pathname + url.search;
    const headers = new Headers(request.headers);
    headers.delete("host");
    for (const k of [...headers.keys()]) {
      if (k.toLowerCase().startsWith("cf-")) headers.delete(k);
    }
    // Ask PostgREST for an exact count only when needed (skip for cached reads).
    if (rule) headers.set("accept-encoding", "gzip");

    const init = {
      method: request.method,
      headers,
      body: ["GET", "HEAD"].includes(request.method) ? undefined : request.body,
      redirect: "manual",
    };

    let response;
    try {
      response = await fetch(targetUrl, init);
    } catch (err) {
      return new Response(
        JSON.stringify({ error: "upstream_unreachable", message: String(err) }),
        { status: 502, headers: { ...cors, "content-type": "application/json" } }
      );
    }

    const respHeaders = new Headers(response.headers);
    respHeaders.delete("set-cookie");

    // Store in edge cache (only successful GETs matching a rule).
    if (rule && response.ok) {
      const cacheable = new Response(response.clone().body, {
        status: response.status,
        headers: (() => {
          const h = new Headers(respHeaders);
          h.set("Cache-Control", `public, s-maxage=${rule.ttl}`);
          return h;
        })(),
      });
      ctx.waitUntil(cache.put(cacheKey, cacheable));
    }

    for (const [k, v] of Object.entries(cors)) respHeaders.set(k, v);
    respHeaders.set("X-Edge-Cache", rule ? "MISS" : "BYPASS");

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: respHeaders,
    });
  },
};
