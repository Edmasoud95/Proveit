# Tasks: Multi-Provider LLM with Per-Task Model Routing

**Input**: Design documents from `/specs/004-multi-provider-llm/`  
**Branch**: `004-multi-provider-llm`

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to
- No tests requested — implementation tasks only

---

## Phase 1: Setup

**Purpose**: Confirm environment is ready before schema changes

- [X] T001 Confirm branch is `004-multi-provider-llm` (`git branch`) and run `pnpm install` from repo root — verify no new packages are added to any `package.json`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Schema migration and shared types — MUST complete before any user story work

**⚠️ CRITICAL**: All user story phases depend on T002 completing first

- [X] T002 Update `packages/backend/prisma/schema.prisma` — (1) remove `@unique` from `LlmConnection.pocConfigId`; (2) add `name String @default("Default")`, `isDefault Boolean @default(false)`, `availableModels String?` to `LlmConnection`; (3) add `@@index([pocConfigId])` and back-relation `taskModelOverrides TaskModelOverride[]` to `LlmConnection`; (4) add new `TaskModelOverride` model with `id String @id @default(uuid())`, `pocConfigId String`, `taskType String`, `connectionId String`, `model String`, FK relations to `PocConfig` and `LlmConnection` both `onDelete: Cascade`, and `@@unique([pocConfigId, taskType])`; (5) update `PocConfig`: change `llmConnection LlmConnection?` → `llmConnections LlmConnection[]`, add `taskModelOverrides TaskModelOverride[]`

- [X] T003 [P] Run Prisma migration — `cd packages/backend && npx prisma migrate dev --create-only --name multi_provider_llm`; open the generated migration file at `packages/backend/prisma/migrations/[timestamp]_multi_provider_llm/migration.sql` and append `UPDATE "LlmConnection" SET "isDefault" = 1, "name" = 'Default';` before the end; then run `npx prisma migrate dev` to apply; verify with `npx prisma studio` that all existing rows have `isDefault=1` and `name='Default'`

- [X] T004 [P] Update `packages/shared/src/types.ts` — add `export interface LlmProvider { id: string; pocConfigId: string; name: string; isDefault: boolean; endpointUrl: string; model: string; isActive: boolean; lastCheckedAt?: string; availableModels?: string[]; }`; add `export type TaskType = 'agent' | 'judge' | 'eval-gen' | 'stub-gen'`; add `export interface TaskModelOverride { taskType: TaskType; connectionId: string; providerName: string; model: string; }`; add `export interface LlmRoutingConfig { providers: LlmProvider[]; overrides: TaskModelOverride[]; }`; keep existing `LlmConnection` interface unchanged

**Checkpoint**: Schema migrated, existing rows promoted to default providers, shared types updated

---

## Phase 3: User Story 1 - Multiple Provider Connections (Priority: P1) 🎯 MVP

**Goal**: Users can add, test, rename, delete, and designate default LLM providers for a POC

**Independent Test**: Configure two providers on a POC's LLM Settings page. Verify both appear in the provider list with test results. Designate one as default. The old single-provider workflow still works unchanged.

- [X] T005 [P] [US1] Create three DTO files in `packages/backend/src/llm/dto/`: (1) `create-provider.dto.ts` with `name: string`, `endpointUrl: string`, `apiKey?: string`, `model: string`; (2) `update-provider.dto.ts` with all four fields optional (`name?: string`, etc.); (3) `set-routing.dto.ts` with `connectionId: string`, `model: string` — use plain classes without decorators, matching the style of existing `UpsertLlmDto` in `llm.controller.ts`

