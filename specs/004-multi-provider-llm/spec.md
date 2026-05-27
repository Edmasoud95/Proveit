# Feature Specification: Multi-Provider LLM with Per-Task Model Routing

**Feature Branch**: `004-multi-provider-llm`  
**Created**: 2026-05-27  
**Status**: Draft  
**Input**: User description: "We need to implement UX and practical enhancement to the LLM connector section. Add the ability to use multiple providers and to choose specific models for certain tasks this will help with validating and use different model for generating evals, stubs or judging and whatever other uses we have. the goal is not to overwhelm the user with all the settings initially but also give him details control when he needs it"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Multiple Provider Connections (Priority: P1)

A user wants to connect more than one LLM provider to a POC — for example, a local LM Studio instance for fast iteration and an OpenAI account for more capable runs. They can add, name, test, and remove provider connections on the LLM Settings page. One provider is designated as the default; all tasks fall back to it unless overridden.

**Why this priority**: The foundational capability — without multiple configured providers, per-task routing has nothing to route to. Also delivers immediate standalone value: users can switch providers without deleting and re-entering credentials.

**Independent Test**: Configure two providers on a POC's LLM Settings page. Verify both appear in the provider list with test results. Designate one as default. Run evals — they execute against the default provider. The old single-provider workflow still works unchanged.

**Acceptance Scenarios**:

1. **Given** a POC with no LLM connection, **When** the user opens LLM Settings, **Then** they see an "Add provider" button and an empty provider list.
2. **Given** the user fills in an endpoint URL and optionally an API key, **When** they click "Test connection", **Then** the system fetches and displays available models for that provider, or shows a specific error if unreachable.
3. **Given** two providers are saved, **When** the user marks one as default, **Then** that provider is highlighted as the default and all tasks without an explicit override use it.
4. **Given** a provider is deleted, **When** that provider was set as default, **Then** the system prompts the user to designate a new default before saving.
5. **Given** a provider is deleted, **When** that provider was assigned to a specific task, **Then** that task silently falls back to the default provider.

---

### User Story 2 - Per-Task Model Routing (Priority: P2)

A power user wants precise control: judging should use a strong reasoning model (e.g., GPT-4o), eval generation should use a creative model, and stub generation should use a fast local model. They can open an "Advanced routing" panel and assign a specific provider + model to each task type individually. The simple view remains unchanged — routing overrides are hidden until explicitly requested.

**Why this priority**: Directly addresses the core value proposition of the feature — different models excel at different tasks. Depends on P1 (multiple providers must exist first).

**Independent Test**: With two providers configured, open the advanced routing panel. Assign Provider B / Model X to the "Judge" task and Provider A / Model Y to "Eval generation". Run evals — confirm in the backend logs (or run summary) that the judge used Model X and eval generation used Model Y.

**Acceptance Scenarios**:

1. **Given** the LLM Settings page is open, **When** the user clicks "Advanced model routing" (collapsed by default), **Then** a panel expands showing one row per task type, each showing the currently active provider and model.
2. **Given** the routing panel is open, **When** the user selects a provider and model for the "Judge" task, **Then** that selection is saved and displayed as the active routing for that task.
3. **Given** a task has a provider override set, **When** the user clears the override, **Then** that task reverts to the default provider and the row displays "Default".
4. **Given** a task override provider becomes unavailable, **When** the user opens LLM Settings, **Then** the affected row shows a warning and the task falls back to the default until resolved.
5. **Given** all task overrides are cleared, **When** the user runs any operation, **Then** all tasks use the default provider and model without errors.

---

### User Story 3 - Smart Defaults and Zero-Configuration Compatibility (Priority: P3)

A user who never touches the advanced routing panel should have the same experience as today — a single provider and model drives everything. The feature must be fully backward-compatible: existing POCs with a single LlmConnection continue to work, and no migration or re-configuration is required.

**Why this priority**: Protects existing users from disruption. The progressive-disclosure principle requires that the default path stays as simple as before.

**Independent Test**: Open an existing POC that was configured before this feature. Verify LLM Settings looks the same as before (single provider, same fields). Run evals — everything works as expected with no prompts to reconfigure.

**Acceptance Scenarios**:

