# Tech Spec — Nexo Assist

## Resumo Executivo

Um único app **Next.js 16 (App Router, TypeScript estrito)** hospeda três fronteiras:
- a interface (chat, perfil e console);
- o **agent**, feito com Mastra;
- o **serviço de chamados legado simulado**. O agent só acessa esse serviço por HTTP, com cliente próprio, token interno e falhas simuladas.

A persistência é **PostgreSQL + Drizzle**: Docker no ambiente local e Neon no deploy, que vai para a **Vercel**.

A decisão é **híbrida e determinística nas regras**:
1. A cada mensagem, um **classificador** devolve intenção, tipo, categoria, impacto, urgência e o chamado relacionado, cada item com **confiança**. O classificador principal é o **Jev** (TypeSafe), com confiança calibrada. Sem a chave `TYPESAFE_API_KEY`, entra um classificador de fallback: o LLM chamado com uma ferramenta obrigatória, cujo schema é Zod.
2. O **código** aplica o Anexo A: matriz de prioridade, prazo em horas úteis, duplicidade, reabertura, privacidade, transferência abaixo de 60% e confirmação obrigatória.
3. O **LLM DeepSeek Flash** (`deepseek/deepseek-flash`, API direta) conduz a conversa e chama as ferramentas. Ele recebe a decisão pronta e nunca decide prioridade ou prazo sozinho.

Cada turno grava um **registro de decisão**: o que foi entendido, a ação tomada, a confiança, a regra aplicada e as ferramentas chamadas. Esse registro alimenta a trilha de ações do chat e o detalhe completo no console.

## Arquitetura do Sistema

### Visão Geral dos Componentes

Todos os componentes são novos (repositório greenfield). Os caminhos são relativos a `src/`.

| Componente | Responsabilidade |
|---|---|
| `app/` | Rotas: `login`, `(employee)/chat`, `(employee)/profile`, `console`, e os route handlers em `app/api/**`. `proxy.ts` (Next 16) protege as páginas por papel. |
| `modules/auth/` | Login sem senha real, sessão em JWT assinado com `jose` num cookie HttpOnly, guards `requireEmployee`/`requireAnalyst`. |
| `modules/legacy-tickets/` | **Serviço simulado**: repositório (schema `legacy`), regras de status, simulador de indisponibilidade e handlers HTTP em `/api/legacy/*`. Não importa nada de `agent`. |
| `modules/knowledge-base/` | Artigos (schema `kb`) com busca full-text do Postgres (`portuguese`) e condições de aplicação (ex.: `os: windows_10`). |
| `modules/service-desk-rules/` | Funções puras: `derivePriority`, `computeDueAt`, `isOverdue`, `resolveDuplicate`, `shouldTransfer`. Sem I/O. |
| `modules/conversations/` | Máquina de estados da conversa, mensagens, rascunhos, transferências, limite diário e não lidas. |
| `modules/agent/` | Instância Mastra, `nexoAgent`, ferramentas, classificadores (`jev-classifier`, `llm-classifier`), montagem do registro de decisão e `ticket-service-client` (axios + axios-retry). |
| `modules/usage/` | Livro-razão de tokens e custo, e o teto diário global de gasto. |
| `components/` | `ui/` (shadcn/ui), `chat/` (mensagem, trilha expansível, cards, rascunho, opções rápidas, seletor de chamado) e `console/`. |
| `db/` | Schema Drizzle (schemas `app`, `legacy`, `kb`), migrações e seed (Anexo B). |

**Fluxo de uma mensagem:** `POST /api/conversations/current/messages`
1. Valida a sessão. Se o estado não é `agent`, persiste a mensagem com `counts_toward_limit = false` e devolve um stream vazio: a mensagem fica para o analista, sem limite nem orçamento (o limite vale só para a conversa com o agent).
2. Com o estado `agent`: valida o limite diário, o orçamento e o lock da conversa, e persiste a mensagem com `counts_toward_limit = true`.
3. Carrega os chamados do funcionário pelo cliente HTTP do legado.
4. Chama o classificador.
5. `service-desk-rules` produz o **plano**: ação permitida, prioridade e prazo, duplicidade e transferência.
6. Um `createUIMessageStream` escreve o `data-decision` e faz `nexoAgent.stream()` com o `RequestContext` (`employeeId`, `conversationId`, plano), convertido por `toAISdkStream`.
7. Em `onFinish`, persiste as partes da resposta, o registro de decisão e o uso de tokens.

