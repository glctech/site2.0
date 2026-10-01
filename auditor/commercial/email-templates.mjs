/* Email bodies for the commercial-audit weekly/monthly reports — mesmo
 * padrão visual dos outros 3 relatórios (ver auditor/lib/email-templates.mjs
 * e auditor/lib/report-ui.mjs). */

import { reportShell, sectionHeading, paragraph, dataTable, noteBox, bulletList, groupByCategory, esc } from '../lib/report-ui.mjs';

const SITE = 'glctech.com.br';
const EYEBROW = 'GLCTECH BRASIL · AUDITORIA COMERCIAL E DE CONVERSÃO';

export function weeklyCommercialEmailHtml({ dateStr, pagesAnalyzed, findings, topConversion, criticalCount, recurringCount }) {
  const byCat = groupByCategory(findings);

  const resumo = [
    `Execução semanal de ${dateStr}: ${pagesAnalyzed} página(s) analisada(s), ${findings.length} ponto(s) identificado(s).`,
    criticalCount > 0 ? `${criticalCount} crítico(s).` : 'Nenhum ponto crítico.',
    recurringCount > 0 ? `${recurringCount} reincidente(s) de semanas anteriores.` : 'Nenhuma reincidência.',
  ].join(' ');

  const body = `
    ${sectionHeading('Resumo executivo')}
    ${paragraph(resumo)}

    ${byCat.length ? sectionHeading('Pontos identificados por categoria') + dataTable(
      ['Categoria', 'Quantidade', 'IDs'],
      byCat.map((c) => [esc(c.categoria), String(c.quantidade), esc(c.ids.join(', '))])
    ) : ''}

    ${topConversion.length ? sectionHeading('Top oportunidades de conversão') + bulletList(topConversion.map((f) => `<b>[${esc(f.id)}]</b> ${esc(f.problem)}`)) : ''}

    ${noteBox('Relatório completo em anexo (Markdown) — inclui evidência, impacto, prioridade e sugestão de implementação para cada ponto. Nenhuma alteração foi feita no site: este é um relatório de recomendações, toda mudança precisa da sua aprovação.')}
  `;

  return reportShell({
    eyebrow: EYEBROW,
    title: `Relatório Semanal — Auditoria Comercial e de Conversão`,
    period: `Período: ${dateStr} · ${SITE} · Execução semanal`,
    bodyHtml: body,
    footerText: `Gerado automaticamente pelo Agente de Auditoria Comercial do ${SITE} — glctech/site2.0.`,
  });
}

export function monthlyCommercialEmailHtml({ monthStr, weeksCount, totals, timeline, pending, weeks = [] }) {
  const resumo = [
    `${monthStr}: ${weeksCount} execução(ões) semanal(is) no mês.`,
    `${totals.found} ponto(s) identificado(s) no total, ${totals.recurring} reincidente(s), ${totals.possiblyResolved} possivelmente resolvido(s).`,
    pending.length ? `${pending.length} pendência(s) seguem sem correção ao final do mês.` : 'Nenhuma pendência relevante ao final do mês.',
  ].join(' ');

  const allFindings = weeks.flatMap((w) => w.findings || []);
  const byCat = groupByCategory(allFindings);

  const body = `
    ${sectionHeading('Resumo executivo')}
    ${paragraph(resumo)}

    ${sectionHeading('Total de execuções no mês')}
    ${dataTable(['Data', 'Pontos identificados'], weeks.map((w) => [esc(w.date), String((w.findings || []).length)]))}

    ${byCat.length ? sectionHeading('Pontos por categoria (ao final do mês)') + dataTable(
      ['Categoria', 'Quantidade', 'IDs'],
      byCat.map((c) => [esc(c.categoria), String(c.quantidade), esc(c.ids.join(', '))])
    ) : ''}

    ${sectionHeading('Linha do tempo')}
    ${bulletList(timeline.map((t) => `<b>${esc(t.date)}</b> — ${esc(t.summary)}`))}

    ${pending.length ? sectionHeading('Principais pendências') + bulletList(pending.map(esc)) : ''}

    ${noteBox('Relatório completo em anexo (Markdown).')}
  `;

  return reportShell({
    eyebrow: EYEBROW,
    title: `Relatório Mensal — Auditoria Comercial e de Conversão`,
    period: `Período: ${monthStr} · ${SITE} · Consolidado mensal`,
    bodyHtml: body,
    footerText: `Gerado automaticamente pelo Agente de Auditoria Comercial do ${SITE}, consolidando as execuções semanais do mês.`,
  });
}
