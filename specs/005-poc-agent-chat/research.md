# Research: POC Agent Chat UI

**Feature**: 005-poc-agent-chat
**Date**: 2026-05-27

---

## Decision 1: assistant-ui Runtime Adapter

**Decision**: Use `useExternalStoreRuntime` rather than `useDataStreamRuntime`.

**Rationale**: Proveit already has a well-established NestJS SSE streaming pattern (`ReplaySubject` + `@Sse()`) used by the eval runner. Adopting `useDataStreamRuntime` would require implementing the `ui-message-stream` binary protocol on the backend — a new serialisation format on top of existing infrastructure. `useExternalStoreRuntime` lets us own the message state in React, call our own NestJS endpoint with the existing SSE protocol, and sync messages into assistant-ui's store. This avoids a protocol translation layer and keeps the backend consistent.

**Alternatives considered**:
- `useDataStreamRuntime`: Simpler frontend wiring, but requires the backend to speak the `ui-message-stream` event protocol (different from the existing SSE event shapes). Rejected: unnecessary backend rewrite.
- `useLocalRuntime`: Calls LLM directly from browser. Rejected: constitution prohibits frontend calling LLMs directly.

---

## Decision 2: Backend Endpoint Shape

**Decision**: New `POST /api/pocs/:id/chat/stream` endpoint in a dedicated `ChatModule`. Streams via NestJS `@Sse()` + `Observable<MessageEvent>` (same pattern as eval runner). Events emitted: `text-delta` (token), `tool-call-start`, `tool-call-delta`, `tool-call-result`, `done`.

**Rationale**: Reusing the existing SSE infrastructure is consistent with the codebase. The POC config (system prompt + tools) is already accessible via `PocService`. The agent call can reuse `LlmService.resolveForTask(pocId, 'agent')` and the existing OpenAI SDK streaming call pattern.

**Alternatives considered**:
- Reusing eval endpoints: Eval runs are batch-scoped and tied to `EvalRun` records. Chat is interactive, stateless, and session-scoped. Sharing an endpoint would couple unrelated concerns.
- WebSocket: More complex, no advantage for unidirectional streaming. Rejected.

---

## Decision 3: Markdown Rendering Package

**Decision**: `@assistant-ui/react-markdown` for markdown rendering within assistant-ui message components.

**Rationale**: Official assistant-ui integration package; handles streaming partial markdown gracefully (no flickering during token arrival). Works as a drop-in `MarkdownText` component inside assistant-ui's `AssistantMessage` content area.

**Alternatives considered**:
- `react-markdown` standalone: Would require custom wiring outside assistant-ui's component model. Rejected: unnecessary integration work.
- `@assistant-ui/react-streamdown`: More features (KaTeX, Mermaid) but heavier. Not needed for this use case.

---

## Decision 4: Tool Call Rendering

**Decision**: Custom collapsible `ToolCallUI` component registered via assistant-ui's `makeAssistantToolUI` (or the `Tools` API). Each tool call renders as a collapsible `<details>` element showing: tool name (always visible), arguments JSON (collapsible), and result JSON (collapsible).

**Rationale**: assistant-ui supports custom per-tool UI components registered at the runtime level. This matches the spec requirement: "collapsible trace items shown inline." The POC tool list is known at render time, so we can register a generic fallback renderer that works for any tool without per-tool configuration.

**Alternatives considered**:
- Hiding tool calls entirely: Rejected — tool visibility is a P2 user story.
- Full custom rendering outside assistant-ui: More work, loses streaming state integration.

---

## Decision 5: Session Persistence

**Decision**: No server-side persistence. Chat history lives in React state for the duration of the session. On page reload or navigation away, history is lost.

**Rationale**: Matches spec assumption. Proveit is a POC testing tool, not a customer-facing product. Conversation history persistence would require a new `ChatMessage` table, CRUD endpoints, and UI for thread management — scope creep for v1.

**Alternatives considered**:
- SQLite-persisted threads: Feasible but out of scope per spec. Can be added as `006-chat-persistence`.

---

## Required Packages (new additions)

| Package | Purpose |
|---|---|
| `@assistant-ui/react` | Core runtime provider, Thread, Composer, Message components |
| `@assistant-ui/react-markdown` | Markdown rendering inside message components |

No other new packages required. The existing `openai` SDK, `rxjs`, and `@nestjs/common` cover the backend.

---

## Constitution Alignment

**Principle V (Minimal Dependencies)**: Two new packages added (`@assistant-ui/react`, `@assistant-ui/react-markdown`). Justified: building equivalent streaming chat + markdown + tool call rendering from scratch would add ~500 lines of complex React state management. The packages are well-maintained, tree-shakeable, and MIT-licensed. User explicitly mandated this library.

**Principle VI (UI/UX First)**: assistant-ui is purpose-built for chat UX — streaming cursors, message threading, accessible input. Aligns directly.

**All other principles**: No conflicts.
