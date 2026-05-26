# Data Model: Tool Stubs & Test Data Generation

**Phase**: 1 | **Feature**: 002-tool-stubs | **Date**: 2026-05-26

## Entities

### ToolDefinition (extended)

Lives in `packages/shared/src/types.ts`. No Prisma migration — stored as JSON within `PocConfig.tools`.

```ts
export interface ToolDefinition {
  name: string;                    // unique within a POC, used for stub lookup
  description: string;
  parameters: Record<string, unknown>; // JSON Schema
  mockResponse?: string;           // NEW: JSON string returned to agent on tool call
}
```

**Validation rules**:
- `mockResponse` is optional; absent = no stub configured
- If present, must be valid JSON (validated on save; invalid JSON blocks save with inline error)
- Schema mismatch against `parameters` is advisory — does not block save

**Storage**: `JSON.stringify(tools)` → `PocConfig.tools` (String column). No migration required.

**Strip on LLM calls**: `mockResponse` must be excluded when building the `tools` array passed to the LLM API.

---

### PocConfig (existing, no schema change)

```prisma
model PocConfig {
  id           String   @id @default(uuid())
  tools        String   @default("[]")  // JSON: ToolDefinition[] — now includes mockResponse?
  // ... all other fields unchanged
}
```

No migration. The JSON string simply gains an optional field.

---

### EvalCase (existing, no schema change)

Generated test data follows the same format as manually created eval cases:

```ts
{
  name: string;          // e.g. "Search for recent tickets"
  input: EvalCaseInput;  // { messages: [{role: 'user', content: '...'}] }
  judgeCriteria: string; // criteria that checks tool was called appropriately
}
```

Generated cases are additive — appended to existing `evalCases` array.

---

## State Transitions

### ToolDefinition.mockResponse lifecycle

```
[absent] → user types JSON → [draft/invalid] → JSON valid → [saved]
                                    ↑                           ↓
                              validation error         "Generate stubs" overwrites
                                                       (with confirmation if already set)
```

### Eval Run with tools

```
callAgent invoked
  ↓
finish_reason === 'tool_calls'?
  ├─ yes → lookup stub by tool name
  │         ├─ found → push assistant msg + tool result → loop
  │         └─ not found → push error result → loop (case marked errored on MAX_ITERATIONS or if LLM re-requests)
  └─ no (stop) → return response text → judge scores
```

---

## Relationships

```
PocConfig (1) ──── (N) ToolDefinition   [in JSON array, tools field]
PocConfig (1) ──── (N) EvalCase         [relational, evalCases]
EvalCase  (1) ──── (N) EvalResult       [relational, results]
```

No new relational tables introduced by this feature.
