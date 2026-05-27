# Implementation Plan: Versioned Eval Runs with Failure Traces

**Branch**: `003-versioned-eval-runs` | **Date**: 2026-05-26 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/003-versioned-eval-runs/spec.md`

## Summary

Extend the eval system with two orthogonal capabilities: (1) automatic eval suite versioning that stamps every run with the exact test cases it used, groups runs in the UI by version, and enforces that cross-version comparisons are blocked; and (2) full pipeline traces per eval case — the serialized agent conversation history including every tool call (name, arguments, mock response) — with the judge extended to identify which step caused a failure. Runs also capture a point-in-time snapshot of the POC's system prompt, model, and endpoint so past results remain fully reproducible.

## Technical Context

**Language/Version**: TypeScript 5.x (strict mode), Node.js 20  
**Primary Dependencies**: NestJS 10 (backend), React 18 + Vite 5 + Tailwind CSS 3 (frontend), OpenAI Node.js SDK, Prisma 5  
**Storage**: SQLite via Prisma 5 — new `EvalSuiteVersion` model + extensions to `EvalRun` and `EvalResult`  
**Testing**: Jest (backend), Vitest (frontend)  
**Target Platform**: Local desktop (macOS/Linux), single-user  
**Project Type**: Monorepo web application (NestJS API + React SPA)  
**Performance Goals**: Pipeline traces render within 2 seconds; run history grouped by version renders without pagination for typical POC scale (≤50 runs, ≤100 cases)  
**Constraints**: No new npm packages; API keys never stored in snapshots; backward-compatible migration (nullable/defaulted columns only)  
**Scale/Scope**: Single-user local tool; up to ~100 eval cases and ~50 runs per POC

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Speed Over Completeness | ✓ PASS | Snapshots and traces captured automatically; zero extra steps for the user |
| II. AI-Assisted Not AI-Replaced | ✓ PASS | All trace and snapshot data is read-only; user retains full control of POC config |
| III. Local-First | ✓ PASS | All trace data stored in local SQLite; no external services added |
| IV. Portable Configs | ✓ PASS | POC config export is unchanged; snapshots are run metadata, not config mutations |
| V. Minimal Dependencies | ✓ PASS | Zero new npm packages; OpenAI SDK and Prisma already present |
| VI. UI/UX First | ✓ PASS | Version grouping is the default run-history view; traces accessible in one click |
| VII. Progressive Disclosure | ✓ PASS | Trace steps are expandable per case; config snapshot in a collapsible detail section |
| VIII. Immediate Feedback | ✓ PASS | `case-complete` SSE event extended with trace data — traces visible during live run |
| IX. Opinionated Defaults | ✓ PASS | Cross-version comparison blocked by default; no way to accidentally compare wrong runs |

**Post-design re-check**: No violations. Migration uses nullable/defaulted columns so all existing rows are unaffected.

## Project Structure

### Documentation (this feature)

```text
specs/003-versioned-eval-runs/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/
│   └── api.md           # Phase 1 output
└── tasks.md             # Phase 2 output (/speckit.tasks command — not created here)
```

### Source Code (repository root)

```text
packages/backend/prisma/
└── schema.prisma              # New EvalSuiteVersion model; extend EvalRun + EvalResult

packages/backend/src/eval/
├── eval.service.ts            # Version creation on case CRUD; config snapshot on run start;
│                              # callAgent returns full history; store trace on EvalResult
├── eval.controller.ts         # GET :id/evals/versions; GET :id/evals/compare; DELETE :id/evals/runs/:runId
├── judge.service.ts           # Extend JudgeVerdict with failureStep; pass trace to judge prompt
└── dto/
    ├── eval-run.dto.ts        # Extended: runNumber, evalSuiteVersionId/Number, snapshot fields
    ├── eval-result.dto.ts     # Extended: pipelineTrace, errorDetail, failureStep
    └── eval-compare.dto.ts    # New: CompareRunsResponseDto

packages/shared/src/
└── types.ts                   # Extend EvalCaseCompleteEvent, EvalRunDetail;
                               # add PipelineStep, EvalSuiteVersionSummary, RunComparisonCase

packages/frontend/src/
├── pages/
│   └── EvalResults.tsx        # Runs grouped by version; comparison mode; cross-version guard
└── components/
    ├── EvalResultCard.tsx     # Add collapsible pipeline trace section
    └── PipelineTrace.tsx      # New: step-by-step trace renderer (tool call cards)
```

**Structure Decision**: Monorepo web application (existing structure). No new packages. All changes are additive to existing modules — one new Prisma model, extensions to existing services, controllers, and DTOs, plus two updated and one new frontend component.

## Complexity Tracking

No constitution violations. No complexity justification required.
