/* ============================================================================
 * report.mjs — builds the weekly Markdown report in the exact section order
 * requested by the spec (§18), plus the JSON sidecar history.mjs reads back.
 * ==========================================================================*/

import { writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { ROOT } from '../lib/scan.mjs';
import { SEVERITY, IMPACT } from './finding.mjs';

const CATEGORIES = ['Conversão', 'SEO', 'Performance', 'UX', 'UI', 'Segurança', 'Acessibilidade', 'Conteúdo', 'Técnico', 'Mobile'];

function statusForCategory(findings, category) {
  const inCat = findings.filter((f) => f.category === category);
  if (inCat.some((f) => f.severity === SEVERITY.CRITICAL)) return '🔴 CRÍTICO';
  if (inCat.some((f) => f.severity === SEVERITY.HIGH)) return '🟠 ALTO';
  if (inCat.some((f) => f.severity === SEVERITY.MEDIUM)) return '🟡 MÉDIO';
  if (inCat.length) return '🟢 BAIXO';
  return '⚪ sem pontos nesta auditoria';
}

function rankScore(f) {
  const sevRank = { [SEVERITY.CRITICAL]: 4, [SEVERITY.HIGH]: 3, [SEVERITY.MEDIUM]: 2, [SEVERITY.LOW]: 1 };
  const impRank = { [IMPACT.VERY_HIGH]: 4, [IMPACT.HIGH]: 3, [IMPACT.MEDIUM]: 2, [IMPACT.LOW]: 1 };
  return (sevRank[f.severity] || 0) * 10 + (impRank[f.impact] || 0);
}

export function buildWeeklyMarkdown({
  periodStart, periodEnd, findings, pagesAnalyzed, filesAnalyzed, possiblyResolved,
  manualReviewNote, partial, errors,
}) {
  const lines = [];
  lines.push('## RELATÓRIO SEMANAL — AUDITORIA GLCTECH');
  lines.push('');
  lines.push(`### Período`);
  lines.push(`${periodStart} → ${periodEnd}`);
  lines.push('');

  lines.push('### Resumo executivo');
  const critical = findings.filter((f) => f.severity === SEVERITY.CRITICAL);
  const convOpportunities = findings.filter((f) => f.category === 'Conversão');
  lines.push(
    `${pagesAnalyzed} páginas analisadas, ${findings.length} ponto(s) identificado(s) (${critical.length} crítico(s)), ` +
    `${convOpportunities.length} relacionado(s) diretamente a conversão/geração de leads. ` +
    `${partial ? 'ATENÇÃO: esta auditoria foi PARCIALMENTE concluída — ver seção de erros abaixo.' : 'Auditoria concluída integralmente.'}`
  );
  lines.push('');

  lines.push('### Status geral');
  lines.push('');
  lines.push('| Categoria | Status |');
  lines.push('|---|---|');
  for (const cat of CATEGORIES) lines.push(`| ${cat} | ${statusForCategory(findings, cat)} |`);
  lines.push('');

  lines.push('### Principais descobertas');
  lines.push('');
  const top = [...findings].sort((a, b) => rankScore(b) - rankScore(a)).slice(0, 8);
  if (top.length === 0) lines.push('Nenhum ponto relevante identificado nesta auditoria.');
  else for (const f of top) lines.push(`- **[${f.id}]** (${f.category}, ${f.severity}/${f.impact}) — ${f.problem}`);
  lines.push('');

  lines.push('### Top 5 oportunidades de conversão');
  lines.push('');
  const topConv = [...convOpportunities].sort((a, b) => rankScore(b) - rankScore(a)).slice(0, 5);
  if (topConv.length === 0) lines.push('Nenhuma oportunidade de conversão identificada nesta auditoria.');
  else for (const f of topConv) lines.push(`- **[${f.id}]** ${f.problem} _(impacto: ${f.impact}, esforço: ${f.effort}, evidência: ${f.evidence})_`);
  lines.push('');

  if (critical.length) {
    lines.push('### Problemas críticos');
    lines.push('');
    for (const f of critical) lines.push(`- **[${f.id}]** ${f.page} — ${f.problem}`);
    lines.push('');
  }

  lines.push('### Recomendações');
  lines.push('');
  if (findings.length === 0) {
    lines.push('Nenhuma recomendação nesta auditoria.');
  } else {
    lines.push('| ID | Categoria | Problema | Impacto | Prioridade | Esforço |');
    lines.push('|---|---|---|---|---|---|');
    for (const f of findings) {
      lines.push(`| ${f.id} | ${f.category} | ${escapeCell(f.problem)} | ${f.impact} | ${f.severity} | ${f.effort} |`);
    }
  }
  lines.push('');

  lines.push('### Detalhamento');
  lines.push('');
  for (const f of findings) {
    lines.push(`#### ${f.id} — ${f.problem}`);
    lines.push(`- **Página:** ${f.page}`);
    lines.push(`- **Evidência (${f.evidence}):** ${f.evidenceText}`);
    lines.push(`- **Impacto:** ${f.impactText}`);
    lines.push(`- **Prioridade:** ${f.severity} / impacto comercial ${f.impact} / esforço ${f.effort}`);
    if (f.recommendation) lines.push(`- **Recomendação:** ${f.recommendation}`);
    if (f.implementation) lines.push(`- **Implementação sugerida:** ${f.implementation}`);
    lines.push(`- **Risco da alteração:** ${f.risk}`);
    lines.push(`- **Necessita aprovação humana:** SIM`);
    lines.push(`- **Status:** ${f.status}`);
    lines.push('');
  }

  lines.push('### Itens pendentes de auditorias anteriores');
  lines.push('');
  const recurring = findings.filter((f) => f.status === 'PENDENTE — REINCIDENTE');
  if (recurring.length === 0) lines.push('Nenhum item reincidente nesta auditoria.');
  else for (const f of recurring) lines.push(`- **[${f.id}]** ${f.page} — ${f.problem}`);
  lines.push('');

  if (possiblyResolved && possiblyResolved.length) {
    lines.push('### Possivelmente resolvidos (confirmar)');
    lines.push('');
    lines.push('_Estes pontos apareciam na auditoria anterior e não foram detectados nesta — o agente não afirma que foram corrigidos sem evidência de commit; confirme manualmente:_');
    lines.push('');
    for (const f of possiblyResolved) lines.push(`- **[${f.id}]** ${f.page} — ${f.problem}`);
    lines.push('');
  }

  if (manualReviewNote) {
    lines.push('### Nota sobre a camada qualitativa (proposta de valor, tom, jornada)');
    lines.push('');
    lines.push(manualReviewNote);
    lines.push('');
  }

  if (partial || (errors && errors.length)) {
    lines.push('### Erros durante a auditoria');
    lines.push('');
    lines.push(partial ? '**Esta auditoria foi marcada como PARCIALMENTE concluída.**' : '');
    for (const e of errors || []) lines.push(`- ${e}`);
    lines.push('');
  }

  return lines.join('\n');
}

function escapeCell(s) {
  return String(s).replace(/\|/g, '\\|');
}

export async function writeWeeklyCommercialReport({ dateStr, markdown, json }) {
  const mdDir = join(ROOT, 'reports', 'commercial', 'weekly');
  const dataDir = join(ROOT, 'reports', 'commercial', '_data');
  await mkdir(mdDir, { recursive: true });
  await mkdir(dataDir, { recursive: true });
  const mdPath = join(mdDir, `${dateStr}.md`);
  const jsonPath = join(dataDir, `${dateStr}.json`);
  await writeFile(mdPath, markdown, 'utf8');
  await writeFile(jsonPath, JSON.stringify(json, null, 2), 'utf8');
  return { mdPath, jsonPath };
}
