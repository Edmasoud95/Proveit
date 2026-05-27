# Feature Specification: Versioned Eval Runs with Failure Traces

**Feature Branch**: `003-versioned-eval-runs`
**Created**: 2026-05-26
**Status**: Draft

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Inspect Pipeline Traces for Failed Cases (Priority: P1)

A developer runs evals and several cases fail. Rather than just seeing a red result, they can drill into a failing case and see a step-by-step pipeline trace: the exact input sent, the system prompt in use, every tool call the LLM made (name, arguments it chose, and the mock response it received back), the final response it produced, and the judge's verdict with reasoning. The trace also highlights exactly which step diverged from expected behavior — wrong tool called, wrong arguments, or wrong final response.

**Why this priority**: Failure traces are the core value of this feature. Without them, a failing case provides no actionable signal — the user has no idea whether the LLM chose the wrong tool, passed wrong arguments, or produced a bad final answer. The trace turns a red dot into a debuggable event.

**Independent Test**: A user can run evals, click on a failed case, and see the full pipeline trace — input, system prompt, each tool call with its arguments and mock response, final LLM output, and the step identified as the cause of failure — without navigating away from the results page.

**Acceptance Scenarios**:

1. **Given** a completed run with at least one failed case, **When** the user clicks on the failed case, **Then** the pipeline trace is shown with: input message, system prompt (at run time), each tool call in order (name + arguments + mock response returned), final LLM response, pass/fail verdict, and judge reasoning.
2. **Given** a failed pipeline trace, **When** the user views it, **Then** the step that caused the failure is visually distinguished — whether it was a wrong tool called, wrong arguments, or a wrong final response.
3. **Given** a run where a case made no tool calls, **When** the user views the trace, **Then** the tool call section is shown as empty and the trace still displays input, system prompt, final output, and verdict.
4. **Given** a run that was interrupted mid-execution, **When** the user views results, **Then** traces for completed cases are accessible and incomplete cases are clearly marked as not executed.

---

### User Story 2 - Eval Suite Auto-Versioning (Priority: P2)

A developer adds a new eval case to their suite. Without any manual action, a new version of the eval suite is created automatically (e.g. v1 → v2). They can see a history of their eval versions, and all subsequent runs are tagged with v2. When they look back at older runs under v1, they know the exact test cases those runs used — even if v1's cases have since been edited or deleted.

**Why this priority**: Versioning is the backbone of meaningful run comparison. Without it, a user cannot tell whether a performance change between two runs is due to a better system prompt or a different set of test cases — the comparison is meaningless without knowing the test suite was identical.

**Independent Test**: A user who adds an eval case to their suite sees the version increment in the UI. They then run evals twice: both runs are tagged v2. They can confirm the cases included in v2 without being affected by any future edits to the eval suite.

**Acceptance Scenarios**:

1. **Given** a POC with an eval suite at v1, **When** the user adds, edits, or removes any eval case, **Then** a new version (v2) is created automatically and becomes the active version for future runs.
2. **Given** an eval version, **When** the user views a run tagged to that version, **Then** the snapshot of eval cases used in that run is retrievable and reflects the cases as they existed at the time of the run — not their current state.
3. **Given** an eval version that has since been superseded, **When** the user views a run from that version, **Then** the version label and its case snapshot are still accessible even if subsequent versions exist.

---

### User Story 3 - Runs Grouped by Eval Version (Priority: P2)

A developer has run evals many times across two different versions of their eval suite. When they open the eval results page, runs are grouped under their respective eval versions — v1 runs together, v2 runs together — so they can immediately see which results are comparable and which are not.

**Why this priority**: Without grouping, the run history list is a flat timeline that mixes incomparable results. The user must mentally track which runs used which test cases. Grouping by version makes the structure obvious at a glance.

**Independent Test**: A user with runs from two different eval versions opens the eval results page and sees two distinct sections — one for each version — each containing only the runs that used that version's eval cases. Pass rates within each group are directly comparable; pass rates across groups are not presented as comparable.

**Acceptance Scenarios**:

