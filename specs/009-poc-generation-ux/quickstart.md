# Quickstart / Acceptance Test: PoC Generation UX

**Feature**: 009-poc-generation-ux  
**Date**: 2026-05-28

---

## Prerequisites

- `pnpm dev` running (backend :3000, frontend :5173)
- At least one LLM provider configured (either a global provider in Settings, or enter endpoint URL manually on the Home form)

---

## Scenario 1: Happy Path — Full Generation with Progress

1. Navigate to `http://localhost:5173`
2. Enter a description (≥10 chars), e.g., *"A customer support agent for a SaaS product that handles billing questions and ticket creation"*
3. Verify: submit button becomes disabled immediately on click (FR-008)
4. Verify: a progress section appears **before** any LLM response arrives showing step 1 ("Analysing description") as active (FR-001, SC-001, SC-004)
5. Watch: steps transition one by one — "Generating system prompt" → "Generating tools" → "Generating eval cases" → "Saving configuration"
6. Verify: each completed step shows a visual "done" state; the active step shows an animated in-progress indicator (FR-002, FR-003)
7. Verify: the generated system prompt appears in the preview pane **before** tools or eval cases are ready (FR-004, SC-002)
8. Verify: tools appear in preview after system prompt
9. Verify: eval cases appear in preview after tools
10. Verify: after "Saving configuration" completes, the app navigates directly to the new PoC editor without a blank screen or reload (FR-009)

**Expected result**: User is in the PoC editor with all generated content intact.

---

## Scenario 2: Slow Connection / Long-Running Step

1. Configure a slow or heavily loaded LLM endpoint
2. Submit the form and watch the active step
3. Verify: the in-progress step continues to show an animated indicator even after 5+ seconds (SC-004, US1 acceptance scenario 4)
4. Verify: no "Loading…" spinner replaces the step list during the wait

---

## Scenario 3: Failure Mid-Generation

To simulate a failure, temporarily set an invalid API key or disconnect the LLM.

1. Submit the form with an invalid/unreachable LLM endpoint
2. Verify: the failed step is highlighted with a clear error label (FR-006)
3. Verify: steps that completed before the failure remain marked as done (US3 acceptance scenario 1)
4. Verify: the error message is plain language — e.g., "Generating system prompt failed — could not reach the LLM endpoint. Please check your connection and retry." (FR-006)
5. Verify: the original description is still visible in the form (FR-005)
6. Verify: a "Retry" button is visible (FR-007, SC-003)
7. Click Retry
8. Verify: generation restarts from the beginning (all steps reset to waiting) with the same description pre-populated
9. Verify: the retry counts as ≤3 clicks from seeing the error (SC-003)

---

## Scenario 4: Duplicate Submission Prevention

1. Submit the form
2. While generation is in progress, attempt to submit again
3. Verify: the submit button is disabled; no second job is started (FR-008)

---

## Scenario 5: Unknown jobId (SSE Stream Request for Expired/Invalid Job)

1. Manually fetch `GET /api/pocs/scaffold/stream/nonexistent-job-id`
2. Verify: `404 Not Found` response

---

## Mobile Responsiveness

1. Open the page on a mobile viewport (or DevTools device emulation, 375px width)
2. Submit a description
3. Verify: the step list is readable — step labels are not truncated, icons are visible, preview pane is scrollable
