# Nexo Assist

Agent de service desk de TI em chat, com console do analista. Next.js 16, Mastra, PostgreSQL +
Drizzle, Vitest e Playwright.

## Requisitos

- Node.js 20.12 ou superior
- pnpm
- Docker (PostgreSQL local)

## Rodando localmente

```bash
pnpm install
cp .env.example .env
docker compose up -d
pnpm db:migrate
pnpm db:seed
pnpm dev
```

No Windows, use `Copy-Item .env.example .env` no lugar de `cp`.

A aplicação sobe em `http://localhost:3000` e a raiz redireciona para `/login`.

## Scripts

| Comando | Descrição |
|---|---|
| `pnpm dev` | Servidor de desenvolvimento |
| `pnpm build` | Build de produção |
| `pnpm start` | Servidor de produção |
| `pnpm lint` | ESLint |
| `pnpm typecheck` | Verificação de tipos (`tsc --noEmit`) |
| `pnpm test` | Vitest (projetos `unit` e `integration`) |
| `pnpm test:e2e` | Playwright |
| `pnpm db:generate` | Gera migrações do Drizzle |
| `pnpm db:migrate` | Aplica as migrações |
| `pnpm db:seed` | Popula os usuários de exemplo |

Os testes de integração e o Playwright usam `DATABASE_URL_TEST` e serializam o acesso com o lock
`.locks/db-test`.

## Estrutura

- `src/app/` — rotas e layout raiz
- `src/components/ui/` — componentes shadcn/ui
- `src/db/schema/` — schema Drizzle (`app`, `legacy`, `kb`)
- `src/db/seed/` — seed de usuários e stubs de chamados e artigos
- `tests/` — helpers de banco e testes de fumaça
- `drizzle/` — migrações