1. **Given** a POC created before this feature, **When** the user opens LLM Settings, **Then** the existing connection appears as the sole provider with default status, and the advanced routing panel is collapsed showing "Default" for all tasks.
2. **Given** only one provider is configured, **When** the user runs any task, **Then** all tasks use that provider and model automatically.
3. **Given** no providers are configured at all, **When** the user attempts to run evals or generate cases, **Then** a clear message directs them to configure at least one provider first.

---

### Edge Cases

- What happens when the default provider is temporarily unreachable during a run? — Task fails with a provider-specific error message; other cases in the run continue.
- What if a saved model name no longer exists on the provider (model was deprecated)? — The task fails with a "model not found" error; the routing config is not auto-deleted.
- What if two providers share the same endpoint URL? — Allowed; they are distinguished by name and API key.
- What if the user adds a provider but does not complete the test or save? — Changes are discarded on navigation away (with an unsaved-changes warning).
- What if a POC has 0 eval cases when routing is configured? — Routing config is saved but no run can be started until cases exist (existing behavior unchanged).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: A POC MUST support multiple named LLM provider connections, each with an endpoint URL, optional API key, and a display name.
- **FR-002**: Exactly one provider per POC MUST be designated as the default; all tasks without an explicit override use the default provider and its selected model.
- **FR-003**: The system MUST support connection testing per provider: fetching available models and reporting connectivity status.
- **FR-004**: Users MUST be able to add, rename, test, and delete individual providers without affecting other providers.
- **FR-005**: The system MUST define the following task types that can each have an independent routing override: **Agent** (running the POC against eval cases), **Judge** (LLM-as-judge scoring), **Eval Generation** (AI-generated eval cases), **Stub Generation** (AI-generated tool mock responses).
- **FR-006**: For each task type, users MUST be able to assign a specific provider + model, or leave it unset (falls back to default).
- **FR-007**: Per-task routing overrides MUST be exposed under a collapsed "Advanced model routing" section — not visible until the user expands it.
- **FR-008**: The system MUST resolve the active provider and model for any task at execution time using the rule: task override → default provider/model.
- **FR-009**: Deleting a provider that has active task overrides MUST silently clear those overrides (tasks revert to default); deleting the default provider MUST require the user to designate a new default first.
- **FR-010**: Existing single-provider POCs MUST continue to work without any user action; the existing connection becomes the default provider automatically.
- **FR-011**: The provider list and routing config MUST be visible on the LLM Settings page alongside (not replacing) the existing connection test and model selector UX.

### Key Entities

- **LlmProvider**: A named connection to an LLM endpoint. Attributes: display name, endpoint URL, API key (optional, stored securely), list of available models (fetched on test), is-default flag, last-tested timestamp and status.
- **TaskModelOverride**: Maps a task type to a specific provider + model. Attributes: task type (agent / judge / eval-gen / stub-gen), provider reference, model name. Zero or one override exists per task type per POC.
- **TaskType**: Enumerated values — `agent`, `judge`, `eval-gen`, `stub-gen`.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can configure two providers and assign per-task routing in under 3 minutes from a fresh POC.
- **SC-002**: 100% of task types (agent, judge, eval-gen, stub-gen) are independently routable to any configured provider and model.
- **SC-003**: Zero existing POCs require re-configuration after the feature is deployed — backward compatibility is fully preserved.
- **SC-004**: A user who never opens the advanced routing panel experiences no change in workflow compared to the pre-feature baseline.
- **SC-005**: When a task-specific provider fails, the error message identifies which task and which provider failed, enabling the user to resolve it in one action.

## Assumptions

- Provider connections are scoped per POC, not shared globally across all POCs (consistent with the existing `LlmConnection` model).
- API keys are treated the same as today — stored but never surfaced back to the user in plaintext.
- Model discovery (fetching the model list) requires a live connection test; no offline model catalog is maintained.
- The "Agent" task type refers to running the POC agent during eval execution (the model that answers the eval case input), which is separate from the judge.
- Mobile / responsive layout for the advanced routing panel is out of scope for v1.
- The number of providers per POC is not artificially capped, but typical usage is expected to be 2–4 providers.
- The feature does not change how eval runs are triggered — the routing is resolved transparently at execution time.
