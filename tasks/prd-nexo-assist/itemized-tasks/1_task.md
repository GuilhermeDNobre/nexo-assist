# Tarefa 1.0: Fundação — scaffold, dependências, design tokens, schema, banco e infraestrutura de testes

<critical>Ler os arquivos `../prd.md` e `../techspec.md` (um nível acima desta pasta), se você não ler esses arquivos sua tarefa será invalidada</critical>
<critical>Ler também `AGENTS.md`, `docs/agents/worker.md` e `.claude/rules/README.md` antes de começar</critical>

## Execução

| Campo | Valor |
|---|---|
| Executada por | worker |
| Depende de | nenhuma |
| Paralelizável | não |
| Worktree | atual |

## Visão Geral

Criar a base sobre a qual todas as outras tarefas trabalham em paralelo sem conflito. São o app Next.js 16, **todas** as dependências da stack, os tokens visuais do protótipo, o schema completo do banco com migrações, o Postgres via Docker, a validação de variáveis de ambiente, o Vitest e o Playwright configurados e o seed de usuários.

Depois desta tarefa, nenhuma outra edita `package.json`, lockfile, schema, `.env.example` ou `src/components/ui/`.

<requirements>
- Next.js 16 (App Router) com pnpm, React e TypeScript `strict: true` (incluir `noUncheckedIndexedAccess`). O diretório do código é `src/`.
- Instalar as dependências listadas na Tech Spec ("Stack registrada"):
  - `@mastra/core`, `@mastra/ai-sdk`, `ai`, `@ai-sdk/react`, `@typesafe-ai/sdk`;
  - `zod`, `drizzle-orm`, `pg`, `axios`, `axios-retry`, `jose`, `swr`, `date-fns`, `@date-fns/tz`;
  - dev: `drizzle-kit`, `@types/pg`, `tsx`, `vitest`, `@vitest/coverage-v8`, `@testing-library/react`, `@testing-library/jest-dom`, `@testing-library/user-event`, `jsdom`, `@playwright/test`, `@axe-core/playwright`;
  - Tailwind 4 e shadcn/ui.
- Componentes shadcn instalados em `src/components/ui/`: button, input, label, checkbox, radio-group, collapsible, badge, card, tooltip, avatar, separator, textarea, scroll-area, skeleton.
- Tokens do protótipo em `src/app/globals.css` (tema Tailwind 4):
  - fontes **Schibsted Grotesk** (texto) e **Newsreader** (títulos serifados do login), via `next/font/google`;
  - paleta extraída de `design/screens/prototype.html`: `#1B2431` texto e escuro, `#5B6472` texto secundário, `#3D4656`, `#0069C7`/`#0062C4` azul primário, `#0285F7` azul de destaque, `#E6E8EC` bordas, `#F6F7F9` fundo suave, `#00BD6C`/`#00804A` sucesso, `#F5A500`/`#946300` aviso, `#EE343B`/`#C4161D` erro, `#E6EFFA`/`#DCE9F7` azul suave.
- Schema Drizzle completo (Tech Spec, "Modelos de Dados") nos schemas Postgres `app`, `legacy` e `kb`:
  - enums em `src/db/schema/enums.ts`, exportando também os tipos TS (`TicketType`, `TicketCategory`, `TicketPriority`, `TicketStatus`, `UserRole`, `AnalystLevel`, `ConversationState`, `ConversationOutcome`, `AuthorType`, `DraftAction`, `DraftStatus`, `TransferReason`, `SummarySource`), com `TransferReason` = `explicit_request`, `critical`, `overdue_accepted`, `low_confidence` (Tech Spec, "Interfaces Principais");
  - colunas que ligam conversa, transferência e chamado: `conversations.active_ticket_number` (nullable), `conversations.last_outcome` (`resolved_by_agent`, `ticket_confirmed`, `transferred`, `closed_by_analyst`; nullable), `handoffs.ticket_number` (nullable), `handoffs.target_level` (`N1`/`N2`), `handoffs.summary_source` (`agent`/`automatic`);
  - `messages.counts_toward_limit` (boolean, padrão `false`): só as mensagens do funcionário ao agent contam no limite diário;
  - `kb.articles.search` como coluna tsvector gerada com a configuração `portuguese`;
  - `legacy.idempotency_keys` (`key` PK, `employee_id`, `response` jsonb, `created_at`), usada pela 3.0 para escritas idempotentes.
