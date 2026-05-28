# Tasks: PoC Generation UX

**Input**: Design documents from `/specs/009-poc-generation-ux/`  
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/api.md ✅, quickstart.md ✅

**Organization**: Tasks grouped by user story for independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to

---

## Phase 1: Setup

No new packages or schema changes required — SSE infrastructure already exists in the codebase.

---

## Phase 2: Foundational (Shared Types & Backend Async Pipeline)

**Purpose**: Shared types and the async scaffold pipeline that all user stories depend on. No story work can begin until this phase is complete.

- [X] T001 [P] Add scaffold SSE types to `packages/shared/src/types.ts`: add `ScaffoldStep` type (`'analysing' | 'system-prompt' | 'tools' | 'eval-cases' | 'saving'`); add `ScaffoldStepStartEvent { type: 'step-start'; step: ScaffoldStep; index: number; total: number }`, `ScaffoldContentPayload { type: 'system-prompt' | 'tools' | 'eval-cases'; name?: string; systemPrompt?: string; tools?: ToolDefinition[]; evalCases?: Array<{ name: string; input: EvalCaseInput; judgeCriteria: string }> }`, `ScaffoldStepCompleteEvent { type: 'step-complete'; step: ScaffoldStep; content?: ScaffoldContentPayload }`, `ScaffoldDoneEvent { type: 'done'; pocId: string }`, `ScaffoldErrorEvent { type: 'error'; step: ScaffoldStep; message: string }`, `ScaffoldStreamEvent` union of all four; add `ScaffoldJobResponse { jobId: string }`; run `pnpm --filter shared build`

- [X] T002 [P] Refactor `packages/backend/src/scaffold/scaffold.service.ts` — replace the single `scaffold()` method with three focused async methods: `generateSystemPrompt(description: string, client: OpenAI, model: string): Promise<{ name: string; systemPrompt: string }>` (system prompt: "You are an expert AI agent workflow designer. Given a workflow description, generate a concise name and a detailed system prompt for the agent. Respond with JSON: { name: string, systemPrompt: string }." — user: "Workflow description: {description}"); `generateTools(description: string, systemPrompt: string, client: OpenAI, model: string): Promise<ToolDefinition[]>` (system prompt instructs 3–7 tools with name/description/parameters/mockResponse, JSON: { tools: [...] }); `generateEvalCases(description: string, systemPrompt: string, tools: ToolDefinition[], client: OpenAI, model: string): Promise<Array<{ name: string; input: EvalCaseInput; judgeCriteria: string }>>` (system prompt instructs exactly 5 eval cases, JSON: { evalCases: [...] }); each method calls `client.chat.completions.create({ model, messages, temperature: 0.7 })`, strips markdown fences from response, and parses JSON — throw `Error` with plain-language message on parse failure; remove the old `scaffold()` method

- [X] T003 In `packages/backend/src/poc/poc.service.ts` — import `Subject, Observable` from `rxjs`; import `MessageEvent` from `@nestjs/common`; import `{ v4 as uuidv4 }` from `uuid` (already in package.json); add `private jobs = new Map<string, Subject<MessageEvent>>()`; add `startScaffoldJob(params: { description: string; endpointUrl: string; apiKey?: string; model?: string }): string` — generates jobId via `uuidv4()`, creates `new Subject<MessageEvent>()`, stores in `this.jobs`, calls `this.runScaffoldJob(jobId, params)` without `await`, returns jobId; add `getJobStream(jobId: string): Observable<MessageEvent>` — returns `this.jobs.get(jobId)?.asObservable()` or throws `NotFoundException('Scaffold job not found')`; add `private async runScaffoldJob(jobId: string, params)` that: (1) emits `{ type: 'step-start', step: 'analysing', index: 0, total: 5 }` then immediately `{ type: 'step-start', step: 'system-prompt', index: 1, total: 5 }`, (2) calls `this.scaffoldService.generateSystemPrompt(...)`, emits `{ type: 'step-complete', step: 'system-prompt', content: { type: 'system-prompt', name, systemPrompt } }`, (3) emits `{ type: 'step-start', step: 'tools', index: 2, total: 5 }`, calls `generateTools(...)`, emits `{ type: 'step-complete', step: 'tools', content: { type: 'tools', tools } }`, (4) emits `{ type: 'step-start', step: 'eval-cases', index: 3, total: 5 }`, calls `generateEvalCases(...)`, emits `{ type: 'step-complete', step: 'eval-cases', content: { type: 'eval-cases', evalCases } }`, (5) emits `{ type: 'step-start', step: 'saving', index: 4, total: 5 }`, creates DB records via `prisma.pocConfig.create({ data: { name, systemPrompt, tools: JSON.stringify(tools), metadata: '{}', evalCases: { create: evalCases.map(c => ({ name: c.name, input: JSON.stringify(c.input), judgeCriteria: c.judgeCriteria, order: idx })) } } })` then calls `this.createConfigVersion(poc.id, ...)`, (6) emits `{ type: 'done', pocId: poc.id }`, (7) catch any Error: track `currentStep`, emit `{ type: 'error', step: currentStep, message: toPlainLanguage(err) }` where `toPlainLanguage` maps network/timeout/parse errors to plain-language strings (e.g., "Could not reach the LLM endpoint — check your connection and retry."); finally block: `subject.complete(); this.jobs.delete(jobId)`; all SSE data emitted as `subject.next({ data: JSON.stringify(payload) })` (note: depends on T001 for types, T002 for ScaffoldService methods)

