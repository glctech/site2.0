/* ============================================================================
 * dev-api.mjs — local dev server for the decoupled site (no dependencies)
 * ----------------------------------------------------------------------------
 * Run:  node scripts/dev-api.mjs        →  http://localhost:8787
 *
 * Serves the static site AND the /api/stats endpoint from one origin, so you
 * can see Phase 0 (content hydration) and Phase 1 (the stats API) working
 * together locally — the same shape Cloudflare Pages serves in production.
 *
 * /api/stats reuses the SAME core as the production function
 * (functions/api/_lib/zabbix.mjs):
 *   - If ZABBIX_URL/USER/PASS are set in the environment → live Zabbix.
 *   - Otherwise → falls back to the committed assets/data/stats.json.
 * ==========================================================================*/

import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fetchZabbixStats } from '../functions/api/_lib/zabbix.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const PORT = process.env.PORT || 8787;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp',
  '.svg': 'image/svg+xml', '.pdf': 'application/pdf', '.ico': 'image/x-icon',
};

async function committedFallback() {
  try {
    const buf = await readFile(join(ROOT, 'assets/data/stats.json'), 'utf8');
    const data = JSON.parse(buf);
    data.source = 'fallback';
    return data;
  } catch {
    return { devices: 144, problems: 0, updated_at: new Date().toISOString(), source: 'default' };
  }
}

async function handleStats() {
  const { ZABBIX_URL, ZABBIX_USER, ZABBIX_PASS } = process.env;
  try {
    if (ZABBIX_URL && ZABBIX_USER && ZABBIX_PASS) {
      return await fetchZabbixStats({ url: ZABBIX_URL, user: ZABBIX_USER, pass: ZABBIX_PASS });
    }
    return await committedFallback();
  } catch (err) {
    const fb = await committedFallback();
    fb.error = String(err && err.message || err);
    return fb;
  }
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);

  if (url.pathname === '/api/stats') {
    const payload = await handleStats();
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
    res.end(JSON.stringify(payload, null, 2));
    return;
  }

  // Static files (prevent path traversal).
  let pathname = url.pathname === '/' ? '/index.html' : url.pathname;
  const filePath = normalize(join(ROOT, pathname));
  if (!filePath.startsWith(ROOT)) { res.writeHead(403); res.end('Forbidden'); return; }

  try {
    const body = await readFile(filePath);
    res.writeHead(200, { 'Content-Type': MIME[extname(filePath)] || 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('404 Not Found');
  }
});

server.listen(PORT, () => {
  const live = process.env.ZABBIX_URL ? 'LIVE Zabbix' : 'committed fallback (set ZABBIX_URL/USER/PASS for live)';
  console.log(`▶ Dev server: http://localhost:${PORT}`);
  console.log(`  /api/stats  → ${live}`);
  console.log(`  demo page   → http://localhost:${PORT}/content-demo.html`);
});
