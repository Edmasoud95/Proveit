# Contributing to Proveit

Thanks for your interest! This document covers the local setup and the
conventions the codebase follows.

## Prerequisites

- Node.js **20+** (see `.nvmrc`)
- pnpm 11 (`corepack enable` will pick up the pinned version from
  `packageManager` in `package.json`)
- An OpenAI-compatible LLM endpoint for actually exercising the app —
  [LM Studio](https://lmstudio.ai/) on `http://localhost:1234/v1` is the
  default assumption, but any OpenAI-compatible API works.

## Setup

```bash
pnpm install
pnpm --filter backend db:setup   # prisma generate + migrate
pnpm dev                         # backend :3000 + frontend :5173
```

## Repository layout

| Path | What it is |
|---|---|
| `packages/backend` | NestJS 10 API. One module per domain (`poc/`, `llm/`, `eval/`, `chat/`, `scaffold/`). Controllers validate with decorated DTOs in `dto/`; services own the logic. |
| `packages/frontend` | React 18 + Vite + Tailwind. Pages in `src/pages/`, reusable pieces in `src/components/`, query/mutation hooks in `src/hooks/`. All server calls go through `src/services/api.ts`. |
| `packages/shared` | TypeScript types only — the wire contract between backend and frontend. If a type crosses the HTTP boundary, it lives here. |

Architecture rules worth knowing (from the project constitution):

- Frontend never calls LLMs directly — always via the backend.
- Minimal dependencies: prefer what is already in package.json.
- UI components are hand-crafted Tailwind (`src/components/ui/`) — no
  component library.
- Long-running work (scaffolding, eval runs) streams progress over SSE using
  `ReplaySubject`-backed registries so late subscribers replay history. Keep
  that property if you touch streaming code.

## Checks

All of these must pass before a PR:

```bash
pnpm lint
pnpm build
pnpm test
```

CI (`.github/workflows/ci.yml`) runs the same three on Node 20.

## Conventions

- TypeScript strict mode everywhere; avoid `any` (lint warns).
- Backend request bodies are validated with `class-validator` DTO classes —
  the global pipe rejects unknown fields, so new fields must be declared.
- Error responses are normalized by the global exception filter to
  `{ statusCode, error, message, path, timestamp }`.
- Commit messages follow conventional-commit style (`feat:`, `fix:`,
  `refactor:`, `chore:` ...).

## Security

See [SECURITY.md](./SECURITY.md) — in particular the local-first threat model
before proposing auth/encryption features, and the dependency-advisory notes
before adding packages.
