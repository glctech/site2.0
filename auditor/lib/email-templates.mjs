/* Email bodies for the weekly/monthly audit reports — same visual language
 * (GLCTech red, light card layout, inline styles for mail-client safety) as
 * the improvement-summary emails already being sent for each manual change. */

import { SEVERITY } from './finding.mjs';

function shell(title, subtitle, bodyHtml, footerDate) {
  return `<div style="font-family:Arial,Helvetica,sans-serif;background:#f4f3f2;padding:24px 12px;color:#201f1f;">
<div style="max-width:640px;margin:0 auto;background:#ffffff;border:1px solid #e6e3e0;border-radius:10px;overflow:hidden;">
  <div style="padding:28px 32px 20px;border-bottom:1px solid #e6e3e0;">
    <div style="font-weight:800;font-size:18px;letter-spacing:0.02em;color:#e6262c;">GLCTECH</div>
    <div style="font-size:11px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:#e6262c;margin-top:14px;">Auditoria automática do site</div>
    <div style="font-size:22px;font-weight:800;color:#201f1f;margin-top:6px;line-height:1.25;">${title}</div>
    <div style="font-size:13px;color:#5c5854;margin-top:10px;">${subtitle}</div>
  </div>
  <div style="padding:22px 32px 4px;">${bodyHtml}</div>
  <div style="padding:16px 32px 24px;border-top:1px solid #e6e3e0;font-size:11.5px;color:#938e88;display:flex;justify-content:space-between;">
    <span>GLCTech · Agente de auditoria — glctech.com.br</span>
    <span>${footerDate}</span>
  </div>
</div>
</div>`;
}

function statusBadge(status) {
  const colors = { OK: '#1c7c3c', ATENÇÃO: '#8a5a00', CRÍTICO: '#a2181d' };
  const c = colors[status] || '#5c5854';
  return `<span style="display:inline-block;font-weight:700;font-size:12px;padding:4px 10px;border-radius:100px;background:${c}1a;color:${c};">${status}</span>`;
}

function statRow(label, value) {
  return `<tr><td style="padding:6px 0;color:#5c5854;font-size:13.5px;">${label}</td><td style="padding:6px 0;text-align:right;font-weight:700;color:#201f1f;font-size:13.5px;">${value}</td></tr>`;
}

export function weeklyEmailHtml({ dateStr, status, pagesAnalyzed, summary, deployResult, rollback, highlights, attention }) {
  const body = `
    <p style="margin:0 0 16px;font-size:14px;">Status geral: ${statusBadge(status)}</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;">
      ${statRow('Páginas analisadas', pagesAnalyzed)}
      ${statRow('Problemas encontrados', summary.total)}
      ${statRow('— Crítico', summary.bySeverity[SEVERITY.CRITICAL] || 0)}
      ${statRow('— Alto', summary.bySeverity[SEVERITY.HIGH] || 0)}
      ${statRow('— Médio', summary.bySeverity[SEVERITY.MEDIUM] || 0)}
      ${statRow('— Baixo', summary.bySeverity[SEVERITY.LOW] || 0)}
      ${statRow('Corrigidos automaticamente', summary.fixed)}
      ${statRow('Deploy', deployResult)}
      ${statRow('Rollback', rollback ? 'SIM' : 'NÃO')}
    </table>
    ${highlights.length ? `<div style="font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#e6262c;margin-bottom:8px;">Principais melhorias</div>
    <ul style="margin:0 0 20px;padding-left:18px;font-size:13.5px;color:#3a3733;line-height:1.7;">${highlights.map((h) => `<li>${h}</li>`).join('')}</ul>` : ''}
    ${attention.length ? `<div style="font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#8a5a00;margin-bottom:8px;">Pontos que precisam de atenção</div>
    <ul style="margin:0 0 20px;padding-left:18px;font-size:13.5px;color:#6b4a08;line-height:1.7;">${attention.map((a) => `<li>${a}</li>`).join('')}</ul>` : ''}
    <p style="font-size:13px;color:#5c5854;">Relatório completo em anexo (Markdown).</p>
  `;
  return shell(
    `Relatório Semanal de Auditoria — ${dateStr}`,
    `Site: glctech.com.br · Repositório: glctech/site2.0`,
    body,
    dateStr
  );
}

export function monthlyEmailHtml({ monthStr, weeksCount, totals, timeline, pending }) {
  const body = `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;">
      ${statRow('Auditorias no mês', weeksCount)}
      ${statRow('Páginas analisadas (total)', totals.pagesAnalyzed)}
      ${statRow('Problemas encontrados', totals.found)}
      ${statRow('Problemas corrigidos', totals.fixed)}
      ${statRow('Deploys', totals.deploys)}
      ${statRow('Rollbacks', totals.rollbacks)}
    </table>
    <div style="font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#e6262c;margin-bottom:8px;">Linha do tempo</div>
    <ul style="margin:0 0 20px;padding-left:18px;font-size:13.5px;color:#3a3733;line-height:1.8;">
      ${timeline.map((t) => `<li><b>${t.date}</b> — ${t.summary}</li>`).join('')}
    </ul>
    ${pending.length ? `<div style="font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#8a5a00;margin-bottom:8px;">Problemas pendentes</div>
    <ul style="margin:0 0 20px;padding-left:18px;font-size:13.5px;color:#6b4a08;line-height:1.7;">${pending.map((p) => `<li>${p}</li>`).join('')}</ul>` : ''}
    <p style="font-size:13px;color:#5c5854;">Relatório completo em anexo (Markdown).</p>
  `;
  return shell(
    `Relatório Mensal de Auditoria e Evolução — ${monthStr}`,
    `Site: glctech.com.br · Repositório: glctech/site2.0`,
    body,
    monthStr
  );
}
