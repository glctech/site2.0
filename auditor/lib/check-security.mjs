/* ============================================================================
 * Security checks compatible with a static HTML/CSS/JS site.
 * NEVER reproduces a matched secret value in a finding — only reports that
 * something matched the pattern, and where.
 * ==========================================================================*/

import { readFile } from 'node:fs/promises';
import { finding, SEVERITY } from './finding.mjs';
import { walk, relPath, ROOT } from './scan.mjs';

// Patterns that usually indicate a real credential/secret was hardcoded.
// Deliberately conservative (few false positives) — this only flags, never
// prints the matched value.
const SECRET_PATTERNS = [
  { name: 'AWS Access Key', re: /AKIA[0-9A-Z]{16}/ },
  { name: 'Private key block', re: /-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----/ },
  { name: 'Generic API key assignment', re: /(api[_-]?key|apikey|secret[_-]?key|access[_-]?token)\s*[:=]\s*["'][A-Za-z0-9_\-]{16,}["']/i },
  { name: 'Zoho/SMTP password literal', re: /(smtp[_-]?pass|zoho[_-]?pass|smtp[_-]?password)\s*[:=]\s*["'][^"']{6,}["']/i },
  { name: 'Bearer token literal', re: /Bearer\s+[A-Za-z0-9\-_.]{20,}/ },
];

// Files/dirs we never want to scan for secrets accidentally (reports contain
// only already-sanitized text, but skip them anyway to avoid noise).
const SKIP_DIRS = new Set(['node_modules', '.git', 'reports']);

export async function checkSecurity() {
  const out = [];

  // 1) Hardcoded-secret sweep across source files (not images/binaries).
  const exts = ['.html', '.js', '.mjs', '.json', '.yml', '.yaml', '.toml', '.md'];
  const files = await walkSource(ROOT, exts);
  for (const full of files) {
    const rel = relPath(full);
    if ([...SKIP_DIRS].some((d) => rel.startsWith(d + '/'))) continue;
    let text;
    try { text = await readFile(full, 'utf8'); } catch { continue; }
    for (const pat of SECRET_PATTERNS) {
      const m = pat.re.exec(text);
      if (m) {
        const line = text.slice(0, m.index).split('\n').length;
        out.push(finding({
          category: 'security', severity: SEVERITY.CRITICAL, page: rel, line,
          problem: `Possível credencial exposta no repositório (padrão: ${pat.name}). Valor OMITIDO deste relatório por segurança.`,
          cause: 'Segredos versionados no Git ficam expostos no histórico mesmo se removidos depois.',
          recommendation: 'AÇÃO NECESSÁRIA — APROVAÇÃO HUMANA: revogar a credencial imediatamente, movê-la para GitHub Secrets / variáveis de ambiente do Worker, e reescrever o histórico do Git se necessário.',
        }));
      }
    }
  }

  // 2) Mixed content: http:// resource refs on an https:// site.
  for (const full of files.filter((f) => f.endsWith('.html'))) {
    const rel = relPath(full);
    const text = await readFile(full, 'utf8');
    const httpRefs = [...text.matchAll(/(?:src|href)=["']http:\/\/[^"']+["']/gi)];
    for (const m of httpRefs) {
      const line = text.slice(0, m.index).split('\n').length;
      out.push(finding({
        category: 'security', severity: SEVERITY.MEDIUM, page: rel, line,
        problem: `Recurso carregado via http:// (não https://): ${m[0]}`,
        cause: 'Conteúdo misto (http dentro de https) pode ser bloqueado pelo navegador ou sinalizado como inseguro.',
        recommendation: 'Trocar para https:// (ou protocolo-relativo //) se o recurso suportar.',
      }));
    }
  }

  // 3) .env or credential-shaped files that shouldn't be tracked at all.
  const suspiciousNames = ['.env', '.env.local', 'credentials.json', 'secrets.json', 'id_rsa'];
  const all = await walk(ROOT);
  for (const full of all) {
    const rel = relPath(full);
    if ([...SKIP_DIRS].some((d) => rel.startsWith(d + '/'))) continue;
    const base = rel.split('/').pop();
    if (suspiciousNames.includes(base)) {
      out.push(finding({
        category: 'security', severity: SEVERITY.CRITICAL, page: rel,
        problem: `Arquivo com nome sensível versionado no repositório: ${base}`,
        recommendation: 'AÇÃO NECESSÁRIA — APROVAÇÃO HUMANA: confirmar se contém segredos; se sim, remover do histórico e revogar credenciais.',
      }));
    }
  }

  return out;
}

async function walkSource(dir, exts) {
  const all = await walk(dir);
  return all.filter((f) => exts.some((e) => f.endsWith(e)));
}
