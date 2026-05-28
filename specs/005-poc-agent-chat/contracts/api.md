# API Contracts: POC Agent Chat UI

**Feature**: 005-poc-agent-chat
**Date**: 2026-05-27

---

## New Endpoint: POST /api/pocs/:id/chat/stream

Starts a streaming chat response from the POC agent. Returns an SSE stream.

### Request

```
POST /api/pocs/:id/chat/stream
Content-Type: application/json
```

```json
{
  "messages": [
    { "role": "user", "content": "Hello, what can you do?" },
    { "role": "assistant", "content": "I can help with..." },
    { "role": "user", "content": "Can you call the search tool?" }
  ]
}
```

| Field | Type | Required | Notes |
|---|---|---|---|
| `messages` | `ChatMessage[]` | Yes | Full conversation history. System prompt is injected by the backend from the POC config. |
| `messages[].role` | `'user' \| 'assistant'` | Yes | Message author |
| `messages[].content` | `string` | Yes | Message text |

### Response

`Content-Type: text/event-stream`

The response is a server-sent event stream. Each line is a JSON-encoded event. The client reads events until `type: "done"` or the connection closes.

#### Event: `text-delta`
Emitted for each streamed text token from the LLM.

```
data: {"type":"text-delta","delta":"Hello"}
```

#### Event: `tool-call-start`
Emitted when the LLM begins a tool invocation.

```
data: {"type":"tool-call-start","toolCallId":"call_abc123","toolName":"search"}
```

#### Event: `tool-call-result`
Emitted after the tool mock/stub returns a result.

```
data: {"type":"tool-call-result","toolCallId":"call_abc123","result":"{\"items\":[]}"}
```

#### Event: `done`
Emitted when the full response (including all tool calls) is complete.

```
data: {"type":"done"}
```

#### Event: `error`
Emitted if the LLM call fails or the POC config is invalid.

```
data: {"type":"error","message":"LLM provider unreachable"}
```

### Error Responses (HTTP)

| Status | Condition |
|---|---|
| `404` | POC config not found for `:id` |
| `400` | Missing or malformed `messages` array |
| `503` | No active LLM provider configured for this POC |

---

## Existing Endpoints Used (unchanged)

| Endpoint | Used For |
|---|---|
| `GET /api/pocs/:id` | Load POC name and system prompt for the chat page header |
| `GET /api/pocs/:id/llm/routing` | Display the active model in the RunConfig panel (reuse existing component) |

No existing endpoints are modified.

---

## Shared Types (packages/shared)

New types to add to `packages/shared/src/types.ts`:

```typescript
export interface ChatMessageInput {
  role: 'user' | 'assistant';
  content: string;
}

export interface ChatStreamTextDelta {
  type: 'text-delta';
  delta: string;
}

export interface ChatStreamToolCallStart {
  type: 'tool-call-start';
  toolCallId: string;
  toolName: string;
}

export interface ChatStreamToolCallResult {
  type: 'tool-call-result';
  toolCallId: string;
  result: string;
}

export interface ChatStreamDone {
  type: 'done';
}

export interface ChatStreamError {
  type: 'error';
  message: string;
}

export type ChatStreamEvent =
  | ChatStreamTextDelta
  | ChatStreamToolCallStart
  | ChatStreamToolCallResult
  | ChatStreamDone
  | ChatStreamError;
```
