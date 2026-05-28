# API Contracts: Eval Efficiency Metrics

## Modified: `GET /api/pocs/:pocId/evals/runs` (list runs)

Each run in the response now includes a computed `metrics` object.

**Response shape (per run)**:
```json
{
  "id": "run-uuid",
  "runNumber": 3,
  "status": "completed",
  "totalCases": 10,
  "passedCases": 8,
  "failedCases": 2,
  "snapshotModel": "gpt-4o-mini",
  "startedAt": "2026-05-28T10:00:00Z",
  "completedAt": "2026-05-28T10:01:30Z",
  "metrics": {
    "accuracy": 0.8,
    "avgLatencyMs": 1240,
    "avgPromptTokens": 320,
    "avgCompletionTokens": 88,
    "avgTotalTokens": 408,
    "efficiencyScore": 0.645
  }
}
```

`metrics` is `null` if the run is not yet `completed` or has 0 cases.
Metric fields are `null` if no data is available (e.g., legacy run with no `latencyMs`).

---

## Modified: `GET /api/pocs/:pocId/evals/compare?runA=:idA&runB=:idB`

Response extended with `runAMetrics` and `runBMetrics`.

**Response shape**:
```json
{
  "runA": { ...existing EvalRun summary... },
  "runB": { ...existing EvalRun summary... },
  "runAMetrics": {
    "accuracy": 0.8,
    "avgLatencyMs": 1240,
    "avgPromptTokens": 320,
    "avgCompletionTokens": 88,
    "avgTotalTokens": 408,
    "efficiencyScore": 0.645
  },
  "runBMetrics": {
    "accuracy": 0.9,
    "avgLatencyMs": 2800,
    "avgPromptTokens": 560,
    "avgCompletionTokens": 140,
    "avgTotalTokens": 700,
    "efficiencyScore": 0.321
  },
  "cases": [ ...existing case comparison array... ]
}
```

---

## No New Endpoints

The scatter chart panel (`EvalsEfficiencyPanel`) reads from the existing `listRuns` response (now enriched with `metrics`). No new endpoints are required.
