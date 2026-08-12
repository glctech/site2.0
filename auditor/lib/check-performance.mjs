/* ============================================================================
 * Performance checks — static analysis only (no browser needed).
 * Flags oversized images, missing lazy-loading, missing width/height, and
 * dangling preconnects. Never re-encodes or replaces images: file-format /
 * compression changes are reported as recommendations only (visual identity
 * and quality must never change automatically).
 * ==========================================================================*/

import { stat, readFile } from 'node:fs/promises';
import { extractTags, lineAt, isLocalPath, localFileExists, ROOT } from './scan.mjs';
import { finding, SEVERITY } from './finding.mjs';
import { join } from 'node:path';

const LARGE_IMAGE_BYTES = 400 * 1024; // 400 KB — flag anything bigger for review

export function checkPerformanceStatic(page) {
  const { file } = page;
  const html = page.domHtml; // avoid matching JS string concatenation as markup
  const out = [];

  const imgs = extractTags(html, 'img');
  imgs.forEach((t, idx) => {
    const line = lineAt(html, t.index);
    const hasWidth = 'width' in t.attrs;
    const hasHeight = 'height' in t.attrs;
    if (!hasWidth || !hasHeight) {
      out.push(finding({
        category: 'performance', severity: SEVERITY.MEDIUM, page: file, line,
        problem: `<img src="${t.attrs.src || '?'}"> sem width/height declarados.`,
        cause: 'Sem dimensões, o navegador não reserva espaço e a página "pula" durante o carregamento (CLS).',
        recommendation: 'Adicionar width/height (dimensões reais do arquivo) — e lembrar de garantir que o CSS trate a outra dimensão como auto (ver PR #13).',
      }));
    }
    // First image after <body> (roughly the hero) skipping loading=lazy is fine;
    // any OTHER image without loading="lazy" is a minor opportunity.
    if (idx > 0 && t.attrs.loading !== 'lazy' && !('fetchpriority' in t.attrs)) {
      out.push(finding({
        category: 'performance', severity: SEVERITY.LOW, page: file, line,
        problem: `<img src="${t.attrs.src || '?'}"> sem loading="lazy".`,
        autoFixable: true, fixId: 'add-loading-lazy',
        recommendation: 'Adicionar loading="lazy" (a menos que seja a imagem principal da primeira tela).',
      }));
    }
  });

  // Dangling <link rel="preconnect"> to a host nothing else on the page uses.
  // Exempts fonts.gstatic.com when fonts.googleapis.com is also preconnected
  // and a Google Fonts stylesheet is present — the actual font-file requests
  // to fonts.gstatic.com happen inside that fetched CSS, one hop removed
  // from this page's own HTML, so this is a well-known correct pattern, not
  // an orphan.
  const preconnects = extractTags(html, 'link').filter((t) => (t.attrs.rel || '').toLowerCase() === 'preconnect');
  const usesGoogleFontsCss = /fonts\.googleapis\.com\/css/i.test(html);
  for (const p of preconnects) {
    let host;
    try { host = new URL(p.attrs.href).host; } catch { continue; }
    if (host === 'fonts.gstatic.com' && usesGoogleFontsCss) continue;
    const usesHost = html.includes(host) && html.indexOf(host, html.indexOf(host) + 1) !== -1; // appears >1x (preconnect tag itself + a real usage)
    if (!usesHost) {
      out.push(finding({
        category: 'performance', severity: SEVERITY.LOW, page: file, line: lineAt(html, p.index),
        problem: `<link rel="preconnect" href="${p.attrs.href}"> sem nenhum recurso da página usando esse host.`,
        recommendation: 'Remover o preconnect órfão, ou adicionar o recurso que ele deveria acelerar.',
      }));
    }
  }

  return out;
}

export async function checkPerformanceAssets(page) {
  const { file } = page;
  const html = page.domHtml;
  const out = [];
  const imgs = extractTags(html, 'img');
  for (const t of imgs) {
    const src = t.attrs.src;
    if (!src || !isLocalPath(src)) continue;
    const exists = await localFileExists(src);
    if (!exists) continue; // reported separately by the link checker
    const clean = src.split('#')[0].split('?')[0];
    const rel = clean.startsWith('/') ? clean.slice(1) : clean;
    let size;
    try { size = (await stat(join(ROOT, rel))).size; } catch { continue; }
    if (size > LARGE_IMAGE_BYTES) {
      out.push(finding({
        category: 'performance', severity: SEVERITY.MEDIUM, page: file, line: lineAt(html, t.index),
        problem: `Imagem pesada: ${rel} (${(size / 1024).toFixed(0)} KB).`,
        cause: 'Imagens grandes atrasam o carregamento, especialmente no celular.',
        recommendation: 'Recomendação apenas (não corrigido automaticamente — recompressão pode alterar qualidade visual): considerar reduzir/otimizar este arquivo mantendo a mesma aparência.',
      }));
    }
  }
  return out;
}
