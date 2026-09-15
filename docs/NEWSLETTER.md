# Boletim GLCTech — agente de newsletter

Newsletter semanal de cibersegurança e novidades da GLCTech, rodando no mesmo
Worker que já serve `/api/send-email` e `/api/stats` (ver
[`ARCHITECTURE.md`](ARCHITECTURE.md) e [`INTEGRATIONS.md`](INTEGRATIONS.md)).

> **Antes de produção:** todo o fluxo roda em `TEST_MODE`, com envio
> exclusivo para `TEST_RECIPIENT`. Veja [Plano de teste](#plano-de-teste).

---

## Sumário

1. [O que já está pronto no código](#o-que-já-está-pronto-no-código)
2. [O que falta — só quem tem acesso ao Cloudflare consegue fazer](#o-que-falta--só-quem-tem-acesso-ao-cloudflare-consegue-fazer)
3. [Por que os links funcionais usam outro domínio](#por-que-os-links-funcionais-usam-outro-domínio)
4. [Plano de teste](#plano-de-teste)
5. [Checklist de go-live](#checklist-de-go-live)
6. [Operação semanal](#operação-semanal)
7. [Decisões de design](#decisões-de-design)

---

## O que já está pronto no código

```
functions/api/newsletter/
├── subscribe.js      # POST — inscrição com double opt-in (LGPD)
├── confirm.js         # GET  — confirma a inscrição (link de 48h)
├── unsubscribe.js      # GET (página) + POST (1 clique, RFC 8058)
├── generate.js         # POST — admin-only, gera um rascunho manualmente
└── approve.js           # GET (página de confirmação) + POST (envia de fato)

functions/api/_lib/newsletter/
├── security.mjs   # tokens HMAC, checagem de admin (comparação em tempo constante)
├── feeds.mjs        # coleta RSS (fontes brasileiras — CERT.br etc.)
├── agent.mjs         # chamada à API da Anthropic, retorna JSON estruturado
├── template.mjs      # HTML + texto do e-mail, com escape (anti-XSS)
├── mailer.mjs          # envio via o SMTP Zoho já existente (_lib/smtp.mjs)
└── pipeline.mjs         # orquestra: coleta → geração → preview → envio

functions/api/_lib/smtp.mjs   # ESTENDIDO (não recriado) para suportar corpo
                                 HTML + cabeçalhos extras (List-Unsubscribe),
                                 mantendo 100% de compatibilidade com o uso
                                 atual (contato/candidatura continuam só texto).

migrations/0001_newsletter.sql   # schema D1: subscribers, issues, company_news

index.html   → formulário de inscrição no rodapé (`#newsletter-form`)
_worker.js   → rotas registradas + handler `scheduled` (cron semanal)
wrangler.toml → binding D1, cron trigger, variáveis (ver comentários no arquivo)
```

**Decisões de segurança já implementadas** (mesmas do desenho original, mais
duas correções aplicadas nesta adaptação):

- **Aprovação humana em duas etapas.** O link do e-mail de preview abre uma
  página com um botão — nada é enviado só de abrir o link (GET). Só o clique
  no botão (POST) dispara o envio. Isso existe especificamente porque
  scanners de segurança corporativos (Outlook Safe Links, gateways de
  e-mail) pré-visitam links automaticamente; se "aprovar" fosse um GET
  direto, um desses scanners dispararia o envio real sem intenção humana.
- **O agente de IA nunca escreve HTML nem URLs** — só JSON referenciando
  itens por índice. O template (código nosso) resolve o link real a partir
  do item original. Mesmo que um feed contenha texto malicioso tentando
  instruir o modelo, o pior resultado possível é aparecer como resumo de
  notícia — nunca como link executável.
- **Comparação em tempo constante** também no token do admin (`ADMIN_TOKEN`),
  não só nos tokens HMAC — evita timing attack no endpoint `/generate`.
- **`TEST_RECIPIENT` é uma caixa da empresa** (`contato@glctech.com.br`), não
  um e-mail pessoal — evita deixar dado pessoal de alguém commitado no
  `wrangler.toml`.
- **Trava atômica contra clique duplo** em `sendIssue` (`UPDATE ... WHERE
  status='draft'` com checagem de `changes === 0`) — clicar "aprovar" duas
  vezes nunca reenvia.

---

## O que falta — só quem tem acesso ao Cloudflare consegue fazer

**Status atual (feito em 2026-09-15):**

- [x] Banco D1 `glctech-newsletter` criado (`database_id` já em `wrangler.toml`)
- [x] Migration `0001_newsletter.sql` aplicada em produção (`--remote`)
- [x] Secret `HMAC_SECRET` configurado
- [x] Secret `ADMIN_TOKEN` configurado (valor entregue a quem pediu o deploy —
      guardar em gerenciador de senhas; não está em nenhum arquivo do repo)
- [ ] Secret `ANTHROPIC_API_KEY` — falta uma chave de console.anthropic.com
- [x] `wrangler.toml`: corrigido `name` de `shy-river-6fc7` (nunca usado pelo
      Worker real) para `site2-0` (nome real do Worker em produção, visto nos
      builds do Cloudflare) — evita repetir o engano de criar um Worker vazio
      com o nome errado ao rodar `wrangler secret put`/`wrangler deploy` na CLI

Falta só:

```bash
# Configurar o secret que falta (nunca no wrangler.toml nem no código)
wrangler secret put ANTHROPIC_API_KEY --name site2-0     # console.anthropic.com
#   (ZOHO_SMTP_USER / ZOHO_SMTP_PASS já existem — são os mesmos do
#    contato/candidatura, ver INTEGRATIONS.md)
```

O deploy do código em si **não precisa de `wrangler deploy` manual** — este
repositório usa Cloudflare Workers Builds com integração Git: todo push na
branch de produção (`glctech2.0`) já dispara o build/deploy sozinho.

Para desenvolvimento local, criar `.dev.vars` (confirmar que está no
`.gitignore`):

```
ANTHROPIC_API_KEY=sk-ant-...
HMAC_SECRET=...
ADMIN_TOKEN=...
ZOHO_SMTP_USER=...
ZOHO_SMTP_PASS=...
```

Adicionar uma novidade da GLCTech para a próxima edição (a seção "Novidade
GLCTech" tem destaque visual logo após a introdução do boletim — `image_url`
é opcional, mas recomendado para chamar mais atenção; precisa ser uma URL
pública, nunca um link de repositório privado):

```bash
wrangler d1 execute glctech-newsletter --remote --command \
"INSERT INTO company_news (title, summary, url, image_url) VALUES ('Nova parceria', 'Resumo curto...', 'https://glctech.com.br/...', 'https://glctech.com.br/assets/novidades/exemplo.png')"
```

---

## Por que os links funcionais usam outro domínio

`glctech.com.br` hoje é servido por uma cadeia de CDN (Fastly + GitHub
Pages, atrás do Cloudflare) que **não roteia `/api/*` para este Worker** —
é por isso que o formulário de contato já chama
`https://site2-0.aluiz-cez.workers.dev/api/send-email` diretamente, em vez
do caminho relativo (ver [`INTEGRATIONS.md`](INTEGRATIONS.md)).

A newsletter segue a mesma regra:

- **`SITE_URL`** (`https://glctech.com.br`) — só aparece como texto/marca
  nos e-mails ("você se inscreveu em..."). Nunca usado para montar um link
  clicável funcional.
- **`WORKER_URL`** (`https://site2-0.aluiz-cez.workers.dev`) — usado para
  **todo** link que precisa efetivamente funcionar: confirmar inscrição,
  cancelar inscrição, aprovar edição.

**Quando o CDN externo for corrigido** para repassar `POST /api/*` (ver nota
em `INTEGRATIONS.md`), atualizar `WORKER_URL` em `wrangler.toml` para
`https://glctech.com.br` e pronto — nada mais no código precisa mudar.

---

## Plano de teste

Mesma lógica do desenho original, adaptada para `contato@glctech.com.br`
como destinatário de teste e para as rotas deste projeto.

### Fase A — Local (`wrangler dev`)

| # | Ação | Resultado esperado |
|---|---|---|
| A1 | `wrangler d1 migrations apply glctech-newsletter --local` | Tabelas criadas |
| A2 | `wrangler dev --test-scheduled` | Worker rodando em `http://localhost:8787` |
| A3 | `curl -X POST http://localhost:8787/api/newsletter/subscribe -H 'Content-Type: application/json' -d '{"email":"contato@glctech.com.br","consent":true}'` | `{"ok":true}` + e-mail de confirmação |
| A4 | Clicar em "Confirmar inscrição" | Página "Inscrição confirmada" |
| A5 | `wrangler d1 execute glctech-newsletter --local --command "SELECT email,status FROM subscribers"` | `status = active` |
| A6 | `curl -X POST http://localhost:8787/api/newsletter/generate -H "Authorization: Bearer $ADMIN_TOKEN"` | JSON com `issueId` + e-mail `[RASCUNHO #1]` |
| A7 | Revisar o conteúdo do preview | Nenhuma notícia inventada; links abrem as fontes corretas |
| A8 | Abrir o link "Revisar e aprovar" do e-mail | Página com botão — **nada enviado ainda** |
| A9 | Clicar no botão da página | "Newsletter enviada ... (TEST_MODE ativo)" |
| A10 | Caixa de `contato@glctech.com.br` | E-mail `[TESTE] ...` com banner amarelo |
| A11 | Recarregar a página de aprovação e clicar de novo | "Já processado" (sem reenvio) |
| A12 | Clicar "Cancelar inscrição" no e-mail | Página de confirmação; `status = unsubscribed` |

Casos negativos:

```bash
curl -X POST http://localhost:8787/api/newsletter/subscribe -H 'Content-Type: application/json' -d '{"email":"x","consent":true}'          # 400 invalid_email
curl -X POST http://localhost:8787/api/newsletter/subscribe -H 'Content-Type: application/json' -d '{"email":"a@b.com.br"}'                  # 400 consent_required
curl -X POST http://localhost:8787/api/newsletter/generate                                                                                    # 401 unauthorized
```

### Fase B — Produção com `TEST_MODE=true`

| # | Ação | Resultado esperado |
|---|---|---|
| B1 | Confirmar `TEST_MODE="true"` no `wrangler.toml` | — |
| B2 | `wrangler deploy` | Deploy OK |
| B3 | Inscrever pelo **formulário do site** (rodapé) | "Confira seu e-mail..." |
| B4 | Confirmar pelo link | Página de sucesso |
| B5 | Inscrever um segundo e-mail e confirmar | Serve para provar que TEST_MODE ignora a lista real |
| B6 | Gerar rascunho (`generate`, com `Authorization`) | Preview chega em `contato@glctech.com.br` |
| B7 | Aprovar (GET → POST) | Só o e-mail de `TEST_RECIPIENT` recebe; o segundo e-mail **não** recebe |
| B8 | No e-mail recebido → ver cabeçalhos originais | `SPF: PASS`, `DKIM: PASS`, `DMARC: PASS` (deve herdar a autenticação já existente do domínio, por reusar a mesma caixa Zoho) |
| B9 | Gmail/Outlook mostram "Cancelar inscrição" ao lado do remetente | Cabeçalho `List-Unsubscribe` funcionando |
| B10 | Verificar nota em mail-tester.com (adicionar o endereço deles como `TEST_RECIPIENT` temporariamente) | Nota ≥ 9/10 |
| B11 | Abrir em desktop e mobile, tema claro e escuro | Layout legível |
| B12 | Deixar o cron rodar numa segunda-feira | Preview chega sem intervenção manual |

### Fase C — Qualidade editorial (2–3 edições em TEST_MODE)

Conferir cada "top story" contra a fonte original, ajustar o `SYSTEM` prompt
em `agent.mjs` e a lista `FEEDS` em `feeds.mjs` conforme necessário. Só
avançar para produção quando a última edição estiver aprovável sem edição
manual.

---

## Checklist de go-live

**Técnico**
- [ ] Fases A, B e C concluídas
- [ ] `database_id` real no `wrangler.toml` (não mais o placeholder)
- [ ] Secrets configurados via `wrangler secret`; `.dev.vars` no `.gitignore`

**Legal (LGPD)**
- [ ] Política de privacidade (`politica.html`) atualizada citando a
      newsletter, base legal (consentimento), e que a redação do conteúdo
      usa a API da Anthropic
- [ ] Checkbox de consentimento desmarcado por padrão — já implementado
- [ ] Procedimento definido para pedidos de exclusão de dados (`DELETE FROM
      subscribers WHERE email=?` no D1)

**Virada**
- [ ] Excluir inscrições de teste que não devem ficar na lista
- [ ] `TEST_MODE = "false"` e `wrangler deploy`
- [ ] Primeira edição real: revisar o preview com atenção redobrada antes
      de aprovar
- [ ] Manter `ADMIN_EMAIL` recebendo previews permanentemente

---

## Operação semanal

Segunda-feira, 11h UTC (08h em São Paulo) chega o rascunho em
`contato@glctech.com.br` → revisar → abrir o link → clicar "Aprovar e
enviar". Sem esse clique, nada sai.

Para adicionar uma novidade da empresa antes da próxima edição, ver o
comando `INSERT INTO company_news` acima.

---

## Decisões de design

- **Reaproveita a caixa Zoho já autenticada** (`ZOHO_SMTP_USER`) em vez de
  um mailbox `newsletter@` dedicado — evita configurar SPF/DKIM/DMARC do
  zero; a autenticação do domínio já existe e está provada em produção
  (formulário de contato).
- **Sem dependências novas** (`fast-xml-parser` etc.) — `feeds.mjs` usa um
  parser RSS mínimo por regex, consistente com a filosofia "sem passo de
  build" do projeto (ver `ARCHITECTURE.md`) e com `smtp.mjs`, que já evita
  `nodemailer` pelo mesmo motivo.
- **Fontes de notícias brasileiras** (CERT.br, CISO Advisor, The Hack, IT
  Forum, Tecnoblog) — como o público é PME no Brasil, mantém a newsletter
  totalmente em português, sem depender de tradução de fontes em inglês.
- **Uma conexão SMTP por destinatário** no envio em massa (mesma limitação
  do `_lib/smtp.mjs` original). Adequado para uma lista pequena/inicial; se
  crescer para centenas/milhares de inscritos, migrar o laço de envio em
  `pipeline.mjs` para Cloudflare Queues.
