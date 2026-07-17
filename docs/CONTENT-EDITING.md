# Content editing recipes

Task-oriented guide for changing **what the site says and shows** without
needing to understand the plumbing. If a recipe touches translations, it links
to [`I18N.md`](I18N.md).

> **Before you start:** preview locally (`python3 -m http.server 8080`), because
> merging to `glctech2.0` publishes straight to production. And remember most
> visible strings are **translated** — changing the Portuguese HTML alone can be
> visually overridden by `scripts/i18n.js` on load. When in doubt, change both
> the HTML text *and* the dictionary value (see each recipe).

- [Understand the "text vs translation" rule first](#understand-the-text-vs-translation-rule-first)
- [Edit hero / headline copy](#edit-hero--headline-copy)
- [Change the stat numbers (144+, 3k+, …)](#change-the-stat-numbers-144-3k-)
- [Add / edit / hide a testimonial](#add--edit--hide-a-testimonial)
- [Edit the services (Zabbix / Kaspersky / Veeam) cards](#edit-the-services-cards)
- [Add / remove / hide a team member](#add--remove--hide-a-team-member)
- [Edit partner badges](#edit-partner-badges)
- [Enable the blog section](#enable-the-blog-section)
- [Replace an image / logo](#replace-an-image--logo)
- [Change contact details](#change-contact-details)
- [Edit legal pages](#edit-legal-pages)

---

## Understand the "text vs translation" rule first

Any element with a `data-i18n*` attribute has its text **replaced at load** by
`scripts/i18n.js`. So:

- **Element has `data-i18n="…"`** → change the value in the dictionary in
  `scripts/i18n.js` for each language (and, to keep the no-JS view correct,
  update the Portuguese HTML too). See [`I18N.md` recipes](I18N.md#recipes).
- **Element has NO `data-i18n`** (e.g. proper names, phone numbers) → just edit
  the HTML; it's shown as-is.

You can tell which is which by looking at the tag in the HTML.

---

## Edit hero / headline copy

File: `index.html`, `<section id="hero">`. The headline and paragraph use
`data-i18n` keys (`hero.h1.*`, `hero.p`, `hero.cta1`, `hero.cta2`). Update those
keys in `scripts/i18n.js`. The badge, "Ao vivo" label, etc. are also keyed
(`hero.badge`, `hero.live`).

---

## Change the stat numbers (144+, 3k+, …)

File: `index.html`, the `.stats-strip` block. Each stat is:

```html
<div class="stat-item">
  <i class="fa-solid fa-server" …></i>
  <div class="stat-number">144<span>+</span></div>
  <div class="stat-desc" data-i18n="stat.snmp">Devices monitorados via SNMP</div>
</div>
```

- The **number** (`144`, `3k`, `99`, `24`) is plain HTML — edit it directly.
- The **description** is translated — edit `stat.snmp` / `stat.capacity` /
  `stat.sla` / `stat.support` in `scripts/i18n.js`.

> **Want the device count to update automatically from Zabbix instead?** That's
> the stats pipeline — see
> [`ARCHITECTURE.md`](ARCHITECTURE.md#stats-pipeline-zabbix--json). It needs a
> GitHub Action + a `data-stat="devices"` hook + the `stats-snippet.html`
> script; it is not wired up today.

---

## Add / edit / hide a testimonial

File: `index.html`, `<section id="testimonials">` → `.testimonials-grid`.
Each card:

```html
<div class="testi-card">
  <div class="testi-stars"><i class="fa-solid fa-star"></i>…×5</div>
  <blockquote data-i18n="testi.t1">"…quote…"</blockquote>
  <div class="testi-author">
    <div class="testi-avatar">WN</div>   <!-- initials -->
    <div>
      <div class="testi-name">Wilson</div>
      <div class="testi-role" data-i18n="testi.t1.role">Presidente — Nordenet</div>
    </div>
  </div>
</div>
```

- **Add one:** copy a card, give it a fresh key (`testi.t3`, `testi.t3.role`),
  add those keys to `scripts/i18n.js`, set the name/initials in the HTML.
- **Hide one:** add the `hidden` attribute to the `.testi-card`
  (`<div class="testi-card" hidden>`). Two extra cards are already present but
  hidden this way, ready to enable.
- The name and avatar initials are plain HTML (not translated).

---

## Edit the services cards

Two places, keep them consistent:

1. **The card on the homepage** — `index.html`, `<section id="services">`. Each
   `.service-card` links to its detail page (`zabbix.html`, `kaspersky.html`,
   `veeam.html`) and uses `services.s1.*` / `s2` / `s3` keys.
2. **The detail page itself** — `zabbix.html` / `kaspersky.html` / `veeam.html`,
   which have their own `data-i18n` keys and inline styles.

Copy changes go in `scripts/i18n.js`. Structural/visual changes go in the
respective page's HTML/`<style>`.

---

## Add / remove / hide a team member

File: `index.html`, `<section id="team">` → `.team-grid`. Card shape:

```html
<div class="team-card">
  <img src="…/team/eu3.webp" alt="André Luiz Cézar" class="team-card-img face-fix">
  <div class="team-card-body">
    <div class="team-card-role" data-i18n="team.m1.role">CEO &amp; Fundador</div>
    <h3>André Luiz Cézar</h3>
    <p data-i18n="team.m1.bio">…</p>
  </div>
</div>
```

- **Name** and **photo** are plain HTML; **role** and **bio** are translated
  (`team.mN.*`).
- A **Kawan Pablo** card already exists but is hidden with
  `style="display:none;"`. To show it, remove that style (and give it `team.m3.*`
  keys if you want it translated).
- `.face-fix` nudges the photo crop upward for better face framing — add it if a
  new portrait crops badly.
- Individual profile pages exist too: `andre.html`, `tchize.html`, `kawan.html`.

---

## Edit partner badges

File: `index.html`, `#partners` → `.partners-row`. Each is a
`<div class="partner-badge">Name</div>`. Add/remove/reorder freely; one (Zabbix)
is currently `hidden`. The section heading is translated (`partners.label`).

---

## Enable the blog section

File: `index.html`. Find `<section id="blog" hidden>` and remove the `hidden`
attribute. The feed logic and fallbacks are already built (see
[`ARCHITECTURE.md`](ARCHITECTURE.md#5-blog-rss-feed-hidden)). It pulls live news
from TechTudo + TecMundo and caches for 25 minutes. No other change needed to
turn it on, but test it — third-party feeds/proxies can be flaky.

---

## Replace an image / logo

Images live under `assets/` (`logo/`, `team/`, `services/`, `hero/`,
`partner/`, `flags/`) and `kaspersky/`.

- Prefer **`.webp`** for photos (smaller); several `<img>` tags reference
  `.webp` with the design assuming that format.
- Keep the **same filename** to swap an image everywhere at once, or update each
  `src`. Pages reference images by both absolute
  (`https://glctech.com.br/assets/...`) and relative (`./assets/...`) URLs — grep
  the filename to find all uses.
- Update the `alt` text (and its translation if keyed) when the content changes.

---

## Change contact details

File: `index.html`, `#contact` → `.contact-items`.

- **E-mail:** the `mailto:` link and the visible address
  (`contato@glctech.com.br`). The visible value is plain text.
- **Phone/WhatsApp:** the `tel:+55…` link and the visible number.
- **Location:** translated (`contact.location.val`).

Also update the footer and any service pages if the same details appear there.
Changing where contact-form submissions are e-mailed is a Web3Forms change —
see [`INTEGRATIONS.md`](INTEGRATIONS.md#web3forms-contact-form).

---

## Edit legal pages

`politica.html` (privacy) and `termos.html` (terms of use) are standalone pages
that also load `scripts/i18n.js`. Edit their body copy in the HTML; translated
strings use `data-i18n` keys defined in `scripts/i18n.js`. Keep the "last
updated" date current when you change legal text.
