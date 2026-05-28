# Tasks: POC Config Version History

**Input**: Design documents from `/specs/007-poc-config-version-history/`  
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/api.md ✅, quickstart.md ✅

**Organization**: Tasks grouped by user story for independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to

---

## Phase 1: Setup (Schema & Migration)

**Purpose**: Prisma schema changes and migration that ALL user stories depend on. No story work can begin until this phase is complete.

- [x] T001 Add `PocConfigVersion` model to `packages/backend/prisma/schema.prisma` with fields: `id`, `pocConfigId` (FK cascade), `versionNumber`, `systemPrompt`, `tools`, `changeLabel`, `contentHash`, `createdAt`; add `@@index([pocConfigId])` and `@@unique([pocConfigId, versionNumber])`
- [x] T002 Add `currentConfigVersionId String?` (FK → PocConfigVersion, setNull on delete) to `PocConfig` model in `packages/backend/prisma/schema.prisma`
- [x] T003 Add `configVersionId String?` (FK → PocConfigVersion, setNull on delete) and `snapshotConfigVersionNumber Int?` to `EvalRun` model in `packages/backend/prisma/schema.prisma`
- [x] T004 Write migration SQL in `packages/backend/prisma/migrations/<timestamp>_poc_config_versions/migration.sql` — creates `PocConfigVersion` table, adds nullable columns to `PocConfig` and `EvalRun`; run `pnpm --filter backend db:migrate`
- [x] T005 Add `PocConfigVersion`, `PocConfigVersionSummary` interfaces and add `configVersionId?`, `snapshotConfigVersionNumber?` to `EvalRun` interface in `packages/shared/src/types.ts`; rebuild shared with `pnpm --filter shared build`

**Checkpoint**: Schema in place — all user stories can now proceed.

---

## Phase 2: Foundational (Snapshot Engine)

**Purpose**: The `createConfigVersion` helper that all stories depend on. Must exist before any user story work.

- [x] T006 Implement `createConfigVersion(pocId, systemPrompt, tools, label?)` private method in `packages/backend/src/poc/poc.service.ts` — computes `contentHash` (SHA-256 of concatenated strings), checks latest version's hash for deduplication, increments `versionNumber`, creates `PocConfigVersion` record, updates `PocConfig.currentConfigVersionId`
- [x] T007 Call `createConfigVersion` in `packages/backend/src/scaffold/scaffold.service.ts` after `prisma.pocConfig.create` resolves — label "Initial version"
- [x] T008 Call `createConfigVersion` in `packages/backend/src/poc/poc.service.ts` `update()` method after `prisma.pocConfig.update` resolves — derive label from which fields changed: "System prompt changed", "Tools changed", or "System prompt and tools changed"; only call when `dto.systemPrompt !== undefined || dto.tools !== undefined`

**Checkpoint**: Every POC creation and every system prompt/tools save now silently creates a version snapshot.

---

## Phase 3: User Story 1 — Automatic Config Snapshots on Save (Priority: P1) 🎯 MVP

**Goal**: Snapshots are created automatically on every relevant save. User can see their current version number.

**Independent Test**: Create a POC → history list shows v1 "Initial version". Edit system prompt, save → v2 "System prompt changed". Save again with no change → still v2. Edit tools, save → v3 "Tools changed".

- [x] T009 [US1] Add `GET /pocs/:pocId/config-versions` endpoint to `packages/backend/src/poc/poc.controller.ts` returning `PocConfigVersionSummary[]` (id, versionNumber, changeLabel, createdAt) sorted descending by versionNumber
- [x] T010 [US1] Implement `listConfigVersions(pocId)` in `packages/backend/src/poc/poc.service.ts` — query `PocConfigVersion` ordered by `versionNumber desc`, map to summary shape (omit systemPrompt and tools content)
- [x] T011 [US1] Add current version badge to `packages/frontend/src/pages/PocEditor.tsx` — query `GET /pocs/:id/config-versions` with React Query key `['config-versions', id]`, display `v{versions[0]?.versionNumber}` badge in the editor header next to the POC name; invalidate query after `updateMutation` success

