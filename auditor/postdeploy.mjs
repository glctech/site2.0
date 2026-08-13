#!/usr/bin/env node
/* ============================================================================
 * auditor/postdeploy.mjs — runs AFTER something is merged to the production
 * branch (glctech2.0), once Cloudflare Workers has had time to build and
 * publish. Does a small, fast smoke test against the LIVE site.
 *
 * ⚠️ INCIDENT NOTE (2026-08-12) — READ BEFORE CHANGING THIS FILE.
 * On its very first real trigger, this script auto-reverted a clean merge
 * (PR #15) because glctech.com.br returned HTTP 403 on every page for a few
 * seconds right after deploy — almost certainly the same CDN/WAF flakiness
 * this project has hit repeatedly and independently of any code change (see
 * README/docs for the domain's history of Fastly/redirect quirks), not a
 * real break. Compounding that false positive, the calling workflow used a
 * shallow (depth-1) checkout, so `git revert` on the merge commit had no
 * parent tree to diff against and deleted the ENTIRE repository instead of
 * just the merge's actual changes. Both bugs are fixed now:
 *   1. The workflow checks out full history (fetch-depth: 0).
 *   2. This script retries before concluding anything is broken, treats
 *      403/429 as ambiguous (possible WAF/bot-block, NOT auto-revert
 *      material) rather than as proof of breakage, and — the big one —
 *      auto-push of a revert is now OFF by default. Set the repo variable
 *      AUTO_REVERT_ON_BREAKAGE=true only after you've watched this script
 *      alert (without acting) a few times and trust its judgment.
 *
 * This remains the only script in the project that's EVER allowed to push
 * directly to the production branch without a human merging a PR first —
 * and only when AUTO_REVERT_ON_BREAKAGE=true, and only for `git revert`
 * (never reset --hard, never force-push).
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
const AUTO_REVERT_ENABLED = process.env.AUTO_REVERT_ON_BREAKAGE === 'true';

const RETRY_ATTEMPTS = 3;
const RETRY_DELAY_MS = 20000;
const UA = 'Mozilla/5.0 (compatible; GLCTech-PostDeployCheck/1.0; +https://github.com/glctech/site2.0)';

async function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

/** One pass over every page. Returns per-page results, not a verdict — the
 *  caller decides what counts as "definitely broken" vs. "ambiguous". */
async function probeOnce() {
  const pages = await discoverPages();
  const results = [];
  for (const p of pages) {
    const url = new URL(p.path, SITE_URL).toString();
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 10000);
      const res = await fetch(url, { signal: ctrl.signal, headers: { 'User-Agent': UA } });
      clearTimeout(t);
      const text = await res.text().catch(() => '');
      results.push({ url, status: res.status, bodyLength: text.length });
    } catch (e) {
      results.push({ url, status: null, error: e.name === 'AbortError' ? 'timeout' : (e.message || 'network error') });
    }
  }
  return results;
}

/** Classifies one probe pass. "definite" failures (5xx, timeout, connection
 *  error, or a 200 with a suspiciously tiny body) are real evidence of
 *  breakage. "ambiguous" ones (403/429/401) get logged but never trigger a
 *  revert on their own — those status codes are exactly what a WAF/CDN
 *  bot-protection layer returns, and this domain has a documented history
 *  of exactly that kind of edge flakiness unrelated to the deployed code. */
function classify(results) {
  const definite = [];
  const ambiguous = [];
  for (const r of results) {
    if (r.error) definite.push(`${r.url} → ${r.error}`);
    else if (r.status >= 500) definite.push(`${r.url} → HTTP ${r.status}`);
    else if (r.status === 403 || r.status === 429 || r.status === 401) ambiguous.push(`${r.url} → HTTP ${r.status}`);
    else if (r.status >= 400) definite.push(`${r.url} → HTTP ${r.status}`);
    else if (r.bodyLength < 500) definite.push(`${r.url} → resposta suspeitosamente pequena (${r.bodyLength} bytes)`);
  }
  return { definite, ambiguous };
}

