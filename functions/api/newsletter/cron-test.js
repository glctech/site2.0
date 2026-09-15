/* ============================================================================
 * POST /api/newsletter/cron-test — Cloudflare Pages Function
 * ----------------------------------------------------------------------------
 * Roda exatamente a mesma lógica do gatilho semanal (`scheduled()` em
 * _worker.js), sob demanda — útil para testar o disparo automático sem
 * depender do agendamento de cron da Cloudflare (ex.: durante a fase de
 * teste, ou para diagnosticar se um cron não disparou). Admin-only.
 * ==========================================================================*/

import { checkAdmin } from '../_lib/newsletter/security.mjs';
import { runWeeklyCron } from '../_lib/newsletter/pipeline.mjs';

function json(body, status) {
  return new Response(JSON.stringify(body), {
    status: status || 200,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}

export async function onRequestPost(context) {
  const { request, env } = context;
  if (!checkAdmin(request, env)) return json({ error: 'unauthorized' }, 401);
  const result = await runWeeklyCron(env);
  return json(result);
}

export async function onRequestGet() {
  return json({ error: 'method_not_allowed' }, 405);
}
