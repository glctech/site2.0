/* ============================================================================
 * compare.mjs — loads previous weekly JSON snapshots and flags problems that
 * keep coming back (same page + same problem text across 3+ consecutive
 * audits), per the "investigate the structural cause" rule in the spec.
 * ==========================================================================*/

import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ROOT } from './scan.mjs';

const RECUR_THRESHOLD = 3;

export async function loadPastSnapshots(limit = RECUR_THRESHOLD - 1) {
  const dir = join(ROOT, 'reports', '_data');
  let files;
  try { files = await readdir(dir); } catch { return []; }
  const dated = files.filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f)).sort().reverse().slice(0, limit);
  const out = [];
  for (const f of dated) {
    try {
      const data = JSON.parse(await readFile(join(dir, f), 'utf8'));
      out.push({ date: f.replace('.json', ''), findings: data.findings || [] });
    } catch { /* skip unreadable snapshot */ }
  }
  return out.reverse(); // oldest first
}

/** A problem key that's stable across runs (ignores the auto-incrementing id/line). */
function key(f) {
  return `${f.page}::${f.category}::${f.problem}`;
}

export function findRecurring(currentFindings, pastSnapshots) {
  const timeline = [...pastSnapshots.map((s) => s.findings), currentFindings];
  if (timeline.length < RECUR_THRESHOLD) return [];

  const lastN = timeline.slice(-RECUR_THRESHOLD);
  const counts = new Map();
  for (const snapshot of lastN) {
    const seenThisSnapshot = new Set();
    for (const f of snapshot) {
      const k = key(f);
      if (seenThisSnapshot.has(k)) continue; // count each snapshot once per key
      seenThisSnapshot.add(k);
      counts.set(k, (counts.get(k) || 0) + 1);
    }
  }

  const recurring = [];
  for (const [k, count] of counts) {
    if (count >= RECUR_THRESHOLD) {
      const [page, , ...problemParts] = k.split('::');
      recurring.push({ page, problem: problemParts.join('::'), occurrences: count });
    }
  }
  return recurring;
}
