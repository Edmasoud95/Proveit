# Tasks: Versioned Eval Runs with Failure Traces

**Input**: Design documents from `/specs/003-versioned-eval-runs/`
**Prerequisites**: plan.md ✓, spec.md ✓, research.md ✓, data-model.md ✓, contracts/api.md ✓, quickstart.md ✓

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no shared dependencies)
- **[Story]**: Which user story this task belongs to (US1–US5)

---

## Phase 1: Setup (Schema & Migration)

**Purpose**: Apply database schema changes that every subsequent phase depends on.

- [X] T001 Add `EvalSuiteVersion` model and extend `EvalRun` + `EvalResult` with new columns in `packages/backend/prisma/schema.prisma` per data-model.md; add `evalSuiteVersions EvalSuiteVersion[]` relation to `PocConfig`
- [X] T002 Run `pnpm --filter backend db:migrate` to apply the schema changes and verify no existing data is broken

**Checkpoint**: `packages/backend/prisma/schema.prisma` has the new model and columns; `dev.db` has the new tables/columns with all existing rows intact.

---

## Phase 2: Foundational (Shared Types & DTOs)

**Purpose**: Shared TypeScript contracts that all user story phases depend on — must be complete before any implementation task.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [X] T003 [P] Extend `packages/shared/src/types.ts` with: `PipelineStep` union type (user/assistant/tool roles), `EvalSuiteVersionSummary` interface, `RunComparisonCase` interface; extend `EvalCaseCompleteEvent` with `pipelineTrace: PipelineStep[] | null` and `failureStep: string | null`; extend `EvalRunDetail` and `EvalRunSummary` with `runNumber`, `evalSuiteVersionId/Number`, snapshot, and result trace fields per contracts/api.md
- [X] T004 [P] Update `packages/backend/src/eval/dto/eval-run.dto.ts` to add response shape fields: `runNumber`, `evalSuiteVersionId`, `evalSuiteVersionNumber`, `snapshotSystemPrompt`, `snapshotModel`, `snapshotEndpointUrl`
- [X] T005 [P] Update `packages/backend/src/eval/dto/eval-result.dto.ts` to add `pipelineTrace: PipelineStep[] | null`, `errorDetail: string | null`, `failureStep: string | null`

**Checkpoint**: `packages/shared/src/types.ts`, both DTOs compile cleanly with `pnpm --filter backend build` and `pnpm --filter frontend build`.

---

## Phase 3: User Story 1 — Pipeline Traces for Failed Cases (Priority: P1) 🎯 MVP

**Goal**: Every completed eval case records the full step-by-step agent conversation (tool calls, arguments, responses, final output). Failed cases additionally identify which step caused the failure. Traces are visible both during live runs and when reviewing past results.

**Independent Test**: Run evals against a tool-calling POC. After completion, click a failed case — the full pipeline trace renders (system prompt, each tool call with arguments and mock response, final LLM output, failure step badge). Passing cases show traces too (accessible on expand). A case that errored shows an error detail message.

### Implementation for User Story 1

- [X] T006 [P] [US1] Modify `callAgent()` in `packages/backend/src/eval/eval.service.ts` to return `{ response: string, history: OpenAI.ChatCompletionMessageParam[] }` instead of just the string response; the `history` is the full messages array already built during the tool-call loop
- [X] T007 [P] [US1] Update `packages/backend/src/eval/judge.service.ts` to: accept `pipelineTrace: string | null` as an extra parameter; include the serialized tool call steps in the judge system prompt as context; extend the JSON response schema to include `failureStep: 'wrong_tool' | 'wrong_arguments' | 'wrong_final_response' | null`; update `JudgeVerdict` type accordingly
- [X] T008 [US1] Update `executeRun()` in `packages/backend/src/eval/eval.service.ts` to: destructure `{ response, history }` from `callAgent()`; serialize `history` to JSON and pass to `prisma.evalResult.update()` as `pipelineTrace`; pass the serialized trace to `judge()` and store the returned `failureStep`; fix the errored-case catch block to store `err.message` as `errorDetail`
- [X] T009 [US1] Update the `case-complete` SSE event emission in `packages/backend/src/eval/eval.service.ts` to include `pipelineTrace` (parsed from JSON to `PipelineStep[]`) and `failureStep` in the event payload
- [X] T010 [US1] Update `getRun()` in `packages/backend/src/eval/eval.service.ts` to parse `EvalResult.pipelineTrace` JSON string into `PipelineStep[]` and include `errorDetail` and `failureStep` in the result mapping returned to the frontend
- [X] T011 [P] [US1] Create `packages/frontend/src/components/PipelineTrace.tsx` — a new component that renders an ordered list of pipeline steps: user message row, each assistant tool-call turn (showing tool name, arguments as formatted JSON, mock response returned), and the final assistant response row; failed step highlighted visually based on `failureStep` prop
- [X] T012 [US1] Update `packages/frontend/src/components/EvalResultCard.tsx` to: render `<PipelineTrace>` when `pipelineTrace` is non-null (in an expandable section below the existing score/reasoning); show a `failureStep` badge ("wrong tool" / "wrong arguments" / "wrong response") on failed cards when `failureStep` is present; show `errorDetail` message for errored cases
- [X] T013 [US1] Update `EvalResults.tsx` in `packages/frontend/src/pages/EvalResults.tsx`: extend the `LiveResult` interface to include `pipelineTrace?: PipelineStep[] | null` and `failureStep?: string | null`; update the `case-complete` SSE event handler to populate these fields from the event data so live-run cards render traces as they complete

