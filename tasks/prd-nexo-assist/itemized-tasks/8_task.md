# Tarefa 8.0: Console do analista (Telas 4 e 5)

<critical>Ler os arquivos `../prd.md` e `../techspec.md` (um nível acima desta pasta), se você não ler esses arquivos sua tarefa será invalidada</critical>
<critical>Ler também `AGENTS.md`, `docs/agents/worker.md` e `.claude/rules/README.md` antes de começar</critical>

## Execução

| Campo | Valor |
|---|---|
| Executada por | worker |
| Depende de | 6.0 |
| Paralelizável | sim |
| Worktree | `analyst-console` |

## Visão Geral

Construir as APIs e a interface do console do analista, fiéis às Telas 4 e 5:
- a lista de conversas com busca, filtros e contadores;
- o histórico com marcos e o **detalhe completo das decisões do agent**;
- as ações assumir, devolver ao agent, encerrar e responder;
- o painel somente leitura com os chamados do funcionário.

<requirements>
- APIs em `src/app/api/console/**`, todas com `requireAnalyst` (funcionário → 403):

  | Rota | Comportamento |
  |---|---|
  | `GET /api/console/conversations?filter=all\|for-you\|with-agent\|mine&q=` | Itens com funcionário (nome e iniciais), prévia da última mensagem, horário, não lidas (mensagens depois de `analyst_last_read_at`) e status com motivo; contadores por filtro |
  | `GET /api/console/conversations/:id` | `{ conversation, messages: MessageDto[], handoffs, decisions }`, com as mensagens montadas por `toMessageDto` (5.0, `src/modules/conversations/message-dto.ts`) e as decisões **completas** (classificação, ação, confiança, regra, motivo, `tool_calls`). Marca como lida |
  | `POST /api/console/conversations/:id/assume` · `/return-to-agent` · `/close` | Usam o `conversation-service` (5.0); transição inválida → 422 |
  | `POST /api/console/conversations/:id/messages` | Só quando o estado é `with_analyst` **e** o analista é o responsável (senão 422 ou 403); grava `author_type = analyst` |
  | `GET /api/console/employees/:employeeId/tickets` | Lista do legado via `createTicketServiceClient(employeeId)`, com os totais de abertos e encerrados |

  - Filtros: `for-you` = `awaiting_analyst` de **qualquer** nível (N1 e N2); `with-agent` = `agent`; `mine` = `with_analyst` assumidas pelo analista logado. O item mostra o nível de destino do handoff (`handoffs.target_level`).
  - Status com motivo, derivado de `state`, do último handoff (`reason`, `confidence`, `ticket_number`, `target_level`) e de `last_outcome`:
    - `awaiting_analyst` + `ticket_number` → "Transferida · INC-20311";
    - `awaiting_analyst` + `reason = explicit_request` sem chamado → "Transferida · contato em 25 min" (a partir de `wait_due_at`);
    - `awaiting_analyst` + `reason = low_confidence` → "Agent pediu ajuda · confiança 41%";
    - `with_analyst` do analista logado → "Você está atendendo"; de outro → "Com [nome]";
    - `agent` + `last_outcome = resolved_by_agent` → "Resolvida pelo agent"; `agent` + `closed_by_analyst` → "Encerrada"; demais `agent` → "Agent atendendo".
- Interface (`src/app/console/**` e `src/components/console/**`), conforme `design/screens/4-console-conversas.png` e `5-console-atendimento-assumido.png`:
  - **barra estreita** com logo, ícone de conversas com contador e avatar do analista com o status "Disponível" (apenas visual);
  - **lista de conversas**: título "Conversas", selo "Disponível", busca, chips de filtro com contadores, itens com avatar e iniciais, nome, horário, prévia, badge de não lidas e status colorido **com texto**;
  - **área da conversa**:
    - cabeçalho com o funcionário e o selo de estado ("Aguardando atendente");
    - histórico com mensagens do funcionário (esquerda), do agent (selo "IA") e do analista (selo do nível, fundo verde-claro), com horários e marcos centralizados;
    - barra inferior:
      - em `awaiting_analyst`: "Ana espera um atendente · Agent pausado · até 12:05", com "Devolver ao agent" e "Assumir atendimento", e o campo de mensagem desabilitado ("Assuma o atendimento para responder");
      - em `with_analyst` com o analista responsável: campo ativo, botão de enviar, e no cabeçalho "Devolver ao agent" e "Encerrar atendimento".
  - **Detalhe das decisões**: em cada mensagem do agent, um controle "Ver decisão" abre o painel ou expansão com a classificação completa (cada campo com sua confiança), a ação, a regra, o motivo, a origem do classificador (Jev ou fallback) e a lista de chamadas de ferramenta (nome, entrada, resultado ou erro, duração). Falhas e baixa confiança ficam destacadas.
  - **Painel "Chamados da [nome]"**: "N abertos · M encerrados", "Desta conversa" (o chamado de `handoffs.ticket_number` do último handoff, ou `conversations.active_ticket_number` quando não houve transferência, com status e o marco "Transferido para um analista" ou "Assumido por [analista]"), "Outros chamados" e "Ver todos os chamados" (apenas visual). Somente leitura.
