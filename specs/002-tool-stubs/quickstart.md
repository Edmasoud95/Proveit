# Quickstart: Tool Stubs & Test Data Generation

**Phase**: 1 | **Feature**: 002-tool-stubs | **Date**: 2026-05-26

## Happy Path: Manual Stub + Eval Run

**Precondition**: POC exists with at least one tool; LLM connected.

1. Open POC → Tools tab
2. Expand a tool row → mock response field appears (JSON textarea)
3. Enter a valid JSON stub value, e.g. `{"results": [{"id": "1", "title": "Q1 Report"}]}`
4. Save — stub indicator on tool row turns green (filled)
5. Navigate to Eval Cases → run an eval
6. Agent receives the stub value when it calls that tool → completes its reasoning → eval scores

---

## Happy Path: LLM-Generated Stubs

**Precondition**: POC with tools; LLM connected; no existing stubs.

1. Open POC → Tools tab
2. Click "Generate stubs" button
3. Loading indicator shown; within 30s all tools receive generated mock responses
4. Stubs are editable — user can tweak before saving
5. Run evals as above

**Overwrite existing stubs**:
1. Click "Generate stubs" when stubs already exist
2. Confirmation dialog: "X tools already have stubs. Regenerate all?" → Yes / No
3. If "Yes": all stubs replaced. If "No": only empty tools are filled.

---

## Happy Path: LLM-Generated Test Data

**Precondition**: POC with tools and stubs configured; LLM connected.

1. Open POC → Eval Cases tab
2. Click "Generate test data" (generates tool-focused eval cases)
3. N new cases appended to the existing list
4. Each case has a user message likely to trigger a tool call
5. Run evals — at least 80% of generated cases should result in a tool call

---

## Edge Cases

### Invalid JSON in mock response field
- User types `{broken json`
- Inline error displayed: "Invalid JSON — please fix before saving"
- Save button disabled until corrected

### Tool called but no stub configured
- Eval runs → agent calls a tool with no `mockResponse`
- System returns: `{"error": "No stub configured for tool 'search_knowledge_base'. Set a mock response in the Tools tab."}`
- Eval case marked `errored` with that message in reasoning

### Unknown tool called
- Agent calls a tool name not in the POC definition
- System returns error content (see contracts/api.md)
- Eval case marked `errored`

### LLM stub generation partial failure
- 2 of 3 tools receive stubs; 1 fails (LLM returned no entry for it)
- Response: `{ "generated": ["tool_a", "tool_b"], "skipped": [], "failed": ["tool_c"] }`
- UI shows: "2 stubs generated, 1 failed (tool_c)" — user can retry individually

### No LLM connected
- User clicks "Generate stubs" or "Generate test data"
- Error toast: "Connect an LLM before generating stubs"
- No action taken

### Multiple tool calls in one turn
- Agent calls `search_knowledge_base` AND `create_ticket` in a single assistant message
- Both stubs returned in the same loop iteration (one `role: 'tool'` message per call)
- Both stubs must be present or the loop returns error content for the missing ones

---

## Integration Scenarios

### Scenario: Eval with 2-step tool chain
1. User message: "Find the most recent ticket and update its status to resolved"
2. Agent calls `search_knowledge_base` → receives stub with ticket list
3. Agent calls `update_ticket` with ticket ID from stub → receives success stub
4. Agent responds with summary
5. Judge evaluates: did agent complete the 2-step chain?

### Scenario: Regenerate stubs after tool schema change
1. User updates a tool's parameter schema
2. Existing stub may be outdated — stub indicator shows warning (advisory)
3. User clicks "Generate stubs" with `overwrite: true` to refresh

### Scenario: Test data generation count
1. User requests 5 test cases via `POST /api/pocs/:id/evals/generate` with `{ count: 5, toolFocused: true }`
2. If LLM returns only 3 valid cases, response includes 3 cases + note: "3 of 5 requested cases generated"
3. User is informed; can request more
