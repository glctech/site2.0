/* ============================================================================
 * /api/newsletter/unsubscribe — Cloudflare Pages Function
 * ----------------------------------------------------------------------------
 * GET  → página de confirmação (link clicado manualmente pelo destinatário).
 * POST → descadastro em um clique (RFC 8058 List-Unsubscribe-Post), usado
 *        pelo botão "Cancelar inscrição" que Gmail/Outlook mostram ao lado
 *        do remetente quando o e-mail traz o header List-Unsubscribe.
 * Mesmo token/rota para os dois métodos — token de 1 ano de validade, porque
 * o link precisa continuar funcionando em e-mails antigos.
 * ==========================================================================*/

import { verifyToken } from '../_lib/newsletter/security.mjs';
import { brandPage } from '../_lib/newsletter/page.mjs';

async function unsubscribe(request, env) {
  const token = new URL(request.url).searchParams.get('token') || '';
  const email = await verifyToken(env.HMAC_SECRET, 'unsub', token);
  if (!email) return null;

  await env.DB.prepare(
    "UPDATE subscribers SET status='unsubscribed', unsubscribed_at=datetime('now') WHERE email=?"
  ).bind(email).run();
  return email;
}

export async function onRequestGet(context) {
  const email = await unsubscribe(context.request, context.env);
  if (!email) return brandPage('Link inválido', 'Fale conosco para ser removido da lista, se preferir.');
  return brandPage('Inscrição cancelada', 'Você não vai mais receber o Boletim GLCTech.');
}

export async function onRequestPost(context) {
  const email = await unsubscribe(context.request, context.env);
  return new Response(null, { status: email ? 204 : 400 });
}
