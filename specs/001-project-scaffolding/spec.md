# Feature Specification: Project Scaffolding

**Feature Branch**: `001-project-scaffolding`  
**Created**: 2026-05-26  
**Status**: Draft  
**Input**: User description: "create the scaffolding for the project based on the constitution"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Describe a Workflow and Get a POC (Priority: P1)

A developer opens Proveit, describes an agent workflow in plain text, and receives a scaffolded POC configuration containing a system prompt, tool definitions, and eval cases — ready to run against an LLM.

**Why this priority**: This is the platform's core value proposition — zero-to-POC in minutes. Without this, there is no product.

**Independent Test**: Can be tested by entering a workflow description in the UI and verifying that a complete, valid POC config JSON is generated with all required sections populated.

**Acceptance Scenarios**:

1. **Given** the user is on the home screen, **When** they type a workflow description and submit, **Then** the platform generates a POC config with system prompt, tools, and eval cases within 30 seconds.
2. **Given** a workflow description with multiple agent steps, **When** the user submits it, **Then** the generated config reflects all described steps in logical order.
3. **Given** an ambiguous or very short description, **When** the user submits it, **Then** the platform still produces a runnable POC with sensible defaults and surfaces what it assumed.

---

### User Story 2 - Review and Edit Generated Config (Priority: P1)

After scaffolding, the developer sees the generated POC config in an editable UI. They can modify the system prompt, adjust tools, edit eval cases, and see their changes reflected immediately.

**Why this priority**: The AI-assisted-not-AI-replaced principle requires the config to always be visible and editable. This is co-equal with generation.

**Independent Test**: Can be tested by navigating to a generated POC and editing each section (system prompt, tools, eval cases), then verifying changes persist.

**Acceptance Scenarios**:

1. **Given** a generated POC config, **When** the user views it, **Then** all sections (system prompt, tools, eval cases) are displayed in an editable format.
2. **Given** the user edits the system prompt, **When** they save, **Then** the updated config is persisted and reflected on subsequent views.
3. **Given** the user modifies eval cases, **When** they save, **Then** the JSON remains valid and exportable.

---

### User Story 3 - Connect an LLM Endpoint (Priority: P2)

The developer connects a local or external LLM by providing an endpoint URL and optional API key. The platform validates the connection and confirms readiness to run evals.

**Why this priority**: Without an LLM connection, evals can't run — but the POC config still has standalone value as a portable artifact.

**Independent Test**: Can be tested by configuring an LLM endpoint (local or external) and verifying a successful connection health check.

**Acceptance Scenarios**:

1. **Given** the user is on the LLM connection screen, **When** they enter a valid local endpoint (e.g., LM Studio on localhost:1234), **Then** the platform confirms the connection is active.
2. **Given** the user enters an external endpoint with API key (e.g., OpenAI), **When** they test the connection, **Then** the platform verifies the key works and shows available models.
3. **Given** the user enters an invalid or unreachable endpoint, **When** they test the connection, **Then** the platform shows a clear error with suggested fixes.

---

### User Story 4 - Run Evals and See Scored Results (Priority: P2)

The developer runs their eval cases against the connected LLM and receives scored results with pass/fail reasoning per case, powered by LLM-as-judge.

**Why this priority**: Evals close the feedback loop — they validate whether the POC actually works. Depends on both a config (US1) and an LLM connection (US3).

**Independent Test**: Can be tested by running a set of eval cases against a connected LLM and verifying that each case receives a score and reasoning explanation.

**Acceptance Scenarios**:

1. **Given** a POC with eval cases and a connected LLM, **When** the user clicks "Run Evals", **Then** each case is executed and results appear with pass/fail status and reasoning.
2. **Given** evals are running, **When** the user watches the results screen, **Then** progress is shown in real-time (cases complete one by one, not all-at-once).
3. **Given** an eval run completes, **When** the user reviews results, **Then** they can see the judge's reasoning for each pass/fail decision.

---

### User Story 5 - Upload or Generate Eval Cases (Priority: P3)

The developer can either upload eval cases as a JSON file or generate them via AI from the POC's system prompt and tool definitions.

**Why this priority**: Scaffolding already produces initial eval cases (US1). This story adds flexibility for power users and iteration.

**Independent Test**: Can be tested by uploading a JSON eval file and by triggering AI-generated evals, then verifying both appear correctly in the POC config.

