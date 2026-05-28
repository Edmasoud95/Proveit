# Implementation Plan: POC Config Version History

**Branch**: `007-poc-config-version-history` | **Date**: 2026-05-28 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/007-poc-config-version-history/spec.md`

## Summary

Add a `PocConfigVersion` table that snapshots `systemPrompt` + `tools` on every mutating save and on initial scaffold. Each `EvalRun` is stamped with the active config version ID at run start. A history panel in `PocEditor` lists versions with change summaries, shows a text diff between any two, and provides a one-click restore that writes a new POC update (which itself triggers another snapshot). The diff view is implemented client-side using the stored snapshot strings — no new diff library needed; a line-by-line LCS diff is trivial to implement for the system prompt, and tools are diffed structurally by name.

## Technical Context

**Language/Version**: TypeScript 5.x (strict mode)
**Primary Dependencies**: NestJS 10, Prisma 5 (backend); React 18, TanStack Query 5, Tailwind CSS 3 (frontend)
**Storage**: SQLite via Prisma 5 — new `PocConfigVersion` table; optional `configVersionId` FK on `EvalRun`; optional `configVersionId` FK on `PocConfig` (current version pointer)
**Testing**: Build verification (`pnpm build`) — no new test files required for this scope
**Target Platform**: Web browser (desktop)
**Project Type**: Web application (backend + frontend)
**Performance Goals**: Version list loads in < 500ms; diff computed client-side instantly from stored strings
**Constraints**: No new npm packages; diff logic hand-crafted (constitution: minimal dependencies)
**Scale/Scope**: 1 new Prisma model, 1 migration, ~4 new backend endpoints, 1 new frontend panel component

## Constitution Check

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Speed Over Completeness | ✅ Pass | Snapshot on save is invisible to the user |
| II. AI-Assisted Not AI-Replaced | ✅ Pass | User retains full control; history is read-only browse + restore |
| III. Local-First | ✅ Pass | No external services |
| IV. Portable Configs | ✅ Pass | Version snapshots are plain strings — exportable |
| V. Minimal Dependencies | ✅ Pass | Diff is hand-rolled, no new packages |
| VI. UI/UX First | ✅ Pass | History panel in editor, 3-click diff access |
| VII. Progressive Disclosure | ✅ Pass | History panel is collapsed/hidden by default |
| VIII. Immediate Feedback | ✅ Pass | Version badge updates after save; restore reflects immediately |
| IX. Opinionated Defaults | ✅ Pass | Versioning is automatic — user never has to opt in |

**No violations. Proceed.**

## Project Structure

### Documentation (this feature)

```text
specs/007-poc-config-version-history/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/
│   └── api.md           # Phase 1 output
└── tasks.md             # Phase 2 output (/speckit.tasks)
```

### Source Code

```text
packages/backend/
├── prisma/
│   ├── schema.prisma                    # modified — new PocConfigVersion model; FK on EvalRun + PocConfig
│   └── migrations/<timestamp>_config_versions/migration.sql   # new
├── src/
│   ├── poc/
│   │   ├── poc.service.ts               # modified — snapshot after update(); restore endpoint
│   │   └── poc.controller.ts            # modified — new config-versions endpoints
│   ├── scaffold/
│   │   └── scaffold.service.ts          # modified — snapshot after pocConfig.create()
│   └── eval/
│       └── eval.service.ts              # modified — stamp configVersionId on EvalRun creation

packages/frontend/
├── src/
│   ├── components/poc/
│   │   └── ConfigVersionHistory.tsx     # new — history panel: list + diff + restore
│   └── pages/
│       ├── PocEditor.tsx                # modified — render ConfigVersionHistory panel
│       └── EvalResults.tsx             # modified — config version badge on runs + mismatch warning

packages/shared/
└── src/types.ts                         # modified — new PocConfigVersion, ConfigVersionSummary types
```

## Complexity Tracking

No constitution violations.
