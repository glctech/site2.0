/* ============================================================================
 * Newsletter — envio de e-mail, reaproveitando o cliente SMTP existente.
 * ----------------------------------------------------------------------------
 * Usa a mesma caixa Zoho já configurada para contato/candidatura
 * (ZOHO_SMTP_USER/ZOHO_SMTP_PASS) — sem precisar de um mailbox
 * "newsletter@" dedicado nem de nova configuração de SPF/DKIM/DMARC, já que
 * o domínio já está autenticado para esse remetente.
 *
 * Cada chamada abre sua própria conexão SMTP (uma por destinatário). Para o
 * tamanho de lista esperado inicialmente isso é suficiente; se a lista
 * crescer para centenas/milhares de inscritos, migrar o laço de envio para
 * Cloudflare Queues (ver docs/NEWSLETTER.md).
 * ==========================================================================*/

import { sendZohoMail } from '../smtp.mjs';

export async function sendNewsletterMail(env, { to, subject, html, text, unsubscribeUrl }) {
  const extraHeaders = unsubscribeUrl ? {
    'List-Unsubscribe': `<${unsubscribeUrl}>`,
    'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
  } : {};

  await sendZohoMail(env, {
    to,
    subject,
    text,
    html,
    extraHeaders,
  });
}
