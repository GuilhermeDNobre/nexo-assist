# Tarefa 9.0: Avaliação de decisões, E2E e acessibilidade

<critical>Ler os arquivos `../prd.md` e `../techspec.md` (um nível acima desta pasta), se você não ler esses arquivos sua tarefa será invalidada</critical>
<critical>Ler também `AGENTS.md`, `docs/agents/worker.md` e `.claude/rules/README.md` antes de começar</critical>

## Execução

| Campo | Valor |
|---|---|
| Executada por | worker |
| Depende de | 7.0, 8.0 |
| Paralelizável | não |
| Worktree | atual |

## Visão Geral

Produzir a evidência de qualidade:
- uma **avaliação das decisões do agent** sobre um conjunto rotulado, comparando Jev e fallback, que será citada no README;
- os testes **E2E** com Playwright cobrindo os fluxos principais das duas personas;
- as verificações automáticas de **acessibilidade**.

<requirements>
- `evals/decision-cases.json` com cerca de 30 casos em português. Cada caso tem: `id`, `employee` (chave do seed), `history` (opcional), `message` e os valores esperados de `intent`, `category`, `ticketType`, prioridade final (após `derivePriority`) e ação do plano. Cobertura mínima:
  - dúvida resolvida pela central;
  - dúvida cujo artigo não se aplica ao sistema operacional;
  - status sem número e com número;
  - status de chamado vencido;
  - abertura de INC e de REQ;
  - complemento de chamado aberto (update);
  - problema de chamado resolvido há 4 dias (reopen);
  - crítico (equipe parada);
  - alta por compromisso no mesmo dia;
  - média e baixa;
  - RH, financeiro e facilities (fora de escopo);
  - pedido explícito de analista;
  - mensagens ambíguas que devem cair abaixo de 0,6;
  - pergunta sobre chamado de outra pessoa.
- `scripts/eval-decisions.ts` (`pnpm eval`):
  - roda o classificador + `build-plan` de cada caso **com as chaves reais**;
  - executa o Jev quando há `TYPESAFE_API_KEY` e o fallback sempre;
  - imprime uma tabela com a acurácia por campo, a confiança média em acertos e erros, a latência média e o custo estimado por caminho;
  - grava `evals/results/latest.json`;
  - sem chaves, sai com uma mensagem clara (não falha silenciosamente);
  - **não roda no CI**.
- E2E em `e2e/` (Playwright, já configurado na 1.0):
  - o servidor e o banco já estão configurados pela 1.0 em `playwright.config.ts`: `next start` na porta 3100, `DATABASE_URL_TEST`, `AGENT_MODEL=fake`, sem `TYPESAFE_API_KEY`, seed no global setup e a suíte inteira dentro do lock `.locks/db-test`. Não edite essa configuração; se faltar algo, escale;
  - cenários:
    1. Ana: login → "notebook não conecta na VPN, erro 809" → opção rápida "Só eu" → menciona reunião às 14h → rascunho com prioridade Alta → Confirmar → card do chamado criado;
    2. Ana: "qual o status do meu chamado?" → seletor → INC-20311 → card "prazo vencido" → "Falar com um analista" → estado aguardando com "Transferida para Suporte N2" (chamado vencido);
    3. Rafael: login → filtro "Para você" mostra Ana → abre → "Ver decisão" mostra a confiança → Assumir → envia mensagem → Ana vê a mensagem no chat com "Rafael Lima · Suporte N2" → Devolver ao agent; em outra conversa transferida → Encerrar;
    4. Ana pergunta pelo chamado de Carla (número real) → nenhuma informação vazada;
    5. limite: com 29 mensagens contadas no dia (preparadas pelo helper), uma mensagem → contador 30/30 → composer bloqueado → "Falar com um analista" → estado aguardando → Ana ainda consegue enviar mensagem ao analista;
    6. legado indisponível na confirmação: antes de confirmar, `POST /api/legacy/test/outage` com `failNextRequests = LEGACY_RETRY_COUNT + 1` (3.0) e o header de token → Confirmar → erro amigável → tentar de novo → um único chamado.
- Acessibilidade com `@axe-core/playwright` em `/login`, `/chat` (com rascunho e trilha expandida), `/profile` e `/console` (conversa aberta): zero violações `serious` ou `critical`.
- Os testes E2E são independentes entre si: cada um prepara o próprio estado pelo seed ou pelas APIs.
</requirements>

## Subtarefas

- [ ] 9.1 Conjunto rotulado `evals/decision-cases.json`
- [ ] 9.2 `scripts/eval-decisions.ts` com o relatório e o arquivo de resultado
- [ ] 9.3 Fixtures e helpers de E2E (login por papel, reset do seed)
- [ ] 9.4 Cenários E2E 1 a 6
- [ ] 9.5 Verificações axe

## Detalhes de Implementação

Ver na `../techspec.md`: "Testes de Integração" (avaliação de decisões) e "Testes de E2E". O modelo falso roteirizado vem da 6.0 (`src/modules/agent/fake-model/`). Se um cenário E2E exigir um roteiro que o modelo falso ainda não cobre, **escale**: não edite a 6.0.

## Critérios de Sucesso

- `pnpm test:e2e` passa os 6 cenários e as verificações axe, de forma estável em 3 execuções seguidas.
- `pnpm eval` roda com as chaves e gera o relatório; sem chaves, explica o que falta.
- `pnpm typecheck` e `pnpm lint` passam.

## Testes da Tarefa

- [ ] Testes de unidade: o cálculo de acurácia e do agregado do relatório no `eval-decisions` (função pura testada com resultados fictícios).
- [ ] Testes de integração / E2E: os 6 cenários e as verificações axe acima. Executar o `pnpm eval` real **só se** houver chaves no ambiente; caso contrário, registrar "não executado: sem chaves".

<critical>SEMPRE CRIE E EXECUTE OS TESTES DA TAREFA ANTES DE CONSIDERÁ-LA FINALIZADA</critical>
<critical>Se o comando de testes ainda não existir no projeto, registre "não executável ainda" — nunca invente saída de teste</critical>

## Arquivos relevantes

- `evals/**`
- `scripts/eval-decisions.ts` (e o teste dele)
- `e2e/**`
- Somente leitura: todo o `src/**`, `playwright.config.ts`, `src/db/seed/**`

## Reporte

Ao terminar, envie `worker_done` uma única vez com `--outcome succeeded` ou `--outcome failed`,
citando a saída de validação realmente observada e o que ficou de fora. Depois pare: não commite,
não feche o terminal e não inicie trabalho novo. Ver `docs/agents/worker.md`.
