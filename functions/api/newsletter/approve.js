/* ============================================================================
 * /api/newsletter/approve — Cloudflare Pages Function
 * ----------------------------------------------------------------------------
 * Aprovação em DUAS etapas, de propósito:
 *
 *   GET  → mostra uma página com um botão (form method="POST"). NÃO envia
 *          nada. Isso existe porque scanners de segurança corporativos
 *          (Outlook Safe Links, gateways de e-mail) costumam pré-visitar
 *          todo link de um e-mail automaticamente — se "aprovar" fosse um
 *          GET direto, um desses scanners dispararia o envio real sem
 *          nenhuma intenção humana.
 *   POST → essa sim envia (chamada pelo clique no botão da página acima).
 *
 * O token (72h) carrega o id do rascunho; sendIssue() também tem uma trava
 * atômica no banco contra clique duplo/reenvio.
 * ==========================================================================*/

import { verifyToken } from '../_lib/newsletter/security.mjs';
import { sendIssue } from '../_lib/newsletter/pipeline.mjs';
import { brandPage } from '../_lib/newsletter/page.mjs';

export async function onRequestGet(context) {
  const { request, env } = context;
  const token = new URL(request.url).searchParams.get('token') || '';
  const issueId = await verifyToken(env.HMAC_SECRET, 'approve', token);

  if (!issueId) {
    return brandPage('Link inválido ou expirado', 'Gere um novo rascunho para obter um novo link de aprovação.');
  }

  const confirmForm = `
    <form method="POST" action="/api/newsletter/approve">
      <input type="hidden" name="token" value="${token.replace(/"/g, '&quot;')}">
      <button type="submit" class="btn" style="border:none;cursor:pointer;font-size:15px">
        Aprovar e enviar edição #${issueId}
      </button>
    </form>`;

  return brandPage(
    `Aprovar edição #${issueId}`,
    'Clique no botão abaixo para confirmar o envio. Nada é enviado até você clicar.',
    { extraHtml: confirmForm }
  );
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const fd = await request.formData().catch(() => null);
  const token = fd ? String(fd.get('token') || '') : '';
  const issueId = await verifyToken(env.HMAC_SECRET, 'approve', token);

  if (!issueId) {
    return brandPage('Link inválido ou expirado', 'Gere um novo rascunho para obter um novo link de aprovação.');
  }

  const result = await sendIssue(env, Number(issueId));
  if (result.alreadyProcessed) {
    return brandPage('Já processado', `A edição #${issueId} já tinha sido enviada ou processada antes.`);
  }
  return brandPage(
    'Newsletter enviada',
    `Edição #${issueId}: ${result.sent} enviado(s), ${result.failures.length} falha(s)${result.testMode ? ' (TEST_MODE ativo)' : ''}.`
  );
}
