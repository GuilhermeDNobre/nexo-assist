# Tarefa 5.0: Domínio de conversas — estados, rascunhos, transferências e limites

<critical>Ler os arquivos `../prd.md` e `../techspec.md` (um nível acima desta pasta), se você não ler esses arquivos sua tarefa será invalidada</critical>
<critical>Ler também `AGENTS.md`, `docs/agents/worker.md` e `.claude/rules/README.md` antes de começar</critical>

## Execução

| Campo | Valor |
|---|---|
| Executada por | worker |
| Depende de | 2.0, 3.0, 4.0 |
| Paralelizável | não |
| Worktree | atual |

## Visão Geral

Implementar o coração do estado da aplicação:
- a conversa contínua por funcionário e a máquina de estados (`agent`, `awaiting_analyst`, `with_analyst`);
- as mensagens, com partes no formato do AI SDK;
- os rascunhos, cuja confirmação cria ou atualiza o chamado no legado **sem LLM**;
- as transferências, o limite diário de mensagens, o livro-razão de uso e o teto de gasto.

Esta tarefa também define os **tipos dos data parts** que o agent (6.0), o chat (7.0) e o console (8.0) vão usar.

<requirements>
- `message-parts.ts`: tipos e schemas Zod dos data parts customizados. São o contrato entre agent, chat e console:

  | Data part | Conteúdo |
  |---|---|
  | `data-action` | `{ label }` |
  | `data-decision` | `{ decisionId, intent, action, confidence, ruleApplied, rationale, classifierSource }` |
  | `data-ticket-card` | o chamado |
  | `data-ticket-picker` | lista de `{ number, title, status, updatedAt }` |
  | `data-quick-replies` | `{ question, options[] }` |
  | `data-draft` | `{ draftId, action, payload, dueLabel, status }` |
  | `data-transfer` | `{ reason, confidence?, targetLevel, ticketNumber?, waitDueAt }` |
  | `data-error` | `{ code, message, retryable }` |
  | `data-system-event` | `{ kind, label }` (marcos: transferida, assumiu, devolveu, encerrou) |

- `message-dto.ts`: `MessageDto` e `toMessageDto` exatamente como na Tech Spec ("Interfaces Principais"), com o autor resolvido por join em `users` (nome e `analyst_level`). É o formato de mensagens de `GET /api/conversations/current` e é **reutilizado** pela 8.0 em `GET /api/console/conversations/:id`.
- `state-machine.ts`: `transition(state, event)` conforme a Tech Spec ("Interfaces Principais"). Uma transição inválida lança `InvalidTransitionError`, que as rotas mapeiam para **422**.
- `automatic-summary.ts`: `buildAutomaticSummary({ classification?, recentMessages, activeTicketNumber? })`, função pura que monta o resumo por template (intenção e campos entendidos com a confiança, as 3 últimas mensagens e o chamado ativo). Usada pela rota `request-analyst` e pelo caminho determinístico da 6.0.
- `conversation-service.ts`:
  - `getOrCreateEmployeeConversation(employeeId)`;
  - `appendMessage` (recebe `countsTowardLimit`, padrão `false`);
  - `setActiveTicket(conversationId, ticketNumber)` e `recordOutcome(conversationId, outcome)`, usados também pela 6.0;
  - `transferToAnalyst({ conversationId, employeeId, reason, confidence?, summary, summarySource, ticket? })`, onde `ticket` é `{ number, priority, dueAt }` do chamado ativo:
    - `targetLevel = selectAnalystLevel({ priority: ticket?.priority ?? null, overdue })` (2.0), com `overdue = isOverdue(ticket.dueAt, agora)` quando há chamado e `false` sem chamado;
    - `wait_due_at = computeDueAt(agora, ticket?.priority ?? "high")`;
    - grava o handoff com `ticket_number`, `target_level` e `summary_source`, muda o estado para `awaiting_analyst`, grava `last_outcome = transferred` e anexa **só** uma mensagem de sistema com `data-system-event` ("Transferida para Suporte N2");
    - devolve o payload `data-transfer` (`{ reason, confidence?, targetLevel, ticketNumber?, waitDueAt }`) **sem gravá-lo**: quem chama coloca o `data-transfer` na sua própria mensagem do agent (a ferramenta da 6.0 escreve no stream; a rota `request-analyst` anexa uma mensagem do agent). Assim o card aparece uma única vez;
    - quando há `ticket`, chama `transfer(number, summary)` no legado; `LegacyUnavailableError` é registrado em log (`legacy.request_failed`) e **não** desfaz a transferência da conversa;
  - `assume(analystId)`, `returnToAgent(analystId)` (zera `last_outcome`), `close(analystId)` (grava `closed_by_analyst`): atualizam o handoff e o estado e emitem os marcos;
  - `markAnalystRead`.
  - Cada operação de estado roda numa transação com `SELECT ... FOR UPDATE` na conversa.
