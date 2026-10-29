# Resumo de Tarefas de Implementação de Nexo Assist

## Tarefas

- [ ] 1.0 Fundação: scaffold, dependências, design tokens, schema, banco e infraestrutura de testes
- [ ] 2.0 Regras do service desk (funções puras)
- [ ] 3.0 Serviço de chamados legado simulado e central de ajuda
- [ ] 4.0 Autenticação, Login (Tela 1) e Meu perfil
- [ ] 5.0 Domínio de conversas: estados, rascunhos, transferências e limites
- [ ] 6.0 Agent: classificadores, ferramentas, plano de regras e stream
- [ ] 7.0 Chat do funcionário (Telas 2 e 3)
- [ ] 8.0 Console do analista (Telas 4 e 5)
- [ ] 9.0 Avaliação de decisões, E2E e acessibilidade
- [ ] 10.0 Deploy e README

## Plano de Execução

A coluna **Paralelizável** decide quantas worktrees e workers serão abertos.
Marque `sim` somente quando a tarefa não depende de nada pendente **e** não compartilha nenhum
arquivo com outra tarefa paralelizável. Na dúvida, `não`. Ver `CLAUDE.md` seção 3.

Regra transversal: só a 1.0 mexe em `package.json`, `pnpm-lock.yaml`, `.env.example`,
`src/db/schema/**`, `drizzle/**`, `src/components/ui/**`, `vitest.config.ts` e `playwright.config.ts`.
Se uma tarefa posterior precisar mudar algum deles, o worker escala ao orquestrador, nunca edita.

| Tarefa | Depende de | Arquivos que toca | Paralelizável |
|---|---|---|---|
| 1.0 | nenhuma | `package.json`, `pnpm-lock.yaml`, configs na raiz, `.env.example`, `docker-compose.yml`, `drizzle/**`, `src/app/layout.tsx`, `src/app/page.tsx`, `src/app/globals.css`, `src/components/ui/**`, `src/lib/**`, `src/db/**` (exceto os seeds `legacy-tickets.ts` e `knowledge-base.ts` depois do stub), `tests/helpers/**`, `tests/smoke/**`, `README.md` | não |
| 2.0 | 1.0 | `src/modules/service-desk-rules/**` | sim |
| 3.0 | 1.0 | `src/modules/legacy-tickets/**`, `src/modules/knowledge-base/**`, `src/app/api/legacy/**`, `src/app/api/knowledge-base/**`, `src/modules/agent/clients/**`, `src/db/seed/legacy-tickets.ts`, `src/db/seed/knowledge-base.ts` | sim |
| 4.0 | 1.0 | `src/modules/auth/**`, `src/proxy.ts`, `src/app/api/sessions/**`, `src/app/api/me/**`, `src/app/login/**`, `src/app/(employee)/layout.tsx`, `src/app/(employee)/profile/**`, `src/components/layout/**` | sim |
| 5.0 | 2.0, 3.0, 4.0 | `src/modules/conversations/**`, `src/modules/usage/**`, `src/app/api/conversations/current/route.ts`, `src/app/api/conversations/current/request-analyst/**`, `src/app/api/drafts/**` | não |
| 6.0 | 5.0 | `src/modules/agent/**` (exceto `clients/`), `src/app/api/conversations/current/messages/**` | não |
| 7.0 | 6.0 | `src/app/(employee)/chat/**`, `src/components/chat/**` | sim |
| 8.0 | 6.0 | `src/app/console/**`, `src/components/console/**`, `src/app/api/console/**` | sim |
| 9.0 | 7.0, 8.0 | `evals/**`, `scripts/eval-decisions.ts`, `e2e/**` | não |
| 10.0 | 9.0 | `README.md`, `scripts/usage-report.ts`, `vercel.json` | não |

## Ondas de Execução

Agrupe as tarefas na ordem em que serão despachadas. Cada onda roda em paralelo; a próxima só
começa quando a anterior for revisada e aprovada.

- **Onda 1 (sequencial):** [1.0]
- **Onda 2 (paralela):** [2.0, 3.0, 4.0]
- **Onda 3 (sequencial):** [5.0]
- **Onda 4 (sequencial):** [6.0]
- **Onda 5 (paralela):** [7.0, 8.0]
- **Onda 6 (sequencial):** [9.0]
- **Onda 7 (sequencial):** [10.0]
