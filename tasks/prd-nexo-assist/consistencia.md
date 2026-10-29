# Análise de Consistência - Nexo Assist

## Resumo
- Data: 2026-10-26 (1ª passada) · 2026-10-29 (2ª passada)
- Veredito: **PRONTO PARA DESPACHAR**
- 1ª passada: AJUSTAR ANTES (4 High · 5 Medium · 3 Low · 0 Blocker; 4 perguntas)
- 2ª passada: os 12 achados foram resolvidos nos artefatos, as 4 perguntas respondidas e nenhum achado novo ficou aberto
- Lacunas: 0 · Contratos soltos: 0 · Conflitos com ADR: 0 (não há ADRs nem `CONTEXT.md`) · Ambiguidades: 0

## Matriz de rastreabilidade

| Requisito | Task(s) | Teste que prova | Status |
|---|---|---|---|
| RF01–RF03 login, e-mail desconhecido, papel | 4.0 | integração `POST /api/sessions` (funcionário, analista, desconhecido) | OK |
| RF04 manter conectado | 4.0 | unidade `maxAge` só com a opção | OK (ver C-12) |
| RF05 sair e guards | 4.0 | unidade da decisão do `proxy`; integração de logout | OK |
| RF06 streaming | 6.0, 7.0 | integração da rota de stream; integração da página | OK |
| RF07 conversa contínua | 5.0, 7.0 | integração `GET /api/conversations/current` cria e reutiliza; hidratação | OK |
| RF08 card de chamado | 5.0, 7.0 | componente `ticket-card` com "prazo vencido" | OK |
| RF09 seletor | 6.0, 7.0 | integração "status" → `data-ticket-picker`; componente | OK |
| RF10 rascunho | 5.0, 6.0, 7.0 | integração da confirmação; componente `draft-card` | OK |
| RF11 opções rápidas | 6.0, 7.0 | integração VPN → `data-quick-replies`; componente | OK |
| RF12 limite de 30 e "falar com analista" | 5.0, 6.0, 7.0, 9.0 | unidade 29/30; integração 422; E2E cenário 5 | OK (C-01 resolvido) |
| RF13 estado transferido e mensagens do analista | 6.0, 7.0, 8.0 | integração `with_analyst` sem LLM; E2E cenário 3 | OK (C-03 resolvido) |
| RF14 erros com tentar de novo | 7.0 | componente: 503 no rascunho, erro do stream | OK |
| RF15 intenção | 6.0, 9.0 | unidade `build-plan`; `pnpm eval` | OK |
| RF16 escopo | 6.0, 9.0 | integração "férias" → redirecionamento | OK |
| RF17 central de ajuda com condições | 3.0, 6.0 | integração "vpn 809" com `windows_10` e `windows_11` | OK |
| RF18–RF20 tipo, categoria, prioridade | 2.0, 6.0, 9.0 | unidade da matriz; `eval` | OK |
| RF21 prazo e vencido | 2.0, 3.0, 5.0 | unidade do SLA; seed vencido | OK (C-02 resolvido) |
| RF22 uma pergunta por vez | 6.0, 9.0 | instruções; E2E cenário 1 | OK (verificado por E2E e eval) |
| RF23 confirmação | 5.0, 6.0 | integração: não existe ferramenta de criação; confirmação só pela rota | OK |
| RF24 duplicidade e reabertura | 2.0, 3.0, 6.0 | unidade 6d23h/7d1h; `build-plan` update/reopen; integração reabrir 422 | OK |
| RF25 status e oferta de analista | 6.0, 7.0, 9.0 | E2E cenário 2 | OK |
| RF26 gatilhos de transferência (60%) | 2.0, 6.0 | unidade 0,59/0,60; integração confiança 0,41 | OK (ver C-06) |
| RF27 privacidade | 3.0, 6.0, 9.0 | integração 404 indistinguível; ferramenta ignora `employeeId` injetado; E2E cenário 4 | OK |
| RF28 agent pausado | 6.0 | integração `with_analyst` sem classificador nem LLM | OK |
| RF29 serviço de chamados | 3.0 | integração dos handlers | OK |
| RF30 indisponibilidade | 3.0, 5.0, 9.0 | unidade do simulador e do retry; integração 503 → um chamado; E2E cenário 6 | OK (ver C-05) |
| RF31 dados de exemplo | 1.0, 3.0 | integração do seed | OK |
| RF32 aguardando com motivo e prazo | 5.0, 8.0 | integração `transferToAnalyst` grava `wait_due_at` | OK (C-04 resolvido) |
| RF33 resumo do caso | 6.0 | `requestAnalyst` | OK (C-06 resolvido) |
| RF34 entra na fila | 8.0 | integração da lista por filtro | OK |
| RF35–RF36 lista, filtros, status com motivo | 8.0 | unidade do rótulo de status; integração dos filtros | OK (C-07 resolvido) |
| RF37–RF40 histórico, assumir, devolver, encerrar | 5.0, 8.0, 9.0 | integração das transições e marcos; E2E cenário 3 | OK (ver C-11) |
| RF41 painel somente leitura | 8.0 | integração dos chamados do funcionário com totais | OK (ver C-04) |
| RF42 atualização sem recarregar | 7.0, 8.0 | polling SWR | OK (ver C-08) |
| RF43–RF47 transparência | 5.0, 6.0, 7.0, 8.0 | `data-decision` + `decisions` persistidos; componentes da trilha e do painel | OK |
| RF48–RF49 Meu perfil | 4.0 | critério visual | OK |
| RF50 persistência | 1.0, 5.0 | tudo em Postgres; integração | OK |
| RF51–RF53 execução, deploy, README | 1.0, 10.0 | README; `usage:report` | OK |