- [X] T006 [US1] Rewrite `packages/backend/src/llm/llm.service.ts` — (a) **New provider CRUD**: add `listProviders(pocId)` → finds all LlmConnections for pocId ordered by createdAt, strips `apiKey`, returns array; add `createProvider(pocId, dto: CreateProviderDto)` → creates new LlmConnection, sets `isDefault=true` if it's the first connection for this pocId; add `updateProvider(pocId, id, dto: UpdateProviderDto)` → verifies connection belongs to pocId (throw NotFoundException), then updates non-null fields; add `deleteProvider(pocId, id)` → verifies connection belongs to pocId; if `isDefault=true` AND other connections exist throw `BadRequestException({ error: 'CANNOT_DELETE_DEFAULT', message: 'Designate another provider as default before deleting this one.' })`; otherwise delete; add `testProvider(pocId, id)` → finds connection, calls `getClient()`, lists models, updates `isActive`, `lastCheckedAt`, `availableModels` (JSON.stringify), returns `LlmConnectionTestResult`; add `setDefault(pocId, id)` → `prisma.$transaction` that sets `isDefault=false` on all connections for pocId then sets `isDefault=true` on the target; (b) **Compat shims**: rename old `upsert()` body to find-or-upsert the `isDefault=true` connection (keeping method signature identical); rename old `test()` to test the `isDefault=true` connection; rename old `getConnection()` to return the `isDefault=true` connection in LlmConnection shape; `getModels(pocId)` queries the `isDefault=true` connection; (c) keep `getClient()` and `fetchModelsFromUrl()` completely unchanged

- [X] T007 [US1] Rewrite `packages/backend/src/llm/llm.controller.ts` — in `LlmController` add: `@Get('providers')` → `listProviders(pocId)`; `@Post('providers')` with `@Body() dto: CreateProviderDto` → `createProvider(pocId, dto)` returning 201; `@Patch('providers/:id')` with `@Body() dto: UpdateProviderDto` → `updateProvider(pocId, id, dto)`; `@Delete('providers/:id')` with `@HttpCode(204)` → `deleteProvider(pocId, id)`; `@Post('providers/:id/test')` → `testProvider(pocId, id)`; `@Post('providers/:id/default')` → `setDefault(pocId, id)`; add `HttpCode`, `Patch` to `@nestjs/common` imports; import the three new DTOs; keep all existing endpoints (`@Put()`, `@Post('test')`, `@Get('models')`, `@Post('models')`, `@Get()`) completely unchanged

- [X] T008 [P] [US1] Rewrite `packages/frontend/src/pages/LlmConnect.tsx` — replace single-connection form with: (a) **Provider list** loaded via `useQuery(['providers', pocId], () => GET /pocs/:id/llm/providers)` — each row: colored status dot (green=isActive, red=inactive, grey=untested), provider name, endpoint URL, model, last tested time; empty state: "No providers configured. Add one to get started."; (b) **"Add provider" button** opens an inline form with Name/Endpoint URL/API Key/Model text fields + "Save" and "Cancel" — on save call `POST /pocs/:id/llm/providers`, invalidate providers query; (c) **"Test" button** per row → `POST /pocs/:id/llm/providers/:id/test`, show connected/failed status inline; (d) **Star icon** per row → `POST /pocs/:id/llm/providers/:id/default`; bold/filled star for `isDefault=true`; (e) **Delete button** per row with a confirmation dialog ("Delete {name}?") → `DELETE /pocs/:id/llm/providers/:id`; on `CANNOT_DELETE_DEFAULT` error show toast "Set another provider as default first"; (f) **Edit**: clicking provider name opens add-form pre-populated for `PATCH`; use existing `@/components/ui/` button/input/dialog patterns; import and use `LlmProvider` from `@proveit/shared`

**Checkpoint**: Provider CRUD fully functional. Existing single-provider POCs work unchanged via legacy shims.

---

## Phase 4: User Story 2 - Per-Task Model Routing (Priority: P2)

**Goal**: Power users can assign a specific provider + model to each task type (agent, judge, eval-gen, stub-gen) via a collapsed panel

**Independent Test**: With two providers configured, open the advanced routing panel, assign Provider B / Model X to Judge. Run evals. Confirm judge used the override (visible via run snapshot or backend logs). Clear the override — judge reverts to "Default".