- `drafts-service.ts`:
  - `createDraft`;
  - `updateDraft` (substituição completa do payload, validado com Zod);
  - `cancelDraft`;
  - `confirmDraft(draftId, employeeId)`:
    1. valida o dono e o status `pending` (já confirmado ou cancelado → 422);
    2. calcula `dueAt = computeDueAt(agora, prioridade)`, **inclusive** para `update` e `reopen` (o prazo recomeça a cada atualização, RF21);
    3. chama `create`, `addNote(number, { note, dueAt })` ou `reopen(number, { note, dueAt })` no legado via `createTicketServiceClient(employeeId)` (3.0), com `idempotencyKey = draftId`;
    4. marca `confirmed`, grava `active_ticket_number` e `last_outcome = ticket_confirmed`, e anexa uma mensagem do agent com `data-action` ("criou o chamado") e `data-ticket-card`.
  - Com `LegacyUnavailableError`, o rascunho continua `pending`, uma mensagem com `data-error` (`retryable: true`) é anexada e a resposta HTTP é **503**.
  - Funções separadas para confirmar e cancelar, sem flag param.
- `message-limit.ts`: conta as mensagens com `counts_toward_limit = true` no dia corrente (`getDailyWindow` da 2.0), com limite em `DAILY_MESSAGE_LIMIT`. Mensagens ao analista e o pedido de analista **não** contam.
- `src/modules/usage/`:
  - `recordUsage({ conversationId, provider, model, inputTokens, outputTokens })` calcula o custo com uma tabela de preços por modelo (constantes nomeadas) e grava em `usage_ledger`;
  - `isDailyBudgetExceeded(now)` compara a soma do dia com `DAILY_BUDGET_USD`.
- Rotas (todas com `requireEmployee` e a sessão como dona; nenhum ID de funcionário vem do corpo):
  - `GET /api/conversations/current` → `{ conversation: { id, state, waitDueAt, targetLevel, assignedAnalyst: { id, name, analystLevel } | null }, messages: MessageDto[], pendingDraft, dailyCount, dailyLimit }`;
  - `POST /api/conversations/current/request-analyst` ("Falar com um analista"): fora do limite diário e do orçamento; estado diferente de `agent` → 422; busca o chamado ativo pelo cliente do legado (em 503, segue sem chamado), monta o resumo com `buildAutomaticSummary`, chama `transferToAnalyst` com `reason = explicit_request` e `summarySource = automatic` e anexa uma mensagem do agent com o `data-transfer` devolvido; responde 200 `{ conversation: { id, state, waitDueAt, targetLevel } }`;
  - `PUT /api/drafts/:draftId`, `POST /api/drafts/:draftId/confirm`, `POST /api/drafts/:draftId/cancel`. Rascunho de outro funcionário → 404.
- Logs estruturados conforme `logging.md` (`legacy.request_failed`, `budget.exceeded`), só com IDs.
</requirements>

## Subtarefas

- [ ] 5.1 `message-parts.ts` (tipos e Zod) e `message-dto.ts`
- [ ] 5.2 Máquina de estados e erros tipados
- [ ] 5.3 `conversation-service.ts` (conversa, mensagens, chamado ativo, desfecho, transferência com nível, assumir, devolver, encerrar, lidas) e `automatic-summary.ts`
- [ ] 5.4 `drafts-service.ts` com a confirmação idempotente sob falha do legado
- [ ] 5.5 Limite diário e módulo de uso e orçamento
- [ ] 5.6 Rotas `GET /api/conversations/current`, `request-analyst` e de rascunhos
- [ ] 5.7 Testes de unidade e integração

