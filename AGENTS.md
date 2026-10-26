# AGENTS.md

Shared contract for **every coding agent** in this repository, whatever the tool. It states what
the project is and how code is written here. It does not assign roles:

- the **orchestrator** role lives in `CLAUDE.md`, which imports this file;
- the **worker** role lives in `docs/agents/worker.md`, which every worker brief points to;
- coding standards live in `.claude/rules/` (see `.claude/rules/README.md`).

On conflict: role file (`CLAUDE.md` or `docs/agents/worker.md`) > this file > `.claude/rules/`.

## Project

**nexo-assist** — an IT service desk agent in a chat (employee side) plus an analyst console,
built for a hiring challenge. Requirements: `tasks/prd-nexo-assist/prd.md`; architecture:
`tasks/prd-nexo-assist/techspec.md`. User-facing text is Brazilian Portuguese.

## Stack

Chosen by the user on 2026-10-26 (rationale in the Tech Spec, "Decisões Principais"):

- **pnpm**, **Next.js 16** (App Router, `proxy.ts` instead of `middleware.ts`), React, TypeScript strict
- **Tailwind 4 + shadcn/ui**; prototype tokens from `design/screens/prototype.html`
- **Mastra** (`@mastra/core`, `@mastra/ai-sdk`) + **AI SDK 7**; LLM **DeepSeek Flash**
  (`deepseek/deepseek-flash`, `DEEPSEEK_API_KEY`); decision classifier **Jev**
  (`@typesafe-ai/sdk`, optional `TYPESAFE_API_KEY`) with an LLM fallback
- **PostgreSQL + Drizzle** (`pg`): Docker locally, Neon in production; schemas `app`, `legacy`, `kb`
- **Vitest** (unit/integration) and **Playwright** (E2E); deploy on **Vercel**
- An Electron desktop build comes later, on its own branch, against the hosted database

Module boundaries that are not obvious from one file: `src/modules/agent` reaches the simulated
ticket system **only over HTTP** (`ticket-service-client`), never by importing
`src/modules/legacy-tickets`. Service-desk rules (priority, SLA, duplicates, transfer) live as pure
functions in `src/modules/service-desk-rules`, never in prompts.

All rules in `.claude/rules/` apply (see `.claude/rules/README.md`).

No dependency manifest exists yet, so there is **no runnable build, lint or test command until the
scaffold task lands**; that task records them here. Never report a validation as passing when its
command does not exist.

Design decisions and their rejected alternatives belong in `docs/adr/`, and the domain glossary in
`CONTEXT.md`, once they exist. Read both before planning or implementing: they explain why the
code looks the way it does.

## Environment pitfalls

Facts about this machine and toolchain that cost a debugging session once. Keep them short; the
`/fechar-ciclo` command adds to this list.

- The prototype is `design/nexo.pen` (file format 2.21). The Pencil MCP only reads a file already
  open in the desktop editor (open it from the app; `Pen.exe <file>` does not), and older `pen`
  CLIs reject format 2.21. Without the app, read it headless with
  `pen` ≥ 0.3.13: `pen interactive --in design/nexo.pen --out <scratch-copy>.pen`, then
  `execute({ input: 'Export([...ids], "png", "<dir>", {scale:1})' })`. Exported screens live in
  `design/screens/` (`1-login.png` … `6-meu-perfil.png`, plus `prototype.html` in Tailwind).

---

## Engineering rules

These bias toward caution over speed. For trivial tasks, use judgment.

### Think before acting

Do not assume, do not hide confusion, surface tradeoffs. State assumptions explicitly; if multiple
interpretations exist, present them instead of silently picking one. If something is unclear, ask.

### Simplicity first

Minimum code that solves the problem, nothing speculative. No features beyond what was asked, no
abstractions for single-use code, no unrequested configurability, no error handling for impossible
scenarios. Simplicity governs **how** each item is implemented, never **whether** it is
implemented. Cutting scope is not simplification.

### Surgical changes

Touch only what the task requires. Do not improve adjacent code, comments, or formatting. Do not
refactor what is not broken. Match existing style. Mention unrelated dead code instead of deleting
it. Remove only the imports and symbols your own change orphaned.

### Goal-driven execution

Turn every task into a verifiable goal before starting: "add validation" becomes "write tests for
invalid inputs, then make them pass". Weak success criteria ("make it work") guarantee rework.

### The spec is the request

A PRD, TechSpec, or task file is a contract. Every item gets implemented. Never silently drop,
defer, merge, or "phase" items; if one looks unnecessary, ask before skipping. Before declaring a
multi-item task done, enumerate every item and its status:

```
- [Item 1] -> done
- [Item 2] -> partial - what is missing and why
- [Item 3] -> skipped - reason, surfaced earlier
```

### Honesty about validation

Never fabricate command output, test results, file paths, or dependencies. A validation counts only
when its output was observed in this session. Missing output means it did not run.

### Language

- **English:** source code, identifiers, comments, commit messages, PR descriptions, `AGENTS.md`,
  `CLAUDE.md`, `docs/agents/`.
- **Portuguese:** `.claude/commands/`, `.claude/templates/`, `.claude/rules/`, and every generated
  process document (`prd.md`, `techspec.md`, `tasks.md`, `*_task.md`, `bugs.md`).
- Conversation with the user follows the user's language.

### Comments

Prefer self-explanatory code. No restating what the code does, no TODOs, no section headers, no
"added for X" notes. Comment only when the *why* is non-obvious.

### Commits

- [Conventional Commits](https://www.conventionalcommits.org/): `type(scope): subject`, imperative,
  lowercase, no trailing period.
- **Never add `Co-Authored-By:` trailers or any assistant attribution.**
- Only the orchestrator commits, and only when the user asks.

### Code quality

Keep functions small and well under the complexity ceiling, modules focused, dependencies pointing
toward stable abstractions with no cycles. Tests cover the branches that can break, and their
assertions would fail if the logic were subtly wrong (`>` to `>=`, a flipped sign, a deleted line).

---

## Maintaining this file

Generated by `agent-kit` as a starting point. Keep it true to what the project is: exact commands,
non-obvious relationships between modules, conventions a newcomer could not infer from one file.
Keep it under ~200 lines; move topic-specific rules into `.claude/rules/`.
