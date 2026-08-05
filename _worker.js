/* ============================================================================
 * Worker entrypoint (root _worker.js)
 * ----------------------------------------------------------------------------
 * This project is deployed as a "Workers with static assets" project (Git-
 * connected, production branch glctech2.0) — NOT classic Cloudflare Pages.
 * That means the `functions/api/*.js` files are NOT auto-discovered/auto-
 * routed the way they would be on Pages; we have to wire the routes up
 * ourselves here and fall through to the static-asset binding for everything
 * else (all the .html/.css/.js/images, exactly like today).
 *
 * Each function file still exports the same onRequestGet/onRequestPost/etc.
 * handlers written for the Pages Functions convention (they just take a
 * "context" object: { request, env, waitUntil, params }), so nothing in
 * functions/api/** had to change — only this router was added.
 * ==========================================================================*/

import * as sendEmail from './functions/api/send-email.js';
import * as stats from './functions/api/stats.js';

const routes = {
  '/api/send-email': sendEmail,
  '/api/stats': stats,
};

function methodHandler(mod, method) {
  const key = 'onRequest' + method.charAt(0) + method.slice(1).toLowerCase();
  return mod[key];
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const mod = routes[url.pathname];

    if (mod) {
      const handler = methodHandler(mod, request.method) || mod.onRequest;
      if (handler) {
        try {
          return await handler({
            request,
            env,
            waitUntil: ctx.waitUntil.bind(ctx),
            params: {},
          });
        } catch (err) {
          console.error(`Worker route error on ${url.pathname}:`, err && err.stack ? err.stack : err);
          return new Response(JSON.stringify({ success: false, message: 'Erro interno no servidor.' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json; charset=utf-8' },
          });
        }
      }
      return new Response('Método não permitido.', { status: 405 });
    }

    // Everything else: serve the static site exactly as before.
    return env.ASSETS.fetch(request);
  },
};
