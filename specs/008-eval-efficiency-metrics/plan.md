# Implementation Plan: Eval Efficiency Metrics

**Branch**: `008-eval-efficiency-metrics` | **Date**: 2026-05-28 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/008-eval-efficiency-metrics/spec.md`

## Summary

Add agent token usage tracking (prompt/completion/total) to every eval case result and surface four aggregate efficiency metrics — Accuracy, Avg Agent Latency, Token Usage, and Efficiency Score — in the eval comparison view and a new `EvalsEfficiencyPanel` scatter chart (x=latency, y=accuracy, bubble size=efficiency score) using Recharts. `latencyMs` is already agent-only and requires no changes; only token accumulation across the agent loop and three new nullable DB columns are needed on the backend. The scatter chart and comparison metrics panel are pure frontend additions on top of enriched `listRuns` and `compareRuns` API responses.

## Technical Context

**Language/Version**: TypeScript 5.x (strict mode)
**Primary Dependencies**: NestJS 10, Prisma 5 (backend); React 18, TanStack Query 5, Tailwind CSS 3, **Recharts** (frontend — user-specified)
**Storage**: SQLite via Prisma 5 — 3 nullable columns added to `EvalResult` (`promptTokens`, `completionTokens`, `totalTokens`); no new tables
**Testing**: Build verification (`pnpm build`) — no new test files required for this scope
**Target Platform**: Web browser (desktop)
**Performance Goals**: Scatter chart renders in < 500ms; list runs response with metrics in < 300ms
**Constraints**: `recharts` is the only new npm package allowed (explicit user override of Principle V); no other new dependencies
**Scale/Scope**: 3 new DB columns, 1 new helper method, 2 extended API responses, 2 new frontend components

## Constitution Check

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Speed Over Completeness | ✅ Pass | Token capture is invisible; metrics appear after runs already complete |
| II. AI-Assisted Not AI-Replaced | ✅ Pass | Metrics are informational; user decides which model to use |
| III. Local-First | ✅ Pass | No external services; local LLMs return `usage` just like cloud ones |
| IV. Portable Configs | ✅ Pass | Token data is on EvalResult, not PocConfig |
| V. Minimal Dependencies | ⚠️ Override | `recharts` added — explicitly requested by user for the scatter chart; hand-rolled SVG alternative would be disproportionately complex |
| VI. UI/UX First | ✅ Pass | Scatter chart is the key visual; metrics panel requires zero explanation |
| VII. Progressive Disclosure | ✅ Pass | Efficiency panel is above the run list; comparison metrics appear inline |
| VIII. Immediate Feedback | ✅ Pass | Token data written per-case during SSE stream; chart updates as runs complete |
| IX. Opinionated Defaults | ✅ Pass | Efficiency score is auto-computed; users don't configure anything |

**One override. Justified. Proceed.**

## Project Structure

### Documentation (this feature)

```text
specs/008-eval-efficiency-metrics/
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
│   ├── schema.prisma                    # modified — 3 new nullable columns on EvalResult
│   └── migrations/<timestamp>_eval_efficiency_tokens/migration.sql   # new
├── src/
│   └── eval/
│       └── eval.service.ts              # modified — token accumulation, computeRunMetrics helper,
│                                        #   enriched listRuns + compareRuns responses

packages/frontend/
├── src/
│   └── components/eval/
│       ├── EvalsEfficiencyPanel.tsx     # new — scatter chart (Recharts)
│       └── RunMetricsPanel.tsx          # new — 4-metric card (reused in comparison)
│   └── pages/
│       └── EvalResults.tsx             # modified — render EvalsEfficiencyPanel + RunMetricsPanel

packages/shared/
└── src/types.ts                         # modified — RunMetrics interface, EvalResult token fields,
                                         #   EvalRun.metrics?, CompareRunsResponse metrics fields
```

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| `recharts` dependency (Principle V) | Scatter chart with hover tooltips, responsive container, and bubble sizing requires significant SVG/Canvas boilerplate otherwise | Hand-rolled scatter chart would be 200+ lines of coordinate math, event handling, and resize logic — disproportionate to feature value |