**Checkpoint**: Run evals with a tool-calling POC. All failing cases show the pipeline trace with the tool call sequence. The failure step is identified on judge-failed cases. Errored cases show an error detail. Traces are visible during the live run as each case completes.

---

## Phase 4: User Story 2 — Eval Suite Auto-Versioning (Priority: P2)

**Goal**: Every change to the eval suite (add/edit/delete case) automatically creates a new numbered version (v1, v2, v3...). Every run is tagged with the active version at execution time and records a full config snapshot (system prompt, model, endpoint).

**Independent Test**: Add an eval case — version counter increments in the DB (`EvalSuiteVersion` table). Run evals — the run row has `evalSuiteVersionId`, `runNumber`, and non-empty snapshot fields. Edit the eval case — another version is created. Run evals again — new run has the new version ID. Both runs are accessible via `GET /versions` and `GET /runs`.

### Implementation for User Story 2

- [X] T014 [US2] Add private `createEvalSuiteVersion(pocConfigId: string): Promise<void>` to `packages/backend/src/eval/eval.service.ts`: fetch all current `EvalCase` rows for the POC, query `MAX(versionNumber)` for that POC (default 0), create a new `EvalSuiteVersion` row with `versionNumber + 1` and the serialized cases as `casesSnapshot`
- [X] T015 [US2] Call `createEvalSuiteVersion(pocConfigId)` at the end of `createEvalCase()`, `updateEvalCase()`, and `deleteEvalCase()` in `packages/backend/src/eval/eval.service.ts` (after the prisma write succeeds)
- [X] T016 [US2] Update `startRun()` in `packages/backend/src/eval/eval.service.ts` to: query `MAX(runNumber)` for the POC and assign `runNumber + 1`; look up the latest `EvalSuiteVersion` for the POC and set `evalSuiteVersionId`; load `PocConfig` with its `LlmConnection` and capture `snapshotSystemPrompt`, `snapshotModel`, `snapshotEndpointUrl` (never capture `apiKey`)
- [X] T017 [US2] Add `listVersions(pocId: string)` to `packages/backend/src/eval/eval.service.ts` and `GET /api/pocs/:id/evals/versions` to `packages/backend/src/eval/eval.controller.ts`; response maps `EvalSuiteVersion` rows to `EvalSuiteVersionSummary` including `runCount` (count of runs referencing each version)
- [X] T018 [US2] Update `listRuns()` in `packages/backend/src/eval/eval.service.ts` to include `runNumber`, `evalSuiteVersionId`, `evalSuiteVersionNumber` (via join on `EvalSuiteVersion`), `snapshotModel`, and `snapshotEndpointUrl` in each returned run summary

**Checkpoint**: `GET /api/pocs/:id/evals/versions` returns a versioned history. `GET /api/pocs/:id/evals/runs` returns `runNumber`, `evalSuiteVersionNumber`, and snapshot fields on each run. Legacy runs (pre-feature) show `runNumber: 0`, `evalSuiteVersionId: null`.

---

## Phase 5: User Story 3 — Runs Grouped by Eval Version (Priority: P2)

**Goal**: The eval results page groups past runs under their eval suite version header (v1, v2...). Each run entry shows its version label and run number. The run detail panel shows the POC config snapshot (system prompt, model) that was active at run time.

**Independent Test**: With multiple runs across two eval versions, open the Evals page — runs appear in two labeled groups (e.g. "v1 — 3 runs", "v2 — 2 runs"). Each run row shows "Run #N" and "v2". Clicking a run from v1 shows the system prompt from the v1 snapshot, not the current system prompt.

### Implementation for User Story 3

