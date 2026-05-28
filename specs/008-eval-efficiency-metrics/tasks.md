# Tasks: Eval Efficiency Metrics

**Input**: Design documents from `/specs/008-eval-efficiency-metrics/`  
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/api.md ✅, quickstart.md ✅

**Organization**: Tasks grouped by user story for independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to

---

## Phase 1: Setup

**Purpose**: Install the one new dependency before any other work.

- [X] T001 Install `recharts` in frontend: run `pnpm --filter frontend add recharts` from repo root

---

## Phase 2: Foundational (Schema, Types & Token Capture Engine)

**Purpose**: DB columns, shared types, and the token-accumulation + `computeRunMetrics` helper that all user stories depend on. No story work can begin until this phase is complete.

- [X] T002 Add `promptTokens Int?`, `completionTokens Int?`, `totalTokens Int?` to the `EvalResult` model in `packages/backend/prisma/schema.prisma`
- [X] T003 Write migration SQL in `packages/backend/prisma/migrations/<timestamp>_eval_efficiency_tokens/migration.sql` — three `ALTER TABLE "EvalResult" ADD COLUMN` statements for the nullable int columns; run `pnpm --filter backend db:migrate`
- [X] T004 [P] Add `RunMetrics` interface (`accuracy`, `avgLatencyMs`, `avgPromptTokens`, `avgCompletionTokens`, `avgTotalTokens`, `tokensPerSecond`, `efficiencyScore` — all `number | null`); add `promptTokens?`, `completionTokens?`, `totalTokens?` to `EvalResult`; add `metrics?: RunMetrics` to `EvalRun`; add `runAMetrics: RunMetrics` and `runBMetrics: RunMetrics` to `CompareRunsResponse` in `packages/shared/src/types.ts`; rebuild with `pnpm --filter shared build`
- [X] T005 In `packages/backend/src/eval/eval.service.ts` `callAgent()` method — initialize `let promptTokens = 0, completionTokens = 0, totalTokens = 0` before the OpenAI loop; after each `client.chat.completions.create` call, accumulate `response.usage?.prompt_tokens ?? 0`, `completion_tokens ?? 0`, `total_tokens ?? 0`; return `{ promptTokens, completionTokens, totalTokens }` alongside the existing `response` and `history` in the return value
- [X] T006 In `packages/backend/src/eval/eval.service.ts` `executeRun()` — destructure `promptTokens`, `completionTokens`, `totalTokens` from the `callAgent()` return value; add these three fields to the `prisma.evalResult.update` data object (after the existing `latencyMs`, `rawResponse` etc.)
- [X] T007 Add `private async computeRunMetrics(runId: string)` method in `packages/backend/src/eval/eval.service.ts` — query all `EvalResult` rows for the run; compute `accuracy = passedCases / totalCases` (null if 0 cases); `avgLatencyMs` = mean of non-null `latencyMs` values (null if none); `avgPromptTokens/avgCompletionTokens/avgTotalTokens` = means of non-null token values; `tokensPerSecond = avgTotalTokens / (avgLatencyMs / 1000)` (null if either is null/0); `efficiencyScore = accuracy / (avgLatencyMs / 1000)` (null if `avgLatencyMs` is 0 or null); return `RunMetrics`-shaped object with all fields

**Checkpoint**: Token data is written per case result; aggregate helper is ready — all user stories can proceed.

---

## Phase 3: User Story 1 — Efficiency Metrics in Run Comparison (Priority: P1) 🎯 MVP

**Goal**: Comparison view shows 4-metric side-by-side panel for each selected run.

**Independent Test**: Select any two completed runs for comparison → `RunMetricsPanel` renders above the case table for each run showing accuracy, avg latency, token usage, and efficiency score.

- [X] T008 [US1] Extend `compareRuns()` in `packages/backend/src/eval/eval.service.ts` — call `await this.computeRunMetrics(runA.id)` and `await this.computeRunMetrics(runB.id)`; add `runAMetrics` and `runBMetrics` to the returned comparison response object
- [X] T009 [P] [US1] Create `packages/frontend/src/components/eval/RunMetricsPanel.tsx` — accepts `metrics: RunMetrics | null` and `label: string` props; renders a card with 4 rows: Accuracy (`"N/M passed"` or `"—"`), Avg Agent Latency (`"Xms"` or `"—"`), Token Usage (`"P prompt / C completion / T total"` or `"—"`), Efficiency Score (`"X.XX"` formatted to 2dp, or `"—"` if null); style with Tailwind, matching existing card patterns in the app
- [X] T010 [US1] Update the comparison section in `packages/frontend/src/pages/EvalResults.tsx` — destructure `runAMetrics` and `runBMetrics` from the comparison query result; render `<RunMetricsPanel metrics={runAMetrics} label={\`Run #${comparison.runA.runNumber}\`} />` and the equivalent for runB in a 2-column grid above the existing case comparison table

**Checkpoint**: US1 fully testable — comparison shows 4-metric panel for each run.

---

## Phase 4: User Story 2 — Efficiency Scatter Chart (Priority: P1)

**Goal**: `EvalsEfficiencyPanel` scatter chart on Eval Results page showing all runs as bubbles.

**Independent Test**: With 2+ completed runs on a POC, open Eval Results → scatter chart renders with one bubble per run, correct axes, hover tooltip; single-run state shows a note.

