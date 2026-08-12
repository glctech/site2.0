/* ============================================================================
 * content.js — Phase 0 render layer (content/data decoupling)
 * ----------------------------------------------------------------------------
 * Reads structured content from the /content/*.json "data layer" and hydrates
 * any element carrying a `data-content="<pointer>"` attribute. This is the seam
 * that separates PRESENTATION (HTML shells) from CONTENT (JSON), and is the
 * front-end half of the decoupling contract.
 *
 * It is intentionally additive and fail-soft:
 *   - If a JSON file or a pointer can't be resolved, the element keeps whatever
 *     static markup it already had (progressive enhancement — nothing breaks).
 *   - It cooperates with scripts/i18n.js: when a content node also declares an
 *     `i18n` key, this layer copies it onto the element as `data-i18n` so the
 *     existing translation engine still runs afterwards. Content stays the
 *     single source for STRUCTURE; i18n stays the single source for LANGUAGE.
 *
 * Usage in HTML:
 *   <h3 data-content="services.items.0.title"></h3>
 *   <p  data-content="home.hero.subhead"></p>
 *   <a  data-content="site.contact.email" data-content-attr="href:mailto"></a>
 *
 * A `data-content` value is "<file>.<dot.path>" where <file> is a JSON file in
 * /content (site | services | home | ...). Leaf nodes may be a plain string, or
 * an object shaped { text | html, i18n?, href? } (the "content node" shape).
 * ==========================================================================*/
(function () {
  'use strict';

  var BASE = '/content/';
  var cache = {};

  function loadFile(name) {
    if (cache[name]) return cache[name];
    cache[name] = fetch(BASE + name + '.json?v=' + Date.now())
      .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .catch(function (e) {
        console.warn('[content] could not load ' + name + '.json:', e.message);
        return null;
      });
    return cache[name];
  }

  // Resolve "a.b.0.c" against a plain object/array. Returns undefined if any hop misses.
  function resolve(root, path) {
    return path.split('.').reduce(function (acc, key) {
      if (acc == null) return undefined;
      return acc[key];
    }, root);
  }

  // Apply a resolved value (string | content-node object) to a DOM element.
  function apply(el, value) {
    if (value == null) return;

    if (typeof value === 'string') { el.textContent = value; return; }

    // content-node object: { text | html, i18n?, href? }
    if (typeof value === 'object') {
      // Hand language duties back to the existing i18n engine.
      if (value.i18n && !el.hasAttribute('data-i18n') && !el.hasAttribute('data-i18n-html')) {
        el.setAttribute(value.html != null ? 'data-i18n-html' : 'data-i18n', value.i18n);
      }
      if (value.html != null) el.innerHTML = value.html;
      else if (value.text != null) el.textContent = value.text;

      // Optional attribute mapping via data-content-attr="href" or "href:mailto"/"href:tel"
      var attrSpec = el.getAttribute('data-content-attr');
      if (attrSpec && value.href == null && (value.text || typeof value === 'string')) {
        var parts = attrSpec.split(':');
        var attr = parts[0];
        var scheme = parts[1] ? parts[1] + ':' : '';
        el.setAttribute(attr, scheme + (value.text || ''));
      } else if (value.href != null) {
        el.setAttribute('href', value.href);
      }
    }
  }

  function hydrate() {
    var nodes = document.querySelectorAll('[data-content]');
    if (!nodes.length) return;

    // Group required files so each is fetched once.
    var files = {};
    nodes.forEach(function (el) {
      var p = el.getAttribute('data-content');
      var file = p.split('.')[0];
      (files[file] = files[file] || []).push(el);
    });

    Object.keys(files).forEach(function (file) {
      loadFile(file).then(function (data) {
        if (!data) return;
        files[file].forEach(function (el) {
          var path = el.getAttribute('data-content').split('.').slice(1).join('.');
          apply(el, resolve(data, path));
        });
        // Let the translation engine (if already loaded) re-translate new nodes.
        if (typeof window.applyLang === 'function' && window._glc_current_lang) {
          try { window.applyLang(window._glc_current_lang); } catch (e) {}
        }
      });
    });
  }

  // Public: allow other code to read the data layer (e.g. build tools, tests).
  window.GLCContent = { load: loadFile, resolve: resolve };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', hydrate);
  } else {
    hydrate();
  }
})();
