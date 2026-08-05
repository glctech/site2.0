# `content/` — the data layer (Phase 0)

Structured content extracted out of the HTML so pages become presentation
shells. Consumed at runtime by [`../scripts/content.js`](../scripts/content.js)
and, later, by build tooling or a headless CMS. See the full plan in
[`../docs/DECOUPLING.md`](../docs/DECOUPLING.md).

## Files

| File | Holds |
|------|-------|
| `site.json` | Global chrome: brand, contact, nav, footer (shared by every page). |
| `services.json` | The services section: `section` copy + `items[]` (Zabbix / Kaspersky / Veeam). |
| `home.json` | Homepage copy: `hero` + `stats[]` strip. |

## Schema — the "content node"

A leaf is either a **plain string** or a **content node** object:

```jsonc
{
  "text": "Saiba mais",        // plain-text content  (→ element.textContent)
  "html": "A<br>B",            // rich content        (→ element.innerHTML), use instead of text
  "i18n": "services.s1.link",  // OPTIONAL: hands translation to scripts/i18n.js
  "href": "https://…"          // OPTIONAL: sets the element's href
}
```

Rules:
- Provide **either** `text` **or** `html`, not both (`html` wins if both exist).
- `i18n` is the bridge to the existing translation engine: `content.js` copies
  it onto the element as `data-i18n` (or `data-i18n-html`) so language switching
  keeps working. Content files carry the **Portuguese default**; translations
  stay in `scripts/i18n.js`.

## Binding content in HTML

```html
<!-- pointer = "<file>.<dot.path into that file>" -->
<h3 data-content="services.items.0.title"></h3>
<p  data-content="home.hero.subhead"></p>

<!-- map a value onto an attribute; scheme optional (mailto:/tel:) -->
<a data-content="site.contact.email" data-content-attr="href:mailto"></a>
```

Missing files or pointers are **fail-soft**: the element keeps its existing
static markup, so binding pages is safe and incremental.

## Adding content

1. Add the key to the relevant JSON file (use a content node if it needs a link
   or a translation key).
2. Add `data-content="file.path"` to the target element (leave it empty, or keep
   fallback copy inside — it's replaced on load).
3. If it's user-visible copy, add the matching `i18n` key in `scripts/i18n.js`
   for the other five languages.