- [X] T004 Update `packages/backend/src/poc/poc.controller.ts` — change the `POST /scaffold` handler to call `this.pocService.startScaffoldJob({ description, endpointUrl, apiKey, model })` and return `{ jobId }` with `@HttpCode(202)` decorator; add `@Get('scaffold/stream/:jobId') @Sse() @Header('Cache-Control', 'no-cache') @Header('X-Accel-Buffering', 'no')` endpoint that calls `return this.pocService.getJobStream(jobId)` (the Observable is returned directly to NestJS SSE handler); remove the old synchronous scaffold return type and any `PocConfig` response wrapping

**Checkpoint**: Backend pipeline is async and streams step events. `POST /api/pocs/scaffold` returns `{ jobId }`. `GET /api/pocs/scaffold/stream/:jobId` emits SSE events. All user stories can now proceed.

---

## Phase 3: User Story 1 — Step-by-step Progress Visibility (Priority: P1) 🎯 MVP

**Goal**: User sees 5 named steps updating in real time on a full-screen page during scaffold.

**Independent Test**: Submit the form → browser navigates to `/scaffold/:jobId` → at least 3 distinct named step labels appear and transition from waiting → in-progress → complete during generation, all before the navigation to the PoC editor.

- [X] T005 [P] [US1] Create `packages/frontend/src/components/poc/ScaffoldProgress.tsx` — accepts props: `steps: StepStatus[]` (where `StepStatus = { id: ScaffoldStep; label: string; state: 'waiting' | 'in-progress' | 'complete' | 'error' }`), `previewName: string | null`, `previewSystemPrompt: string | null`, `previewTools: ToolDefinition[] | null`, `previewEvalCases: Array<{ name: string; judgeCriteria: string }> | null`, `errorMessage: string | null`, `onRetry?: () => void`; renders: full-height dark-background container (matching app dark theme); step list where each step shows a left-side icon (waiting = gray hollow circle, in-progress = animated spinning ring using Tailwind `animate-spin`, complete = solid green checkmark circle, error = solid red X circle) and a label (text-white for active/complete, text-gray-500 for waiting, text-red-400 for error); content preview section (renders below step list, only when at least one preview field is non-null) — system prompt block, tools list, eval cases list (see US2 tasks for rendering details — for now render null/empty state gracefully); error message rendered in amber box below step list when `errorMessage` is set; "Retry" button below error message when `onRetry` is provided; mobile-responsive (steps stack cleanly at 375px)

- [X] T006 [US1] Create `packages/frontend/src/pages/ScaffoldingPage.tsx` — reads `jobId` from `useParams()`; reads `{ description, endpointUrl, apiKey, model, globalProviderId }` from `useLocation().state`; manages state: `steps` (array of 5 StepStatus initialized as all 'waiting' with labels: 'Analysing description', 'Generating system prompt', 'Generating tools', 'Generating eval cases', 'Saving configuration'), `previewName/previewSystemPrompt/previewTools/previewEvalCases` (all null initially), `errorMessage` (null), `errorStep` (null); on mount: opens `new EventSource('/api/pocs/scaffold/stream/${jobId}')`, registers `onmessage` handler that parses `JSON.parse(e.data)` as `ScaffoldStreamEvent` and updates state accordingly: `step-start` → set that step to 'in-progress' (and all prior steps to 'complete' if not already); `step-complete` → set that step to 'complete' and extract content payload into preview state; `done` → close EventSource and call `navigate('/poc/${pocId}')`; `error` → close EventSource, set failed step to 'error', set errorMessage; registers `onerror` handler to set generic error message; closes EventSource on unmount cleanup; renders full viewport height centered layout with `<ScaffoldProgress steps={steps} ... />` passing all state; `onRetry` calls POST `/api/pocs/scaffold` with same params, navigates to `/scaffold/${newJobId}` with same location.state