**Depends on**: Phase 3 complete (providers must exist to route to)

- [X] T009 [US2] Add routing methods to `packages/backend/src/llm/llm.service.ts` — add `getRouting(pocId)` → fetches all providers + all `TaskModelOverride` rows for pocId, joins provider name, returns `LlmRoutingConfig`; add `setTaskOverride(pocId, taskType, connectionId, model)` → validates `taskType` is in `['agent','judge','eval-gen','stub-gen']` (throw `BadRequestException({ error: 'INVALID_TASK_TYPE' })` otherwise); validates `connectionId` belongs to pocId (throw `BadRequestException({ error: 'PROVIDER_NOT_IN_POC' })` otherwise); upsert `TaskModelOverride` via `prisma.taskModelOverride.upsert({ where: { pocConfigId_taskType: { pocConfigId: pocId, taskType } }, ... })`; add `clearTaskOverride(pocId, taskType)` → delete if exists, no-op otherwise; add `resolveForTask(pocId, taskType): Promise<{ client: OpenAI; model: string; connectionId: string; providerName: string }>` → (1) find `TaskModelOverride` for `{ pocConfigId: pocId, taskType }` including `connection`; (2) if found: use that connection; (3) else: find `LlmConnection` where `{ pocConfigId: pocId, isDefault: true }`; (4) if no default: throw `NotFoundException('No default LLM provider configured. Add a provider on the LLM Settings page.')`; (5) return `{ client: this.getClient(conn.endpointUrl, conn.apiKey ?? undefined), model, connectionId: conn.id, providerName: conn.name }`

- [X] T010 [US2] Add routing endpoints to `packages/backend/src/llm/llm.controller.ts` in `LlmController` — add `@Get('routing')` → `this.llmService.getRouting(pocId)`; add `@Put('routing/:taskType')` with `@Body() dto: SetRoutingDto` → `this.llmService.setTaskOverride(pocId, taskType, dto.connectionId, dto.model)`; add `@Delete('routing/:taskType')` with `@HttpCode(204)` → `this.llmService.clearTaskOverride(pocId, taskType)`; add `taskType` param via `@Param('taskType') taskType: string`

