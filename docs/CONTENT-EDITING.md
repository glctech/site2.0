# Content editing recipes

Task-oriented guide for changing **what the site says and shows** without
needing to understand the plumbing.

> **Before you start:** preview locally (`python3 -m http.server 8080`), because
> merging to `glctech2.0` publishes straight to production.

> **About `data-i18n*` attributes:** many elements below still carry
> `data-i18n`/`data-i18n-attr`/`data-i18n-html` attributes from the retired
> multi-language system (see
> [`ARCHITECTURE.md`](ARCHITECTURE.md#javascript-subsystems)). Nothing reads
> them anymore — the site is Portuguese-only now — so just **edit the visible
> HTML text directly**. You don't need to touch or remove the attribute.

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

## Edit hero / headline copy

File: `index.html`, `<section id="hero">`. Edit the headline, paragraph, and
CTA button text directly in the HTML.

---

## Change the stat numbers (144+, 3k+, …)

File: `index.html`, the `.stats-strip` block. Each stat is:

```html
<div class="stat-item">
  <i class="fa-solid fa-server" …></i>
  <div class="stat-number"><span data-stat="devices">144</span><span>+</span></div>
  <div class="stat-desc" data-i18n="stat.snmp">Devices monitorados via SNMP</div>
</div>
```

- The **descriptions** and the `3k`, `99`, `24` **numbers** are all plain
  HTML — edit them directly.
- The **first number is live**: `<span data-stat="devices">144</span>` is
  auto-updated from Zabbix by the inline stats script (the `144` is just the
  fallback shown if the data doesn't load). To change what it shows, update the
  pipeline, not the HTML — see
  [`ARCHITECTURE.md`](ARCHITECTURE.md#stats-pipeline-zabbix--json). To make it a
  plain static number again, remove the `data-stat="devices"` attribute.

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

- **Add one:** copy a card and edit its quote, name, role, and avatar
  initials directly in the HTML.
- **Hide one:** add the `hidden` attribute to the `.testi-card`
  (`<div class="testi-card" hidden>`). Two extra cards are already present but
  hidden this way, ready to enable.

---

## Edit the services cards

Two places, keep them consistent:

1. **The card on the homepage** — `index.html`, `<section id="services">`. Each
   `.service-card` links to its detail page (`zabbix.html`, `kaspersky.html`,
   `veeam.html`).
2. **The detail page itself** — `zabbix.html` / `kaspersky.html` / `veeam.html`,
   which have their own copy and inline styles.

Edit the copy directly in each page's HTML.

---

## Add / remove / hide a team member

File: `index.html`, `<section id="team">` → `.team-grid`. Card shape:

```html
<div class="team-card">
  <img src="…/team/eu3.webp" alt="André Luiz Cézar" class="team-card-img face-fix">
  <div class="team-card-body">
    <div class="team-card-role">CEO &amp; Fundador</div>
    <h3>André Luiz Cézar</h3>
    <p>…</p>
  </div>
</div>
```

- **Name**, **role**, and **bio** are all plain HTML — edit them directly.
- A **Kawan Pablo** card already exists but is hidden with
  `style="display:none;"`. To show it, remove that style.
- `.face-fix` nudges the photo crop upward for better face framing — add it if a
  new portrait crops badly.

---

## Edit partner badges

File: `index.html`, `#partners` → `.partners-row`. Each is a
`<div class="partner-badge">Name</div>`. Add/remove/reorder freely; one (Zabbix)
is currently `hidden`.

---

## Enable the blog section

File: `index.html`. Find `<section id="blog" hidden>` and remove the `hidden`
attribute. The feed logic and fallbacks are already built (see
[`ARCHITECTURE.md`](ARCHITECTURE.md#3-blog-rss-feed-hidden)). It pulls live news
from TechTudo + TecMundo and caches for 25 minutes. No other change needed to
turn it on, but test it — third-party feeds/proxies can be flaky.

---

## Replace an image / logo

Images live under `assets/` (`logo/`, `team/`, `services/`, `hero/`,
`partner/`, `flags/`) and `kaspersky/`.

- Prefer **`.webp`** for photos (smaller); several `<img>` tags reference
  `.webp` with the design assuming that format.
- Keep the **same filename** to swap an image everywhere at once, or update each
  `src`. Pages reference images with root-relative URLs (`/assets/...` or
  `./assets/...`) — grep the filename to find all uses. Don't hardcode
  `https://glctech.com.br/assets/...` in a new `<img>`: the site is also served
  live from `glctechsec.com` without a redirect, so an absolute URL to the other
  domain adds a needless cross-domain hop for those visitors.
- Update the `alt` text (and its translation if keyed) when the content changes.

---

## Change contact details

File: `index.html`, `#contact` → `.contact-items`.

- **E-mail:** the `mailto:` link and the visible address
  (`contato@glctech.com.br`). The visible value is plain text.
- **Phone/WhatsApp:** the `tel:+55…` link and the visible number.
- **Location:** plain HTML — edit directly.

Also update the footer and any service pages if the same details appear there.
Changing where contact-form submissions are e-mailed is a Zoho Mail env-var
change, not an HTML change — see
[`INTEGRATIONS.md`](INTEGRATIONS.md#zoho-mail-contact--careers-forms).

---

## Edit legal pages

`politica.html` (privacy) and `termos.html` (terms of use) are standalone
pages. Edit their body copy directly in the HTML. Keep the "last updated" date
current when you change legal text.
