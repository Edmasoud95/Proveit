# Implementation Plan: Project Scaffolding

**Branch**: `001-project-scaffolding` | **Date**: 2026-05-26 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-project-scaffolding/spec.md`

## Summary

Scaffold the full Proveit platform: a monorepo with a NestJS backend and React/Tailwind frontend that enables developers to describe agent workflows, generate POC configs, connect OpenAI-compatible LLMs, and run LLM-as-judge evals — all local-first with SQLite storage.

## Technical Context

**Language/Version**: TypeScript 5.x (strict mode)
**Primary Dependencies**: NestJS (backend), React 18+ (frontend), Tailwind CSS, OpenAI Node.js SDK, Prisma ORM
**Storage**: SQLite via Prisma
**Testing**: Vitest (unit + integration), Playwright (e2e)
**Target Platform**: macOS/Linux desktop (browser-based UI, local server)
**Project Type**: Web application (monorepo: backend + frontend)
**Performance Goals**: POC scaffolding < 30s, eval results streaming in real-time (< 2s per case display)
**Constraints**: Zero external service dependencies in local-first mode, single-user, < 100MB total footprint
**Scale/Scope**: Single user, ~10 screens, ~50 POC configs reasonable limit for v1

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| Speed over completeness | PASS | Scaffold generates runnable POC immediately; user iterates after |
| AI-assisted not AI-replaced | PASS | Config always visible/editable; UI is primary interaction surface |
| Local-first | PASS | SQLite + local LLM as default; external endpoints optional via API key |
| Portable configs | PASS | POC = JSON file, exportable, no binary dependencies |
| Minimal dependencies | PASS | NestJS + React + Prisma + OpenAI SDK — all load-bearing, no extras |
| UI/UX first | PASS | Hand-crafted Tailwind, progressive disclosure, immediate feedback |
| Progressive disclosure | PASS | Simple scaffold view by default, advanced config on demand |
| Immediate feedback | PASS | Real-time eval streaming, connection health checks, loading states |
| Opinionated defaults | PASS | Default local LLM config, pre-filled eval cases, one-click run |

**Gate result**: PASS — no violations.

## Project Structure

### Documentation (this feature)

```text
specs/001-project-scaffolding/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output (API contracts)
└── tasks.md             # Phase 2 output (/speckit.tasks command)
```

### Source Code (repository root)

```text
packages/
├── backend/
│   ├── src/
│   │   ├── app.module.ts
│   │   ├── main.ts
│   │   ├── poc/                  # POC config CRUD + scaffolding
│   │   │   ├── poc.module.ts
│   │   │   ├── poc.controller.ts
│   │   │   ├── poc.service.ts
│   │   │   └── dto/
│   │   ├── llm/                  # LLM connection management
│   │   │   ├── llm.module.ts
│   │   │   ├── llm.controller.ts
│   │   │   └── llm.service.ts
│   │   ├── eval/                 # Eval execution + judge scoring
│   │   │   ├── eval.module.ts
│   │   │   ├── eval.controller.ts
│   │   │   ├── eval.service.ts
│   │   │   └── judge.service.ts
│   │   ├── scaffold/             # AI-powered POC generation
│   │   │   ├── scaffold.module.ts
│   │   │   └── scaffold.service.ts
│   │   └── prisma/               # Prisma service + module
│   │       ├── prisma.module.ts
│   │       └── prisma.service.ts
│   ├── prisma/
│   │   └── schema.prisma
│   ├── test/
│   ├── package.json
│   └── tsconfig.json
├── frontend/
│   ├── src/
│   │   ├── main.tsx
│   │   ├── App.tsx
│   │   ├── pages/
│   │   │   ├── Home.tsx          # POC list + create new
│   │   │   ├── PocEditor.tsx     # Edit system prompt, tools, evals
│   │   │   ├── LlmConnect.tsx    # Connect/configure LLM endpoint
│   │   │   └── EvalResults.tsx   # Run evals + view scored results
│   │   ├── components/
│   │   │   ├── ui/               # Base UI primitives (buttons, inputs, cards)
│   │   │   ├── poc/              # POC-specific components
│   │   │   ├── eval/             # Eval-specific components
│   │   │   └── llm/              # LLM connection components
│   │   └── services/
│   │       └── api.ts            # Backend API client
│   ├── public/
│   ├── package.json
│   ├── tsconfig.json
│   ├── tailwind.config.ts
│   └── vite.config.ts
└── shared/                       # Shared types between frontend/backend
    ├── src/
    │   └── types.ts
    └── package.json

package.json                      # Root workspace config
tsconfig.base.json                # Shared TS config
```

**Structure Decision**: Web application monorepo with npm/pnpm workspaces. Three packages: `backend`, `frontend`, `shared`. Backend serves API + static frontend build in production. Dev mode runs both with hot reload.

## Complexity Tracking

No violations — table not needed.
