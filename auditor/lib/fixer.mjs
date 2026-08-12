/* ============================================================================
 * fixer.mjs — applies ONLY the narrow, mechanical fixes below. Nothing here
 * invents copy, picks an icon, or guesses at intent. Every fix in this file
 * is the same class of change made by hand and verified this project:
 *   - pairing a missing width:auto/height:auto next to an explicit dimension
 *     (the exact CLS-vs-distortion trap fixed in PR #13)
 *   - adding rel="noopener" to target="_blank" links
 *   - adding lang="pt-BR" to <html> when missing
 *   - adding loading="lazy" to below-the-fold <img> tags
 * Anything else stays a reported recommendation for a human to act on.
 * ==========================================================================*/

const FIXERS = {
  'add-html-lang': fixAddHtmlLang,
  'add-rel-noopener': fixAddRelNoopener,
  'img-inline-style-width-auto': fixImgInlineStyleWidthAuto,
  'add-loading-lazy': fixAddLoadingLazy,
};

// Fixers that scan/rewrite the WHOLE document in one pass (their regex isn't
// scoped to one finding's line). Calling one of these separately per finding
// would make every finding after the first look like a no-op — the first
// call already resolved all of them — so these run once per page, and every
// finding sharing that fixId gets credited if the single pass changed
// anything. Fixers not listed here are line-scoped: they run once per
// finding, touching only the exact line reported.
const WHOLE_DOCUMENT_FIXERS = new Set(['add-html-lang', 'add-rel-noopener']);

/**
 * @param {string} html
 * @param {import('./finding.mjs').finding[]} findings  findings for ONE page, autoFixable ones will be applied
 * @returns {{html: string, applied: object[]}}
 */
export function applyFixes(html, findings) {
  let out = html;
  const applied = [];
  const fixable = findings.filter((f) => f.autoFixable && f.fixId && FIXERS[f.fixId]);

  const byFixId = new Map();
  for (const f of fixable) {
    if (!byFixId.has(f.fixId)) byFixId.set(f.fixId, []);
    byFixId.get(f.fixId).push(f);
  }

  for (const [fixId, group] of byFixId) {
    const fn = FIXERS[fixId];
    if (WHOLE_DOCUMENT_FIXERS.has(fixId)) {
      const result = fn(out);
      if (result.changed) {
        out = result.html;
        for (const f of group) {
          applied.push({ id: f.id, fixId, problem: f.problem });
          f.status = 'corrigido automaticamente';
        }
      }
      continue;
    }
    for (const f of group) {
      const result = fn(out, f);
      if (result.changed) {
        out = result.html;
        applied.push({ id: f.id, fixId, problem: f.problem });
        f.status = 'corrigido automaticamente';
      }
    }
  }

  return { html: out, applied };
}

function fixAddHtmlLang(html) {
  if (/<html[^>]*\slang=/i.test(html)) return { html, changed: false };
  const next = html.replace(/<html(\s|>)/i, (m, tail) => `<html lang="pt-BR"${tail}`);
  return { html: next, changed: next !== html };
}

function fixAddRelNoopener(html) {
  let changed = false;
  const next = html.replace(/<a\b([^>]*?)target=(["'])_blank\2([^>]*)>/gi, (full, before, q, after) => {
    if (/rel=/i.test(before) || /rel=/i.test(after)) {
      // Has a rel attribute already — only add noopener if it's missing from it.
      const relMatch = /rel=(["'])(.*?)\1/i.exec(before + after);
      if (relMatch && !/noopener/i.test(relMatch[2])) {
        changed = true;
        const withNoopener = full.replace(/rel=(["'])(.*?)\1/i, (m2, q2, val) => `rel=${q2}${val} noopener${q2}`);
        return withNoopener;
      }
      return full;
    }
    changed = true;
    return `<a${before}target=${q}_blank${q}${after} rel="noopener">`;
  });
  return { html: next, changed };
}

function fixImgInlineStyleWidthAuto(html, findingObj) {
  // Only touch the exact line this finding pointed at, to avoid accidentally
  // rewriting an unrelated <img> that happens to match the same pattern.
  const lines = html.split('\n');
  const idx = (findingObj.line || 1) - 1;
  if (idx < 0 || idx >= lines.length) return { html, changed: false };
  const line = lines[idx];
  if (!/<img\b/.test(line) || !/style="[^"]*height\s*:[^"]*"/i.test(line) || /width\s*:/i.test(line.match(/style="[^"]*"/i)?.[0] || '')) {
    return { html, changed: false };
  }
  const next = line.replace(/style="([^"]*)"/i, (m, styleBody) => `style="${styleBody.trim().replace(/;?$/, '')};width:auto;"`);
  if (next === line) return { html, changed: false };
  lines[idx] = next;
  return { html: lines.join('\n'), changed: true };
}

function fixAddLoadingLazy(html, findingObj) {
  const lines = html.split('\n');
  const idx = (findingObj.line || 1) - 1;
  if (idx < 0 || idx >= lines.length) return { html, changed: false };
  const line = lines[idx];
  if (!/<img\b/.test(line) || /loading=/.test(line)) return { html, changed: false };
  const next = line.replace(/<img\b/i, '<img loading="lazy"');
  if (next === line) return { html, changed: false };
  lines[idx] = next;
  return { html: lines.join('\n'), changed: true };
}
