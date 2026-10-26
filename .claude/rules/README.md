# Regras do Projeto

Padrões de engenharia compartilhados entre o Claude (orquestrador) e os workers, qualquer que seja a ferramenta deles.

Precedência: arquivo do papel (`CLAUDE.md` ou `docs/agents/worker.md`) > `AGENTS.md` > estas regras.

## Stack escolhida

Em 2026-10-26 o usuário escolheu Next.js 16 + React + TypeScript, pnpm, Tailwind + shadcn/ui,
Mastra, PostgreSQL + Drizzle, Vitest e Playwright (ver `AGENTS.md` e a Tech Spec em
`tasks/prd-nexo-assist/techspec.md`). Com isso, **todas as regras abaixo valem**, inclusive as
condicionais. Os exemplos de código com Jest ou npm são ilustrativos: no projeto use Vitest e pnpm.

## Sempre aplicáveis

Valem para qualquer stack, porque descrevem princípios e não ferramentas.

| Arquivo | Escopo |
|---|---|
| `code-standards.md` | Idioma do código, nomenclatura, magic numbers, tamanho de funções e classes, efeitos colaterais, comentários, escopo de variáveis |
| `logging.md` | Níveis de log, armazenamento, dados sensíveis, contexto e estrutura |
| `tests.md` | Independência, AAA/GWT, mocks e tempo, cobertura, nomenclatura de testes |

## Condicionais

Só valem **depois** que a tecnologia correspondente for escolhida pelo usuário. As três estão
**ativas** neste projeto.

| Arquivo | Aplica-se quando | Status |
|---|---|---|
| `node.md` | O projeto usar Node.js / TypeScript | Ativa |
| `react.md` | O projeto usar React | Ativa |
| `http.md` | O projeto expuser uma API REST/HTTP | Ativa; desvio aprovado: 503 no legado simulado |

## Como usar

1. Antes de escrever ou revisar código, carregue as regras **sempre aplicáveis**.
2. Carregue uma regra condicional apenas se a tecnologia dela já fizer parte do projeto.
3. Se uma regra condicional for a única resposta para uma decisão ainda em aberto, isso é um sinal
   de que a decisão precisa subir para o usuário — não trate a regra como se a escolha já tivesse
   sido feita.

## Manutenção

Sempre que a stack mudar, atualize este README movendo as regras condicionais que passaram a valer
(ou deixaram de valer), e ajuste `CLAUDE.md` e `AGENTS.md` na mesma passada.

As regras condicionais que vêm no kit cobrem Node/TypeScript, React e REST/HTTP. Se o projeto usar
outra stack, substitua esses arquivos pelos equivalentes da sua — a divisão em dois grupos é que
importa, não a lista específica.
