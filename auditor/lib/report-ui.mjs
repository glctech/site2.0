/* ============================================================================
 * report-ui.mjs — componentes de e-mail compartilhados pelos 4 relatórios de
 * auditoria (semanal/mensal × técnico/comercial), para os dois sites
 * (glctech.com.br e glctechsec.com) usarem o mesmo padrão visual.
 * Inline styles em tudo — e-mail não tem CSS externo nem classes confiáveis.
 * ==========================================================================*/

const esc = (s = '') => String(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const C = { red: '#e6262c', dark: '#2d2d2d', text: '#201f1f', muted: '#5c5854', border: '#e6e3e0', noteBg: '#f4f3f2' };

/** Moldura do e-mail: banner escuro (eyebrow + título + período) + corpo branco + rodapé. */
export function reportShell({ eyebrow, title, period, bodyHtml, footerText }) {
  return `<div style="font-family:Arial,Helvetica,sans-serif;background:${C.noteBg};padding:24px 12px;color:${C.text};">
<div style="max-width:680px;margin:0 auto;background:#ffffff;border:1px solid ${C.border};border-radius:10px;overflow:hidden;">
  <div style="background:${C.dark};padding:28px 32px;">
    <div style="font-size:11px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:${C.red};">${esc(eyebrow)}</div>
    <div style="font-size:24px;font-weight:800;color:#ffffff;margin-top:8px;line-height:1.3;">${esc(title)}</div>
    <div style="font-size:13px;color:#b9b6b2;margin-top:10px;">${esc(period)}</div>
  </div>
  <div style="padding:28px 32px 8px;">${bodyHtml}</div>
  <div style="padding:16px 32px 24px;border-top:1px solid ${C.border};font-size:11.5px;color:#938e88;">${esc(footerText)}</div>
</div>
</div>`;
}

/** Título de seção vermelho com linha embaixo — "RESUMO EXECUTIVO", "TOTAL DE EXECUÇÕES", etc. */
export function sectionHeading(text) {
  return `<div style="font-size:13px;font-weight:800;letter-spacing:0.06em;text-transform:uppercase;color:${C.red};margin:24px 0 12px;padding-bottom:8px;border-bottom:1px solid ${C.border};">${esc(text)}</div>`;
}

/** Subtítulo escuro menor, para subseções dentro de uma seção (ex.: eixos de evolução). */
export function subHeading(text) {
  return `<div style="font-size:14px;font-weight:700;color:${C.text};margin:16px 0 6px;">${esc(text)}</div>`;
}

/** Parágrafo de prosa (resumo executivo). */
export function paragraph(text) {
  return `<p style="margin:0 0 4px;font-size:13.5px;color:${C.text};line-height:1.7;">${esc(text)}</p>`;
}

/** Tabela com bordas e cabeçalho cinza claro. rows: array de arrays de células já formatadas (string/number). */
export function dataTable(headers, rows) {
  const th = headers.map((h) => `<th style="text-align:left;padding:8px 12px;font-size:12px;font-weight:700;color:${C.text};background:#f7f6f5;border:1px solid ${C.border};">${esc(h)}</th>`).join('');
  const tr = rows.map((r) => `<tr>${r.map((c) => `<td style="padding:8px 12px;font-size:13px;color:${C.text};border:1px solid ${C.border};">${c}</td>`).join('')}</tr>`).join('');
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin-bottom:16px;"><thead><tr>${th}</tr></thead><tbody>${tr}</tbody></table>`;
}

/** Caixa cinza de nota/contexto (ex.: cobertura da auditoria, ressalvas). */
export function noteBox(text) {
  return `<div style="background:${C.noteBg};border-radius:6px;padding:14px 16px;font-size:12.5px;color:${C.muted};line-height:1.6;margin-bottom:16px;">${text}</div>`;
}

/** Lista com marcadores, usada dentro de subseções. */
export function bulletList(items) {
  if (!items.length) return '';
  return `<ul style="margin:0 0 16px;padding-left:18px;font-size:13.5px;color:${C.text};line-height:1.7;">${items.map((i) => `<li>${i}</li>`).join('')}</ul>`;
}

/** Agrupa findings por categoria → [{ categoria, quantidade, ids }], ordenado por quantidade desc. */
export function groupByCategory(findings) {
  const map = new Map();
  for (const f of findings) {
    const key = f.category || 'Outros';
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(f.id);
  }
  return [...map.entries()]
    .map(([categoria, ids]) => ({ categoria, quantidade: ids.length, ids }))
    .sort((a, b) => b.quantidade - a.quantidade);
}

export { esc };
