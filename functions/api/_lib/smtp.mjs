/* ============================================================================
 * Minimal SMTP client for Cloudflare Pages/Workers, targeting Zoho Mail.
 * ----------------------------------------------------------------------------
 * Cloudflare Workers don't ship a Node "net"/nodemailer stack, but they do
 * expose raw TCP sockets via `cloudflare:sockets`. This file hand-rolls just
 * enough of RFC 5321 (SMTP) + RFC 2045 (MIME) to authenticate against Zoho's
 * SMTP server and send a plain-text e-mail, optionally with one binary
 * attachment (e.g. a PDF résumé).
 *
 * Deliberately supports ONLY implicit TLS (port 465 / "SSL"), not STARTTLS
 * (port 587). Zoho's own settings screen offers both; 465/SSL is simpler to
 * implement correctly on top of `cloudflare:sockets` (TLS from the first
 * byte, no protocol upgrade mid-stream) and is the first option Zoho lists.
 *
 * Required Pages environment variables (Settings → Environment variables):
 *   ZOHO_SMTP_USER   e.g. contato@glctech.com.br  (the mailbox that sends)
 *   ZOHO_SMTP_PASS   Zoho app-specific password (NOT the mailbox login password)
 * Optional:
 *   ZOHO_SMTP_HOST   default: smtppro.zoho.com
 *   ZOHO_SMTP_PORT   default: 465
 *   ZOHO_FROM_NAME   default: "Site GLCTech"
 * ==========================================================================*/

import { connect } from 'cloudflare:sockets';

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function uint8ToBase64(bytes) {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function strToBase64(str) {
  return uint8ToBase64(encoder.encode(str));
}

function wrap76(b64) {
  return (b64.match(/.{1,76}/g) || ['']).join('\r\n');
}

function encodeHeader(value) {
  // Keep plain ASCII headers untouched; MIME-encode anything with accents/emoji.
  if (/^[\x00-\x7F]*$/.test(value)) return value;
  return '=?UTF-8?B?' + strToBase64(value) + '?=';
}

class SmtpConnection {
  constructor(socket) {
    this.socket = socket;
    this.writer = socket.writable.getWriter();
    this.reader = socket.readable.getReader();
    this.buffer = '';
  }

  async _readChunk(timeoutMs) {
    const timeout = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Tempo esgotado aguardando resposta do servidor SMTP.')), timeoutMs)
    );
    return Promise.race([this.reader.read(), timeout]);
  }

  // Reads one full SMTP response, handling multi-line "250-..." continuations.
  async readResponse(timeoutMs = 15000) {
    const lines = [];
    for (;;) {
      let idx;
      while ((idx = this.buffer.indexOf('\r\n')) !== -1) {
        const line = this.buffer.slice(0, idx);
        this.buffer = this.buffer.slice(idx + 2);
        if (!line) continue;
        lines.push(line);
        if (line.charAt(3) === ' ') {
          return { code: line.slice(0, 3), text: lines.map((l) => l.slice(4)).join('\n') };
        }
      }
      const { value, done } = await this._readChunk(timeoutMs);
      if (done) throw new Error('Conexão SMTP encerrada inesperadamente pelo servidor.');
      this.buffer += decoder.decode(value, { stream: true });
    }
  }

  async writeLine(line) {
    await this.writer.write(encoder.encode(line + '\r\n'));
  }

  async command(line, expectPrefix) {
    if (line !== null) await this.writeLine(line);
    const res = await this.readResponse();
    if (expectPrefix && !res.code.startsWith(String(expectPrefix))) {
      throw new Error(`Servidor SMTP respondeu ${res.code}: ${res.text}`);
    }
    return res;
  }

  async close() {
    try { await this.writer.close(); } catch (_) { /* ignore */ }
    try { await this.reader.cancel(); } catch (_) { /* ignore */ }
  }
}

