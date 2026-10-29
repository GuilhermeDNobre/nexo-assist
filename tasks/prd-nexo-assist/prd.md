# PRD — Nexo Assist, o agent do service desk de TI

## Visão Geral

Na Nexo (cerca de 2.000 funcionários), os chamados de TI são abertos por formulário. Isso gera chamados para dúvidas que a central de ajuda já responde, duplicidade, prioridade errada e analistas presos à triagem. O **Nexo Assist** é um agent em chat: consulta os chamados do funcionário, busca na central de ajuda, abre ou atualiza chamados após confirmação e chama um analista quando precisa. O **console do analista** recebe as conversas transferidas. O diferencial central é a **transparência**: cada resposta mostra o que o agent entendeu, que ação tomou, com que confiança e por quê.

Referências: `Desafio_Tecnico_Nexo_Assist_PRD_v5.pdf` (Anexos A e B) e o protótipo `design/nexo.pen` (telas em `design/screens/`).

## Objetivos

- **Resolução sem fila:** dúvidas e consultas de status resolvidas no chat, sem chamado nem analista.
- **Chamados bem abertos:** 100% dos chamados do agent com todos os campos obrigatórios e nenhum duplicado.
- **Encaminhamento certo:** toda transferência segue um gatilho do Anexo A e leva um resumo que dispensa o analista de perguntar tudo de novo.
- **Transparência:** 100% das respostas do agent exibem ações, intenção, confiança e motivo.
- **Eficiência:** respostas em streaming e custo por conversa conhecido e limitado.
- **Avaliação:** atender os critérios do desafio (decisões, conversa, transparência, interface, arquitetura, README) e o diferencial de deploy.

## Histórias de Usuário

**Funcionário da Nexo** (persona primária):

1. Quero tirar uma dúvida sem abrir chamado, para resolver na hora.
2. Quero saber como está um chamado meu sem lembrar o número, e se está atrasado.
3. Quero complementar um chamado aberto com novas informações.
4. Quero abrir um chamado conversando e conferir os dados antes da criação.
5. Quero falar com um analista quando eu preferir ou quando o problema for grave.
6. Quero voltar outro dia e continuar de onde parei.
7. Quero ver meus dados de acesso em Meu perfil.

**Analista do service desk, N1/N2** (persona secundária):

8. Quero receber chamados com tipo, categoria e prioridade corretos e uma descrição que não exija perguntar tudo de novo.
9. Quero ver as conversas que precisam de mim, inclusive quando o agent não teve segurança para decidir.
10. Quero assumir uma conversa com o agent pausado e depois devolvê-la ao agent ou encerrá-la.

**Casos extremos** (cobertos nos RFs): assunto fora de TI (RF16), chamado de outra pessoa (RF27), serviço indisponível (RF30), chamado já aberto ou resolvido recentemente (RF24) e limite de mensagens (RF12).

## Funcionalidades Principais

### F1. Login e sessão (Tela 1)

- **RF01** O login aceita o e-mail de qualquer funcionário ou analista dos dados de exemplo, com qualquer senha não vazia.
- **RF02** E-mail desconhecido é recusado com mensagem clara, sem revelar quais e-mails existem.
- **RF03** O papel vem do cadastro: o funcionário vai para o chat e o analista para o console.
- **RF04** "Manter conectado" preserva a sessão após fechar o navegador; sem ele, a sessão termina ao fechar.
- **RF05** "Sair" encerra a sessão. Chat, perfil e console exigem sessão válida e o papel correto.

### F2. Chat do funcionário (Telas 2 e 3)

- **RF06** Respostas em streaming, com indicação de que o agent está trabalhando.
- **RF07** **Uma conversa contínua por funcionário:** ao voltar, o histórico e o estado (rascunho pendente, transferência) reaparecem.
- **RF08** **Card de chamado:** número, título, descrição, status, categoria, prioridade, abertura, última atualização e situação do prazo, com "prazo vencido" em destaque.
- **RF09** **Seleção de chamado:** com vários candidatos, o agent lista os chamados do funcionário para ele escolher.
- **RF10** **Rascunho:** antes de criar ou atualizar, o agent mostra título, descrição, categoria, prioridade com prazo calculado ("resposta até 13:43") e afetados, com as ações Confirmar, Editar e Cancelar.
- **RF11** **Opções rápidas:** perguntas com botões de resposta (ex.: "Só eu / Minha equipe / Toda a empresa / Não sei"); texto livre também é aceito.
- **RF12** **Limite de 30 mensagens do funcionário ao agent por sessão**, com contador visível ("18/30"). A sessão é o dia: o contador zera no dia seguinte e o histórico permanece. No limite, o envio ao agent é bloqueado com explicação e a opção de falar com um analista. Pedir analista e conversar com ele não contam no limite.
- **RF13** Com a conversa transferida ou com um analista, o chat mostra esse estado e identifica as mensagens do analista por nome e nível.
- **RF14** Falhas aparecem como mensagem amigável com opção de tentar de novo, sem perder o texto digitado.

