# Tasks: POC Agent Chat UI

**Input**: Design documents from `/specs/005-poc-agent-chat/`
**Prerequisites**: plan.md ✓, spec.md ✓, research.md ✓, data-model.md ✓, contracts/api.md ✓, quickstart.md ✓

**Tests**: Not requested — no test tasks included.

**Organization**: Tasks grouped by user story for independent implementation and delivery.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Install new packages and add shared types before any story work begins.

- [x] T001 Install `@assistant-ui/react` and `@assistant-ui/react-markdown` in packages/frontend/package.json via `pnpm --filter frontend add @assistant-ui/react @assistant-ui/react-markdown`
- [x] T002 [P] Add `ChatMessageInput`, `ChatStreamTextDelta`, `ChatStreamToolCallStart`, `ChatStreamToolCallResult`, `ChatStreamDone`, `ChatStreamError`, and `ChatStreamEvent` types to packages/shared/src/types.ts (see contracts/api.md for exact shapes)
- [x] T003 Rebuild shared package after type additions: `pnpm --filter @proveit/shared build`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Backend module skeleton and frontend route wired up — required before any user story can be developed or tested end-to-end.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [x] T004 Create packages/backend/src/chat/chat.module.ts, chat.controller.ts, and chat.service.ts as empty stubs (`@Module`, `@Controller('pocs/:id/chat')`, `@Injectable()`)
- [x] T005 Import and register `ChatModule` in packages/backend/src/app.module.ts
- [x] T006 [P] Add route `/poc/:id/chat` pointing to the new `Chat` page component in packages/frontend/src/App.tsx (alongside existing routes)
- [x] T007 [P] Add a "Chat" tab link (`/poc/:id/chat`) in the POC navigation alongside "Edit config" and "Eval Results" — locate the nav in packages/frontend/src/pages/PocEditor.tsx or the shared nav layout and add the link there

**Checkpoint**: Backend module imports without error; navigating to `/poc/:id/chat` loads a blank page without a 404.

---

## Phase 3: User Story 1 — Send a Message and See a Streaming Response (Priority: P1) 🎯 MVP

**Goal**: User types a message, submits it, and sees the agent's response streaming token-by-token in real time. Input is disabled during generation. Errors surface as readable messages.

**Independent Test**: With a connected LLM provider, open `/poc/:id/chat`, type any message, submit — tokens should appear progressively within 2 seconds and the input should re-enable when done.

- [x] T008 [US1] Implement `ChatService.streamChat(pocId, messages)` in packages/backend/src/chat/chat.service.ts
- [x] T009 [US1] Implement `POST /pocs/:id/chat/stream` in packages/backend/src/chat/chat.controller.ts
- [x] T010 [P] [US1] Create packages/frontend/src/pages/Chat.tsx
- [x] T011 [US1] Wire the SSE stream into the external store in packages/frontend/src/pages/Chat.tsx

**Checkpoint**: Full P1 user story works end-to-end — streaming response visible in the thread, input disabled during generation, re-enabled on completion.

---

## Phase 4: User Story 2 — Inspect Tool Calls Inline (Priority: P2)

**Goal**: When the agent calls a tool during a response, a collapsible trace item appears inline in the conversation showing the tool name (collapsed by default), and arguments + result when expanded.

**Independent Test**: Configure a POC with at least one tool stub. Send a message that triggers the tool. A collapsed `🔧 <toolName>` item should appear in the thread. Click to expand — arguments and result should be visible.

- [x] T012 [US2] Extend `ChatService.streamChat()` in packages/backend/src/chat/chat.service.ts to handle tool calls
- [x] T013 [P] [US2] Create packages/frontend/src/components/chat/ToolCallTrace.tsx
- [x] T014 [US2] Wire `tool-call-start` and `tool-call-result` SSE events in packages/frontend/src/pages/Chat.tsx
- [x] T015 [US2] Register `ToolCallTrace` as a generic fallback tool UI (via `tools.Override` in `MessagePrimitive.Parts`)

**Checkpoint**: Tool calls appear as collapsed trace items inline. Expanding reveals arguments and result. Multiple sequential tool calls each appear as separate items in call order.

