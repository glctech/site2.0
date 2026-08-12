/* Minimal static file server so Playwright can load real pages during the
 * audit. Deliberately separate from scripts/dev-api.mjs (that one also wires
 * up the live /api/stats endpoint for interactive local dev; the auditor
 * just needs static files served fast and shut down cleanly afterwards). */

import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { ROOT } from './scan.mjs';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp',
  '.svg': 'image/svg+xml', '.pdf': 'application/pdf', '.ico': 'image/x-icon',
};

export function startStaticServer(port = 0) {
  return new Promise((resolvePromise) => {
    const server = createServer(async (req, res) => {
      const url = new URL(req.url, `http://localhost`);
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
    server.listen(port, '127.0.0.1', () => {
      const { port: actualPort } = server.address();
      resolvePromise({ server, baseUrl: `http://127.0.0.1:${actualPort}/`, close: () => new Promise((r) => server.close(r)) });
    });
  });
}
