# AUDITORIA.md — Agente de Auditoria e Manutenção Contínua

Documentação do agente de auditoria automática do site `glctech.com.br`
(`auditor/`). Este documento assume que você já leu o `README.md` (arquitetura
geral do site) — aqui é só sobre a ferramenta de auditoria em si.

## Sumário

- [Arquitetura](#arquitetura)
- [Como executar manualmente](#como-executar-manualmente)
- [Modo Dry Run](#modo-dry-run)
- [Como interpretar os relatórios](#como-interpretar-os-relatórios)
- [Configurar SMTP (envio de e-mail)](#configurar-smtp-envio-de-e-mail)
- [GitHub Secrets necessários](#github-secrets-necessários)
- [Como funciona o rollback](#como-funciona-o-rollback)
- [Autonomia com limites](#autonomia-com-limites)
- [Alterar periodicidade](#alterar-periodicidade)
- [Adicionar novas checagens](#adicionar-novas-checagens)
- [Desativar o agente](#desativar-o-agente)
- [Investigar uma falha](#investigar-uma-falha)

## Arquitetura

O site não tem build step (ver `README.md`), então o agente também não tem:
é um conjunto de scripts Node puros (`type: module`, zero dependências além
do Playwright, que já é sugerido no próprio escopo da auditoria) que rodam
tanto localmente quanto no GitHub Actions.

```
auditor/
├── run.mjs                    # orquestrador principal (audit | fix | full)
├── monthly.mjs                # consolidação mensal
├── postdeploy.mjs             # smoke test pós-deploy + revert de emergência
└── lib/
    ├── scan.mjs                # descoberta de páginas (via sitemap.xml) + parsing leve de HTML
    ├── finding.mjs              # formato padrão de "problema encontrado" + severidades
    ├── check-html-seo-a11y.mjs  # HTML válido, SEO, acessibilidade, headings, alt, noopener
    ├── check-security.mjs       # segredos hardcoded, mixed content, arquivos sensíveis
    ├── check-performance.mjs    # imagens pesadas, width/height, lazy loading, preconnects
    ├── check-links.mjs          # links internos (arquivo existe?) e externos (HTTP)
    ├── check-browser.mjs        # Playwright: console, requests falhas, overflow, screenshots
    ├── server.mjs                # servidor estático local (só para o audit rodar contra algo)
    ├── fixer.mjs                 # allowlist ESTREITA de correções automáticas seguras
    ├── report.mjs                 # gera o Markdown + JSON do relatório
    ├── compare.mjs                 # detecta problemas recorrentes (3+ semanas seguidas)
    ├── smtp-node.mjs               # cliente SMTP (Node) para enviar o e-mail — ver abaixo
    ├── email-templates.mjs          # corpo HTML dos e-mails semanal/mensal
    └── git-pr.mjs                    # commit em branch nova + abrir PR via API do GitHub

reports/
├── weekly/YYYY-MM-DD.md       # relatório humano de cada auditoria
├── monthly/YYYY-MM.md         # consolidação mensal
└── _data/YYYY-MM-DD.json      # snapshot de máquina (usado por compare.mjs)
```

**Por que não usei um DOM parser de verdade?** O site é HTML escrito à mão
com um estilo consistente; regex bem escopado (a mesma técnica usada
manualmente durante toda a auditoria original deste projeto) resolve os
casos reais sem adicionar uma dependência pesada. As checagens que
*precisam* de um navegador de verdade (erros de console, overflow,
screenshots) usam Playwright, que já roda neste ambiente e é citado no
próprio escopo da auditoria.

**Por que não recompila/otimiza imagens automaticamente?** Recompressão
altera bytes e, em graus variados, a aparência visual — a regra
"nunca corrigir um problema criando outro" e "preservar identidade visual"
tornam isso arriscado para fazer sem revisão humana. Imagens pesadas são
**reportadas**, não alteradas.

## Como executar manualmente

```bash
npm install                       # primeira vez (instala Playwright)

npm run audit                     # audita e gera relatório — NUNCA altera nada
npm run audit:fix                 # audita + aplica correções seguras localmente (não commita)
npm run audit:full                # audita + corrige + testa + (se seguro) commita numa branch + abre PR

node auditor/monthly.mjs          # gera o relatório mensal do mês atual (não envia e-mail)
node auditor/monthly.mjs --email  # idem, e envia por e-mail
node auditor/monthly.mjs 2026-07  # consolida um mês específico
```

Flags úteis:

- `--skip-browser` — pula as checagens com Playwright (mais rápido, útil pra
  iterar localmente).
- `--skip-external-links` — pula a checagem de links externos via HTTP (evita
  esperar timeouts se você estiver sem internet).
- `--email` — só junto com `full`, envia o relatório semanal por e-mail
  (requer `DRY_RUN=false` e as variáveis de SMTP — ver abaixo).
- `--base-url=http://exemplo/` — audita uma URL já publicada em vez de subir
  um servidor local (é o que `auditor/postdeploy.mjs` faz contra produção).

## Modo Dry Run

```bash
DRY_RUN=true  npm run audit:full   # (padrão) audita, sugere, testa, gera relatório — NÃO altera nada
DRY_RUN=false npm run audit:full   # aplica correções seguras de verdade e pode abrir PR
```

**`DRY_RUN=true` é o padrão** se a variável não estiver definida — inclusive
no workflow agendado semanal (ver abaixo). Isso significa que **a auditoria
automática nunca vai, sozinha, começar a abrir PRs** até alguém rodar o
workflow manualmente com a caixa "dry_run" desmarcada pelo menos uma vez.
Essa é uma decisão deliberada: a especificação pede explicitamente que a
primeira execução seja só leitura, e o mesmo raciocínio vale pra qualquer
execução *não supervisionada* — melhor pecar pelo lado conservador até
haver confiança acumulada nos relatórios.

O relatório (Markdown + JSON) é sempre gerado e commitado em `reports/`,
mesmo em dry-run — isso não é "alterar o site" (o Cloudflare Worker nem
serve esses arquivos, ver `.assetsignore`), é o próprio produto da
auditoria, e é o que permite a comparação semana-a-semana funcionar.

## Como interpretar os relatórios

Cada `reports/weekly/YYYY-MM-DD.md` tem:

- **Cabeçalho** — data, duração, modo, páginas analisadas, contagens, status
  de deploy/rollback.
- **Resumo por severidade** — CRÍTICO / ALTO / MÉDIO / BAIXO (ver definição
  completa mais abaixo).
- **Problemas recorrentes** — só aparece se algo se repetiu em 3+ auditorias
  seguidas; vale investigar a causa estrutural em vez de corrigir de novo.
- **Problemas encontrados** — um bloco por problema com `ID`, categoria,
  página/linha, causa, recomendação e status (`detectado` ou
  `corrigido automaticamente`).
- **Melhorias realizadas** — lista curta do que foi de fato alterado nesta
  execução.
- **Testes** — resultado dos testes de regressão pós-correção.

Severidades:

| Severidade | O que significa | O agente corrige sozinho? |
|---|---|---|
| CRÍTICO | site fora do ar, página quebrada, falha grave de segurança | Só se estiver no allowlist de `fixer.mjs`; senão, fica marcado "AÇÃO NECESSÁRIA — APROVAÇÃO HUMANA" |
| ALTO | erro de JS, link importante quebrado, SEO/acessibilidade importante ausente | Só via allowlist |
| MÉDIO | SEO/acessibilidade/performance secundários, código | Só via allowlist |
| BAIXO | pequenas melhorias, cosmético | Só via allowlist |

**A severidade não decide sozinha se algo é corrigido** — só o allowlist de
`fixer.mjs` decide (ver abaixo). Um problema CRÍTICO fora do allowlist vira
recomendação para um humano, não uma correção automática arriscada.

### O que o agente corrige sozinho hoje (allowlist)

1. `<img>` com `width`/`height` nos atributos e `style` inline travando só
   uma dimensão → adiciona `width:auto` (o mesmo bug de distorção corrigido
   manualmente no PR #13 deste repositório).
2. `<a target="_blank">` sem `rel="noopener"` → adiciona.
3. `<html>` sem `lang` → adiciona `lang="pt-BR"`.
4. `<img>` fora da primeira imagem da página sem `loading="lazy"` → adiciona.

Tudo o resto vira recomendação. O allowlist é intencionalmente pequeno —
ver `auditor/lib/fixer.mjs` para a lista completa e o raciocínio de cada
regra. Ampliar essa lista é uma escolha explícita (editar o arquivo), não
algo que a IA decide sozinha em tempo de execução.

## Configurar SMTP (envio de e-mail)

O site **já tem** um cliente SMTP para Zoho (`functions/api/_lib/smtp.mjs`),
mas ele usa `cloudflare:sockets`, uma API exclusiva do runtime de Workers —
não funciona num runner do GitHub Actions (Node puro). Por isso existe
`auditor/lib/smtp-node.mjs`: o mesmo protocolo (SMTP com TLS implícito,
porta 465, mirando o Zoho), só que sobre o módulo `tls` nativo do Node.

**Importante:** as credenciais Zoho já configuradas como *variável de
ambiente do Worker* (no painel da Cloudflare) **não** ficam automaticamente
disponíveis para o GitHub Actions — são dois cofres de segredo diferentes,
mesmo que o valor seja o mesmo usuário/senha. É preciso cadastrar de novo,
agora como *GitHub Secret* (ver próxima seção).

## GitHub Secrets necessários

Em **Settings → Secrets and variables → Actions** deste repositório:

| Secret | Obrigatório | Descrição |
|---|---|---|
| `ZOHO_SMTP_USER` | Para enviar e-mail | Mesmo valor do Worker: a caixa que envia, ex. `contato@glctech.com.br` |
| `ZOHO_SMTP_PASS` | Para enviar e-mail | Senha de aplicativo do Zoho (não a senha normal da conta) |
| `REPORT_EMAIL_TO` | Opcional | Destino do relatório. Padrão: `diretoria@glctech.com.br` |

`GITHUB_TOKEN` **não precisa ser criado** — o GitHub injeta esse token
automaticamente em todo workflow; os workflows deste projeto já pedem as
permissões certas (`contents: write`, `pull-requests: write`) no próprio
arquivo `.yml`.

Sem `ZOHO_SMTP_USER`/`ZOHO_SMTP_PASS` configurados, a auditoria continua
funcionando normalmente (audita, corrige, abre PR) — só o envio de e-mail
falha, e isso fica registrado no log do workflow, não trava o resto.

## Como funciona o rollback

Existem duas camadas, para dois momentos diferentes:

**1. Antes de qualquer commit (a mais comum).** Depois de aplicar as
correções do allowlist, o agente roda os mesmos checadores estáticos + uma
passada de Playwright *só nas páginas alteradas*. Se aparecer algo
CRÍTICO/ALTO novo que não existia antes, as alterações daquela execução são
**descartadas antes de qualquer `git add`/`commit`** — ou seja, o rollback
mais barato que existe: nunca chega a existir um commit ruim. Isso fica
registrado no relatório (`Rollback: SIM — ...`).

**2. Depois do merge, já em produção** (`auditor/postdeploy.mjs`, workflow
`post-deploy-check.yml`). Testa o site *já publicado* depois de um merge, com
até 3 tentativas (20s de intervalo) antes de concluir qualquer coisa — status
403/429/401 nunca contam como quebra sozinhos (ver incidente abaixo), só
5xx, timeout, erro de conexão ou uma resposta 200 anormalmente pequena.

Se confirmar quebra real, **por padrão o script só alerta** (falha o job,
explica o que encontrou no log) — ele NÃO reverte nem publica nada sozinho,
a menos que a variável de repositório `AUTO_REVERT_ON_BREAKAGE` esteja
definida como `true` (Settings → Secrets and variables → Actions →
Variables). Só ative isso depois de acompanhar o script alertar (sem agir)
algumas vezes e confiar no julgamento dele. Quando ativado, o revert:

1. roda `git revert -m 1 --no-edit <commit>` (nunca `reset --hard`, nunca
   reescreve histórico);
2. dá push direto em `glctech2.0`;
3. registra tudo no log do workflow.

Trava de segurança: se o commit que já ia ser revertido **já é** um revert
automático anterior, o agente para e pede aprovação humana em vez de
continuar revertendo às cegas (pode ser um problema de infraestrutura
externa — este projeto já teve problemas assim com CDN/DNS fora do
repositório).

### Incidente de 2026-08-12

Na primeira execução real deste workflow (logo após o merge da PR #15), o
smoke test recebeu HTTP 403 em todas as páginas — quase certamente uma
oscilação do WAF/CDN em frente ao domínio (o mesmo tipo de instabilidade já
documentada neste projeto), não uma quebra real de código. Isso já teria
sido resolvido pela trava de "não revert em 403" que existe agora — mas na
época essa trava ainda não existia, e o script tentou reverter. Só que o
checkout do workflow usava a profundidade padrão (`fetch-depth: 1`, um clone
raso, sem o histórico de pais do commit de merge). Sem essa informação,
`git revert` não conseguiu calcular um diff cirúrgico e apagou o repositório
inteiro (93 arquivos) num único commit, ao invés de desfazer só as mudanças
da PR #15. Alguém percebeu e restaurou manualmente os arquivos via upload
pelo GitHub, o que devolveu o conteúdo do site mas não a pasta
`.github/workflows/` (upload por arraste geralmente ignora pastas ocultas
como `.github`), então os workflows (inclusive o `zabbix-stats.yml` original,
sem relação com este projeto de auditoria) tiveram que ser restaurados à
parte.

**Correções aplicadas depois do incidente:**
- `post-deploy-check.yml` agora usa `fetch-depth: 0` (histórico completo).
- `postdeploy.mjs` tenta múltiplas vezes, nunca trata 403/429/401 como prova
  de quebra, usa `git revert -m 1` (mainline explícito, redundância de
  segurança) e **o revert automático agora é opt-in**, desligado por padrão.

## Autonomia com limites

Por padrão, **o agente nunca dá merge sozinho em nenhum PR**, exceto o caso
de emergência do rollback pós-deploy acima. Todo PR de correção
(`chore(audit): correções automáticas — YYYY-MM-DD`) é aberto como
**draft**, esperando revisão humana — o mesmo fluxo usado manualmente
durante todo o desenvolvimento deste site.

O agente **nunca** faz automaticamente:

- mudança de identidade visual, cores, logotipo, tipografia;
- alteração de texto institucional (não inventa conteúdo — ver `finding.mjs`,
  todo "não sei" vira literalmente `NÃO FOI POSSÍVEL DETERMINAR`);
- remoção de páginas ou funcionalidades;
- alteração de URLs/estrutura de navegação;
- mudanças em `functions/api/**`, `_worker.js`, `wrangler.toml` (fora do
  escopo do allowlist — essas mudanças exigem entendimento profundo do fluxo
  de e-mail/stats, não é algo que um fixer mecânico deveria tocar);
- qualquer coisa em DNS/domínio/serviços externos.

Se uma checagem encontra algo nessas categorias, o relatório marca
explicitamente **"AÇÃO NECESSÁRIA — APROVAÇÃO HUMANA"**.

## Alterar periodicidade

Editar o `cron:` em `.github/workflows/site-audit-weekly.yml` (semanal) ou
`.github/workflows/site-audit-monthly.yml` (mensal). Os crons do GitHub
Actions são em UTC — o valor atual (`0 6 * * 1`, segunda 06:00 UTC) equivale
a segunda 03:00 no horário de Brasília.

## Adicionar novas checagens

1. Criar (ou estender) um módulo em `auditor/lib/check-*.mjs` que devolve uma
   lista de `finding(...)` (ver `auditor/lib/finding.mjs` pro formato).
2. Importar e chamar esse módulo em `auditor/run.mjs`.
3. Se a nova checagem também tiver uma correção mecânica e segura, registrar
   `autoFixable: true, fixId: '...'` no finding e implementar o fixer
   correspondente em `auditor/lib/fixer.mjs` — só faça isso se a correção for
   *inequívoca* (sem necessidade de julgamento/criatividade).
4. Rodar `npm run audit` localmente e conferir o relatório antes de deixar
   rodar em CI.

## Desativar o agente

- **Temporariamente:** em Settings → Actions do repositório, desativar os
  workflows `Auditoria Semanal do Site`, `Auditoria Mensal do Site
  (consolidação)` e/ou `Verificação Pós-Deploy`.
- **Permanentemente:** apagar os três arquivos `.github/workflows/site-audit-*.yml`
  e `.github/workflows/post-deploy-check.yml` (o `auditor/` em si pode ficar,
  ele só roda se algo o disparar).

## Investigar uma falha

1. Abrir a aba **Actions** do repositório → o workflow que falhou → o job →
   os logs têm prefixo `[INFO]`/`[ERROR]` explicando cada etapa.
2. Baixar o artifact `audit-report-<run_id>` anexado à execução — tem o
   Markdown completo, o JSON e os screenshots (desktop/tablet/mobile) de cada
   página, mesmo que o e-mail não tenha sido enviado.
3. Se a falha foi no envio de e-mail: confirmar que `ZOHO_SMTP_USER`/
   `ZOHO_SMTP_PASS` estão cadastrados como *GitHub Secret* (não só na
   Cloudflare) e que a senha é uma senha de aplicativo válida do Zoho.
4. Se a falha foi um PR não abrindo: conferir se o `GITHUB_TOKEN` do
   workflow tem permissão de `pull-requests: write` (já vem configurado no
   `.yml`, mas pode ter sido restringido nas configurações do repositório).
5. Se o `post-deploy-check.yml` reverteu algo: o commit de revert já está em
   `glctech2.0` com uma mensagem clara (`Revert "..."`) — o log do workflow
   mostra qual verificação falhou (status HTTP, timeout, resposta vazia).
