# Third-party integrations

Every external service the site talks to, where its key/ID lives, whether that
value is safe to be public, and how to change it.

> **Golden rule:** this is a static site — **everything in the HTML/JS ships to
> the browser and is publicly visible.** So the only keys that belong here are
> ones designed to be public (submission keys, widget IDs, measurement IDs).
> The **only** genuinely secret credentials (Zabbix login) must live in CI
> secrets, never in the repo.

- [At a glance](#at-a-glance)
- [Google Analytics 4](#google-analytics-4)
- [Zoho Mail (contact, diagnostic & careers forms)](#zoho-mail-contact-diagnostic--careers-forms)
- [JotForm (e-book capture)](#jotform-e-book-capture)
- [RSS2JSON + CORS proxies (blog feed)](#rss2json--cors-proxies-blog-feed)
- [Tidio AI chatbot](#tidio-ai-chatbot)
- [Zabbix API (stats pipeline)](#zabbix-api-stats-pipeline)
- [Google Fonts & Font Awesome](#google-fonts--font-awesome)

---

## At a glance

| Service | Purpose | Identifier lives in | Public? |
|---------|---------|---------------------|:---:|
| Google Analytics 4 | Traffic analytics | `G-7VH0J5XFYK` in each page `<head>` | ✅ public by design |
| Zoho Mail SMTP | All 3 forms (contato, diagnóstico, candidatura) → e-mail via `/api/send-email` | **Pages env vars**, not in repo | 🔒 **secret** |
| JotForm | E-book lead capture | iframe `src` in `ebook.html` | ✅ public embed |
| RSS2JSON | Blog feed JSON | `RSS2JSON_KEY` in `index.html` blog IIFE | ✅ public API key |
| Tidio | AI chatbot | script URL id in `index.html` | ✅ public widget id |
| Zabbix API | Live device stats | **env vars**, not in repo | 🔒 **secret** |

---

## Google Analytics 4

- **What:** page/traffic analytics via `gtag.js`.
- **Measurement ID:** `G-7VH0J5XFYK`.
- **Where:** the `<!-- Google tag (gtag.js) -->` block at the top of every main
  page's `<head>` (index, service pages, legal pages, mailmkt…).
- **To change/replace:** swap the ID in the `src=…?id=` URL **and** the
  `gtag('config', 'G-…')` call — in **every** page (no shared include).
- **Public?** Yes — measurement IDs are meant to be in client code.

---

## Zoho Mail (contact, diagnostic & careers forms)

- **What:** all three forms on the site — `#contact` on `index.html`, the
  "Diagnóstico Gratuito" form on `landing.html`, and the "candidatura" form
  (with PDF résumé attachment) on `trabalhe-conosco.html` — now submit to our
  **own** endpoint, `POST /api/send-email`, a Cloudflare Pages Function
  (`functions/api/send-email.js`). That function authenticates directly
  against a Zoho Mail mailbox over SMTP (implicit TLS, port 465) and sends the
  e-mail itself — no Web3Forms, no FormSubmit.co, no HubSpot embed, and no
  third-party attachment-size/plan limits.
- **Files:**
  - `functions/api/send-email.js` — validates the incoming form (`form_type`
    = `contact` | `diagnostico` | `candidatura`), builds the subject/body per
    form, and (for `candidatura`) attaches the uploaded PDF.
  - `functions/api/_lib/smtp.mjs` — a minimal hand-rolled SMTP client built on
    Cloudflare's `cloudflare:sockets` TCP API. Only supports **port 465
    (implicit TLS/SSL)**, matching the first option in Zoho's own SMTP
    settings screen (`smtppro.zoho.com`, 465 SSL). STARTTLS/587 is not
    implemented.
- **Required Pages environment variables** (Pages project → *Settings →
  Environment variables*, marked as **secret**, same place `ZABBIX_*` already
  live):
  - `ZOHO_SMTP_USER` — the mailbox that authenticates and sends, e.g.
    `contato@glctech.com.br`.
  - `ZOHO_SMTP_PASS` — a Zoho **app-specific password** for that mailbox
    (Zoho Mail → *My Account → Security → App Passwords*). Don't use the
    normal mailbox login password.
- **Optional environment variables:**
  - `ZOHO_SMTP_HOST` (default `smtppro.zoho.com`) / `ZOHO_SMTP_PORT` (default
    `465`, must stay `465`).
  - `ZOHO_FROM_NAME` (default `Site GLCTech`) — display name on the `From:` header.
  - `ZOHO_MAIL_TO_CONTATO` (default `contato@glctech.com.br`) — destination for
    the contact + diagnostic forms.
  - `ZOHO_MAIL_TO_RH` (default `rh@glctech.com.br`) — destination for the
    careers/candidatura form.
- **To change the sending mailbox or a destination inbox:** just update the
  relevant env var in the Pages dashboard and redeploy — nothing in the HTML
  needs to change.
- **Public?** No — everything lives server-side in Pages env vars. The
  front-end only knows about `/api/send-email` (no key shipped to the
  browser).
- **⚠️ Cross-origin workaround (as of Aug 2026):** the canonical domain
  `glctech.com.br` 302-redirects to `glctechsec.com` (the international/EU
  domain — see [`ARCHITECTURE.md`](ARCHITECTURE.md)). `glctechsec.com` lives
  in a **separate Cloudflare account** and is fronted by a CDN (Fastly) that
  only allows `GET`/`HEAD` at the edge — any `POST` to it, including
  `/api/send-email`, gets a bare `405` before it ever reaches our Worker.
  Until whoever manages that Fastly/Cloudflare setup either allows `POST` for
  `/api/*` or routes that path straight to the Worker instead of caching it,
  all three forms call the Worker's own domain directly —
  `https://site2-0.aluiz-cez.workers.dev/api/send-email` — as an **absolute,
  cross-origin URL** (in `index.html`, `landing.html`'s `<form action>` and JS
  fallback, and `trabalhe-conosco.html`), instead of the same-origin relative
  path. `send-email.js` sends `Access-Control-Allow-Origin: *` (plus an
  `onRequestOptions` handler) so the cross-origin `fetch()`/form submit is
  allowed. **Once the CDN is fixed to pass `POST /api/*` through**, these can
  revert to the relative `/api/send-email` path and the CORS headers can come
  out — grep the repo for `site2-0.aluiz-cez.workers.dev` to find every place
  to change back.
- **Anti-spam:** each form still ships a hidden honeypot field
  (`botcheck`); the function silently accepts (HTTP 200, no e-mail sent) if
  it's filled in, matching the previous Web3Forms behavior.
- **Gotcha:** `smtp.mjs` requires the `cloudflare:sockets` TCP Sockets API,
  which needs a reasonably recent *Compatibility date* on the Pages project
  (Settings → Functions). If deploys start failing on this endpoint, check
  that setting first.
- **Careers form résumé attachment:** previously blocked because Web3Forms'
  free plan treats attachments as a paid feature (worked around at the time
  with FormSubmit.co). Now the endpoint reads the uploaded PDF
  (`<input name="curriculo">`), validates type (`application/pdf`) and size
  (≤5MB) server-side too, and attaches it as a real MIME part in the outgoing
  e-mail — no external service or "activate this form" step involved.

---

## JotForm (e-book capture)

- **What:** the lead-capture form on `ebook.html` that gates the Zabbix e-book
  download.
- **Where:** an `<iframe id="JotFormIFrame-…" src="https://form.jotform.com/…">`
  in `ebook.html`, plus JotForm's embed-handler script.
- **To change:** replace the form id in both the iframe `src` and the
  `jotformEmbedHandler(...)` call. Manage fields/notifications in the JotForm
  dashboard.
- **History:** `ebook.html` used to have a hand-rolled form with a custom JS
  submit handler. That was replaced by the JotForm embed; the old dead handler
  was removed. Don't re-add client-side form logic here — JotForm owns it.

---

## RSS2JSON + CORS proxies (blog feed)

- **What:** the (currently hidden) `#blog` section fetches news from TechTudo
  and TecMundo. Full logic in
  [`ARCHITECTURE.md`](ARCHITECTURE.md#5-blog-rss-feed-hidden).
- **Primary API:** `api.rss2json.com` with `RSS2JSON_KEY` (in the blog IIFE).
- **Fallback proxies:** `api.allorigins.win`, then `corsproxy.io` (parse raw
  XML) — used only if RSS2JSON fails.
- **Public?** Yes — free-tier RSS2JSON keys are client-side by design.
- **To enable the section:** remove `hidden` from `<section id="blog">`.

---

## Tidio AI chatbot

- **What:** the floating AI chat widget.
- **Where:** two `<script>` blocks just before `</body>` in `index.html`:
  1. a small companion script that sets `document.tidioChatLang` (from
     `localStorage['glctech_lang']`) and exposes `window.glcOpenChat()`;
  2. the loader: `<script src="//code.tidio.co/<id>.js" async></script>`.
- **To change the account/widget:** replace the `<id>` in the loader URL with
  the one from your Tidio project's install snippet.
- **Branding lives in the Tidio dashboard**, not in code — set colors (brand
  red **`#e6262c`**), avatar, greeting, and automation there so it matches the
  site.
- **Site-wide:** the same two `<script>` blocks before `</body>` are on
  `index.html`, the service pages, the legal pages, and `trabalhe-conosco.html`.
  Copy the same pair onto any new main page to keep it consistent.
- **Open the chat from a site button:**
  ```html
  <button onclick="window.glcOpenChat && window.glcOpenChat()">Fale com a IA</button>
  ```

---

## Zabbix API (stats pipeline)

- **What:** `scripts/fetch_zabbix_stats.py` logs into a **Zabbix 7.x** server
  and writes `assets/data/stats.json` (device + problem counts). Full picture
  in [`ARCHITECTURE.md`](ARCHITECTURE.md#stats-pipeline-zabbix--json).
- **Credentials — 🔒 SECRET:** read from environment variables, never hard-coded:
  - `ZABBIX_URL` — base URL of the Zabbix server
  - `ZABBIX_USER` — API user
  - `ZABBIX_PASS` — password
- **Where they must live:** if/when you schedule this in **GitHub Actions**, put
  them in **repository secrets** (`Settings → Secrets and variables → Actions`)
  and pass them into the job's env. **Do not** commit them or put them in any
  `.html`/`.js` file — those are public.
- **Zabbix 7.x specifics** (already handled in the script): login field is
  `username` (not `user`); auth is an `Authorization: Bearer <token>` header
  (not an `auth` body field).

---

## Google Fonts & Font Awesome

- **Fonts:** Syne + DM Sans via `fonts.googleapis.com` `<link>` in each page.
- **Icons:** Font Awesome 6 via `cdnjs.cloudflare.com` `<link>`.
- Purely presentational CDNs; no keys. If you need offline/self-hosted assets
  later, download and reference locally, but that's not the current setup.
