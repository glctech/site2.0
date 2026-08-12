/* ============================================================================
 * report.mjs — turns collected findings into the Markdown report + a JSON
 * sidecar (used by compare.mjs for trend/recurrence detection and by the
 * monthly consolidation job).
 * ==========================================================================*/

import { writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { ROOT } from './scan.mjs';
import { SEVERITY } from './finding.mjs';

const SEVERITY_ORDER = [SEVERITY.CRITICAL, SEVERITY.HIGH, SEVERITY.MEDIUM, SEVERITY.LOW];

export function summarize(findings) {
  const bySeverity = Object.fromEntries(SEVERITY_ORDER.map((s) => [s, 0]));
  for (const f of findings) bySeverity[f.severity] = (bySeverity[f.severity] || 0) + 1;
  const fixed = findings.filter((f) => f.status === 'corrigido automaticamente').length;
  return { total: findings.length, bySeverity, fixed };
}

export function buildMarkdownReport({
  date, durationMs, pagesAnalyzed, findings, fixesApplied, testResult, deployResult,
  rollback, recurring, dryRun,
}) {
  const s = summarize(findings);
  const lines = [];
  lines.push(`# Relatório de Auditoria — glctech.com.br`);
  lines.push('');
  lines.push(`**Data:** ${date}`);
  lines.push(`**Duração:** ${(durationMs / 1000).toFixed(1)}s`);
  lines.push(`**Modo:** ${dryRun ? 'DRY_RUN (somente leitura, nenhuma alteração)' : 'audit + fix'}`);
  lines.push(`**Páginas analisadas:** ${pagesAnalyzed}`);
  lines.push(`**Problemas encontrados:** ${s.total}`);
  lines.push(`**Problemas corrigidos automaticamente:** ${s.fixed}`);
  lines.push(`**Deploy:** ${deployResult || 'NÃO EXECUTADO (dry-run ou sem alterações)'}`);
  lines.push(`**Rollback:** ${rollback ? 'SIM — ' + rollback : 'NÃO'}`);
  lines.push('');

  lines.push('## Resumo por severidade');
  lines.push('');
  lines.push('| Severidade | Quantidade |');
  lines.push('|---|---|');
  for (const sev of SEVERITY_ORDER) lines.push(`| ${sev} | ${s.bySeverity[sev]} |`);
  lines.push('');

  if (recurring && recurring.length) {
    lines.push('## Problemas recorrentes (3+ auditorias seguidas)');
    lines.push('');
    for (const r of recurring) {
      lines.push(`- **${r.page}** — ${r.problem} (${r.occurrences}x consecutivas) → recomenda-se investigar a causa estrutural, não só corrigir de novo.`);
    }
    lines.push('');
  }

  lines.push('## Problemas encontrados');
  lines.push('');
  if (findings.length === 0) {
    lines.push('Nenhum problema encontrado nesta auditoria. ✅');
  } else {
    for (const sev of SEVERITY_ORDER) {
      const group = findings.filter((f) => f.severity === sev);
      if (!group.length) continue;
      lines.push(`### ${sev} (${group.length})`);
      lines.push('');
      for (const f of group) {
        lines.push(`**${f.id}** · \`${f.category}\` · ${f.page}${f.line ? `:${f.line}` : ''}`);
        lines.push(`- Problema: ${f.problem}`);
        lines.push(`- Causa: ${f.cause}`);
        if (f.recommendation) lines.push(`- Recomendação: ${f.recommendation}`);
        lines.push(`- Status: ${f.status}`);
        lines.push('');
      }
    }
  }

  if (fixesApplied && fixesApplied.length) {
    lines.push('## Melhorias realizadas');
    lines.push('');
    for (const fx of fixesApplied) {
      lines.push(`- **${fx.page}** — ${fx.problem} (${fx.fixId})`);
    }
    lines.push('');
  }

  lines.push('## Testes');
  lines.push('');
  lines.push(testResult || 'NÃO FOI POSSÍVEL DETERMINAR');
  lines.push('');

  lines.push('## Performance');
  lines.push('');
  lines.push('Não mensurado — Lighthouse/Core Web Vitals não estão configurados neste ambiente ainda. Ver AUDITORIA.md para como habilitar.');
  lines.push('');

  lines.push('## Segurança');
  lines.push('');
  const secFindings = findings.filter((f) => f.category === 'security');
  lines.push(secFindings.length
    ? `${secFindings.length} verificação(ões) de segurança sinalizada(s) — ver seção "Problemas encontrados" acima. Nenhuma credencial é reproduzida neste relatório.`
    : 'Nenhuma exposição de credenciais ou problema de segurança conhecido detectado nesta auditoria.');
  lines.push('');

  return lines.join('\n');
}

export async function writeWeeklyReport({ dateStr, markdown, json }) {
  const mdDir = join(ROOT, 'reports', 'weekly');
  const dataDir = join(ROOT, 'reports', '_data');
  await mkdir(mdDir, { recursive: true });
  await mkdir(dataDir, { recursive: true });
  const mdPath = join(mdDir, `${dateStr}.md`);
  const jsonPath = join(dataDir, `${dateStr}.json`);
  await writeFile(mdPath, markdown, 'utf8');
  await writeFile(jsonPath, JSON.stringify(json, null, 2), 'utf8');
  return { mdPath, jsonPath };
}
