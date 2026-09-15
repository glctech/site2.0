/* ============================================================================
 * Newsletter — orquestração: coleta → geração → preview → aprovação → envio.
 * ==========================================================================*/

import { collectItems } from './feeds.mjs';
import { generateIssue } from './agent.mjs';
import { renderEmail } from './template.mjs';
import { sendNewsletterMail } from './mailer.mjs';
import { signToken } from './security.mjs';

const isTest = (env) => env.TEST_MODE === 'true';

export async function createDraft(env) {
  const { items, errors } = await collectItems();
  if (items.length < 5) {
    throw new Error(`Poucos itens coletados (${items.length}). Erros: ${errors.join('; ')}`);
  }

  const { results: companyNews } = await env.DB
    .prepare('SELECT id, title, summary, url FROM company_news WHERE used_in IS NULL ORDER BY id DESC LIMIT 3')
    .all();

  const content = await generateIssue(env, items, companyNews);

  const { meta } = await env.DB.prepare(
    'INSERT INTO issues (subject, content_json, sources_json, test_mode) VALUES (?, ?, ?, ?)'
  ).bind(
    content.subject, JSON.stringify(content),
    JSON.stringify({ items, companyNews }), isTest(env) ? 1 : 0
  ).run();
  const issueId = meta.last_row_id;

  const approveToken = await signToken(env.HMAC_SECRET, 'approve', String(issueId), 60 * 60 * 72);
  const approveUrl = `${env.WORKER_URL}/api/newsletter/approve?token=${encodeURIComponent(approveToken)}`;
  const { html, text } = renderEmail({
    content, items, companyNews, siteUrl: env.SITE_URL,
    unsubscribeUrl: `${env.SITE_URL}/#preview`, testBanner: isTest(env),
  });

  const previewHtml = `
    <div style="font-family:Arial;padding:16px;background:#fff">
      <p><strong>Rascunho #${issueId}</strong> — ${isTest(env) ? 'TEST_MODE ATIVO (envio só para ' + env.TEST_RECIPIENT + ')' : 'PRODUÇÃO'}</p>
      ${errors.length ? `<p style="color:#e6262c">Feeds com erro: ${errors.join('; ')}</p>` : ''}
      <p><a href="${approveUrl}" style="background:#e6262c;color:#fff;padding:10px 18px;text-decoration:none">Revisar e aprovar</a></p>
      <p style="font-size:12px">O link acima abre uma página de confirmação — nada é enviado sem você clicar em "Aprovar" nela. Válido por 72h.</p>
    </div>${html}`;

  await sendNewsletterMail(env, {
    to: env.ADMIN_EMAIL,
    subject: `[RASCUNHO #${issueId}] ${content.subject}`,
    html: previewHtml,
    text: `Revisar e aprovar: ${approveUrl}\n\n${text}`,
  });

  return { issueId, items: items.length, feedErrors: errors };
}

export async function sendIssue(env, issueId) {
  const issue = await env.DB.prepare('SELECT * FROM issues WHERE id = ?').bind(issueId).first();
  if (!issue) throw new Error('Edição não encontrada');
  if (issue.status !== 'draft') return { alreadyProcessed: true, status: issue.status };

  // Trava contra clique duplo: só passa de draft -> approved uma vez.
  const lock = await env.DB.prepare(
    "UPDATE issues SET status='approved', approved_at=datetime('now') WHERE id=? AND status='draft'"
  ).bind(issueId).run();
  if (lock.meta.changes === 0) return { alreadyProcessed: true };

  const content = JSON.parse(issue.content_json);
  const { items, companyNews } = JSON.parse(issue.sources_json);

  let recipients;
  if (isTest(env)) {
    recipients = [env.TEST_RECIPIENT];
  } else {
    const { results } = await env.DB
      .prepare("SELECT email FROM subscribers WHERE status='active'").all();
    recipients = results.map((r) => r.email);
  }

  let sent = 0;
  const failures = [];
  for (const email of recipients) {
    const token = await signToken(env.HMAC_SECRET, 'unsub', email, 60 * 60 * 24 * 365);
    const unsubscribeUrl = `${env.WORKER_URL}/api/newsletter/unsubscribe?token=${encodeURIComponent(token)}`;
    const { html, text } = renderEmail({
      content, items, companyNews, unsubscribeUrl, siteUrl: env.SITE_URL, testBanner: isTest(env),
    });
    try {
      await sendNewsletterMail(env, {
        to: email, subject: (isTest(env) ? '[TESTE] ' : '') + content.subject,
        html, text, unsubscribeUrl,
      });
      sent++;
    } catch (e) {
      failures.push({ email, error: e.message });
    }
  }

  await env.DB.prepare(
    "UPDATE issues SET status=?, sent_count=?, sent_at=datetime('now') WHERE id=?"
  ).bind(failures.length && !sent ? 'failed' : 'sent', sent, issueId).run();

  if (!isTest(env) && content.company_news.length) {
    for (const c of content.company_news) {
      await env.DB.prepare('UPDATE company_news SET used_in=? WHERE id=?').bind(issueId, c.id).run();
    }
  }

  return { sent, failures, testMode: isTest(env) };
}
