# Tarefa 2.0: Regras do service desk (funções puras)

<critical>Ler os arquivos `../prd.md` e `../techspec.md` (um nível acima desta pasta), se você não ler esses arquivos sua tarefa será invalidada</critical>
<critical>Ler também `AGENTS.md`, `docs/agents/worker.md` e `.claude/rules/README.md` antes de começar</critical>

## Execução

| Campo | Valor |
|---|---|
| Executada por | worker |
| Depende de | 1.0 |
| Paralelizável | sim |
| Worktree | `rules-engine` |

## Visão Geral

Implementar as regras do Anexo A como **funções puras, sem I/O**. Elas são a garantia de que prioridade, prazo, duplicidade e transferência nunca dependem do LLM. As tarefas 5.0 e 6.0 consomem este módulo.

<requirements>
- `derivePriority({ impact, workImpact, sameDayCommitment })`:
  - `critical` quando `workImpact = stopped` e `impact` é `team` ou `company`;
  - `high` quando uma pessoa está impedida de trabalhar (`stopped` ou `blocked` com `impact = individual`), ou quando `sameDayCommitment = true`;
  - `medium` quando `degraded_with_workaround`;
  - `low` quando `request`.
  - `impact = unknown` não gera `critical`: trata como `individual` e o retorno sinaliza `needsConfirmation: true`.
  - Retorno: `{ priority, ruleApplied }`, onde `ruleApplied` é um texto curto em português para a trilha (ex.: "Alta: compromisso no mesmo dia").
- `computeDueAt(from, priority)` no fuso `America/Sao_Paulo`:
  - `critical` = `from` + 1 h corrida;
  - `high` = 4 horas úteis; `medium` = 3 dias úteis; `low` = 5 dias úteis;
  - horário útil é de segunda a sexta, das 8h às 18h, sem feriados;
  - um `from` fora do horário útil começa a contar no próximo início de expediente.
  - Dias úteis contam como N × 10 horas úteis.
- `isOverdue(dueAt, now)` e `describeDue(dueAt, now)`, que devolve "resposta até 13:43", "vence em 2 dias úteis" ou "prazo vencido".
- `resolveDuplicate(relatedTicket, now)` → `update` se o chamado está aberto (qualquer status diferente de `resolved`); `reopen` se foi resolvido há no máximo 7 dias (`resolvedAt` ≥ `now` − 7 dias, contados em dias corridos); `create` se foi resolvido há mais tempo ou não há chamado relacionado.
- `shouldTransfer({ explicitRequest, priority, acceptedOverdueOffer, confidence })` → `{ transfer: boolean, reason: TransferReason | null }` (`explicit_request`, `critical`, `overdue_accepted`, `low_confidence`, de `enums.ts`), com o limiar `CONFIDENCE_THRESHOLD = 0.6` (abaixo de 0,6 transfere; exatamente 0,6 não).
- `selectAnalystLevel({ priority, overdue })` → `"N2"` quando `priority = critical` ou `overdue = true`; `"N1"` nos demais casos, inclusive `priority = null` (transferência sem chamado).
- `getDailyWindow(now)` → início e fim do dia corrente em `America/Sao_Paulo`, usado pelo limite de 30 mensagens.
- Constantes nomeadas para todos os números (horário de expediente, limiar, janela de reabertura).
- Tipos importados de `src/db/schema/enums.ts` (tarefa 1.0). Não criar outro enum de prioridade ou categoria.
</requirements>

## Subtarefas

- [ ] 2.1 `priority.ts` com `derivePriority` e os textos de regra
- [ ] 2.2 `sla.ts` com `computeDueAt`, `isOverdue` e `describeDue` (usar `@date-fns/tz` e `date-fns`)
- [ ] 2.3 `duplicates.ts` com `resolveDuplicate`
- [ ] 2.4 `transfer.ts` com `shouldTransfer` e `selectAnalystLevel`
- [ ] 2.5 `daily-window.ts` com `getDailyWindow`
- [ ] 2.6 `index.ts` reexportando a API pública e os testes de cada arquivo

## Detalhes de Implementação

Ver na `../techspec.md`: "Interfaces Principais" (assinaturas de `derivePriority`, `computeDueAt` e `resolveDuplicate`), "Testes Unidade" e a tabela de prioridade em `../prd.md` (RF20 e RF21).

## Critérios de Sucesso

- 100% das linhas e branches de `src/modules/service-desk-rules/` cobertos (`pnpm test --coverage`).
- Nenhuma função do módulo faz I/O ou lê `Date.now()` implicitamente: o "agora" é sempre recebido como parâmetro.
- `pnpm typecheck` e `pnpm lint` passam.

## Testes da Tarefa

- [ ] Testes de unidade (AAA, com datas fixas e explícitas):
  - todas as combinações relevantes da matriz de prioridade, incluindo `unknown`;
  - prazo `high` aberto às 16h de uma sexta-feira → segunda-feira às 10h;
  - prazo aberto às 20h de uma terça → conta a partir das 8h de quarta;
  - prazo aberto num sábado;
  - `medium` atravessando o fim de semana;
  - `critical` às 23h30 de um domingo → 00h30 de segunda (hora corrida);
  - `isOverdue` exatamente no instante do prazo (não vencido) e 1 ms depois (vencido);
  - `resolveDuplicate` com resolvido há 6d23h → `reopen` e há 7d1h → `create`;
  - `shouldTransfer` com 0,59 → transfere, 0,60 → não transfere, e com cada um dos outros gatilhos;
  - `selectAnalystLevel`: crítico → N2; alta vencido → N2; média em dia → N1; sem chamado → N1;
  - `getDailyWindow` às 23h59 e à 0h01, horário de Brasília.
- [ ] Testes de integração: não se aplicam, porque o módulo é puro e não tem I/O. Registrar no reporte.

<critical>SEMPRE CRIE E EXECUTE OS TESTES DA TAREFA ANTES DE CONSIDERÁ-LA FINALIZADA</critical>
<critical>Se o comando de testes ainda não existir no projeto, registre "não executável ainda" — nunca invente saída de teste</critical>

## Arquivos relevantes

- `src/modules/service-desk-rules/{priority,sla,duplicates,transfer,daily-window,index}.ts`
- `src/modules/service-desk-rules/*.test.ts`
- Somente leitura: `src/db/schema/enums.ts`

## Reporte

Ao terminar, envie `worker_done` uma única vez com `--outcome succeeded` ou `--outcome failed`,
citando a saída de validação realmente observada e o que ficou de fora. Depois pare: não commite,
não feche o terminal e não inicie trabalho novo. Ver `docs/agents/worker.md`.