1. **Given** a POC with completed runs across multiple eval versions, **When** the user opens the eval results page, **Then** runs are displayed grouped by eval version, with the version label prominent on each group and each individual run.
2. **Given** a group of runs under the same eval version, **When** the user inspects the group, **Then** each run shows: timestamp, total cases, passed count, failed count, and pass rate.
3. **Given** a POC that has never had a run, **When** the user opens the eval results page, **Then** a clear empty state is shown guiding them to run their first eval.

---

### User Story 4 - Cross-Version Comparison Blocked (Priority: P3)

A developer tries to select two runs from different eval versions for comparison. The UI prevents the action before they submit it and explains clearly why: the eval cases are different between versions, making a direct comparison misleading.

**Why this priority**: The entire value of eval versioning breaks down if users can accidentally compare runs with different test suites. This guardrail must be explicit and educational — the user should understand *why* the comparison is blocked, not just encounter a disabled button.

**Independent Test**: A user selects one run from v1 and attempts to select a second run from v2. The UI either prevents the second selection or shows a clear warning explaining that cross-version comparison is not permitted, with a brief reason.

**Acceptance Scenarios**:

1. **Given** runs from two different eval versions are both visible in the UI, **When** the user attempts to select runs from different versions for comparison, **Then** the UI blocks the action and displays a message explaining that runs from different eval versions cannot be compared because the test cases may differ.
2. **Given** the cross-version comparison is blocked, **When** the user reads the explanation, **Then** the message tells them what to do instead (e.g. select two runs from the same version).
3. **Given** only one eval version exists with multiple runs, **When** the user selects any two runs, **Then** comparison is allowed without restriction.

---

### User Story 5 - Side-by-Side Run Comparison (Priority: P3)

A developer wants to know whether their latest system prompt change improved or regressed performance. They select two runs from the same eval version and see a case-by-case comparison: which cases moved from fail to pass (improved), which moved from pass to fail (regressed), and which stayed the same.

**Why this priority**: Pass rate alone doesn't show *what changed*. A run that went from 60% to 70% might have fixed 2 cases and broken 1. Side-by-side comparison makes regressions visible at case level, giving the developer specific items to act on.

**Independent Test**: A user selects two runs from the same eval version and sees a comparison view listing every eval case with a status column for each run (pass or fail) and a change indicator (improved / regressed / unchanged) — without needing to manually cross-reference two separate result views.

**Acceptance Scenarios**:

1. **Given** two or more runs within the same eval version, **When** the user selects two runs for comparison, **Then** a side-by-side view shows each eval case with its pass/fail status in each run and a change indicator (improved, regressed, or unchanged).
2. **Given** the comparison view, **When** a case shows as regressed (was passing, now failing), **Then** the user can click through to the failing run's pipeline trace for that case.
3. **Given** only one run exists for an eval version, **When** the user views that version's run group, **Then** the comparison action is visibly unavailable with a tooltip or note indicating at least two runs are needed.

---

### Edge Cases

