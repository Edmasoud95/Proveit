# Feature Specification: PoC Generation UX

**Feature Branch**: `009-poc-generation-ux`  
**Created**: 2026-05-28  
**Status**: Draft  
**Input**: User description: "We want to enhance the PoC generation experience with better UX and user awareness during the generation process of what step is happening"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Step-by-step Progress Visibility (Priority: P1)

A user submits a description to generate a new PoC. Instead of staring at a static spinner, they see a labelled sequence of named steps updating in real time as the system works — for example: "Analysing description", "Designing workflow", "Generating tools", "Building eval cases". Each step shows its current state (waiting, in progress, complete) so the user always knows where they are in the process.

**Why this priority**: This is the core problem. Users have no awareness of what is happening during a 10–30 second generation. Providing named step feedback makes the wait feel purposeful and predictable, and is the minimum viable improvement.

**Independent Test**: Trigger a PoC generation and confirm that at least three distinct named steps appear and update visibly during the process without any other changes needed.

**Acceptance Scenarios**:

1. **Given** a user submits the generation form, **When** generation starts, **Then** a progress section appears immediately showing the first step as active before any LLM response arrives.
2. **Given** generation is in progress, **When** one step completes, **Then** it is visually marked as done and the next step becomes active.
3. **Given** all steps complete successfully, **When** the final step finishes, **Then** the user is transitioned to the new PoC editor without a jarring jump.
4. **Given** the user is on a slow connection, **When** a step takes longer than expected, **Then** the active step continues to show an animated in-progress state so the user knows the system is still working.

---

### User Story 2 - Live Content Preview (Priority: P2)

As each section of the PoC is generated (system prompt, tools, eval cases), the content appears progressively in a preview area rather than all at once at the end. The user can read what is being created while generation is still running.

**Why this priority**: Seeing content build up in real time dramatically reduces perceived wait time and builds trust that the system understood the description. It also lets users spot immediately if the generation is going in the wrong direction.

**Independent Test**: Run a generation and confirm that system prompt text appears on screen before tools or eval cases are ready.

**Acceptance Scenarios**:

1. **Given** generation is in progress, **When** the system prompt content is ready, **Then** it appears in a preview pane before tools or eval cases are complete.
2. **Given** tools are being generated, **When** each tool definition is produced, **Then** it appears incrementally in the preview rather than as a batch at the end.
3. **Given** eval cases are being generated, **When** each case is produced, **Then** it is appended to the preview list in real time.
4. **Given** the user is viewing the live preview, **When** generation completes, **Then** the preview transitions seamlessly into the editable PoC editor with no content flash or reload.

---

### User Story 3 - Failure Transparency and Recovery (Priority: P3)

If the generation process fails at any step, the user sees exactly which step failed, a plain-language reason, and a retry option — without losing the description they entered.

**Why this priority**: Currently a failure likely shows a generic error. Knowing which step failed (e.g., "Generating eval cases failed — the LLM timed out") and being able to retry without re-entering the description removes friction and frustration.

**Independent Test**: Simulate a generation failure and confirm the UI shows the failed step by name, preserves the original description input, and offers a retry action.

**Acceptance Scenarios**:

1. **Given** generation fails at a specific step, **When** the error occurs, **Then** the failed step is highlighted with a clear failure label and the steps before it remain marked as complete.
2. **Given** a failure has occurred, **When** the user views the error, **Then** a plain-language message explains what went wrong (not a raw technical error).
3. **Given** a failure has occurred, **When** the user clicks retry, **Then** the generation restarts from the beginning with the same description already populated.
4. **Given** a partial failure, **When** some steps completed before the failure, **Then** the user can see what was successfully generated before the error.

---

### Edge Cases

- What happens if the user closes the browser tab mid-generation?
- How does the system handle a generation that takes more than 60 seconds?
- What if the LLM returns an empty or malformed section for one step but succeeds on others?
- What if the user submits the form twice before the first generation completes?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST display named progress steps immediately when generation starts, before any content is returned.
- **FR-002**: Each step MUST have a visible state: waiting, in-progress, and complete.
- **FR-003**: The system MUST update each step's state in real time as generation proceeds, without requiring a page refresh.
- **FR-004**: The system MUST show generated content (system prompt, tools, eval cases) progressively as each section is produced.
- **FR-005**: The system MUST preserve the user's description input if generation fails so the user can retry without re-entering it.
- **FR-006**: The system MUST display a plain-language failure message identifying which named step failed.
- **FR-007**: The system MUST provide a retry action after a failure that restarts generation with the same inputs.
- **FR-008**: The system MUST prevent duplicate generation submissions while a generation is already in progress.
- **FR-009**: Upon successful completion, the system MUST transition the user directly into the new PoC editor, preserving all generated content.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can identify which step of generation is currently active within 2 seconds of starting the process.
- **SC-002**: Generated content (system prompt) appears on screen before the overall generation process completes for 100% of successful runs.
- **SC-003**: After a failure, users can initiate a retry in fewer than 3 clicks without re-entering their description.
- **SC-004**: The generation flow has zero states where the user sees a blank screen or static spinner with no indication of progress for more than 2 seconds.
- **SC-005**: User-reported comprehension of "what is happening during generation" improves — target: users can correctly name the current step when asked mid-generation.

## Assumptions

- The generation process involves a fixed, predictable sequence of steps (description analysis, system prompt generation, tool generation, eval case generation) that can be named and tracked individually.
- The backend already handles the generation sequentially; this feature adds visibility into that existing sequence rather than restructuring it.
- The generation description input is on the Home page creation form and no changes to the form fields themselves are in scope.
- Mobile support is in scope — the progress UI must be readable on small screens.
- The number of steps shown is 3–5; exact step names will be determined during planning based on the current scaffold implementation.