**Checkpoint**: US1 fully testable — version badge visible, snapshots confirmed in list after each save.

---

## Phase 4: User Story 2 — Browse and Diff Config History (Priority: P1)

**Goal**: History panel shows all versions; selecting two renders a diff of system prompt (line-by-line) and tools (structural by name).

**Independent Test**: Open history panel → version list in reverse order with labels. Select v1 and v3 → diff shows prompt changes highlighted red/green, tools show added/removed/modified entries.

- [x] T012 [US2] Add `GET /pocs/:pocId/config-versions/:versionId` endpoint to `packages/backend/src/poc/poc.controller.ts` returning full `PocConfigVersion` (including `systemPrompt` and `tools` content)
- [x] T013 [US2] Implement `getConfigVersion(pocId, versionId)` in `packages/backend/src/poc/poc.service.ts` — find by id scoped to pocId, throw 404 if not found
- [x] T014 [P] [US2] Implement `lineDiff(a, b)` and `toolsDiff(oldTools, newTools)` utility functions in `packages/frontend/src/components/poc/configVersionDiff.ts` — `lineDiff` returns `{ type: 'added'|'removed'|'unchanged', text: string }[]`; `toolsDiff` returns `{ added, removed, modified }` by matching on tool `name`
- [x] T015 [US2] Create `packages/frontend/src/components/poc/ConfigVersionHistory.tsx` — collapsible panel rendering: (a) version list with vN badge, changeLabel, createdAt, and "Select for diff" / "Restore" buttons; (b) diff view shown when two versions are selected: fetches full content of each via `GET /pocs/:id/config-versions/:versionId`, runs `lineDiff` + `toolsDiff` client-side, renders added lines in green, removed in red, unchanged in neutral, tools diff as labelled add/remove/modify cards
- [x] T016 [US2] Render `<ConfigVersionHistory pocId={poc.id} onRestore={() => queryClient.invalidateQueries(['poc', id])} />` at the bottom of `packages/frontend/src/pages/PocEditor.tsx` (collapsible, outside the tab system); pass query invalidation callback for after restore

**Checkpoint**: US2 fully testable — history panel opens, version list displays, diff renders correctly for any two selected versions.

---

## Phase 5: User Story 3 — Revert to a Previous Config Version (Priority: P2)

**Goal**: "Restore" button on any version updates the POC to that version's content and records a new "Restored from vN" version entry.

**Independent Test**: Click Restore on v1, confirm → POC editor shows v1 content; history shows new vN "Restored from v1"; original v1 still present; accidentally restoring wrong version is recoverable.

- [x] T017 [US3] Add `POST /pocs/:pocId/config-versions/:versionId/restore` endpoint to `packages/backend/src/poc/poc.controller.ts` — reads the version's `systemPrompt` and `tools`, calls `pocService.update(pocId, { systemPrompt, tools })` with a restore label passed as context, returns updated POC
- [x] T018 [US3] Extend `packages/backend/src/poc/poc.service.ts` to support an optional `restoreLabel` parameter in the `createConfigVersion` call from within the restore path so the snapshot gets label "Restored from vN" instead of the generic change summary
- [x] T019 [US3] Wire the Restore button in `ConfigVersionHistory.tsx` (`packages/frontend/src/components/poc/ConfigVersionHistory.tsx`) — show confirmation prompt, call `POST /pocs/:id/config-versions/:versionId/restore` via mutation, on success invalidate `['poc', id]` and `['config-versions', id]` queries, close diff view

**Checkpoint**: US3 fully testable — restore updates POC content, history records the restore entry, original versions preserved.

---

## Phase 6: User Story 4 — Eval Runs Linked to Config Version (Priority: P2)

**Goal**: Every new eval run is stamped with the active config version. EvalResults comparison warns when versions differ.

**Independent Test**: Run evals at v1 → run tagged v1. Save prompt change (v2) → run evals again → run tagged v2. Compare the two runs → warning appears. Compare two v2 runs → no warning.

