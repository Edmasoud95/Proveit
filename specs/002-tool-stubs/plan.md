# Implementation Plan: Tool Stubs & Test Data Generation

**Branch**: `002-tool-stubs` | **Date**: 2026-05-26 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/002-tool-stubs/spec.md`

## Summary

Enable users to define static mock responses on each tool in a POC so that tool-calling agents can complete their reasoning loop during eval runs. Optionally generate stubs and tool-focused test data via the connected LLM. The core mechanism is a tool-call loop in the eval runner that intercepts `tool_calls` from the LLM and returns the configured stub instead of executing real code.

## Technical Context

**Language/Version**: TypeScript 5.x (strict mode), Node.js 20  
**Primary Dependencies**: NestJS 10 (backend), React 18 + Vite 5 + Tailwind CSS 3 (frontend), OpenAI Node.js SDK  
**Storage**: SQLite via Prisma 5 — no migration required (tools stored as JSON string in existing `PocConfig.tools` column)  
**Testing**: Vitest (frontend), Jest (backend)  
**Target Platform**: Local desktop (macOS/Linux), same as existing app  
**Project Type**: Monorepo web application (NestJS API + React SPA)  
**Performance Goals**: Stub generation for ≤10 tools in under 30 seconds  
**Constraints**: No new Prisma models; no new npm packages; frontend never calls LLM directly  
**Scale/Scope**: Single-user local tool; 1 POC, up to ~20 tools per POC

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Speed Over Completeness | ✓ PASS | Static stubs only; no dynamic/conditional logic |
| II. AI-Assisted Not AI-Replaced | ✓ PASS | Generate scaffolds stubs, user can edit all values |
| III. Local-First | ✓ PASS | Uses already-configured LLM connection; no external service |
| IV. Portable Configs | ✓ PASS | `mockResponse` is part of the tools JSON in `PocConfig` export |
| V. Minimal Dependencies | ✓ PASS | Zero new packages; OpenAI SDK already present |
| VI. UI/UX First | ✓ PASS | Stub field in existing Tools tab; one-click generation |
| VII. Progressive Disclosure | ✓ PASS | Stub field collapsed by default; expand per tool |
| VIII. Immediate Feedback | ✓ PASS | JSON validation inline; generation shows loading state |
| IX. Opinionated Defaults | ✓ PASS | Empty stub = no-op (backwards compatible) |

**Post-design re-check**: No violations introduced. The `toolFocused` flag on the existing generate-evals endpoint is additive and non-breaking.

## Project Structure

### Documentation (this feature)

```text
specs/002-tool-stubs/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/
│   └── api.md           # Phase 1 output
└── tasks.md             # Phase 2 output (/speckit.tasks command)
```

### Source Code (repository root)

```text
packages/shared/src/
└── types.ts             # Add mockResponse?: string to ToolDefinition

packages/backend/src/
├── eval/
│   ├── eval.service.ts  # Rewrite callAgent; add generateStubs; extend generateCases
│   ├── eval.controller.ts  # Add POST :id/evals/generate route with toolFocused param
│   └── prompts/
│       ├── generate-stubs.prompt.ts    # NEW: prompt for stub generation
│       └── generate-tool-data.prompt.ts # NEW: tool-focused eval case prompt
└── poc/
    └── poc.controller.ts  # Add POST :id/tools/stubs/generate route

packages/frontend/src/
├── pages/
│   └── PocEditor.tsx    # Add stub field + generate button to Tools tab; generate test data to Evals tab
└── components/
    └── poc/
        ├── ToolEditor.tsx         # Extended: mock response field + status indicator
        └── GenerateStubsButton.tsx  # NEW: button + confirmation dialog
```

**Structure Decision**: Single monorepo project (existing Option 1). No new packages. All changes are additive to existing modules — backend services, frontend pages and components.

## Complexity Tracking

No constitution violations. No complexity justification required.