**Acceptance Scenarios**:

1. **Given** the user has a POC open, **When** they upload a valid JSON eval file, **Then** the cases are added to the POC config and visible in the UI.
2. **Given** the user wants more eval coverage, **When** they click "Generate Evals", **Then** the platform produces additional cases based on the current system prompt and tools.
3. **Given** the user uploads an invalid JSON file, **When** they attempt import, **Then** the platform shows specific validation errors (line/field level).

---

### User Story 6 - Export POC Config (Priority: P3)

The developer exports their POC config as a standalone JSON file that is human-readable and can be shared or version-controlled.

**Why this priority**: Portability is a core principle but not blocking for the primary workflow.

**Independent Test**: Can be tested by exporting a POC and verifying the resulting JSON file is valid, human-readable, and contains all config sections.

**Acceptance Scenarios**:

1. **Given** a POC with all sections configured, **When** the user clicks "Export", **Then** a JSON file is downloaded containing the complete config.
2. **Given** an exported JSON file, **When** opened in a text editor, **Then** it is human-readable with clear structure and no binary/encoded blobs.

---

### Edge Cases

- What happens when the LLM endpoint disconnects mid-eval run? (Partial results should be preserved, failed cases marked as errored with retry option)
- What happens when the user submits an empty or nonsensical workflow description? (Platform should still attempt generation with a warning, not block the user)
- What happens when the AI judge LLM is different from the POC's target LLM and one is unavailable? (Clear error distinguishing which connection failed)
- What happens when a POC config exceeds the context window of the connected LLM? (Warning shown before eval run with suggestion to reduce prompt/tools)

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST accept a plain-text workflow description and generate a complete POC config (system prompt, tool definitions, eval cases)
- **FR-002**: System MUST display all generated config in an editable UI with immediate visual feedback on changes
- **FR-003**: System MUST support connecting to any OpenAI-compatible endpoint (local or external) via URL and optional API key
- **FR-004**: System MUST validate LLM connections with a health check before allowing eval runs
- **FR-005**: System MUST execute eval cases against the connected LLM and return results with pass/fail status
- **FR-006**: System MUST use LLM-as-judge scoring — no hardcoded expected outputs
- **FR-007**: System MUST show real-time progress during eval runs (per-case updates, not batch)
- **FR-008**: System MUST persist POC configs to local storage (SQLite)
- **FR-009**: System MUST allow JSON export of any POC config as a portable, human-readable file
- **FR-010**: System MUST allow JSON import of eval cases
- **FR-011**: System MUST support AI-assisted generation of additional eval cases from existing config
- **FR-012**: System MUST handle all LLM communication through the backend — frontend never calls LLMs directly
- **FR-013**: System MUST show visible progress for all async operations (scaffolding, eval runs, LLM connections)

### Key Entities

- **POC Config**: The central data model — contains system prompt, tool definitions, eval cases, LLM connection settings, and metadata. Always JSON-serializable.
- **Eval Case**: A single test scenario with input context and judge criteria. Belongs to a POC Config.
- **Eval Result**: The outcome of running one eval case — includes pass/fail status, judge reasoning, and raw LLM response.
- **LLM Connection**: Endpoint URL, optional API key, model selection, and connection status. Associated with a POC Config.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A developer can go from zero to a running eval suite in under 5 minutes on first use
- **SC-002**: Generated POC configs are valid and runnable without manual fixes at least 90% of the time
- **SC-003**: Users can connect a local LLM (LM Studio/Ollama) in under 60 seconds
- **SC-004**: Eval results display within 2 seconds of each case completing (real-time, not batch)
- **SC-005**: Exported JSON configs are importable back into the platform without data loss
- **SC-006**: The platform runs with zero external service dependencies in local-first mode (SQLite, local LLM)

## Assumptions

- Target users are developers comfortable with concepts like system prompts, tools, and evals — no onboarding tutorial needed for v1
- Local LLMs are already installed and running (LM Studio, Ollama) — Proveit does not manage LLM installation
- A single user operates the platform at a time (no multi-user, no auth per constitution)
- The OpenAI-compatible API format is sufficient to cover all target LLM providers (LM Studio, Ollama, OpenAI, Groq)
- POC configs are small enough to fit in a single SQLite database without performance concerns for v1
- The LLM-as-judge uses the same connected endpoint by default (but can be configured separately in future versions)