- [x] T020 [US4] In `packages/backend/src/eval/eval.service.ts` `startRun()`: after fetching the POC, query `prisma.pocConfigVersion.findFirst({ where: { pocConfigId }, orderBy: { versionNumber: 'desc' } })` and write `configVersionId` and `snapshotConfigVersionNumber` to the `prisma.evalRun.create` data object
- [x] T021 [P] [US4] In `packages/frontend/src/pages/EvalResults.tsx`: add `v{run.snapshotConfigVersionNumber ?? '?'}` config version badge to each run entry (alongside the existing eval suite version badge); handle null/undefined gracefully as "v?"
- [x] T022 [US4] In `packages/frontend/src/pages/EvalResults.tsx`: in the run comparison section, add a config version mismatch warning block — shown when `runA.snapshotConfigVersionNumber !== runB.snapshotConfigVersionNumber` (and both are non-null); style to match the existing eval suite version mismatch warning pattern

**Checkpoint**: All user stories complete and independently functional.

---

## Phase 7: Polish & Cross-Cutting Concerns

- [x] T023 [P] Run `pnpm --filter backend build` and `pnpm --filter frontend build` — fix any TypeScript errors introduced by schema type changes propagating through the codebase
- [x] T024 [P] Run the full acceptance test flow from `quickstart.md`: create POC → v1 snapshot; save prompt → v2; no-change save → still v2; diff v1 vs v2; restore v1 → v3 "Restored from v1"; run evals → tagged v3; compare v1 and v3 run → config version warning shown

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Schema)**: No dependencies — start immediately
- **Phase 2 (Snapshot engine)**: Depends on Phase 1 complete — BLOCKS all user stories
- **Phase 3 (US1)**: Depends on Phase 1 + Phase 2
- **Phase 4 (US2)**: Depends on Phase 1 + Phase 2; can run in parallel with Phase 3 (different files)
- **Phase 5 (US3)**: Depends on Phase 2 (restore uses the same update path); independent from Phase 3/4 UI
- **Phase 6 (US4)**: Depends on Phase 1 (schema on EvalRun) and Phase 2; independent from Phase 3/4/5
- **Phase 7 (Polish)**: Depends on all implementation phases complete

### Parallel Opportunities

Within Phase 1: T001, T002, T003 all touch `schema.prisma` — must be sequential. T004 (migration) depends on T001–T003. T005 (shared types) can run in parallel with T001–T004.

Once Phase 2 is complete:
- Phase 3 (T009–T011), Phase 4 (T012–T016), Phase 5 (T017–T019), and Phase 6 (T020–T022) can all be worked in parallel by different developers.

Within Phase 4: T014 (diff utility, new file) can run in parallel with T012–T013 (backend endpoints).

---

## Parallel Example: US2 + US3 + US4 in parallel (after Phase 2)

```
Stream A (US2 — History + Diff):
  T012 → T013 → T014 (parallel with T012) → T015 → T016

Stream B (US3 — Restore):
  T017 → T018 → T019

Stream C (US4 — Eval Linkage):
  T020 → T021 → T022
```

---

## Implementation Strategy

### MVP First (US1 + US2 only — P1 stories)

1. Phase 1: Schema + migration (T001–T005)
2. Phase 2: Snapshot engine (T006–T008)
3. Phase 3: US1 badge + list endpoint (T009–T011)
4. Phase 4: US2 history panel + diff (T012–T016)
5. **STOP and VALIDATE** — version history and diff are fully functional
6. Ship if sufficient

### Full Delivery

6. Phase 5: US3 Restore (T017–T019)
7. Phase 6: US4 Eval linkage (T020–T022)
8. Phase 7: Polish (T023–T024)

---

## Notes

- `createConfigVersion` is a private method on `PocService` — the only callers are `update()` (same file) and `ScaffoldService` (injected dependency)
- `ScaffoldModule` must import `PocModule` (or `PocService` must be exported) for `ScaffoldService` to call `createConfigVersion` — verify module imports before T007
- Diff is computed entirely client-side; no diff endpoint needed
- The `contentHash` deduplication check in T006 must compare against `findFirst({ orderBy: { versionNumber: 'desc' } })` — only skip if the LATEST version has the same hash (not any historical version)
- Restore (T017) calls the existing `update()` path which already triggers snapshot creation; the restore label must be injected at the `createConfigVersion` call level
