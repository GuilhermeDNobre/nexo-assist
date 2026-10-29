# Tarefa 7.0: Chat do funcionário (Telas 2 e 3)

<critical>Ler os arquivos `../prd.md` e `../techspec.md` (um nível acima desta pasta), se você não ler esses arquivos sua tarefa será invalidada</critical>
<critical>Ler também `AGENTS.md`, `docs/agents/worker.md` e `.claude/rules/README.md` antes de começar</critical>

## Execução

| Campo | Valor |
|---|---|
| Executada por | worker |
| Depende de | 6.0 |
| Paralelizável | sim |
| Worktree | `employee-chat` |

## Visão Geral

Construir a página `/chat` fiel às Telas 2 e 3: a conversa contínua com o Nexo Assist em streaming, os componentes ricos guiados pelos data parts, a **trilha de ações expansível** (transparência) e os estados de carregamento, erro, transferência e limite.

<requirements>
- `src/app/(employee)/chat/page.tsx`:
  - usa o layout do funcionário (4.0);
  - carrega `GET /api/conversations/current` e hidrata o `useChat` (`@ai-sdk/react`) com as mensagens persistidas;
  - envia para `POST /api/conversations/current/messages`;
  - cabeçalho com o selo "Assistente online" (ou "Com um analista" / "Aguardando atendente", conforme o estado).
- Renderização das mensagens (`src/components/chat/`), conforme `design/screens/2-chat-novo-chamado.png` e `3-chat-consulta-transferencia.png`:
  - mensagem do funcionário em bolha escura à direita;
  - mensagem do agent com o rótulo "Nexo Assist", a trilha de ações (`data-action`: "✓ consultou seus chamados") e o texto em cartão claro;
  - mensagem do analista identificada por nome e nível (ex.: "Rafael Lima · Suporte N2"), lidos de `author.name` e `author.analystLevel` do `MessageDto` (Tech Spec, "Interfaces Principais");
  - `data-transfer` mostra "Transferida para Suporte N1/N2" (`targetLevel`), o chamado quando houver e "Um analista vai falar com você até [hora]" a partir de `waitDueAt`;
  - marcos `data-system-event` centralizados.
- **Trilha expansível** (`decision-trail.tsx`, com o Collapsible do shadcn), que mostra a partir do `data-decision`:
  - o que o agent entendeu (intenção e dados extraídos);
  - a ação;
  - a confiança em %;
  - o motivo e a regra aplicada.
  - Baixa confiança (abaixo de 60%) e erros ficam destacados. O componente é operável por teclado e tem `aria-expanded`.
- `ticket-card.tsx` (`data-ticket-card`): número, título, descrição, status com ponto colorido **e texto**, categoria, prioridade, abertura, última atualização e "prazo vencido" em destaque de aviso.
- `ticket-picker.tsx` (`data-ticket-picker`): lista com radio. Escolher envia uma mensagem do funcionário com "INC-20311 · Título".
- `quick-replies.tsx` (`data-quick-replies`): botões. Clicar envia o texto da opção; a opção escolhida fica marcada e as demais desabilitadas depois da resposta.
- `draft-card.tsx` (`data-draft`):
  - cabeçalho "Novo chamado · Rascunho D-xxx" (ou "Atualização" / "Reabertura") com "Aguardando confirmação";
  - título, descrição, categoria, prioridade com `dueLabel` e afetados;
  - ações:
    - **Confirmar** (atalho ⌘/Ctrl+Enter) → `POST /api/drafts/:id/confirm`;
    - **Editar** → edição em linha dos campos editáveis → `PUT /api/drafts/:id`;
    - **Cancelar** → `POST /api/drafts/:id/cancel`;
  - durante a confirmação, os botões ficam desabilitados com indicador. Em 503, a mensagem é amigável e o botão de tentar de novo continua disponível. Depois de confirmado, o card vira estado "confirmado" e a nova mensagem com o card do chamado aparece.
- `chat-composer.tsx`:
  - campo "Escreva para o Nexo...", botão "Enviar", contador "N/30 mensagens nesta sessão";
  - bloqueado com explicação quando o limite foi atingido **e o estado é `agent`**, oferecendo "Falar com um analista", que chama `POST /api/conversations/current/request-analyst` (fora do limite; 200 → passa para o estado aguardando e ativa o polling);
  - com o estado aguardando ou com analista, o composer fica liberado mesmo em 30/30: o limite vale só para a conversa com o agent;
  - bloqueado enquanto há resposta em streaming.
