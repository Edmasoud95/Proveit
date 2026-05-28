# Feature Specification: Smart Stub Generation

**Feature Branch**: `006-smart-stub-generation`  
**Created**: 2026-05-28  
**Status**: Draft  
**Input**: User description: "Make the generate stubs button more UX-friendly by only generating stubs for empty tools, and add a generate stubs button on individual tools. users should be able to tell what will be updated when they click generate"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Bulk Generate Only Overwrites Empty Stubs (Priority: P1)

A user has configured several tools on their POC. Some tools already have mock responses filled in, and others are still empty. When the user clicks "Generate Stubs" at the top of the tools section, only the tools with empty mock responses are updated — their existing work is preserved.

**Why this priority**: This is the core safety guarantee. Users need confidence that clicking a generation button won't silently destroy work they've already done. Without this, the feature is actively harmful.

**Independent Test**: Can be fully tested by creating a POC with a mix of filled and empty tools, clicking bulk generate, and verifying only the empty tools received new stubs.

**Acceptance Scenarios**:

1. **Given** a POC has 3 tools where 2 have mock responses and 1 is empty, **When** the user clicks the bulk "Generate Stubs" button, **Then** only the 1 empty tool receives a generated stub and the other 2 remain unchanged.
2. **Given** a POC has all tools already filled, **When** the user clicks bulk "Generate Stubs", **Then** no tools are modified and the user sees a message indicating there is nothing to generate.
3. **Given** a POC has all tools empty, **When** the user clicks bulk "Generate Stubs", **Then** all tools receive generated stubs.

---

### User Story 2 - Bulk Generate Button Shows What Will Be Updated (Priority: P1)

Before clicking the bulk "Generate Stubs" button, the user can see at a glance how many tools are empty (and will be affected). The button or a nearby label communicates the count so the user knows what will happen before they commit.

**Why this priority**: Transparency about scope is core to the UX goal stated in the feature. A user should never be surprised by what gets changed.

**Independent Test**: Can be fully tested without sending any generation requests — just by observing the UI when tools are in various filled/empty states.

**Acceptance Scenarios**:

1. **Given** a POC has 2 empty tools and 3 filled tools, **When** the user views the tools section, **Then** the bulk generate button (or adjacent indicator) shows that 2 tools will be updated.
2. **Given** all tools are filled, **When** the user views the tools section, **Then** the bulk generate button is disabled or clearly indicates there is nothing to generate.
3. **Given** all tools are empty, **When** the user views the tools section, **Then** the button reflects that all tools will be updated.

---

### User Story 3 - Per-Tool Generate Stub Button (Priority: P2)

Each individual tool card has its own "Generate Stub" button, allowing the user to regenerate a stub for a single specific tool without affecting any others — even if that tool already has a mock response.

**Why this priority**: Granular control allows users to fix or refresh a single tool without triggering bulk operations. This is additive value on top of the bulk flow.

**Independent Test**: Can be fully tested by clicking a per-tool generate button and confirming only that tool's mock response is updated while all others remain unchanged.

**Acceptance Scenarios**:

1. **Given** a tool has an existing mock response, **When** the user clicks its individual "Generate Stub" button, **Then** only that tool's mock response is replaced with a newly generated one.
2. **Given** a tool is empty, **When** the user clicks its individual "Generate Stub" button, **Then** that tool receives a generated stub.
3. **Given** generation is in progress for one tool, **When** the user views other tools, **Then** other tools' generate buttons remain functional and their state is unaffected.

---

### Edge Cases

- What happens when there are no tools at all? The bulk generate button should not be shown or should be disabled.
- What if stub generation fails for one tool in a bulk operation? The other tools should still be processed; the failed tool should show an error state.
- What if a tool's mock response contains only whitespace? It should be treated as empty.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The bulk "Generate Stubs" button MUST only generate stubs for tools whose mock response is empty (or whitespace-only).
- **FR-002**: The bulk "Generate Stubs" button MUST display the count of tools that will be updated before the user clicks it.
- **FR-003**: The bulk "Generate Stubs" button MUST be disabled when there are no empty tools to generate.
- **FR-004**: Each individual tool card MUST have its own "Generate Stub" button that generates a stub for that tool only.
- **FR-005**: Per-tool generation MUST work regardless of whether the tool already has a mock response (always overwrites for single-tool action).
- **FR-006**: During generation (bulk or per-tool), the affected tool(s) MUST show a loading state so the user knows work is in progress.
- **FR-007**: If stub generation fails for a tool, that tool MUST display an error indicator; other tools in a bulk operation MUST NOT be affected.
- **FR-008**: A tool's mock response MUST be considered empty if it is null, undefined, an empty string, or contains only whitespace.

### Key Entities

- **Tool**: A function definition on a POC config, with a name, description, parameters, and an optional mock response.
- **Mock Response**: The stub value returned when the tool is called during chat or eval runs. May be empty/absent.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can identify exactly how many tools will be affected by bulk generation without performing any additional action.
- **SC-002**: Clicking bulk "Generate Stubs" never overwrites a tool that already has a non-empty mock response.
- **SC-003**: Users can regenerate a stub for any single tool in one click, without navigating away or triggering changes to other tools.
- **SC-004**: Zero tools with existing content are unintentionally overwritten in any bulk generation scenario.

## Assumptions

- The existing "Generate Stubs" button calls a backend endpoint that accepts a list of tool definitions and returns generated mock responses; per-tool generation will reuse the same endpoint with a single-tool payload.
- A mock response is considered "filled" if it contains any non-whitespace characters after trimming.
- The per-tool generate button replaces the current mock response unconditionally (the user explicitly chose to regenerate that one tool).
- Bulk generation processes all eligible tools in a single request rather than one request per tool, to keep latency acceptable.
- The feature is scoped to the POC Editor tools tab; no changes are needed on other pages.