async function main() {
  log(`Verificação pós-deploy: ${SITE_URL}`);

  let lastDefinite = [];
  let lastAmbiguous = [];
  let allClearOnAnyAttempt = false;

  for (let attempt = 1; attempt <= RETRY_ATTEMPTS; attempt++) {
    const results = await probeOnce();
    const { definite, ambiguous } = classify(results);
    lastDefinite = definite;
    lastAmbiguous = ambiguous;

    if (definite.length === 0) {
      allClearOnAnyAttempt = true;
      if (ambiguous.length) {
        log(`Tentativa ${attempt}/${RETRY_ATTEMPTS}: nenhum problema definitivo. ${ambiguous.length} resposta(s) ambígua(s) (403/429/401, possível WAF/bot-block, não tratado como quebra):\n${ambiguous.join('\n')}`);
      } else {
        log(`Tentativa ${attempt}/${RETRY_ATTEMPTS}: site OK.`);
      }
      break; // no definite failures this attempt — good enough, stop retrying
    }

    log(`Tentativa ${attempt}/${RETRY_ATTEMPTS}: ${definite.length} problema(s) definitivo(s) detectado(s).`);
    if (attempt < RETRY_ATTEMPTS) {
      log(`Aguardando ${RETRY_DELAY_MS / 1000}s antes de tentar de novo (pode ser propagação de deploy ainda em andamento).`);
      await sleep(RETRY_DELAY_MS);
    }
  }

  if (allClearOnAnyAttempt) {
    log('Site OK após deploy (nenhum problema definitivo confirmado).');
    return;
  }

  err(`Problemas confirmados em ${RETRY_ATTEMPTS} tentativa(s) seguidas:\n${lastDefinite.join('\n')}`);
  if (lastAmbiguous.length) err(`(Além disso, respostas ambíguas: ${lastAmbiguous.join('; ')})`);

  if (!SHA) {
    err('GITHUB_SHA não disponível — não é possível determinar o commit a reverter. AÇÃO NECESSÁRIA — APROVAÇÃO HUMANA.');
    process.exitCode = 1;
    return;
  }

  const { stdout: lastMsg } = await run('git', ['log', '-1', '--format=%s', SHA], { cwd: ROOT });
  if (/^Revert /i.test(lastMsg.trim())) {
    err(`O commit ${SHA} já é um revert automático e o site continua com problema — não é seguro reverter de novo às cegas. AÇÃO NECESSÁRIA — APROVAÇÃO HUMANA (pode ser um problema de infraestrutura externa, não do código).`);
    process.exitCode = 1;
    return;
  }

  if (!AUTO_REVERT_ENABLED) {
    err(
      `AUTO_REVERT_ON_BREAKAGE não está ativado (variável de repositório) — revert automático DESATIVADO por padrão após o ` +
      `incidente de 2026-08-12 (ver nota no topo deste arquivo e AUDITORIA.md). AÇÃO NECESSÁRIA — APROVAÇÃO HUMANA: ` +
      `verifique manualmente se ${SITE_URL} está realmente fora do ar antes de reverter ${SHA} em ${BASE_BRANCH} (git revert -m 1 --no-edit ${SHA}).`
    );
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
    // -m 1: explicit mainline parent for a merge commit. Belt-and-suspenders
    // alongside fetch-depth: 0 in the workflow — never rely on just one of
    // the two after the 2026-08-12 incident.
    await run('git', [
      '-c', 'user.name=glctech-site-auditor[bot]',
      '-c', 'user.email=github-actions[bot]@users.noreply.github.com',
      'revert', '-m', '1', '--no-edit', SHA,
    ], { cwd: ROOT });
    await run('git', ['push', 'origin', BASE_BRANCH], { cwd: ROOT });
    log(`Revert de ${SHA} publicado diretamente em ${BASE_BRANCH} (caso de emergência — site estava quebrado em produção, confirmado em ${RETRY_ATTEMPTS} tentativas).`);
    process.exitCode = 1; // still a failed run — the workflow's job is to alert, not to celebrate
  } catch (e) {
    err(`Falha ao reverter automaticamente: ${e.message}. AÇÃO NECESSÁRIA — APROVAÇÃO HUMANA.`);
    process.exitCode = 1;
  }
}

main();
