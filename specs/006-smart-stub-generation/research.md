# Research: Smart Stub Generation

## Existing Backend Behavior

**Decision**: Reuse the existing endpoint unchanged.  
**Rationale**: `POST /api/pocs/:pocId/tools/stubs/generate` already accepts `{ overwrite: boolean }`. When `overwrite: false`, the backend skips tools that have a non-empty `mockResponse` and returns `{ generated, skipped, failed }`. When `overwrite: true`, it regenerates all tools. Per-tool generation can be achieved by sending `overwrite: true` with a single-tool payload — but the current endpoint always fetches all tools from the DB. The simplest compliant approach is to call the endpoint with `overwrite: true` for a specific tool and then update only that tool's response client-side, OR add a `toolName` filter param. Since the spec says "reuse the same endpoint with a single-tool payload" (Assumption 1), we add an optional `toolNames?: string[]` filter to the DTO so the backend only generates for the requested subset.  
**Alternatives considered**: A separate `POST /api/pocs/:pocId/tools/:toolName/stub` endpoint — rejected as unnecessary new route for a minor variation; extending the existing DTO is simpler.

## Empty Tool Detection (FR-008)

**Decision**: A tool is empty if `mockResponse` is `null | undefined | ''` or contains only whitespace (`mockResponse.trim() === ''`).  
**Rationale**: Matches spec FR-008 exactly. Already partially handled in backend (`!overwrite` path checks if `mockResponse` exists), but for the frontend count badge the check must be client-side using the same rule.  
**Implementation**: `const isEmpty = (r?: string) => !r || r.trim() === '';`

## Count Badge on Bulk Button

**Decision**: Pass `tools: ToolDefinition[]` prop to `GenerateStubsButton`; compute empty count inline.  
**Rationale**: `PocEditor` already holds the `poc` object with `tools`; passing it down is a one-line change. Computing client-side avoids an extra API call and updates synchronously as users type into mock response fields.  
**Alternatives considered**: Fetching count from backend — unnecessary round-trip; computing in `PocEditor` and passing the number — less flexible (button also needs the list to know if all are filled).

## Per-Tool Button Placement

**Decision**: Render a `<ToolStubButton>` inside the expanded panel of each `ToolsEditor` card, next to the "Mock response" label.  
**Rationale**: Keeps the button contextually close to the field it populates. Only visible in the expanded card (progressive disclosure — Principle VII). Uses the same `Sparkle` icon + `Button` component as the bulk button for visual consistency.

## Backend DTO Extension

**Decision**: Add optional `toolNames?: string[]` to `GenerateStubsDto`; in `EvalService.generateStubs`, filter the tools array by this list before generation when present.  
**Rationale**: This is a minimal change (one optional field, one filter line) that enables the per-tool flow without a new endpoint. The frontend sends `{ overwrite: true, toolNames: [toolName] }` for single-tool regeneration.  
**Alternatives considered**: Always send `overwrite: true` and let the client merge only the returned tool's stub — rejected because the backend would still run LLM calls for all tools; wasteful and slow.

## Loading State Isolation (FR-006, FR-007)

**Decision**: `ToolStubButton` tracks its own `isPending` state via a dedicated `useMutation` instance keyed to `toolName`. Bulk and per-tool mutations are independent.  
**Rationale**: Each `ToolStubButton` mounts its own mutation so one tool's loading state cannot bleed into another. If one fails, `onError` shows a toast for that tool only (FR-007).

## No New Dependencies

All implementation uses existing patterns: `useMutation` (TanStack Query), `api.post`, `Button`, `Sparkle`, `useToast`, `useQueryClient`. Zero new packages required.