- What if the user edits an eval case while a run is in progress? The run uses the snapshot captured at execution start; the edit creates a new version that takes effect on subsequent runs only.
- What if an eval version is deleted after runs are associated with it? Those runs retain their case snapshots and remain fully accessible — the trace is always accurate regardless of version deletion.
- What if a case makes a very large number of tool calls in one turn? The trace shows all calls in order; long traces are scrollable with all steps preserved.
- What if a pipeline trace contains very long output text? The UI truncates to a preview with an expand option — the full text is always stored.
- What if the judge service is unavailable for a case during a run? The case is stored with a failure status and an error note; it is not silently dropped or omitted from the trace.
- What if there are no eval cases in the suite? The UI should prevent starting a run and show a clear prompt to add eval cases first.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST automatically create a new eval suite version whenever any eval case is added, edited, or removed — no user action required.
- **FR-002**: Each eval suite version MUST be assigned a sequential integer label (v1, v2, v3...) that is visible in the UI on every run associated with that version.
- **FR-003**: Each eval run MUST be tagged with the eval suite version that was active at the time execution began.
- **FR-004**: System MUST store a full snapshot of all eval cases included in each run — not only the version number — so traces remain accurate even if the version or its cases are later deleted or modified.
- **FR-005**: The eval results page MUST display past runs grouped by eval suite version, with the version label prominent on each group header and each individual run entry.
- **FR-006**: The UI MUST prevent users from selecting runs from different eval versions for comparison, and MUST display a clear explanation of why cross-version comparison is not permitted.
- **FR-007**: Users MUST be able to select any two runs within the same eval suite version to view a side-by-side comparison showing which cases regressed (passed → failed), improved (failed → passed), or remained unchanged between the two runs.
- **FR-008**: System MUST capture a full pipeline trace for every eval case executed in a run, comprising: (a) the input message submitted, (b) the system prompt active at run time, (c) each tool call in sequence — tool name, arguments supplied by the LLM, and mock response returned, (d) the final LLM response, (e) the pass/fail verdict, and (f) the judge's reasoning.
- **FR-009**: For failed eval cases, the pipeline trace MUST identify which step caused the failure: wrong tool called, wrong arguments supplied, or wrong final response.
- **FR-010**: Users MUST be able to drill into any failed eval case from the run results view and see its full pipeline trace.
- **FR-011**: Pipeline traces for passing cases MUST also be stored and accessible; the UI surfaces failing cases prominently but does not hide passing traces.
- **FR-012**: Run traces for all completed cases MUST be persisted even when a run is interrupted before all cases complete; incomplete cases are marked as not executed.
- **FR-013**: API keys and credentials MUST NOT be stored in any snapshot or trace; only the endpoint URL and model identifier are captured.
- **FR-014**: Users MUST be able to delete individual past runs, with a confirmation step, to manage accumulated history.

### Key Entities

- **EvalSuiteVersion**: A numbered version of the eval suite — stores version number (v1, v2...), creation timestamp, and a full snapshot of all eval cases at the point the version was created. A new version is created automatically on any change to the eval suite.
- **EvalRun**: A single execution of an eval suite — stores timestamp, status (running / completed / interrupted), summary stats (total cases, passed, failed, pass rate), a reference to the EvalSuiteVersion used, and a reference to the PocConfigSnapshot. Version label is displayed in the UI.
- **PipelineTrace**: The step-by-step trace for a single eval case execution within a run — stores the input message, system prompt (from the run's PocConfigSnapshot), an ordered list of tool calls (each with: tool name, arguments, mock response returned), the final LLM response, pass/fail verdict, judge reasoning, and the identified failure step (wrong tool / wrong arguments / wrong final response) for failed cases.
- **PocConfigSnapshot**: A point-in-time capture of the POC's system prompt text, model identifier, and endpoint URL (no credentials) taken at the moment a run begins.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can never accidentally compare runs from different eval versions — the UI prevents this action and explains why before the user can submit the comparison.
- **SC-002**: Failure traces load and display fully within 2 seconds of the user requesting them.
- **SC-003**: Traces clearly identify which step in the pipeline caused a failure — users do not need to manually read through the full trace to determine where it went wrong.
- **SC-004**: Users can view all past runs grouped by eval version and compare pass rates within a version at a glance, without performing any calculations or leaving the eval results page.

## Assumptions

- Eval suite versioning is scoped to the eval case list — changes to the system prompt or connected model do not trigger a new eval version (those are captured in the PocConfigSnapshot per run).
- Version numbers are sequential integers (v1, v2...) and are never reused or reordered, even if runs or versions are deleted.
- Run history and traces are scoped to a single POC; cross-POC comparison is out of scope.
- Deletion of a run and its traces is permanent — no recycle bin or recovery mechanism is required.
- The live-streaming SSE experience for in-progress runs is preserved; this feature extends the post-run view and run history, not the live stream.
- If a run is interrupted, only the cases that completed execution have traces captured; the remaining cases are listed as not executed without a trace.
- Eval case inputs in traces reflect the case definition at execution time; subsequent changes to the case definition do not retroactively alter stored traces.
