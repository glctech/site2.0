#!/usr/bin/env node
/* ============================================================================
 * auditor/commercial/audit.mjs — commercial/conversion/UX audit orchestrator.
 *
 * REGRA FUNDAMENTAL (see AUDIT-COMERCIAL.md): this script NEVER writes to
 * the site, NEVER touches git except reading history (git log, read-only),
 * NEVER opens a PR, NEVER runs a fixer. Its only outputs are a report file
 * under reports/commercial/ and an email. There is no DRY_RUN flag here
 * because there is nothing to gate — every run of this script behaves the
 * same way: read, analyze, report.
 *
 *   node auditor/commercial/audit.mjs            → audit + write report
 *   node auditor/commercial/audit.mjs --email     → also email the report
 *   node auditor/commercial/audit.mjs --skip-browser --skip-external-links
 * ==========================================================================*/

import { discoverPages, readPage, ROOT } from '../lib/scan.mjs';
import { checkHtmlSeoA11y } from '../lib/check-html-seo-a11y.mjs';
import { checkSecurity } from '../lib/check-security.mjs';
import { checkPerformanceStatic, checkPerformanceAssets } from '../lib/check-performance.mjs';
import { checkLinks } from '../lib/check-links.mjs';
import { checkBrowser } from '../lib/check-browser.mjs';
import { startStaticServer } from '../lib/server.mjs';
import { checkConversion, checkConversionSiteWide } from './check-conversion.mjs';
import { finding, resetCounter, SEVERITY, IMPACT, EFFORT, EVIDENCE, RISK } from './finding.mjs';
import { loadAllSnapshots, reconcileWithHistory } from './history.mjs';
import { buildWeeklyMarkdown, writeWeeklyCommercialReport } from './report.mjs';
import { sendZohoMailNode } from '../lib/smtp-node.mjs';
import { weeklyCommercialEmailHtml } from './email-templates.mjs';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

const args = process.argv.slice(2);
const flag = (name) => args.includes(`--${name}`);
const SEND_EMAIL = flag('email');
const SKIP_BROWSER = flag('skip-browser') || process.env.SKIP_BROWSER === 'true';
const SKIP_EXTERNAL_LINKS = flag('skip-external-links') || process.env.SKIP_EXTERNAL_LINKS === 'true';

const log = (m) => console.log(`[INFO] ${m}`);
const err = (m) => console.error(`[ERROR] ${m}`);

// Maps the technical agent's category/severity vocabulary onto this agent's
// commercial-audit vocabulary (§13). Every technical finding is CONFIRMADO
// evidence tier — it comes from direct code/DOM inspection, not inference.
const CATEGORY_MAP = {
  html: 'Técnico', seo: 'SEO', accessibility: 'Acessibilidade', security: 'Segurança',
  performance: 'Performance', links: 'Técnico', javascript: 'Técnico', ux: 'UX',
};
function inferCommercialImpact(category, severity) {
  if (severity === SEVERITY.CRITICAL) return IMPACT.VERY_HIGH;
  if (category === 'seo' || category === 'security') return IMPACT.HIGH;
  if (severity === SEVERITY.HIGH) return IMPACT.HIGH;
  if (severity === SEVERITY.MEDIUM) return IMPACT.MEDIUM;
  return IMPACT.LOW;
}
function adaptTechnicalFinding(f) {
  return finding({
    category: CATEGORY_MAP[f.category] || 'Técnico',
    severity: f.severity,
    impact: inferCommercialImpact(f.category, f.severity),
    effort: EFFORT.LOW,
    evidence: EVIDENCE.CONFIRMED,
    page: f.page,
    problem: f.problem,
    evidenceText: f.line ? `${f.page}:${f.line}` : f.page,
    impactText: f.cause,
    recommendation: f.recommendation,
    risk: RISK.LOW,
  });
}

