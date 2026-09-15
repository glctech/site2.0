/* ============================================================================
 * POST /api/newsletter/subscribe — Cloudflare Pages Function
 * ----------------------------------------------------------------------------
 * Inscrição com double opt-in (LGPD): grava o e-mail como "pending" e manda
 * um link de confirmação. Só vira "active" (e passa a receber a newsletter)
 * depois que a pessoa clica no link. Nunca revela se um e-mail já está
 * inscrito (evita usar o formulário para checar a lista de terceiros).
 * ==========================================================================*/

import { isValidEmail, signToken } from '../_lib/newsletter/security.mjs';
import { sendNewsletterMail } from '../_lib/newsletter/mailer.mjs';

// Deve ser IDÊNTICO ao texto do checkbox no formulário do site.
export const CONSENT_TEXT =
  'Concordo em receber o Boletim GLCTech por e-mail. Posso cancelar a inscrição a qualquer momento.';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function json(body, status) {
  return new Response(JSON.stringify(body), {
    status: status || 200,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...CORS_HEADERS },
  });
}

export async function onRequestPost(context) {
  const { request, env } = context;

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'invalid_request' }, 400);
  }

  const email = String(body.email || '').trim().toLowerCase();
  if (body.website) return json({ ok: true }); // honeypot
  if (!isValidEmail(email)) return json({ error: 'invalid_email' }, 400);
  if (body.consent !== true) return json({ error: 'consent_required' }, 400);

  const existing = await env.DB.prepare('SELECT status FROM subscribers WHERE email=?').bind(email).first();
  if (existing?.status === 'active') return json({ ok: true }); // não revela status

  await env.DB.prepare(`
    INSERT INTO subscribers (email, consent_text, consent_ip, consent_at, status)
    VALUES (?, ?, ?, datetime('now'), 'pending')
    ON CONFLICT(email) DO UPDATE SET status='pending', consent_text=excluded.consent_text,
      consent_ip=excluded.consent_ip, consent_at=excluded.consent_at, unsubscribed_at=NULL
  `).bind(email, CONSENT_TEXT, request.headers.get('CF-Connecting-IP')).run();

  const token = await signToken(env.HMAC_SECRET, 'confirm', email, 60 * 60 * 48);
  const confirmUrl = `${env.WORKER_URL}/api/newsletter/confirm?token=${encodeURIComponent(token)}`;

  await sendNewsletterMail(env, {
    to: email,
    subject: 'Confirme sua inscrição — Boletim GLCTech',
    html: `<p>Confirme sua inscrição no Boletim GLCTech:</p>
           <p><a href="${confirmUrl}">Confirmar inscrição</a></p>
           <p>Se você não fez essa solicitação, é só ignorar este e-mail.</p>`,
    text: `Confirme sua inscrição: ${confirmUrl}`,
  });

  return json({ ok: true });
}

export async function onRequestGet() {
  return json({ error: 'method_not_allowed' }, 405);
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}
