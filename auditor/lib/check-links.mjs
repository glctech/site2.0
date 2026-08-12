/* ============================================================================
 * Link checker — internal (filesystem) + external (HTTP HEAD/GET) links.
 * External checks are best-effort with a short timeout: a slow/blocking
 * external host should never fail the whole audit, just get flagged.
 * ==========================================================================*/

import { extractTags, lineAt, isLocalPath, localFileExists, localAssetRefs, discoverPages } from './scan.mjs';
import { finding, SEVERITY } from './finding.mjs';

const EXTERNAL_TIMEOUT_MS = 8000;
const KNOWN_PAGES = new Set(); // filled in by checkLinks() from discoverPages()

export async function checkLinks(page, { checkExternal = true } = {}) {
  const { file } = page;
  const html = page.domHtml; // avoid matching JS string concatenation as markup
  const out = [];

  if (KNOWN_PAGES.size === 0) {
    for (const p of await discoverPages()) KNOWN_PAGES.add(p.file);
  }

  // 1) <a href> — internal file existence + fragment presence, external reachability.
  const anchors = extractTags(html, 'a');
  const externalChecks = [];
  for (const t of anchors) {
    const href = t.attrs.href;
    if (!href || href === '#') continue;
    const line = lineAt(html, t.index);

    if (href.startsWith('#')) {
      const id = href.slice(1);
      if (id && !new RegExp(`\\sid=["']${escapeReg(id)}["']`).test(html)) {
        out.push(finding({
          category: 'links', severity: SEVERITY.LOW, page: file, line,
          problem: `Âncora #${id} não corresponde a nenhum id="${id}" na página.`,
          recommendation: 'Corrigir o href ou adicionar o id de destino que falta.',
        }));
      }
      continue;
    }

    if (isLocalPath(href)) {
      const [pathPart] = href.split('#');
      if (pathPart === '' ) continue; // just an in-page anchor handled above
      const isKnownPage = KNOWN_PAGES.has(pathPart) || pathPart === 'index.html';
      if (!isKnownPage) {
        const exists = await localFileExists(pathPart);
        if (!exists) {
          out.push(finding({
            category: 'links', severity: SEVERITY.HIGH, page: file, line,
            problem: `Link interno quebrado: href="${href}" não existe no repositório.`,
            recommendation: 'Corrigir o caminho, ou remover/atualizar o link se a página não existir mais.',
          }));
        }
      }
      continue;
    }

    if (checkExternal && /^https?:\/\//i.test(href)) {
      externalChecks.push({ href, line });
    }
  }

  if (checkExternal && externalChecks.length) {
    const results = await Promise.all(externalChecks.map((e) => probeUrl(e.href)));
    results.forEach((res, i) => {
      if (!res.ok) {
        out.push(finding({
          category: 'links', severity: SEVERITY.LOW, page: file, line: externalChecks[i].line,
          problem: `Link externo pode estar indisponível: ${externalChecks[i].href} (${res.reason}).`,
          cause: 'Verificação best-effort com timeout curto — pode ser um falso positivo (site externo temporariamente lento).',
          recommendation: 'Conferir manualmente antes de alterar; sites de terceiros fora do nosso controle.',
        }));
      }
    });
  }

  // 2) Local asset refs (img/script/link/source) that 404 on disk.
  for (const ref of localAssetRefs(html)) {
    if (!isLocalPath(ref.value)) continue;
    const exists = await localFileExists(ref.value);
    if (!exists) {
      out.push(finding({
        category: 'links', severity: SEVERITY.HIGH, page: file, line: lineAt(html, ref.index),
        problem: `<${ref.tag} ${ref.attr}="${ref.value}"> aponta para um arquivo que não existe.`,
        recommendation: 'Corrigir o caminho ou restaurar/remover a referência ao arquivo ausente.',
      }));
    }
  }

  return out;
}

async function probeUrl(url) {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), EXTERNAL_TIMEOUT_MS);
    let res;
    try {
      res = await fetch(url, { method: 'HEAD', redirect: 'follow', signal: ctrl.signal });
      if (res.status === 405 || res.status === 403) {
        // Some hosts reject HEAD; retry with a light GET.
        res = await fetch(url, { method: 'GET', redirect: 'follow', signal: ctrl.signal });
      }
    } finally {
      clearTimeout(t);
    }
    if (res.status >= 400) return { ok: false, reason: `HTTP ${res.status}` };
    return { ok: true };
  } catch (err) {
    return { ok: false, reason: err.name === 'AbortError' ? 'timeout' : (err.message || 'erro de rede') };
  }
}

function escapeReg(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
