# Data Model: POC Agent Chat UI

**Feature**: 005-poc-agent-chat
**Date**: 2026-05-27

> No new database tables are required. Chat history is session-only (in-memory React state). All persistent entities already exist in the schema.

---

## Frontend State Entities

These exist only in React component state and are not persisted.

### ChatMessage

Represents a single turn in the conversation.

| Field | Type | Notes |
|---|---|---|
| `id` | `string` | Unique per turn (generated client-side, e.g., `crypto.randomUUID()`) |
| `role` | `'user' \| 'assistant'` | Who authored the message |
| `content` | `string` | Text content (user messages or final assistant text) |
| `toolCalls` | `ToolCallTrace[]` | Inline tool invocations (assistant messages only, may be empty) |
| `status` | `'complete' \| 'streaming' \| 'error'` | Current delivery state |
| `createdAt` | `Date` | Client-side timestamp for ordering |

---

### ToolCallTrace

Represents one tool invocation made by the agent during a response.

| Field | Type | Notes |
|---|---|---|
| `id` | `string` | Tool call ID from the LLM response |
| `toolName` | `string` | Name of the tool invoked |
| `arguments` | `Record<string, unknown>` | Parsed JSON arguments passed to the tool |
| `result` | `string \| null` | Serialised tool response; `null` until the tool completes |
| `isExpanded` | `boolean` | UI state — collapsed by default |

---

## Existing Entities Used (read-only)

### PocConfig (existing)

The chat view reads these fields at mount time:

| Field | Used For |
|---|---|
| `systemPrompt` | Prepended to every chat request as the system message |
| `tools` | Sent with each request; tool stubs return mock responses |
| `llmConnections` / `taskModelOverrides` | Resolved via `LlmService.resolveForTask(pocId, 'agent')` to pick the active model |

No new columns added to `PocConfig`.

---

## Backend Streaming Events (SSE)

These are not persisted — they are transient SSE event payloads emitted during a chat stream.

### `text-delta`
```json
{ "type": "text-delta", "delta": "<token string>" }
```

### `tool-call-start`
```json
{ "type": "tool-call-start", "toolCallId": "...", "toolName": "..." }
```

### `tool-call-result`
```json
{ "type": "tool-call-result", "toolCallId": "...", "result": "<serialised string>" }
```

### `done`
```json
{ "type": "done" }
```

### `error`
```json
{ "type": "error", "message": "<error string>" }
```

---

## No Schema Migration Required

All persistent data lives in existing tables. The chat feature introduces no new Prisma models, no migrations, and no changes to existing columns.