## Achados

| ID | Severidade | Tipo | Onde (arquivo § seção) | Achado | Ajuste proposto |
|----|------------|------|------------------------|--------|-----------------|
| C-01 | High | lacuna | `prd.md` § F2 RF12: "Ao atingir o limite, o envio é bloqueado com explicação e a opção de falar com um analista." × `6_task.md` § requirements: "limite diário atingido → 422 (`daily_limit_reached`)" | No limite, a única forma de pedir analista é enviar uma mensagem, e essa rota devolve 422. Nenhuma task tem rota para pedir analista. | Criar `POST /api/conversations/current/request-analyst` (5.0), fora do limite: transfere com o motivo `explicit_request` e o resumo das últimas mensagens. O botão da 7.0 chama essa rota. Registrar na Tech Spec § Endpoints. |
| C-02 | High | contrato | `prd.md` § F3 RF21: "vale para a primeira resposta e para cada atualização" × `techspec.md` § Interfaces Principais: "`addNote(number: string, note: string)`" e "`reopen(number: string, note: string)`" | Atualização e reabertura não recalculam o prazo: o chamado complementado continua "vencido" pelo prazo antigo. A 3.0 vai implementar a assinatura sem `dueAt`. | `addNote(number, note, dueAt)` e `reopen(number, note, dueAt)`; o corpo das rotas `add-note` e `reopen` recebe `dueAt` e atualiza `due_at`; a 5.0 calcula com `computeDueAt` a partir de agora. Atualizar a Tech Spec e as tasks 3.0 e 5.0. |
| C-03 | High | contrato | `5_task.md` § requirements: "`GET /api/conversations/current` → `{ conversation: {...}, messages, ... }`" × `7_task.md`: "mensagem do analista identificada por nome e nível (ex.: 'Rafael Lima · Suporte N2')" e `8_task.md`: "`GET /api/console/conversations/:id` \| Mensagens, handoffs e decisões" | O formato de `messages` (autor, nome, nível) não está fixado. A 7.0 e a 8.0 rodam em paralelo e cada uma vai supor um formato. | Fixar na Tech Spec § Modelos de Dados o DTO `MessageDto = { id, authorType, author: { id, name, analystLevel: "N1"\|"N2"\|null } \| null, parts: UIMessagePart[], createdAt }`, usado pelas duas rotas. Produzido pela 5.0 (`message-dto.ts`) e reutilizado pela 8.0. |
| C-04 | High | lacuna | `prd.md` § F6 RF36: "'Transferida · INC-20311'" e RF41 "os chamados desta conversa" × `techspec.md` § Modelos de Dados: "`handoffs` \| `id`, `conversation_id`, `reason`, `confidence`, `summary`, ..." | Não há coluna que ligue a transferência (ou a conversa) a um chamado. O console não consegue montar "Transferida · INC-20311" nem o bloco "Desta conversa". Como é schema, precisa entrar na 1.0, antes do despacho. | Adicionar `handoffs.ticket_number` (nullable) e `conversations.active_ticket_number` (o último chamado mostrado, criado ou atualizado na conversa, gravado pela 5.0 na confirmação e pela 6.0 em `showTicket`). Atualizar a Tech Spec e as tasks 1.0, 5.0, 6.0 e 8.0. |
| C-05 | Medium | executabilidade | `9_task.md` cenário 6: "simulador forçado por variável no servidor de teste" × `3_task.md`: janelas por `LEGACY_OUTAGE_EVERY_S`/`LEGACY_OUTAGE_DURATION_S` ou `LEGACY_OUTAGE_RATE` | Com taxa 1 todas as chamadas falham, inclusive a nova tentativa; com janelas por tempo, o teste fica instável. Não há como fazer só a confirmação falhar e depois a nova tentativa funcionar. | A 3.0 adiciona `POST /api/legacy/test/outage { seconds }`, ativo só quando `NODE_ENV !== "production"`, protegido pelo token. Registrar na Tech Spec. |
| C-06 | Medium | ambiguidade | `6_task.md` passo 5: "se o plano é `transfer` por baixa confiança, executa a transferência deterministicamente" × `prd.md` RF33: "A transferência leva um resumo do caso gerado pelo agent" | Transferência sem LLM não tem resumo. | O caminho determinístico monta um resumo por template (intenção e campos entendidos, confiança, últimas 3 mensagens, chamado ativo) e o rotula como "resumo automático". |
| C-07 | Medium | lacuna | `prd.md` RF36: "'Resolvida pelo agent'" × `techspec.md` § Modelos: "`last_outcome`" (nenhuma task grava esse campo) | Nenhuma task define os valores de `last_outcome` nem quem os grava; a 8.0 não consegue derivar "Resolvida pelo agent". | Valores: `resolved_by_agent` (resposta da central ou consulta de status sem transferência), `ticket_confirmed`, `transferred`, `closed_by_analyst`. A 6.0 grava `resolved_by_agent`; a 5.0 grava os demais. Atualizar a Tech Spec e as tasks. |
| C-08 | Medium | contrato | `1_task.md`: "`CONSOLE_POLL_MS` (3000)" × `7_task.md`/`8_task.md`: "polling ... a cada `CONSOLE_POLL_MS`", lido em componentes cliente | Variável sem `NEXT_PUBLIC_` não chega ao navegador; a 7.0 e a 8.0 resolveriam isso de jeitos diferentes. | Renomear para `NEXT_PUBLIC_POLL_INTERVAL_MS` na 1.0 (`.env.example` e `src/env.ts` com uma exportação cliente). |
| C-09 | Medium | executabilidade | `9_task.md`: "o servidor sobe com `AGENT_MODEL=fake` ... banco re-semeado antes da suíte" | Não diz qual banco nem qual porta, e não cita o lock; re-semear o `nexo` apaga os dados de dev, e usar o `nexo_test` sem lock colide com os testes de integração. | E2E com `DATABASE_URL_TEST`, servidor na porta 3100, a suíte inteira dentro do lock `.locks/db-test`. Configurar no `playwright.config.ts` (1.0). |
| C-10 | Low | executabilidade | `7_task.md`: "rotas mockadas com MSW ou `fetch` mockado" | O MSW não está nas dependências da 1.0, e a 7.0 não pode adicionar dependência. | Trocar para "`fetch` mockado com `vi.fn`", ou incluir `msw` nas dependências da 1.0. |
| C-11 | Low | ambiguidade | `prd.md` RF39: "o agent retoma a conversa, ciente do atendimento humano" × `6_task.md`: "o histórico (últimas 20 mensagens) vem do banco" | Não está explícito que o histórico enviado ao LLM inclui as mensagens do analista e os marcos. | Explicitar na 6.0: histórico com todos os autores, mensagens do analista como "[Analista Rafael Lima]: ..." e os marcos como linhas de sistema. |
| C-12 | Low | ambiguidade | `4_task.md`: "sem ele, cookie de sessão (sem `maxAge`)" | O JWT não tem expiração definida no modo sem "manter conectado". | `exp` de 12 h sem a opção e de 30 dias com ela. |