**Confirmação de rascunho:** `POST /api/drafts/:draftId/confirm` executa a criação ou atualização no legado **sem chamar o LLM**, com `dueAt = computeDueAt(agora, prioridade)` também em `update` e `reopen`, e anexa uma mensagem do agent com o card do chamado.

**Transferência:** `transferToAnalyst` (conversas) é o único caminho. Ele recebe o motivo, a confiança, o resumo e o chamado ativo (opcional) e:
- define o nível de destino com `selectAnalystLevel`: **N2** se o chamado é crítico ou está vencido, senão **N1**;
- define `wait_due_at = computeDueAt(agora, prioridade do chamado ativo)`, com `high` quando não há chamado;
- grava o handoff com `ticket_number` e `target_level` e chama `transfer` do legado quando há chamado. Uma falha do legado é registrada em log e **não** impede a transferência da conversa.

É chamado pela ferramenta `requestAnalyst`, pelo caminho determinístico de baixa confiança e por `POST /api/conversations/current/request-analyst` (botão "Falar com um analista", que funciona mesmo em 30/30). Sem resumo do LLM, usa o **resumo automático** por template (`buildAutomaticSummary`): intenção e campos entendidos, confiança, as 3 últimas mensagens e o chamado ativo.

**Desfecho da conversa** (`last_outcome`), que alimenta o status do console:
- `resolved_by_agent`: o turno terminou numa resposta da central de ajuda ou numa consulta de status, sem transferência e sem chamado novo (gravado pela 6.0);
- `ticket_confirmed`, `transferred` e `closed_by_analyst` (gravados pela 5.0);
- volta a `null` ao devolver ao agent.

**Console:** lê do mesmo banco por polling (SWR, a cada `NEXT_PUBLIC_POLL_INTERVAL_MS`, padrão 3 s). O chat também faz polling quando o estado não é `agent`.

## Design de Implementação

### Interfaces Principais

```ts
interface DecisionClassifier {
  classify(input: ClassifyInput): Promise<Classification>; // ClassifyInput: message, recent history, employee tickets, device OS
}
interface Classification {
  source: "jev" | "llm_fallback";
  intent: Scored<Intent>; ticketType: Scored<"INC" | "REQ">; category: Scored<Category>;
  impact: Scored<"individual" | "team" | "company" | "unknown">;
  workImpact: Scored<"stopped" | "blocked" | "degraded_with_workaround" | "request">;
  sameDayCommitment: Scored<boolean>; relatedTicket: Scored<string | null>;
}
type Scored<T> = { value: T; confidence: number }; // 0..1
```

```ts
interface TicketServiceClient { // requests carry X-Employee-Id from the session, never from the LLM
  listMine(): Promise<Ticket[]>;
  getMine(number: string): Promise<Ticket>; // 404 when it belongs to someone else
  create(input: NewTicket): Promise<Ticket>;
  addNote(number: string, input: { note: string; dueAt: Date }): Promise<Ticket>; // the due date restarts on every update
  reopen(number: string, input: { note: string; dueAt: Date }): Promise<Ticket>;
  transfer(number: string, summary: string): Promise<Ticket>;
}
```

```ts
type ConversationState = "agent" | "awaiting_analyst" | "with_analyst";
type TransferReason = "explicit_request" | "critical" | "overdue_accepted" | "low_confidence";
type ConversationEvent =
  | { type: "transfer"; reason: TransferReason; confidence?: number }
  | { type: "assume"; analystId: string }
  | { type: "return_to_agent" } | { type: "close" };
function transition(state: ConversationState, event: ConversationEvent): ConversationState; // throws on invalid transition
```

```ts
function derivePriority(p: { impact: Impact; workImpact: WorkImpact; sameDayCommitment: boolean }): Priority;
function computeDueAt(from: Date, priority: Priority): Date; // America/Sao_Paulo, Mon–Fri 8h–18h; critical = +1h wall clock
function resolveDuplicate(related: Ticket | null, now: Date): "update" | "reopen" | "create";
function selectAnalystLevel(p: { priority: Priority | null; overdue: boolean }): "N1" | "N2"; // N2 when critical or overdue
```

```ts
type MessageDto = { // shared by GET /api/conversations/current and GET /api/console/conversations/:id
  id: string;
  authorType: "employee" | "agent" | "analyst" | "system";
  author: { id: string; name: string; analystLevel: "N1" | "N2" | null } | null; // null for agent and system
  parts: UIMessage["parts"]; // AI SDK parts, including the data-* parts from message-parts.ts
  createdAt: string; // ISO 8601
};
```