### F3. Agent: decisão e regras do service desk

- **RF15** Identifica a intenção: dúvida, consulta de status, complemento, abertura, pedido de analista ou assunto fora de TI.
- **RF16** **Escopo:** RH, financeiro e facilities são redirecionados ao canal certo, sem chamado.
- **RF17** **Central de ajuda primeiro:** aplica um artigo só quando as condições dele valem para o caso (ex.: "só Windows 10").
- **RF18** **Tipo:** INC quando algo parou ou não funciona; REQ para pedido de acesso, equipamento ou software.
- **RF19** **Categoria:** Acesso, Rede e VPN, Hardware, Software, E-mail ou Outros.
- **RF20** **Prioridade** por impacto e urgência:

  | Prioridade | Quando usar | Prazo |
  |---|---|---|
  | Crítica | Algo parado para uma equipe ou a empresa | 1 hora corrida (plantão 24h) |
  | Alta | Impede uma pessoa de trabalhar, ou há compromisso no mesmo dia | 4 horas úteis |
  | Média | Atrapalha, mas há alternativa | 3 dias úteis |
  | Baixa | Pedidos e melhorias sem urgência | 5 dias úteis |

- **RF21** **Prazo:** vale para a primeira resposta e para cada atualização. Horário útil é de segunda a sexta, das 8h às 18h, sem feriados. Passado o prazo, o chamado está **vencido**.
- **RF22** **Abertura:** exige título, descrição, tipo, categoria, prioridade e afetados. O agent pergunta o que faltar, uma pergunta por vez.
- **RF23** **Confirmação:** nada é criado ou atualizado sem a confirmação explícita do funcionário no rascunho.
- **RF24** **Sem duplicidade:** chamado aberto sobre o mesmo problema → propõe atualizar; resolvido há até 7 dias → propõe reabrir; resolvido há mais tempo → abre novo.
- **RF25** **Status:** informa status, última atualização e prazo. Se o chamado estiver vencido, oferece chamar um analista.
- **RF26** **Transferência** quando: (a) o funcionário pede; (b) o caso é crítico (registra o chamado confirmado e transfere); (c) o funcionário aceita a oferta por chamado vencido; (d) a confiança do agent fica **abaixo de 60%**. O funcionário é avisado.
- **RF27** **Privacidade:** dados de um chamado só vão para quem o abriu. Pedidos sobre chamados de terceiros são recusados sem confirmar se o chamado existe.
- **RF28** O agent não responde enquanto a conversa aguarda ou está com um analista.

### F4. Serviço de chamados simulado

- **RF29** Componente separado do agent. Permite consultar chamados (por funcionário e por número), criar, atualizar (complementar, mudar status, reabrir) e transferir.
- **RF30** Simula a instabilidade do legado: fica indisponível por alguns segundos de vez em quando. Agent e interface tratam a falha sem perder dados e sem afirmar sucesso falso.
- **RF31** Dados de exemplo:
  - funcionários e analistas N1/N2;
  - de 5 a 10 artigos curtos, incluindo "VPN erro 809" e "Horário do service desk";
  - chamados abertos, vencidos, aprovados, em andamento, resolvidos há menos e há mais de 7 dias, e de outros funcionários.

### F5. Transferência para analista

- **RF32** A conversa fica **aguardando atendente**, com motivo (pedido, crítico, vencido ou baixa confiança com o percentual), nível de destino (Suporte N2 para chamado crítico ou vencido, N1 nos demais) e prazo de espera igual ao prazo da prioridade do chamado (Alta quando não há chamado).
- **RF33** A transferência leva um **resumo do caso**: problema, o que já foi tentado, chamados relacionados e motivo.
- **RF34** A conversa entra imediatamente na fila do console.

### F6. Console do analista (Telas 4 e 5)

- **RF35** Lista de conversas com busca por nome ou número de chamado e com os filtros **Todas**, **Para você** (aguardando), **Com o agent** e **Minhas**, cada um com contador.
- **RF36** Cada item mostra funcionário, última mensagem, horário, não lidas e um status com motivo (ex.: "Agent pediu ajuda · confiança 41%").
- **RF37** O histórico distingue funcionário, agent (selo "IA") e analista (nome e nível), além dos marcos ("Transferida para Suporte N2", "Rafael Lima assumiu · agent pausado").
- **RF38** **Assumir:** o analista passa a responder e o agent pausa. Antes disso, o campo de mensagem fica desabilitado.
- **RF39** **Devolver ao agent:** o agent retoma a conversa, ciente do atendimento humano.
- **RF40** **Encerrar:** a conversa é finalizada como resolvida pelo analista.
- **RF41** **Painel de chamados do funcionário**, somente leitura: os chamados da conversa e os demais, com status e totais de abertos e encerrados.
- **RF42** O console mostra as atualizações das conversas sem recarregar a página.

