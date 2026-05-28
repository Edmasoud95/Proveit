# Research: Eval Efficiency Metrics

## Insertion Points (from codebase exploration)

### Where to capture token usage

| Trigger | File | Method | Approach |
|---------|------|--------|----------|
| Agent API call (each loop iteration) | `eval/eval.service.ts` | `callAgent()` | Accumulate `response.usage.prompt_tokens`, `completion_tokens`, `total_tokens` across all iterations; return totals alongside the final response |
| Write to DB | `eval/eval.service.ts` | `executeRun()` | Add `promptTokens`, `completionTokens`, `totalTokens` to the `prisma.evalResult.update` call after agent completes |

### Where latencyMs is already measured

`latencyMs` on `EvalResult` is **already agent-only** — the timer bracket starts just before `callAgent()` and stops immediately after it returns, before the judge call. No changes needed to the timing logic.

The field is already stored in DB, returned in `getRun`, typed in shared types, and rendered in `EvalResultCard`. Token fields follow the same path.

### Aggregate metrics computation

**Decision**: Compute aggregates (avgLatencyMs, avgPromptTokens, efficiencyScore, etc.) on-demand in the `compareRuns()` service method by querying `EvalResult` rows for each run. Do not pre-store aggregates on `EvalRun`.

**Rationale**: Aggregates are cheap to compute at query time over a small result set (eval runs have tens to hundreds of cases). Pre-storing introduces a synchronization problem (must be recomputed whenever results change). The comparison view is the only place aggregates are needed in bulk; `listRuns` only needs accuracy (already stored as `passedCases/totalCases`).

**Alternatives considered**: Adding aggregate columns to `EvalRun` — rejected; more schema churn and can go stale. Separate `EvalRunSummary` table — rejected; overkill for simple math.

### Efficiency score formula

**Decision**: `efficiencyScore = accuracy / (avgLatencyMs / 1000)` where `accuracy ∈ [0, 1]`.

**Rationale**: This produces a score in units of "passed fraction per second of wait time" — directly interpretable as "how much quality do I get per second of latency?". A model that passes 90% of cases in 500ms scores 1.8; a model that passes 90% in 2000ms scores 0.45.

**Guard**: If `avgLatencyMs` is 0 or null, score is null. If `totalCases` is 0, score is null.

**Alternatives considered**: Composite weighted score with token cost factor — deferred; model cost data not available from the API. Geometric mean of accuracy and speed — rejected; harder to explain to users.

### Scatter chart library

**Decision**: Use `recharts` (user-specified requirement).

**Rationale**: User explicitly requested Recharts for the scatter chart. While this adds a dependency (Constitution Principle V), a hand-rolled SVG scatter chart with tooltips, axis labels, and responsive sizing would be significantly more complex to maintain. The exception is justified given explicit user direction and the non-trivial visualization requirement.

**Constitution note**: This is a deliberate override of Principle V (Minimal Dependencies). All other new npm packages remain prohibited.

**Recharts component**: `ScatterChart` with `Scatter`, `XAxis`, `YAxis`, `Tooltip`, `ResponsiveContainer`. Each data point is a run — x=avgLatencyMs, y=accuracy percentage, z (used for bubble label/size via custom dot) = efficiencyScore.

### Where to render EvalsEfficiencyPanel

**Decision**: Render at the top of `EvalResults.tsx`, above the run history list, always visible (not just in comparison mode). The scatter chart makes most sense as a persistent overview of all runs, not gated on selecting two for comparison.

**Rationale**: The chart's value is in comparing multiple runs at a glance. If it were only in the comparison view, it would show exactly two points — too limited. Showing all runs lets users spot trends across the model testing session.

### compareRuns API extension

**Decision**: Extend the existing `GET /pocs/:id/evals/compare?runA=x&runB=y` response to include a `runAMetrics` and `runBMetrics` object with all aggregates.

**Rationale**: The comparison page already fetches this endpoint. Adding the metrics to its response avoids adding new API calls. The `listRuns` endpoint additionally returns `avgLatencyMs` and `efficiencyScore` per run as lightweight computed fields to power the scatter chart without a per-run detail fetch.

**Alternative considered**: New `GET /pocs/:id/evals/runs/metrics` endpoint returning all runs with metrics — adopted for the scatter chart panel, since it needs all runs not just the two selected. This is a separate lightweight endpoint that returns just the aggregate fields (no case details).

### Token accumulation across multi-turn tool calls

The agent loop in `callAgent()` may call the OpenAI API multiple times (initial call + one call per tool-call round-trip). Each call returns `response.usage`. Token counts must be **summed** across all iterations (not just last response). Implementation: initialize `promptTokens = 0, completionTokens = 0, totalTokens = 0` before the loop; after each `client.chat.completions.create`, add `response.usage?.prompt_tokens ?? 0` etc.