- Migrações geradas em `drizzle/`, com os scripts `db:generate`, `db:migrate` e `db:seed`.
- `docker-compose.yml` com Postgres 17 (porta 5432) e os bancos `nexo` e `nexo_test`.
- `src/env.ts`: validação com Zod de todas as variáveis da Tech Spec, falhando cedo com mensagem clara. As de LLM são opcionais no schema, porque as rotas que dependem delas validam na hora do uso.
- `.env.example` com **todas** as variáveis comentadas:
  - `DATABASE_URL`, `DATABASE_URL_TEST`, `SESSION_SECRET`, `LEGACY_API_TOKEN`, `APP_BASE_URL`;
  - `DEEPSEEK_API_KEY`, `AGENT_MODEL` (padrão `deepseek/deepseek-flash`), `TYPESAFE_API_KEY`;
  - `LEGACY_OUTAGE_EVERY_S`, `LEGACY_OUTAGE_DURATION_S`, `LEGACY_OUTAGE_RATE`;
  - `DAILY_BUDGET_USD`, `DAILY_MESSAGE_LIMIT` (30), `NEXT_PUBLIC_POLL_INTERVAL_MS` (3000).
  - `src/env.ts` separa o schema do servidor de uma exportação cliente (`clientEnv`) só com as variáveis `NEXT_PUBLIC_*`, para os componentes de chat e console lerem o intervalo de polling.
- Scripts no `package.json`: `dev`, `build`, `start`, `lint`, `typecheck` (`tsc --noEmit`), `test` (Vitest), `test:e2e` (Playwright), `db:generate`, `db:migrate`, `db:seed`, `eval` (`tsx scripts/eval-decisions.ts`), `usage:report` (`tsx scripts/usage-report.ts`). Os scripts `eval` e `usage:report` apontam para arquivos que as tarefas 9.0 e 10.0 criam.
- Vitest com dois projetos: `unit` (jsdom ou node conforme o arquivo) e `integration` (`*.int.test.ts`, node, Postgres real).
- Helper `tests/helpers/test-db.ts`: aplica migrações no `DATABASE_URL_TEST`, limpa as tabelas entre testes e serializa o acesso com o lock de diretório `.locks/db-test` (`tests/helpers/with-db-lock.ts`).
- `playwright.config.ts` para o E2E da 9.0:
  - `testDir: "e2e"`, `baseURL` `http://localhost:3100`;
  - `webServer`: `pnpm build && pnpm start -p 3100`, com `DATABASE_URL = DATABASE_URL_TEST`, `APP_BASE_URL = http://localhost:3100`, `AGENT_MODEL = fake` e sem `TYPESAFE_API_KEY`;
  - `globalSetup` adquire o lock `.locks/db-test`, aplica as migrações e roda o seed no banco de teste; `globalTeardown` libera o lock (arquivos em `tests/helpers/`);
  - `workers: 1`.
- Seed:
  - `src/db/seed/users.ts` com IDs **fixos e exportados** (`SEED_USER_IDS`) para:
    - funcionários: Ana Souza (`ana.souza@nexo.com.br`, Windows 11), Carla Mendes, Bruno Tavares, Diego Ramos (Windows 10) e mais um ou dois;
    - analistas: Rafael Lima (N2), Juliana Costa (N1).
  - `src/db/seed/index.ts` chama `seedUsers`, `seedLegacyTickets` e `seedKnowledgeBase`. As duas últimas ficam como **stubs vazios** em `legacy-tickets.ts` e `knowledge-base.ts`; a tarefa 3.0 os preenche.
- `src/app/page.tsx` redireciona para `/login`. O layout raiz aplica as fontes e `lang="pt-BR"`.
- `README.md` mínimo com os comandos para rodar localmente.
- `.gitignore`: acrescentar `node_modules/`, `.next/`, `.env`, `.env.local`, `test-results/`, `playwright-report/`, sem remover as linhas existentes.
</requirements>

## Subtarefas

