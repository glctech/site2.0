/* ============================================================================
 * git-pr.mjs — small wrapper around git CLI + GitHub REST API, used by the
 * weekly workflow to commit fixes on a branch and open a PR (NEVER pushes
 * directly to the production branch — see AUDITORIA.md "Autonomia com
 * limites"). Uses the GITHUB_TOKEN Actions already injects; no extra secret
 * needed for this part.
 * ==========================================================================*/

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { ROOT } from './scan.mjs';

const run = promisify(execFile);

async function git(args) {
  return run('git', args, { cwd: ROOT });
}

export async function gitStatusPorcelain() {
  const { stdout } = await git(['status', '--porcelain']);
  return stdout.trim();
}

export async function createBackupTag() {
  const tag = `audit-backup-${new Date().toISOString().slice(0, 10)}-${Date.now()}`;
  await git(['tag', tag]);
  return tag;
}

/**
 * Commits report files (reports/weekly/*.md, reports/_data/*.json) straight
 * to the current branch — same low-risk "pure data, zero effect on the
 * live site" pattern the existing zabbix-stats.yml workflow already uses
 * for assets/data/stats.json. Runs regardless of DRY_RUN: generating and
 * keeping a record of the audit is not a "site change", it's the audit
 * itself (see AUDITORIA.md §31). Never touches site code.
 */
export async function commitReportFiles({ files, message }) {
  const status = await gitStatusPorcelain();
  if (!status) return { committed: false };
  await git(['add', ...files]);
  const staged = (await git(['diff', '--cached', '--name-only'])).stdout.trim();
  if (!staged) return { committed: false };
  await git(['-c', 'user.name=glctech-site-auditor[bot]', '-c', 'user.email=github-actions[bot]@users.noreply.github.com', 'commit', '-m', message]);
  await git(['push', 'origin', 'HEAD']);
  return { committed: true };
}

export async function commitOnNewBranch({ branchBase, branchName, files, message }) {
  await git(['checkout', '-B', branchName, branchBase]);
  if (files.length) await git(['add', ...files]);
  const status = await gitStatusPorcelain();
  if (!status) return { committed: false };
  await git(['-c', 'user.name=glctech-site-auditor[bot]', '-c', 'user.email=github-actions[bot]@users.noreply.github.com', 'commit', '-m', message]);
  await git(['push', '-u', 'origin', branchName, '--force-with-lease']);
  return { committed: true, branchName };
}

/**
 * Opens (or reuses, if one already exists for this head/base) a PR via the
 * GitHub REST API — never merges it automatically.
 */
export async function openPullRequest({ owner, repo, head, base, title, body, draft = true }) {
  const token = process.env.GITHUB_TOKEN;
  if (!token) throw new Error('GITHUB_TOKEN não disponível — não é possível abrir PR.');

  const existing = await ghApi(`GET /repos/${owner}/${repo}/pulls?head=${owner}:${head}&state=open&base=${base}`, token);
  if (Array.isArray(existing) && existing.length) {
    return existing[0];
  }

  return ghApi(`POST /repos/${owner}/${repo}/pulls`, token, { title, head, base, body, draft });
}

async function ghApi(methodAndPath, token, jsonBody) {
  const [method, path] = methodAndPath.split(/\s+/);
  const res = await fetch(`https://api.github.com${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json',
    },
    body: jsonBody ? JSON.stringify(jsonBody) : undefined,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`GitHub API ${method} ${path} → ${res.status}: ${text}`);
  }
  return res.json();
}