- [X] T019 [US3] Update the past-runs section in `packages/frontend/src/pages/EvalResults.tsx` to group the runs array by `evalSuiteVersionId` and render a version group header (e.g. "Eval Suite v2 · 3 runs") before each group's run list; legacy runs (`evalSuiteVersionId: null`) are grouped under a "Legacy runs" header at the bottom
- [X] T020 [US3] Update each run row in the past-runs list in `packages/frontend/src/pages/EvalResults.tsx` to show a version label badge (e.g. "v2") and the run number ("Run #5") alongside the existing timestamp and pass-rate display
- [X] T021 [US3] Update the expanded run detail panel in `packages/frontend/src/pages/EvalResults.tsx` to show a collapsible "Config snapshot" section displaying `snapshotModel`, `snapshotEndpointUrl`, and the full `snapshotSystemPrompt` text (sourced from `EvalRunDetail` returned by `GET /runs/:runId`)

**Checkpoint**: Run history renders with version group headers. Each run entry shows version and run number. Expanding a past run shows the config snapshot with system prompt text, even if the current POC config has changed.

---

## Phase 6: User Story 4 — Cross-Version Comparison Blocked (Priority: P3)

**Goal**: The UI allows selecting two runs for comparison only when they share the same eval suite version. Runs from a different version are visually dimmed and cannot be selected. The backend `/compare` endpoint also rejects cross-version requests with a clear error.

**Independent Test**: With runs from v1 and v2, select a v1 run — all v2 run checkboxes become disabled with a tooltip. Attempting to directly call `GET /compare?runA=v1-run&runB=v2-run` returns `400` with `CROSS_VERSION_COMPARISON` error code.

### Implementation for User Story 4

- [X] T022 [P] [US4] Create `packages/backend/src/eval/dto/eval-compare.dto.ts` with `RunComparisonCaseDto`, `CompareRunsResponseDto`, and `CrossVersionErrorDto` as documented in contracts/api.md
- [X] T023 [US4] Implement `compareRuns(pocId, runAId, runBId)` in `packages/backend/src/eval/eval.service.ts`: validate both runs belong to `pocId`; return `400 { error: 'CROSS_VERSION_COMPARISON', message: '...' }` if versions differ; build the per-case diff array using `RunComparisonCase.change` logic from research.md
- [X] T024 [US4] Add `GET /api/pocs/:id/evals/compare` endpoint to `packages/backend/src/eval/eval.controller.ts` that accepts `runA` and `runB` query params and delegates to `compareRuns()`
- [X] T025 [US4] Add comparison selection mode to `packages/frontend/src/pages/EvalResults.tsx`: add a checkbox to each run row; when one run is selected, dim and disable checkboxes on runs from a different `evalSuiteVersionId` (with a tooltip: "Select runs from the same eval version to compare"); show an active "Compare" button only when exactly two runs from the same version are checked

**Checkpoint**: Selecting two same-version runs enables the Compare button. Attempting to select a run from a different version is visually prevented with an explanation. The backend returns a structured 400 for cross-version API calls.

---

## Phase 7: User Story 5 — Side-by-Side Run Comparison (Priority: P3)

**Goal**: Clicking Compare with two same-version runs selected opens a diff view showing each eval case, its pass/fail status in each run, and a change indicator (improved / regressed / both_passed / both_failed). Regressed cases link directly to their pipeline trace in the failing run.

**Independent Test**: Select two runs from the same eval version with different results on at least one case. Click Compare — a diff table appears with every case listed, statuses for each run, and change indicators. Click a regressed case's trace link — the failing run expands with that case's trace in view.

### Implementation for User Story 5

- [X] T026 [US5] Add a comparison result view to `packages/frontend/src/pages/EvalResults.tsx`: after clicking Compare, fetch `GET /compare?runA=&runB=` via React Query; render a table with columns: Case Name / Run A Status / Run B Status / Change (colour-coded: green = improved, red = regressed, grey = unchanged); show run header row with `runNumber` and `evalSuiteVersionNumber` for each run
- [X] T027 [US5] Add drill-through from regressed cases in the comparison view in `packages/frontend/src/pages/EvalResults.tsx`: clicking a regressed case's row selects the failing run (Run B) and scrolls to / expands that case's `EvalResultCard`, showing its pipeline trace; use the existing `selectedRunId` mechanism to avoid a new route

**Checkpoint**: The comparison view renders correctly for two same-version runs. Improved cases are shown in green, regressed in red. Clicking a regressed row jumps to the trace in the failing run.

---

## Phase 8: Polish & Cross-Cutting Concerns

