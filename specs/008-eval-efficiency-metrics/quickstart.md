# Quickstart: Eval Efficiency Metrics

## What Changes

1. **Token tracking** — every eval case now records prompt, completion, and total tokens used by the agent model. Legacy cases show "—".
2. **Efficiency metrics in comparison view** — selecting two runs for comparison shows a side-by-side metrics panel: Accuracy, Avg Agent Latency, Avg Token Usage (prompt / completion / total), and Efficiency Score.
3. **Efficiency scatter chart** — `EvalsEfficiencyPanel` at the top of the Eval Results page plots all completed runs as bubbles (x=latency, y=accuracy, size=efficiency score). Hover for details.
4. **Efficiency badge on run history rows** — each run card shows a compact `eff: 0.64` badge next to the pass rate.

## Implementation Checklist

### Backend

- [ ] Add `promptTokens Int?`, `completionTokens Int?`, `totalTokens Int?` to `EvalResult` in `packages/backend/prisma/schema.prisma`
- [ ] Write and apply migration SQL adding 3 nullable columns to `EvalResult`
- [ ] In `eval.service.ts` `callAgent()`: accumulate `response.usage` across all loop iterations; return `{ promptTokens, completionTokens, totalTokens }` alongside agent response
- [ ] In `eval.service.ts` `executeRun()`: write token fields to `prisma.evalResult.update`
- [ ] Add `computeRunMetrics(pocId, runId)` helper in `eval.service.ts` — queries `EvalResult` rows, computes all aggregates + efficiency score
- [ ] Extend `listRuns()` in `eval.service.ts` — call `computeRunMetrics` for each completed run; include `metrics` in response
- [ ] Extend `compareRuns()` in `eval.service.ts` — call `computeRunMetrics` for both runs; add `runAMetrics` + `runBMetrics` to response

### Shared Types

- [ ] Add `promptTokens?`, `completionTokens?`, `totalTokens?` to `EvalResult` interface
- [ ] Add `RunMetrics` interface
- [ ] Add `metrics?: RunMetrics` to `EvalRun` interface
- [ ] Add `runAMetrics: RunMetrics`, `runBMetrics: RunMetrics` to `CompareRunsResponse` interface
- [ ] Rebuild shared: `pnpm --filter shared build`

### Frontend

- [ ] Install `recharts` in frontend: `pnpm --filter frontend add recharts`
- [ ] Create `packages/frontend/src/components/eval/EvalsEfficiencyPanel.tsx` — `ScatterChart` with `ResponsiveContainer`, custom dot sized by efficiency score, tooltip showing model/accuracy/latency/tokens/score
- [ ] Create `packages/frontend/src/components/eval/RunMetricsPanel.tsx` — 2-column card showing all 4 metrics for a single run (reused in comparison view)
- [ ] Update `EvalResults.tsx` — render `<EvalsEfficiencyPanel runs={runs} />` above the run history list (only when ≥1 completed run exists)
- [ ] Update comparison section in `EvalResults.tsx` — render `<RunMetricsPanel>` for runA and runB side-by-side above the existing case comparison table

## Acceptance Test Flow

1. Run evals on a POC → open the run detail → each result card shows prompt/completion/total token counts
2. Open Eval Results page → scatter chart appears with one bubble per completed run
3. Hover a bubble → tooltip shows model name, accuracy, avg latency, avg tokens, efficiency score
4. Run evals again with a different model configured → second bubble appears; the faster/more accurate one is visually larger and further top-left
5. Select two runs for comparison → metrics panel appears above the case table with accuracy, latency, tokens, and efficiency score for each run
6. Open a legacy run (no token data) → comparison metrics show accuracy and latency; token fields show "—"; efficiency score shows if latency data exists
