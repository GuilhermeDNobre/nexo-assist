# Bugs — Nexo Assist

## BUG-01 · Stubs de seed sem o banco (review da 1.0)

- Severidade: High (contrato entre tarefas)
- Status: corrigido pelo orquestrador no review da 1.0
- Onde: `src/db/seed/legacy-tickets.ts`, `src/db/seed/knowledge-base.ts`, `src/db/seed/index.ts`
- Sintoma: `seedLegacyTickets()` e `seedKnowledgeBase()` não recebiam o banco, ao contrário de `seedUsers(database)`.
- Causa raiz: o brief descrevia os stubs como "vazios" sem fixar a assinatura. A 3.0 só pode editar os dois arquivos de seed; sem o parâmetro, teria de importar o `db` global, e o seed do global setup do Playwright gravaria no `DATABASE_URL` (dev) em vez do `DATABASE_URL_TEST`.
- Solução aplicada: as duas funções recebem `database: Database` e `seedDatabase` repassa o banco.
- Teste de regressão: a 3.0 cobre com o teste de integração do seed rodando contra o banco de teste (chamados e artigos inseridos via `seedDatabase(db)` do `test-db`).
- Por que não houve worker de bugfix: correção de contrato entre tarefas, de duas linhas, que precisava estar fixa antes de despachar a onda 2.
