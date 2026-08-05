/* ============================================================================
 * GET /api/stats — Cloudflare Pages Function (Phase 1 endpoint)
 * ----------------------------------------------------------------------------
 * The first REAL owned API endpoint. Replaces the "commit stats.json to git"
 * hack with a live, cached endpoint while preserving the site's fail-soft
 * philosophy:
 *
 *   1. Serve from the edge cache if fresh (TTL below) — cheap and fast.
 *   2. Otherwise hit Zabbix live via the shared core (functions/api/_lib).
 *   3. On any failure (or missing secrets), fall back to the committed
 *      /assets/data/stats.json so the front-end always gets a valid payload.
 *
 * Secrets live in the Pages project (Settings → Environment variables), NOT in
 * the repo: ZABBIX_URL, ZABBIX_USER, ZABBIX_PASS. This is the security win of
 * an owned back-end — credentials never ship to the browser.
 *
 * Deploy: Cloudflare Pages auto-discovers this file and routes it to /api/stats.
 * Ported to Vercel/Netlify by copying the handler body into their function
 * signature — the Zabbix logic in _lib is portable as-is.
 * ==========================================================================*/

import { fetchZabbixStats } from './_lib/zabbix.mjs';

const CACHE_TTL_SECONDS = 15 * 60; // 15 min — matches the daily-ish cadence, cheap on Zabbix

function json(body, status, extraHeaders) {
  return new Response(JSON.stringify(body), {
    status: status || 200,
    headers: Object.assign(
      {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': `public, max-age=${CACHE_TTL_SECONDS}`,
        'Access-Control-Allow-Origin': '*',
      },
      extraHeaders || {}
    ),
  });
}

async function committedFallback(request) {
  try {
    const url = new URL('/assets/data/stats.json', request.url);
    const r = await fetch(url.toString());
    if (r.ok) {
      const data = await r.json();
      data.source = 'fallback';
      return data;
    }
  } catch (_) { /* ignore */ }
  return { devices: 144, problems: 0, updated_at: new Date().toISOString(), source: 'default' };
}

export async function onRequestGet(context) {
  const { request, env } = context;

  // 1) Edge cache
  const cache = caches.default;
  const cacheKey = new Request(new URL('/api/stats', request.url).toString(), request);
  const cached = await cache.match(cacheKey);
  if (cached) return cached;

  let payload;
  try {
    if (env.ZABBIX_URL && env.ZABBIX_USER && env.ZABBIX_PASS) {
      payload = await fetchZabbixStats({
        url: env.ZABBIX_URL,
        user: env.ZABBIX_USER,
        pass: env.ZABBIX_PASS,
      });
    } else {
      payload = await committedFallback(request); // secrets not configured yet
    }
  } catch (err) {
    payload = await committedFallback(request); // live fetch failed — degrade gracefully
    payload.error = String(err && err.message || err);
  }

  const resp = json(payload);
  // Store a cacheable clone (Response bodies are single-use).
  context.waitUntil(cache.put(cacheKey, resp.clone()));
  return resp;
}

// CORS preflight (harmless; the endpoint is same-origin in production).
export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