- [X] T007 [US1] Add `/scaffold/:jobId` route to `packages/frontend/src/App.tsx` — import `ScaffoldingPage`; add `<Route path="/scaffold/:jobId" element={<ScaffoldingPage />} />` inside the existing router

- [X] T008 [US1] Update `packages/frontend/src/pages/Home.tsx` — in the form submit handler (`handleCreate` or equivalent): change from calling the old synchronous scaffold API to `api.post('/pocs/scaffold', payload)` returning `{ jobId: string }`; on success call `navigate('/scaffold/${jobId}', { state: { description, endpointUrl, apiKey, model, globalProviderId } })`; set `isCreating` state to true before the POST and false in catch (success case navigates away, so no need to reset on success); pass `isCreating` as `isLoading` prop to `<CreatePocForm />`

- [X] T009 [P] [US1] Update `packages/frontend/src/components/poc/CreatePocForm.tsx` — add `isLoading?: boolean` prop; disable the submit button when `isLoading` is true; add visual loading indicator on button (e.g., opacity-50 cursor-not-allowed or spinner text "Generating…" while loading)

**Checkpoint**: US1 fully testable — submit form → navigate to full-screen `/scaffold/:jobId` → steps transition in real time → navigate to PoC editor on completion.

---

## Phase 4: User Story 2 — Live Content Preview (Priority: P2)

**Goal**: Generated system prompt, tools, and eval cases appear progressively in the preview pane before generation is complete.

**Independent Test**: Run generation and confirm the system prompt text appears in the preview section of the scaffold page before the tools or eval cases steps complete.

- [X] T010 [US2] Update content rendering in `packages/frontend/src/components/poc/ScaffoldProgress.tsx` — implement the preview section that renders when content is available: system prompt block (dark card with label "System Prompt", monospace `<pre>` showing `previewSystemPrompt` text, appears when `previewSystemPrompt` is non-null); tools section (label "Tools", bulleted list of `{ name, description }` for each tool in `previewTools`, appears when `previewTools.length > 0`); eval cases section (label "Eval Cases", numbered list of `caseName` for each case in `previewEvalCases`, appears when `previewEvalCases.length > 0`); each section fades in with `transition-opacity duration-300`; full section visible before the step list area ends — scroll is natural

- [X] T011 [US2] Update `packages/frontend/src/pages/ScaffoldingPage.tsx` — ensure `step-complete` event handler correctly extracts and sets preview content: for `content.type === 'system-prompt'`: set `previewName = content.name`, `previewSystemPrompt = content.systemPrompt`; for `content.type === 'tools'`: set `previewTools = content.tools`; for `content.type === 'eval-cases'`: set `previewEvalCases = content.evalCases.map(c => ({ name: c.name, judgeCriteria: c.judgeCriteria }))`; verify the preview props are passed to `<ScaffoldProgress />`

**Checkpoint**: US2 fully testable — system prompt text visible in preview before tools step completes.

---

## Phase 5: User Story 3 — Failure Transparency and Recovery (Priority: P3)

**Goal**: On failure, the user sees which step failed, a plain-language reason, and can retry without re-entering their description.

**Independent Test**: Trigger a failure (invalid API key or endpoint) → scaffold page shows the failed step highlighted in red with a plain-language message, previous steps remain complete, a Retry button is visible, the original description is preserved.

- [X] T012 [P] [US3] Update error handling in `packages/frontend/src/pages/ScaffoldingPage.tsx` — in the SSE `error` event handler: set the identified `step` in `steps` array to `'error'` state (all prior steps remain 'complete'); set `errorMessage` state with the `message` from the event; close EventSource; also handle EventSource `onerror` (connection-level failure) by setting the current in-progress step (if any) to 'error' with message "Connection to server lost. Please retry."

