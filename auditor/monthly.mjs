#!/usr/bin/env node
/* ============================================================================
 * auditor/monthly.mjs — consolidates the month's weekly JSON snapshots
 * (reports/_data/YYYY-MM-DD.json) into one Markdown report + email.
 * Read-only with respect to the site itself — this never touches HTML/CSS/JS,
 * only reads history and writes to reports/monthly/.
 * ==========================================================================*/

import { readdir, readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { ROOT } from './lib/scan.mjs';
import { SEVERITY } from './lib/finding.mjs';
import { commitReportFiles } from './lib/git-pr.mjs';
import { sendZohoMailNode } from './lib/smtp-node.mjs';
import { monthlyEmailHtml } from './lib/email-templates.mjs';

const log = (m) => console.log(`[INFO] ${m}`);

const monthArg = process.argv.find((a) => /^\d{4}-\d{2}$/.test(a));
const monthStr = monthArg || new Date().toISOString().slice(0, 7);
const SEND_EMAIL = process.argv.includes('--email');

async function main() {
  log(`Consolidando relatório mensal: ${monthStr}`);
  const dataDir = join(ROOT, 'reports', '_data');
  let files = [];
  try { files = await readdir(dataDir); } catch { /* no data yet */ }
  const monthFiles = files.filter((f) => f.startsWith(monthStr) && f.endsWith('.json')).sort();

  if (monthFiles.length === 0) {
    log('Nenhuma auditoria encontrada para este mês — nada a consolidar.');
    return;
  }

  const weeks = [];
  for (const f of monthFiles) {
    try { weeks.push(JSON.parse(await readFile(join(dataDir, f), 'utf8'))); } catch { /* skip */ }
  }

  const totals = { pagesAnalyzed: 0, found: 0, fixed: 0, deploys: 0, rollbacks: 0 };
  const timeline = [];
  const pendingMap = new Map();

  for (const w of weeks) {
    totals.found += w.summary?.total || 0;
    totals.fixed += w.summary?.fixed || 0;
    if (w.prUrl) totals.deploys += 1;
    if (w.deployResult && /rollback/i.test(w.deployResult)) totals.rollbacks += 1;

    const critHigh = (w.findings || []).filter(
      (f) => (f.severity === SEVERITY.CRITICAL || f.severity === SEVERITY.HIGH) && f.status !== 'corrigido automaticamente'
    );
    timeline.push({
      date: w.date,
      summary: `${w.summary?.total ?? 0} problema(s) encontrados, ${w.summary?.fixed ?? 0} corrigido(s) automaticamente${w.prUrl ? `, PR: ${w.prUrl}` : ''}`,
    });

    for (const f of critHigh) {
      const k = `${f.page}::${f.problem}`;
      pendingMap.set(k, { page: f.page, severity: f.severity, problem: f.problem });
    }
  }

  const pending = [...pendingMap.values()];

  const md = buildMonthlyMarkdown({ monthStr, weeks, totals, timeline, pending });
  const mdDir = join(ROOT, 'reports', 'monthly');
  await mkdir(mdDir, { recursive: true });
  const mdPath = join(mdDir, `${monthStr}.md`);
  await writeFile(mdPath, md, 'utf8');
  log(`Relatório mensal salvo em ${mdPath}`);

  if (process.env.GITHUB_ACTIONS === 'true') {
    const rel = mdPath.slice(ROOT.length).replace(/^\/+/, '');
    await commitReportFiles({ files: [rel], message: `chore(audit): relatório mensal ${monthStr} [skip ci]` });
  }

  if (SEND_EMAIL) {
    const to = process.env.REPORT_EMAIL_TO || 'diretoria@glctech.com.br';
    const html = monthlyEmailHtml({ monthStr, weeksCount: weeks.length, totals, timeline, pending: pending.map((p) => `[${p.severity}] ${p.page} — ${p.problem}`) });
    await sendZohoMailNode({
      to,
      subject: `[GLCTech] Relatório Mensal de Auditoria e Evolução do Site — ${monthStr}`,
      html,
      attachments: [{ filename: `relatorio-mensal-${monthStr}.md`, contentType: 'text/markdown', content: md }],
    });
    log(`Relatório mensal enviado para ${to}`);
  }
}

function buildMonthlyMarkdown({ monthStr, weeks, totals, timeline, pending }) {
  const lines = [];
  lines.push(`# Relatório Mensal de Auditoria — ${monthStr}`);
  lines.push('');
  lines.push(`**Auditorias no mês:** ${weeks.length}`);
  lines.push(`**Páginas analisadas (por auditoria):** ${weeks[0]?.summary ? 'ver histórico' : 'NÃO FOI POSSÍVEL DETERMINAR'}`);
  lines.push(`**Problemas encontrados (total):** ${totals.found}`);
  lines.push(`**Problemas corrigidos (total):** ${totals.fixed}`);
  lines.push(`**Deploys (PRs de correção abertos):** ${totals.deploys}`);
  lines.push(`**Rollbacks:** ${totals.rollbacks}`);
  lines.push('');
  lines.push('## Linha do tempo');
  lines.push('');
  for (const t of timeline) lines.push(`- **${t.date}** — ${t.summary}`);
  lines.push('');
  lines.push('## Problemas pendentes (crítico/alto, não corrigidos)');
  lines.push('');
  if (pending.length === 0) {
    lines.push('Nenhum problema crítico/alto pendente ao final do mês. ✅');
  } else {
    for (const p of pending) lines.push(`- [${p.severity}] **${p.page}** — ${p.problem}`);
  }
  lines.push('');
  return lines.join('\n');
}

main().catch((e) => {
  console.error(`[ERROR] ${e.stack || e}`);
  process.exitCode = 1;
});