- [X] T011 [US2] Add "Advanced model routing" collapsible panel to `packages/frontend/src/pages/LlmConnect.tsx` — append below the provider list: (a) "Advanced model routing ▸" toggle button (local `showRouting` state, collapsed by default); (b) when expanded, render four rows for task types with labels: `agent` → "Agent (eval runs)", `judge` → "Judge (scoring)", `eval-gen` → "Eval Generation", `stub-gen` → "Stub Generation"; (c) each row: Provider `<select>` (options: "Default" + providers list, selected option matches override's `connectionId` or "Default"), Model `<select>` or text input (if selected provider has `availableModels`, show as dropdown; else show text input), and "×" clear button; (d) onChange on provider or model: call `PUT /pocs/:id/llm/routing/:taskType` with `{ connectionId, model }`; (e) clear button: call `DELETE /pocs/:id/llm/routing/:taskType`; (f) show yellow warning icon on row if override provider's `isActive=false`; (g) data: `useQuery(['routing', pocId], () => GET /pocs/:id/llm/routing)`, invalidate on mutation

**Checkpoint**: Advanced routing panel functional. Per-task overrides save and display correctly.

---

## Phase 5: User Story 3 - Smart Defaults and Zero-Config Compatibility (Priority: P3)

**Goal**: All eval operations use `resolveForTask` so per-task routing is actually applied during runs; existing single-provider POCs continue to work

**Independent Test**: Open an existing POC. Run evals — everything works exactly as before. With two providers and a judge override set, run evals — judge uses the override provider.

**Depends on**: Phase 4 complete (`resolveForTask` must exist in T009)

- [X] T012 [US3] Update `packages/backend/src/eval/eval.service.ts` to use `resolveForTask` for all four task types — **(1) Agent (startRun + executeCase)**: in `startRun()` (~line 143): replace `include: { llmConnection: true }` with a call to `this.llmService.resolveForTask(pocId, 'agent')` and use its result for `snapshotModel` and `snapshotEndpointUrl`; in `executeRun()`/`executeCase()` (~lines 186-208): remove `include: { llmConnection: true }` from the poc fetch, call `this.llmService.resolveForTask(pocId, 'agent')` to get `{ client, model }` for `callAgent()`; **(2) Judge**: after agent completes, call `this.llmService.resolveForTask(pocId, 'judge')` to get a separate `{ client: judgeClient, model: judgeModel }`; pass `judgeClient` and `judgeModel` to `this.judgeService.judge()` (update JudgeService constructor/method signature to accept client+model if not already accepting them as parameters); **(3) Eval Generation** (~lines 582-607): replace `include: { llmConnection: true }` with `this.llmService.resolveForTask(pocId, 'eval-gen')`; **(4) Stub Generation** (~lines 633-663): replace `include: { llmConnection: true }` with `this.llmService.resolveForTask(pocId, 'stub-gen')`; update error message "Connect an LLM first" → "No default LLM provider configured. Add a provider on the LLM Settings page."

**Checkpoint**: All task types route through `resolveForTask`. Single-provider POCs still work (resolveForTask falls back to default provider).

---

## Phase 6: Polish & Validation

**Purpose**: End-to-end smoke test across all quickstart scenarios

- [X] T013 Start `pnpm dev` from repo root; manually exercise all 7 quickstart scenarios from `specs/004-multi-provider-llm/quickstart.md` in the browser — verify each scenario's expected state matches; fix any issues found before marking complete

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies
- **Foundational (Phase 2)**: Depends on Phase 1 — BLOCKS all user story phases
  - T003 and T004 can run in parallel after T002
- **US1 (Phase 3)**: Depends on Phase 2 complete
  - T005 can run in parallel with T003/T004 (different files)
  - T006 depends on T005 (uses DTOs)
  - T007 depends on T006 (calls service methods)
  - T008 can run in parallel with T006/T007 (different package)
- **US2 (Phase 4)**: Depends on Phase 3 complete
  - T009 extends llm.service.ts (same file as T006, sequential)
  - T010 extends llm.controller.ts (same file as T007, sequential after T009)
  - T011 extends LlmConnect.tsx (same file as T008, sequential after T008 + T010)
- **US3 (Phase 5)**: Depends on T009 (resolveForTask must exist)
- **Polish (Phase 6)**: Depends on all phases complete

### Story Dependencies

- **US1 (P1)**: Independent — can start immediately after Foundational
- **US2 (P2)**: Depends on US1 (providers must exist before routing can reference them)
- **US3 (P3)**: Depends on US2 (resolveForTask is added in T009, US2)

---

## Parallel Opportunities

```bash
# After T002 completes — run in parallel:
Task T003: "Run Prisma migration in packages/backend/"
Task T004: "Update packages/shared/src/types.ts"
Task T005: "Create DTO files in packages/backend/src/llm/dto/"

# During US1 backend work — run in parallel:
Task T006: "Rewrite llm.service.ts"          # backend
Task T008: "Rewrite LlmConnect.tsx"           # frontend (different package)
```

---

## Implementation Strategy

### MVP (US1 only — Provider CRUD)

1. Phase 1: Setup
2. Phase 2: Foundational (schema + types) — **REQUIRED before anything else**
3. Phase 3: US1 (T005 → T006 → T007, with T008 in parallel)
4. **STOP and VALIDATE**: Two providers configured, existing POC works unchanged
5. Continue to US2 when US1 is confirmed

### Full Delivery

1. Setup + Foundational → Foundation ready
2. US1 → Test: multiple providers, legacy compat ✓
3. US2 → Test: advanced routing panel, per-task overrides ✓
4. US3 → Test: eval runs use correct providers per task ✓
5. Polish → Smoke test all 7 quickstart scenarios ✓
