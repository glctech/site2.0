#!/usr/bin/env node
/* ============================================================================
 * newsletter-novidade.mjs — ajuda a publicar uma "Novidade GLCTech" na
 * newsletter sem escrever o INSERT na mão.
 * ----------------------------------------------------------------------------
 * Convenção de upload (via GitHub, direto em assets/screens/):
 *   assets/screens/<nome-do-modulo>_1.jpg   (ou _2, _3 — até 3 candidatas,
 *   assets/screens/<nome-do-modulo>_2.jpg    jpg/jpeg/png/webp, qualquer sufixo
 *   assets/screens/<nome-do-modulo>_3.jpg    que ordene 1/2/3 alfabeticamente)
 *   assets/screens/<nome-do-modulo>.md       (texto da novidade, ver formato
 *                                              abaixo)
 *
 * Formato do .md (front matter simples + corpo = resumo):
 *   title: Nova parceria com Veeam
 *   url: https://glctech.com.br/veeam.html
 *   ---
 *   Resumo curto que vai aparecer no corpo do e-mail. Pode ter várias linhas.
 *
 * Uso:
 *   1) Listar candidatas para escolher visualmente a melhor imagem:
 *        node scripts/newsletter-novidade.mjs <nome-do-modulo>
 *
 *   2) Depois de escolher (ex.: a 2ª da lista impressa acima):
 *        node scripts/newsletter-novidade.mjs <nome-do-modulo> --choose 2
 *      Isso move a vencedora para assets/novidades/<nome-do-modulo>.<ext>,
 *      apaga as outras 2 candidatas e o .md de assets/screens/, e imprime
 *      (sem executar) o comando `wrangler d1 execute` pronto para rodar.
 *
 *   Acrescente --run para executar o wrangler d1 execute de verdade (grava em
 *   produção — use com cuidado). Sem --run, o script só imprime o comando e
 *   o caminho do .sql gerado.
 * ==========================================================================*/

import { readdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const SCREENS_DIR = join(ROOT, 'assets', 'screens');
const NOVIDADES_DIR = join(ROOT, 'assets', 'novidades');
const IMAGE_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp']);

const log = (m) => console.log(m);
const fail = (m) => { console.error(`[ERRO] ${m}`); process.exitCode = 1; };

function parseArgs(argv) {
  const [nome, ...rest] = argv;
  const chooseIdx = rest.indexOf('--choose');
  const choose = chooseIdx >= 0 ? Number(rest[chooseIdx + 1]) : null;
  const run = rest.includes('--run');
  return { nome, choose, run };
}

async function findCandidates(nome) {
  let files = [];
  try { files = await readdir(SCREENS_DIR); } catch { return []; }
  return files
    .filter((f) => f.startsWith(nome) && IMAGE_EXT.has(extname(f).toLowerCase()))
    .sort();
}

async function getWorkerUrl() {
  const toml = await readFile(join(ROOT, 'wrangler.toml'), 'utf8');
  const m = toml.match(/WORKER_URL\s*=\s*"([^"]+)"/);
  return m ? m[1] : 'https://site2-0.aluiz-cez.workers.dev';
}

/** Front matter simples: linhas "chave: valor" até um "---", resto é o corpo. */
function parseNewsMarkdown(raw) {
  const lines = raw.split(/\r?\n/);
  const sepIdx = lines.findIndex((l) => l.trim() === '---');
  const headerLines = sepIdx >= 0 ? lines.slice(0, sepIdx) : [];
  const bodyLines = sepIdx >= 0 ? lines.slice(sepIdx + 1) : lines;

  const meta = {};
  for (const line of headerLines) {
    const m = line.match(/^(\w+):\s*(.*)$/);
    if (m) meta[m[1].toLowerCase()] = m[2].trim();
  }

  const summary = bodyLines.join(' ').replace(/\s+/g, ' ').trim();
  return { title: meta.title || null, url: meta.url || null, summary };
}

const sqlEscape = (s) => `'${String(s).replace(/'/g, "''")}'`;

async function main() {
  const { nome, choose, run } = parseArgs(process.argv.slice(2));
  if (!nome) {
    fail('uso: node scripts/newsletter-novidade.mjs <nome-do-modulo> [--choose N] [--run]');
    return;
  }

  const candidates = await findCandidates(nome);
  if (candidates.length === 0) {
    fail(`nenhuma imagem encontrada em assets/screens/ começando com "${nome}".`);
    return;
  }

  if (choose == null) {
    log(`${candidates.length} candidata(s) em assets/screens/ para "${nome}":`);
    candidates.forEach((f, i) => log(`  ${i + 1}. ${join('assets', 'screens', f)}`));
    log('\nReveja as imagens e rode de novo com --choose <número> para aplicar a escolhida.');
    return;
  }

  const winner = candidates[choose - 1];
  if (!winner) {
    fail(`--choose ${choose} inválido — só há ${candidates.length} candidata(s).`);
    return;
  }

  const mdPath = join(SCREENS_DIR, `${nome}.md`);
  let meta;
  try {
    meta = parseNewsMarkdown(await readFile(mdPath, 'utf8'));
  } catch {
    fail(`não encontrei ${join('assets', 'screens', `${nome}.md`)} — crie o arquivo com o texto da novidade (ver cabeçalho deste script).`);
    return;
  }
  if (!meta.title) {
    fail(`${nome}.md precisa de uma linha "title: ..." antes do separador "---".`);
    return;
  }
  if (!meta.summary) {
    fail(`${nome}.md não tem corpo (resumo) depois do "---".`);
    return;
  }

  const ext = extname(winner);
  const destPath = join(NOVIDADES_DIR, `${nome}${ext}`);
  await rename(join(SCREENS_DIR, winner), destPath);
  for (const loser of candidates) {
    if (loser !== winner) await rm(join(SCREENS_DIR, loser));
  }
  await rm(mdPath);
  log(`Imagem escolhida movida para ${join('assets', 'novidades', `${nome}${ext}`)}; as outras candidatas e o .md foram removidos.`);

  const workerUrl = await getWorkerUrl();
  const imageUrl = `${workerUrl}/assets/novidades/${nome}${ext}`;
  const columns = ['title', 'summary', 'image_url'];
  const values = [sqlEscape(meta.title), sqlEscape(meta.summary), sqlEscape(imageUrl)];
  if (meta.url) { columns.push('url'); values.push(sqlEscape(meta.url)); }

  const sql = `INSERT INTO company_news (${columns.join(', ')}) VALUES (${values.join(', ')});`;
  const sqlFile = join(tmpdir(), `newsletter-novidade-${nome}-${Date.now()}.sql`);
  await writeFile(sqlFile, sql + '\n', 'utf8');

  log('\nSQL gerado:');
  log(`  ${sql}`);
  log(`\nArquivo: ${sqlFile}`);
  log(`Comando: wrangler d1 execute glctech-newsletter --remote --file="${sqlFile}"`);
  log('\nLembre-se: a imagem só fica acessível nessa URL depois de `wrangler deploy` (o Worker precisa publicar assets/novidades/ atualizado).');

  if (run) {
    log('\n--run informado — executando wrangler d1 execute...');
    execFileSync('wrangler', ['d1', 'execute', 'glctech-newsletter', '--remote', `--file=${sqlFile}`], { stdio: 'inherit', cwd: ROOT });
  }
}

main().catch((e) => { fail(e.stack || e.message); });
