/* ============================================================================
 * Finding shape for the commercial/conversion audit — deliberately different
 * from ../lib/finding.mjs (the technical maintenance agent's shape), because
 * this agent's spec asks for extra dimensions (business impact, effort,
 * evidence strength) that don't apply to the other agent, and because this
 * agent NEVER auto-fixes anything — there's no autoFixable/fixId concept
 * here at all, on purpose (see AUDIT-COMERCIAL.md "Regra fundamental").
 * ==========================================================================*/

export const SEVERITY = Object.freeze({
  CRITICAL: 'CRÍTICO',
  HIGH: 'ALTO',
  MEDIUM: 'MÉDIO',
  LOW: 'BAIXO',
});

export const IMPACT = Object.freeze({
  VERY_HIGH: 'MUITO ALTO',
  HIGH: 'ALTO',
  MEDIUM: 'MÉDIO',
  LOW: 'BAIXO',
});

export const EFFORT = Object.freeze({
  LOW: 'BAIXO',
  MEDIUM: 'MÉDIO',
  HIGH: 'ALTO',
});

/** How sure we are, per the spec's evidence rule — never present a guess as fact. */
export const EVIDENCE = Object.freeze({
  CONFIRMED: 'CONFIRMADO',    // found directly in the code/site
  LIKELY: 'PROVÁVEL',         // inferred from partial evidence
  OPPORTUNITY: 'OPORTUNIDADE', // strategic suggestion, not necessarily an error
});

export const RISK = Object.freeze({ LOW: 'Baixo', MEDIUM: 'Médio', HIGH: 'Alto' });

let counter = 0;
export function resetCounter() { counter = 0; }

/**
 * @param {object} f
 * @param {string} f.category        Conversão | SEO | Performance | UX | UI | Segurança | Acessibilidade | Conteúdo | Técnico | Mobile
 * @param {string} f.severity        SEVERITY.*
 * @param {string} f.impact          IMPACT.* — commercial impact, independent of technical severity
 * @param {string} f.effort          EFFORT.*
 * @param {string} f.evidence        EVIDENCE.*
 * @param {string} f.page            page file or '(site)'
 * @param {string} f.problem
 * @param {string} f.evidenceText    WHERE exactly this was found (page/file/component/line/element/URL)
 * @param {string} [f.impactText]
 * @param {string} [f.recommendation]
 * @param {string} [f.implementation]  technical sketch of how to implement, when applicable
 * @param {string} [f.risk]          RISK.* — risk of the CHANGE being recommended, not of the problem
 */
export function finding(f) {
  counter += 1;
  return {
    id: `AUDIT-${String(counter).padStart(4, '0')}`,
    category: f.category,
    severity: f.severity,
    impact: f.impact,
    effort: f.effort,
    evidence: f.evidence,
    page: f.page,
    problem: f.problem,
    evidenceText: f.evidenceText || 'NÃO FOI POSSÍVEL DETERMINAR',
    impactText: f.impactText || 'NÃO FOI POSSÍVEL DETERMINAR',
    recommendation: f.recommendation || null,
    implementation: f.implementation || null,
    risk: f.risk || RISK.LOW,
    needsApproval: true, // always — this agent never applies anything itself
    status: 'PENDENTE',   // PENDENTE | PENDENTE — REINCIDENTE | RESOLVIDO (only set by history.mjs with git evidence)
  };
}
