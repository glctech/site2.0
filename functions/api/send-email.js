/* ============================================================================
 * POST /api/send-email — Cloudflare Pages Function
 * ----------------------------------------------------------------------------
 * Single endpoint used by every form on the site (contato, diagnóstico da
 * landing page, e candidatura de carreiras). Replaces Web3Forms and
 * FormSubmit.co: e-mails now go out directly through a Zoho Mail mailbox via
 * SMTP (see functions/api/_lib/smtp.mjs), so nothing depends on a third-party
 * form service or its free-plan limits (which is what blocked file
 * attachments before).
 *
 * Request: multipart/form-data (works for plain fields AND the résumé file).
 * A regular HTML <form method="POST"> without JS also works as a no-JS
 * fallback, since Workers' request.formData() parses both
 * application/x-www-form-urlencoded and multipart/form-data bodies.
 *
 * Required field: form_type = "contact" | "diagnostico" | "candidatura"
 *
 * Secrets/config (Pages project → Settings → Environment variables):
 *   ZOHO_SMTP_USER, ZOHO_SMTP_PASS   — required, see _lib/smtp.mjs
 *   ZOHO_MAIL_TO_CONTATO             — optional, default contato@glctech.com.br
 *   ZOHO_MAIL_TO_RH                  — optional, default rh@glctech.com.br
 * ==========================================================================*/

import { sendZohoMail } from './_lib/smtp.mjs';

const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024; // 5MB, matches the front-end hint

// CORS: glctech.com.br redirects to glctechsec.com, which is fronted by a
// CDN (in a separate Cloudflare account) that blocks POST at the edge. Until
// that's fixed there, the front-end calls this endpoint's own Worker domain
// directly (cross-origin), so every response needs to allow that.
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

function str(fd, key, fallback) {
  const v = fd.get(key);
  return v == null ? (fallback || '') : String(v).trim();
}

export async function onRequestPost(context) {
  const { request, env } = context;

  let fd;
  try {
    fd = await request.formData();
  } catch (_) {
    return json({ success: false, message: 'Requisição inválida.' }, 400);
  }

  // Honeypot (same field name/convention the old Web3Forms forms used).
  if (str(fd, 'botcheck') || str(fd, '_honey')) {
    return json({ success: true }); // pretend success, don't tip off bots
  }

  const formType = str(fd, 'form_type');
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  try {
    let to, subject, text, replyTo;
    const attachments = [];

    if (formType === 'contact') {
      const nome = str(fd, 'nome');
      const empresa = str(fd, 'empresa', 'Não informado');
      const email = str(fd, 'email');
      const telefone = str(fd, 'telefone', 'Não informado');
      const mensagem = str(fd, 'mensagem');
      if (!nome || !emailRegex.test(email) || !mensagem) {
        return json({ success: false, message: 'Preencha os campos obrigatórios.' }, 400);
      }
      to = env.ZOHO_MAIL_TO_CONTATO || 'contato@glctech.com.br';
      subject = `Novo contato pelo site — ${nome}`;
      replyTo = email;
      text = `Nome: ${nome}\nEmpresa: ${empresa}\nE-mail: ${email}\nTelefone: ${telefone}\n\nMensagem:\n${mensagem}`;
    } else if (formType === 'diagnostico') {
      const nome = str(fd, 'nome');
      const email = str(fd, 'email');
      const telefone = str(fd, 'telefone');
      const empresa = str(fd, 'empresa');
      const servidores = str(fd, 'servidores');
      if (!nome || !emailRegex.test(email) || !telefone || !empresa || !servidores) {
        return json({ success: false, message: 'Preencha os campos obrigatórios.' }, 400);
      }
      to = env.ZOHO_MAIL_TO_CONTATO || 'contato@glctech.com.br';
      subject = `Novo pedido de Diagnóstico Gratuito — Landing — ${nome}`;
      replyTo = email;
      text = `Nome: ${nome}\nE-mail: ${email}\nTelefone: ${telefone}\nEmpresa: ${empresa}\nServidores/Usuários de TI: ${servidores}`;
    } else if (formType === 'candidatura') {
      const nome = str(fd, 'nome');
      const email = str(fd, 'email');
      const telefone = str(fd, 'telefone');
      const cidade = str(fd, 'cidade_estado');
      const vaga = str(fd, 'vaga');
      const curso = str(fd, 'curso');
      const instituicao = str(fd, 'instituicao');
      const semestre = str(fd, 'semestre');
      const linkedin = str(fd, 'linkedin');
      const github = str(fd, 'github');
      const portfolio = str(fd, 'portfolio');
      const mensagem = str(fd, 'mensagem');
      const file = fd.get('curriculo');

      if (!nome || !emailRegex.test(email) || !telefone || !cidade || !vaga || !mensagem) {
        return json({ success: false, message: 'Preencha os campos obrigatórios.' }, 400);
      }
      if (!file || typeof file === 'string' || !file.size) {
        return json({ success: false, message: 'Anexe seu currículo em PDF.' }, 400);
      }
      const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name || '');
      if (!isPdf) {
        return json({ success: false, message: 'O currículo deve estar no formato PDF.' }, 400);
      }
      if (file.size > MAX_ATTACHMENT_BYTES) {
        return json({ success: false, message: 'O currículo deve ter no máximo 5MB.' }, 400);
      }

      attachments.push({
        filename: file.name || 'curriculo.pdf',
        contentType: 'application/pdf',
        content: new Uint8Array(await file.arrayBuffer()),
      });

      to = env.ZOHO_MAIL_TO_RH || 'rh@glctech.com.br';
      subject = `Nova candidatura — ${vaga} — ${nome}`;
      replyTo = email;
      text = [
        `Nome: ${nome}`,
        `E-mail: ${email}`,
        `Telefone: ${telefone}`,
        `Cidade/Estado: ${cidade}`,
        `Vaga: ${vaga}`,
        curso ? `Curso: ${curso}` : null,
        instituicao ? `Instituição: ${instituicao}` : null,
        semestre ? `Semestre: ${semestre}` : null,
        linkedin ? `LinkedIn: ${linkedin}` : null,
        github ? `GitHub: ${github}` : null,
        portfolio ? `Portfólio: ${portfolio}` : null,
        '',
        'Mensagem:',
        mensagem,
      ]
        .filter((l) => l !== null)
        .join('\n');
    } else {
      return json({ success: false, message: 'Tipo de formulário inválido.' }, 400);
    }

    await sendZohoMail(env, { to, replyTo, subject, text, attachments });
    return json({ success: true });
  } catch (err) {
    console.error('send-email error:', err && err.stack ? err.stack : err);
    return json({ success: false, message: 'Não foi possível enviar agora. Tente novamente em instantes.' }, 502);
  }
}

export async function onRequestGet() {
  return json({ success: false, message: 'Método não permitido.' }, 405);
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}