- Estados:
  - carregando a conversa (skeleton);
  - agent pensando (indicador acessível);
  - erro do stream (`data-error` ou erro HTTP), com "Tentar de novo" e sem perder o texto digitado;
  - conversa transferida ou com analista: o composer continua enviando pela mesma rota. O servidor grava a mensagem e devolve um stream vazio (6.0), e o agent não responde. Mostre o aviso "Um analista vai responder por aqui".
- Polling a cada `clientEnv.NEXT_PUBLIC_POLL_INTERVAL_MS` (SWR, de `src/env.ts`) **somente** quando o estado não é `agent`, para receber as mensagens do analista e as mudanças de estado.
- Acessibilidade:
  - lista de mensagens com `aria-live="polite"`;
  - foco visível e rótulos em botões de ícone;
  - status nunca só por cor;
  - navegação por teclado nas opções rápidas, no seletor e no rascunho.
</requirements>

## Subtarefas

- [ ] 7.1 Página `/chat` com `useChat`, hidratação e envio
- [ ] 7.2 Renderização por autor e por data part, mais os marcos
- [ ] 7.3 Trilha de ações expansível com o detalhe da decisão
- [ ] 7.4 Card de chamado, seletor de chamado e opções rápidas
- [ ] 7.5 Card de rascunho com confirmar, editar e cancelar e os estados
- [ ] 7.6 Composer, contador, limite e estados de erro e transferência com polling
- [ ] 7.7 Testes de componente e de integração da página

## Detalhes de Implementação

Ver na `../techspec.md`: "Fluxo de uma mensagem", "Confirmação de rascunho" e "Console" (polling). Os tipos dos data parts estão em `src/modules/conversations/message-parts.ts` (5.0). As telas de referência são `design/screens/2-*.png` e `3-*.png`, com `design/screens/prototype.html` como guia de espaçamentos e cores.

## Critérios de Sucesso

- Os fluxos das Telas 2 e 3 funcionam de ponta a ponta com `AGENT_MODEL=fake`: abertura com opções rápidas → rascunho → confirmação → card; e consulta → seletor → card vencido → oferta de analista.
- Toda resposta do agent exibe a trilha, e a trilha expandida mostra intenção, ação, confiança e motivo.
- O visual confere com o protótipo em 1440×900; o chat continua utilizável em 390 px de largura.
- `pnpm typecheck`, `pnpm lint` e `pnpm test` passam.

## Testes da Tarefa

- [ ] Testes de unidade/componente (Testing Library):
  - trilha recolhida e expandida, e destaque abaixo de 60%;
  - card de chamado com "prazo vencido";
  - seletor envia o texto correto;
  - opções rápidas desabilitam depois da escolha;
  - rascunho: confirmar chama a rota, 503 mostra erro e permite tentar de novo, editar envia PUT com o payload completo;
  - composer bloqueado em 30/30 com o estado `agent`, e "Falar com um analista" chama `request-analyst`;
  - composer liberado em 30/30 com o estado `with_analyst`;
  - mensagem do analista com nome e nível; `data-transfer` com o nível e o horário.
- [ ] Testes de integração da página (rotas mockadas com `fetch` mockado por `vi.fn`; o MSW não faz parte das dependências):
  - hidratação das mensagens persistidas;
  - envio com resposta em stream simulada contendo data parts;
  - estado `awaiting_analyst` ativa o polling e mostra o aviso.

<critical>SEMPRE CRIE E EXECUTE OS TESTES DA TAREFA ANTES DE CONSIDERÁ-LA FINALIZADA</critical>
<critical>Se o comando de testes ainda não existir no projeto, registre "não executável ainda" — nunca invente saída de teste</critical>

## Arquivos relevantes

- `src/app/(employee)/chat/**`
- `src/components/chat/**`
- Somente leitura: `src/modules/conversations/message-parts.ts`, `src/modules/conversations/message-dto.ts`, `src/env.ts`, `src/components/ui/**`, `src/components/layout/**`, `src/app/globals.css`

## Reporte

Ao terminar, envie `worker_done` uma única vez com `--outcome succeeded` ou `--outcome failed`,
citando a saída de validação realmente observada e o que ficou de fora. Depois pare: não commite,
não feche o terminal e não inicie trabalho novo. Ver `docs/agents/worker.md`.
