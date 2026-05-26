# Tasks: Tool Stubs & Test Data Generation

**Input**: Design documents from `/specs/002-tool-stubs/`
**Prerequisites**: plan.md ✓, spec.md ✓, research.md ✓, data-model.md ✓, contracts/api.md ✓, quickstart.md ✓

**Tests**: Not explicitly requested — no test tasks generated.

**Organization**: Tasks are grouped by user story. Phase 2 (Foundational) must complete before any user story work.

---

## Phase 1: Setup

**Purpose**: No new project setup required — monorepo already configured. This phase adds the shared type change that everything else depends on.

- [X] T001 Add `mockResponse?: string` to `ToolDefinition` interface in `packages/shared/src/types.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Rewrite the eval runner's `callAgent` to handle the tool-call loop. Without this, even manually configured stubs cannot be returned to the agent.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [X] T002 Rewrite `callAgent` private method in `packages/backend/src/eval/eval.service.ts` to accept a `tools: ToolDefinition[]` param, pass tools to the LLM API (stripping `mockResponse` before sending), and loop on `finish_reason === 'tool_calls'` — pushing the assistant message first, then one `{ role: 'tool', tool_call_id, content }` message per call using the matching tool's `mockResponse` as content (or an error JSON string if the tool has no stub or is unknown). Guard with `MAX_ITERATIONS = 10`. Update the `callAgent` call site in `executeRun` to pass `poc.tools` parsed from JSON.

**Checkpoint**: Foundation complete — agent can now complete tool-calling eval loops using stub responses.

---

## Phase 3: User Story 1 — Manual Stub Authoring (Priority: P1) 🎯 MVP

**Goal**: A user can expand any tool in the Tools tab, enter a JSON mock response, save it, and have it returned to the agent during eval runs.

**Independent Test**: Open a POC with a tool, enter a mock response, save, run an eval — verify the agent receives the stub and the eval case completes (not errored).

### Implementation

- [X] T003 [P] [US1] Add mock response textarea + JSON validation state + stub status dot to `ToolsEditor.tsx` in `packages/frontend/src/components/poc/ToolsEditor.tsx` — inside the expanded tool section, below the parameters field: a textarea bound to `tool.mockResponse ?? ''`, an inline error message shown when the value is non-empty and not valid JSON, and a colored dot (green = configured, gray = empty) in the collapsed tool row header next to the tool name. Block "Save tools" while any tool has invalid JSON.
- [X] T004 [US1] Update `updateTool` helper in `packages/frontend/src/components/poc/ToolsEditor.tsx` to handle `mockResponse` as a raw string field (not JSON.parsed like `parameters`) — set it directly on the draft tool object. When the field is blank, omit `mockResponse` from the saved tool object (undefined = no stub).

**Checkpoint**: User Story 1 complete. Open a POC, expand a tool, enter `{"result": "ok"}`, save, run an eval — agent should call the tool and receive that response, completing the reasoning loop.

---

## Phase 4: User Story 2 — LLM-Generated Stubs (Priority: P2)

**Goal**: A user with a connected LLM can click "Generate stubs" and have all tools automatically filled with realistic mock responses, with confirmation required before overwriting existing stubs.

**Independent Test**: Click "Generate stubs" on a POC with tools and no stubs — within 30s all tools show mock responses. Click again with existing stubs — confirmation dialog appears.

### Implementation

- [X] T005 [P] [US2] Create `packages/backend/src/eval/prompts/generate-stubs.prompt.ts` — export two functions: `buildGenerateStubsSystemPrompt()` returning a system prompt instructing the LLM to produce realistic JSON mock responses for each tool, and `buildGenerateStubsUserPrompt(tools: ToolDefinition[])` returning a user message listing each tool's name, description, and parameter schema, asking for a JSON object keyed by tool name where each value is the mock response object.
- [X] T006 [US2] Add `generateStubs(pocId: string, overwrite: boolean)` method to `packages/backend/src/eval/eval.service.ts` — fetch the POC and its LLM connection, parse the tools array, filter to empty tools unless `overwrite: true`, call the LLM with the stubs prompt, parse the response as a JSON object keyed by tool name, merge the returned values into matching tools as `mockResponse: JSON.stringify(value)`, update `PocConfig.tools` in the database, and return `{ generated: string[], skipped: string[], failed: string[] }`.
- [X] T007 [US2] Create `packages/backend/src/eval/stubs.controller.ts` — `@Controller('pocs/:pocId/tools')` with a single `@Post('stubs/generate')` endpoint that calls `evalService.generateStubs(pocId, body.overwrite ?? false)`. Register `StubsController` in `packages/backend/src/eval/eval.module.ts` controllers array.
- [X] T008 [P] [US2] Create `GenerateStubsButton` component in `packages/frontend/src/components/poc/GenerateStubsButton.tsx` — a button labelled "Generate stubs" that calls `POST /api/pocs/:id/tools/stubs/generate` with `{ overwrite: false }`. If the response contains any `skipped` tools (meaning stubs exist), show a confirmation dialog "X tools already have stubs. Regenerate all?" — if confirmed, re-call with `{ overwrite: true }`. Show a loading spinner during generation and a toast on completion ("X stubs generated") or error.
- [X] T009 [US2] Import and render `GenerateStubsButton` in `packages/frontend/src/pages/PocEditor.tsx` in the tools tab section, alongside the existing "Save tools" area. Pass `pocId={poc.id}` and an `onSuccess` callback that calls `queryClient.invalidateQueries({ queryKey: ['poc', id] })` to refresh the tools list after generation.

**Checkpoint**: User Story 2 complete. Click "Generate stubs" — tools receive auto-generated mock responses from the LLM within 30s.

---

## Phase 5: User Story 3 — LLM-Generated Eval Test Data (Priority: P2)

**Goal**: A user can click "Generate test data" to get eval cases with user messages designed to trigger tool calls, appended to existing cases.

**Independent Test**: Click "Generate test data" on a POC with tools — 5 new eval cases are added with user messages that reference the POC's tool domain. Run evals — at least 4 of 5 new cases trigger a tool call.

### Implementation

- [X] T010 [P] [US3] Create `packages/backend/src/eval/prompts/generate-tool-data.prompt.ts` — export `buildGenerateToolDataSystemPrompt()` and `buildGenerateToolDataUserPrompt(systemPrompt: string, tools: ToolDefinition[], count: number)`. The user prompt should include the POC's system prompt and the list of tool names + descriptions, instructing the LLM to generate `count` eval cases whose `input.messages` contain user messages that would realistically lead the agent to call one of the defined tools. Return format matches the existing eval case generation format (array with `name`, `input`, `judgeCriteria`).
- [X] T011 [US3] Extend `generateCases(pocId, count, toolFocused?)` in `packages/backend/src/eval/eval.service.ts` to accept an optional `toolFocused: boolean` parameter — when true, use `buildGenerateToolDataUserPrompt` instead of the existing `buildGenerateEvalsUserPrompt`. Remove the `response_format: { type: 'json_object' }` option from the `generateCases` LLM call and add the same markdown fence stripping and JSON extraction used in `scaffold.service.ts` (local LLMs don't support `json_object` mode).
- [X] T012 [US3] Update `GenerateCasesDto` in `packages/backend/src/eval/eval.controller.ts` to add `toolFocused?: boolean = false` and pass it through to `evalService.generateCases(pocId, dto.count, dto.toolFocused)`.
- [X] T013 [US3] Add a "Generate test data" button to the evals tab in `packages/frontend/src/pages/PocEditor.tsx` — reuse the existing `generateCasesMutation` but POST `{ count: 5, toolFocused: true }`. Render the button alongside the existing "Generate evals" button in the evals tab action bar with label "Generate test data".

**Checkpoint**: User Story 3 complete. "Generate test data" produces eval cases that trigger tool calls when run.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [X] T014 [P] Add guard in `callAgent` in `packages/backend/src/eval/eval.service.ts`: if `tools` array is empty or all tools lack `mockResponse`, skip passing tools to the LLM API entirely (avoids tool-loop on models that hallucinate tool calls when given tool definitions but no stubs).
- [X] T015 Add error display when `generateStubs` returns any `failed` tool names in `packages/frontend/src/components/poc/GenerateStubsButton.tsx` — show a toast listing the failed tool names so users know which ones need manual stubs.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies — start immediately
- **Phase 2 (Foundational)**: Depends on Phase 1 (T001 must be done before T002)
- **Phase 3 (US1)**: Depends on Phase 2 (T002 must be done before T003/T004)
- **Phase 4 (US2)**: Depends on Phase 3 (stubs must be saveable before generation is useful)
- **Phase 5 (US3)**: Depends on Phase 2 only (eval generation is independent of stub authoring)
- **Phase 6 (Polish)**: Depends on Phases 3–5

### User Story Dependencies

- **US1 (P1)**: Depends on Foundational — no dependency on US2/US3
- **US2 (P2)**: Depends on US1 (stubs must be displayable after generation)
- **US3 (P2)**: Depends on Foundational only — independent of US1/US2

### Within Each Phase

- T003 and T004 are sequential (T004 updates the same file as T003)
- T005 and T008 are parallel (different files)
- T006 depends on T005 (uses the prompt functions)
- T007 depends on T006 (registers the service method)
- T009 depends on T008 (imports the component)
- T010 and T012 are parallel (different files)
- T011 depends on T010 (uses the prompt)
- T013 depends on T012 (relies on DTO change)

---

## Parallel Opportunities

```
# Phase 3 (US1) — sequential (same file):
T003 → T004  [ToolsEditor.tsx]

