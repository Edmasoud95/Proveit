# API Contracts: PoC Generation UX

**Feature**: 009-poc-generation-ux  
**Date**: 2026-05-28

---

## Modified Endpoint: `POST /api/pocs/scaffold`

**Change**: Response shape changes from full `PocConfig` to a job handle. Scaffold now runs asynchronously.

### Request (unchanged)

```json
{
  "description": "A customer support agent that...",
  "endpointUrl": "http://localhost:1234/v1",
  "apiKey": "sk-...",
  "model": "gpt-4o",
  "globalProviderId": "<uuid>"
}
```
Fields: same as before. `endpointUrl` OR `globalProviderId` required.

### Response — 202 Accepted

```json
{
  "jobId": "f47ac10b-58cc-4372-a567-0e02b2c3d479"
}
```

### Error Responses (unchanged)
- `400 Bad Request` — missing endpointUrl / globalProviderId, description too short
- `404 Not Found` — globalProviderId references unknown provider

---

## New Endpoint: `GET /api/pocs/scaffold/stream/:jobId`

**Purpose**: SSE stream of scaffold step progress and generated content.  
**Returns**: `Content-Type: text/event-stream`

### SSE Event Types

All events are JSON-encoded in the `data` field:

```
data: {"type":"step-start","step":"analysing","index":0,"total":5}\n\n
data: {"type":"step-start","step":"system-prompt","index":1,"total":5}\n\n
data: {"type":"step-complete","step":"system-prompt","content":{"type":"system-prompt","name":"Customer Support Agent","systemPrompt":"You are a helpful customer support agent..."}}\n\n
data: {"type":"step-start","step":"tools","index":2,"total":5}\n\n
data: {"type":"step-complete","step":"tools","content":{"type":"tools","tools":[...]}}\n\n
data: {"type":"step-start","step":"eval-cases","index":3,"total":5}\n\n
data: {"type":"step-complete","step":"eval-cases","content":{"type":"eval-cases","evalCases":[...]}}\n\n
data: {"type":"step-start","step":"saving","index":4,"total":5}\n\n
data: {"type":"done","pocId":"abc-123"}\n\n
```

**On failure:**
```
data: {"type":"error","step":"tools","message":"The LLM returned invalid JSON. Please retry."}\n\n
```

### Event Schemas (TypeScript)

```typescript
type ScaffoldStep = 'analysing' | 'system-prompt' | 'tools' | 'eval-cases' | 'saving';

interface ScaffoldStepStartEvent {
  type: 'step-start';
  step: ScaffoldStep;
  index: number;   // 0-based
  total: number;   // always 5
}

interface ScaffoldPartialContent {
  type: 'system-prompt';
  name: string;
  systemPrompt: string;
}
// OR
interface ScaffoldToolsContent {
  type: 'tools';
  tools: ToolDefinition[];
}
// OR
interface ScaffoldEvalCasesContent {
  type: 'eval-cases';
  evalCases: Array<{ name: string; input: EvalCaseInput; judgeCriteria: string }>;
}

interface ScaffoldStepCompleteEvent {
  type: 'step-complete';
  step: ScaffoldStep;
  content?: ScaffoldPartialContent | ScaffoldToolsContent | ScaffoldEvalCasesContent;
}

interface ScaffoldDoneEvent {
  type: 'done';
  pocId: string;
}

interface ScaffoldErrorEvent {
  type: 'error';
  step: ScaffoldStep;
  message: string;  // plain-language, not raw stack trace
}

type ScaffoldStreamEvent =
  | ScaffoldStepStartEvent
  | ScaffoldStepCompleteEvent
  | ScaffoldDoneEvent
  | ScaffoldErrorEvent;
```

### Error Responses
- `404 Not Found` — jobId not in registry (expired or never existed)
- `410 Gone` — job already completed or failed (registry entry cleaned up)

---

## Frontend EventSource Usage

```typescript
const es = new EventSource(`/api/pocs/scaffold/stream/${jobId}`);
es.onmessage = (e) => {
  const event: ScaffoldStreamEvent = JSON.parse(e.data);
  // dispatch to reducer
};
es.onerror = () => {
  // show generic connection error
  es.close();
};
```

---

## Duplicate Submission Prevention

The frontend disables the submit button from the moment `POST /api/pocs/scaffold` is called until a `done` or `error` event is received (FR-008). The backend makes no attempt to deduplicate — it would create a second job for a second POST. The frontend guard is sufficient for the single-user case.
