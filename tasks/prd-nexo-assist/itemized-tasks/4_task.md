# Tarefa 4.0: Autenticação, Login (Tela 1) e Meu perfil

<critical>Ler os arquivos `../prd.md` e `../techspec.md` (um nível acima desta pasta), se você não ler esses arquivos sua tarefa será invalidada</critical>
<critical>Ler também `AGENTS.md`, `docs/agents/worker.md` e `.claude/rules/README.md` antes de começar</critical>

## Execução

| Campo | Valor |
|---|---|
| Executada por | worker |
| Depende de | 1.0 |
| Paralelizável | sim |
| Worktree | `auth-login` |

## Visão Geral

Implementar o login sem senha real, a sessão assinada, a proteção das páginas por papel, a Tela 1 (Login) fiel ao protótipo, o layout do funcionário (barra lateral usada pelo chat e pelo perfil) e a tela Meu perfil.

<requirements>
- `src/modules/auth/`:
  - `session.ts`: JWT HS256 com `jose` e `SESSION_SECRET`. O payload tem `sub` (userId), `role` e `name`. O cookie `nexo_session` é HttpOnly, `SameSite=Lax`, `Secure` em produção e `path=/`.
  - Com "manter conectado", JWT com `exp` de 30 dias e cookie com `maxAge` de 30 dias; sem ele, JWT com `exp` de 12 h e cookie de sessão (sem `maxAge`).
  - `guards.ts`: `getSession()`, `requireEmployee()` e `requireAnalyst()` para route handlers e server components. Sem sessão → 401; papel errado → 403. Corpos JSON conforme `http.md`.
- `POST /api/sessions`:
  - corpo `{ email, password, keepSignedIn }` validado com Zod (400);
  - e-mail sem cadastro ou senha vazia → **401** com a mensagem "E-mail ou senha inválidos", a mesma para qualquer caso, sem revelar quais e-mails existem;
  - sucesso → 200 `{ user: { id, name, email, role }, redirectTo }`, com `redirectTo` = `/chat` para funcionário e `/console` para analista;
  - o e-mail é normalizado (trim e minúsculas).
- `DELETE /api/sessions/current` limpa o cookie. `GET /api/me` devolve o usuário da sessão.
- `src/proxy.ts` (convenção do Next 16, exportando a função `proxy`):
  - `/chat` e `/profile` exigem papel `employee`; `/console` exige papel `analyst`;
  - sem sessão → redireciona para `/login`; papel errado → redireciona para a área do papel;
  - em `/login` com sessão válida → redireciona para a área do papel.
- **Tela 1** (`src/app/login/page.tsx`), fiel a `design/screens/1-login.png`:
  - coluna esquerda escura com o logo, o título serifado em Newsreader, o texto de apoio, a prévia ilustrativa do chat e os três números ilustrativos (texto fixo);
  - coluna direita com o formulário: e-mail com ícone, senha com ícone e botão de mostrar/ocultar, "Esqueci minha senha" (apenas visual), o checkbox "Manter conectado neste computador" e o botão "Entrar →";
  - estados: carregando (botão desabilitado com indicador), erro (mensagem acessível com `role="alert"`), validação de campos vazios;
  - rodapé com "© 2026 Nexo · Service desk de TI" e "Privacidade e uso de dados".
- Layout do funcionário (`src/app/(employee)/layout.tsx` e `src/components/layout/employee-sidebar.tsx`), conforme as Telas 2 e 6:
  - logo e os itens "Atendimento" (`/chat`) e "Meu perfil" (`/profile`), com o item ativo destacado;
  - avatar com iniciais, nome e e-mail, e "Sair" (chama `DELETE /api/sessions/current` e vai para `/login`);
  - cabeçalho com breadcrumb "Service desk de TI › [página]".
  - O selo "Assistente online" pertence ao chat (tarefa 7.0), não a este layout.
- **Meu perfil** (`src/app/(employee)/profile/page.tsx`), fiel a `design/screens/6-meu-perfil.png`: nome e e-mail com "Gerenciado pela TI", e o cartão de senha "Alterada há N dias" com "Redefinir senha" desabilitado/visual e a nota de redefinição.
- Acessibilidade: rótulos em todos os campos, foco visível, botão de ícone com `aria-label`, contraste AA.
</requirements>

## Subtarefas

- [ ] 4.1 `session.ts` e `guards.ts` com testes
- [ ] 4.2 `POST /api/sessions`, `DELETE /api/sessions/current` e `GET /api/me`
- [ ] 4.3 `src/proxy.ts` com as regras por papel
- [ ] 4.4 Tela de Login fiel ao protótipo, com os estados
- [ ] 4.5 Layout do funcionário (barra lateral e cabeçalho) e Meu perfil
- [ ] 4.6 Testes de unidade, integração e componente

## Detalhes de Implementação

Ver na `../techspec.md`: "Decisões Principais" (sessão JWT própria com `jose`) e "Endpoints de API". Para o visual, ver `design/screens/1-login.png`, `6-meu-perfil.png` e `2-chat-novo-chamado.png` (barra lateral). O HTML de referência com classes Tailwind está em `design/screens/prototype.html`: use-o como guia de espaçamentos e cores, não copie o markup gerado.

## Critérios de Sucesso

- Ana Souza (`ana.souza@nexo.com.br`, qualquer senha) entra e é levada a `/chat`; Rafael Lima entra e é levado a `/console`.
- Um e-mail desconhecido recebe 401 com mensagem genérica.
- Um funcionário que acessa `/console` é redirecionado; um analista que acessa `/chat` também.
- A tela de login confere visualmente com o protótipo em 1440×900.
- `pnpm typecheck`, `pnpm lint` e `pnpm test` passam.

## Testes da Tarefa

- [ ] Testes de unidade:
  - assinar e verificar um token; token expirado ou adulterado é rejeitado;
  - `maxAge` presente só com "manter conectado"; `exp` de 12 h sem a opção e de 30 dias com ela;
  - a lógica de decisão do `proxy` (função pura que recebe caminho e sessão e devolve a ação);
  - formulário de login (Testing Library): validação de vazio, estado de carregamento, mensagem de erro anunciada.
- [ ] Testes de integração (Postgres real, lock `.locks/db-test`):
  - `POST /api/sessions` com funcionário, analista, e-mail desconhecido, senha vazia e corpo inválido;
  - cookie definido corretamente nos dois modos;
  - `GET /api/me` com e sem sessão;
  - logout limpa o cookie.

<critical>SEMPRE CRIE E EXECUTE OS TESTES DA TAREFA ANTES DE CONSIDERÁ-LA FINALIZADA</critical>
<critical>Se o comando de testes ainda não existir no projeto, registre "não executável ainda" — nunca invente saída de teste</critical>

## Arquivos relevantes

- `src/modules/auth/**`
- `src/proxy.ts`
- `src/app/api/sessions/**`, `src/app/api/me/**`
- `src/app/login/**`
- `src/app/(employee)/layout.tsx`, `src/app/(employee)/profile/**`
- `src/components/layout/**`
- Somente leitura: `src/db/**`, `src/env.ts`, `src/components/ui/**`, `src/app/globals.css`

## Reporte

Ao terminar, envie `worker_done` uma única vez com `--outcome succeeded` ou `--outcome failed`,
citando a saída de validação realmente observada e o que ficou de fora. Depois pare: não commite,
não feche o terminal e não inicie trabalho novo. Ver `docs/agents/worker.md`.