# Phase 4 (US2) — parallel where marked:
T005 [P]  [generate-stubs.prompt.ts]
T008 [P]  [GenerateStubsButton.tsx]
T006      [eval.service.ts — after T005]
T007      [stubs.controller.ts + eval.module.ts — after T006]
T009      [PocEditor.tsx — after T008]

# Phase 5 (US3) — parallel where marked:
T010 [P]  [generate-tool-data.prompt.ts]
T012 [P]  [eval.controller.ts]
T011      [eval.service.ts — after T010]
T013      [PocEditor.tsx — after T012]
```

---

## Implementation Strategy

### MVP (User Story 1 Only)

1. Complete Phase 1: T001 — add `mockResponse` to shared type
2. Complete Phase 2: T002 — rewrite `callAgent` with tool loop
3. Complete Phase 3: T003, T004 — add mock response field to ToolsEditor
4. **STOP and VALIDATE**: Enter a stub, save, run an eval — agent completes tool-calling loop
5. This is the minimum for a working end-to-end tool stub experience

### Incremental Delivery

1. MVP (US1) → tool stubs work manually
2. Add US2 → LLM generates stubs automatically
3. Add US3 → LLM generates tool-exercising test cases
4. Polish (T014, T015) → guard against no-stub models, surface failed stubs

---

## Notes

- [P] tasks touch different files and have no incomplete dependencies
- [Story] labels map to user stories in spec.md for traceability
- T002 is the most critical task — incorrect tool loop order (tool messages before assistant message) causes a 400 from the LLM API
- `mockResponse` is stored and sent as a raw string (already JSON) — do not double-stringify
- Strip `mockResponse` from the `tools` array before passing to the LLM API in `callAgent`
- `generateCases` in eval.service.ts still uses `response_format: { type: 'json_object' }` — T011 removes it
