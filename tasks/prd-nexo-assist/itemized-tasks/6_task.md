# Tarefa 6.0: Agent — classificadores, ferramentas, plano de regras e stream

<critical>Ler os arquivos `../prd.md` e `../techspec.md` (um nível acima desta pasta), se você não ler esses arquivos sua tarefa será invalidada</critical>
<critical>Ler também `AGENTS.md`, `docs/agents/worker.md` e `.claude/rules/README.md` antes de começar</critical>

## Execução

| Campo | Valor |
|---|---|
| Executada por | worker |
| Depende de | 5.0 |
| Paralelizável | não |
| Worktree | atual |

## Visão Geral

Implementar o agent do Nexo Assist com Mastra, em três camadas:
1. um **classificador** (Jev ou o fallback com o LLM) produz uma `Classification` com confiança;
2. o **plano de regras** (2.0) decide a ação permitida, a prioridade, o prazo, a duplicidade e a transferência;
3. o **agent** (DeepSeek Flash) conversa e chama as ferramentas.

Cada turno é transmitido em streaming e grava um registro de decisão. Esta é a parte mais avaliada do desafio: a transparência.

<requirements>
- `classifiers/`:
  - `types.ts` com `DecisionClassifier`, `Classification` e `Scored<T>` exatamente como na Tech Spec;
  - `jev-classifier.ts`:
    - usa `@typesafe-ai/sdk` (`TypeSafeClient`, `choice`, `noul`; `client.systemOne({ state, questions })`) com timeout de 3 s e 1 retry;
    - o `state` leva a mensagem, as últimas 6 mensagens, os chamados do funcionário (número, título, status) e o `device_os`;
    - o chamado relacionado é um `choice` com os números dos chamados do funcionário mais `none`;
  - `llm-classifier.ts`: fallback que chama o modelo com **uma ferramenta obrigatória** `submitClassification` (input em Zod com todos os campos e confiança de 0 a 1); se a validação falhar, uma nova tentativa; se falhar de novo, `ClassificationFailedError`;
  - `select-classifier.ts`: usa Jev quando há `TYPESAFE_API_KEY`; qualquer erro do Jev cai no fallback e registra o log `classifier.fallback`.
- `planning/build-plan.ts`: função pura que recebe `Classification`, chamados, estado do rascunho e "agora" e devolve o plano:
  - ação permitida (`answer_from_kb`, `show_status`, `ask_missing_field`, `propose_draft`, `redirect_out_of_scope`, `transfer`, ...);
  - prioridade, `ruleApplied`, `dueAt`/`dueLabel`, `duplicateResolution` e `transfer`;
  - confiança efetiva = **mínimo** das confianças relevantes para a ação (intenção sempre; categoria, impacto e urgência quando for abrir chamado).
  - Usa somente `src/modules/service-desk-rules`.
- `tools/`, com `createTool` do Mastra e input em Zod:
  - `searchKnowledgeBase`, `listMyTickets`, `showTicketPicker`, `showTicket`, `askQuickQuestion`, `proposeDraft`, `requestAnalyst`;
  - `employeeId`, `conversationId` e o plano são lidos **sempre** do `requestContext`, nunca do input do LLM;
  - cada ferramenta emite `data-action` com o rótulo da trilha e o data part do seu componente (`writer.custom`, sempre com `await`);
  - `proposeDraft` usa tipo, prioridade, prazo e ação do **plano** e aceita do LLM só título, descrição e afetados; persiste via `drafts-service` (5.0);
  - `showTicket` grava o chamado mostrado com `setActiveTicket` (5.0);
  - `requestAnalyst` gera o resumo do caso (LLM) e chama `transferToAnalyst` (5.0) com `summarySource = agent` e o chamado ativo (`{ number, priority, dueAt }`), que já chama o `transfer` do legado e define o nível N1/N2; a ferramenta escreve no stream o `data-transfer` devolvido (o mesmo vale para o caminho determinístico do passo 5);
  - **não existe** ferramenta de criar ou atualizar chamado: isso só ocorre na confirmação do rascunho (5.0).