async function main() {
  const startedAt = Date.now();
  const errors = [];
  log('AUDIT START (comercial/conversão)');
  resetCounter();

  const pages = await discoverPages();
  log(`Pages analyzed: ${pages.length}`);

  let server;
  const { server: srv, baseUrl } = await startStaticServer();
  server = srv;
  log(`Servidor local: ${baseUrl}`);

  try {
    const findings = [];
    const pageData = new Map();
    const pagesHtmlForSiteWide = [];

    for (const p of pages) {
      try {
        const data = await readPage(p.file);
        pageData.set(p.file, data);
        pagesHtmlForSiteWide.push([p.file, data.domHtml]);

        for (const raw of checkHtmlSeoA11y(data)) findings.push(adaptTechnicalFinding(raw));
        for (const raw of checkPerformanceStatic(data)) findings.push(adaptTechnicalFinding(raw));
        for (const raw of await checkPerformanceAssets(data)) findings.push(adaptTechnicalFinding(raw));
        for (const raw of await checkLinks(data, { checkExternal: !SKIP_EXTERNAL_LINKS })) findings.push(adaptTechnicalFinding(raw));
        for (const raw of checkConversion(data)) findings.push(raw);
      } catch (e) {
        errors.push(`Falha ao analisar ${p.file}: ${e.message}`);
        err(`Falha ao analisar ${p.file}: ${e.stack || e}`);
      }
    }

    try {
      for (const raw of await checkSecurity()) findings.push(adaptTechnicalFinding(raw));
    } catch (e) {
      errors.push(`Falha na auditoria de segurança: ${e.message}`);
      err(e.stack || e);
    }

    try {
      for (const raw of checkConversionSiteWide(pagesHtmlForSiteWide)) findings.push(raw);
    } catch (e) {
      errors.push(`Falha na checagem de conversão site-wide: ${e.message}`);
      err(e.stack || e);
    }

    if (!SKIP_BROWSER) {
      try {
        log('Checagens de navegador (console, overflow)');
        const { findings: browserFindings } = await checkBrowser(pages, baseUrl, {});
        for (const raw of browserFindings) findings.push(adaptTechnicalFinding(raw));
      } catch (e) {
        errors.push(`Falha nas checagens de navegador: ${e.message}`);
        err(e.stack || e);
      }
    }

    log(`Issues found: ${findings.length}`);

    const pastSnapshots = await loadAllSnapshots();
    const { possiblyResolved } = reconcileWithHistory(findings, pastSnapshots);

    const dateStr = new Date().toISOString().slice(0, 10);
    const periodStart = pastSnapshots.length ? pastSnapshots[pastSnapshots.length - 1].date : dateStr;
    const partial = errors.length > 0;

    const md = buildWeeklyMarkdown({
      periodStart, periodEnd: dateStr, findings, pagesAnalyzed: pages.length,
      filesAnalyzed: pages.length, possiblyResolved,
      manualReviewNote: buildManualReviewNote(pastSnapshots.length),
      partial, errors,
    });

    const { mdPath, jsonPath } = await writeWeeklyCommercialReport({
      dateStr, markdown: md,
      json: { date: dateStr, findings, pagesAnalyzed: pages.length, partial, errors },
    });
    log(`Relatório salvo em ${mdPath}`);

    if (process.env.GITHUB_ACTIONS === 'true') {
      const { commitReportFiles } = await import('../lib/git-pr.mjs');
      const relMd = mdPath.slice(ROOT.length).replace(/^\/+/, '');
      const relJson = jsonPath.slice(ROOT.length).replace(/^\/+/, '');
      // Commits ONLY the report itself (pure historical record, never served
      // by the Worker — see .assetsignore). This script never touches any
      // site file, so there is nothing else `git status` could show here.
      const { committed } = await commitReportFiles({ files: [relMd, relJson], message: `chore(audit-comercial): relatório semanal ${dateStr} [skip ci]` });
      if (committed) log('Relatório commitado no histórico (reports/commercial/).');
    }

    if (SEND_EMAIL) {
      await sendEmail({ dateStr, findings, pagesAnalyzed: pages.length, mdPath });
    }

    log(`Recommendations: ${findings.length}`);
    log(`Critical issues: ${findings.filter((f) => f.severity === SEVERITY.CRITICAL).length}`);
    log(`Email status: ${SEND_EMAIL ? 'enviado' : 'não solicitado (--email não passado)'}`);
    log(`Duration: ${((Date.now() - startedAt) / 1000).toFixed(1)}s`);
    log(partial ? 'AUDIT END — PARCIALMENTE CONCLUÍDA (ver erros no relatório)' : 'AUDIT END — SUCCESS');
    process.exitCode = partial ? 1 : 0;
  } finally {
    if (server) await server.close?.();
  }
}

function buildManualReviewNote(pastAuditCount) {
  const firstRunNote = pastAuditCount === 0
    ? ' A primeira auditoria (esta) recebeu uma revisão qualitativa manual como ponto de partida — ver `reports/commercial/weekly/` para o relatório mais antigo.'
    : '';
  return (
    'Este agente automático analisa evidências objetivas de código (CTAs presentes, tamanho de formulário, ' +
    'links quebrados, SEO técnico, performance, acessibilidade, consistência de contatos). Ele **não** lê o ' +
    'site como um humano leria para avaliar tom de voz, clareza da proposta de valor ou confiança transmitida ' +
    '— isso exige julgamento qualitativo que um script Node não tem. Revisitar essa camada qualitativa ' +
    'periodicamente é uma tarefa humana (ou de uma sessão do Claude lendo o site), não algo que esta automação ' +
    'semanal repete sozinha.' + firstRunNote
  );
}

async function sendEmail({ dateStr, findings, pagesAnalyzed, mdPath }) {
  const to = process.env.REPORT_EMAIL_TO || 'diretoria@glctech.com.br';
  const criticalCount = findings.filter((f) => f.severity === SEVERITY.CRITICAL).length;
  const recurringCount = findings.filter((f) => f.status === 'PENDENTE — REINCIDENTE').length;
  const topConversion = findings.filter((f) => f.category === 'Conversão').slice(0, 5);

  const html = weeklyCommercialEmailHtml({ dateStr, pagesAnalyzed, findings, topConversion, criticalCount, recurringCount });
  log(`Enviando relatório por e-mail para ${to}`);
  const mdContent = await readFile(mdPath, 'utf8');
  await sendZohoMailNode({
    to,
    subject: `[GLCTECH] Relatório Semanal — Auditoria do Site — ${dateStr}`,
    html,
    attachments: [{ filename: `auditoria-comercial-${dateStr}.md`, contentType: 'text/markdown', content: mdContent }],
  });
  log('Relatório enviado');
}

main().catch((e) => {
  err(e.stack || String(e));
  process.exitCode = 1;
});
