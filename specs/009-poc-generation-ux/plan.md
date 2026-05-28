# Implementation Plan: PoC Generation UX

**Branch**: `009-poc-generation-ux` | **Date**: 2026-05-28 | **Spec**: [spec.md](./spec.md)  
**Input**: Feature specification from `/specs/009-poc-generation-ux/spec.md`

## Summary

Replace the current single-shot, blocking scaffold LLM call with a 5-step sequential generation pipeline that streams named progress events to the frontend via SSE. The user sees real-time step transitions and progressive content previews (system prompt → tools → eval cases) as each section is generated, with full failure transparency and retry capability.

## Technical Context

**Language/Version**: TypeScript 5.x (strict mode)  
**Primary Dependencies**: NestJS 10 (SSE via `@Sse()` + RxJS Subject — already in codebase), React 18, TanStack Query 5, Tailwind CSS 3  
**Storage**: SQLite via Prisma 5 — no schema changes required  
**Testing**: N/A (no test suite changes in scope)  
**Target Platform**: Web (desktop + mobile responsive)  
**Project Type**: Web application (monorepo: backend NestJS, frontend React)  
**Performance Goals**: First named step visible within 500ms of form submit; each LLM step completes within 30s; total scaffold within 90s  
**Constraints**: No new npm packages; SSE pattern reuses existing RxJS + NestJS infrastructure  
**Scale/Scope**: Single user, single concurrent scaffold job per browser session

## Constitution Check

| Principle | Status | Notes |
|-----------|--------|-------|
| Speed Over Completeness | ✓ PASS | Scaffold still runs the same generation; we add visibility, not complexity |
| AI-Assisted Not AI-Replaced | ✓ PASS | Generated content is unchanged; user still edits in PoC editor |
| Local-First | ✓ PASS | No new external deps; works with any OpenAI-compatible endpoint |
| Minimal Dependencies | ✓ PASS | Zero new packages — SSE via `@Sse()` + RxJS already in use in eval module |
| UI/UX First | ✓ PASS | Core goal of this feature |
| Immediate Feedback | ✓ PASS | This is the feature — users see named steps immediately |
| Progressive Disclosure | ✓ PASS | Content appears section by section, preview pane shows as sections arrive |

**GATE: PASS** — No constitution violations.

## Project Structure

### Documentation (this feature)

```text
specs/009-poc-generation-ux/
├── plan.md              ← this file
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── api.md
└── tasks.md             (created by /speckit.tasks)
```

### Source Code — files touched

```text
packages/backend/src/
├── scaffold/
│   └── scaffold.service.ts        ← split into 3 sequential LLM calls; emit SSE events via Subject
├── poc/
│   ├── poc.controller.ts          ← POST /scaffold returns { jobId }; add GET /scaffold/stream/:jobId SSE
│   └── poc.service.ts             ← scaffoldWithLlm becomes scaffoldAsync; job registry Map
packages/shared/src/
└── types.ts                       ← new ScaffoldStep type + 4 SSE event interfaces

packages/frontend/src/
├── pages/
│   ├── Home.tsx                   ← after submit → navigate to /scaffold/:jobId
│   └── ScaffoldingPage.tsx        ← NEW: full-screen progress experience
├── components/poc/
│   ├── CreatePocForm.tsx           ← disable submit while job in flight
│   └── ScaffoldProgress.tsx       ← NEW: step list + content preview + retry (used by ScaffoldingPage)
├── App.tsx                        ← add /scaffold/:jobId route
└── services/
    └── api.ts                     ← no changes needed (SSE via native EventSource)
```

**Structure Decision**: Web application (Option 2). The progress experience is **full-screen** — after form submit, the app navigates to `/scaffold/:jobId`. This gives the user's full attention to the 10–30s wait, makes the retry state unambiguous, and avoids the progress UI competing with the POC list. On `done`, the app navigates forward to `/poc/:id`; on retry, it stays on the same route with the description pre-filled and restarts the job.

## Complexity Tracking

No violations.
