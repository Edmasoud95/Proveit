# Implementation Plan: Smart Stub Generation

**Branch**: `006-smart-stub-generation` | **Date**: 2026-05-28 | **Spec**: [spec.md](spec.md)  
**Input**: Feature specification from `/specs/006-smart-stub-generation/spec.md`

## Summary

Improve the "Generate Stubs" bulk button so it only targets empty tools and shows a count badge so users know what will be affected — and add a per-tool "Generate Stub" button on each tool card that always regenerates that single tool regardless of existing content. The backend already filters by `overwrite` flag; the backend already handles bulk stub generation for a list of tools; all required changes are frontend-only.

## Technical Context

**Language/Version**: TypeScript 5.x (strict mode)  
**Primary Dependencies**: React 18, TanStack Query 5, Tailwind CSS 3 (frontend); NestJS 10, Prisma 5 (backend — no changes required)  
**Storage**: N/A (no schema changes)  
**Testing**: Vitest (frontend unit); no new test files required for this scope  
**Target Platform**: Web browser (desktop)  
**Project Type**: Web application (frontend-only change)  
**Performance Goals**: UI reflects empty-tool count synchronously from local state; per-tool generation shows loading state immediately  
**Constraints**: No new npm packages; reuse existing `api.post`, `Button`, `Sparkle`, `useToast` primitives  
**Scale/Scope**: 2 frontend components modified/created (`GenerateStubsButton`, `ToolsEditor`); 1 new helper component (`ToolStubButton`)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Speed Over Completeness | ✅ Pass | Small, focused change — no new layers |
| II. AI-Assisted Not AI-Replaced | ✅ Pass | User still sees and edits all stubs |
| III. Local-First | ✅ Pass | No change to LLM routing |
| IV. Portable Configs | ✅ Pass | No data model change |
| V. Minimal Dependencies | ✅ Pass | Zero new packages |
| VI. UI/UX First | ✅ Pass | This feature IS a UX improvement |
| VII. Progressive Disclosure | ✅ Pass | Count badge is ambient info, not a modal |
| VIII. Immediate Feedback | ✅ Pass | Per-tool loading state required by FR-006 |
| IX. Opinionated Defaults | ✅ Pass | Bulk button defaults to empty-only |

**No violations. Proceed.**

## Project Structure

### Documentation (this feature)

```text
specs/006-smart-stub-generation/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   └── api.md
└── tasks.md             # Phase 2 output (/speckit.tasks)
```

### Source Code (repository root)

```text
packages/frontend/src/components/poc/
├── GenerateStubsButton.tsx   # modified — count badge, disable when 0 empty
├── ToolsEditor.tsx           # modified — per-tool stub button on each card
└── ToolStubButton.tsx        # new — per-tool generate stub button component

packages/frontend/src/pages/
└── PocEditor.tsx             # modified — pass tools to GenerateStubsButton for count
```

**Structure Decision**: Frontend-only, single package. Reuses existing backend endpoint `/api/pocs/:pocId/tools/stubs/generate` with `{ overwrite: true }` for per-tool calls (single-tool payload). `ToolStubButton` is extracted as its own component to keep `ToolsEditor` readable.

## Complexity Tracking

No constitution violations.
