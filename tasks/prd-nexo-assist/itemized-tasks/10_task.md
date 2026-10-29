# Tarefa 10.0: Deploy e README

<critical>Ler os arquivos `../prd.md` e `../techspec.md` (um nível acima desta pasta), se você não ler esses arquivos sua tarefa será invalidada</critical>
<critical>Ler também `AGENTS.md`, `docs/agents/worker.md` e `.claude/rules/README.md` antes de começar</critical>

## Execução

| Campo | Valor |
|---|---|
| Executada por | worker (README, script e config); o deploy em si é feito pelo orquestrador com as contas do usuário |
| Depende de | 9.0 |
| Paralelizável | não |
| Worktree | atual |

## Visão Geral

Preparar o projeto para entrega:
- o relatório de custo por conversa;
- a configuração de deploy na Vercel com Neon;
- o **README completo** exigido pelo desafio.

O deploy (criação do projeto Neon, variáveis na Vercel e publicação) é feito depois pelo orquestrador junto com o usuário. O worker não acessa contas.

<requirements>
- `scripts/usage-report.ts` (`pnpm usage:report`): lê `app.usage_ledger` e imprime o custo total, o custo médio por conversa, os tokens médios por turno e a distribuição por modelo, no período informado por argumento (padrão: últimos 7 dias).
- `vercel.json` só se for necessário (ex.: `maxDuration` da rota de stream, região `gru1`). Comandos de build: `pnpm db:migrate && pnpm build` via script ou documentação, sem rodar o seed em produção automaticamente.
- `README.md` em português, cobrindo **todas** as seções exigidas pelo desafio (`../prd.md`, RF53):
  1. Visão geral do produto e link do deploy (placeholder `<!-- DEPLOY_URL -->`, preenchido pelo orquestrador).
  2. **Como rodar localmente:** pré-requisitos (Node, pnpm, Docker), `.env` a partir do `.env.example`, `docker compose up -d`, `pnpm db:migrate`, `pnpm db:seed` e `pnpm dev`; contas de exemplo (funcionários e analistas, com qualquer senha); como testar sem chave de LLM (`AGENT_MODEL=fake`).
  3. **Arquitetura:** diagrama (Mermaid) com interface, agent, legado simulado, central de ajuda e Postgres; a fronteira HTTP do legado; os schemas.
  4. **Como o agent decide:** classificador (Jev com confiança calibrada, ou fallback) → plano de regras em código (Anexo A) → LLM só para a linguagem; confirmação fora do LLM; gatilhos de transferência; limiar de 0,6.
  5. **Transparência:** trilha de ações, detalhe da decisão no chat e no console, e a tabela `decisions`.
  6. **Como a qualidade das decisões foi garantida:** testes das regras, pipeline com modelo falso, E2E e os resultados de `pnpm eval` (copiados de `evals/results/latest.json`, ou um placeholder se não houver chaves).
  7. **Escolha do modelo:** DeepSeek Flash (custo, tool calling) e Jev (classificação calibrada, custo); limites conhecidos (sem JSON estrito; Jev em early access).
  8. **Custo e proteção:** limite de 30 mensagens por dia, uma requisição por conversa, teto diário de gasto e a saída do `pnpm usage:report`.
  9. **Principais trade-offs:** polling × SSE, Next único × serviços separados, sem Mastra Memory, regras em código × prompt.
  10. **Deploy:** passo a passo Vercel + Neon e como as chaves e os limites são protegidos.
  11. **O que faria com mais tempo:** por exemplo, o Electron (fase posterior), notificações, distribuição de conversas, avaliação contínua.
  12. Como rodar os testes (`pnpm test`, `pnpm test:e2e`, `pnpm eval`).
- Nenhum segredo real no README nem nos arquivos.
</requirements>

## Subtarefas

- [ ] 10.1 `scripts/usage-report.ts` com a função de agregação testável
- [ ] 10.2 Configuração de deploy (`vercel.json` se necessário) e o comando de migração no build documentado
- [ ] 10.3 README completo com o diagrama Mermaid
- [ ] 10.4 Testes do agregador de uso

## Detalhes de Implementação

Ver na `../techspec.md`: "Resumo Executivo", "Decisões Principais", "Riscos Conhecidos" e "Monitoramento e Observabilidade". Ver no `../prd.md`: "Objetivos" e RF51–RF53.

## Critérios de Sucesso

- Um avaliador consegue rodar o projeto do zero seguindo só o README.
- O README responde a cada item exigido pelo desafio, sem seção faltando.
- `pnpm usage:report` imprime o relatório a partir do banco local semeado e usado.
- `pnpm typecheck`, `pnpm lint` e `pnpm test` passam.

## Testes da Tarefa

- [ ] Testes de unidade: a agregação do relatório de uso (custo médio por conversa, períodos, banco vazio).
- [ ] Testes de integração: `pnpm usage:report` contra o banco de teste com registros de uso inseridos (lock `.locks/db-test`).

<critical>SEMPRE CRIE E EXECUTE OS TESTES DA TAREFA ANTES DE CONSIDERÁ-LA FINALIZADA</critical>
<critical>Se o comando de testes ainda não existir no projeto, registre "não executável ainda" — nunca invente saída de teste</critical>

## Arquivos relevantes

- `README.md`
- `scripts/usage-report.ts` (e o teste dele)
- `vercel.json` (somente se necessário)
- Somente leitura: todo o restante do repositório

## Reporte

Ao terminar, envie `worker_done` uma única vez com `--outcome succeeded` ou `--outcome failed`,
citando a saída de validação realmente observada e o que ficou de fora. Depois pare: não commite,
não feche o terminal e não inicie trabalho novo. Ver `docs/agents/worker.md`.
