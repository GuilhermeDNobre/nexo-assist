# Tarefa 3.0: Serviço de chamados legado simulado e central de ajuda

<critical>Ler os arquivos `../prd.md` e `../techspec.md` (um nível acima desta pasta), se você não ler esses arquivos sua tarefa será invalidada</critical>
<critical>Ler também `AGENTS.md`, `docs/agents/worker.md` e `.claude/rules/README.md` antes de começar</critical>

## Execução

| Campo | Valor |
|---|---|
| Executada por | worker |
| Depende de | 1.0 |
| Paralelizável | sim |
| Worktree | `legacy-service` |

## Visão Geral

Construir o "sistema legado" que o agent consulta: uma API HTTP própria sobre o schema `legacy`, com privacidade por dono, idempotência e **indisponibilidade simulada**. Inclui também a busca da central de ajuda (schema `kb`), os dados de exemplo do Anexo B e os **clientes HTTP** que o agent vai usar.

Este módulo **não importa nada** de `src/modules/agent`, `conversations` ou `service-desk-rules`. O prazo (`dueAt`) chega pronto no corpo da criação.

<requirements>
- Autenticação de serviço: todo `/api/legacy/*` exige `Authorization: Bearer ${LEGACY_API_TOKEN}` (401 sem ele) e o header `X-Employee-Id` (400 sem ele).
- Endpoints (Tech Spec, "Endpoints de API", bloco Legado):

  | Rota | Comportamento |
  |---|---|
  | `GET /api/legacy/tickets` | Só os chamados do `X-Employee-Id`, do mais recente para o mais antigo |
  | `GET /api/legacy/tickets/:number` | 404 se não existe **ou** se pertence a outro funcionário, com a mesma resposta nos dois casos |
  | `POST /api/legacy/tickets` | Corpo validado com Zod: `type`, `title`, `description`, `category`, `priority`, `affected`, `dueAt`. Gera o número (`INC-` ou `REQ-` + sequência) e o status `open` |
  | `POST /api/legacy/tickets/:number/add-note` | Corpo `{ note, dueAt }`. Acrescenta a nota, substitui `due_at` pelo novo prazo e atualiza `updated_at` |
  | `POST /api/legacy/tickets/:number/reopen` | Corpo `{ note, dueAt }`. Status volta a `open`, `resolved_at = null`, `due_at` recebe o novo prazo. **422** se não está `resolved` ou se foi resolvido há mais de 7 dias |
  | `POST /api/legacy/tickets/:number/transfer` | Corpo `{ summary }`. Status `awaiting_analyst` e registro do resumo |
  | `POST /api/legacy/test/outage` | Só quando `NODE_ENV !== "production"` (em produção, 404); exige o token. Corpo `{ failNextRequests: number }`: as próximas N requisições a `/api/legacy/*` (exceto esta rota) devolvem 503. Usada pelo E2E da 9.0 |

  Todas as escritas geram um `ticket_events`.
- Idempotência: as escritas aceitam o header `Idempotency-Key`. Repetir a mesma chave devolve o mesmo resultado sem duplicar. Armazenar a chave em `legacy.idempotency_keys`, já criada pela 1.0. **Não alterar o schema**; se faltar algo, escalar ao orquestrador.
- Simulador de falha (`outage-simulator.ts`):
  - responde **503** `{ error: "legacy_unavailable" }` durante janelas configuradas por `LEGACY_OUTAGE_EVERY_S`/`LEGACY_OUTAGE_DURATION_S` ou por probabilidade `LEGACY_OUTAGE_RATE`;
  - desligado quando as variáveis estão vazias;
  - aceita também o contador `failNextRequests` (estado em memória do processo), definido pela rota de teste e decrementado a cada requisição;
  - o relógio e o gerador aleatório são injetáveis, para os testes.
- Central de ajuda: `GET /api/knowledge-base/articles?q=&os=` faz busca full-text em português (`websearch_to_tsquery('portuguese', q)`, com ranking) e filtra por `applies_to.os` quando o artigo tem essa restrição. Exige sessão? Não: usa o mesmo token de serviço, porque é chamada pelo agent.
- Seeds (substituir os stubs da 1.0):
  - `src/db/seed/knowledge-base.ts`: de 7 a 9 artigos curtos em português, incluindo "VPN com erro 809" (`applies_to: { os: ["windows_10"] }`), "Horário do service desk", troca de senha, impressora, Outlook no celular e acesso ao SAP.
  - `src/db/seed/legacy-tickets.ts`: os chamados do protótipo e do Anexo B para os IDs de `SEED_USER_IDS`, com datas **relativas ao momento do seed**:
    - INC-20311 de Ana, média, `awaiting_analyst`, atualizado há 6 dias, **vencido**;
    - INC-20298 de Ana, `in_progress`;
    - REQ-10442 de Ana, `approved`, há 1 semana;
    - INC-20150 de Ana, `resolved` há 4 dias;
    - INC-19877 e INC-19410 de Ana, `resolved` há mais de 7 dias;
    - chamados de outros funcionários (Carla, Bruno).
