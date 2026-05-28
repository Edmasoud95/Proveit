# Research: PoC Generation UX

**Feature**: 009-poc-generation-ux  
**Date**: 2026-05-28

---

## Decision 1: Split the single scaffold LLM call into 3 sequential calls

**Decision**: Restructure `ScaffoldService.scaffold()` to make three focused LLM calls in sequence: (1) name + system prompt, (2) tools, (3) eval cases.

**Rationale**: 
- The single-call approach cannot emit partial content — the entire JSON arrives at once, so no progressive preview is possible without this split.
- Three focused prompts produce better output per section (smaller context window per call, no "fill in all fields at once" pressure).
- Each call maps 1:1 to a named step, making the step progression semantically accurate rather than fake.
- The DB write happens only after all three succeed, meaning no orphan records on failure.

**Alternatives considered**:
- *Fake progress with single call*: Emit fabricated step events during the single LLM wait. Rejected — violates US2 (live content preview); the system prompt can't appear before tools if they're generated simultaneously.
- *Streaming JSON parse*: Stream the LLM response token-by-token and parse JSON fields as they arrive. Rejected — brittle (JSON streaming is order-dependent), adds complexity, and tools/eval-cases may not be separable without custom delimiters.
- *Parallel LLM calls*: Generate system prompt, tools, and eval cases concurrently. Rejected — tools should be informed by the system prompt; eval cases should be informed by both. Sequential is correct.

---

## Decision 2: 5 named steps

**Decision**: The scaffold pipeline has exactly 5 named steps with these identifiers and labels:

| Step ID | User-visible label | LLM call? |
|---|---|---|
| `analysing` | Analysing description | No — emitted immediately |
| `system-prompt` | Generating system prompt | Yes (call 1) |
| `tools` | Generating tools | Yes (call 2) |
| `eval-cases` | Generating eval cases | Yes (call 3) |
| `saving` | Saving configuration | No — DB write |

**Rationale**: Matches the spec assumption of "3–5 steps" exactly at 5. Each step maps to a real, meaningful unit of work. "Analysing description" fires immediately so the user sees activity before any LLM latency. "Saving configuration" acknowledges the DB write (which is visible enough to warrant a step).

**Alternatives considered**: Combining `saving` into `eval-cases` (4 steps). Rejected — the DB write occasionally has latency and the user would see no feedback during it.

---

## Decision 3: SSE job registry pattern (in-memory Map)

**Decision**: The scaffold async job registry uses the same pattern as the eval module:
- `POST /api/pocs/scaffold` returns `{ jobId }` immediately (UUID v4 generated in-process)
- A `Map<jobId, Subject<MessageEvent>>` in `ScaffoldService` holds the live event stream
- `GET /api/pocs/scaffold/stream/:jobId` subscribes to the Subject and returns it as SSE
- On `done` or `error`, the Subject completes and is removed from the Map

**Rationale**: Already proven in the codebase (eval run streaming). No new infrastructure. The in-memory approach is correct for single-user local tool.

**Alternatives considered**:
- *Redis pub/sub*: Overkill for a local single-user tool; adds a new dependency.
- *Server-Sent Events directly on POST*: The HTTP response body can't be kept open after the controller returns in NestJS without `@Sse()`; separating POST + GET is the idiomatic NestJS pattern.

---

## Decision 4: DB write only on full success; no partial saves

**Decision**: The `PocConfig` and `EvalCase` records are written to the database only after all three LLM calls succeed. If any step fails, no DB record is created.

**Rationale**: Prevents orphaned partial configs. Since the user always retries from the description, there's no value in preserving partial results. The SSE content preview (visible on the frontend before DB write) is sufficient for the user to see what was generated before a failure.

**Alternatives considered**: Save system prompt after step 1, tools after step 2, etc. Rejected — creates complex rollback logic and the user can't do anything with a partial config anyway.

---

## Decision 5: No new npm packages

**Decision**: Zero new dependencies. SSE uses NestJS `@Sse()` + `Observable<MessageEvent>` from RxJS (already `@nestjs/common` + `rxjs` in `package.json`). Frontend uses native `EventSource` API (same as eval streaming).

**Rationale**: Constitution principle V (Minimal Dependencies). Every dependency needed already exists in the project.

---

## Decision 6: Full-screen progress experience via dedicated route

**Decision**: After form submit, navigate to `/scaffold/:jobId` — a full-screen page owned by `ScaffoldingPage.tsx`. On `done`, navigate forward to `/poc/:id`. On retry, restart the job and stay on the `/scaffold` route with the description pre-filled.

**Rationale**: A 10–30s wait with animated steps feels more purposeful when it has the user's full attention. Competing with the POC list in a small card would make the experience feel incidental. The dedicated route also gives a clean back-button target and makes the error/retry state unambiguous — the entire screen is the error state, not a small box inside a larger page.

**Alternatives considered**: In-place replacement (hide form, show progress in same card on Home). Rejected — feels cramped, retry state is awkward, and the user has nowhere natural to look during the wait.

---

## Step Prompt Design

### Call 1 — System Prompt + Name
System: "You are an expert AI agent workflow designer. Given a workflow description, generate a concise name and a detailed system prompt for the agent. Respond with JSON: { name: string, systemPrompt: string }."  
User: "Workflow description: {description}"  
Temperature: 0.7

### Call 2 — Tools
System: "You are an expert AI agent workflow designer. Given a workflow description and an agent system prompt, design 3–7 tools the agent needs. Respond with JSON: { tools: Array<{ name, description, parameters: { type: 'object', properties: {...}, required: [...] }, mockResponse }> }."  
User: "Workflow description: {description}\n\nSystem prompt: {systemPrompt}"  
Temperature: 0.7

### Call 3 — Eval Cases
System: "You are an expert AI agent evaluator. Given a workflow description, system prompt, and tools, create exactly 5 diverse evaluation test cases. Respond with JSON: { evalCases: Array<{ name, input: { messages: [...] }, judgeCriteria }> }."  
User: "Workflow description: {description}\n\nSystem prompt: {systemPrompt}\n\nTools: {toolsJson}"  
Temperature: 0.7
