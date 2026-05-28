# Quickstart & Integration Scenarios: POC Agent Chat UI

**Feature**: 005-poc-agent-chat
**Date**: 2026-05-27

---

## Happy Path: Send a Message and See a Streaming Response

**Scenario**: Developer opens the Chat tab for a POC that has a connected LLM provider, sends a message, and watches tokens stream in.

1. Navigate to `/poc/:id/chat`
2. The chat page loads with the POC name in the header and an empty thread
3. Type "What can you do?" in the input and press Enter (or click Send)
4. The user message appears immediately in the thread
5. Within 2 seconds, the assistant response begins streaming — tokens appear word by word
6. The input field is disabled and a streaming indicator is visible
7. The response completes, the input field re-enables
8. Markdown in the response (code blocks, lists) is rendered — not shown as raw `**asterisks**`

**Expected**: Full turn completes, response is readable, no raw markdown visible.

---

## Tool Call Trace Visibility

**Scenario**: Developer tests a POC that uses a `search` tool stub. The agent calls the tool during its response.

1. Send a message that triggers a tool call (e.g., "Search for the latest news")
2. Observe a collapsed trace item appear inline: `🔧 search` (collapsed by default)
3. The agent's final text response follows the tool call item
4. Click the trace item to expand it
5. Expanded view shows:
   - **Tool name**: `search`
   - **Arguments**: `{ "query": "latest news" }` (formatted JSON)
   - **Result**: mock stub response (formatted JSON or string)

**Expected**: Tool call is visible and inspectable without navigating away.

---

## Multiple Tool Calls in Sequence

**Scenario**: Agent calls two tools before responding.

1. Send a message that causes the agent to call `tool_a` then `tool_b`
2. Two collapsed trace items appear: `🔧 tool_a`, `🔧 tool_b` — in call order
3. Final assistant text appears after both trace items
4. Each trace item expands independently

**Expected**: All tool calls are displayed in order between the user message and the final reply.

---

## No LLM Provider Connected

**Scenario**: Developer opens chat for a POC with no active LLM connection.

1. Navigate to `/poc/:id/chat`
2. The chat input is visible but the thread shows an info banner:
   - "No LLM provider connected. [Configure LLM →]" (links to `/poc/:id/llm`)
3. Submitting a message returns an error state with the same guidance

**Expected**: Clear, actionable error — user knows exactly what to fix.

---

## LLM Provider Unreachable Mid-Stream

**Scenario**: LLM becomes unreachable after the user sends a message.

1. Send a message normally
2. The backend receives a connection error from the LLM mid-stream
3. An `error` SSE event is sent and the stream closes
4. The partial response (if any tokens were received) remains visible
5. An error banner appears below the partial response: "Connection lost. Please try again."
6. The input field re-enables

**Expected**: No frozen UI; user can retry immediately.

---

## New Conversation

**Scenario**: Developer wants to start fresh without navigating away.

1. Send a few messages in the current session
2. Click the "New conversation" button (top-right of chat panel)
3. The thread clears — all previous messages removed from view
4. The input field is ready for a new message

**Expected**: History cleared in one click; no page reload required.

---

## Navigation Away and Back

**Scenario**: Developer navigates to the eval page and returns to chat.

1. Send a message, receive a response
2. Navigate to `/poc/:id/evals`
3. Navigate back to `/poc/:id/chat`
4. The chat thread is empty (session-only — history not persisted)

**Expected**: No error, clean empty state, ready for new conversation. This is documented behaviour (not a bug).

---

## Routing Integration

The chat page reuses the existing `RunConfig` component to show the active model in a small header row. The developer can see at a glance which model the agent will use before sending the first message.