- [X] T011 [US2] Extend `listRuns()` in `packages/backend/src/eval/eval.service.ts` — for each run where `status === 'completed'`, call `await this.computeRunMetrics(run.id)` and attach the result as `metrics` on the run object; for non-completed runs set `metrics: null`
- [X] T012 [P] [US2] Create `packages/frontend/src/components/eval/EvalsEfficiencyPanel.tsx` — accepts `runs: EvalRun[]` prop; filters to runs with non-null `metrics.tokensPerSecond` and non-null `metrics.accuracy`; renders a dark-background card with title "Accuracy vs Speed" and subtitle "Up and to the right = better on both dimensions"; uses Recharts `ResponsiveContainer` + `ScatterChart`; `XAxis` dataKey `accuracyPct` label `"Accuracy →"` formatted as `%`; `YAxis` dataKey `tokensPerSecond` label `"Speed (t/s)"` scale `"log"` domain `['auto', 'auto']`; each run is a data point with a distinct color (cycle through a palette); each `Scatter` represents one run with custom `shape` rendering a filled circle (radius 6) in the run's color; `Tooltip` showing model name, accuracy %, tokens/sec, avg latency, efficiency score; toggle button top-right "80% target line" that shows/hides a `ReferenceLine x={80}` dashed vertical line; legend below chart as colored dots + `snapshotModel` name; "Efficiency Ranking" section below the chart listing runs sorted by `efficiencyScore` descending with rank number, model name, accuracy, speed, and score; if < 1 eligible run show placeholder `"Run evals to see efficiency data"`
- [X] T013 [US2] Update `packages/frontend/src/pages/EvalResults.tsx` — add an `"Efficiency"` tab alongside the existing `"Runs"` tab in the page header tab bar; render `<EvalsEfficiencyPanel runs={runs} />` as the content of the Efficiency tab; keep the existing runs list and comparison UI on the `"Runs"` tab

**Checkpoint**: US2 fully testable — scatter chart renders on the Eval Results page.

---

## Phase 5: User Story 3 — Efficiency Badge on Run History Rows (Priority: P2)

**Goal**: Each run row in the history list shows a compact efficiency score and accuracy badge.

**Independent Test**: Eval Results page → each completed run row shows a small `eff: 0.64` badge next to its pass-rate count.

- [X] T014 [US3] Update run history row rendering in `packages/frontend/src/pages/EvalResults.tsx` — for each run, if `run.metrics?.efficiencyScore != null` render a compact badge `eff: {score.toFixed(2)}` (amber or neutral Tailwind pill) alongside the existing pass/fail counts; if `metrics` is null or `efficiencyScore` is null, render nothing (no placeholder)

**Checkpoint**: All user stories complete and independently functional.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [X] T015 [P] Run `pnpm --filter backend build` and `pnpm --filter frontend build` — fix any TypeScript errors introduced by new fields propagating through the codebase
- [ ] T016 [P] Run the quickstart.md acceptance test flow: run evals → token fields visible in result cards; open Eval Results → scatter chart renders; hover bubble → tooltip correct; select two runs for comparison → metrics panel shows; legacy run with no token data → accuracy/latency show, token fields show "—"

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies — start immediately
- **Phase 2 (Foundational)**: Depends on Phase 1 — BLOCKS all user stories; within Phase 2: T002 → T003; T004 parallel with T002-T003; T005 → T006 → T007 (all in same file, sequential)
- **Phase 3 (US1)**: Depends on Phase 2 complete; T008 → T010; T009 parallel with T008
- **Phase 4 (US2)**: Depends on Phase 2 complete; can run in parallel with Phase 3 (different methods/files); T011 → T013; T012 parallel with T011
- **Phase 5 (US3)**: Depends on Phase 4 complete (needs enriched `listRuns` from T011)
- **Phase 6 (Polish)**: Depends on all implementation phases complete

### Within eval.service.ts — Sequential Order (same file)

`T005 → T006 → T007 → T008 → T011`

All five tasks touch `packages/backend/src/eval/eval.service.ts` and must be done in order.

### Parallel Opportunities

- T004 (shared types) runs in parallel with T002-T003 (different package)
- T009 (RunMetricsPanel — new file) runs in parallel with T008 (backend extension)
- T012 (EvalsEfficiencyPanel — new file) runs in parallel with T011 (backend extension)

---

## Parallel Example

```
Stream A (backend eval.service.ts — sequential):
  T005 → T006 → T007 → T008 → T011

Stream B (shared types — parallel with T002-T003):
  T004

Stream C (frontend components — parallel with backend):
  T009 (after T004) → T010
  T012 (after T004) → T013 → T014
```

---

## Implementation Strategy

### MVP First (US1 + US2 — both P1)

1. Phase 1: Install recharts (T001)
2. Phase 2: Schema + types + token engine (T002–T007)
3. Phase 3: Comparison metrics panel (T008–T010)
4. Phase 4: Scatter chart (T011–T013)
5. **STOP and VALIDATE** — efficiency metrics in comparison + scatter chart both functional
6. Ship if sufficient

### Full Delivery

6. Phase 5: Efficiency badges on run rows (T014)
7. Phase 6: Polish builds + acceptance test (T015–T016)

---

## Notes

- `latencyMs` is already agent-only — no changes needed to timing logic
- Token fields are nullable throughout — legacy runs show "—" gracefully; no data migration
- `computeRunMetrics` is called at query time (not stored); this is fine given typical run sizes (10–100 cases)
- `recharts` is the only new package; all other dependencies are existing
- The `EvalsEfficiencyPanel` custom dot shape uses `efficiencyScore` for radius; guard against null/zero before computing radius
