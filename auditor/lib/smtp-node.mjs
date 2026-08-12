/* ============================================================================
 * Minimal SMTP client for Node (GitHub Actions runner), targeting Zoho Mail.
 * ----------------------------------------------------------------------------
 * Same protocol implementation as functions/api/_lib/smtp.mjs (the one the
 * live site's contact form uses), ported from `cloudflare:sockets` to Node's
 * built-in `tls` module — GitHub Actions runs plain Node, not a Worker, so
 * the Workers-only socket API isn't available there. Implicit TLS / port 465
 * only, same as the Worker version, matching Zoho's own first-listed option.
 *
 * Required environment variables (set as GitHub Actions repo secrets — these
 * are SEPARATE from the Cloudflare Worker runtime secrets of the same name;
 * the value can be identical, but it has to be entered in both places):
 *   ZOHO_SMTP_USER, ZOHO_SMTP_PASS
 * Optional: ZOHO_SMTP_HOST (default smtppro.zoho.com), ZOHO_SMTP_PORT (465),
 *           ZOHO_FROM_NAME (default "Auditoria GLCTech")
 * ==========================================================================*/

import { connect } from 'node:tls';

function wrap76(b64) {
  return (b64.match(/.{1,76}/g) || ['']).join('\r\n');
}

function encodeHeader(value) {
  if (/^[\x00-\x7F]*$/.test(value)) return value;
  return '=?UTF-8?B?' + Buffer.from(value, 'utf8').toString('base64') + '?=';
}

class SmtpConnection {
  constructor(socket) {
    this.socket = socket;
    this.buffer = '';
    this._pending = [];
  }

  readResponse(timeoutMs = 15000) {
    return new Promise((resolvePromise, reject) => {
      const timer = setTimeout(() => reject(new Error('Tempo esgotado aguardando resposta do servidor SMTP.')), timeoutMs);
      const tryParse = () => {
        const lines = [];
        let idx;
        let buf = this.buffer;
        while ((idx = buf.indexOf('\r\n')) !== -1) {
          const line = buf.slice(0, idx);
          buf = buf.slice(idx + 2);
          if (!line) continue;
          lines.push(line);
          if (line.charAt(3) === ' ') {
            this.buffer = buf;
            clearTimeout(timer);
            this.socket.removeListener('data', onData);
            resolvePromise({ code: line.slice(0, 3), text: lines.map((l) => l.slice(4)).join('\n') });
            return true;
          }
        }
        this.buffer = buf;
        return false;
      };
      const onData = (chunk) => {
        this.buffer += chunk.toString('utf8');
        tryParse();
      };
      if (!tryParse()) this.socket.on('data', onData);
    });
  }

  writeLine(line) {
    this.socket.write(line + '\r\n');
  }

  async command(line, expectPrefix) {
    if (line !== null) this.writeLine(line);
    const res = await this.readResponse();
    if (expectPrefix && !res.code.startsWith(String(expectPrefix))) {
      throw new Error(`Servidor SMTP respondeu ${res.code}: ${res.text}`);
    }
    return res;
  }
}

function buildMessage({ from, fromName, to, subject, html, attachments }) {
  const fromHeader = fromName ? `${encodeHeader(fromName)} <${from}>` : from;
  const headers = [
    `From: ${fromHeader}`,
    `To: ${to}`,
    `Subject: ${encodeHeader(subject)}`,
    `Date: ${new Date().toUTCString()}`,
    `MIME-Version: 1.0`,
  ];

  const htmlPart =
    'Content-Type: text/html; charset="UTF-8"\r\n' +
    'Content-Transfer-Encoding: base64\r\n\r\n' +
    wrap76(Buffer.from(html, 'utf8').toString('base64')) +
    '\r\n';

  if (!attachments || attachments.length === 0) {
    return headers.concat(['Content-Type: text/html; charset="UTF-8"', 'Content-Transfer-Encoding: base64']).join('\r\n')
      + '\r\n\r\n' + wrap76(Buffer.from(html, 'utf8').toString('base64')) + '\r\n';
  }

  const boundary = 'GLC-' + Math.random().toString(36).slice(2) + Date.now().toString(36);
  headers.push(`Content-Type: multipart/mixed; boundary="${boundary}"`);
  const parts = [`--${boundary}\r\n${htmlPart}`];
  for (const att of attachments) {
    const safeName = String(att.filename || 'relatorio.md').replace(/["\r\n]/g, '');
    parts.push(
      `--${boundary}\r\n` +
        `Content-Type: ${att.contentType || 'text/markdown'}; name="${safeName}"\r\n` +
        'Content-Transfer-Encoding: base64\r\n' +
        `Content-Disposition: attachment; filename="${safeName}"\r\n\r\n` +
        wrap76(Buffer.from(att.content).toString('base64')) +
        '\r\n'
    );
  }
  parts.push(`--${boundary}--\r\n`);
  return headers.join('\r\n') + '\r\n\r\n' + parts.join('');
}

/**
 * @param {{to:string, subject:string, html:string, attachments?:Array<{filename:string, contentType?:string, content:Buffer|string}>}} msg
 */
export async function sendZohoMailNode({ to, subject, html, attachments }) {
  const host = process.env.ZOHO_SMTP_HOST || 'smtppro.zoho.com';
  const port = Number(process.env.ZOHO_SMTP_PORT || 465);
  const user = process.env.ZOHO_SMTP_USER;
  const pass = process.env.ZOHO_SMTP_PASS;
  const fromName = process.env.ZOHO_FROM_NAME || 'Auditoria GLCTech';

  if (!user || !pass) {
    throw new Error('ZOHO_SMTP_USER / ZOHO_SMTP_PASS não configurados (GitHub Secrets do repositório).');
  }
  if (port !== 465) {
    throw new Error('Esta implementação só suporta porta 465 (SSL implícito). Defina ZOHO_SMTP_PORT=465.');
  }

  const socket = connect({ host, port, servername: host });
  await new Promise((resolvePromise, reject) => {
    socket.once('secureConnect', resolvePromise);
    socket.once('error', reject);
  });

  const conn = new SmtpConnection(socket);
  try {
    await conn.readResponse(); // 220 greeting
    await conn.command('EHLO glctech.com.br', '250');
    await conn.command('AUTH LOGIN', '334');
    await conn.command(Buffer.from(user, 'utf8').toString('base64'), '334');
    await conn.command(Buffer.from(pass, 'utf8').toString('base64'), '235');
    await conn.command(`MAIL FROM:<${user}>`, '250');
    await conn.command(`RCPT TO:<${to}>`, '25');
    await conn.command('DATA', '354');

    const raw = buildMessage({ from: user, fromName, to, subject, html, attachments });
    const dotStuffed = raw.split('\r\n').map((l) => (l.startsWith('.') ? '.' + l : l)).join('\r\n');
    socket.write(dotStuffed + '\r\n.\r\n');
    await conn.readResponse();
    await conn.command('QUIT', null);
  } finally {
    socket.destroy();
  }
}
