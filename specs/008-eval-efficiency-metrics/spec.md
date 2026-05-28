# Feature Specification: Eval Efficiency Metrics

**Feature Branch**: `008-eval-efficiency-metrics`  
**Created**: 2026-05-28  
**Status**: Draft  

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Efficiency Metrics in Run Comparison (Priority: P1)

A user runs evals against two different models and opens the comparison view. They can now see four aggregate metrics side-by-side for each run: how many tests passed (accuracy), how fast the agent responded on average (latency), how many tokens were consumed on average (token usage), and a single efficiency score that combines speed and accuracy. This lets them answer "which model is the best balance of quality and cost?" in seconds rather than mentally reconciling raw numbers.

**Why this priority**: The comparison view is the primary decision-making surface. Showing efficiency data here gives every user the benefit immediately with no new navigation required.

**Independent Test**: Can be fully tested by running two eval runs, opening the comparison view, and verifying all four metric panels appear with correct values for each run.

**Acceptance Scenarios**:

1. **Given** two completed eval runs selected for comparison, **When** the comparison page loads, **Then** each run displays its Accuracy (e.g., "7/10 passed"), average Agent Latency in ms, average Token Usage (prompt / completion / total), and Efficiency Score as a numeric value.
2. **Given** a run where all cases passed and agent responses were fast, **When** I view the Efficiency Score, **Then** the score is higher than a run with identical pass rate but slower responses.
3. **Given** a run where no token usage data was recorded (legacy run), **When** I view its metrics, **Then** accuracy and latency display correctly and token usage shows "—" or "No data".

---

### User Story 2 — Efficiency Scatter Chart (Priority: P1)

A user wants to visually compare multiple runs to find the sweet spot of accuracy and speed. An Efficiency Panel on the Eval Results page shows a scatter chart where each run is plotted as a bubble: x-axis = average agent latency, y-axis = accuracy, bubble size = efficiency score. Runs that are both fast and accurate appear in the top-left as large bubbles, making the best-performing model configuration immediately obvious at a glance.

**Why this priority**: The scatter chart is the primary visual artifact explicitly requested by the user and the key differentiation from simple pass/fail comparison. It converts numeric metrics into an immediately interpretable visual.

**Independent Test**: Can be fully tested by having at least two completed runs and opening the Eval Results page — the scatter chart renders with one bubble per run, axes correctly labeled, hover tooltip showing run details.

**Acceptance Scenarios**:

1. **Given** three or more completed eval runs, **When** I open the Eval Results page, **Then** the Efficiency Panel displays a scatter chart with one bubble per run, x-axis labeled "Avg Agent Latency (ms)", y-axis labeled "Accuracy (%)", and bubble size proportional to efficiency score.
2. **Given** I hover over a bubble, **Then** a tooltip shows: run model name, accuracy, avg latency, avg total tokens, and efficiency score.
3. **Given** only one completed run exists, **When** I view the Efficiency Panel, **Then** a single bubble is plotted and a note indicates "Add more runs to compare models".
4. **Given** a run with no latency data, **When** the chart renders, **Then** that run is omitted from the chart and a note explains why.

---

### User Story 3 — Per-Run Efficiency Summary on Run History List (Priority: P2)

Each row in the eval run history list shows a compact efficiency badge — the efficiency score and accuracy — so users can scan past runs and spot the best-performing configurations without opening the comparison view.

**Why this priority**: Secondary to the comparison view; adds scan-ability but is not blocking for the core use case.

**Independent Test**: Can be fully tested by viewing the run history list and confirming each row with data shows a compact efficiency score badge.

**Acceptance Scenarios**:

1. **Given** completed eval runs in the history list, **When** I view the list, **Then** each run row shows a compact badge with its efficiency score and accuracy percentage.
2. **Given** a legacy run without token/latency data, **When** I view the history list, **Then** the badge shows only accuracy; latency and efficiency are omitted or shown as "—".

---

### Edge Cases

- What happens when a run has 0 cases? Efficiency score should not be computed (division by zero guard); display "No cases".
- What if avg_response_time_ms is 0? Efficiency score is undefined; display "—" rather than infinity.
- How does the system handle runs completed before this feature was deployed (no agent latency or token data)? Display available metrics (accuracy still computable), gracefully omit the rest.
- What if all cases in a run failed (accuracy = 0)? Efficiency score = 0; bubble appears on x-axis at y=0.
- What if latency values are extremely large (timeout scenario)? Chart axes auto-scale; no clamping needed.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST record the agent response time (from request sent to response received) separately from the total case evaluation time, which also includes the judge model call, for every eval case result.
- **FR-002**: The system MUST record token usage per eval case result, capturing prompt tokens, completion tokens, and total tokens consumed by the agent model response.
- **FR-003**: The system MUST compute per-run aggregate metrics from stored case results: Accuracy (cases passed / total cases), average Agent Latency in milliseconds, average prompt tokens, average completion tokens, average total tokens.
- **FR-004**: The system MUST compute an Efficiency Score per run defined as: `accuracy / (avg_agent_response_time_ms / 1000)`, where accuracy is a value between 0 and 1.
- **FR-005**: The comparison view MUST display all four aggregate metrics (Accuracy, Token Usage, Latency, Efficiency Score) for each selected run side-by-side.
- **FR-006**: The Eval Results page MUST include an Efficiency Panel that renders a scatter chart with one data point per completed run, x-axis = average agent latency, y-axis = accuracy percentage, bubble size proportional to efficiency score.
- **FR-007**: Hovering over a bubble in the scatter chart MUST show a tooltip with: model name, accuracy, avg agent latency, avg total tokens, and efficiency score.
- **FR-008**: The system MUST handle missing data gracefully — runs without agent latency or token data MUST display available metrics and show "—" for unavailable ones; such runs MUST be omitted from the scatter chart.
- **FR-009**: All latency and token measurements MUST be captured at the time of the eval run; they MUST NOT be recomputed from external sources after the fact.

### Key Entities

- **EvalCaseResult**: Stores per-case outcome including pass/fail, score, agent response latency (agent call only), and token counts (prompt, completion, total).
- **EvalRunAggregate**: Derived from all EvalCaseResults for a run — accuracy, avg latency, avg tokens, efficiency score. Computed on the fly or stored as a summary on the run record.
- **EfficiencyPanel**: Frontend component presenting the scatter chart of all runs; reads from existing run list data enriched with aggregate metrics.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can identify which of two compared runs has a higher efficiency score in under 10 seconds of viewing the comparison page.
- **SC-002**: The scatter chart renders with all eligible runs plotted within 1 second of the Eval Results page loading.
- **SC-003**: Accuracy values displayed in the metrics panel match the pass/fail counts already shown in the run detail view — zero discrepancy.
- **SC-004**: Agent latency values exclude judge model call time — verified by checking that recorded latency is consistently less than total wall-clock eval case time.
- **SC-005**: Runs completed before this feature was deployed continue to display correctly with available data shown and missing data indicated as "—" rather than errors.

## Assumptions

- Agent latency is measured as the wall-clock time of the agent model API call only; the judge model call time is recorded separately and excluded from latency metrics.
- Token usage data is available from the agent model's API response; models that do not return token counts will result in token fields being null/zero for that case.
- The scatter chart uses at most the most recent 50 runs to keep the visualization readable; older runs remain accessible in the history list.
- Efficiency Score is a relative comparison tool, not an absolute quality measure — its value is only meaningful when comparing runs within the same POC.
- No new charting library will be added; the scatter chart will be implemented with SVG or Canvas directly to stay consistent with the project's minimal-dependencies principle.
