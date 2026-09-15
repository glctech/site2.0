/* ============================================================================
 * Newsletter — envio de e-mail, reaproveitando o cliente SMTP existente.
 * ----------------------------------------------------------------------------
 * Autentica pela mesma caixa Zoho já configurada para contato/candidatura
 * (ZOHO_SMTP_USER/ZOHO_SMTP_PASS) — sem precisar de senha própria para
 * NEWSLETTER_FROM_EMAIL. Isso só funciona porque ZOHO_SMTP_USER tem
 * permissão "enviar como" configurada no Zoho Mail para esse remetente
 * (ex.: um grupo como marketing@glctech.com.br); sem essa permissão, trocar
 * NEWSLETTER_FROM_EMAIL faz o Zoho rejeitar ou marcar o envio como suspeito.
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
    from: env.NEWSLETTER_FROM_EMAIL || undefined,
  });
}