- Clientes em `src/modules/agent/clients/`:
  - `ticket-service-client.ts` implementa a interface `TicketServiceClient` da Tech Spec, criado por fábrica com o `employeeId` (`createTicketServiceClient(employeeId)`). `addNote` e `reopen` recebem `{ note, dueAt }`;
  - exportar a constante `LEGACY_RETRY_COUNT` (3), que a 9.0 usa para dimensionar `failNextRequests`;
  - `knowledge-base-client.ts`;
  - ambos usam axios, com `baseURL = APP_BASE_URL`, timeout de 4 s e **axios-retry** com 3 tentativas e backoff exponencial, **só** em 503 ou erro de rede, nunca em 4xx;
  - o cliente aceita `idempotencyKey` nas escritas;
  - erros viram classes tipadas: `LegacyUnavailableError`, `TicketNotFoundError`, `LegacyBusinessError`.
- DTOs do cliente definidos no próprio diretório `clients/`. Não importar de `src/modules/legacy-tickets`, porque a fronteira é HTTP.
- Status HTTP conforme `.claude/rules/http.md` (200, 400, 401, 404, 422, 500), além do 503 aprovado como desvio.
</requirements>

## Subtarefas

- [ ] 3.1 `src/modules/legacy-tickets/`: repositório, serviço (regras de status e reabertura), idempotência e `outage-simulator`
- [ ] 3.2 Route handlers `/api/legacy/tickets/**` com validação Zod, token e `X-Employee-Id`
- [ ] 3.3 `src/modules/knowledge-base/` e `GET /api/knowledge-base/articles`
- [ ] 3.4 Seeds de artigos e chamados (datas relativas, IDs de `SEED_USER_IDS`)
- [ ] 3.5 Clientes axios + axios-retry com erros tipados
- [ ] 3.6 Testes de unidade e integração

## Detalhes de Implementação

Ver na `../techspec.md`: "Pontos de Integração" (legado simulado), "Interfaces Principais" (`TicketServiceClient`), "Modelos de Dados" (schemas `legacy` e `kb`) e "Endpoints de API".

## Critérios de Sucesso

- Nenhuma rota devolve dados de chamado de outro funcionário, e um número de chamado alheio é indistinguível de um número inexistente.
- Com o simulador ligado, o cliente se recupera de uma janela curta de 503 e não duplica a criação.
- `pnpm db:seed` popula chamados e artigos; `pnpm typecheck`, `pnpm lint` e `pnpm test` passam.

## Testes da Tarefa

- [ ] Testes de unidade:
  - `outage-simulator` com relógio e aleatório injetados (dentro e fora da janela, taxa 0 e 1) e com `failNextRequests = 2` (duas falhas, depois sucesso);
  - regra de reabertura (resolvido há 6 e há 8 dias);
  - geração do número de chamado;
  - cliente axios com o adaptador mockado: retry em 503, sem retry em 404 e 422, `LegacyUnavailableError` depois de esgotar as tentativas, header `Idempotency-Key` enviado.
- [ ] Testes de integração (`*.int.test.ts`, Postgres real, lock `.locks/db-test`):
  - chamar os route handlers com e sem token (401) e sem `X-Employee-Id` (400);
  - listar só os próprios chamados;
  - ver chamado alheio → 404;
  - criar, adicionar nota (o `due_at` muda para o enviado), reabrir (200 com o novo `due_at`, e 422) e transferir;
  - `POST /api/legacy/test/outage` com `NODE_ENV=production` → 404;
  - repetir a criação com a mesma `Idempotency-Key` → um único chamado;
  - busca "vpn 809" com `os=windows_10` retorna o artigo, e com `os=windows_11` não retorna.

<critical>SEMPRE CRIE E EXECUTE OS TESTES DA TAREFA ANTES DE CONSIDERÁ-LA FINALIZADA</critical>
<critical>Se o comando de testes ainda não existir no projeto, registre "não executável ainda" — nunca invente saída de teste</critical>

## Arquivos relevantes

- `src/modules/legacy-tickets/**`
- `src/modules/knowledge-base/**`
- `src/app/api/legacy/**`
- `src/app/api/knowledge-base/**`
- `src/modules/agent/clients/**`
- `src/db/seed/legacy-tickets.ts`, `src/db/seed/knowledge-base.ts`
- Somente leitura: `src/db/schema/**`, `src/db/client.ts`, `src/env.ts`, `src/db/seed/users.ts`

## Reporte

Ao terminar, envie `worker_done` uma única vez com `--outcome succeeded` ou `--outcome failed`,
citando a saída de validação realmente observada e o que ficou de fora. Depois pare: não commite,
não feche o terminal e não inicie trabalho novo. Ver `docs/agents/worker.md`.
