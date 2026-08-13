/* ============================================================================
 * Conversion / lead-gen / UX heuristic checks — evidence-based only.
 * Every check here inspects code structure (CTA markup, form fields, contact
 * links, heading text) — none of it judges whether copy is persuasive or
 * whether the brand feels trustworthy. Those are OPORTUNIDADE-tier notes a
 * human (or an LLM doing an actual reading pass, like the one-time review in
 * the first report) has to make — a cron script can't read for tone. See
 * AUDIT-COMERCIAL.md "Limite honesto do agente automático".
 * ==========================================================================*/

import { extractTags, lineAt } from '../lib/scan.mjs';
import { finding, SEVERITY, IMPACT, EFFORT, EVIDENCE, RISK } from './finding.mjs';

const CTA_CLASSES = ['btn-primary', 'nav-cta', 'edition-btn', 'btn-plan', 'result-cta', 'btn-white'];

export function checkConversion(page) {
  const { file } = page;
  const html = page.domHtml;
  const out = [];

  // ── CTA presence ─────────────────────────────────────────────────
  const anchors = [...extractTags(html, 'a'), ...extractTags(html, 'button')];
  const ctas = anchors.filter((t) => CTA_CLASSES.some((c) => (t.attrs.class || '').split(/\s+/).includes(c)));
  if (ctas.length === 0) {
    out.push(finding({
      category: 'Conversão', severity: SEVERITY.HIGH, impact: IMPACT.VERY_HIGH, effort: EFFORT.LOW,
      evidence: EVIDENCE.CONFIRMED, page: file,
      problem: 'Nenhum CTA (call-to-action) identificado nesta página.',
      evidenceText: `Nenhum elemento com classe ${CTA_CLASSES.map((c) => `.${c}`).join('/')} encontrado em ${file}.`,
      impactText: 'Sem um caminho claro de ação, o visitante pode ler a página inteira e sair sem converter.',
      recommendation: 'Adicionar pelo menos um CTA principal (ex.: "Solicitar Diagnóstico" / "Falar no WhatsApp"), visível sem precisar rolar muito a página.',
      risk: RISK.LOW,
    }));
  }

  // ── WhatsApp CTA text should read as an action ──────────────────
  const waLinks = anchors.filter((t) => /wa\.me\//i.test(t.attrs.href || ''));
  for (const t of waLinks) {
    const textMatch = html.slice(t.index, t.index + 400).match(/>([^<]{0,80})<\/a>/);
    const text = (textMatch?.[1] || '').replace(/\s+/g, ' ').trim();
    if (text && text.length <= 3) {
      out.push(finding({
        category: 'Conversão', severity: SEVERITY.LOW, impact: IMPACT.MEDIUM, effort: EFFORT.LOW,
        evidence: EVIDENCE.OPPORTUNITY, page: file, problem: `Texto do CTA de WhatsApp muito curto/genérico: "${text}".`,
        evidenceText: `${file}:${lineAt(html, t.index)}`,
        recommendation: 'Usar um texto orientado à ação (ex.: "Falar no WhatsApp agora"), reforçando o próximo passo.',
        risk: RISK.LOW,
      }));
    }
  }

  // ── Form friction ────────────────────────────────────────────────
  // The site doesn't consistently use native <form> elements (index.html's
  // contact "form" is a plain <div id="contact-form">; trabalhe-conosco.html
  // uses a real <form>), and neither uses the native `required` attribute —
  // "obrigatório" is only signaled with a "*" after the <label> text. Match
  // the actual convention rather than assuming textbook HTML forms.
  const formContainers = [
    ...extractTags(html, 'form'),
    ...extractTags(html, 'div').filter((t) => /-form$/.test(t.attrs.id || '')),
  ];
  for (const f of formContainers) {
    const body = extractContainerBody(html, f);
    if (!body) continue;
    const fieldTags = [...extractTags(body, 'input'), ...extractTags(body, 'textarea'), ...extractTags(body, 'select')]
      .filter((t) => (t.attrs.type || '').toLowerCase() !== 'hidden');
    const labels = extractTags(body, 'label');
    const requiredCount = labels.filter((l) => {
      const labelEnd = body.indexOf('</label>', l.index);
      const text = labelEnd !== -1 ? body.slice(l.index, labelEnd) : '';
      return /\*/.test(text) && !/opcional|se aplicável/i.test(text);
    }).length;
    const totalCount = fieldTags.length;
    if (totalCount > 8) {
      out.push(finding({
        category: 'Conversão', severity: SEVERITY.MEDIUM, impact: IMPACT.HIGH, effort: EFFORT.MEDIUM,
        evidence: EVIDENCE.LIKELY, page: file,
        problem: `Formulário com ${totalCount} campos (${requiredCount || 'NÃO FOI POSSÍVEL DETERMINAR'} obrigatórios), o que pode aumentar a fricção no envio.`,
        evidenceText: `${file}, container #${f.attrs.id || '?'} próximo à linha ${lineAt(html, f.index)}.`,
        impactText: 'Cada campo adicional é um ponto potencial de abandono, especialmente no celular. Formulários de candidatura costumam justificar mais campos que um formulário de contato comercial, mas vale revisar quais são realmente indispensáveis no primeiro envio.',
        recommendation: 'Avaliar mover campos não essenciais (ex.: links de portfólio/GitHub/LinkedIn) para uma etapa posterior do processo seletivo, mantendo o formulário inicial mais curto.',
        risk: RISK.LOW,
      }));
    }
  }

  // ── Social proof structural presence (service pages only) ───────
  const isServicePage = ['zabbix.html', 'kaspersky.html', 'veeam.html'].includes(file);
  if (isServicePage) {
    const hasTestimonial = /testimonial|depoimento|review/i.test(html);
    if (!hasTestimonial) {
      out.push(finding({
        category: 'Conteúdo', severity: SEVERITY.LOW, impact: IMPACT.MEDIUM, effort: EFFORT.MEDIUM,
        evidence: EVIDENCE.OPPORTUNITY, page: file,
        problem: 'Página de serviço sem seção de prova social (depoimentos/cases) própria.',
        evidenceText: `Nenhuma seção com "testimonial"/"depoimento"/"review" encontrada em ${file} (a prova social do site vive só na home).`,
        recommendation: 'Considerar repetir ou referenciar prova social relevante também nas páginas de serviço, perto do CTA — não inventar depoimentos, só reaproveitar os já existentes na home se fizerem sentido para o serviço.',
        risk: RISK.LOW,
      }));
    }
  }

  // ── H1 length heuristic (PROVÁVEL, not a hard rule) ─────────────
  const h1 = extractTags(html, 'h1')[0];
  if (h1) {
    const h1End = html.indexOf('</h1>', h1.index);
    const text = h1End !== -1 ? html.slice(h1.index, h1End).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() : '';
    const words = text.split(' ').filter(Boolean).length;
    if (words > 0 && words <= 2) {
      out.push(finding({
        category: 'UX', severity: SEVERITY.LOW, impact: IMPACT.MEDIUM, effort: EFFORT.LOW,
        evidence: EVIDENCE.LIKELY, page: file,
        problem: `H1 muito curto ("${text}") — pode não comunicar rapidamente o que a GLCTech faz.`,
        evidenceText: `${file}:${lineAt(html, h1.index)}`,
        recommendation: 'Conferir manualmente se o H1 comunica claramente proposta de valor + público-alvo para um visitante que chega pela primeira vez.',
        risk: RISK.LOW,
      }));
    }
  }

  return out;
}

/** Site-wide checks that need every page's HTML at once (e.g. consistency). */
export function checkConversionSiteWide(pagesHtml) {
  const out = [];

  // WhatsApp number consistency — every wa.me link across the site should
  // point at the same number, including the STATIC fallback href (before any
  // inline script rewrites it), since that's what a visitor with JS blocked,
  // slow, or erroring would actually click.
  const numbersByPage = new Map();
  for (const [file, html] of pagesHtml) {
    const matches = [...html.matchAll(/wa\.me\/(\d+)/g)];
    if (matches.length) numbersByPage.set(file, [...new Set(matches.map((m) => m[1]))]);
  }
  const allNumbers = new Set();
  for (const nums of numbersByPage.values()) for (const n of nums) allNumbers.add(n);
  if (allNumbers.size > 1) {
    const detail = [...numbersByPage.entries()].map(([f, nums]) => `${f}: ${nums.join(', ')}`).join(' | ');
    out.push(finding({
      category: 'Conversão', severity: SEVERITY.MEDIUM, impact: IMPACT.HIGH, effort: EFFORT.LOW,
      evidence: EVIDENCE.CONFIRMED, page: '(site)',
      problem: `Mais de um número de WhatsApp aparece em links wa.me no código do site (${[...allNumbers].join(', ')}).`,
      evidenceText: detail,
      impactText: 'Se algum link estático (href de fallback antes do JavaScript rodar) apontar para um número diferente do usado ativamente, uma mensagem pode chegar na conta errada ou não chegar a tempo.',
      recommendation: 'Confirmar qual é o número oficial de vendas/atendimento via WhatsApp e padronizar todos os links (inclusive os hrefs estáticos de fallback) para o mesmo número.',
      implementation: 'auditor detectou pelo menos um caso: kaspersky.html define href="https://wa.me/5511957624146" no HTML, mas um <script> na mesma página sobrescreve esse href em runtime para 5511911517501 — se o script falhar por qualquer motivo, o clique vai para o número errado.',
      risk: RISK.LOW,
    }));
  }

  return out;
}

/** Depth-aware body extraction: real matching close tag for <form>, and
 *  nested-<div>-aware matching for a <div id="*-form"> container (the site
 *  mixes both patterns for its two "forms" — see checkConversion above). */
function extractContainerBody(html, containerTag) {
  if (containerTag.tag === 'form') {
    const end = html.indexOf('</form>', containerTag.index);
    return end === -1 ? null : html.slice(containerTag.index, end);
  }
  const openTagEnd = html.indexOf('>', containerTag.index) + 1;
  if (openTagEnd <= 0) return null;
  const re = /<div\b[^>]*>|<\/div>/gi;
  re.lastIndex = openTagEnd;
  let depth = 1;
  let m;
  while ((m = re.exec(html))) {
    if (m[0].toLowerCase().startsWith('</div')) depth -= 1;
    else depth += 1;
    if (depth === 0) return html.slice(openTagEnd, m.index);
  }
  return html.slice(openTagEnd); // unbalanced markup — fall back to the rest of the document (safe: only over-inclusive)
}
