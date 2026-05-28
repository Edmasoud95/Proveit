# Tasks: Smart Stub Generation

**Input**: Design documents from `/specs/006-smart-stub-generation/`  
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/api.md ✅, quickstart.md ✅

**Organization**: Tasks grouped by user story for independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: No new project structure needed — this is a frontend-only change (plus a minimal backend DTO extension). Setup is confirming the affected files.

- [x] T001 Extend `GenerateStubsDto` with optional `toolNames` field in `packages/backend/src/eval/dto/generate-stubs.dto.ts`
- [x] T002 Filter tools by `toolNames` in `EvalService.generateStubs` in `packages/backend/src/eval/eval.service.ts` (add one filter line after parsing tools; depends on T001)

**Checkpoint**: Backend now accepts per-tool generation requests — all frontend stories can proceed.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared frontend utility needed by both US1 and US2.

- [x] T003 Add `isEmpty` helper (`!r || r.trim() === ''`) as a module-level function in `packages/frontend/src/components/poc/GenerateStubsButton.tsx` — shared empty-check logic used in both bulk button and count computation

**Checkpoint**: Shared logic is in place — US1 and US2 can now proceed independently.

---

## Phase 3: User Story 1 — Bulk Generate Only Overwrites Empty Stubs (Priority: P1) 🎯 MVP

**Goal**: Bulk "Generate Stubs" button targets only empty tools; disabled when all tools are filled; shows count of affected tools.

**Independent Test**: Create a POC with 2 filled tools + 1 empty. Click bulk button — only the empty tool changes. Repeat with all filled — button is disabled. Repeat with all empty — all 3 change.

### Implementation for User Story 1

- [x] T004 [US1] Update `GenerateStubsButton` props to accept `tools: ToolDefinition[]` and compute `emptyCount` in `packages/frontend/src/components/poc/GenerateStubsButton.tsx`
- [x] T005 [US1] Remove the two-phase `checking` / `confirming` flow from `GenerateStubsButton`; replace `handleClick` with a direct `generateMutation.mutate(false)` call (no pre-flight check needed) in `packages/frontend/src/components/poc/GenerateStubsButton.tsx`
- [x] T006 [US1] Update button label to show count badge: `Generate stubs (N)` and disable when `emptyCount === 0` in `packages/frontend/src/components/poc/GenerateStubsButton.tsx`
- [x] T007 [US1] Pass `tools={poc.tools}` prop to `<GenerateStubsButton>` in `packages/frontend/src/pages/PocEditor.tsx`

**Checkpoint**: Bulk button now shows count, skips filled tools, and is disabled when nothing to generate. Fully testable independently.

---

## Phase 4: User Story 2 — Bulk Generate Button Shows What Will Be Updated (Priority: P1)

**Goal**: Ambient count indicator on the bulk button reflects empty-tool count in real time; button disabled when zero.

**Independent Test**: Without clicking generate, edit a mock response field to non-empty — count badge decreases. Clear it back — count increases. When all fields are filled, button is disabled.

*Note: This story is delivered as part of T004–T006 above (the count badge is part of the same component change). No additional tasks required — US2 acceptance criteria are satisfied when US1 implementation is complete.*

**Checkpoint**: Count badge updates live from `tools` prop — covered by T004 and T006.

---

## Phase 5: User Story 3 — Per-Tool Generate Stub Button (Priority: P2)

**Goal**: Each tool card exposes a single-tool "Generate stub" button with independent loading state. Clicking it always regenerates that tool's stub (overwrites existing).

**Independent Test**: With 3 tools all filled, click one tool's per-tool button — only that tool's mock response changes. Observe spinner on that card only while pending; other cards remain unaffected.

### Implementation for User Story 3

- [x] T008 [US3] Create `ToolStubButton` component in `packages/frontend/src/components/poc/ToolStubButton.tsx` with `pocId`, `tool`, and `onSuccess(toolName, mockResponse)` props; use `useMutation` calling `api.post` with `{ overwrite: true, toolNames: [tool.name] }`; show spinner while pending; toast on error
- [x] T009 [US3] Wire `<ToolStubButton>` into the expanded tool card section of `ToolsEditor`, next to the "Mock response" label in `packages/frontend/src/components/poc/ToolsEditor.tsx`
- [x] T010 [US3] Implement `onSuccess` handler in `ToolsEditor` that updates the matching tool in local `draft` state by tool name, avoiding a full re-fetch in `packages/frontend/src/components/poc/ToolsEditor.tsx`

**Checkpoint**: All user stories complete and independently functional.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [x] T011 [P] Verify TypeScript strict-mode compliance across modified files (`GenerateStubsButton.tsx`, `ToolsEditor.tsx`, `ToolStubButton.tsx`, `eval.service.ts`, `generate-stubs.dto.ts`) — run `pnpm --filter frontend build` and `pnpm --filter backend build`
- [ ] T012 [P] Run acceptance test flow from `quickstart.md` end-to-end: bulk button count badge, bulk generate empty-only, bulk disabled when all filled, per-tool generate single tool only

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Backend DTO)**: No dependencies — start immediately
- **Phase 2 (Shared helper)**: No dependencies — can start immediately in parallel with Phase 1
- **Phase 3 (US1)**: Depends on Phase 1 (T001–T002) + Phase 2 (T003)
- **Phase 4 (US2)**: Covered by Phase 3 — no additional tasks
- **Phase 5 (US3)**: Depends on Phase 1 (T001–T002); independent from Phase 3
- **Phase 6 (Polish)**: Depends on all implementation phases complete

### User Story Dependencies

- **US1 (P1) + US2 (P1)**: Both covered by T004–T007; depend on Phase 1 + Phase 2
- **US3 (P2)**: T008–T010; depends on Phase 1 only (T001–T002); can run in parallel with US1

### Parallel Opportunities

T001–T003 can all run in parallel (different files). Once T001–T003 are done, T004–T007 (US1) and T008–T010 (US3) can run in parallel.

---

## Parallel Example: US1 + US3 in parallel

```
After T001, T002, T003 complete:

Stream A (US1):
  T004 → T005 → T006 → T007

Stream B (US3):
  T008 → T009 → T010
```

---

## Implementation Strategy

### MVP First (User Stories 1 + 2 Only)

1. Complete Phase 1: Backend DTO extension (T001, T002)
2. Complete Phase 2: Shared helper (T003)
3. Complete Phase 3: US1 bulk button (T004–T007)
4. **STOP and VALIDATE**: US1 + US2 acceptance criteria fully met
5. Ship if sufficient

### Incremental Delivery

1. T001–T003 → Backend + shared logic ready
2. T004–T007 → Bulk button upgraded (MVP: US1 + US2)
3. T008–T010 → Per-tool button added (US3)
4. T011–T012 → Verified and polished

---

## Notes

- No new npm packages required — all existing primitives reused
- `ToolStubButton` is a new file to keep `ToolsEditor` readable (single responsibility)
- The `checking` / `confirming` two-phase flow in `GenerateStubsButton` is deleted as part of T005 — it was a workaround that is no longer needed
- `onSuccess` in `ToolStubButton` updates `draft` directly to avoid a full React Query re-fetch for a single field
