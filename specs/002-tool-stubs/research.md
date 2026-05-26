# Research: Tool Stubs & Test Data Generation

**Phase**: 0 | **Feature**: 002-tool-stubs | **Date**: 2026-05-26

## 1. Storage Strategy for mockResponse

**Decision**: Extend the `ToolDefinition` JSON shape with an optional `mockResponse` field. No Prisma migration required.

**Rationale**: `PocConfig.tools` is already stored as a JSON string (`String @default("[]")`). Adding a field to the TypeScript `ToolDefinition` interface automatically flows through without any schema change. The existing `PATCH /api/pocs/:id` endpoint already accepts a `tools` array and stringifies it — so saving stubs is free.

**Alternatives considered**:
- Separate `ToolStub` Prisma model — rejected (over-engineered; stubs are tightly coupled to tool definitions and belong in the same JSON blob).
- SQLite JSON column with schema migration — rejected (unnecessary given tools already in JSON string).

---

## 2. Tool-Calling Loop in OpenAI SDK

**Decision**: Rewrite `callAgent` to handle the `tool_calls` → stub-response loop with a MAX_ITERATIONS guard of 10.

**Rationale**: The current `callAgent` ignores tools entirely. When an LLM has tools available it may return `finish_reason === 'tool_calls'` instead of `'stop'`. The SDK shape is:

```ts
// Assistant message with tool_calls
{
  role: 'assistant',
  content: null | string,
  tool_calls: [{
    id: string,           // e.g. "call_abc123"
    type: 'function',
    function: {
      name: string,       // must match a ToolDefinition.name
      arguments: string,  // JSON-encoded string — always parse with try/catch
    }
  }]
}
```

Loop protocol (order is critical — API returns 400 if violated):
1. Send messages to LLM
2. If `finish_reason === 'tool_calls'`:
   a. Push the full assistant message (with `tool_calls`) to history
   b. For each `tool_call`, look up stub by name → push `{ role: 'tool', tool_call_id, content: stubJson }`
   c. If tool not found → push error content and mark case as failed
   d. Repeat from step 1 (up to MAX_ITERATIONS)
3. If `finish_reason === 'stop'` → return `message.content`

**Critical gotcha**: The assistant message MUST be pushed before any tool result messages. Sending tool results without the preceding assistant message causes a 400 from the API.

**`function.arguments`**: Always a JSON string. Must `JSON.parse()` with try/catch — some models return malformed JSON.

**Tools shape passed to API**:
```ts
tools: tools.map(t => ({
  type: 'function',
  function: {
    name: t.name,
    description: t.description,
    parameters: t.parameters,
  }
}))
```
The `mockResponse` field must NOT be sent to the LLM — strip it before building the tools array.

---

## 3. LLM Stub Generation Prompt Strategy

**Decision**: Single LLM call with all tool definitions in one prompt, returning a JSON object mapping tool names to mock responses.

**Rationale**: Minimizes API calls and latency. The LLM has full context of all tools simultaneously, producing more coherent stubs. Expected response format:

```json
{
  "tool_name_1": { ...realistic mock response... },
  "tool_name_2": { ...realistic mock response... }
}
```

**Prompt inputs**: tool name, description, parameter schema. The LLM should infer realistic domain-appropriate values.

**Partial failure handling**: Iterate over returned keys; only update tools where a value was returned. Tools with no matching key retain their existing stub (or stay empty).

---

## 4. LLM Test Data Generation Prompt Strategy

**Decision**: Extend the existing `generateCases` flow rather than duplicating it. Add a `toolFocused: boolean` option that changes the system prompt to emphasise generating messages likely to trigger tool calls.

**Rationale**: The existing `POST /api/pocs/:id/evals/generate` (count param) calls `EvalService.generateCases`. Changing the prompt to include tool names and descriptions steers the LLM toward tool-exercising scenarios. Generated cases follow the same `EvalCase` shape and are additive (appended, not replacing).

**Alternatives considered**:
- Separate `generate-tool-data` endpoint — cleaner API surface but duplicates code. Rejected in favour of the `toolFocused` flag approach, which keeps the generation path unified.

---

## 5. Frontend UI Approach

**Decision**: Add a collapsible mock response section per tool in the existing Tools tab of PocEditor. Use a JSON textarea with inline validation feedback.

**Rationale**: Consistent with "progressive disclosure" principle — stub field is collapsed by default, expanded on click. No new route or page needed. Status indicator (filled dot / empty dot) on each tool row visible at a glance (FR-009).

**Generate stubs button**: Placed in the Tools tab header area, alongside the existing "Add tool" affordance.

**Generate test data button**: Placed in the Eval Cases tab header, alongside existing "Generate evals" button.

---

## 6. Unknown Tool Handling (FR-008)

**Decision**: When `callAgent` receives a `tool_calls` request for a tool name not in the POC's tool list, push an error tool result and throw after the loop, marking the eval case `errored`.

**Content returned**: `JSON.stringify({ error: "Tool '${name}' is not defined in this POC" })` as the tool result content, so the LLM can read it. The loop then continues — if the LLM proceeds to answer, the case still completes; if it loops on the missing tool, MAX_ITERATIONS terminates it.
