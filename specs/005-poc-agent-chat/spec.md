# Feature Specification: POC Agent Chat UI

**Feature Branch**: `005-poc-agent-chat`
**Created**: 2026-05-27
**Status**: Draft
**Input**: User description: "A chat UI for interacting with the configured POC agent. Messages stream in real time. Supports markdown rendering. Tool calls are shown inline as collapsible trace items so the user can see what the agent did, not just what it said."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Send a Message and See a Streaming Response (Priority: P1)

A developer has configured a POC with a system prompt and connected an LLM provider. They open the Chat tab for that POC, type a message, and watch the agent's response appear word-by-word in real time — just like a live conversation. When the agent finishes, the full response is displayed.

**Why this priority**: This is the core loop of the feature. Without it, nothing else works. It lets users immediately validate whether their POC configuration produces the right kind of responses.

**Independent Test**: Can be fully tested by sending a message to a connected POC agent and verifying that tokens appear progressively without waiting for the full response, delivering immediate conversational feedback.

**Acceptance Scenarios**:

1. **Given** a POC with a connected LLM provider is open, **When** the user types a message and submits it, **Then** the agent's response begins appearing within 2 seconds and tokens stream in visibly until the response is complete.
2. **Given** the agent is generating a response, **When** the response is streaming, **Then** a visual indicator shows the agent is active and the input field is disabled until the response completes.
3. **Given** the LLM provider is unreachable, **When** the user submits a message, **Then** an error message is displayed and the input field becomes active again so the user can retry.

---

### User Story 2 - Inspect Tool Calls Inline (Priority: P2)

The agent uses one or more tools during a response. The user wants to understand what the agent did — which tools it called, what arguments it passed, and what the tools returned — without leaving the chat view. Each tool call appears as a collapsible trace item inline between the user message and the final agent text.

**Why this priority**: Tool call visibility is what distinguishes agent chat from a simple LLM chat box. Without it, users can't debug or trust the agent's behavior. This is essential for a POC evaluation tool.

**Independent Test**: Can be fully tested by configuring a POC with at least one tool stub, sending a message that triggers the tool, and verifying that the tool call trace appears collapsed inline, and expands to show name, arguments, and response.

**Acceptance Scenarios**:

1. **Given** the agent invokes a tool during a response, **When** the response completes, **Then** a collapsible trace item appears inline showing the tool name.
2. **Given** a tool call trace item is collapsed, **When** the user clicks to expand it, **Then** the tool name, input arguments, and tool response are displayed in a readable format.
3. **Given** the agent calls multiple tools in sequence, **When** the user views the conversation, **Then** each tool call appears as a separate trace item in the order it was called, between the user message and the agent's final reply.

---

### User Story 3 - Read Markdown-Formatted Responses (Priority: P3)

The agent produces a response containing markdown: a code block, a list, a header, or bold text. Instead of seeing raw asterisks and backticks, the user sees properly rendered output — syntax-highlighted code, formatted lists, and readable prose.

**Why this priority**: Many agents output structured content (code, instructions, comparisons). Raw markdown is readable but noisy. Rendered markdown significantly improves readability without changing any underlying behavior.

**Independent Test**: Can be fully tested by prompting the agent to respond with a code block and a list, then verifying the output renders with proper formatting rather than raw markdown syntax.

**Acceptance Scenarios**:

1. **Given** the agent responds with a markdown code block, **When** the response is displayed, **Then** the code is rendered with monospace font and syntax highlighting (language-specific if detectable).
2. **Given** the agent responds with markdown lists, headers, or bold/italic text, **When** the response is displayed, **Then** those elements are rendered as formatted HTML equivalents, not raw symbols.
3. **Given** the agent responds with plain text only, **When** the response is displayed, **Then** the output appears as normal prose with no visual regression.

---

### Edge Cases

- What happens when the agent produces no response (empty reply)?
- What happens when a tool call returns an error or an empty result?
- What happens when the user navigates away mid-stream — does the stream cancel cleanly?
- What happens when no LLM provider is connected for the POC?
- What happens when the agent response contains very large tool payloads (e.g., a full JSON blob)?
- What happens when the user submits a message while a response is still streaming?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST provide a dedicated Chat view accessible from the POC editor navigation.
- **FR-002**: Users MUST be able to type and submit messages to the configured POC agent.
- **FR-003**: Agent responses MUST stream token-by-token (or chunk-by-chunk) in real time, appearing progressively as they are generated.
- **FR-004**: System MUST render markdown in agent responses, including code blocks, lists, headers, and inline formatting.
- **FR-005**: Tool calls made by the agent MUST appear as collapsible trace items inline in the conversation, positioned between the triggering message and the agent's final text reply.
- **FR-006**: Each tool call trace item MUST display, when expanded: the tool name, the input arguments passed to the tool, and the result returned by the tool.
- **FR-007**: System MUST display a visible indicator (e.g., animated cursor or spinner) while the agent is generating a response.
- **FR-008**: The message input field MUST be disabled while the agent is generating a response, and re-enabled when the response completes or errors.
- **FR-009**: System MUST display a clear, actionable error message if the agent call fails (e.g., LLM unreachable, timeout).
- **FR-010**: System MUST display a prompt or link to configure an LLM provider if none is connected for the current POC.
- **FR-011**: The full conversation history MUST be visible and scrollable within the current session.
- **FR-012**: Users MUST be able to start a new conversation (clear the chat history) without leaving the page.

### Key Entities

- **Chat Session**: A sequence of turns in a single conversation, scoped to one POC config. Not persisted across page reloads (session-only).
- **Message**: A single turn — either a user-authored message or an agent reply. Agent replies may contain inline tool call traces.
- **Tool Call Trace**: An inline record of one agent tool invocation, containing the tool name, serialized arguments, and the returned result. Collapsible by default.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: The first token of the agent's response appears within 2 seconds of the user submitting a message (excluding LLM processing latency beyond the first token).
- **SC-002**: Users can identify every tool called, what was passed to it, and what it returned without leaving the chat view.
- **SC-003**: 100% of agent responses containing standard markdown (code blocks, lists, headers, bold/italic) are rendered as formatted output, not raw syntax.
- **SC-004**: Users can complete a full interaction — send a message, observe tool call traces, read the final response — in a single page view with no navigation required.
- **SC-005**: Error states (unreachable LLM, tool failure) are communicated clearly enough that users understand what failed and can take a corrective action without guessing.

## Assumptions

- Chat history is session-only and does not persist across page reloads. Persistence can be added in a future iteration.
- The chat interface is scoped to one POC config at a time — there is no cross-POC conversation history.
- The existing LLM provider and routing configuration (from the LLM Settings page) determines which model handles the chat. No separate model selector is needed in the chat view.
- Tool calls use the tool definitions already configured in the POC (stubs or real). The chat view does not allow adding or editing tools.
- Mobile/responsive layout is a nice-to-have, not a hard requirement for the initial version.
- Code syntax highlighting language detection is best-effort (based on the markdown language hint if provided by the agent).