- [ ] 1.1 Scaffold do Next 16 em `src/`, TypeScript estrito, ESLint, alias `@/*`
- [ ] 1.2 Instalar todas as dependências e os componentes shadcn listados
- [ ] 1.3 Fontes e tokens do protótipo em `globals.css` e no layout raiz
- [ ] 1.4 Schema Drizzle (`app`, `legacy`, `kb`, `enums`) e geração das migrações
- [ ] 1.5 `docker-compose.yml`, `src/db/client.ts` (pool `pg`) e `src/env.ts`
- [ ] 1.6 `.env.example` e scripts do `package.json`
- [ ] 1.7 Vitest (projetos unit e integration), Playwright e helpers de banco com lock
- [ ] 1.8 Seed de usuários, `seed/index.ts` e stubs dos seeds de chamados e artigos
- [ ] 1.9 Testes de fumaça e README mínimo

## Detalhes de Implementação

Ver na `../techspec.md`: "Visão Geral dos Componentes", "Modelos de Dados", "Decisões Principais" (stack registrada) e "Testes de Integração" (lock `.locks/db-test`).

As versões atuais conhecidas são: Next 16.4, AI SDK (`ai`) 7, `@ai-sdk/react` 4, Mastra core 1.79, Zod 4, Drizzle 0.45, Vitest 5, Playwright 1.64 e Tailwind 4.3. Fixe as versões que o pnpm resolver.

## Critérios de Sucesso

- `pnpm install`, `pnpm typecheck`, `pnpm lint` e `pnpm build` passam sem erros.
- `docker compose up -d` seguido de `pnpm db:migrate` e `pnpm db:seed` cria os três schemas e os usuários.
- `pnpm test` roda os dois projetos do Vitest e os testes de fumaça passam.
- Abrir `/` redireciona para `/login` (a página ainda não existe nesta tarefa, então basta o redirecionamento).

## Testes da Tarefa

- [ ] Testes de unidade: `src/env.ts` rejeita uma configuração inválida (ex.: `DATABASE_URL` ausente) e aceita uma válida; os tipos TS exportados dos enums batem com os valores do enum do banco.
- [ ] Testes de integração (`tests/smoke/db.int.test.ts`):
  - as migrações aplicam no `nexo_test`;
  - os schemas `app`, `legacy` e `kb` existem;
  - `seedUsers` insere os usuários com os IDs de `SEED_USER_IDS`;
  - a coluna `kb.articles.search` é preenchida ao inserir um artigo;
  - as colunas `conversations.active_ticket_number`, `conversations.last_outcome`, `handoffs.ticket_number`, `handoffs.target_level` e `messages.counts_toward_limit` existem.

<critical>SEMPRE CRIE E EXECUTE OS TESTES DA TAREFA ANTES DE CONSIDERÁ-LA FINALIZADA</critical>
<critical>Se o comando de testes ainda não existir no projeto, registre "não executável ainda" — nunca invente saída de teste</critical>

## Arquivos relevantes

- Raiz: `package.json`, `pnpm-lock.yaml`, `tsconfig.json`, `next.config.ts`, `postcss.config.mjs`, `eslint.config.mjs`, `components.json`, `drizzle.config.ts`, `vitest.config.ts`, `playwright.config.ts`, `docker-compose.yml`, `.env.example`, `.gitignore`, `README.md`, `next-env.d.ts`
- `drizzle/**`
- `src/app/layout.tsx`, `src/app/page.tsx`, `src/app/globals.css`
- `src/components/ui/**`, `src/lib/utils.ts`
- `src/env.ts`
- `src/db/client.ts`, `src/db/schema/{app,legacy,kb,enums,index}.ts`, `src/db/seed/{index,users,legacy-tickets,knowledge-base}.ts`
- `tests/helpers/{test-db,with-db-lock,playwright-global-setup,playwright-global-teardown}.ts`, `tests/smoke/**`

## Reporte

Ao terminar, envie `worker_done` uma única vez com `--outcome succeeded` ou `--outcome failed`,
citando a saída de validação realmente observada e o que ficou de fora. Depois pare: não commite,
não feche o terminal e não inicie trabalho novo. Ver `docs/agents/worker.md`.