## Detalhes de Implementação

Ver na `../techspec.md`: "Fluxo de uma mensagem", "Confirmação de rascunho", "Interfaces Principais" (máquina de estados), "Modelos de Dados" (`conversations`, `messages`, `drafts`, `handoffs`, `usage_ledger`) e "Decisões Principais" (limites em Postgres). As regras vêm de `src/modules/service-desk-rules` (2.0) e o cliente do legado de `src/modules/agent/clients` (3.0).

## Critérios de Sucesso

- Nenhum caminho cria chamado sem a confirmação explícita do dono do rascunho.
- A confirmação sob 503 intermitente cria exatamente um chamado.
- O estado da conversa só muda por transições válidas.
- `pnpm typecheck`, `pnpm lint` e `pnpm test` passam.

## Testes da Tarefa

- [ ] Testes de unidade:
  - todas as transições válidas e inválidas da máquina de estados;
  - validação dos schemas de data parts (aceita válido, rejeita inválido);
  - cálculo de custo do uso;
  - limite diário (29 permite, 30 bloqueia), com relógio mockado;
  - `toMessageDto` para cada `authorType` (analista com nome e nível, agent e sistema com `author = null`);
  - `buildAutomaticSummary` com e sem classificação e com e sem chamado ativo.
- [ ] Testes de integração (Postgres real, lock `.locks/db-test`, legado chamado de verdade pelas rotas da 3.0 ou com o adaptador do axios mockado):
  - `GET /api/conversations/current` cria a conversa na primeira vez e a reutiliza depois;
  - confirmar um rascunho cria o chamado e a mensagem com o card;
  - confirmar duas vezes → 422;
  - confirmar o rascunho de outro funcionário → 404;
  - confirmar com o legado em 503 → rascunho `pending`, mensagem de erro e 503; nova tentativa → um único chamado;
  - confirmar um rascunho `update` grava o novo `due_at` no legado;
  - `transferToAnalyst` com chamado crítico → `target_level = N2`; com chamado médio em dia → N1 e `wait_due_at` de 3 dias úteis; sem chamado → N1 e `wait_due_at` de 4 h úteis; grava `ticket_number`, `last_outcome = transferred` e a mensagem de sistema, e devolve o `data-transfer`; `request-analyst` deixa exatamente uma mensagem com `data-transfer`;
  - `transferToAnalyst` com o legado em 503 → conversa transferida mesmo assim;
  - `request-analyst` com 30/30 mensagens no dia → 200 e conversa em `awaiting_analyst`; com o estado `with_analyst` → 422;
  - mensagens com `counts_toward_limit = false` não entram no `dailyCount`;
  - assumir → devolver → assumir → encerrar, com os marcos gravados e `last_outcome` (`null` após devolver, `closed_by_analyst` após encerrar);
  - `isDailyBudgetExceeded` com o ledger acima do teto.

<critical>SEMPRE CRIE E EXECUTE OS TESTES DA TAREFA ANTES DE CONSIDERÁ-LA FINALIZADA</critical>
<critical>Se o comando de testes ainda não existir no projeto, registre "não executável ainda" — nunca invente saída de teste</critical>

## Arquivos relevantes

- `src/modules/conversations/**`
- `src/modules/usage/**`
- `src/app/api/conversations/current/route.ts`
- `src/app/api/conversations/current/request-analyst/**`
- `src/app/api/drafts/**`
- Somente leitura: `src/modules/service-desk-rules/**`, `src/modules/agent/clients/**`, `src/modules/auth/**`, `src/db/**`, `src/env.ts`

## Reporte

Ao terminar, envie `worker_done` uma única vez com `--outcome succeeded` ou `--outcome failed`,
citando a saída de validação realmente observada e o que ficou de fora. Depois pare: não commite,
não feche o terminal e não inicie trabalho novo. Ver `docs/agents/worker.md`.