## Resolução (2ª passada)

| ID | Onde foi resolvido |
|----|--------------------|
| C-01 | `prd.md` RF12; `techspec.md` § Endpoints e § Fluxo; 5.0 (rota `request-analyst`, `counts_toward_limit`); 6.0 (limite só no estado `agent`); 7.0 (composer); 9.0 cenário 5 |
| C-02 | `techspec.md` § Interfaces (`addNote`/`reopen` com `{ note, dueAt }`) e § Endpoints; 3.0; 5.0 (`dueAt` em update e reopen) |
| C-03 | `techspec.md` § Interfaces (`MessageDto`); 5.0 (`message-dto.ts`); 7.0 e 8.0 consomem |
| C-04 | `techspec.md` § Modelos; 1.0 (colunas); 5.0 (`setActiveTicket`, handoff com `ticket_number`); 6.0 (`showTicket`); 8.0 (painel e status) |
| C-05 | `techspec.md` § Endpoints e § Integração; 3.0 (`/api/legacy/test/outage`, `LEGACY_RETRY_COUNT`); 9.0 cenário 6 |
| C-06 | `techspec.md` § Transferência; 5.0 (`buildAutomaticSummary`, `summary_source`); 6.0 passo 5 |
| C-07 | `techspec.md` § Desfecho; 1.0 (enum); 5.0 e 6.0 (quem grava); 8.0 (rótulos) |
| C-08 | 1.0 (`NEXT_PUBLIC_POLL_INTERVAL_MS`, `clientEnv`); 7.0 e 8.0 |
| C-09 | `techspec.md` § E2E; 1.0 (`playwright.config.ts`, global setup com lock); 9.0 |
| C-10 | 7.0 (`fetch` com `vi.fn`) |
| C-11 | `techspec.md` § Decisões; 6.0 (histórico com todos os autores) |
| C-12 | `techspec.md` § Decisões; 4.0 (`exp` 12 h / 30 dias) |