### F7. Visibilidade das decisões

É a parte mais importante do desafio.

- **RF43** Acima de cada resposta, uma **trilha de ações** em linguagem simples ("✓ consultou seus chamados", "✓ classificou a prioridade").
- **RF44** No chat, a trilha é **expansível**: intenção e dados entendidos, ação escolhida, confiança e motivo, com a regra aplicada (ex.: "Alta: compromisso no mesmo dia").
- **RF45** No console, o analista vê o detalhe completo, incluindo cada chamada de ferramenta com entrada e resultado ou falha.
- **RF46** Baixa confiança e falhas do serviço ficam destacadas visualmente.
- **RF47** O detalhe fica persistido com a mensagem e continua disponível ao reabrir a conversa.

### F8. Meu perfil (tela adicional do protótipo)

- **RF48** Mostra nome e e-mail do funcionário, com "Gerenciado pela TI".
- **RF49** O cartão "Redefinir senha" é apenas visual.

### F9. Persistência e continuidade

- **RF50** Conversas, mensagens, detalhes de decisão, chamados e o estado de cada conversa (com o agent, aguardando, com analista, encerrada) sobrevivem a reinício da aplicação.

### F10. Execução e deploy

- **RF51** Roda localmente com poucos comandos documentados e traz `.env.example`.
- **RF52** Deploy público com chaves protegidas e limites de uso por usuário e de custo total.
- **RF53** O README cobre:
  - como rodar e a visão geral da arquitetura;
  - como o agent decide e como a qualidade das decisões foi garantida;
  - a escolha do modelo, os trade-offs e como o deploy foi feito;
  - o que seria feito com mais tempo.

## Experiência do Usuário

- **Funcionário:** descreve o problema → o agent consulta, pergunta o que falta e mostra o rascunho → confirma → vê o chamado. Se houver transferência, aguarda e conversa com o analista no mesmo chat.
- **Analista:** filtro "Para você" → lê histórico, resumo e decisões → assume → devolve ao agent ou encerra.
- **Protótipo:** seguir layout, cores e tipografia das telas 1 a 5 e de Meu perfil, com liberdade nos detalhes. São apenas ilustrativos: os números do login, "Esqueci minha senha", "Ligue no ramal 4000" e o status "Disponível".
- **Estados:** carregamento, vazio e erro em toda área com dados.
- **Idioma:** português do Brasil.
- **Acessibilidade:**
  - navegação por teclado, inclusive nas opções rápidas e no rascunho;
  - foco visível e rótulos em botões de ícone;
  - contraste AA;
  - novas mensagens anunciadas a leitores de tela;
  - status nunca indicado só por cor.
- **Layout:** desktop (1440 px) é o alvo; o chat continua utilizável em telas menores.

## Restrições Técnicas de Alto Nível

- **Obrigatórios do desafio:**
  - TypeScript estrito;
  - Mastra (preferência) ou LangGraph.js;
  - qualquer LLM, com a escolha justificada no README;
  - interface fiel ao protótipo (sugestão: Next.js ou React).
- **Arquitetura:** interface, agent e serviço de chamados separados.
- **Persistência:** dados sobrevivem a reinício (RF50).
- **Segurança e privacidade:**
  - chaves fora do código;
  - nenhum funcionário acessa chamados de outro;
  - console restrito a analistas;
  - logs sem dados pessoais.
- **Desempenho e custo:** a primeira parte da resposta aparece em poucos segundos; contexto enxuto; custo por conversa estimável.
- **Resiliência:** queda temporária do serviço de chamados não derruba a conversa nem gera estado inconsistente.
- **Qualidade:**
  - testes nas regras do service desk, no cálculo de prazo, na duplicidade, na privacidade e nas decisões do agent em cenários-chave;
  - commits que contam a história do desenvolvimento.

## Fora de Escopo

Os itens estão divididos em **cortados do produto** (não serão feitos) e **adiados** (podem vir depois, mas não fazem parte desta entrega).

**Cortados:**

- Autenticação real: senha, SSO ou redefinição de senha.
- Edição de chamados no console.
- Integração com um sistema de chamados real.
- Métricas reais no login.
- Controle de disponibilidade do analista.
- Feriados no cálculo de prazos.

**Adiados:**

- Notificações por e-mail ou push.
- Distribuição automática de conversas entre analistas.
- Administração da central de ajuda e do cadastro de funcionários.
- Console otimizado para mobile.
- Outros idiomas.
