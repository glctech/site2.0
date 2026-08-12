/* Shared "finding" shape used by every check module, and the severity ladder
 * from the audit spec (CRÍTICO / ALTO / MÉDIO / BAIXO). */

export const SEVERITY = Object.freeze({
  CRITICAL: 'CRÍTICO',
  HIGH: 'ALTO',
  MEDIUM: 'MÉDIO',
  LOW: 'BAIXO',
});

let counter = 0;

/**
 * @param {object} f
 * @param {string} f.category   e.g. 'html', 'seo', 'security', 'performance'
 * @param {string} f.severity   one of SEVERITY
 * @param {string} f.page       page file, e.g. 'index.html', or '(site)'
 * @param {string} f.problem    short description
 * @param {string} [f.cause]
 * @param {number} [f.line]
 * @param {boolean} [f.autoFixable]  true only if `fixer.mjs` has a real fixer for this id
 * @param {string} [f.fixId]    key `fixer.mjs` dispatches on
 * @param {string} [f.recommendation]  what a human should do if not auto-fixed
 */
export function finding(f) {
  counter += 1;
  return {
    id: `F${String(counter).padStart(4, '0')}`,
    category: f.category,
    severity: f.severity,
    page: f.page,
    problem: f.problem,
    cause: f.cause || 'NÃO FOI POSSÍVEL DETERMINAR',
    line: f.line ?? null,
    autoFixable: !!f.autoFixable,
    fixId: f.fixId || null,
    fixData: f.fixData || null,
    recommendation: f.recommendation || null,
    status: 'detectado',
  };
}

export function resetCounter() {
  counter = 0;
}