function buildMessage({ from, fromName, to, replyTo, subject, text, attachments }) {
  const fromHeader = fromName ? `${encodeHeader(fromName)} <${from}>` : from;
  const headers = [
    `From: ${fromHeader}`,
    `To: ${to}`,
    replyTo ? `Reply-To: ${replyTo}` : null,
    `Subject: ${encodeHeader(subject)}`,
    `Date: ${new Date().toUTCString()}`,
    `MIME-Version: 1.0`,
  ].filter(Boolean);

  if (!attachments || attachments.length === 0) {
    headers.push('Content-Type: text/plain; charset="UTF-8"');
    headers.push('Content-Transfer-Encoding: base64');
    return headers.join('\r\n') + '\r\n\r\n' + wrap76(strToBase64(text)) + '\r\n';
  }

  const boundary = 'GLC-' + crypto.randomUUID().replace(/-/g, '');
  headers.push(`Content-Type: multipart/mixed; boundary="${boundary}"`);

  const parts = [
    `--${boundary}\r\n` +
      'Content-Type: text/plain; charset="UTF-8"\r\n' +
      'Content-Transfer-Encoding: base64\r\n\r\n' +
      wrap76(strToBase64(text)) +
      '\r\n',
  ];

  for (const att of attachments) {
    const safeName = String(att.filename || 'anexo').replace(/["\r\n]/g, '');
    parts.push(
      `--${boundary}\r\n` +
        `Content-Type: ${att.contentType || 'application/octet-stream'}; name="${safeName}"\r\n` +
        'Content-Transfer-Encoding: base64\r\n' +
        `Content-Disposition: attachment; filename="${safeName}"\r\n\r\n` +
        wrap76(uint8ToBase64(att.content)) +
        '\r\n'
    );
  }
  parts.push(`--${boundary}--\r\n`);

  return headers.join('\r\n') + '\r\n\r\n' + parts.join('');
}

/**
 * Sends one e-mail through Zoho's SMTP (implicit TLS, port 465 by default).
 * @param {object} env - Pages Function env (bindings + secrets).
 * @param {{to:string, replyTo?:string, subject:string, text:string, attachments?:Array<{filename:string, contentType?:string, content:Uint8Array}>}} msg
 */
export async function sendZohoMail(env, { to, replyTo, subject, text, attachments }) {
  const host = env.ZOHO_SMTP_HOST || 'smtppro.zoho.com';
  const port = Number(env.ZOHO_SMTP_PORT || 465);
  const user = env.ZOHO_SMTP_USER;
  const pass = env.ZOHO_SMTP_PASS;
  const fromName = env.ZOHO_FROM_NAME || 'Site GLCTech';

  if (!user || !pass) {
    throw new Error('Credenciais Zoho SMTP ausentes (defina ZOHO_SMTP_USER e ZOHO_SMTP_PASS nas variáveis de ambiente do projeto Pages).');
  }
  if (port !== 465) {
    throw new Error('Esta implementação só suporta porta 465 (SSL implícito). Configure ZOHO_SMTP_PORT=465.');
  }

  const socket = connect({ hostname: host, port }, { secureTransport: 'on', allowHalfOpen: false });
  const conn = new SmtpConnection(socket);

  try {
    await conn.readResponse(); // 220 greeting
    await conn.command('EHLO glctech.com.br', '250');
    await conn.command('AUTH LOGIN', '334');
    await conn.command(strToBase64(user), '334');
    await conn.command(strToBase64(pass), '235');
    await conn.command(`MAIL FROM:<${user}>`, '250');
    await conn.command(`RCPT TO:<${to}>`, '25'); // 250 or 251
    await conn.command('DATA', '354');

    const raw = buildMessage({ from: user, fromName, to, replyTo, subject, text, attachments });
    const dotStuffed = raw
      .split('\r\n')
      .map((l) => (l.startsWith('.') ? '.' + l : l))
      .join('\r\n');
    await conn.writer.write(encoder.encode(dotStuffed + '\r\n.\r\n'));
    await conn.readResponse(); // 250 Ok after terminator

    await conn.command('QUIT', null);
  } finally {
    await conn.close();
  }
}
