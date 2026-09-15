/* ============================================================================
 * Newsletter — template do e-mail (HTML + texto puro), com escape.
 * ----------------------------------------------------------------------------
 * Todo texto interpolado passa por esc(): mesmo que o agente (ou um item de
 * feed malicioso) tente injetar HTML, ele sai como texto literal. Os únicos
 * `href` do e-mail vêm de `items[idx].url` — nunca de texto gerado pelo
 * modelo. Cores seguem os tokens de marca do site (docs/ARCHITECTURE.md).
 * ==========================================================================*/

const esc = (s = '') => String(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const C = { red: '#e6262c', dark: '#2d2d2d', darkMid: '#242424', border: '#484848', white: '#ffffff', muted: '#909090' };

export function renderEmail({ content, items, companyNews, unsubscribeUrl, siteUrl, testBanner }) {
  const url = (idx) => items[idx].url;
  const src = (idx) => items[idx].source;
  const companyUrl = (id) => companyNews.find((n) => n.id === id)?.url;
  const companyImage = (id) => companyNews.find((n) => n.id === id)?.image_url;

  const banner = testBanner
    ? `<tr><td style="background:#F5C400;color:#000;padding:10px;text-align:center;font-weight:bold">
         TESTE — este envio não foi para a lista de assinantes
       </td></tr>` : '';

  const stories = content.top_stories.map((s) => `
    <tr><td style="padding:0 32px 24px">
      <p style="margin:0 0 4px;color:${C.muted};font-size:12px;text-transform:uppercase">${esc(src(s.idx))}</p>
      <h2 style="margin:0 0 8px;font-size:18px;color:${C.white}">
        <a href="${esc(url(s.idx))}" style="color:${C.white};text-decoration:none">${esc(s.headline)}</a>
      </h2>
      <p style="margin:0 0 8px;color:${C.white};line-height:1.5">${esc(s.summary)}</p>
      <p style="margin:0;color:${C.red};font-size:14px"><strong>Por que importa:</strong> ${esc(s.why_it_matters)}</p>
    </td></tr>`).join('');

  const hits = content.quick_hits.map((h) => `
    <li style="margin-bottom:8px"><a href="${esc(url(h.idx))}" style="color:${C.white}">${esc(h.line)}</a>
    <span style="color:${C.muted}"> — ${esc(src(h.idx))}</span></li>`).join('');

  const company = content.company_news.length ? `
    <tr><td style="padding:0 32px 28px">
      <div style="background:${C.darkMid};border:1px solid ${C.border};border-left:4px solid ${C.red};border-radius:4px;padding:20px">
        <p style="margin:0 0 12px;color:${C.red};font-size:12px;font-weight:bold;text-transform:uppercase;letter-spacing:0.5px">Novidade GLCTech</p>
        ${content.company_news.map((c) => `
          <h2 style="margin:0 0 10px;color:${C.white};font-size:19px">${esc(c.headline)}</h2>
          ${companyImage(c.id) ? `<img src="${esc(companyImage(c.id))}" alt="${esc(c.headline)}" width="576" style="display:block;width:100%;max-width:576px;height:auto;border-radius:4px;margin:0 0 14px;border:1px solid ${C.border}">` : ''}
          <p style="margin:0 0 14px;color:${C.white};line-height:1.5">${esc(c.summary)}</p>
          ${companyUrl(c.id) ? `<p style="margin:0"><a href="${esc(companyUrl(c.id))}" style="background:${C.red};color:${C.white};padding:9px 18px;text-decoration:none;border-radius:4px;font-size:14px;display:inline-block">Saiba mais →</a></p>` : ''}
        `).join(`<hr style="border:none;border-top:1px solid ${C.border};margin:20px 0">`)}
      </div>
    </td></tr>` : '';

  const html = `<!doctype html><html><body style="margin:0;background:${C.dark};font-family:Arial,Helvetica,sans-serif">
  <span style="display:none;max-height:0;overflow:hidden">${esc(content.preheader)}</span>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:640px;margin:0 auto;background:${C.dark}">
    ${banner}
    <tr><td style="padding:28px 32px 24px;border-bottom:3px solid ${C.red}">
      <img src="${esc(siteUrl)}/assets/logo/new_logo.png" alt="GLCTech" width="220" height="56" style="display:block;border:0;outline:none;height:auto;max-width:220px;margin:0 0 18px">
      <h1 style="margin:0;color:${C.white};font-size:22px">Boletim GLCTech</h1>
    </td></tr>
    <tr><td style="padding:24px 32px;color:${C.white};line-height:1.5">${esc(content.intro)}</td></tr>
    ${company}
    ${stories}
    <tr><td style="padding:0 32px 24px">
      <h3 style="color:${C.red};margin:0 0 12px">Resumo rápido</h3>
      <ul style="margin:0;padding-left:18px;color:${C.white}">${hits}</ul>
    </td></tr>
    <tr><td style="padding:0 32px 24px">
      <div style="border-left:3px solid ${C.red};padding:12px 16px;background:${C.darkMid}">
        <h3 style="color:${C.white};margin:0 0 8px">${esc(content.tip.title)}</h3>
        <p style="color:${C.white};margin:0;line-height:1.5">${esc(content.tip.body)}</p>
      </div>
    </td></tr>
    <tr><td style="padding:24px 32px;color:${C.muted};font-size:12px;border-top:1px solid ${C.border}">
      Você recebe este e-mail porque se inscreveu em ${esc(siteUrl)}.<br>
      <a href="${esc(unsubscribeUrl)}" style="color:${C.muted}">Cancelar inscrição</a> ·
      GLCTech Tecnologia — São Paulo, SP, Brasil
    </td></tr>
  </table></body></html>`;

  const text = [
    testBanner ? '*** TESTE — não enviado para a lista ***\n' : '',
    'Boletim GLCTech', '', content.intro, '',
    ...content.company_news.map((c) => `>>> NOVIDADE GLCTECH: ${c.headline}\n${c.summary}${companyUrl(c.id) ? `\n${companyUrl(c.id)}` : ''}\n`),
    ...content.top_stories.map((s) => `■ ${s.headline}\n${s.summary}\nPor que importa: ${s.why_it_matters}\n${url(s.idx)}\n`),
    'Resumo rápido:', ...content.quick_hits.map((h) => `- ${h.line} ${url(h.idx)}`), '',
    `Dica: ${content.tip.title}\n${content.tip.body}`, '',
    `Cancelar inscrição: ${unsubscribeUrl}`,
  ].join('\n');

  return { html, text };
}
