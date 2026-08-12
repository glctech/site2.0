#!/usr/bin/env node
/* ============================================================================
 * auditor/run.mjs — main orchestrator.
 *
 *   node auditor/run.mjs audit   → scan + analyze + report. NEVER writes to
 *                                   the site, NEVER touches git. Safe to run
 *                                   anytime, any number of times.
 *   node auditor/run.mjs fix     → audit + apply the narrow safe-fix
 *                                   allowlist LOCALLY (writes files) + re-test.
 *                                   Does not commit/push/PR/email.
 *   node auditor/run.mjs full    → fix + regression-test + (if safe) commit
 *                                   on a new branch + open a PR + email the
 *                                   weekly report. This is what CI runs.
 *
 * DRY_RUN=true (default) forces "audit" behaviour regardless of the mode
 * passed in — see AUDITORIA.md §"Modo Dry Run". Pass DRY_RUN=false to allow
 * fix/full to actually write anything.
 * ==========================================================================*/

import { discoverPages, readPage, ROOT } from './lib/scan.mjs';
import { checkHtmlSeoA11y } from './lib/check-html-seo-a11y.mjs';
import { checkSecurity } from './lib/check-security.mjs';
import { checkPerformanceStatic, checkPerformanceAssets } from './lib/check-performance.mjs';
import { checkLinks } from './lib/check-links.mjs';
import { checkBrowser } from './lib/check-browser.mjs';
import { startStaticServer } from './lib/server.mjs';
import { applyFixes } from './lib/fixer.mjs';
import { buildMarkdownReport, writeWeeklyReport, summarize } from './lib/report.mjs';
import { loadPastSnapshots, findRecurring } from './lib/compare.mjs';
import { resetCounter, SEVERITY } from './lib/finding.mjs';
import { gitStatusPorcelain, commitOnNewBranch, openPullRequest, commitReportFiles } from './lib/git-pr.mjs';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileP = promisify(execFile);
async function gitCheckout(branch) {
  await execFileP('git', ['checkout', branch], { cwd: ROOT });
}
import { sendZohoMailNode } from './lib/smtp-node.mjs';
import { weeklyEmailHtml } from './lib/email-templates.mjs';
import { writeFile, readFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';

const args = process.argv.slice(2);
const mode = args.find((a) => !a.startsWith('--')) || 'audit';
const flag = (name) => args.includes(`--${name}`);
const opt = (name) => {
  const pre = `--${name}=`;
  const found = args.find((a) => a.startsWith(pre));
  return found ? found.slice(pre.length) : undefined;
};

const DRY_RUN = process.env.DRY_RUN !== 'false';
const SKIP_BROWSER = flag('skip-browser') || process.env.SKIP_BROWSER === 'true';
const SKIP_EXTERNAL_LINKS = flag('skip-external-links') || process.env.SKIP_EXTERNAL_LINKS === 'true';
const SEND_EMAIL = flag('email');
const BASE_URL_OVERRIDE = opt('base-url');

const REPO = process.env.GITHUB_REPOSITORY || 'glctech/site2.0';
const [OWNER, REPO_NAME] = REPO.split('/');
const BASE_BRANCH = process.env.AUDIT_BASE_BRANCH || 'glctech2.0';

const log = (msg) => console.log(`[INFO] ${msg}`);
const err = (msg) => console.error(`[ERROR] ${msg}`);

async function main() {
  const startedAt = Date.now();
  log('Iniciando auditoria');
  resetCounter();

  const pages = await discoverPages();
  log(`Páginas encontradas: ${pages.length}`);

  let server;
  let baseUrl = BASE_URL_OVERRIDE;
  if (!baseUrl) {
    ({ server, baseUrl } = await startStaticServer());
    log(`Servidor local: ${baseUrl}`);
  }

  try {
    const findings = [];

    log('Iniciando análise HTML/SEO/acessibilidade');
    const pageData = new Map();
    for (const p of pages) {
      const data = await readPage(p.file);
      pageData.set(p.file, data);
      findings.push(...checkHtmlSeoA11y(data));
      findings.push(...checkPerformanceStatic(data));
      findings.push(...(await checkPerformanceAssets(data)));
      findings.push(...(await checkLinks(data, { checkExternal: !SKIP_EXTERNAL_LINKS })));
    }

    log('Iniciando auditoria de segurança');
    findings.push(...(await checkSecurity()));

    let screenshots = [];
    if (!SKIP_BROWSER) {
      log('Iniciando checagens de navegador (console, overflow, screenshots)');
      const { findings: browserFindings, screenshots: shots } = await checkBrowser(pages, baseUrl, {
        screenshotDir: join(ROOT, 'reports', '_data', 'screenshots', dateStr()),
      });
      findings.push(...browserFindings);
      screenshots = shots;
    } else {
      log('Checagens de navegador puladas (--skip-browser)');
    }

    log(`Problemas encontrados: ${findings.length}`);
    const autoFixableCount = findings.filter((f) => f.autoFixable).length;
    log(`Problemas corrigíveis automaticamente: ${autoFixableCount}`);

    const willFix = (mode === 'fix' || mode === 'full') && !DRY_RUN;
    let fixesApplied = [];
    let regressionOk = true;
    let regressionNotes = 'NÃO FOI POSSÍVEL DETERMINAR';

    if (willFix && autoFixableCount > 0) {
      log('Aplicando correções seguras');
      const changedFiles = [];
      for (const p of pages) {
        const data = pageData.get(p.file);
        const pageFindings = findings.filter((f) => f.page === p.file);
        const { html: fixedHtml, applied } = applyFixes(data.html, pageFindings);
        if (applied.length) {
          await writeFile(data.full, fixedHtml, 'utf8');
          pageData.set(p.file, { ...data, html: fixedHtml });
          fixesApplied.push(...applied.map((a) => ({ ...a, page: p.file })));
          changedFiles.push(p.file);
        }
      }

      if (changedFiles.length) {
        log(`Arquivos alterados: ${changedFiles.join(', ')}`);
        log('Testes de regressão iniciados (re-checagem pós-correção)');
        const regressionFindings = [];
        for (const file of changedFiles) {
          const data = pageData.get(file);
          regressionFindings.push(...checkHtmlSeoA11y(data));
        }
        const newCritical = regressionFindings.filter(
          (f) => (f.severity === SEVERITY.CRITICAL || f.severity === SEVERITY.HIGH) && f.category !== 'links'
        );
        if (!SKIP_BROWSER) {
          const changedPages = pages.filter((p) => changedFiles.includes(p.file));
          const { findings: postFixBrowser } = await checkBrowser(changedPages, baseUrl, {});
          const newBrowserIssues = postFixBrowser.filter((f) => f.category === 'javascript' || f.severity === SEVERITY.CRITICAL);
          newCritical.push(...newBrowserIssues);
        }
        if (newCritical.length) {
          regressionOk = false;
          regressionNotes = `FALHOU — ${newCritical.length} problema(s) crítico/alto surgiu(ram) após a correção. Alterações revertidas em memória (arquivos NÃO commitados).`;
          err(regressionNotes);
          // Roll back the in-memory + on-disk changes for safety.
          for (const file of changedFiles) {
            const original = await readOriginal(file, pages);
            await writeFile(join(ROOT, file), original, 'utf8');
          }
          fixesApplied = [];
        } else {
          regressionOk = true;
          regressionNotes = `OK — ${changedFiles.length} página(s) alterada(s), re-checagem não encontrou novos problemas críticos/altos.`;
          log('Testes de regressão concluídos: OK');
        }
      }
    } else if (autoFixableCount > 0) {
      log('DRY_RUN ativo (ou modo "audit") — correções NÃO aplicadas, apenas reportadas.');
    }

    const past = await loadPastSnapshots();
    const recurring = findRecurring(findings, past);

    let deployResult = 'NÃO EXECUTADO (dry-run, modo audit, ou nenhuma alteração)';
    let branchName = null;
    let prUrl = null;
    if (mode === 'full' && !DRY_RUN && fixesApplied.length) {
      const status = await gitStatusPorcelain();
      if (status) {
        branchName = `audit/${dateStr()}-${Date.now()}`;
        log(`Commitando correções em ${branchName}`);
        const changedFiles = [...new Set(fixesApplied.map((f) => f.page))];
        const commitMsg = buildCommitMessage(fixesApplied);
        const result = await commitOnNewBranch({
          branchBase: BASE_BRANCH,
          branchName,
          files: changedFiles,
          message: commitMsg,
        });
        if (result.committed) {
          log('Push concluído, abrindo Pull Request');
          const pr = await openPullRequest({
            owner: OWNER,
            repo: REPO_NAME,
            head: branchName,
            base: BASE_BRANCH,
            title: `chore(audit): correções automáticas — ${dateStr()}`,
            body: buildPrBody(fixesApplied, findings),
            draft: true,
          });
          prUrl = pr.html_url;
          deployResult = `PR aberto (aguardando revisão humana): ${prUrl}`;
          log(deployResult);
        } else {
          deployResult = 'Nenhuma mudança para commitar (git status limpo).';
        }
      }
    }

    // Switch back to the base branch before writing the report, so it lands
    // in the branch's own history rather than the (still-unmerged) fix
    // branch — reports/ is pure data (see git-pr.mjs commitReportFiles).
    if (branchName && process.env.GITHUB_ACTIONS === 'true') {
      await gitCheckout(BASE_BRANCH);
    }

    const s = summarize(findings);
    const md = buildMarkdownReport({
      date: new Date().toISOString(),
      durationMs: Date.now() - startedAt,
      pagesAnalyzed: pages.length,
      findings,
      fixesApplied,
      testResult: buildTestSummary({ regressionOk, regressionNotes, screenshots }),
      deployResult,
      rollback: regressionOk ? null : regressionNotes,
      recurring,
      dryRun: DRY_RUN,
    });

    const { mdPath, jsonPath } = await writeWeeklyReport({
      dateStr: dateStr(),
      markdown: md,
      json: { date: dateStr(), findings, summary: s, deployResult, prUrl, dryRun: DRY_RUN },
    });
    log(`Relatório salvo em ${mdPath}`);

    if (process.env.GITHUB_ACTIONS === 'true') {
      const relMd = mdPath.slice(ROOT.length).replace(/^\/+/, '');
      const relJson = jsonPath.slice(ROOT.length).replace(/^\/+/, '');
      const { committed } = await commitReportFiles({
        files: [relMd, relJson],
        message: `chore(audit): relatório semanal ${dateStr()} [skip ci]`,
      });
      if (committed) log('Relatório commitado no histórico (reports/).');
    }

    if (SEND_EMAIL && !DRY_RUN) {
      await sendWeeklyEmail({ s, pages, deployResult, rollback: !regressionOk, fixesApplied, findings, mdPath });
    } else if (SEND_EMAIL) {
      log('DRY_RUN ativo — email NÃO enviado (relatório ainda foi gerado localmente).');
    }

    const criticalOpen = findings.filter((f) => f.severity === SEVERITY.CRITICAL && f.status !== 'corrigido automaticamente').length;
    let exitStatus = 'SUCCESS';
    if (!regressionOk) exitStatus = 'WARNING';
    if (criticalOpen > 0 && mode !== 'audit') exitStatus = 'WARNING';
    log(`Resultado final: ${exitStatus}`);
    log('Auditoria concluída');
    process.exitCode = exitStatus === 'FAILED' ? 1 : 0;
  } finally {
    if (server) await server.close?.();
  }
}

async function readOriginal(file, pages) {
  // Re-read from git HEAD to guarantee a clean revert (not just "what we had
  // in memory before the fix", in case something else touched the file).
  const { execFile } = await import('node:child_process');
  const { promisify } = await import('node:util');
  const run = promisify(execFile);
  try {
    const { stdout } = await run('git', ['show', `HEAD:${file}`], { cwd: ROOT });
    return stdout;
  } catch {
    // Fallback: current on-disk content minus this run's fix (best effort).
    return (await readFile(join(ROOT, file), 'utf8'));
  }
}

function buildCommitMessage(fixesApplied) {
  const byType = {};
  for (const f of fixesApplied) byType[f.fixId] = (byType[f.fixId] || 0) + 1;
  const summary = Object.entries(byType).map(([id, n]) => `${id} (${n}x)`).join(', ');
  return `fix(audit): correções automáticas de manutenção\n\n${summary}\n\nGerado pela auditoria automática (auditor/run.mjs).`;
}

function buildPrBody(fixesApplied, findings) {
  const lines = [
    '## Correções automáticas da auditoria semanal',
    '',
    'Todas as alterações abaixo fazem parte do allowlist de correções seguras e mecânicas do agente (ver `AUDITORIA.md`) — nenhum conteúdo, cor, identidade visual ou funcionalidade foi alterado.',
    '',
  ];
  for (const f of fixesApplied) {
    lines.push(`- **${f.page}** — ${f.problem}`);
  }
  lines.push('');
  lines.push(`Relatório completo desta auditoria: \`reports/weekly/${dateStr()}.md\``);
  lines.push('');
  lines.push('Este PR nunca é mesclado automaticamente — aguardando revisão humana.');
  return lines.join('\n');
}

function buildTestSummary({ regressionOk, regressionNotes, screenshots }) {
  const lines = [
    `Testes de regressão: ${regressionNotes}`,
    `Screenshots capturados: ${screenshots.length} (desktop/tablet/mobile) em reports/_data/screenshots/${dateStr()}/`,
  ];
  return lines.join('\n\n');
}

async function sendWeeklyEmail({ s, pages, deployResult, rollback, fixesApplied, findings, mdPath }) {
  const to = process.env.REPORT_EMAIL_TO || 'diretoria@glctech.com.br';
  const status = s.bySeverity[SEVERITY.CRITICAL] > 0 ? 'CRÍTICO' : (s.total > 0 ? 'ATENÇÃO' : 'OK');
  const highlights = fixesApplied.slice(0, 8).map((f) => `${f.page} — ${f.problem}`);
  const attention = findings
    .filter((f) => (f.severity === SEVERITY.CRITICAL || f.severity === SEVERITY.HIGH) && f.status !== 'corrigido automaticamente')
    .slice(0, 8)
    .map((f) => `[${f.severity}] ${f.page} — ${f.problem}`);

  const html = weeklyEmailHtml({
    dateStr: dateStr(),
    status,
    pagesAnalyzed: pages.length,
    summary: s,
    deployResult,
    rollback,
    highlights,
    attention,
  });

  log(`Enviando relatório por e-mail para ${to}`);
  const mdContent = await readFile(mdPath, 'utf8');
  await sendZohoMailNode({
    to,
    subject: `[GLCTech] Relatório Semanal de Auditoria do Site — ${dateStr()}`,
    html,
    attachments: [{ filename: `relatorio-${dateStr()}.md`, contentType: 'text/markdown', content: mdContent }],
  });
  log('Relatório enviado');
}

function dateStr(d = new Date()) {
  return d.toISOString().slice(0, 10);
}

main().catch((e) => {
  err(e.stack || String(e));
  process.exitCode = 1;
});