- [X] T013 [P] [US3] Update error display in `packages/frontend/src/components/poc/ScaffoldProgress.tsx` — ensure the error state icon (red X circle) renders for the failed step; render a styled error box below the failed step (amber border, amber text) showing `errorMessage`; render a "Retry" button (amber/white button) below the error box only when `onRetry` is defined and `errorMessage` is set; keep all previously completed steps visually green/complete (verify this is already handled by the step state logic from T005)

- [X] T014 [US3] Implement retry handler in `packages/frontend/src/pages/ScaffoldingPage.tsx` — add `handleRetry` async function: calls `api.post('/pocs/scaffold', { description, endpointUrl, apiKey, model, globalProviderId })` from location.state, on success resets all step states to 'waiting', clears all preview state, clears errorMessage, and calls `navigate('/scaffold/${newJobId}', { state: locationState, replace: true })` to navigate to the new job on the same route slot; pass `handleRetry` as `onRetry` to `<ScaffoldProgress />`

**Checkpoint**: All user stories complete. Failure shows which step failed, preserves description, offers retry.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [X] T015 [P] Run `pnpm --filter backend build` and `pnpm --filter frontend build` — fix any TypeScript errors introduced by the new types and refactored scaffold service
- [ ] T016 [P] Run the quickstart.md acceptance test flow: happy path (5 steps appear and transition), slow connection (animated spinner persists), failure + retry (failed step highlighted, retry restarts), duplicate submission prevention (button disabled mid-flight), mobile (375px viewport — step list readable)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 2 (Foundational)**: Blocks all user stories; within Phase 2: T001 and T002 parallel → T003 → T004
- **Phase 3 (US1)**: Depends on Phase 2 complete; T005 and T009 parallel → T006 → T007 → T008
- **Phase 4 (US2)**: Depends on Phase 3 complete; T011 → T010 (T011 wires content in ScaffoldingPage; T010 renders it in ScaffoldProgress — but since T010 already accepts the props in placeholder form from T005, these can run in either order; do T011 first to confirm the data shape)
- **Phase 5 (US3)**: Depends on Phase 3 complete; T012 and T013 parallel → T014
- **Phase 6 (Polish)**: Depends on all desired stories complete

### Within Foundational (Phase 2) — Sequential Order

`T001 ∥ T002 → T003 → T004`

T001 and T002 touch different packages and can run in parallel. T003 depends on both (needs shared types + ScaffoldService methods). T004 depends on T003 (calls `getJobStream`).

### Parallel Opportunities

- T001 (shared/types.ts) ∥ T002 (scaffold.service.ts) — different packages
- T005 (ScaffoldProgress.tsx — new file) ∥ T009 (CreatePocForm.tsx — different file) within Phase 3
- T012 (ScaffoldingPage error state) ∥ T013 (ScaffoldProgress error display) within Phase 5
- T015 (builds) ∥ T016 (acceptance tests) in Phase 6

---

## Parallel Example

```
Phase 2 Stream A (backend — sequential):
  T003 → T004

Phase 2 Stream B (parallel with A):
  T001 ∥ T002  (complete both, then unblock T003)

Phase 3 Stream A (frontend pages):
  T006 → T007 → T008

Phase 3 Stream B (parallel with A):
  T005  (ScaffoldProgress component)
  T009  (CreatePocForm)
```

---

## Implementation Strategy

### MVP First (US1 — P1)

1. Phase 2: Shared types + backend async pipeline (T001–T004)
2. Phase 3: Full-screen scaffold progress page (T005–T009)
3. **STOP and VALIDATE** — step transitions visible, navigation to PoC editor on done
4. Ship if sufficient

### Full Delivery

5. Phase 4: Content preview (T010–T011)
6. Phase 5: Failure + retry (T012–T014)
7. Phase 6: Builds + acceptance tests (T015–T016)

---

## Notes

- `uuid` is already in `package.json` — no new packages needed
- The NestJS SSE pattern (`@Sse()` returning `Observable<MessageEvent>`) is already proven in the eval module (`eval.controller.ts` + `eval.service.ts`) — follow that exact pattern
- `location.state` carries the scaffold params through to ScaffoldingPage for retry support — no URL query params needed
- All preview fields are nullable; ScaffoldProgress must handle null gracefully at every render
- T003's `toPlainLanguage(err)` helper: map `ECONNREFUSED`/`fetch failed` → "Could not reach the LLM endpoint — check your connection and retry."; JSON parse error → "The LLM returned an unexpected response format. Please retry."; timeout → "The request timed out — the LLM may be overloaded. Please retry."
