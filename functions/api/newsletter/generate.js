/* ============================================================================
 * POST /api/newsletter/generate — Cloudflare Pages Function
 * ----------------------------------------------------------------------------
 * Gera um rascunho de edição e manda o preview para ADMIN_EMAIL, com o link
 * de revisão/aprovação. Chamado pelo cron semanal (ver _worker.js) ou
 * manualmente por um admin autenticado (Authorization: Bearer ADMIN_TOKEN).
 * ==========================================================================*/

import { checkAdmin } from '../_lib/newsletter/security.mjs';
import { createDraft } from '../_lib/newsletter/pipeline.mjs';

function json(body, status) {
  return new Response(JSON.stringify(body), {
    status: status || 200,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}

export async function onRequestPost(context) {
  const { request, env } = context;
  if (!checkAdmin(request, env)) return json({ error: 'unauthorized' }, 401);
  const result = await createDraft(env);
  return json(result);
}

export async function onRequestGet() {
  return json({ error: 'method_not_allowed' }, 405);
}
