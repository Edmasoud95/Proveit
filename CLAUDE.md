# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

**Proveit** — A sandbox platform for scaffolding, editing, and evaluating agent workflow POCs against local and external LLMs. Core loop: describe workflow → scaffold POC config → connect LLM → run LLM-as-judge evals.

## Commands

```bash
# Install all packages
pnpm install

# Database setup (first time, or after schema changes)
pnpm --filter backend db:setup        # prisma generate + migrate dev --name init

# Development (runs backend on :3000 and frontend on :5173 with proxy)
pnpm dev

# Individual packages
pnpm --filter backend dev
pnpm --filter frontend dev

# Build
pnpm build

# Tests
pnpm test
pnpm --filter backend test
pnpm --filter frontend test

# Database utilities
pnpm --filter backend db:migrate      # run pending migrations
pnpm --filter backend db:studio       # open Prisma Studio

# Lint
pnpm lint
```

## Architecture

**Monorepo** — three packages under `packages/`:

- `packages/backend` — NestJS API (TypeScript, ESM via CommonJS, port 3000)
- `packages/frontend` — React + Vite + Tailwind (port 5173, proxies `/api` to backend)
- `packages/shared` — TypeScript interfaces only, no runtime code, consumed by both

**Backend modules** (`packages/backend/src/`):

| Module | Responsibility |
|--------|----------------|
| `poc/` | POC config CRUD; scaffold endpoint calls ScaffoldService |
| `scaffold/` | Calls LLM with scaffold prompt, persists PocConfig + EvalCases |
| `llm/` | LLM connection CRUD, health check, model listing |
| `eval/` | Eval case CRUD, AI generation, eval run execution, SSE streaming |
| `eval/judge.service.ts` | LLM-as-judge scoring, returns `{ passed, score, reasoning }` |
| `prisma/` | Global PrismaService (PrismaClient + OnModuleInit) |

Key backend pattern: `POST /api/pocs/scaffold` is the main entry point — takes `{ description, endpointUrl, apiKey?, model? }`, calls ScaffoldService, returns full PocConfig with eval cases created.

**Eval streaming**: `POST /api/pocs/:id/evals/run` starts async execution and returns `{ runId }`. Client subscribes to `GET /api/pocs/:id/evals/run/:runId/stream` (SSE via NestJS `@Sse()`) to receive `case-start`, `case-complete`, `run-complete`, `error` events.

**Frontend pages** (`packages/frontend/src/pages/`):

| Page | Route | Purpose |
|------|-------|---------|
| `Home` | `/` | POC list + CreatePocForm (description + endpoint) |
| `PocEditor` | `/poc/:id` | Tabbed editor: system prompt / tools / eval cases |
| `LlmConnect` | `/poc/:id/llm` | Endpoint URL, API key, model selector, connection test |
| `EvalResults` | `/poc/:id/evals` | Run evals, live SSE stream, past run history |

**Frontend state**: React Query for all server state. No global UI state store. SSE consumed via native `EventSource` API in `EvalResults`.

**POC config data model**: Central entity. `tools` and `metadata` stored as JSON strings in SQLite, parsed in `PocService.findOne()`. `EvalCase.input` also stored as JSON string.

## Principles (from constitution)

- Minimal dependencies — resist adding packages not already in package.json
- Frontend never calls LLMs directly — always via backend
- Hand-crafted Tailwind components (`packages/frontend/src/components/ui/`) — no component library
- Subtle loading states and transitions are required UX, not polish
- Progressive disclosure — simple defaults, advanced options hidden behind toggles
- Local-first — default endpoint `http://localhost:1234/v1` (LM Studio)

## Tech Stack

- TypeScript 5.x (strict mode) everywhere
- Backend: NestJS 10, Prisma 5 (SQLite), OpenAI Node.js SDK, RxJS (SSE)
- Frontend: React 18, React Router 6, TanStack Query 5, Tailwind CSS 3, Vite 5
- Validation: `class-validator` + `class-transformer` on backend DTOs
- DB file: `packages/backend/prisma/dev.db` (gitignored)

## Active Technologies
- TypeScript 5.x (strict mode), Node.js 20 + NestJS 10 (backend), React 18 + Vite 5 + Tailwind CSS 3 (frontend), OpenAI Node.js SDK (002-tool-stubs)
- SQLite via Prisma 5 — no migration required (tools stored as JSON string in existing `PocConfig.tools` column) (002-tool-stubs)
- TypeScript 5.x (strict mode), Node.js 20 + NestJS 10 (backend), React 18 + Vite 5 + Tailwind CSS 3 (frontend), OpenAI Node.js SDK, Prisma 5 (003-versioned-eval-runs)
- SQLite via Prisma 5 — new `EvalSuiteVersion` model + extensions to `EvalRun` and `EvalResult` (003-versioned-eval-runs)
- TypeScript 5.x (strict mode), Node.js 20 + NestJS 10, Prisma 5, OpenAI Node.js SDK, React 18, TanStack Query 5, Tailwind CSS 3 (004-multi-provider-llm)
- SQLite via Prisma 5 — schema migration removes `@unique` from `LlmConnection.pocConfigId`, adds `name`/`isDefault`/`availableModels` fields, creates `TaskModelOverride` table (004-multi-provider-llm)
- TypeScript 5.x strict mode (005-poc-agent-chat)
- No new storage. Chat history is session-only (React state). (005-poc-agent-chat)
- TypeScript 5.x (strict mode) + React 18, TanStack Query 5, Tailwind CSS 3 (frontend); NestJS 10, Prisma 5 (backend — no changes required) (006-smart-stub-generation)
- N/A (no schema changes) (006-smart-stub-generation)
- TypeScript 5.x (strict mode) + NestJS 10, Prisma 5 (backend); React 18, TanStack Query 5, Tailwind CSS 3 (frontend) (007-poc-config-version-history)
- SQLite via Prisma 5 — new `PocConfigVersion` table; optional `configVersionId` FK on `EvalRun`; optional `configVersionId` FK on `PocConfig` (current version pointer) (007-poc-config-version-history)
- TypeScript 5.x (strict mode) + NestJS 10, Prisma 5 (backend); React 18, TanStack Query 5, Tailwind CSS 3, **Recharts** (frontend — user-specified) (008-eval-efficiency-metrics)
- SQLite via Prisma 5 — 3 nullable columns added to `EvalResult` (`promptTokens`, `completionTokens`, `totalTokens`); no new tables (008-eval-efficiency-metrics)
- TypeScript 5.x (strict mode) + NestJS 10 (SSE via `@Sse()` + RxJS Subject — already in codebase), React 18, TanStack Query 5, Tailwind CSS 3 (009-poc-generation-ux)
- SQLite via Prisma 5 — no schema changes required (009-poc-generation-ux)

## Recent Changes
- 002-tool-stubs: Added TypeScript 5.x (strict mode), Node.js 20 + NestJS 10 (backend), React 18 + Vite 5 + Tailwind CSS 3 (frontend), OpenAI Node.js SDK