---

## Phase 5: User Story 3 — Markdown-Formatted Responses (Priority: P3)

**Goal**: Agent responses containing markdown (code blocks, lists, headers, bold/italic) are rendered as formatted HTML, not raw syntax strings.

**Independent Test**: Prompt the agent to respond with a code block and a numbered list. The output should show syntax-highlighted code and a rendered list — no raw backticks or asterisks visible.

- [x] T016 [P] [US3] Create packages/frontend/src/components/chat/ChatThread.tsx
- [x] T017 [US3] Replace the bare `Thread` import in packages/frontend/src/pages/Chat.tsx with the new `ChatThread` component

**Checkpoint**: Agent responses with markdown render correctly — code blocks use monospace + highlighting, lists are indented, plain text responses show no regression.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Edge cases, UX completeness, and cleanup across all three stories.

- [x] T018 [P] Add "New conversation" button in packages/frontend/src/pages/Chat.tsx
- [x] T019 [P] Add `RunConfig` panel at the top of packages/frontend/src/pages/Chat.tsx (hidden while streaming)
- [x] T020 Handle no-LLM-connected state in packages/frontend/src/pages/Chat.tsx
- [x] T021 Cancel SSE stream on page unmount in packages/frontend/src/pages/Chat.tsx

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies — start immediately
- **Phase 2 (Foundational)**: Depends on T003 (shared build) — **blocks all user stories**
- **Phase 3 (US1)**: Depends on Phase 2 complete
- **Phase 4 (US2)**: Depends on Phase 3 complete (extends the streaming chat)
- **Phase 5 (US3)**: Depends on Phase 3 complete (wraps the message renderer); can run in parallel with Phase 4
- **Phase 6 (Polish)**: Depends on Phases 3, 4, 5 all complete

### User Story Dependencies

- **US1 (P1)**: Blocks US2 and US3 — SSE wiring must exist before tool events or markdown can be layered in
- **US2 (P2)**: Depends on US1 backend + frontend streaming being complete
- **US3 (P3)**: Depends only on US1 frontend — can be developed in parallel with US2

### Parallel Opportunities

- T002 and T006/T007 can run in parallel (different packages)
- T008 (backend service) and T010 (frontend page scaffold) can run in parallel within Phase 3
- T013 (ToolCallTrace component) can be built in parallel with T012 (backend tool call extension)
- T016 (ChatThread markdown wrapper) can be built in parallel with T012–T015 (US2 work)
- T018, T019, T020, T021 (polish) are all independent and can run in parallel

---

## Parallel Example: Phase 3 (US1)

```
# Backend and frontend scaffold can start together:
Task T008: Implement ChatService.streamChat() in chat.service.ts
Task T010: Create Chat.tsx page scaffold with AssistantRuntimeProvider

# Then wire them together:
Task T009: Implement controller POST /stream (depends on T008)
Task T011: Wire SSE into external store (depends on T009 + T010)
```

---

## Implementation Strategy

### MVP (Phase 1 + 2 + 3 only)

1. Complete Phase 1: Install packages, add shared types
2. Complete Phase 2: Module skeleton, routes wired
3. Complete Phase 3: Full streaming chat (US1)
4. **STOP and VALIDATE**: Open `/poc/:id/chat`, send a message, verify streaming works
5. Ship MVP — tool traces and markdown can follow

### Incremental Delivery

1. Phases 1–3 → streaming chat MVP
2. Phase 4 → add tool call visibility (US2)
3. Phase 5 → add markdown rendering (US3) — can be done in parallel with Phase 4
4. Phase 6 → polish and edge cases

### Total Tasks: 21

| Phase | Tasks | Parallelisable |
|---|---|---|
| Phase 1: Setup | T001–T003 | T002 |
| Phase 2: Foundational | T004–T007 | T006, T007 |
| Phase 3: US1 (P1) | T008–T011 | T008 + T010 |
| Phase 4: US2 (P2) | T012–T015 | T013 |
| Phase 5: US3 (P3) | T016–T017 | T016 (with Phase 4) |
| Phase 6: Polish | T018–T021 | T018, T019, T020, T021 |