**Ferramentas do agent** (Mastra `createTool`, input em Zod, contexto lido de `requestContext`):
- `searchKnowledgeBase`
- `listMyTickets`
- `showTicketPicker` (emite `data-ticket-picker`)
- `showTicket` (`data-ticket-card`)
- `askQuickQuestion` (`data-quick-replies`)
- `proposeDraft`: persiste o rascunho e emite `data-draft`. O plano de regras define tipo, prioridade, prazo e ação (create/update/reopen), e o LLM preenche título, descrição e afetados.
- `requestAnalyst`: transferência com resumo do caso.

Nenhuma ferramenta cria ou altera chamado diretamente: isso só acontece no endpoint de confirmação. Cada ferramenta também emite um `data-action` com o rótulo da trilha ("consultou seus chamados").

### Modelos de Dados

**Schema `app`:**

| Tabela | Colunas principais |
|---|---|
| `users` | `id`, `email` (único), `name`, `role` (`employee`/`analyst`), `analyst_level` (`N1`/`N2`), `device_os` |
| `conversations` | `id`, `employee_id` (único: uma conversa contínua), `state`, `assigned_analyst_id`, `transfer_reason`, `transfer_confidence`, `awaiting_since`, `wait_due_at`, `active_ticket_number` (último chamado mostrado, criado ou atualizado na conversa), `last_outcome` (`resolved_by_agent`/`ticket_confirmed`/`transferred`/`closed_by_analyst`, nullable), `analyst_last_read_at`, `updated_at` |
| `messages` | `id`, `conversation_id`, `author_type` (`employee`/`agent`/`analyst`/`system`), `author_id`, `parts` (jsonb, partes do AI SDK UIMessage), `counts_toward_limit` (boolean, só mensagens do funcionário ao agent), `created_at` |
| `decisions` | `id`, `message_id`, `conversation_id`, `classifier_source`, `classification` (jsonb), `action`, `confidence`, `rule_applied`, `rationale`, `tool_calls` (jsonb: nome, entrada, resultado/erro, duração), `created_at` |
| `drafts` | `id`, `conversation_id`, `action` (`create`/`update`/`reopen`), `target_ticket_number`, `payload` (jsonb), `status` (`pending`/`confirmed`/`cancelled`), `created_at` |
| `handoffs` | `id`, `conversation_id`, `reason`, `confidence`, `summary`, `summary_source` (`agent`/`automatic`), `ticket_number` (nullable), `target_level` (`N1`/`N2`), `created_at`, `assumed_by`, `assumed_at`, `ended_at`, `end_action` (`returned`/`closed`) |
| `usage_ledger` | `id`, `conversation_id`, `provider`, `model`, `input_tokens`, `output_tokens`, `cost_usd`, `created_at` |

**Schema `legacy`:**
- `tickets`: `number` (PK, `INC-20311`/`REQ-10442`), `type`, `title`, `description`, `category`, `priority`, `status` (`open`, `awaiting_analyst`, `in_progress`, `approved`, `resolved`), `affected`, `requester_id`, `created_at`, `updated_at`, `resolved_at`, `due_at`.
- `ticket_events`: `id`, `ticket_number`, `kind`, `body`, `created_at`.
- `idempotency_keys`: `key` (PK), `employee_id`, `response` (jsonb), `created_at`.

**Schema `kb`:** `articles`, com `id`, `title`, `body`, `applies_to` (jsonb) e `search` (tsvector gerado).

**Os tempos ficam em `timestamptz`.** O seed gera datas relativas a "agora", para garantir chamados vencidos e chamados resolvidos há 4 e há 10 dias.

### Endpoints de API

Todos devolvem JSON. Códigos usados: 200, 400 (Zod), 401, 403, 404, 422 (regra de negócio: limite atingido, estado inválido, rascunho já confirmado), 500.

**App:**

| Método e rota | Descrição |
|---|---|
| `POST /api/sessions` / `DELETE /api/sessions/current` | Login (`{ email, password, keepSignedIn }`) e logout |
| `GET /api/me` | Usuário da sessão |
| `GET /api/conversations/current` | Conversa do funcionário: `MessageDto[]`, estado, contador diário e rascunho pendente |
| `POST /api/conversations/current/messages` | Stream do agent (formato UI message stream do AI SDK v7) |
| `POST /api/conversations/current/request-analyst` | "Falar com um analista": transfere com `explicit_request` e resumo automático; fora do limite diário; 422 se o estado não é `agent` |
| `PUT /api/drafts/:draftId` · `POST /api/drafts/:draftId/confirm` · `POST /api/drafts/:draftId/cancel` | Editar, confirmar e cancelar rascunho |
| `GET /api/console/conversations?filter=all\|for-you\|with-agent\|mine&q=` | Lista com contadores |
| `GET /api/console/conversations/:id` | `MessageDto[]`, transferências e decisões completas |
| `POST /api/console/conversations/:id/assume` · `/return-to-agent` · `/close` · `/messages` | Ações do analista |
| `GET /api/console/employees/:employeeId/tickets` | Painel somente leitura |