- Atualização por polling (SWR) a cada `clientEnv.NEXT_PUBLIC_POLL_INTERVAL_MS` (de `src/env.ts`) na lista e na conversa aberta.
- Estados de carregamento (skeleton), vazio ("Nenhuma conversa neste filtro") e erro em cada área.
- Acessibilidade: a lista é navegável por teclado, os chips de filtro têm `aria-pressed` e os botões de ícone têm `aria-label`.
</requirements>

## Subtarefas

- [ ] 8.1 Rotas de lista e detalhe com filtros, busca, contadores e não lidas
- [ ] 8.2 Rotas de ações e de mensagens do analista
- [ ] 8.3 Rota de chamados do funcionário
- [ ] 8.4 Layout do console e lista de conversas
- [ ] 8.5 Área da conversa com barras de ação por estado e o detalhe das decisões
- [ ] 8.6 Painel de chamados do funcionário
- [ ] 8.7 Testes de unidade, componente e integração

## Detalhes de Implementação

Ver na `../techspec.md`: "Endpoints de API" (bloco Console), "Visão Geral dos Componentes" e "Decisões Principais" (polling de 3 s). Os serviços de estado vêm de `src/modules/conversations` (5.0), os data parts de `message-parts.ts` e o formato do registro de decisão da tabela `decisions` (6.0).

## Critérios de Sucesso

- O analista vê em "Para você" a conversa transferida de Ana, assume, responde, devolve ao agent; em outra conversa, encerra. Cada ação aparece como marco no histórico.
- O detalhe de qualquer resposta do agent mostra a classificação com confianças e as chamadas de ferramenta.
- Um funcionário não acessa nenhuma rota `/api/console/*`.
- O visual confere com as Telas 4 e 5 em 1440×900.
- `pnpm typecheck`, `pnpm lint` e `pnpm test` passam.

## Testes da Tarefa

- [ ] Testes de unidade/componente:
  - derivação do rótulo de status com motivo para cada estado e motivo;
  - barra inferior em cada estado (botões e campo habilitados corretamente);
  - painel de decisão exibindo confianças, ferramentas e destaque de falha;
  - chips de filtro com contadores.
- [ ] Testes de integração (Postgres real, lock `.locks/db-test`):
  - lista por filtro e busca por nome e por número;
  - contadores;
  - não lidas zeram ao abrir;
  - assumir → mensagem → devolver → encerrar com as transições e os marcos;
  - mensagem de analista que não é o responsável → 403/422;
  - funcionário em qualquer rota do console → 403;
  - chamados do funcionário com totais corretos;
  - "Para você" lista conversas aguardando N1 e N2;
  - o detalhe devolve `MessageDto` com nome e nível do analista.

<critical>SEMPRE CRIE E EXECUTE OS TESTES DA TAREFA ANTES DE CONSIDERÁ-LA FINALIZADA</critical>
<critical>Se o comando de testes ainda não existir no projeto, registre "não executável ainda" — nunca invente saída de teste</critical>

## Arquivos relevantes

- `src/app/console/**`
- `src/components/console/**`
- `src/app/api/console/**`
- Somente leitura: `src/modules/conversations/**`, `src/modules/agent/clients/**`, `src/modules/auth/**`, `src/db/**`, `src/env.ts`, `src/components/ui/**`, `src/app/globals.css`

## Reporte

Ao terminar, envie `worker_done` uma única vez com `--outcome succeeded` ou `--outcome failed`,
citando a saída de validação realmente observada e o que ficou de fora. Depois pare: não commite,
não feche o terminal e não inicie trabalho novo. Ver `docs/agents/worker.md`.
