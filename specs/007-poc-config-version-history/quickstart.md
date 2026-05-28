# Quickstart: POC Config Version History

## What Changes

1. **Automatic snapshots** — every system prompt or tools save silently creates a new `PocConfigVersion`. No user action required.
2. **Version history panel** — collapsible panel at the bottom of `PocEditor` listing all versions with timestamps and change labels. Current version shown as a badge in the editor header.
3. **Diff view** — select any two versions to see a line-by-line diff of the system prompt and a structural diff of tools (added/removed/modified by name). Computed client-side, no server round-trip.
4. **Restore** — one click on any version + confirm → POC reverts to that snapshot; a new version entry records the restore.
5. **Eval run tagging** — every new eval run is stamped with the active config version. Comparison view shows a warning when selected runs have different config versions.

## Implementation Checklist

### Backend

- [ ] Add `PocConfigVersion` model to `packages/backend/prisma/schema.prisma`
- [ ] Add `currentConfigVersionId` to `PocConfig`, `configVersionId` + `snapshotConfigVersionNumber` to `EvalRun`
- [ ] Write and apply migration SQL
- [ ] Add `createConfigVersion(pocId, systemPrompt, tools, label?)` helper in `PocService` (deduplication by content hash)
- [ ] Call `createConfigVersion` in `ScaffoldService.scaffold()` after POC creation (v1, label "Initial version")
- [ ] Call `createConfigVersion` in `PocService.update()` after successful write (only when systemPrompt or tools changed)
- [ ] In `EvalService.startRun()`: look up latest `PocConfigVersion` for POC, stamp `configVersionId` + `snapshotConfigVersionNumber` on the `EvalRun`
- [ ] Add `GET /pocs/:pocId/config-versions` endpoint (list, no content)
- [ ] Add `GET /pocs/:pocId/config-versions/:id` endpoint (full content for diff)
- [ ] Add `POST /pocs/:pocId/config-versions/:id/restore` endpoint (reads version → calls update → returns updated POC)

### Frontend

- [ ] Add `PocConfigVersion`, `PocConfigVersionSummary` types to `packages/shared/src/types.ts`
- [ ] Add `configVersionId`, `snapshotConfigVersionNumber` to `EvalRun` type in shared types
- [ ] Create `packages/frontend/src/components/poc/ConfigVersionHistory.tsx`:
  - Version list (reverse-chron, version number badge, change label, timestamp, Restore button)
  - Diff view: select two versions → fetch full content → render line diff for system prompt, structural diff for tools
  - Restore confirmation flow
- [ ] Render `<ConfigVersionHistory pocId={poc.id} />` at the bottom of `PocEditor` (collapsible)
- [ ] In `EvalResults.tsx`: show `v{snapshotConfigVersionNumber}` badge on each run; add config version mismatch warning in comparison view alongside existing eval suite version mismatch warning

## Diff Implementation (no library)

```typescript
// Line diff for system prompt
function lineDiff(a: string, b: string): Array<{ type: 'added' | 'removed' | 'unchanged'; text: string }> {
  const aLines = a.split('\n');
  const bLines = b.split('\n');
  // LCS-based Myers diff or simple two-pointer for small texts
  // Return array of { type, text } for rendering with green/red/neutral rows
}

// Structural diff for tools
function toolsDiff(oldTools: ToolDefinition[], newTools: ToolDefinition[]) {
  const oldMap = new Map(oldTools.map(t => [t.name, t]));
  const newMap = new Map(newTools.map(t => [t.name, t]));
  const added = newTools.filter(t => !oldMap.has(t.name));
  const removed = oldTools.filter(t => !newMap.has(t.name));
  const modified = newTools.filter(t => {
    const old = oldMap.get(t.name);
    return old && JSON.stringify(old) !== JSON.stringify(t);
  });
  return { added, removed, modified };
}
```

## Acceptance Test Flow

1. Open a POC, edit the system prompt, click Save → history panel shows "v2 — System prompt changed"
2. Edit a tool, click Save tools → history panel shows "v3 — Tools changed"
3. Save without making any change → no new version created (still at v3)
4. Select v1 and v3 in the diff view → system prompt diff shows additions/removals, tools diff shows modified tool
5. Click "Restore" on v1, confirm → POC editor shows v1 content; history shows "v4 — Restored from v1"
6. Run evals → new run tagged with v4
7. Select runs from v1 and v4 for comparison → warning appears: "Config versions differ (v1 vs v4)"