- `nexo-agent.ts` e `mastra.ts`:
  - `Agent` com `model` de `AGENT_MODEL` (padrão `deepseek/deepseek-flash`);
  - `instructions.ts` em português, contendo: escopo de TI; uma pergunta por vez; nunca afirmar sucesso sem confirmação; nunca falar de chamados de terceiros; obedecer à ação do plano recebida no contexto; explicar o motivo em linguagem simples;
  - **sem** Mastra Memory: o histórico (últimas 20 mensagens) vem do banco e inclui **todos os autores**: as mensagens do analista entram como "[Analista Rafael Lima]: ..." e os marcos (`data-system-event`) como linhas de sistema, para o agent retomar ciente do atendimento humano (RF39).
- `pipeline/handle-employee-message.ts` + `src/app/api/conversations/current/messages/route.ts` (`maxDuration = 60`):
  1. `requireEmployee` e carrega a conversa;
  2. se o estado **não é** `agent` (aguardando ou com analista): persiste a mensagem com `countsTowardLimit: false` e devolve um UI message stream vazio, **sem** checar limite nem orçamento e sem chamar classificador nem LLM. A mensagem fica no histórico para o analista ler (RF28 e Tela 5). O limite vale só para a conversa com o agent;
  3. com o estado `agent`: limite diário atingido → 422 (`daily_limit_reached`); orçamento estourado → 422 (`budget_exceeded`); lock por conversa contra requisições concorrentes (outra em andamento → 422); persiste a mensagem com `countsTowardLimit: true`;
  4. classifica e monta o plano;
  5. se o plano é `transfer` por baixa confiança, executa a transferência deterministicamente com `buildAutomaticSummary` (5.0) e `summarySource = automatic`, e avisa;
  6. `createUIMessageStream`: escreve `data-decision` e faz `nexoAgent.stream()` com `requestContext` e no máximo 5 passos, convertido por `toAISdkStream(stream, { from: 'agent' })` (passar a versão do AI SDK instalada: v7);
  7. `onFinish`: grava a mensagem do agent (partes), o registro em `decisions` (classificação, ação, confiança, regra, motivo e `tool_calls` com entrada, resultado/erro e duração) e o uso (`recordUsage`). Se a ação foi `answer_from_kb` ou `show_status` e o turno terminou sem transferência e sem rascunho novo, grava `recordOutcome(conversationId, "resolved_by_agent")` (5.0);
  8. falha do LLM → `data-error` com `retryable: true`.
- `fake-model/`: um modelo roteirizado e determinístico (resposta e chamadas de ferramenta por padrão de mensagem), selecionado por `AGENT_MODEL=fake`, **recusado quando `NODE_ENV=production`**. É usado pelos testes de integração e pelo E2E (9.0).
- Logs `agent.turn` (conversationId, classifierSource, action, confidence, latencyMs, tokens), sem o conteúdo das mensagens.
</requirements>

## Subtarefas

- [ ] 6.1 Tipos e `select-classifier` com o fallback por LLM (ferramenta obrigatória + Zod)
- [ ] 6.2 Classificador Jev com o SDK e o fallback em caso de erro
- [ ] 6.3 `build-plan.ts` (puro) sobre `service-desk-rules`
- [ ] 6.4 Ferramentas com `requestContext` e data parts
- [ ] 6.5 Agent, instruções e instância Mastra
- [ ] 6.6 Pipeline, rota de stream, registro de decisão e uso
- [ ] 6.7 Modelo falso roteirizado
- [ ] 6.8 Testes de unidade e integração

## Detalhes de Implementação

Ver na `../techspec.md`: "Resumo Executivo", "Fluxo de uma mensagem", "Interfaces Principais", "Pontos de Integração" (DeepSeek e Jev) e "Riscos Conhecidos".