**Legado** (header `Authorization: Bearer LEGACY_API_TOKEN` + `X-Employee-Id`):

| Método e rota | Descrição |
|---|---|
| `GET /api/legacy/tickets` · `GET /api/legacy/tickets/:number` | Consulta; filtra pelo dono |
| `POST /api/legacy/tickets` | Cria |
| `POST /api/legacy/tickets/:number/add-note` · `/reopen` | Ações; corpo `{ note, dueAt }`, que substitui `due_at` |
| `POST /api/legacy/tickets/:number/transfer` | Ação; corpo `{ summary }` |
| `POST /api/legacy/test/outage` | Só fora de produção (404 em produção): `{ failNextRequests }` faz as próximas N requisições ao legado devolverem 503. Usado pelo E2E |
| `GET /api/knowledge-base/articles?q=&os=` | Busca na central de ajuda |

## Pontos de Integração

- **DeepSeek** (`DEEPSEEK_API_KEY`), pelo model router do Mastra; o modelo é configurável em `AGENT_MODEL`.
  - Suporta tool calling, mas não JSON estrito: por isso o fallback usa uma ferramenta obrigatória e valida com Zod, com uma nova tentativa.
  - Timeout de 30 s. Em erro, o stream emite `data-error` e a interface oferece "tentar de novo".
- **Jev** (`@typesafe-ai/sdk`, `TYPESAFE_API_KEY` opcional).
  - Uma chamada `systemOne` por mensagem, com perguntas `choice`/`noul`.
  - O chamado relacionado é um `choice` com os números dos chamados do funcionário mais `none`.
  - Timeout de 3 s e 1 retry. Em falha, usa o fallback e registra `classifier_source = llm_fallback`.
  - Acesso em early access: sem a chave, o sistema funciona inteiro no fallback.
- **Legado simulado.**
  - O `outage-simulator` devolve **503** durante janelas configuráveis: `LEGACY_OUTAGE_EVERY_S` e `LEGACY_OUTAGE_DURATION_S`, ou `LEGACY_OUTAGE_RATE`; nos testes é desligado ou forçado pelo contador `failNextRequests` (rota de teste, fora de produção).
  - O cliente usa axios com axios-retry: 3 tentativas com backoff exponencial, só em 503 e erros de rede, e timeout de 4 s.
  - Operações de escrita levam `Idempotency-Key` (o id do rascunho), para não duplicar o chamado num retry.
  - Esgotadas as tentativas, a ferramenta devolve o erro tipado `legacy_unavailable`. O agent avisa sem afirmar sucesso, o rascunho continua `pending` e a falha fica destacada no registro de decisão.

## Abordagem de Testes

### Testes Unidade

Vitest. Mocks apenas de DeepSeek, Jev e relógio (`vi.useFakeTimers`).

| Componente | Cenários críticos |
|---|---|
| `service-desk-rules` | Matriz completa de prioridade; prazo atravessando noite, sexta → segunda e fim de semana; crítica +1h corrida; vencido no limite exato; duplicidade com resolvido a 6d23h e a 7d01h |
| Máquina de estados | Todas as transições válidas e inválidas |
| `shouldTransfer` | Limiar de 0,60 (0,59 transfere, 0,60 não), pedido explícito, crítica, vencido aceito |
| `selectAnalystLevel` | Crítico → N2, vencido → N2, demais e sem chamado → N1 |
| Classificadores | Mapeamento da resposta do Jev para `Classification`; validação e nova tentativa do fallback; queda do Jev → fallback |
| Ferramentas | `employeeId` vem sempre do `requestContext`; chamado alheio → 404 sem vazar dados |
| Cliente do legado | Retry em 503, sem retry em 4xx, idempotência |
| Limite diário | Virada de dia em `America/Sao_Paulo` |

### Testes de Integração

Postgres real (Docker, banco `nexo_test`). Os testes que usam esse banco rodam serializados pelo lock de diretório `.locks/db-test`.

