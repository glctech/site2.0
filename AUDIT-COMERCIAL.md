# AUDIT-COMERCIAL.md — Agente de Auditoria Comercial e de Conversão

Documentação do agente de auditoria comercial/conversão/UX (`auditor/commercial/`).
Este é um agente **distinto** do agente técnico de manutenção documentado em
`AUDITORIA.md` — leia primeiro a seção abaixo para entender a diferença antes
de mexer em qualquer um dos dois.

## Este agente é 100% somente-leitura

**Regra fundamental do pedido original: este agente nunca altera o site.**
Ele nunca escreve em nenhum arquivo do site, nunca cria commit de código,
nunca abre Pull Request, nunca faz deploy. A única escrita que ele faz é o
próprio relatório, em `reports/commercial/` — e mesmo assim só commita esse
relatório (dado puro, nunca servido pelo Worker — ver `.assetsignore`),
nunca qualquer arquivo do site.

Compare com `AUDITORIA.md` (o outro agente): aquele PODE aplicar um
allowlist estreito de correções mecânicas e abrir PR de rascunho. Este
agente comercial não tem esse allowlist — não existe `fixer.mjs` nem
`git-pr.mjs` (além de `commitReportFiles`, importado só para o relatório)
neste diretório, de propósito.

## O que o agente faz

Reaproveita como "camada de evidência técnica" os mesmos checadores do
agente de manutenção (`../lib/check-*.mjs` — HTML/SEO/acessibilidade,
segurança, performance, links, navegador), e adiciona uma camada nova
específica de conversão (`check-conversion.mjs`):

- presença de CTA em cada página;
- clareza básica do texto do CTA de WhatsApp;
- número de campos em formulários (a página não usa `<form>` de verdade em
  todo lugar — `index.html` usa `<div id="contact-form">`, `trabalhe-conosco.html`
  usa `<form id="candidatura-form">` — o checador lida com os dois);
- consistência do número de WhatsApp usado em todos os links `wa.me/` do
  site, incluindo o `href` estático de fallback antes de qualquer
  JavaScript rodar;
- presença estrutural de prova social nas páginas de serviço;
- comprimento do H1 (heurística, evidência PROVÁVEL, nunca um veredito).

## O limite honesto do agente automático

Nenhum desses checks lê o site como um humano leria. Nenhum deles julga se
o tom de voz é adequado, se a proposta de valor "convence", ou se o site
"transmite confiança" — isso exige compreensão de linguagem natural que um
script Node não tem. A primeira auditoria (`reports/commercial/weekly/2026-08-12.md`)
inclui 3 pontos adicionados por uma revisão manual de verdade (lendo o
conteúdo das páginas), marcados como tal no relatório — eles **não** se
repetem sozinhos nas próximas execuções semanais. Se quiser essa camada
qualitativa de novo no futuro, é preciso pedir a um humano (ou a uma sessão
do Claude) para reler o site e escrever novos achados — o cron não faz isso
sozinho, e documentar essa limitação é melhor do que fingir que o script
"entende" o site.

## Regra de evidência

Todo achado carrega um nível de confiança:

| Nível | Significado |
|---|---|
| CONFIRMADO | Encontrado diretamente no código/site (ex.: número de WhatsApp diferente em dois arquivos). |
| PROVÁVEL | Inferido com evidência parcial (ex.: contagem de campos de formulário sugere fricção, mas não é uma medição de abandono real). |
| OPORTUNIDADE | Sugestão estratégica — não necessariamente um erro. |

Nenhum achado afirma uma métrica ou resultado de negócio sem ter essa
métrica — quando não é possível medir algo (ex.: taxa de conversão real,
volume de leads), o relatório escreve literalmente `NÃO FOI POSSÍVEL
DETERMINAR` ou "Não mensurado", nunca inventa um número.

## Como executar manualmente

```bash
node auditor/commercial/audit.mjs                                    # audita e gera relatório — nunca altera nada
node auditor/commercial/audit.mjs --email                            # idem, e envia por e-mail
node auditor/commercial/audit.mjs --skip-browser --skip-external-links  # mais rápido, para iterar localmente

node auditor/commercial/monthly.mjs                                  # consolida o mês atual
node auditor/commercial/monthly.mjs --email
node auditor/commercial/monthly.mjs 2026-07                          # mês específico
```

Não existe flag `DRY_RUN` aqui — não haveria nada para ela desligar, já que
o script nunca escreve fora de `reports/commercial/`.

## GitHub Secrets necessários

Os mesmos já documentados em `AUDITORIA.md`: `ZOHO_SMTP_USER`,
`ZOHO_SMTP_PASS`, `REPORT_EMAIL_TO` (opcional). Se o agente técnico já foi
configurado, nada precisa ser adicionado — os dois agentes reaproveitam os
mesmos secrets.

## GitHub Actions

- `.github/workflows/commercial-audit-weekly.yml` — domingo, 05:00 UTC (02:00
  horário de Brasília), + `workflow_dispatch`.
- `.github/workflows/commercial-audit-monthly.yml` — dia 1 de cada mês, 08:00
  UTC (alternativa ao "último dia útil do mês", já que cron não expressa
  "último dia do mês" nativamente — o spec original permite essa alternativa).

Note que nenhum dos dois workflows pede permissão `pull-requests: write` —
eles literalmente não têm capacidade de abrir PR.

## Como funciona a detecção de reincidência

`history.mjs` compara cada achado da auditoria atual com o snapshot da
auditoria anterior (`reports/commercial/_data/*.json`) usando página +
categoria + texto do problema como chave. Se o mesmo achado já existia,
ele é marcado `PENDENTE — REINCIDENTE` em vez de virar uma recomendação
duplicada. Se um achado da auditoria anterior desaparece nesta, ele entra
na seção "Possivelmente resolvidos (confirmar)" do relatório — o agente
nunca afirma que algo foi corrigido sem evidência de commit real.

## Erros parciais

Se alguma etapa falhar (ex.: um site externo não responde durante a
checagem de links), a auditoria continua as etapas independentes e marca o
relatório como parcialmente concluído, listando o erro — nunca finge que a
auditoria foi completa quando não foi (§25 do pedido original).
