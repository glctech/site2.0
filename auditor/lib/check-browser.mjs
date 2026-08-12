/* ============================================================================
 * Browser-based checks (Playwright): console errors, failed network requests,
 * horizontal overflow, and reference screenshots across 3 viewports.
 * Requires a locally reachable copy of the site (see auditor/lib/server.mjs).
 * Gracefully returns a single finding (not a crash) if Playwright/Chromium
 * isn't available, so the rest of the audit still runs.
 * ==========================================================================*/

import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { finding, SEVERITY } from './finding.mjs';
import { ROOT } from './scan.mjs';

const VIEWPORTS = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'tablet', width: 834, height: 1112 },
  { name: 'mobile', width: 390, height: 844 },
];

export async function checkBrowser(pages, baseUrl, { screenshotDir } = {}) {
  const out = [];
  const screenshots = [];
  let chromium;
  try {
    ({ chromium } = await import('playwright'));
  } catch {
    out.push(finding({
      category: 'ux', severity: SEVERITY.LOW, page: '(site)',
      problem: 'Playwright não está instalado neste ambiente — checagens de console/overflow/screenshot foram puladas.',
      recommendation: 'Rodar "npm install" antes do audit para habilitar essas checagens.',
    }));
    return { findings: out, screenshots };
  }

  if (screenshotDir) await mkdir(screenshotDir, { recursive: true });

  const browser = await chromium.launch({ args: ['--no-sandbox'] });
  try {
    for (const p of pages) {
      const url = new URL(p.path, baseUrl).toString();

      for (const vp of VIEWPORTS) {
        const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
        const bpage = await context.newPage();
        const consoleErrors = [];
        const failedRequests = [];
        bpage.on('console', (msg) => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
        bpage.on('requestfailed', (req) => {
          const failure = req.failure();
          // Ignore aborted requests caused by navigation/context teardown.
          if (failure && failure.errorText === 'net::ERR_ABORTED') return;
          failedRequests.push(`${req.url()} (${failure ? failure.errorText : 'falhou'})`);
        });

        let loadOk = true;
        try {
          await bpage.goto(url, { waitUntil: 'load', timeout: 25000 });
          await bpage.waitForTimeout(400);
        } catch (err) {
          loadOk = false;
          out.push(finding({
            category: 'ux', severity: SEVERITY.CRITICAL, page: p.file,
            problem: `Página não carregou em ${vp.name} (${vp.width}px): ${err.message}`,
            recommendation: 'Verificar se o servidor local/produção está respondendo e se a página tem erro fatal de carregamento.',
          }));
        }

        if (loadOk) {
          if (vp.name === 'desktop') {
            for (const e of consoleErrors) {
              out.push(finding({
                category: 'javascript', severity: SEVERITY.HIGH, page: p.file,
                problem: `Erro no console: ${truncate(e)}`,
                recommendation: 'Investigar e corrigir a causa do erro JS.',
              }));
            }
            for (const f of failedRequests) {
              out.push(finding({
                category: 'javascript', severity: SEVERITY.HIGH, page: p.file,
                problem: `Requisição falhou: ${truncate(f)}`,
                recommendation: 'Verificar se o recurso existe e se a URL está correta.',
              }));
            }
          }

          const overflow = await bpage.evaluate(() => {
            const doc = document.documentElement;
            return doc.scrollWidth > doc.clientWidth + 2; // small tolerance
          }).catch(() => false);
          if (overflow) {
            out.push(finding({
              category: 'ux', severity: SEVERITY.MEDIUM, page: p.file,
              problem: `Overflow horizontal detectado em ${vp.name} (${vp.width}px) — a página é mais larga que a viewport.`,
              recommendation: 'Procurar elementos com largura fixa maior que a tela, ou imagens sem max-width:100%.',
            }));
          }

          if (screenshotDir) {
            const fname = `${p.file.replace(/\.html$/, '')}__${vp.name}.png`;
            try {
              await bpage.screenshot({ path: join(screenshotDir, fname), fullPage: false });
              screenshots.push({ page: p.file, viewport: vp.name, file: fname });
            } catch { /* non-fatal */ }
          }
        }

        await context.close();
      }
    }
  } finally {
    await browser.close();
  }

  return { findings: out, screenshots };
}

function truncate(s, n = 200) {
  return s.length > n ? s.slice(0, n) + '…' : s;
}