- Route handlers com sessão.
- Fluxo de confirmação de rascunho: criação idempotente sob 503 intermitente.
- Assumir, devolver e encerrar conversa.
- Privacidade nos endpoints do console e do legado.
- Pipeline de mensagem com um modelo falso (mock de `ai/test`) e classificador falso. Asserções sobre o plano, os data parts emitidos e o registro de decisão persistido.

**Avaliação de decisões** (`pnpm eval`, fora do CI, com chaves reais): cerca de 30 mensagens rotuladas, cobrindo dúvida, status, abertura, fora de TI, duplicado, crítico e ambíguo. A avaliação mede a acurácia de intenção, categoria, prioridade final e ação, comparando Jev e fallback. O relatório entra no README como evidência de qualidade.

### Testes de E2E

Playwright contra `next start` na porta **3100**, com o banco `DATABASE_URL_TEST` re-semeado, seed fixo, `AGENT_MODEL=fake` (um modelo roteirizado, que só é aceito fora de produção) e Jev desligado. A suíte inteira roda dentro do lock `.locks/db-test` (global setup e teardown do Playwright).

Cenários:
1. Login do funcionário → abre chamado pelo rascunho → confirma → vê o card.
2. Consulta com o seletor de chamado → chamado vencido → aceita analista → estado "aguardando".
3. Analista: filtro "Para você" → assume → envia mensagem → devolve ao agent; outro caso → encerra.
4. Tentativa de ver chamado de outro funcionário.
5. Contador chega a 30/30.
6. Legado indisponível durante a confirmação.

Inclui verificações de acessibilidade com `@axe-core/playwright`.

## Sequenciamento de Desenvolvimento

### Ordem de Construção

1. **Fundação:** scaffold do Next 16 com pnpm, TypeScript estrito, Tailwind e shadcn, os tokens do protótipo (Schibsted Grotesk, Newsreader, paleta), Drizzle com os três schemas, Docker Compose, `.env.example`, Vitest e Playwright.
2. **`service-desk-rules`:** funções puras com testes. Tudo depende delas.
3. **Serviço legado e central de ajuda:** schema, seed (Anexo B), handlers, simulador de falha e cliente axios.
4. **Autenticação e sessão:** `proxy.ts`, login (Tela 1) e Meu perfil.
5. **Conversas:** máquina de estados, mensagens, rascunhos, limite e uso.
6. **Agent:** classificadores (fallback primeiro, depois Jev), ferramentas, pipeline e registro de decisão.
7. **Chat** (Telas 2 e 3): streaming, cards, trilha expansível e estados de carregamento e erro.
8. **Console** (Telas 4 e 5): lista e filtros, histórico, ações, painel de chamados e detalhe das decisões.
9. **Avaliação de decisões, E2E e acessibilidade.**
10. **Deploy** (Vercel + Neon) e **README**.

Os passos 3 e 4 podem rodar em paralelo, assim como 7 e 8 depois que o 6 estiver pronto.

### Dependências Técnicas

- Docker para o Postgres local.
- Chave `DEEPSEEK_API_KEY`.
- Chave TypeSafe opcional: o sistema funciona sem ela.
- Para o deploy: conta Vercel e projeto Neon.

## Monitoramento e Observabilidade

O projeto não tem Prometheus nem Grafana, então não serão criados. A observabilidade segue `logging.md`:

- **Logs estruturados** (`console.log`/`console.error` com objeto JSON, sem dados pessoais e só com IDs):
  - `agent.turn` (conversationId, classifierSource, action, confidence, latencyMs, tokens);
  - `legacy.request_failed` (rota, tentativa, status);
  - `classifier.fallback` (motivo);
  - `budget.exceeded`.
- **Auditoria no banco:** a tabela `decisions` registra cada decisão e ferramenta; `usage_ledger` registra custo por conversa. Um script `pnpm usage:report` resume o custo médio por conversa para o README.
- Na Vercel, os logs ficam no painel de Logs do projeto.

## Considerações Técnicas

### Decisões Principais

