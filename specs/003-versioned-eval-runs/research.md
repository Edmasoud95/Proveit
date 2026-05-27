# Research: Versioned Eval Runs with Failure Traces

## Codebase Findings

### Current eval run storage

`EvalRun` (Prisma) has no config snapshot fields — no `snapshotSystemPrompt`, `snapshotModel`, or `snapshotEndpointUrl`. A run has no record of which POC config was active at execution time.

`EvalResult` stores only `rawResponse` (final agent text), `score`, `reasoning`, and `latencyMs`. The full multi-turn message history — including intermediate tool calls — is discarded in `callAgent()` after the agent loop completes.

Errored cases (`status: 'errored'`) currently store nothing diagnostic — the catch block fires `prisma.evalResult.create({ data: { evalCaseId, runId, status: 'errored' } })` with all other fields null.

The judge returns `{ passed, score, reasoning }` only. No structured failure attribution.

### Current run history UI

Past runs are a flat reverse-chronological list. There is no version label, no grouping, no comparison mode. Runs are identified by timestamp alone.

---

## Decision 1: Pipeline Trace Storage

**Decision**: Serialize the full OpenAI `messages` array (the agent conversation history built during `callAgent()`) to JSON and store it in a new nullable `pipelineTrace: String?` column on `EvalResult`.

**Rationale**: The messages array is already in the exact format needed — it is an ordered sequence of `{role: 'user', content}`, `{role: 'assistant', tool_calls: [...]}`, `{role: 'tool', content: mock_response}`, and the final `{role: 'assistant', content: final_response}` entries. No transformation or new data structure is required. Storing as JSON string matches the existing codebase convention (`tools`, `metadata`, `input` all stored as JSON strings in Prisma). `callAgent()` needs one change: return `{ response, history }` instead of just the string response.

**Alternatives considered**:
- Separate `PipelineStep` table (one row per tool call): adds join complexity and a new Prisma model with no benefit at single-user local scale; rejected per Minimal Dependencies principle.
- Custom trace format: introduces a mapping layer with no value over the native OpenAI format; rejected.

---

## Decision 2: Failure Step Detection

**Decision**: Extend the judge LLM prompt to return a `failureStep` field in its existing JSON response: `'wrong_tool' | 'wrong_arguments' | 'wrong_final_response' | null`. The judge receives the pipeline trace (tool calls) alongside the final response for context.

**Rationale**: The judge already analyzes the agent response in a structured JSON mode. Passing it the tool call sequence and asking it to identify the failure step reuses the existing pattern with minimal change — one new field in the response schema, one extra context paragraph in the system prompt. No new service, no new dependency.

**Alternatives considered**:
- Programmatic heuristics (compare called tool names against expected): requires the eval case spec to define expected tool call sequences, which it currently does not; rejected.
- Separate post-hoc analysis pass: doubles LLM calls per case; rejected.

---

## Decision 3: Eval Suite Versioning

**Decision**: New `EvalSuiteVersion` Prisma model with `id`, `pocConfigId` (FK), `versionNumber` (Int, sequential per POC), `casesSnapshot` (JSON string — full `EvalCase[]` array), `createdAt`. A new version row is created in `EvalService` after every successful `createEvalCase`, `updateEvalCase`, or `deleteEvalCase` call via a shared `createEvalSuiteVersion(pocConfigId)` helper that:
1. Fetches all current eval cases for the POC
2. Reads the current max `versionNumber` for this POC (or 0 if none)
3. Creates a new version row with `versionNumber + 1` and the serialized cases

**Rationale**: The trigger is in-service (no DB triggers), simple, and consistent with how Prisma is used throughout the codebase. The per-POC sequential integer satisfies the spec's "v1, v2, v3" display requirement with a single `findFirst({ orderBy: { versionNumber: 'desc' } })` query.

**Alternatives considered**:
- Database triggers: not cleanly supported by Prisma/SQLite without raw SQL; rejected.
- Timestamp-based versioning (e.g. `20260526-143022`): not user-friendly to display; rejected.
- Event-driven approach (NestJS EventEmitter): adds indirection without benefit at this scale; rejected.

---

## Decision 4: Config Snapshot on EvalRun

**Decision**: At run start (in `startRun()`), add three new columns to `EvalRun`:
- `snapshotSystemPrompt: String @default("")`
- `snapshotModel: String @default("")`
- `snapshotEndpointUrl: String @default("")`

Capture from `PocConfig.systemPrompt`, `LlmConnection.modelName` (or `model`), and `LlmConnection.endpointUrl`. Never capture `apiKey`.

**Rationale**: Run start is the precise moment the config is "locked in". The `PocConfig` with its `LlmConnection` is already loaded in `startRun()` to retrieve connection details — no additional query needed. Flat columns on `EvalRun` avoid a join, consistent with the codebase pattern.

**Alternatives considered**:
- Separate `PocConfigSnapshot` table: adds a join for every run detail query without benefit; rejected.
- Storing a full JSON snapshot of the entire PocConfig: exposes tool stubs and other internal config detail in a hard-to-query blob; rejected in favour of the three targeted fields.

---

## Decision 5: Run Number

**Decision**: Add `runNumber: Int` to `EvalRun`, auto-assigned as `(current max runNumber for this POC) + 1` at run creation time. Display as "Run #N" in the UI.

**Rationale**: Gives users a short, stable identifier to reference a run in conversation ("Run #7 failed"). Distinct from eval suite version number — multiple runs can share the same version. Assigned with the same per-entity max+1 pattern used for `versionNumber`.

---

## Decision 6: Cross-Version Comparison Enforcement

**Decision**: Enforced at two layers:
1. **Frontend**: when the user selects a run for comparison, only runs with the same `evalSuiteVersionId` are enabled; others are visually dimmed with a tooltip.
2. **Backend**: the `/compare` endpoint validates `runA.evalSuiteVersionId === runB.evalSuiteVersionId` and returns `400 Bad Request` with a descriptive message if not.

**Rationale**: Frontend-only enforcement is fragile (bypassed by direct API calls). Backend validation makes the API contract clean and testable. Both layers together satisfy the spec's "can never accidentally compare" requirement.

---

## Decision 7: Side-by-Side Comparison Endpoint

**Decision**: New `GET /api/pocs/:id/evals/compare?runA=:runAId&runB=:runBId` endpoint. Returns: `{ runA: EvalRunSummary, runB: EvalRunSummary, cases: RunComparisonCase[] }` where each case has `{ caseId, caseName, runAStatus, runBStatus, change: 'improved' | 'regressed' | 'both_passed' | 'both_failed' }`.

**Change logic**:
- `improved`: runA was failed/errored, runB passed
- `regressed`: runA passed, runB failed/errored
- `both_passed`: both passed
- `both_failed`: both failed or errored

Cases present in one run's snapshot but not the other (edge case from interrupted runs) are included with the missing status shown as `'not_executed'`.

**Rationale**: A dedicated read endpoint keeps the frontend logic simple, makes the diff cacheable (React Query), and isolates the validation logic. No new data is written — this is a pure projection of two existing run queries.
