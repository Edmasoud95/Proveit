# Feature Specification: Tool Stubs & Test Data Generation

**Feature Branch**: `002-tool-stubs`
**Created**: 2026-05-26
**Status**: Draft

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Manual Stub Authoring (Priority: P1)

A user has a POC with scaffolded tools (e.g. `search_knowledge_base`, `create_ticket`). They want to define what each tool returns during eval runs so the agent can complete its reasoning loop. They open the tools editor, expand a tool, and fill in a mock response directly — either as a fixed JSON value or a simple template.

**Why this priority**: Without stub responses the eval loop cannot complete for tool-calling agents. This is the minimum viable path to making tools functional in evals.

**Independent Test**: A user can open a POC, expand a tool in the editor, enter a mock response, save, run an eval, and observe the agent receiving that response when it calls the tool.

**Acceptance Scenarios**:

1. **Given** a POC with at least one tool defined, **When** the user opens the tools editor and expands a tool, **Then** a mock response field is visible and editable.
2. **Given** a tool with a saved mock response, **When** the eval runner calls that tool during execution, **Then** the mock response is returned to the agent and the eval loop continues.
3. **Given** an agent that calls a tool not present in the POC, **When** the eval runs, **Then** the system returns a descriptive error stub and marks the case as failed.

---

### User Story 2 - LLM-Generated Stubs (Priority: P2)

A user has defined tools but doesn't want to hand-write mock responses for each one. They click "Generate stubs" and the system uses the connected LLM to produce realistic mock responses based on the tool's name, description, and parameter schema.

**Why this priority**: Reduces friction for users who have many tools or don't know what realistic output looks like. Accelerates POC setup significantly.

**Independent Test**: A user with a connected LLM can click "Generate stubs", wait briefly, and see all tool mock responses populated with contextually appropriate values — without writing any JSON manually.

**Acceptance Scenarios**:

1. **Given** a POC with tools that have no mock responses and a connected LLM, **When** the user clicks "Generate stubs", **Then** all tools receive generated mock responses within 30 seconds.
2. **Given** a tool with an existing mock response, **When** the user triggers stub generation, **Then** the system asks for confirmation before overwriting the existing stub.
3. **Given** no LLM is connected, **When** the user attempts to generate stubs, **Then** the system shows a clear message directing them to connect an LLM first.

---

### User Story 3 - LLM-Generated Eval Test Data (Priority: P2)

A user wants realistic eval case inputs auto-generated based on their tools and system prompt. Rather than writing test messages manually, they click "Generate test data" and the LLM produces diverse, realistic input messages that exercise the tools in meaningful ways.

**Why this priority**: Complements stub generation — once tools have stubs, users need test inputs that actually invoke those tools. Pairs with the existing "Generate eval cases" capability.

**Independent Test**: A user can click "Generate test data", receive a set of eval case inputs that reference the POC's tools in realistic scenarios, and immediately run evals with them.

**Acceptance Scenarios**:

1. **Given** a POC with tools and stubs defined, **When** the user generates test data, **Then** the resulting eval cases contain user messages that are likely to trigger tool calls.
2. **Given** generated test data, **When** the user inspects an eval case, **Then** the input is realistic, diverse from other cases, and matches the domain described in the system prompt.
3. **Given** a request to generate N test cases, **When** generation completes, **Then** exactly N cases are added (or the user is informed if fewer could be generated).

---

### Edge Cases

- What happens when a tool's mock response is invalid JSON? The system should highlight the error inline and prevent saving until fixed.
- What if the LLM generates a stub that doesn't match the tool's declared return schema? The response is still saved — schema validation is advisory, not blocking.
- What if stub generation partially fails (some tools succeed, some fail)? Successfully generated stubs are saved; failed ones are flagged individually.
- What if an eval case triggers multiple tool calls in one turn? Each tool call receives its own stub response independently.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Each tool definition MUST include an optional mock response field that accepts free-form structured data.
- **FR-002**: When an agent calls a tool during an eval run, the system MUST return that tool's mock response to the agent instead of executing real code.
- **FR-003**: Users MUST be able to save, edit, and clear mock responses per tool individually.
- **FR-004**: The system MUST provide a "Generate stubs" action that uses the connected LLM to produce mock responses for all tools in the POC.
- **FR-005**: Stub generation MUST be scoped to tools with empty mock responses by default, with an option to regenerate all.
- **FR-006**: The system MUST provide a "Generate test data" action that produces eval case inputs designed to exercise the POC's tools.
- **FR-007**: Generated test data MUST be additive — it appends to existing eval cases rather than replacing them.
- **FR-008**: When an agent calls an unknown tool (not in the POC's tool list), the eval case MUST be marked as failed with a descriptive error.
- **FR-009**: The system MUST display a clear indicator on each tool showing whether a mock response is configured.

### Key Entities

- **ToolStub**: A mock response associated with a tool definition — structured data returned to the agent when that tool is called during an eval. Belongs to a ToolDefinition within a PocConfig.
- **ToolDefinition**: Existing entity extended with a stub field — name, description, parameter schema, and now mock response.
- **EvalCase**: Existing entity — test inputs generated to exercise tools should reference the tools by triggering realistic scenarios.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can configure mock responses for all tools in a POC in under 2 minutes without writing any code.
- **SC-002**: LLM-generated stubs are accepted as-is (no manual editing needed) by at least 70% of users on first generation.
- **SC-003**: Eval runs on tool-calling agents complete successfully end-to-end when stubs are configured, with 0 tool-call errors due to missing stubs.
- **SC-004**: Generated test data produces eval cases where at least 80% of cases trigger at least one tool call when run against the agent.
- **SC-005**: Stub generation for a POC with up to 10 tools completes in under 30 seconds.

## Assumptions

- Users have already scaffolded a POC with tools defined before using this feature.
- Mock responses are static values — dynamic/conditional responses per input are out of scope for this version.
- Tool execution order within a single agent turn is determined by the LLM; stubs are matched by tool name only.
- The connected LLM used for stub and test data generation is the same LLM already configured on the POC.
- Real tool execution (webhooks, code) is out of scope — this feature covers mock stubs only.
- Eval cases generated for test data follow the same format as manually created eval cases.