O orquestrador vai colar no brief as assinaturas atuais do Mastra (`createTool`, `RequestContext`, `toAISdkStream`), do AI SDK 7 (`createUIMessageStream`, `createUIMessageStreamResponse`, mock de modelo em `ai/test`) e do `@typesafe-ai/sdk`. Se algo divergir do que encontrar instalado, pergunte antes de adaptar.

## Critérios de Sucesso

- Toda resposta do agent persiste um registro em `decisions` e começa com `data-decision` no stream.
- Com confiança efetiva abaixo de 0,6, a conversa termina em `awaiting_analyst` com o motivo "baixa confiança" e o percentual.
- Nenhum input do LLM consegue mudar o `employeeId` usado nas consultas.
- Sem `TYPESAFE_API_KEY`, tudo funciona com `classifierSource = llm_fallback`.
- `pnpm typecheck`, `pnpm lint` e `pnpm test` passam.

## Testes da Tarefa

- [ ] Testes de unidade:
  - `build-plan` para cada intenção: dúvida com artigo aplicável e não aplicável ao sistema operacional, status com chamado vencido, abertura com campo faltando, duplicado aberto → update, resolvido há 4 dias → reopen, fora de TI, crítico, confiança 0,59 e 0,60;
  - mapeamento da resposta do Jev (SDK mockado) para `Classification`;
  - fallback: resposta inválida → nova tentativa → sucesso, e duas inválidas → erro;
  - `select-classifier` cai no fallback quando o Jev lança erro;
  - ferramentas ignoram um `employeeId` injetado no input e usam o do contexto;
  - `proposeDraft` usa a prioridade do plano mesmo que o LLM sugira outra.
- [ ] Testes de integração (Postgres real, lock `.locks/db-test`, `AGENT_MODEL=fake`):
  - `POST /api/conversations/current/messages` "Meu notebook não conecta na VPN, erro 809" (Ana, Windows 11) → stream com `data-decision`, `data-action` e `data-quick-replies`, decisão gravada e uso gravado;
  - "Qual o status do meu chamado?" → `data-ticket-picker` com os 3 chamados abertos;
  - pergunta sobre férias → redirecionamento sem chamado;
  - estado `with_analyst` → a mensagem é persistida com `counts_toward_limit = false` e nenhum classificador ou LLM é chamado (verificar com spies);
  - 30 mensagens no dia com o estado `agent` → 422; 30 mensagens no dia com o estado `with_analyst` → 200 (a mensagem ao analista passa);
  - classificação com confiança 0,41 → conversa em `awaiting_analyst`, handoff com `summary_source = automatic`;
  - resposta da central de ajuda sem transferência → `last_outcome = resolved_by_agent`;
  - `showTicket` grava `active_ticket_number`;
  - histórico enviado ao modelo falso contém a mensagem do analista com o prefixo "[Analista ...]".

<critical>SEMPRE CRIE E EXECUTE OS TESTES DA TAREFA ANTES DE CONSIDERÁ-LA FINALIZADA</critical>
<critical>Se o comando de testes ainda não existir no projeto, registre "não executável ainda" — nunca invente saída de teste</critical>

## Arquivos relevantes

- `src/modules/agent/**`, **exceto** `src/modules/agent/clients/**` (somente leitura)
- `src/app/api/conversations/current/messages/**`
- Somente leitura: `src/modules/conversations/**`, `src/modules/usage/**`, `src/modules/service-desk-rules/**`, `src/modules/auth/**`, `src/db/**`, `src/env.ts`

## Reporte

Ao terminar, envie `worker_done` uma única vez com `--outcome succeeded` ou `--outcome failed`,
citando a saída de validação realmente observada e o que ficou de fora. Depois pare: não commite,
não feche o terminal e não inicie trabalho novo. Ver `docs/agents/worker.md`.
