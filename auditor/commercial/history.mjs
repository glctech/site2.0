/* ============================================================================
 * history.mjs — loads past commercial-audit snapshots and marks recurring
 * findings as "PENDENTE — REINCIDENTE" instead of generating a duplicate
 * recommendation (spec §16). Also the only place allowed to say a finding
 * was "resolved" — and only when there's actual git evidence (a page's
 * relevant content genuinely changed since it was last flagged), never
 * inferred from silence.
 * ==========================================================================*/

import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ROOT } from '../lib/scan.mjs';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const run = promisify(execFile);
const DATA_DIR = join(ROOT, 'reports', 'commercial', '_data');

export async function loadAllSnapshots() {
  let files;
  try { files = await readdir(DATA_DIR); } catch { return []; }
  const dated = files.filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f)).sort();
  const out = [];
  for (const f of dated) {
    try { out.push(JSON.parse(await readFile(join(DATA_DIR, f), 'utf8'))); } catch { /* skip unreadable */ }
  }
  return out;
}

/** A key stable across runs — identifies "the same underlying finding". */
function key(f) {
  return `${f.page}::${f.category}::${f.problem}`;
}

/**
 * Mutates `currentFindings` in place: marks ones matching a PENDING finding
 * from the immediately previous audit as "PENDENTE — REINCIDENTE" instead of
 * leaving them as a fresh "PENDENTE". Also flags findings from the previous
 * audit that DISAPPEARED this time, only as "possivelmente resolvido — sem
 * evidência de commit" (never a bare "resolvido"), so the report can list
 * them for a human to confirm, per the spec's evidence rule.
 */
export function reconcileWithHistory(currentFindings, pastSnapshots) {
  if (pastSnapshots.length === 0) return { possiblyResolved: [] };

  const previous = pastSnapshots[pastSnapshots.length - 1];
  const prevKeys = new Map((previous.findings || []).map((f) => [key(f), f]));
  const currentKeys = new Set(currentFindings.map(key));

  for (const f of currentFindings) {
    const k = key(f);
    if (prevKeys.has(k)) f.status = 'PENDENTE — REINCIDENTE';
  }

  const possiblyResolved = [];
  for (const [k, f] of prevKeys) {
    if (!currentKeys.has(k)) possiblyResolved.push(f);
  }

  return { possiblyResolved };
}

/**
 * Checks git log for commits touching a given page file since a given date
 * — the only basis on which this agent will ever say "isso foi alterado no
 * projeto", per §17 ("nunca afirmar que uma alteração foi feita sem
 * evidência"). Returns commit summaries, or [] if none / git unavailable.
 */
export async function detectFileChangesSince(file, sinceISODate) {
  try {
    const { stdout } = await run('git', [
      'log', `--since=${sinceISODate}`, '--format=%h|%ad|%s', '--date=short', '--', file,
    ], { cwd: ROOT });
    return stdout.trim().split('\n').filter(Boolean).map((line) => {
      const [hash, date, ...rest] = line.split('|');
      return { hash, date, subject: rest.join('|'), file };
    });
  } catch {
    return [];
  }
}
