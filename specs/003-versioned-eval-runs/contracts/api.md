# API Contracts: Versioned Eval Runs with Failure Traces

All endpoints are prefixed with `/api`. Existing endpoints are extended additively; no breaking changes to response shapes.

---

## Existing Endpoints — Extended

### `GET /api/pocs/:id/evals/runs`

Response shape extended to include version and snapshot fields on each run summary:

```ts
// Each item in the array
EvalRunSummary {
  id: string
  runNumber: number                    // new: display as "Run #N"; 0 = legacy run
  status: 'pending' | 'running' | 'completed' | 'failed'
  totalCases: number
  passedCases: number
  failedCases: number
  startedAt: string                    // ISO 8601
  completedAt: string | null
  evalSuiteVersionId: string | null    // new: null = legacy run (no versioning)
  evalSuiteVersionNumber: number | null // new: display as "v1", "v2", etc.; null = "v?"
  snapshotModel: string                // new: "" = legacy run
  snapshotEndpointUrl: string          // new: "" = legacy run
}
```

---

### `GET /api/pocs/:id/evals/runs/:runId`

Response extended to include config snapshot and per-result pipeline traces:

```ts
EvalRunDetail {
  id: string
  runNumber: number
  status: string
  totalCases: number
  passedCases: number
  failedCases: number
  startedAt: string
  completedAt: string | null
  evalSuiteVersionId: string | null
  evalSuiteVersionNumber: number | null
  snapshotSystemPrompt: string         // new: full system prompt text at run time
  snapshotModel: string                // new
  snapshotEndpointUrl: string          // new
  results: EvalResultDetail[]
}

EvalResultDetail {
  caseId: string
  caseName: string
  status: 'pending' | 'running' | 'passed' | 'failed' | 'errored'
  score: number | null
  reasoning: string | null
  rawResponse: string | null
  latencyMs: number | null
  pipelineTrace: PipelineStep[] | null  // new: parsed from JSON; null if not captured
  errorDetail: string | null            // new: error message for 'errored' cases
  failureStep: 'wrong_tool' | 'wrong_arguments' | 'wrong_final_response' | null  // new
}

// Step shapes within pipelineTrace
type PipelineStep =
  | { role: 'user'; content: string }
  | { role: 'assistant'; content: string | null; toolCalls?: ToolCallStep[] }
  | { role: 'tool'; toolCallId: string; toolName: string; content: string };

type ToolCallStep = {
  id: string;
  name: string;
  arguments: string;  // JSON string of the arguments object as sent by the LLM
};
```

---

### SSE Event: `case-complete`

Payload extended (emitted during live run via `GET /api/pocs/:id/evals/run/:runId/stream`):

```ts
EvalCaseCompleteEvent {
  caseId: string
  caseName: string
  status: 'passed' | 'failed' | 'errored'
  score: number | null
  reasoning: string | null
  rawResponse: string | null
  latencyMs: number | null
  pipelineTrace: PipelineStep[] | null  // new
  failureStep: 'wrong_tool' | 'wrong_arguments' | 'wrong_final_response' | null  // new
}
```

---

## New Endpoints

### `GET /api/pocs/:id/evals/versions`

Returns all eval suite versions for the POC, newest first.

```ts
// Response: array
EvalSuiteVersionSummary {
  id: string
  versionNumber: number          // display as "v1", "v2", etc.
  casesSnapshot: EvalCaseSnapshot[]  // parsed from JSON
  createdAt: string              // ISO 8601
  runCount: number               // how many EvalRun rows reference this version
}

EvalCaseSnapshot {
  id: string
  name: string
  input: string          // JSON string (same format as EvalCase.input)
  judgeCriteria: string
  order: number
}
```

---

### `GET /api/pocs/:id/evals/compare?runA=:runAId&runB=:runBId`

Side-by-side case diff for two runs.

**Validation**:
- `400 Bad Request` if `runA` or `runB` don't belong to `pocId`.
- `400 Bad Request` if `runA.evalSuiteVersionId !== runB.evalSuiteVersionId`, with body:
  ```json
  { "error": "CROSS_VERSION_COMPARISON", "message": "Runs use different eval suite versions (v1 vs v2). Comparisons are only valid within the same version." }
  ```
- `400 Bad Request` if `runA === runB`.
- `404 Not Found` if either run doesn't exist.

```ts
// Response
CompareRunsResponse {
  runA: EvalRunSummary    // same shape as GET /runs list item
  runB: EvalRunSummary
  cases: RunComparisonCase[]
}

RunComparisonCase {
  caseId: string
  caseName: string
  runAStatus: 'passed' | 'failed' | 'errored' | 'not_executed'
  runBStatus: 'passed' | 'failed' | 'errored' | 'not_executed'
  change: 'improved' | 'regressed' | 'both_passed' | 'both_failed'
}
```

**`change` logic**:
| runAStatus | runBStatus | change |
|---|---|---|
| passed | passed | `both_passed` |
| failed / errored / not_executed | failed / errored / not_executed | `both_failed` |
| passed | failed / errored / not_executed | `regressed` |
| failed / errored / not_executed | passed | `improved` |

---

### `DELETE /api/pocs/:id/evals/runs/:runId`

Delete a run and all its results and traces.

```
Response: 204 No Content
```

- `404 Not Found` if the run doesn't exist or doesn't belong to `pocId`.
- Deletion cascades to all `EvalResult` rows for that run (handled by Prisma `onDelete: Cascade`).

---

## Judge Output Extension

The judge LLM is instructed to return an extended JSON object. The `JudgeVerdict` type in `judge.service.ts` is updated:

```ts
JudgeVerdict {
  passed: boolean
  score: number          // 0–10, clamped
  reasoning: string      // 1–3 sentences
  failureStep: 'wrong_tool' | 'wrong_arguments' | 'wrong_final_response' | null
  // null when passed === true, or when judge cannot attribute the failure to a specific step
}
```

The judge prompt receives:
1. The eval case input (existing)
2. The eval criteria (existing)
3. The agent's final response (existing)
4. **New**: the pipeline trace (tool calls and responses) as a JSON-formatted string
