/* ============================================================================
 * scan.mjs — page discovery + lightweight HTML parsing.
 * ----------------------------------------------------------------------------
 * The site has no build step and no DOM-parser dependency, so this module
 * does regex-based tag/attribute extraction — the same approach used by hand
 * throughout this project's manual audits. It's intentionally not a full
 * HTML parser: good enough to find tags/attributes reliably on a site whose
 * markup is written by hand in a consistent style, without adding a parser
 * dependency for a handful of checks.
 * ==========================================================================*/

import { readFile, readdir, stat } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = fileURLToPath(new URL('../..', import.meta.url));

/** Pages considered part of the live site — sourced from sitemap.xml, the
 *  same file that tells search engines (and thus us) what's actually live. */
export async function discoverPages() {
  const sitemapPath = join(ROOT, 'sitemap.xml');
  const xml = await readFile(sitemapPath, 'utf8');
  const locs = [...xml.matchAll(/<loc>(.*?)<\/loc>/g)].map((m) => m[1]);
  return locs.map((url) => {
    const path = url.replace(/^https?:\/\/[^/]+\/?/, '');
    const file = path === '' ? 'index.html' : path;
    return { url, file, path: '/' + (path === '' ? '' : path) };
  });
}

export async function readPage(file) {
  const full = join(ROOT, file);
  const html = await readFile(full, 'utf8');
  return { file, full, html, domHtml: stripInlineScriptContents(html) };
}

/**
 * Blanks out the body of every INLINE <script>...</script> block (keeps the
 * opening/closing tags and line count intact) so regex-based tag scanning
 * doesn't mistake JS string concatenation like `'<img src="' + img + '">'`
 * for real markup. External `<script src="...">` tags are untouched — they
 * have no meaningful inner text to confuse anything.
 */
export function stripInlineScriptContents(html) {
  return html.replace(/(<script(?![^>]*\bsrc=)[^>]*>)([\s\S]*?)(<\/script>)/gi, (m, open, body, close) => {
    const blanked = body.replace(/[^\n]/g, ' ');
    return open + blanked + close;
  });
}

/** Very small tag-attribute extractor: returns [{tag, attrs:{}, raw, index}] */
export function extractTags(html, tagName) {
  const re = new RegExp(`<${tagName}\\b([^>]*)>`, 'gi');
  const out = [];
  let m;
  while ((m = re.exec(html))) {
    out.push({ tag: tagName, attrsRaw: m[1], raw: m[0], index: m.index, attrs: parseAttrs(m[1]) });
  }
  return out;
}

export function parseAttrs(attrsRaw) {
  const attrs = {};
  const re = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*(?:=\s*(".*?"|'.*?'|[^\s"'=<>`]+))?/g;
  let m;
  while ((m = re.exec(attrsRaw))) {
    const name = m[1].toLowerCase();
    if (name === '/' ) continue;
    let value = m[2];
    if (value === undefined) { attrs[name] = true; continue; }
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    attrs[name] = value;
  }
  return attrs;
}

export function lineAt(html, index) {
  return html.slice(0, index).split('\n').length;
}

/** Every local, on-disk file the page references (img/script/link/source). */
export function localAssetRefs(html) {
  const refs = [];
  for (const tag of ['img', 'script', 'source']) {
    for (const t of extractTags(html, tag)) {
      const src = t.attrs.src;
      if (src) refs.push({ attr: 'src', value: src, index: t.index, tag: tag });
    }
  }
  for (const t of extractTags(html, 'link')) {
    const href = t.attrs.href;
    const rel = (t.attrs.rel || '').toLowerCase();
    if (href && (rel === 'stylesheet' || rel === 'icon' || rel === 'manifest')) {
      refs.push({ attr: 'href', value: href, index: t.index, tag: 'link' });
    }
  }
  return refs;
}

export function isLocalPath(value) {
  if (!value) return false;
  if (/^https?:\/\//i.test(value)) return false;
  if (value.startsWith('data:')) return false;
  if (value.startsWith('mailto:') || value.startsWith('tel:') || value.startsWith('#')) return false;
  if (value.startsWith('//')) return false;
  return true;
}

export async function localFileExists(refValue) {
  const clean = refValue.split('#')[0].split('?')[0];
  const rel = clean.startsWith('/') ? clean.slice(1) : clean;
  try {
    await stat(join(ROOT, rel));
    return true;
  } catch {
    return false;
  }
}

export async function walk(dir, filterExt) {
  const out = [];
  let entries;
  try { entries = await readdir(dir, { withFileTypes: true }); } catch { return out; }
  for (const e of entries) {
    if (e.name.startsWith('.') || e.name === 'node_modules') continue;
    const full = join(dir, e.name);
    if (e.isDirectory()) out.push(...(await walk(full, filterExt)));
    else if (!filterExt || e.name.endsWith(filterExt)) out.push(full);
  }
  return out;
}

export function relPath(full) {
  return full.startsWith(ROOT) ? full.slice(ROOT.length).replace(/^\/+/, '') : full;
}

export function resolveRoot(...segs) {
  return resolve(ROOT, ...segs);
}
