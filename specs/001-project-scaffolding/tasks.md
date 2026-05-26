# Tasks: Project Scaffolding

**Input**: Design documents from `/specs/001-project-scaffolding/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Not explicitly requested — test tasks omitted.

**Organization**: Tasks grouped by user story for independent implementation.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)

## Path Conventions

- **Backend**: `packages/backend/src/`
- **Frontend**: `packages/frontend/src/`
- **Shared**: `packages/shared/src/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Initialize monorepo, install dependencies, configure tooling

- [x] T001 Create root package.json with pnpm workspaces config pointing to packages/*
- [x] T002 Create pnpm-workspace.yaml defining packages/backend, packages/frontend, packages/shared
- [x] T003 Create tsconfig.base.json with shared TypeScript strict-mode config
- [x] T004 [P] Initialize packages/backend with NestJS (package.json, tsconfig.json, nest-cli.json) in packages/backend/
- [x] T005 [P] Initialize packages/frontend with Vite + React + TypeScript in packages/frontend/
- [x] T006 [P] Initialize packages/shared with TypeScript types package in packages/shared/
- [x] T007 [P] Configure Tailwind CSS in packages/frontend/tailwind.config.ts
- [x] T008 [P] Configure ESLint + Prettier for workspace in root .eslintrc.cjs and .prettierrc
- [x] T009 Create root dev script that runs backend + frontend concurrently in package.json

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Database schema, Prisma setup, shared types, base NestJS modules

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T010 Create Prisma schema with PocConfig, EvalCase, EvalResult, LlmConnection, EvalRun models in packages/backend/prisma/schema.prisma
- [x] T011 Run initial Prisma migration and generate client (add db:setup and db:migrate scripts to packages/backend/package.json)
- [x] T012 [P] Create PrismaModule and PrismaService in packages/backend/src/prisma/prisma.module.ts and prisma.service.ts
- [x] T013 [P] Define shared TypeScript types (PocConfig, EvalCase, EvalResult, LlmConnection, EvalRun) in packages/shared/src/types.ts
- [x] T014 [P] Create base AppModule importing PrismaModule in packages/backend/src/app.module.ts
- [x] T015 [P] Create main.ts with CORS and global prefix /api in packages/backend/src/main.ts
- [x] T016 [P] Create API client service with base fetch wrapper in packages/frontend/src/services/api.ts
- [x] T017 [P] Setup React Router with page shells (Home, PocEditor, LlmConnect, EvalResults) in packages/frontend/src/App.tsx
- [x] T018 [P] Install and configure React Query (TanStack Query) provider in packages/frontend/src/main.tsx
- [x] T019 [P] Create base UI components (Button, Input, Card, Badge, Spinner) in packages/frontend/src/components/ui/

**Checkpoint**: Foundation ready — user story implementation can now begin

---

## Phase 3: User Story 1 - Describe Workflow and Get POC (Priority: P1) 🎯 MVP

**Goal**: User types a workflow description, platform scaffolds a complete POC config (system prompt, tools, eval cases)

**Independent Test**: Submit a workflow description via the UI and verify a complete POC config appears with all sections populated

### Implementation for User Story 1

- [x] T020 [P] [US1] Create PocModule, PocController, PocService in packages/backend/src/poc/poc.module.ts, poc.controller.ts, poc.service.ts
- [x] T021 [P] [US1] Create ScaffoldModule and ScaffoldService that calls LLM to generate POC config in packages/backend/src/scaffold/scaffold.module.ts and scaffold.service.ts
- [x] T022 [US1] Create CreatePocDto and PocResponseDto in packages/backend/src/poc/dto/create-poc.dto.ts and poc-response.dto.ts
- [x] T023 [US1] Implement POST /api/pocs endpoint (accepts description, calls ScaffoldService, persists to DB, returns full config) in packages/backend/src/poc/poc.controller.ts
- [x] T024 [US1] Implement GET /api/pocs endpoint (list all POCs with summary) in packages/backend/src/poc/poc.controller.ts
- [x] T025 [US1] Implement GET /api/pocs/:id endpoint (full POC with eval cases) in packages/backend/src/poc/poc.controller.ts
- [x] T026 [US1] Create scaffolding system prompt (defines POC config JSON schema, instructs LLM to generate system prompt + tools + eval cases) in packages/backend/src/scaffold/prompts/scaffold.prompt.ts
- [x] T027 [US1] Create Home page with POC list and "New POC" input form in packages/frontend/src/pages/Home.tsx
- [x] T028 [US1] Create POC card component showing name, description, timestamps in packages/frontend/src/components/poc/PocCard.tsx
- [x] T029 [US1] Create workflow description input with submit button and loading state in packages/frontend/src/components/poc/CreatePocForm.tsx
- [x] T030 [US1] Wire Home page to backend (fetch POC list, create new POC, show scaffolding progress) in packages/frontend/src/pages/Home.tsx

**Checkpoint**: User can describe a workflow and get a scaffolded POC — MVP functional

---

## Phase 4: User Story 2 - Review and Edit Config (Priority: P1)

**Goal**: User views and edits all POC config sections (system prompt, tools, eval cases) with changes persisting

**Independent Test**: Navigate to a POC, edit each section, refresh page, verify edits persisted

### Implementation for User Story 2

- [x] T031 [US2] Implement PATCH /api/pocs/:id endpoint (partial update of name, systemPrompt, tools) in packages/backend/src/poc/poc.controller.ts
- [x] T032 [US2] Implement DELETE /api/pocs/:id endpoint in packages/backend/src/poc/poc.controller.ts
- [x] T033 [P] [US2] Create PocEditor page with tabbed sections (System Prompt, Tools, Eval Cases) in packages/frontend/src/pages/PocEditor.tsx
- [x] T034 [P] [US2] Create SystemPromptEditor component (textarea with auto-save) in packages/frontend/src/components/poc/SystemPromptEditor.tsx
- [x] T035 [P] [US2] Create ToolsEditor component (list of tools with add/edit/remove, JSON schema editor per tool) in packages/frontend/src/components/poc/ToolsEditor.tsx
- [x] T036 [P] [US2] Create EvalCasesList component (list eval cases with name, input preview, judge criteria) in packages/frontend/src/components/eval/EvalCasesList.tsx
- [x] T037 [US2] Wire PocEditor page to backend (load POC, save edits via PATCH, handle optimistic updates) in packages/frontend/src/pages/PocEditor.tsx

**Checkpoint**: User can view and edit all sections of a POC config

---

## Phase 5: User Story 3 - Connect LLM Endpoint (Priority: P2)

**Goal**: User connects a local or external LLM, validates connection, sees available models

**Independent Test**: Configure an LLM endpoint (LM Studio/Ollama/OpenAI), run health check, see model list

### Implementation for User Story 3

- [x] T038 [P] [US3] Create LlmModule, LlmController, LlmService in packages/backend/src/llm/llm.module.ts, llm.controller.ts, llm.service.ts
- [x] T039 [US3] Implement PUT /api/pocs/:id/llm endpoint (save connection config) in packages/backend/src/llm/llm.controller.ts
- [x] T040 [US3] Implement POST /api/pocs/:id/llm/test endpoint (health check — call /models, return status + available models + latency) in packages/backend/src/llm/llm.controller.ts
- [x] T041 [US3] Implement GET /api/pocs/:id/llm/models endpoint (list models from endpoint) in packages/backend/src/llm/llm.controller.ts
- [x] T042 [US3] Implement LlmService using OpenAI SDK with configurable baseURL in packages/backend/src/llm/llm.service.ts
- [x] T043 [P] [US3] Create LlmConnect page with endpoint URL input, API key input, model dropdown, test button in packages/frontend/src/pages/LlmConnect.tsx
- [x] T044 [P] [US3] Create ConnectionStatus component showing connected/disconnected/testing states in packages/frontend/src/components/llm/ConnectionStatus.tsx
- [x] T045 [US3] Wire LlmConnect page to backend (save config, test connection, display models) in packages/frontend/src/pages/LlmConnect.tsx

**Checkpoint**: User can connect any OpenAI-compatible LLM and verify it works

---

## Phase 6: User Story 4 - Run Evals and See Results (Priority: P2)

**Goal**: User runs eval cases against connected LLM, sees real-time scored results with pass/fail reasoning

**Independent Test**: Click "Run Evals" with a connected LLM, see results stream in with scores and reasoning per case

### Implementation for User Story 4

- [x] T046 [P] [US4] Create EvalModule, EvalController, EvalService in packages/backend/src/eval/eval.module.ts, eval.controller.ts, eval.service.ts
- [x] T047 [P] [US4] Create JudgeService (constructs judge prompt, calls LLM, parses structured JSON response) in packages/backend/src/eval/judge.service.ts
- [x] T048 [US4] Implement POST /api/pocs/:id/evals/run endpoint (creates EvalRun, returns runId, triggers async execution) in packages/backend/src/eval/eval.controller.ts
- [x] T049 [US4] Implement GET /api/pocs/:id/evals/run/:runId/stream SSE endpoint (streams case-start, case-complete, run-complete, error events) in packages/backend/src/eval/eval.controller.ts
- [x] T050 [US4] Implement eval execution loop in EvalService (iterate cases, call LLM, call judge, persist results, emit SSE events) in packages/backend/src/eval/eval.service.ts
- [x] T051 [US4] Create judge system prompt (receives eval input, POC response, rubric; returns JSON with pass/fail, score, reasoning) in packages/backend/src/eval/prompts/judge.prompt.ts
- [x] T052 [US4] Implement GET /api/pocs/:id/evals/runs endpoint (list past runs with summary stats) in packages/backend/src/eval/eval.controller.ts
- [x] T053 [US4] Implement GET /api/pocs/:id/evals/runs/:runId endpoint (detailed results for a run) in packages/backend/src/eval/eval.controller.ts
- [x] T054 [P] [US4] Create EvalResults page with run button, real-time results stream, past runs list in packages/frontend/src/pages/EvalResults.tsx
- [x] T055 [P] [US4] Create EvalResultCard component (shows case name, status badge, score, expandable reasoning) in packages/frontend/src/components/eval/EvalResultCard.tsx
- [x] T056 [P] [US4] Create RunProgress component (progress bar, case count, streaming status) in packages/frontend/src/components/eval/RunProgress.tsx
- [x] T057 [US4] Wire EvalResults page to backend (trigger run, consume SSE stream via EventSource, display results as they arrive) in packages/frontend/src/pages/EvalResults.tsx

**Checkpoint**: User can run evals and see scored results streaming in real-time

---

## Phase 7: User Story 5 - Upload or Generate Eval Cases (Priority: P3)

**Goal**: User uploads eval cases as JSON or generates new ones via AI

**Independent Test**: Upload a JSON eval file and verify cases appear; click "Generate" and verify new cases are created

### Implementation for User Story 5

- [x] T058 [US5] Implement POST /api/pocs/:id/evals endpoint (accept array of eval cases, validate, persist) in packages/backend/src/eval/eval.controller.ts
- [x] T059 [US5] Implement POST /api/pocs/:id/evals/generate endpoint (call LLM with current config, generate N new cases, persist) in packages/backend/src/eval/eval.controller.ts
- [x] T060 [US5] Create eval generation prompt (takes system prompt + tools, generates diverse test cases with judge criteria) in packages/backend/src/eval/prompts/generate-evals.prompt.ts
- [x] T061 [P] [US5] Create EvalImport component (file upload, JSON validation, error display) in packages/frontend/src/components/eval/EvalImport.tsx
- [x] T062 [P] [US5] Create GenerateEvalsButton component (count input, generate button, loading state) in packages/frontend/src/components/eval/GenerateEvalsButton.tsx
- [x] T063 [US5] Integrate import and generate into PocEditor eval cases tab in packages/frontend/src/pages/PocEditor.tsx

**Checkpoint**: User can add eval cases via upload or AI generation

---

## Phase 8: User Story 6 - Export POC Config (Priority: P3)

**Goal**: User exports POC as a portable, human-readable JSON file

**Independent Test**: Click Export on a POC, verify downloaded file is valid JSON with all config sections

### Implementation for User Story 6

- [x] T064 [US6] Implement GET /api/pocs/:id/export endpoint (return full config as downloadable JSON with Content-Disposition header) in packages/backend/src/poc/poc.controller.ts
- [x] T065 [US6] Create ExportButton component (triggers download, shows success feedback) in packages/frontend/src/components/poc/ExportButton.tsx
- [x] T066 [US6] Add export button to PocEditor page header in packages/frontend/src/pages/PocEditor.tsx

**Checkpoint**: User can export any POC as a standalone JSON file

---

## Phase 9: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [x] T067 [P] Add loading skeleton components for all pages in packages/frontend/src/components/ui/Skeleton.tsx
- [x] T068 [P] Add toast notification system for success/error feedback in packages/frontend/src/components/ui/Toast.tsx
- [x] T069 [P] Add empty states for POC list, eval results, and model list in packages/frontend/src/components/ui/EmptyState.tsx
- [x] T070 Add global error boundary with user-friendly error display in packages/frontend/src/components/ErrorBoundary.tsx
- [x] T071 Add navigation header with breadcrumbs in packages/frontend/src/components/ui/Header.tsx
- [x] T072 Validate quickstart.md flow end-to-end (install, dev, create POC, connect LLM, run evals)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion — BLOCKS all user stories
- **User Stories (Phase 3-8)**: All depend on Foundational phase completion
- **Polish (Phase 9)**: Depends on all user stories being complete

### User Story Dependencies

- **US1 (P1)**: Can start after Foundational — No dependencies on other stories
- **US2 (P1)**: Can start after Foundational — Uses same PocController as US1 but different endpoints (can parallel)
- **US3 (P2)**: Can start after Foundational — Independent module
- **US4 (P2)**: Depends on US3 (needs LLM connection to run evals)
- **US5 (P3)**: Can start after Foundational — Independent eval CRUD
- **US6 (P3)**: Can start after US1 (needs POC to exist for export)

### Within Each User Story

- Models/DTOs before services
- Services before controllers/endpoints
- Backend endpoints before frontend pages
- Core implementation before integration wiring

### Parallel Opportunities

- T004, T005, T006, T007, T008 can all run in parallel (Setup)
- T012–T019 can all run in parallel (Foundational)
- US1 and US2 can start simultaneously after Foundational
- US3 can start independently alongside US1/US2
- US5 can start independently alongside US3/US4

---

## Parallel Example: User Story 1

```bash
# Launch backend tasks in parallel:
Task T020: "Create PocModule, PocController, PocService"
Task T021: "Create ScaffoldModule and ScaffoldService"

# Then sequentially:
Task T022: "Create DTOs" (depends on T020)
Task T023-T025: "Implement endpoints" (depends on T020, T022)
Task T026: "Create scaffold prompt" (depends on T021)

# Launch frontend tasks in parallel:
Task T027: "Create Home page"
Task T028: "Create PocCard component"
Task T029: "Create CreatePocForm component"

# Then wire together:
Task T030: "Wire Home page to backend" (depends on T027-T029 + T023-T025)
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL — blocks all stories)
3. Complete Phase 3: User Story 1 (scaffold POC from description)
4. **STOP and VALIDATE**: Enter a workflow description → get a POC config
5. Demo-ready with core value proposition

### Incremental Delivery

1. Setup + Foundational → Foundation ready
2. US1 (Scaffold) + US2 (Edit) → Core editing loop works (MVP!)
3. US3 (Connect LLM) → Can test against real models
4. US4 (Run Evals) → Full feedback loop complete
5. US5 (Import/Generate Evals) + US6 (Export) → Power user features

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story
- Each user story is independently completable and testable
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
