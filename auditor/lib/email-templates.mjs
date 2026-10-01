/* Email bodies for the weekly/monthly technical audit reports — mesmo padrão
 * visual usado nos 4 relatórios de auditoria (semanal/mensal × técnico/
 * comercial) e espelhado do agente equivalente em glctechsec.com, para os
 * dois sites ficarem padronizados. */

import { SEVERITY } from './finding.mjs';
import { reportShell, sectionHeading, paragraph, dataTable, noteBox, bulletList, groupByCategory, esc } from './report-ui.mjs';

const SITE = 'glctech.com.br';
const EYEBROW = 'GLCTECH BRASIL · AGENTE DE AUDITORIA CONTÍNUA';

export function weeklyEmailHtml({ dateStr, status, pagesAnalyzed, summary, deployResult, rollback, highlights, attention, findings = [] }) {
  const crit = summary.bySeverity[SEVERITY.CRITICAL] || 0;
  const high = summary.bySeverity[SEVERITY.HIGH] || 0;

  const resumo = [
    `Execução semanal de ${dateStr}: ${pagesAnalyzed} página(s) analisada(s), ${summary.total} problema(s) encontrado(s) e ${summary.fixed} corrigido(s) automaticamente.`,
    crit > 0 ? `${crit} achado(s) crítico(s) seguem pendentes.` : (high > 0 ? `${high} achado(s) de severidade alta seguem pendentes.` : 'Nenhum achado crítico ou alto pendente ao final da execução.'),
    `Deploy: ${deployResult}${rollback ? ' — ROLLBACK acionado.' : '.'}`,
  ].join(' ');

  const byCat = groupByCategory(findings);

  const body = `
    ${sectionHeading('Resumo executivo')}
    ${paragraph(resumo)}

    ${byCat.length ? sectionHeading('Achados da semana por categoria') + dataTable(
      ['Categoria', 'Quantidade', 'IDs'],
      byCat.map((c) => [esc(c.categoria), String(c.quantidade), esc(c.ids.join(', '))])
    ) : ''}

    ${highlights.length ? sectionHeading('Principais melhorias') + bulletList(highlights.map(esc)) : ''}
    ${attention.length ? sectionHeading('Pontos que precisam de atenção') + bulletList(attention.map(esc)) : ''}

    ${noteBox('Relatório completo em anexo (Markdown), com evidência e causa de cada achado.')}
  `;

  return reportShell({
    eyebrow: EYEBROW,
    title: `Relatório Semanal — Auditoria e Evolução do Site`,
    period: `Período: ${dateStr} · ${SITE} · Execução semanal`,
    bodyHtml: body,
    footerText: `Gerado automaticamente pelo Agente de Auditoria do ${SITE} — glctech/site2.0.`,
  });
}

export function monthlyEmailHtml({ monthStr, weeksCount, totals, timeline, pending, weeks = [] }) {
  const resumo = [
    `${monthStr}: ${weeksCount} execução(ões) semanal(is) no mês, cobrindo ${totals.pagesAnalyzed || 'N/D'} análise(s) de página.`,
    `${totals.found} problema(s) encontrado(s) no total, ${totals.fixed} corrigido(s) automaticamente.`,
    pending.length ? `${pending.length} problema(s) crítico(s)/alto(s) seguem pendentes ao final do mês.` : 'Nenhum problema crítico/alto pendente ao final do mês.',
    `${totals.deploys} deploy(s) de correção, ${totals.rollbacks} rollback(s).`,
  ].join(' ');

  const allFindings = weeks.flatMap((w) => w.findings || []);
  const byCat = groupByCategory(allFindings.filter((f) => f.status !== 'corrigido automaticamente'));

  const execRows = weeks.map((w) => [
    esc(w.date),
    String(w.summary?.total ?? 0),
    String(w.summary?.fixed ?? 0),
    esc(w.deployResult || '—'),
  ]);

  const body = `
    ${sectionHeading('Resumo executivo')}
    ${paragraph(resumo)}

    ${sectionHeading('Total de execuções no mês')}
    ${dataTable(['Data', 'Achados', 'Corrigidos', 'Deploy'], execRows)}

    ${byCat.length ? sectionHeading('Achados por categoria (ao final do mês)') + dataTable(
      ['Categoria', 'Quantidade', 'IDs'],
      byCat.map((c) => [esc(c.categoria), String(c.quantidade), esc(c.ids.join(', '))])
    ) : ''}

    ${sectionHeading('Linha do tempo')}
    ${bulletList(timeline.map((t) => `<b>${esc(t.date)}</b> — ${esc(t.summary)}`))}

    ${pending.length ? sectionHeading('Problemas pendentes') + bulletList(pending.map(esc)) : ''}

    ${noteBox('Relatório completo em anexo (Markdown).')}
  `;

  return reportShell({
    eyebrow: EYEBROW,
    title: `Relatório Mensal — Auditoria e Evolução do Site`,
    period: `Período: ${monthStr} · ${SITE} · Consolidado mensal`,
    bodyHtml: body,
    footerText: `Gerado automaticamente pelo Agente de Auditoria do ${SITE}, consolidando as execuções semanais do mês.`,
  });
}