Verificações da 2ª passada:
- Ajuste introduzido nesta passada e corrigido: `data-transfer` seria gravado por `transferToAnalyst` **e** escrito no stream pela 6.0 (card duplicado). Agora `transferToAnalyst` só devolve o payload e quem chama o coloca na própria mensagem.
- `TransferReason` não tinha valores definidos: fixado em `techspec.md` § Interfaces, 1.0 e 2.0.
- Arquivos das tasks paralelas continuam disjuntos: a rota nova `request-analyst` pertence à 5.0 (sequencial); 7.0 e 8.0 só leem `message-dto.ts` e `src/env.ts`; 2.0, 3.0 e 4.0 não ganharam arquivos em comum.
- Schema novo concentrado na 1.0 (regra transversal mantida).

## Perguntas ao usuário (respondidas em 2026-10-29)

Respostas: 1 — distinguir por nível (crítico ou vencido → N2, demais → N1; "Para você" mostra todos). 2 — prazo da prioridade do chamado, Alta sem chamado. 3 — "Resolvida pelo agent" = terminou sem transferência nem chamado novo. 4 — o limite vale só para a conversa com o agent; pedir e falar com analista não contam.

1. **Nível do analista na transferência:** o protótipo mostra "Transferida para Suporte N2". Proposta: crítico ou chamado vencido vai para N2, o resto para N1, e o filtro "Para você" mostra todas as conversas aguardando, de qualquer nível. Ou prefere não distinguir nível e mostrar sempre "Suporte"?
2. **Prazo de espera mostrado após a transferência** ("até 12:05"): no protótipo, "Um analista vai falar com você em até 2 h úteis". Proposta: usar o prazo da prioridade do chamado ativo (Alta = 4 h úteis; Crítica = 1 h) e Alta quando não há chamado. Ou um valor fixo de 2 h úteis para conversas transferidas?
3. **"Resolvida pelo agent" (C-07):** confirma que conta como resolvida uma resposta da central de ajuda ou uma consulta de status que terminou sem transferência nem chamado novo?
4. **Pedir analista no limite (C-01):** confirma que "Falar com um analista" funciona mesmo depois de 30/30 e não conta no limite?
