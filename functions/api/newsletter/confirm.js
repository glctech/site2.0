/* ============================================================================
 * GET /api/newsletter/confirm — Cloudflare Pages Function
 * ----------------------------------------------------------------------------
 * Segunda etapa do double opt-in: valida o token de 48h assinado no
 * subscribe.js e ativa o inscrito.
 * ==========================================================================*/

import { verifyToken } from '../_lib/newsletter/security.mjs';
import { brandPage } from '../_lib/newsletter/page.mjs';

export async function onRequestGet(context) {
  const { request, env } = context;
  const token = new URL(request.url).searchParams.get('token') || '';
  const email = await verifyToken(env.HMAC_SECRET, 'confirm', token);

  if (!email) {
    return brandPage('Link expirado', 'Esse link de confirmação não é mais válido. Inscreva-se novamente no site.');
  }

  await env.DB.prepare(
    "UPDATE subscribers SET status='active', confirmed_at=datetime('now') WHERE email=? AND status='pending'"
  ).bind(email).run();

  return brandPage('Inscrição confirmada', 'Você vai receber o próximo Boletim GLCTech.');
}