| Decisão | Justificativa | Alternativa rejeitada |
|---|---|---|
| **Next.js único com fronteira HTTP interna** | Escolha do usuário. Um deploy só, e separação verificável, porque o agent não importa o módulo do legado. | Monorepo com serviço separado: dois deploys. Vite + Hono: sem SSR, mais boilerplate. |
| **Mastra sem Mastra Memory** | O histórico vem das nossas tabelas, a fonte única que também tem as mensagens do analista e o estado; o contexto é montado com as últimas 20 mensagens de todos os autores (analista como "[Analista Nome]: ...", marcos como linhas de sistema). | Memory/threads do Mastra: duplicaria a persistência e não conhece o analista. |
| **Jev + fallback LLM** | Confiança calibrada, de 70 a 500 ms e cerca de US$ 0,04 por milhão de tokens de entrada; é o número exibido e o gatilho de transferência. | Só LLM: confiança autodeclarada, menos confiável. |
| **DeepSeek Flash** | Escolha do usuário; custo muito baixo e tool calling suportado. | Claude Haiku e GPT mini: mais caros. |
| **Regras em código, não no prompt** | Decisões testáveis e reprodutíveis; o LLM não inventa prioridade ou prazo. | Regras no prompt: não testáveis. |
| **Confirmação fora do LLM** | É impossível o modelo criar chamado sem o clique; também economiza uma chamada. | Ferramenta `createTicket` no agent. |
| **Polling no console (3 s)** | Funções serverless da Vercel não mantêm SSE longo; é simples e suficiente. | SSE/WebSocket: exigiria Railway ou um serviço de realtime. |
| **PostgreSQL + Drizzle** | Escolha do usuário; serve local, Neon e o Electron futuro com o mesmo banco hospedado. | SQLite: não funciona em serverless efêmero. |
| **Sessão JWT própria (`jose`)** | O login não tem senha real; uma biblioteca de autenticação completa seria peso morto. `exp` de 12 h, ou de 30 dias com "manter conectado". | Auth.js credentials. |
| **Limites em Postgres** | 30 mensagens por dia por funcionário, 1 requisição de agent em andamento por conversa (lock por linha) e teto diário global `DAILY_BUDGET_USD`, sem infraestrutura extra. | Upstash Redis: mais um serviço. |

Stack registrada: pnpm, Next 16, React, Tailwind 4 + shadcn/ui, Mastra (`@mastra/core`, `@mastra/ai-sdk`), AI SDK 7, Zod 4, Drizzle + `pg`, axios + axios-retry, `jose`, SWR, `date-fns` + `@date-fns/tz`, Vitest, Playwright.

### Riscos Conhecidos

- **Acesso ao Jev em early access:** mitigado pelo fallback e por uma flag. A avaliação de decisões mede os dois caminhos.
- **DeepSeek sem JSON estrito ou com tool calls malformadas:** validação com Zod, uma nova tentativa e, se falhar, transferência com motivo "baixa confiança".
- **APIs novas (Mastra 1.x, AI SDK 7, Next 16):** consultar o Context7 antes de cada tarefa; as versões ficam travadas no lockfile.
- **Limite de duração das funções na Vercel:** `maxDuration = 60` na rota de stream e no máximo 5 passos de ferramenta por turno.
- **Custo e abuso no deploy:** o teto diário global responde 422 com mensagem amigável. As chaves só ficam no servidor.

### Conformidade com Padrões

- **`code-standards.md`:** código em inglês, kebab-case nos arquivos, funções de até 50 linhas, early return, objetos de parâmetro, sem flag params (por exemplo, `confirmDraft` e `cancelDraft` são separados).
- **`logging.md`:** stdout/stderr, objetos estruturados, sem dados pessoais e nunca silenciar exceções.
- **`tests.md`:** AAA, independência entre testes, relógio mockado e cobertura das regras.
- **`node.md`** (passa a valer): TypeScript sem `any`, `const`, async/await, imports ES e `tsc --noEmit`.
- **`react.md`** (passa a valer): componentes funcionais, Tailwind, Context só para sessão, shadcn/ui aprovado pelo usuário e testes de componentes.
- **`http.md`** (passa a valer): REST no plural, ações via POST, axios para chamadas HTTP. Desvio: **503** no legado simulado, que é o código correto para indisponibilidade temporária e é o que dispara o retry.

### Arquivos relevantes e dependentes

- `tasks/prd-nexo-assist/prd.md`: requisitos.
- `Desafio_Tecnico_Nexo_Assist_PRD_v5.pdf`: Anexos A e B.
- `design/nexo.pen` e `design/screens/*.png`, `design/screens/prototype.html`: protótipo e tokens.
- `.claude/rules/*.md`, `AGENTS.md`, `CLAUDE.md`: padrões e comandos.
- A criar: `.env.example`, `docker-compose.yml`, `drizzle.config.ts`, `src/db/seed.ts`, `src/proxy.ts`, `README.md`.
