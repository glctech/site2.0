#!/usr/bin/env node
/* ============================================================================
 * auditor/postdeploy.mjs — runs AFTER something is merged to the production
 * branch (glctech2.0), once Cloudflare Workers has had time to build and
 * publish. Does a small, fast smoke test against the LIVE site.
 *
 * This is the one place in the whole system that is allowed to open AND
 * merge a PR by itself, and only for one narrow purpose: reverting the exact
 * commit that just broke production. Everything else in this project always
 * stops at "PR opened, waiting for a human" — see AUDITORIA.md §17/§19 for
 * why this specific case is treated differently (the site is actively
 * broken right now; waiting for a human to notice and merge a revert costs
 * more than the small risk of an automated `git revert` of a single,
 * already-reviewed, already-merged commit).
 * ==========================================================================*/

import { discoverPages } from './lib/scan.mjs';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { ROOT } from './lib/scan.mjs';

const run = promisify(execFile);
const log = (m) => console.log(`[INFO] ${m}`);
const err = (m) => console.error(`[ERROR] ${m}`);

const SITE_URL = process.env.SITE_URL || 'https://glctech.com.br';
const REPO = process.env.GITHUB_REPOSITORY || 'glctech/site2.0';
const [OWNER, REPO_NAME] = REPO.split('/');
const BASE_BRANCH = process.env.AUDIT_BASE_BRANCH || 'glctech2.0';
const SHA = process.env.GITHUB_SHA;

async function smokeTest() {
  const pages = await discoverPages();
  const problems = [];
  for (const p of pages) {
    const url = new URL(p.path, SITE_URL).toString();
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 10000);
      const res = await fetch(url, { signal: ctrl.signal });
      clearTimeout(t);
      if (res.status >= 500) problems.push(`${url} → HTTP ${res.status}`);
      else if (res.status >= 400) problems.push(`${url} → HTTP ${res.status}`);
      else {
        const text = await res.text();
        if (text.length < 500) problems.push(`${url} → resposta suspeitosamente pequena (${text.length} bytes)`);
      }
    } catch (e) {
      problems.push(`${url} → ${e.message}`);
    }
  }
  return problems;
}

async function main() {
  log(`Verificação pós-deploy: ${SITE_URL}`);
  const problems = await smokeTest();

  if (problems.length === 0) {
    log('Site OK após deploy.');
    return;
  }

  err(`Problemas detectados pós-deploy:\n${problems.join('\n')}`);

  if (!SHA) {
    err('GITHUB_SHA não disponível — não é possível determinar o commit a reverter. AÇÃO NECESSÁRIA — APROVAÇÃO HUMANA.');
    process.exitCode = 1;
    return;
  }

  // Guard against a revert-loop: this workflow triggers on every push to
  // BASE_BRANCH, including the revert commit it makes itself. If the site is
  // STILL broken after a revert, the cause probably isn't the last commit
  // (could be external infra — this project has hit that before with its
  // CDN) — stop and ask a human instead of reverting further back blindly.
  const { stdout: lastMsg } = await run('git', ['log', '-1', '--format=%s', SHA], { cwd: ROOT });
  if (/^Revert /i.test(lastMsg.trim())) {
    err(`O commit ${SHA} já é um revert automático e o site continua com problema — não é seguro reverter de novo às cegas. AÇÃO NECESSÁRIA — APROVAÇÃO HUMANA (pode ser um problema de infraestrutura externa, não do código).`);
    process.exitCode = 1;
    return;
  }

  log(`Revertendo commit ${SHA} em ${BASE_BRANCH}`);
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    err('GITHUB_TOKEN não disponível — não é possível reverter automaticamente. AÇÃO NECESSÁRIA — APROVAÇÃO HUMANA.');
    process.exitCode = 1;
    return;
  }

  try {
    // Assumes the calling workflow already did a clean actions/checkout of
    // BASE_BRANCH — deliberately no `git reset --hard` here (never used
    // indiscriminately, per AUDITORIA.md).
    await run('git', ['-c', 'user.name=glctech-site-auditor[bot]', '-c', 'user.email=github-actions[bot]@users.noreply.github.com', 'revert', '--no-edit', SHA], { cwd: ROOT });
    await run('git', ['push', 'origin', BASE_BRANCH], { cwd: ROOT });
    log(`Revert de ${SHA} publicado diretamente em ${BASE_BRANCH} (caso de emergência — site estava quebrado em produção).`);
    process.exitCode = 1; // still a failed run — the workflow's job is to alert, not to celebrate
  } catch (e) {
    err(`Falha ao reverter automaticamente: ${e.message}. AÇÃO NECESSÁRIA — APROVAÇÃO HUMANA.`);
    process.exitCode = 1;
  }
}

main();
