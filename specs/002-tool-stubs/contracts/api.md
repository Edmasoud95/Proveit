# API Contracts: Tool Stubs & Test Data Generation

**Phase**: 1 | **Feature**: 002-tool-stubs | **Date**: 2026-05-26

## Existing Endpoints (extended)

### PATCH /api/pocs/:id

Already supports updating `tools`. With this feature, the tools array now accepts `mockResponse` on each tool. No contract change — existing consumers unaffected (field is optional).

**Request body** (relevant field):
```json
{
  "tools": [
    {
      "name": "search_knowledge_base",
      "description": "Search the knowledge base",
      "parameters": { "type": "object", "properties": { "query": { "type": "string" } } },
      "mockResponse": "{\"results\": [{\"id\": \"1\", \"title\": \"Getting Started\"}]}"
    }
  ]
}
```

**Response**: Updated `PocConfig` (same shape as `GET /api/pocs/:id`).

---

## New Endpoints

### POST /api/pocs/:id/tools/stubs/generate

Generate mock responses for all tools using the POC's connected LLM.

**Auth**: None (local-first)

**Request body**:
```json
{
  "overwrite": false
}
```

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `overwrite` | boolean | No | `false` | If false, only generate for tools with no existing mockResponse. If true, regenerate all. |

**Success response** `200 OK`:
```json
{
  "generated": ["search_knowledge_base", "create_ticket"],
  "skipped": ["send_email"],
  "failed": []
}
```

| Field | Description |
|-------|-------------|
| `generated` | Tool names that received new stubs |
| `skipped` | Tool names skipped because `overwrite: false` and stub existed |
| `failed` | Tool names where LLM generation failed |

**Error responses**:
- `400 Bad Request` — `{ "message": "No LLM connection configured" }`
- `400 Bad Request` — `{ "message": "No tools defined on this POC" }`
- `404 Not Found` — `{ "message": "POC not found" }`

**Side effect**: Updates `PocConfig.tools` in the database with generated stubs.

---

### POST /api/pocs/:id/evals/generate

**Existing endpoint** — extended with optional `toolFocused` param.

**Request body** (updated):
```json
{
  "count": 5,
  "toolFocused": true
}
```

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `count` | number | No | `5` | Number of eval cases to generate |
| `toolFocused` | boolean | No | `false` | If true, generate messages designed to trigger tool calls |

**Success response** `200 OK` (unchanged shape):
```json
{
  "cases": [
    {
      "id": "...",
      "pocConfigId": "...",
      "name": "Search for recent support tickets",
      "input": { "messages": [{ "role": "user", "content": "Find me the latest open tickets" }] },
      "judgeCriteria": "Agent should call search_knowledge_base with a relevant query",
      "order": 3,
      "createdAt": "..."
    }
  ]
}
```

**Notes**:
- Cases are **additive** — appended to existing eval cases, never replacing.
- When `toolFocused: true`, the system prompt to the LLM includes tool names and descriptions so generated inputs are likely to invoke tools.

---

## Eval Runner Changes (internal contract)

`callAgent` method signature changes (internal, not a public API change):

```ts
private async callAgent(
  client: OpenAI,
  model: string,
  systemPrompt: string,
  messages: unknown[],
  tools: ToolDefinition[],  // NEW param — includes mockResponse for stub lookup
): Promise<string>
```

**Tool result format** sent back to LLM:
```ts
{
  role: 'tool',
  tool_call_id: string,   // from the tool_call
  content: string,        // mockResponse value, or error JSON if tool unknown
}
```

**Unknown tool error content**:
```json
{ "error": "Tool 'unknown_tool' is not defined in this POC. Available tools: search_knowledge_base, create_ticket" }
```

**MAX_ITERATIONS**: 10 — if the tool loop exceeds this, case is marked `errored` with message "Tool call loop exceeded maximum iterations".
