# Quickstart: Versioned Eval Runs with Failure Traces

## Prerequisites

- Node.js 20+ and pnpm installed
- At least one POC created with eval cases and a connected LLM

## Setup

### 1. Run the database migration

```bash
pnpm --filter backend db:migrate
```

This adds the `EvalSuiteVersion` table and the new columns on `EvalRun` and `EvalResult`. Existing data is unaffected — all new columns are nullable or have defaults.

### 2. Start dev servers

```bash
pnpm dev
```

Backend on `:3000`, frontend on `:5173`.

---

## What's New

### Eval suite versioning (automatic)

Every time you add, edit, or remove an eval case, a new version of the eval suite is created automatically — no action required. Versions are numbered v1, v2, v3... per POC. You'll see the current version label appear on any new run you start.

### Run history grouped by version

Open the **Evals** tab of any POC. Past runs are grouped under their eval suite version. Each group shows the pass rate trend for that version. Runs without a version (created before this feature) appear in a "Legacy runs" section.

### Pipeline traces for failed cases

Click on any failed case in a completed run to expand its pipeline trace:

```
▼ [FAILED]  "Book a flight from NYC to London"
  System prompt: "You are a travel agent assistant..."
  
  Step 1  search_flights
    Arguments: { "origin": "JFK", "destination": "LHR", "date": "2026-06-15" }
    Response:  { "flights": [...] }
  
  Step 2  book_flight                        ← FAILURE STEP: wrong_arguments
    Arguments: { "flightId": "UA102", "passengers": 1 }
    Response:  { "error": "passengers field must be >= 1" }
  
  Final response: "I was unable to complete your booking..."
  Judge: score 3/10 — "Agent passed wrong argument format to book_flight"
```

Traces are also streamed live during a run — you see each step as it happens.

### Compare two runs

Within a version group, tick the checkboxes on two runs and click **Compare**. You'll see a case-by-case diff:

| Case | Run #5 | Run #6 | Change |
|---|---|---|---|
| Book a flight | ✗ failed | ✓ passed | improved |
| Cancel booking | ✓ passed | ✗ failed | regressed |
| Check status | ✓ passed | ✓ passed | — |

Click any regressed case to jump straight to its trace in Run #6.

Comparing runs from different eval versions is blocked — the UI dims cross-version runs and explains why.

---

## Debugging

### Inspect raw traces in Prisma Studio

```bash
pnpm --filter backend db:studio
```

Open the `EvalResult` table. `pipelineTrace` contains the raw OpenAI messages JSON. `failureStep` shows the judge's attribution. `errorDetail` shows the error message for errored cases.

### Check eval suite versions

```bash
curl http://localhost:3000/api/pocs/<pocId>/evals/versions
```

### Run a comparison manually

```bash
curl "http://localhost:3000/api/pocs/<pocId>/evals/compare?runA=<runAId>&runB=<runBId>"
```

Returns `400` with `CROSS_VERSION_COMPARISON` if the runs are from different eval versions.