- [X] T028 [P] Add `deleteRun(pocId, runId)` to `packages/backend/src/eval/eval.service.ts` and `DELETE /api/pocs/:id/evals/runs/:runId` to `packages/backend/src/eval/eval.controller.ts`; delete cascades to `EvalResult` rows via Prisma `onDelete: Cascade`
- [X] T029 [P] Handle legacy runs (pre-feature, `evalSuiteVersionId: null`, `runNumber: 0`) gracefully in `packages/frontend/src/pages/EvalResults.tsx`: group under a "Legacy runs" collapsible section; show "v?" badge for version, omit run number; show "—" for snapshot fields in the detail panel
- [ ] T030 Validate the complete feature end-to-end following `specs/003-versioned-eval-runs/quickstart.md`: create a POC, run evals, check traces, inspect version history, and run a comparison between two same-version runs

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies — start immediately
- **Phase 2 (Foundational)**: Requires Phase 1 complete — **BLOCKS all user story phases**
- **Phase 3 (US1)**: Requires Phase 2 — no dependency on other user stories
- **Phase 4 (US2)**: Requires Phase 2 — no dependency on US1
- **Phase 5 (US3)**: Requires Phase 4 (needs version data from backend)
- **Phase 6 (US4)**: Requires Phase 4 (needs version IDs on runs) + Phase 5 (needs version groups in UI)
- **Phase 7 (US5)**: Requires Phase 6 (needs compare endpoint and selection mode)
- **Phase 8 (Polish)**: Requires all desired stories complete

### User Story Dependencies

| Story | Depends On | Can Start After |
|-------|-----------|-----------------|
| US1 (Pipeline Traces) | Phase 2 only | Phase 2 complete |
| US2 (Auto-Versioning) | Phase 2 only | Phase 2 complete; parallel with US1 |
| US3 (Grouped Runs) | US2 backend complete | T018 complete |
| US4 (Cross-Version Block) | US2 + US3 UI | Phase 5 complete |
| US5 (Side-by-Side) | US4 (compare endpoint + selection) | Phase 6 complete |

### Within Each User Story

- Backend service tasks before controller/endpoint tasks
- New components (T011) before consuming components (T012)
- `callAgent()` return shape change (T006) before `executeRun()` update (T008)
- `createEvalSuiteVersion()` helper (T014) before hooking it in (T015)
- Compare service (T023) before compare endpoint (T024) before compare UI (T025, T026)

---

## Parallel Opportunities

### Phase 2 — all three tasks in parallel

```
T003: Update packages/shared/src/types.ts
T004: Update packages/backend/src/eval/dto/eval-run.dto.ts
T005: Update packages/backend/src/eval/dto/eval-result.dto.ts
```

### Phase 3 — initial backend + frontend tasks in parallel

```
T006: Modify callAgent() in eval.service.ts       (different function from T007)
T007: Extend judge.service.ts                      (different file)
T011: Create PipelineTrace.tsx                     (new file, different from T012)
```

Then sequentially: T008 → T009 → T010 → T012 → T013

### Phase 4 — versioning helper then parallel endpoint + run list

```
T014: createEvalSuiteVersion() helper              (must come first)
T015: Hook into case CRUD                          (depends T014)
T016: Update startRun()                            (depends T014 for version lookup)
T017: listVersions() + GET /versions endpoint      (can follow T014)
T018: Extend listRuns()                            (can follow T016)
```

### Phase 6 — DTO and service in parallel before endpoint

```
T022: Create eval-compare.dto.ts                   (new file)
T023: compareRuns() service                        (depends T022)
T024: GET /compare endpoint                        (depends T023)
T025: Frontend comparison selection mode           (depends T024)
```

---

## Implementation Strategy

### MVP First (User Story 1 — Pipeline Traces Only)

1. Complete Phase 1: Schema migration
2. Complete Phase 2: Shared types and DTOs
3. Complete Phase 3: US1 (pipeline traces + failure step)
4. **STOP and VALIDATE**: Run evals, inspect failure traces — core debugging loop is working
5. Ship or demo

### Incremental Delivery

1. Phase 1 + 2 → Schema and types ready
2. Phase 3 (US1) → Pipeline traces live → **Demo: debugging with trace**
3. Phase 4 (US2) → Versioning live → **Demo: version history in DB**
4. Phase 5 (US3) → Grouped runs live → **Demo: version grouping in UI**
5. Phase 6 (US4) → Cross-version guard → **Demo: safe comparison workflow**
6. Phase 7 (US5) → Side-by-side diff → **Demo: full comparison flow**
7. Phase 8 → Polish → **Ship**

---

## Notes

- No tests generated (not requested in spec)
- [P] tasks operate on different files and have no cross-task dependencies at the point they run
- Legacy run handling (T029) is cosmetic and can be deferred without breaking any user story
- T030 (end-to-end validation) should be run manually following quickstart.md before marking complete
- All Prisma query patterns follow existing codebase conventions (findFirst/findMany, no raw SQL)
