/* Email bodies for the commercial-audit weekly/monthly reports — same visual
 * language as the other report emails already being sent. */

import { SEVERITY } from './finding.mjs';

function shell(title, subtitle, bodyHtml, footerDate) {
  return `<div style="font-family:Arial,Helvetica,sans-serif;background:#f4f3f2;padding:24px 12px;color:#201f1f;">
<div style="max-width:640px;margin:0 auto;background:#ffffff;border:1px solid #e6e3e0;border-radius:10px;overflow:hidden;">
  <div style="padding:28px 32px 20px;border-bottom:1px solid #e6e3e0;">
    <div style="font-weight:800;font-size:18px;letter-spacing:0.02em;color:#e6262c;">GLCTECH</div>
    <div style="font-size:11px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:#e6262c;margin-top:14px;">Auditoria comercial e de conversão</div>
    <div style="font-size:22px;font-weight:800;color:#201f1f;margin-top:6px;line-height:1.25;">${title}</div>
    <div style="font-size:13px;color:#5c5854;margin-top:10px;">${subtitle}</div>
  </div>
  <div style="padding:22px 32px 4px;">${bodyHtml}</div>
  <div style="padding:16px 32px 24px;border-top:1px solid #e6e3e0;font-size:11.5px;color:#938e88;display:flex;justify-content:space-between;">
    <span>GLCTech · Auditoria comercial e de conversão — glctech.com.br</span>
    <span>${footerDate}</span>
  </div>
</div>
</div>`;
}

function statRow(label, value) {
  return `<tr><td style="padding:6px 0;color:#5c5854;font-size:13.5px;">${label}</td><td style="padding:6px 0;text-align:right;font-weight:700;color:#201f1f;font-size:13.5px;">${value}</td></tr>`;
}

export function weeklyCommercialEmailHtml({ dateStr, pagesAnalyzed, findings, topConversion, criticalCount, recurringCount }) {
  const byCat = {};
  for (const f of findings) byCat[f.category] = (byCat[f.category] || 0) + 1;

  const body = `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;">
      ${statRow('Páginas analisadas', pagesAnalyzed)}
      ${statRow('Pontos identificados', findings.length)}
      ${statRow('— Críticos', criticalCount)}
      ${statRow('— Reincidentes', recurringCount)}
      ${statRow('Relacionados a conversão', byCat['Conversão'] || 0)}
    </table>
    ${topConversion.length ? `<div style="font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#e6262c;margin-bottom:8px;">Top oportunidades de conversão</div>
    <ul style="margin:0 0 20px;padding-left:18px;font-size:13.5px;color:#3a3733;line-height:1.7;">${topConversion.map((f) => `<li><b>[${f.id}]</b> ${f.problem}</li>`).join('')}</ul>` : ''}
    <p style="font-size:13px;color:#5c5854;">Relatório completo em anexo (Markdown) — inclui evidência, impacto, prioridade e sugestão de implementação para cada ponto. Nenhuma alteração foi feita no site: este é um relatório de recomendações, toda mudança precisa da sua aprovação.</p>
  `;
  return shell(`Relatório Semanal — Auditoria do Site — ${dateStr}`, `Site: glctech.com.br · Repositório: glctech/site2.0`, body, dateStr);
}

export function monthlyCommercialEmailHtml({ monthStr, weeksCount, totals, timeline, pending }) {
  const body = `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;">
      ${statRow('Auditorias no mês', weeksCount)}
      ${statRow('Pontos identificados (total)', totals.found)}
      ${statRow('Pontos reincidentes', totals.recurring)}
      ${statRow('Possivelmente resolvidos', totals.possiblyResolved)}
    </table>
    <div style="font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#e6262c;margin-bottom:8px;">Linha do tempo</div>
    <ul style="margin:0 0 20px;padding-left:18px;font-size:13.5px;color:#3a3733;line-height:1.8;">
      ${timeline.map((t) => `<li><b>${t.date}</b> — ${t.summary}</li>`).join('')}
    </ul>
    ${pending.length ? `<div style="font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#8a5a00;margin-bottom:8px;">Principais pendências</div>
    <ul style="margin:0 0 20px;padding-left:18px;font-size:13.5px;color:#6b4a08;line-height:1.7;">${pending.map((p) => `<li>${p}</li>`).join('')}</ul>` : ''}
    <p style="font-size:13px;color:#5c5854;">Relatório completo em anexo (Markdown).</p>
  `;
  return shell(`Relatório Mensal — Auditoria e Evolução do Site — ${monthStr}`, `Site: glctech.com.br · Repositório: glctech/site2.0`, body, monthStr);
}
