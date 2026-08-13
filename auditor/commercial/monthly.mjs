#!/usr/bin/env node
/* auditor/commercial/monthly.mjs — consolidates the month's weekly commercial
 * snapshots into one report + email. Read-only, same as audit.mjs. */

import { readdir, readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { ROOT } from '../lib/scan.mjs';
import { SEVERITY } from './finding.mjs';
import { monthlyCommercialEmailHtml } from './email-templates.mjs';
import { sendZohoMailNode } from '../lib/smtp-node.mjs';

const log = (m) => console.log(`[INFO] ${m}`);

const monthArg = process.argv.find((a) => /^\d{4}-\d{2}$/.test(a));
const monthStr = monthArg || new Date().toISOString().slice(0, 7);
const SEND_EMAIL = process.argv.includes('--email');

async function main() {
  log(`Consolidando relatório mensal comercial: ${monthStr}`);
  const dataDir = join(ROOT, 'reports', 'commercial', '_data');
  let files = [];
  try { files = await readdir(dataDir); } catch { /* none yet */ }
  const monthFiles = files.filter((f) => f.startsWith(monthStr) && f.endsWith('.json')).sort();

  if (monthFiles.length === 0) {
    log('Nenhuma auditoria comercial encontrada para este mês — nada a consolidar.');
    return;
  }

  const weeks = [];
  for (const f of monthFiles) {
    try { weeks.push(JSON.parse(await readFile(join(dataDir, f), 'utf8'))); } catch { /* skip */ }
  }

  const totals = { found: 0, recurring: 0, possiblyResolved: 0 };
  const timeline = [];
  const recurringMap = new Map();

  for (const w of weeks) {
    const findings = w.findings || [];
    totals.found += findings.length;
    const recurring = findings.filter((f) => f.status === 'PENDENTE — REINCIDENTE');
    totals.recurring += recurring.length;
    const critical = findings.filter((f) => f.severity === SEVERITY.CRITICAL);
    timeline.push({ date: w.date, summary: `${findings.length} ponto(s) identificado(s), ${critical.length} crítico(s)${w.partial ? ' (auditoria parcial)' : ''}` });
    for (const f of recurring) recurringMap.set(`${f.page}::${f.problem}`, f);
  }

  const pending = [...recurringMap.values()].slice(0, 15).map((f) => `[${f.severity}] ${f.page} — ${f.problem}`);

  const md = buildMonthlyMarkdown({ monthStr, weeks, totals, timeline, pending: [...recurringMap.values()] });
  const mdDir = join(ROOT, 'reports', 'commercial', 'monthly');
  await mkdir(mdDir, { recursive: true });
  const mdPath = join(mdDir, `${monthStr}.md`);
  await writeFile(mdPath, md, 'utf8');
  log(`Relatório mensal comercial salvo em ${mdPath}`);

  if (process.env.GITHUB_ACTIONS === 'true') {
    const { commitReportFiles } = await import('../lib/git-pr.mjs');
    const rel = mdPath.slice(ROOT.length).replace(/^\/+/, '');
    await commitReportFiles({ files: [rel], message: `chore(audit-comercial): relatório mensal ${monthStr} [skip ci]` });
  }

  if (SEND_EMAIL) {
    const to = process.env.REPORT_EMAIL_TO || 'diretoria@glctech.com.br';
    const html = monthlyCommercialEmailHtml({ monthStr, weeksCount: weeks.length, totals, timeline, pending });
    await sendZohoMailNode({
      to,
      subject: `[GLCTECH] Relatório Mensal — Auditoria e Evolução do Site — ${monthStr}`,
      html,
      attachments: [{ filename: `auditoria-comercial-mensal-${monthStr}.md`, contentType: 'text/markdown', content: md }],
    });
    log(`Relatório mensal comercial enviado para ${to}`);
  }
}

function buildMonthlyMarkdown({ monthStr, weeks, totals, timeline, pending }) {
  const lines = [];
  lines.push(`# RELATÓRIO MENSAL — AUDITORIA E EVOLUÇÃO DO SITE GLCTECH — ${monthStr}`);
  lines.push('');
  lines.push('## 1. Resumo executivo');
  lines.push(`${weeks.length} auditoria(s) no mês, ${totals.found} ponto(s) identificado(s) no total, ${totals.recurring} reincidente(s).`);
  lines.push('');
  lines.push('## 2. Total de auditorias realizadas');
  lines.push(String(weeks.length));
  lines.push('');
  lines.push('## 3. Problemas encontrados (por categoria)');
  const byCat = {};
  for (const w of weeks) for (const f of (w.findings || [])) byCat[f.category] = (byCat[f.category] || 0) + 1;
  for (const [cat, n] of Object.entries(byCat)) lines.push(`- ${cat}: ${n}`);
  lines.push('');
  lines.push('## 4–6. Recomendações geradas / resolvidas / pendentes');
  lines.push(`Geradas: ${totals.found} · Reincidentes (ainda pendentes): ${totals.recurring} · Possivelmente resolvidas (não confirmadas por evidência de commit): ${totals.possiblyResolved}`);
  lines.push('');
  lines.push('## 7. Problemas reincidentes');
  if (pending.length === 0) lines.push('Nenhum problema reincidente neste mês. ✅');
  else for (const f of pending) lines.push(`- [${f.severity}] **${f.page}** — ${f.problem}`);
  lines.push('');
  lines.push('## 8–12. Evolução (site / SEO / performance / UX / conversão)');
  lines.push('Não mensurado numericamente — este agente não coleta métricas de tráfego/conversão reais (Google Analytics etc. não estão integrados a esta auditoria). Ver linha do tempo abaixo para evolução qualitativa do número de pontos por auditoria.');
  lines.push('');
  lines.push('## 13. Linha do tempo');
  for (const t of timeline) lines.push(`- **${t.date}** — ${t.summary}`);
  lines.push('');
  lines.push('## 14. Ranking das prioridades para o próximo mês');
  const ranked = [...pending].sort((a, b) => (a.severity === SEVERITY.CRITICAL ? -1 : 1)).slice(0, 5);
  if (ranked.length === 0) lines.push('Nenhuma pendência crítica/reincidente para priorizar.');
  else for (const f of ranked) lines.push(`- [${f.severity}] ${f.page} — ${f.problem}`);
  lines.push('');
  lines.push('## 15. Histórico de alterações detectadas no projeto');
  lines.push('NÃO FOI POSSÍVEL DETERMINAR automaticamente neste relatório — este agente não versiona nem observa commits de outros agentes/humanos de forma consolidada mensal ainda. Consulte o histórico do Git diretamente para o mês.');
  lines.push('');
  return lines.join('\n');
}

main().catch((e) => {
  console.error(`[ERROR] ${e.stack || e}`);
  process.exitCode = 1;
});
