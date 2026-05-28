# Quickstart: Smart Stub Generation

## What Changed

1. **Bulk "Generate Stubs" button** — now shows a count badge (e.g., "Generate stubs (3)") reflecting how many empty tools will be affected. Disabled when all tools already have stubs.
2. **Per-tool "Generate Stub" button** — each expanded tool card has its own button that regenerates that tool's stub unconditionally, with an independent loading state.
3. **Backend DTO** — accepts an optional `toolNames` array to scope generation to a subset.

## Implementation Checklist

### Backend (minimal)

- [ ] `packages/backend/src/eval/dto/generate-stubs.dto.ts` — add `@IsOptional() @IsArray() @IsString({ each: true }) toolNames?: string[];`
- [ ] `packages/backend/src/eval/eval.service.ts` (`generateStubs` method) — after parsing tools, add: `const targets = dto.toolNames?.length ? tools.filter(t => dto.toolNames!.includes(t.name)) : tools;` then use `targets` instead of `tools` for the LLM call

### Frontend

- [ ] `packages/frontend/src/pages/PocEditor.tsx` — pass `tools={poc.tools}` prop to `<GenerateStubsButton>`
- [ ] `packages/frontend/src/components/poc/GenerateStubsButton.tsx` — accept `tools` prop; compute `emptyCount`; update button label to show count; disable when `emptyCount === 0`; remove the `checking` / `confirming` two-phase flow (now unnecessary — bulk always targets only empty tools)
- [ ] `packages/frontend/src/components/poc/ToolStubButton.tsx` — new component: `useMutation` calling `api.post` with `{ overwrite: true, toolNames: [tool.name] }`; calls `onSuccess(toolName, mockResponse)` on completion; shows spinner while pending
- [ ] `packages/frontend/src/components/poc/ToolsEditor.tsx` — render `<ToolStubButton>` inside the expanded card section, next to the "Mock response" label; wire `onSuccess` to update `draft` state

## Key Design Decisions

- The `checking` + `confirming` two-step flow in `GenerateStubsButton` is **removed** — it was a workaround for the old behavior where bulk could overwrite filled stubs. Now that bulk is always empty-only, the confirmation dialog is unnecessary.
- `ToolStubButton.onSuccess` receives the generated mock response string directly from `GenerateStubsResult.generated`, then the parent `ToolsEditor` sets it on the draft. This avoids a full React Query cache invalidation + re-fetch for a single field update.
- The `emptyCount` badge is rendered as ` (N)` appended to the button label — no separate DOM element needed.

## Acceptance Test Flow

1. Create a POC with 3 tools. Leave 2 empty, fill 1 with `{"ok": true}`.
2. View the Tools tab — bulk button should read "Generate stubs (2)".
3. Click bulk button — only the 2 empty tools get stubs. The filled tool is unchanged.
4. All 3 tools now filled — bulk button reads "Generate stubs (0)" and is disabled.
5. Expand a tool card — a "Generate stub" button is visible next to the Mock response label.
6. Click the per-tool button — spinner appears on that card only; other cards unchanged.
7. After generation, the mock response field is populated with the new stub.
