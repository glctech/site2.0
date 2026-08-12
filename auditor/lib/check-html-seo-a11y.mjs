/* ============================================================================
 * HTML validity + SEO + accessibility static checks.
 * Pure text/regex analysis of the already-fetched page HTML — no browser.
 * ==========================================================================*/

import { extractTags, lineAt } from './scan.mjs';
import { finding, SEVERITY } from './finding.mjs';

export function checkHtmlSeoA11y(page) {
  const { file } = page;
  // Use the script-body-blanked version everywhere in this checker: avoids
  // false positives from JS string concatenation like
  // `'<img src="' + img + '">'` inside inline <script> blocks being read as
  // real markup, while keeping identical line numbers (see scan.mjs).
  const html = page.domHtml;
  const out = [];

  // ── HTML structure ──────────────────────────────────────────────
  // duplicate id="" across the whole document (id must be unique)
  const ids = new Map();
  const idRe = /\sid=(".*?"|'.*?')/gi;
  let m;
  while ((m = idRe.exec(html))) {
    const id = m[1].slice(1, -1);
    const line = lineAt(html, m.index);
    if (!ids.has(id)) ids.set(id, []);
    ids.get(id).push(line);
  }
  for (const [id, lines] of ids) {
    if (lines.length > 1) {
      out.push(finding({
        category: 'html', severity: SEVERITY.MEDIUM, page: file, line: lines[0],
        problem: `id="${id}" duplicado (aparece ${lines.length}x, linhas ${lines.join(', ')})`,
        cause: 'IDs devem ser únicos no documento — pode quebrar âncoras, labels e seletores JS/CSS.',
        recommendation: 'Renomear as ocorrências duplicadas mantendo os usos existentes (JS/CSS/#âncoras) apontando para o id correto.',
      }));
    }
  }

  if (!/<html[^>]*\slang=/i.test(html)) {
    out.push(finding({
      category: 'html', severity: SEVERITY.MEDIUM, page: file,
      problem: 'Tag <html> sem atributo lang.',
      cause: 'Ajuda leitores de tela e o Google a identificar o idioma da página.',
      autoFixable: true, fixId: 'add-html-lang',
      recommendation: 'Adicionar lang="pt-BR" à tag <html>.',
    }));
  }

  if (!/<meta[^>]*name=["']viewport["']/i.test(html)) {
    out.push(finding({
      category: 'html', severity: SEVERITY.HIGH, page: file,
      problem: 'Sem <meta name="viewport">.',
      cause: 'Sem essa tag o layout responsivo (mobile) não funciona corretamente.',
      recommendation: 'Adicionar <meta name="viewport" content="width=device-width, initial-scale=1.0">.',
    }));
  }

  // ── Headings hierarchy ──────────────────────────────────────────
  const h1s = extractTags(html, 'h1');
  if (h1s.length === 0) {
    out.push(finding({
      category: 'seo', severity: SEVERITY.MEDIUM, page: file,
      problem: 'Página sem nenhum <h1>.',
      cause: 'O H1 ajuda buscadores e leitores de tela a identificar o assunto principal da página.',
      recommendation: 'Garantir que exista exatamente um <h1> descrevendo o conteúdo principal.',
    }));
  } else if (h1s.length > 1) {
    out.push(finding({
      category: 'seo', severity: SEVERITY.LOW, page: file, line: lineAt(html, h1s[1].index),
      problem: `${h1s.length} tags <h1> na mesma página.`,
      cause: 'Múltiplos H1 diluem o sinal de "assunto principal" para SEO.',
      recommendation: 'Manter um único <h1> por página; rebaixar os demais para <h2>.',
    }));
  }

  const headingLevels = [];
  for (const lvl of [1, 2, 3, 4, 5, 6]) {
    for (const t of extractTags(html, `h${lvl}`)) headingLevels.push({ lvl, index: t.index });
  }
  headingLevels.sort((a, b) => a.index - b.index);
  for (let i = 1; i < headingLevels.length; i++) {
    const prev = headingLevels[i - 1], cur = headingLevels[i];
    if (cur.lvl > prev.lvl + 1) {
      out.push(finding({
        category: 'accessibility', severity: SEVERITY.LOW, page: file, line: lineAt(html, cur.index),
        problem: `Hierarquia de headings pula de H${prev.lvl} para H${cur.lvl}.`,
        cause: 'Leitores de tela usam a hierarquia de headings para navegação; pular níveis confunde a estrutura.',
        recommendation: `Usar H${prev.lvl + 1} em vez de H${cur.lvl}, ou revisar a estrutura de seções.`,
      }));
    }
  }

  // ── Images: alt text + width/height distortion trap ────────────
  for (const t of extractTags(html, 'img')) {
    const line = lineAt(html, t.index);
    const alt = t.attrs.alt;
    if (alt === undefined) {
      out.push(finding({
        category: 'accessibility', severity: SEVERITY.HIGH, page: file, line,
        problem: `<img src="${t.attrs.src || '?'}"> sem atributo alt.`,
        cause: 'Leitores de tela não conseguem descrever a imagem; também é sinal de SEO.',
        recommendation: 'Adicionar um alt descritivo (ou alt="" se a imagem for puramente decorativa). Texto não pode ser inventado automaticamente — requer revisão humana.',
      }));
    } else if (alt.trim() === '' && !isLikelyDecorative(t, html)) {
      out.push(finding({
        category: 'accessibility', severity: SEVERITY.LOW, page: file, line,
        problem: `<img src="${t.attrs.src || '?'}"> com alt="" — confirmar se é intencional (imagem decorativa).`,
        recommendation: 'Se a imagem carrega informação (não é puramente decorativa), escrever um alt descritivo.',
      }));
    }

    if (t.attrs.width && t.attrs.height && t.attrs.style && /height\s*:/i.test(t.attrs.style) && !/width\s*:/i.test(t.attrs.style)) {
      out.push(finding({
        category: 'performance', severity: SEVERITY.CRITICAL, page: file, line,
        problem: `<img> com width/height nos atributos e style inline fixando só a altura — risco de distorção (mesmo bug corrigido no PR #13).`,
        cause: 'Quando o CSS/estilo inline trava só uma dimensão, o navegador usa o valor bruto do atributo HTML na outra, esticando a imagem.',
        autoFixable: true, fixId: 'img-inline-style-width-auto',
        recommendation: 'Adicionar width:auto ao style inline.',
      }));
    }
  }

  // ── target=_blank without rel=noopener ──────────────────────────
  for (const t of extractTags(html, 'a')) {
    const target = (t.attrs.target || '').toLowerCase();
    if (target === '_blank') {
      const rel = (t.attrs.rel || '').toLowerCase();
      if (!rel.includes('noopener')) {
        out.push(finding({
          category: 'security', severity: SEVERITY.MEDIUM, page: file, line: lineAt(html, t.index),
          problem: `<a target="_blank"> sem rel="noopener" (href="${t.attrs.href || '?'}").`,
          cause: 'Sem noopener, a página aberta pode manipular a aba de origem ("reverse tabnabbing").',
          autoFixable: true, fixId: 'add-rel-noopener',
          recommendation: 'Adicionar rel="noopener" (ou "noopener noreferrer").',
        }));
      }
    }
  }

  // ── SEO meta tags ────────────────────────────────────────────────
  if (!/<title\b[^>]*>[^<]+<\/title>/i.test(html)) {
    out.push(finding({
      category: 'seo', severity: SEVERITY.HIGH, page: file,
      problem: 'Página sem <title> (ou vazio).',
      recommendation: 'Definir um <title> único e descritivo.',
    }));
  }
  if (!/<meta[^>]*name=["']description["'][^>]*content=["'][^"']+["']/i.test(html)) {
    out.push(finding({
      category: 'seo', severity: SEVERITY.HIGH, page: file,
      problem: 'Sem <meta name="description"> (ou vazia).',
      recommendation: 'Adicionar uma meta description específica da página (150–160 caracteres).',
    }));
  }
  if (!/<link[^>]*rel=["']canonical["']/i.test(html)) {
    out.push(finding({
      category: 'seo', severity: SEVERITY.MEDIUM, page: file,
      problem: 'Sem <link rel="canonical">.',
      recommendation: 'Adicionar a URL canônica da página.',
    }));
  }
  if (!/<meta[^>]*property=["']og:title["']/i.test(html)) {
    out.push(finding({
      category: 'seo', severity: SEVERITY.LOW, page: file,
      problem: 'Sem tags Open Graph (og:title etc).',
      recommendation: 'Adicionar og:title/og:description/og:image para melhorar o compartilhamento em redes sociais.',
    }));
  }
  if (!/<link[^>]*rel=["']icon["']/i.test(html)) {
    out.push(finding({
      category: 'seo', severity: SEVERITY.LOW, page: file,
      problem: 'Sem <link rel="icon"> (favicon).',
      recommendation: 'Adicionar o favicon já existente em assets/logo/.',
    }));
  }

  return out;
}

function isLikelyDecorative(imgTag, html) {
  // Icons sitting inside a link/button that already has visible text nearby
  // are commonly decorative; this is a heuristic, not a determination —
  // findings using it stay LOW severity and phrased as "confirmar".
  return false;
}
